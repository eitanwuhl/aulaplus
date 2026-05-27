-- Module 1: global ANEP EBI catalog (minimal PILOTO seed)
-- Re-run after migration: included in seed:module1 or seed:demo

INSERT INTO public.curriculum_catalogs (id, framework, nombre, version, estado, school_id, metadata)
VALUES (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'anep_ebi',
  'ANEP MCN / Programas EBI — Piloto Aula+',
  '2026.1',
  'activa',
  NULL,
  '{"source":"aulaplus_seed","tramos":6}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  estado = EXCLUDED.estado;

-- Competencias generales MCN (muestra)
INSERT INTO public.curriculum_catalog_items (catalog_id, tipo, codigo, nombre, descripcion, nivel, orden)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'competencia_general', 'CG01', 'Pensamiento crítico', 'Dominio Pensamiento y Comunicación', NULL, 1),
  ('a0000000-0000-4000-8000-000000000001', 'competencia_general', 'CG02', 'Comunicación efectiva', 'Dominio Pensamiento y Comunicación', NULL, 2),
  ('a0000000-0000-4000-8000-000000000001', 'competencia_general', 'CG03', 'Trabajo colaborativo', 'Dominio Relacionamiento y Acción', NULL, 3),
  ('a0000000-0000-4000-8000-000000000001', 'espacio_curricular', 'EC-CM', 'Científico-Matemático', 'Espacio curricular EBI', NULL, 10),
  ('a0000000-0000-4000-8000-000000000001', 'espacio_curricular', 'EC-COM', 'Comunicación', 'Espacio curricular EBI', NULL, 11),
  ('a0000000-0000-4000-8000-000000000001', 'materia', 'MAT-9', 'Matemática', 'Tramo 6 — 9°CB', 'Tramo 6', 20),
  ('a0000000-0000-4000-8000-000000000001', 'materia', 'ESP-9', 'Lengua Española', 'Tramo 6 — 9°CB', 'Tramo 6', 21)
;

-- Activate ANEP for demo schools + link catalog
INSERT INTO public.school_curriculum_frameworks (school_id, framework, activo, catalog_id, configuracion, idioma_generacion)
SELECT s.id, 'anep_ebi'::public.curriculum_framework, true, 'a0000000-0000-4000-8000-000000000001'::uuid, '{}'::jsonb, 'es'
FROM public.schools s
ON CONFLICT (school_id, framework) DO UPDATE SET
  activo = true,
  catalog_id = EXCLUDED.catalog_id;

-- Default group frameworks for demo catalog groups
UPDATE public.school_groups
SET primary_framework = 'anep_ebi'
WHERE primary_framework IS NULL;

-- Demo schools: mark onboarding done so docentes can operate (dirección puede reconfigurar)
UPDATE public.schools
SET
  onboarding_completed_at = COALESCE(onboarding_completed_at, now()),
  institution_settings = CASE
    WHEN institution_settings = '{}'::jsonb THEN
      '{"niveles_ofrecidos":["cb"],"idioma_principal":"Español","periodos_evaluacion":["trimestres"]}'::jsonb
    ELSE institution_settings
  END
WHERE id IN ('liceo-demo', 'liceo-norte', 'liceo-st-patricks');
