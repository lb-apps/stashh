-- Create the menu-images storage bucket for storing downloaded menu item images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('menu-images', 'menu-images', true, 5242880, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to menu images
CREATE POLICY "Public read access for menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Allow service role to upload menu images
CREATE POLICY "Service role can upload menu images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'menu-images');

-- Allow service role to update (upsert) menu images
CREATE POLICY "Service role can update menu images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'menu-images');
