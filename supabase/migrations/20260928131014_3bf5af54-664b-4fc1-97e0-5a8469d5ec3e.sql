CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_name TEXT NOT NULL,
  design_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  preview_image_path TEXT,
  invitation_url TEXT,
  collection TEXT NOT NULL DEFAULT 'Standard',
  starting_price NUMERIC,
  featured BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.invitations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated;
GRANT ALL ON public.invitations TO service_role;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published invitations"
  ON public.invitations
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Anyone can view invitation previews"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'invitation-previews');