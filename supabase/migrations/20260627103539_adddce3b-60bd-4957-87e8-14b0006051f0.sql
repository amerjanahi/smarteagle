REVOKE EXECUTE ON FUNCTION public.user_has_villa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_villa(uuid) TO authenticated;