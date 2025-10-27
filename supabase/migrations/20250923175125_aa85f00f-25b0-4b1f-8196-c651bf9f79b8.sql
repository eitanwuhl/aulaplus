-- Actualizar tabla planificaciones para usar unidades didácticas
ALTER TABLE planificaciones 
DROP COLUMN IF EXISTS mapeo_competencias_contenidos,
DROP COLUMN IF EXISTS contenidos_programa,
DROP COLUMN IF EXISTS competencias_seleccionadas;

-- Agregar nueva columna para unidades didácticas
ALTER TABLE planificaciones 
ADD COLUMN unidades_didacticas jsonb DEFAULT '[]'::jsonb;