-- Owners Association suggestions, proposals, voting, comments, and notifications.

CREATE TABLE IF NOT EXISTS public.association_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 5 AND 160),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 5000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'closed', 'rejected', 'decided')),
  eligibility TEXT NOT NULL DEFAULT 'all_residents'
    CHECK (eligibility IN ('all_residents', 'owners_only')),
  voting_starts_at TIMESTAMPTZ,
  voting_closes_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  final_decision TEXT,
  action_taken TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    voting_starts_at IS NULL
    OR voting_closes_at IS NULL
    OR voting_closes_at > voting_starts_at
  )
);

CREATE TABLE IF NOT EXISTS public.association_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.association_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice TEXT NOT NULL CHECK (choice IN ('for', 'against')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.association_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.association_proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.association_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.association_proposals(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('published', 'closing_soon', 'decision')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, proposal_id, kind)
);

CREATE INDEX IF NOT EXISTS association_proposals_status_idx
  ON public.association_proposals(status, voting_closes_at);
CREATE INDEX IF NOT EXISTS association_votes_proposal_idx
  ON public.association_votes(proposal_id);
CREATE INDEX IF NOT EXISTS association_comments_proposal_idx
  ON public.association_comments(proposal_id, created_at);
CREATE INDEX IF NOT EXISTS association_notifications_user_idx
  ON public.association_notifications(user_id, read_at, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.association_proposals TO authenticated;
GRANT SELECT ON public.association_votes TO authenticated;
GRANT SELECT, INSERT ON public.association_comments TO authenticated;
GRANT SELECT, UPDATE ON public.association_notifications TO authenticated;
GRANT ALL ON public.association_proposals, public.association_votes,
  public.association_comments, public.association_notifications TO service_role;

ALTER TABLE public.association_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_notifications ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.association_has_active_villa(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_villas
    WHERE user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.association_is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_villas
    WHERE user_id = _user_id
      AND status = 'active'
      AND relationship_type = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION public.association_has_active_villa(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.association_is_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.association_has_active_villa(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.association_is_owner(UUID) TO authenticated;

DROP POLICY IF EXISTS "Residents view association proposals" ON public.association_proposals;
CREATE POLICY "Residents view association proposals"
ON public.association_proposals FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR submitted_by = auth.uid()
  OR (
    status IN ('published', 'closed', 'decided')
    AND public.association_has_active_villa(auth.uid())
  )
);

DROP POLICY IF EXISTS "Residents submit association suggestions" ON public.association_proposals;
CREATE POLICY "Residents submit association suggestions"
ON public.association_proposals FOR INSERT TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND status = 'pending'
  AND public.association_has_active_villa(auth.uid())
);

DROP POLICY IF EXISTS "Admins manage association proposals" ON public.association_proposals;
CREATE POLICY "Admins manage association proposals"
ON public.association_proposals FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Residents view association votes" ON public.association_votes;
CREATE POLICY "Residents view association votes"
ON public.association_votes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.association_proposals p
    WHERE p.id = proposal_id
      AND p.status IN ('published', 'closed', 'decided')
      AND public.association_has_active_villa(auth.uid())
  )
);

DROP POLICY IF EXISTS "Residents view association comments" ON public.association_comments;
CREATE POLICY "Residents view association comments"
ON public.association_comments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.association_proposals p
    WHERE p.id = proposal_id
      AND p.status IN ('published', 'closed', 'decided')
      AND public.association_has_active_villa(auth.uid())
  )
);

DROP POLICY IF EXISTS "Residents add association comments" ON public.association_comments;
CREATE POLICY "Residents add association comments"
ON public.association_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.association_has_active_villa(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.association_proposals p
    WHERE p.id = proposal_id
      AND p.status IN ('published', 'closed', 'decided')
  )
);

DROP POLICY IF EXISTS "Users view own association notifications" ON public.association_notifications;
CREATE POLICY "Users view own association notifications"
ON public.association_notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users mark own association notifications" ON public.association_notifications;
CREATE POLICY "Users mark own association notifications"
ON public.association_notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.cast_association_vote(
  _proposal_id UUID,
  _choice TEXT
)
RETURNS public.association_votes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  proposal public.association_proposals;
  created_vote public.association_votes;
BEGIN
  IF _choice NOT IN ('for', 'against') THEN
    RAISE EXCEPTION 'Vote must be for or against.';
  END IF;

  SELECT * INTO proposal
  FROM public.association_proposals
  WHERE id = _proposal_id;

  IF proposal.id IS NULL OR proposal.status <> 'published' THEN
    RAISE EXCEPTION 'This proposal is not open for voting.';
  END IF;

  IF proposal.voting_starts_at IS NULL OR proposal.voting_closes_at IS NULL
     OR now() < proposal.voting_starts_at OR now() >= proposal.voting_closes_at THEN
    RAISE EXCEPTION 'Voting is not currently open.';
  END IF;

  IF NOT public.association_has_active_villa(auth.uid()) THEN
    RAISE EXCEPTION 'Only linked residents may vote.';
  END IF;

  IF proposal.eligibility = 'owners_only'
     AND NOT public.association_is_owner(auth.uid()) THEN
    RAISE EXCEPTION 'Voting is restricted to eligible owners.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.association_votes
    WHERE proposal_id = _proposal_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You have already voted on this proposal.';
  END IF;

  INSERT INTO public.association_votes(proposal_id, user_id, choice)
  VALUES (_proposal_id, auth.uid(), _choice)
  RETURNING * INTO created_vote;

  RETURN created_vote;
END;
$$;

REVOKE ALL ON FUNCTION public.cast_association_vote(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_association_vote(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_association_proposal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_kind TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  IF NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    notification_kind := 'published';
    notification_title := 'New Owners Association proposal';
    notification_body := NEW.title || ' is now available for review and voting.';
  ELSIF NEW.status = 'decided' AND OLD.status IS DISTINCT FROM 'decided' THEN
    notification_kind := 'decision';
    notification_title := 'Owners Association decision published';
    notification_body := 'A final decision has been published for ' || NEW.title || '.';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.association_notifications(user_id, proposal_id, kind, title, body)
  SELECT DISTINCT uv.user_id, NEW.id, notification_kind, notification_title, notification_body
  FROM public.user_villas uv
  WHERE uv.status = 'active'
    AND (
      NEW.eligibility = 'all_residents'
      OR uv.relationship_type = 'owner'
    )
  ON CONFLICT (user_id, proposal_id, kind) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS association_proposal_notifications ON public.association_proposals;
CREATE TRIGGER association_proposal_notifications
AFTER UPDATE OF status ON public.association_proposals
FOR EACH ROW EXECUTE FUNCTION public.notify_association_proposal_change();

CREATE OR REPLACE FUNCTION public.refresh_association_deadline_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  INSERT INTO public.association_notifications(user_id, proposal_id, kind, title, body)
  SELECT
    auth.uid(),
    p.id,
    'closing_soon',
    'Voting closes soon',
    p.title || ' closes on ' || to_char(p.voting_closes_at, 'Mon DD at HH12:MI AM') || '.'
  FROM public.association_proposals p
  WHERE p.status = 'published'
    AND p.voting_closes_at > now()
    AND p.voting_closes_at <= now() + interval '48 hours'
    AND public.association_has_active_villa(auth.uid())
    AND (
      p.eligibility = 'all_residents'
      OR public.association_is_owner(auth.uid())
    )
  ON CONFLICT (user_id, proposal_id, kind) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_association_deadline_notifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_association_deadline_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_association_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS association_proposals_updated_at ON public.association_proposals;
CREATE TRIGGER association_proposals_updated_at
BEFORE UPDATE ON public.association_proposals
FOR EACH ROW EXECUTE FUNCTION public.set_association_updated_at();
