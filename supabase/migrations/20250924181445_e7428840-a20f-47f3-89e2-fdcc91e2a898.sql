-- Add carpeta column to planificaciones table
ALTER TABLE public.planificaciones 
ADD COLUMN carpeta text DEFAULT NULL;

-- Update existing sessions to limit competencias_anep to maximum 2
UPDATE public.sesiones_clase 
SET competencias_anep = competencias_anep[1:2] 
WHERE array_length(competencias_anep, 1) > 2;