-- Create storage bucket for rehosted images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('evaluaciones-assets', 'evaluaciones-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the bucket
CREATE POLICY "Allow public read access to evaluaciones-assets" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'evaluaciones-assets');

CREATE POLICY "Allow authenticated users to upload to evaluaciones-assets" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'evaluaciones-assets' AND auth.uid() IS NOT NULL);