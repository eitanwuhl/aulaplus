-- Module 2: contenidos EBI de ejemplo para planificador macro (catálogo M1 global)

INSERT INTO public.curriculum_catalog_items (catalog_id, tipo, codigo, nombre, descripcion, nivel, materia, orden)
SELECT
  'a0000000-0000-4000-8000-000000000001'::uuid,
  v.tipo::public.catalog_item_type,
  v.codigo,
  v.nombre,
  v.descripcion,
  v.nivel,
  v.materia,
  v.orden
FROM (
  VALUES
    ('contenido', 'MAT-9-U1', 'Números racionales y operaciones', 'Unidad 1 — Tramo 6 Matemática', 'Tramo 6', 'Matemática', 100),
    ('contenido', 'MAT-9-U2', 'Proporcionalidad y porcentajes', 'Unidad 2 — Tramo 6 Matemática', 'Tramo 6', 'Matemática', 101),
    ('contenido', 'MAT-9-U3', 'Geometría plana y medición', 'Unidad 3 — Tramo 6 Matemática', 'Tramo 6', 'Matemática', 102),
    ('contenido', 'ESP-9-U1', 'Literatura uruguaya del siglo XX', 'Unidad 1 — Tramo 6 Lengua', 'Tramo 6', 'Lengua Española', 110),
    ('contenido', 'ESP-9-U2', 'Producción de textos argumentativos', 'Unidad 2 — Tramo 6 Lengua', 'Tramo 6', 'Lengua Española', 111),
    ('contenido', 'HIS-9-U1', 'Uruguay en el siglo XX', 'Contenido programa Historia 9°CB', 'Tramo 6', 'Historia', 120),
    ('contenido', 'HIS-9-U2', 'Democracia y ciudadanía', 'Contenido programa Historia 9°CB', 'Tramo 6', 'Historia', 121)
) AS v(tipo, codigo, nombre, descripcion, nivel, materia, orden)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.curriculum_catalog_items i
  WHERE i.catalog_id = 'a0000000-0000-4000-8000-000000000001'::uuid
    AND i.codigo = v.codigo
);
