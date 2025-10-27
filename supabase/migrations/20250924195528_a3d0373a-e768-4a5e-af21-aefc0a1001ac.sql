-- Agregar columnas para compartir planificaciones con equipo psicopedagógico y dirección
ALTER TABLE public.planificaciones 
ADD COLUMN compartido_equipo BOOLEAN DEFAULT false,
ADD COLUMN compartido_direccion BOOLEAN DEFAULT false;