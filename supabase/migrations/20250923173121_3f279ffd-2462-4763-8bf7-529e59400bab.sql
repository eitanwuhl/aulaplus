-- Actualizar tabla planificaciones para mejorar asistente de planificación
-- Cambios: grupos, competencias, contenidos, nuevos campos estructura

-- Agregar nuevas columnas
ALTER TABLE planificaciones 
ADD COLUMN grupo_id text,
ADD COLUMN competencias_seleccionadas text[] DEFAULT '{}',
ADD COLUMN contenidos_programa text,
ADD COLUMN mapeo_competencias_contenidos jsonb DEFAULT '{}',
ADD COLUMN requerimientos_docente text,
ADD COLUMN distribucion_modalidades jsonb DEFAULT '{"individual": 25, "pareja": 25, "grupos": 25, "toda_clase": 25}',
ADD COLUMN estrategias_diferenciacion text;

-- Migrar datos existentes de nivel a grupo_id (mapeo basado en los grupos existentes)
UPDATE planificaciones 
SET grupo_id = CASE 
    WHEN nivel LIKE '%9%' OR nivel LIKE '%noveno%' OR nivel LIKE '%9no%' THEN '9no 1'
    WHEN nivel LIKE '%8%' OR nivel LIKE '%octavo%' OR nivel LIKE '%8vo%' THEN '8vo 1' 
    WHEN nivel LIKE '%7%' OR nivel LIKE '%septimo%' OR nivel LIKE '%7mo%' THEN '7mo 1'
    ELSE CONCAT(nivel, ' - Grupo 1')
END;

-- Migrar metas_aprendizaje a requerimientos_docente
UPDATE planificaciones 
SET requerimientos_docente = metas_aprendizaje;

-- Actualizar distribucion_modalidades basado en modalidad_preferida existente
UPDATE planificaciones 
SET distribucion_modalidades = CASE modalidad_preferida
    WHEN 'taller' THEN '{"individual": 20, "pareja": 30, "grupos": 40, "toda_clase": 10}'::jsonb
    WHEN 'exposicion' THEN '{"individual": 10, "pareja": 15, "grupos": 25, "toda_clase": 50}'::jsonb
    WHEN 'laboratorio' THEN '{"individual": 30, "pareja": 40, "grupos": 25, "toda_clase": 5}'::jsonb
    WHEN 'grupos' THEN '{"individual": 15, "pareja": 25, "grupos": 50, "toda_clase": 10}'::jsonb
    ELSE '{"individual": 25, "pareja": 25, "grupos": 25, "toda_clase": 25}'::jsonb
END;

-- Migrar nivel_diferenciacion a estrategias_diferenciacion
UPDATE planificaciones 
SET estrategias_diferenciacion = CASE nivel_diferenciacion
    WHEN 'bajo' THEN 'Estrategias generales de diferenciación para el grupo'
    WHEN 'medio' THEN 'Adaptaciones selectivas según perfiles de aprendizaje'
    WHEN 'alto' THEN 'Diferenciación individual personalizada por estudiante'
    ELSE 'Diferenciación adaptada al contexto del grupo'
END;

-- Hacer grupo_id obligatorio después de la migración
ALTER TABLE planificaciones 
ALTER COLUMN grupo_id SET NOT NULL;

-- Opcional: Eliminar columnas antiguas (comentado por seguridad)
-- ALTER TABLE planificaciones 
-- DROP COLUMN nivel,
-- DROP COLUMN metas_aprendizaje,
-- DROP COLUMN modalidad_preferida,
-- DROP COLUMN nivel_diferenciacion;