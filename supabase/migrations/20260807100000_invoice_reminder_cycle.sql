-- Step 1: invoice reminder settings and queue. Delivery providers are connected later.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_number text;

CREATE TABLE IF NOT EXISTS public.invoice_reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_kind text NOT NULL CHECK (trigger_kind IN ('on_issue', 'before_due', 'on_due', 'after_due')),
  offset_days integer NOT NULL DEFAULT 0 CHECK (offset_days >= 0 AND offset_days <= 365),
  channels text[] NOT NULL DEFAULT ARRAY['email']::text[] CHECK (channels <@ ARRAY['email', 'whatsapp', 'in_app']::text[]),
  email_subject_template text NOT NULL,
  email_body_template text NOT NULL,
  whatsapp_template text NOT NULL,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar', 'bilingual')),
  send_time time NOT NULL DEFAULT '09:00',
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.invoice_reminder_rules(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email text,
  recipient_phone text,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[] CHECK (channels <@ ARRAY['email', 'whatsapp', 'in_app']::text[]),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'queued', 'sent', 'delivered', 'failed', 'skipped', 'cancelled')),
  email_subject text,
  email_body text,
  whatsapp_body text,
  delivery_note text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, rule_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS invoice_reminders_due_idx ON public.invoice_reminders(status, scheduled_for);
CREATE INDEX IF NOT EXISTS invoice_reminders_invoice_idx ON public.invoice_reminders(invoice_id);
CREATE TRIGGER invoice_reminder_rules_set_updated BEFORE UPDATE ON public.invoice_reminder_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER invoice_reminders_set_updated BEFORE UPDATE ON public.invoice_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.invoice_reminder_rules
  (name, trigger_kind, offset_days, channels, email_subject_template, email_body_template, whatsapp_template, language)
SELECT * FROM (VALUES
  ('Invoice issued', 'on_issue', 0, ARRAY['email','in_app']::text[], 'New invoice {{invoice_number}} is available', 'Hello {{customer_name}}, your invoice {{invoice_number}} for {{invoice_total}} is available. Due date: {{due_date}}.', 'Hello {{customer_name}}, invoice {{invoice_number}} for {{invoice_total}} is now available. Due {{due_date}}.', 'en'),
  ('Due in 7 days', 'before_due', 7, ARRAY['email']::text[], 'Invoice {{invoice_number}} is due soon', 'Hello {{customer_name}}, a balance of {{balance_due}} for invoice {{invoice_number}} is due on {{due_date}}.', 'Reminder: {{balance_due}} for invoice {{invoice_number}} is due on {{due_date}}.', 'en'),
  ('Due today', 'on_due', 0, ARRAY['email','whatsapp']::text[], 'Invoice {{invoice_number}} is due today', 'Hello {{customer_name}}, invoice {{invoice_number}} is due today. Outstanding balance: {{balance_due}}.', 'Hello {{customer_name}}, invoice {{invoice_number}} is due today. Balance: {{balance_due}}.', 'en'),
  ('Overdue by 7 days', 'after_due', 7, ARRAY['email','whatsapp']::text[], 'Invoice {{invoice_number}} is overdue', 'Hello {{customer_name}}, invoice {{invoice_number}} is overdue. Outstanding balance: {{balance_due}}.', 'Hello {{customer_name}}, invoice {{invoice_number}} is overdue. Balance: {{balance_due}}.', 'en'),
  ('Final overdue reminder', 'after_due', 14, ARRAY['email','whatsapp','in_app']::text[], 'Final reminder: invoice {{invoice_number}}', 'Hello {{customer_name}}, invoice {{invoice_number}} remains unpaid. Outstanding balance: {{balance_due}}. Please contact management if you need assistance.', 'Final reminder: invoice {{invoice_number}} has {{balance_due}} outstanding. Please contact management.', 'en')
) AS defaults(name, trigger_kind, offset_days, channels, email_subject_template, email_body_template, whatsapp_template, language)
WHERE NOT EXISTS (SELECT 1 FROM public.invoice_reminder_rules);

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
  FOR rule IN SELECT * FROM public.invoice_reminder_rules WHERE enabled LOOP
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

DROP TRIGGER IF EXISTS invoices_schedule_reminders ON public.invoices;
CREATE TRIGGER invoices_schedule_reminders
AFTER INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.schedule_invoice_reminders();

CREATE OR REPLACE FUNCTION public.stop_invoice_reminders_when_settled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('paid', 'cancelled') THEN
    UPDATE public.invoice_reminders
    SET status = 'cancelled', delivery_note = 'Stopped because the invoice was ' || NEW.status
    WHERE invoice_id = NEW.id AND status IN ('scheduled', 'queued');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_stop_reminders_when_settled ON public.invoices;
CREATE TRIGGER invoices_stop_reminders_when_settled
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.stop_invoice_reminders_when_settled();

ALTER TABLE public.invoice_reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_reminder_rules, public.invoice_reminders TO authenticated;

CREATE POLICY "top admin manages invoice reminder rules" ON public.invoice_reminder_rules
FOR ALL TO authenticated
USING (public.is_top_admin(auth.uid()))
WITH CHECK (public.is_top_admin(auth.uid()));

CREATE POLICY "sales staff view invoice reminder queue" ON public.invoice_reminders
FOR SELECT TO authenticated
USING (public.can_manage_sales(auth.uid()));

CREATE POLICY "top admin manages invoice reminder queue" ON public.invoice_reminders
FOR ALL TO authenticated
USING (public.is_top_admin(auth.uid()))
WITH CHECK (public.is_top_admin(auth.uid()));

CREATE POLICY "residents view own invoice reminders" ON public.invoice_reminders
FOR SELECT TO authenticated
USING (recipient_user_id = auth.uid());
