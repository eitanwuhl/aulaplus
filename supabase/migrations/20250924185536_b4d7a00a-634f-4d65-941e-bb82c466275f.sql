-- Add titulo column to sesiones_clase for session naming
ALTER TABLE public.sesiones_clase 
ADD COLUMN IF NOT EXISTS titulo text;