CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

GRANT SELECT ON public.invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;
CREATE POLICY "Admins can view all invitations" ON public.invitations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert invitations" ON public.invitations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update invitations" ON public.invitations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete invitations" ON public.invitations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read preview files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invitation-previews' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can upload preview files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'invitation-previews' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update preview files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'invitation-previews' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete preview files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'invitation-previews' AND public.has_role(auth.uid(), 'admin'));