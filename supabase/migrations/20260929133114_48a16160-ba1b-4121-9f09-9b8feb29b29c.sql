CREATE TABLE public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read own admin row" ON public.admin_users FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id)
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.invitations;
CREATE POLICY "Admins can view all invitations" ON public.invitations FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert invitations" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update invitations" ON public.invitations FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete invitations" ON public.invitations FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete preview files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read preview files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update preview files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload preview files" ON storage.objects;
CREATE POLICY "Admins can read preview files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invitation-previews' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins can upload preview files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invitation-previews' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins can update preview files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invitation-previews' AND public.is_admin(auth.uid())) WITH CHECK (bucket_id = 'invitation-previews' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete preview files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'invitation-previews' AND public.is_admin(auth.uid()));