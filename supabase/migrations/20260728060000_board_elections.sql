-- Owners Association board elections. Ballot identities are protected by RLS;
-- results are exposed only as aggregate counts through a security-definer RPC.
CREATE TABLE public.association_elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','nominations','candidate_review','voting','closed','published','archived')),
  voting_basis TEXT NOT NULL DEFAULT 'per_owner' CHECK (voting_basis IN ('per_owner','per_unit')),
  secret_ballot BOOLEAN NOT NULL DEFAULT true,
  show_live_results BOOLEAN NOT NULL DEFAULT false,
  nominations_open_at TIMESTAMPTZ NOT NULL,
  nominations_close_at TIMESTAMPTZ NOT NULL,
  voting_open_at TIMESTAMPTZ NOT NULL,
  voting_close_at TIMESTAMPTZ NOT NULL,
  term_starts_on DATE,
  term_ends_on DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (nominations_close_at > nominations_open_at),
  CHECK (voting_open_at >= nominations_close_at),
  CHECK (voting_close_at > voting_open_at)
);

CREATE TABLE public.association_election_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.association_elections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1 CHECK (seats BETWEEN 1 AND 20),
  display_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(election_id, title)
);

CREATE TABLE public.association_election_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.association_elections(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.association_election_positions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nominated_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  statement TEXT NOT NULL,
  experience TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','withdrawn','elected')),
  review_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(election_id, position_id, user_id)
);

CREATE TABLE public.association_election_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID NOT NULL REFERENCES public.association_elections(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES public.association_election_positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.association_election_candidates(id) ON DELETE CASCADE,
  voter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voter_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(election_id, position_id, candidate_id, voter_key)
);

CREATE INDEX association_elections_status_idx ON public.association_elections(status, voting_close_at);
CREATE INDEX association_candidates_election_idx ON public.association_election_candidates(election_id, position_id, status);
CREATE INDEX association_ballots_result_idx ON public.association_election_ballots(election_id, position_id, candidate_id);

GRANT SELECT, INSERT, UPDATE ON public.association_elections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.association_election_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.association_election_candidates TO authenticated;
GRANT SELECT ON public.association_election_ballots TO authenticated;
GRANT ALL ON public.association_elections, public.association_election_positions,
  public.association_election_candidates, public.association_election_ballots TO service_role;

ALTER TABLE public.association_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_election_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_election_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.association_election_ballots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners view elections" ON public.association_elections FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR (status <> 'draft' AND public.association_is_owner(auth.uid())));
CREATE POLICY "admins manage elections" ON public.association_elections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners view election positions" ON public.association_election_positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.association_elections e WHERE e.id = election_id
    AND (public.has_role(auth.uid(), 'admin') OR (e.status <> 'draft' AND public.association_is_owner(auth.uid())))));
CREATE POLICY "admins manage election positions" ON public.association_election_positions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "owners view approved or own candidates" ON public.association_election_candidates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid()
    OR (status IN ('approved','elected') AND public.association_is_owner(auth.uid())));
CREATE POLICY "admins review candidates" ON public.association_election_candidates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- A voter may confirm their own ballot. Administrators never receive individual
-- ballot access; they use aggregate_election_results instead.
CREATE POLICY "owners view own ballots" ON public.association_election_ballots FOR SELECT TO authenticated
  USING (voter_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.nominate_board_candidate(
  _position_id UUID, _statement TEXT, _experience TEXT DEFAULT NULL
) RETURNS public.association_election_candidates
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pos public.association_election_positions;
  election public.association_elections;
  candidate public.association_election_candidates;
  owner_unit UUID;
  owner_name TEXT;
BEGIN
  IF NOT public.association_is_owner(auth.uid()) THEN RAISE EXCEPTION 'Only eligible owners may stand for election.'; END IF;
  SELECT * INTO pos FROM public.association_election_positions WHERE id = _position_id;
  SELECT * INTO election FROM public.association_elections WHERE id = pos.election_id;
  IF election.status <> 'nominations' OR now() < election.nominations_open_at OR now() >= election.nominations_close_at
    THEN RAISE EXCEPTION 'Nominations are not currently open.'; END IF;
  IF char_length(btrim(_statement)) < 20 THEN RAISE EXCEPTION 'Candidate statement must be at least 20 characters.'; END IF;
  SELECT uv.villa_id INTO owner_unit FROM public.user_villas uv
    WHERE uv.user_id = auth.uid() AND uv.status = 'active' AND uv.relationship_type = 'owner'
    ORDER BY uv.created_at LIMIT 1;
  SELECT COALESCE(NULLIF(btrim(p.full_name),''), p.email, 'Owner') INTO owner_name
    FROM public.profiles p WHERE p.id = auth.uid();
  INSERT INTO public.association_election_candidates(
    election_id, position_id, user_id, nominated_by, display_name, unit_id, statement, experience
  ) VALUES (election.id, pos.id, auth.uid(), auth.uid(), owner_name, owner_unit, btrim(_statement), NULLIF(btrim(_experience),''))
  RETURNING * INTO candidate;
  RETURN candidate;
END; $$;
REVOKE ALL ON FUNCTION public.nominate_board_candidate(UUID,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nominate_board_candidate(UUID,TEXT,TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.cast_board_election_vote(
  _position_id UUID, _candidate_id UUID
) RETURNS public.association_election_ballots
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pos public.association_election_positions;
  election public.association_elections;
  candidate public.association_election_candidates;
  ballot public.association_election_ballots;
  key_value TEXT;
  existing_choices INTEGER;
  owner_unit UUID;
BEGIN
  IF NOT public.association_is_owner(auth.uid()) THEN RAISE EXCEPTION 'Only eligible owners may vote.'; END IF;
  SELECT * INTO pos FROM public.association_election_positions WHERE id = _position_id;
  SELECT * INTO election FROM public.association_elections WHERE id = pos.election_id;
  SELECT * INTO candidate FROM public.association_election_candidates WHERE id = _candidate_id;
  IF election.status <> 'voting' OR now() < election.voting_open_at OR now() >= election.voting_close_at
    THEN RAISE EXCEPTION 'Voting is not currently open.'; END IF;
  IF candidate.position_id <> pos.id OR candidate.election_id <> election.id OR candidate.status <> 'approved'
    THEN RAISE EXCEPTION 'This candidate is not available for this position.'; END IF;
  IF election.voting_basis = 'per_unit' THEN
    SELECT uv.villa_id INTO owner_unit FROM public.user_villas uv
      WHERE uv.user_id = auth.uid() AND uv.status = 'active' AND uv.relationship_type = 'owner'
      ORDER BY uv.created_at LIMIT 1;
    key_value := 'unit:' || owner_unit::TEXT;
  ELSE
    key_value := 'owner:' || auth.uid()::TEXT;
  END IF;
  SELECT count(DISTINCT candidate_id) INTO existing_choices
    FROM public.association_election_ballots
    WHERE election_id = election.id AND position_id = pos.id AND voter_key = key_value;
  IF existing_choices >= pos.seats THEN RAISE EXCEPTION 'Your ballot for this position is already complete.'; END IF;
  INSERT INTO public.association_election_ballots(election_id, position_id, candidate_id, voter_user_id, voter_key)
  VALUES (election.id, pos.id, candidate.id, auth.uid(), key_value)
  RETURNING * INTO ballot;
  RETURN ballot;
END; $$;
REVOKE ALL ON FUNCTION public.cast_board_election_vote(UUID,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cast_board_election_vote(UUID,UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.aggregate_election_results(_election_id UUID)
RETURNS TABLE(candidate_id UUID, vote_count BIGINT, turnout BIGINT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE election public.association_elections;
BEGIN
  SELECT * INTO election FROM public.association_elections WHERE id = _election_id;
  IF election.id IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR (
      public.association_is_owner(auth.uid()) AND
      (election.show_live_results OR election.status IN ('closed','published','archived'))
    )
  ) THEN RAISE EXCEPTION 'Results are not available yet.'; END IF;
  RETURN QUERY SELECT c.id, count(b.id), (
    SELECT count(DISTINCT voter_key) FROM public.association_election_ballots WHERE election_id = _election_id
  ) FROM public.association_election_candidates c
  LEFT JOIN public.association_election_ballots b ON b.candidate_id = c.id
  WHERE c.election_id = _election_id AND c.status IN ('approved','elected')
  GROUP BY c.id;
END; $$;
REVOKE ALL ON FUNCTION public.aggregate_election_results(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggregate_election_results(UUID) TO authenticated;

CREATE TRIGGER association_elections_updated BEFORE UPDATE ON public.association_elections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
