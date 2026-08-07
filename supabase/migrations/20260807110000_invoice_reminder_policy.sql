-- Allow each invoice to use the standard cycle, selected rules, or no reminders.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reminder_policy text NOT NULL DEFAULT 'standard'
    CHECK (reminder_policy IN ('standard', 'custom', 'none')),
  ADD COLUMN IF NOT EXISTS reminder_rule_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

COMMENT ON COLUMN public.invoices.reminder_policy IS 'standard uses all enabled rules; custom uses reminder_rule_ids; none schedules no reminders';
COMMENT ON COLUMN public.invoices.reminder_rule_ids IS 'Enabled invoice_reminder_rules selected for a custom invoice reminder cycle';

CREATE OR REPLACE FUNCTION public.schedule_invoice_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule record;
  recipient record;
  scheduled_at timestamptz;
  allowed_channels text[];
BEGIN
  IF COALESCE(NEW.reminder_policy, 'standard') = 'none' THEN
    RETURN NEW;
  END IF;

  FOR rule IN
    SELECT *
    FROM public.invoice_reminder_rules
    WHERE enabled
      AND (
        COALESCE(NEW.reminder_policy, 'standard') = 'standard'
        OR id = ANY(COALESCE(NEW.reminder_rule_ids, ARRAY[]::uuid[]))
      )
  LOOP
    scheduled_at := CASE rule.trigger_kind
      WHEN 'on_issue' THEN NEW.created_at
      WHEN 'before_due' THEN NEW.due_date::timestamp + rule.send_time - make_interval(days => rule.offset_days)
      WHEN 'on_due' THEN NEW.due_date::timestamp + rule.send_time
      WHEN 'after_due' THEN NEW.due_date::timestamp + rule.send_time + make_interval(days => rule.offset_days)
    END;

    FOR recipient IN
      SELECT DISTINCT uv.user_id, p.email, COALESCE(p.whatsapp_number, p.phone) AS phone,
        p.email_reminders_enabled, p.whatsapp_reminders_enabled
      FROM public.user_villas uv
      JOIN public.profiles p ON p.id = uv.user_id
      WHERE uv.villa_id = NEW.unit_id AND uv.status = 'active'
    LOOP
      SELECT array_agg(channel) INTO allowed_channels
      FROM unnest(rule.channels) AS channel
      WHERE channel = 'in_app'
        OR (channel = 'email' AND recipient.email_reminders_enabled AND recipient.email IS NOT NULL)
        OR (channel = 'whatsapp' AND recipient.whatsapp_reminders_enabled AND recipient.phone IS NOT NULL);

      IF COALESCE(array_length(allowed_channels, 1), 0) > 0 THEN
        INSERT INTO public.invoice_reminders (
          invoice_id, unit_id, rule_id, recipient_user_id, recipient_email, recipient_phone,
          channels, scheduled_for, email_subject, email_body, whatsapp_body
        ) VALUES (
          NEW.id, NEW.unit_id, rule.id, recipient.user_id, recipient.email, recipient.phone,
          allowed_channels, GREATEST(scheduled_at, now()), rule.email_subject_template,
          rule.email_body_template, rule.whatsapp_template
        ) ON CONFLICT (invoice_id, rule_id, recipient_user_id) DO NOTHING;
      END IF;
    END LOOP;
  END LOOP;
  RETURN NEW;
END;
$$;
