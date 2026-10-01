DROP POLICY IF EXISTS "Admins have full access to invitations" ON public.invitations;
DROP POLICY IF EXISTS "Public can view published invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;