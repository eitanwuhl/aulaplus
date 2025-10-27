-- Create planificaciones table for course periods
CREATE TABLE public.planificaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nivel TEXT NOT NULL,
  materia TEXT NOT NULL,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  metas_aprendizaje TEXT,
  modalidad_preferida TEXT DEFAULT 'taller',
  nivel_diferenciacion TEXT DEFAULT 'medio',
  horas_semanales INTEGER NOT NULL DEFAULT 2,
  configuracion_horario JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sesiones_clase table for individual class sessions
CREATE TABLE public.sesiones_clase (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planificacion_id UUID NOT NULL REFERENCES public.planificaciones(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  duracion_minutos INTEGER NOT NULL DEFAULT 60,
  competencias_anep TEXT[] DEFAULT '{}',
  contenidos_anep TEXT[] DEFAULT '{}',
  criterios_logro_anep TEXT[] DEFAULT '{}',
  plan_desarrollo JSONB DEFAULT '{}',
  diferenciacion TEXT,
  evaluacion JSONB DEFAULT '{}',
  recursos TEXT[] DEFAULT '{}',
  observaciones TEXT,
  estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'validado', 'exceptuado')),
  es_feriado BOOLEAN DEFAULT false,
  motivo_excepcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.planificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_clase ENABLE ROW LEVEL SECURITY;

-- Create policies for planificaciones
CREATE POLICY "Users can view their own planificaciones" 
ON public.planificaciones 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own planificaciones" 
ON public.planificaciones 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own planificaciones" 
ON public.planificaciones 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own planificaciones" 
ON public.planificaciones 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for sesiones_clase
CREATE POLICY "Users can view sessions of their planificaciones" 
ON public.sesiones_clase 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.planificaciones p 
  WHERE p.id = planificacion_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can create sessions for their planificaciones" 
ON public.sesiones_clase 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.planificaciones p 
  WHERE p.id = planificacion_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can update sessions of their planificaciones" 
ON public.sesiones_clase 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.planificaciones p 
  WHERE p.id = planificacion_id AND p.user_id = auth.uid()
));

CREATE POLICY "Users can delete sessions of their planificaciones" 
ON public.sesiones_clase 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.planificaciones p 
  WHERE p.id = planificacion_id AND p.user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_planificaciones_updated_at
BEFORE UPDATE ON public.planificaciones
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sesiones_clase_updated_at
BEFORE UPDATE ON public.sesiones_clase
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_planificaciones_user_id ON public.planificaciones(user_id);
CREATE INDEX idx_planificaciones_materia ON public.planificaciones(materia);
CREATE INDEX idx_sesiones_clase_planificacion_id ON public.sesiones_clase(planificacion_id);
CREATE INDEX idx_sesiones_clase_fecha ON public.sesiones_clase(fecha);
CREATE INDEX idx_sesiones_clase_estado ON public.sesiones_clase(estado);