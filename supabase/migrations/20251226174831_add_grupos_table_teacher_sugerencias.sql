-- Crear tabla grupos para almacenar información de grupos y sugerencias del docente
-- Esta tabla permite que los docentes personalicen las sugerencias para cada grupo

CREATE TABLE IF NOT EXISTS public.grupos (
  id TEXT NOT NULL PRIMARY KEY,  -- ID del grupo (ej: "9no 1", "9no 2")
  name TEXT NOT NULL,
  year TEXT,
  section TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_sugerencias JSONB DEFAULT NULL,  -- { aula?: string, evaluaciones?: string, otras?: string }
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: los usuarios solo pueden ver/editar sus propios grupos
CREATE POLICY "Users can view their own grupos"
ON public.grupos
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own grupos"
ON public.grupos
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grupos"
ON public.grupos
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Índice para búsquedas rápidas por user_id
CREATE INDEX IF NOT EXISTS idx_grupos_user_id ON public.grupos(user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_grupos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_grupos_updated_at
  BEFORE UPDATE ON public.grupos
  FOR EACH ROW
  EXECUTE FUNCTION update_grupos_updated_at();



















