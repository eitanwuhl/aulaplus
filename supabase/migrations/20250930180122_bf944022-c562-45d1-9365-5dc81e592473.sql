-- Paso 3: Agregar campos nuevos a sesiones_clase
ALTER TABLE sesiones_clase
  ADD COLUMN IF NOT EXISTS semana_objetivo INTEGER,
  ADD COLUMN IF NOT EXISTS bloque_preferido JSONB,
  ADD COLUMN IF NOT EXISTS bloqueo_reserva BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS motivo_cambio TEXT,
  ADD COLUMN IF NOT EXISTS argumento_competencias TEXT;

-- Paso 4: Agregar campos a planificaciones
ALTER TABLE planificaciones
  ADD COLUMN IF NOT EXISTS cantidad_sesiones INTEGER,
  ADD COLUMN IF NOT EXISTS cadencia_deseada TEXT,
  ADD COLUMN IF NOT EXISTS bloques_preferidos JSONB,
  ADD COLUMN IF NOT EXISTS ventana_sugerida TEXT;