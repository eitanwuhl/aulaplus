-- Create comunicaciones table for persistent teacher communications
CREATE TABLE public.comunicaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  to_role TEXT NOT NULL CHECK (to_role IN ('direccion', 'psicopedagogico')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_planificacion_id UUID REFERENCES public.planificaciones(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comunicaciones ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own communications" 
ON public.comunicaciones 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own communications" 
ON public.comunicaciones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own communications" 
ON public.comunicaciones 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create storage bucket for communication files
INSERT INTO storage.buckets (id, name, public) VALUES ('comunicaciones', 'comunicaciones', true);

-- Create storage policies for communication files
CREATE POLICY "Users can view their own communication files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'comunicaciones' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own communication files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'comunicaciones' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own communication files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'comunicaciones' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own communication files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'comunicaciones' AND auth.uid()::text = (storage.foldername(name))[1]);