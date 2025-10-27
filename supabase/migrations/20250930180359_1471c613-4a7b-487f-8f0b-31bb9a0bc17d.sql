-- Paso 5: Crear tabla calendario_eventos e índices (corregido)
CREATE TABLE IF NOT EXISTS calendario_eventos(
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  titulo TEXT NOT NULL,
  alcance TEXT NOT NULL DEFAULT 'institucional',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en calendario_eventos
ALTER TABLE calendario_eventos ENABLE ROW LEVEL SECURITY;

-- Drop policies si existen y recrearlas
DROP POLICY IF EXISTS "Users can view calendario_eventos" ON calendario_eventos;
CREATE POLICY "Users can view calendario_eventos" ON calendario_eventos
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own eventos" ON calendario_eventos;
CREATE POLICY "Users can create their own eventos" ON calendario_eventos
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update eventos" ON calendario_eventos;
CREATE POLICY "Users can update eventos" ON calendario_eventos
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete eventos" ON calendario_eventos;
CREATE POLICY "Users can delete eventos" ON calendario_eventos
  FOR DELETE USING (true);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_sesiones_clase_estado ON sesiones_clase(estado);
-- CREATE INDEX IF NOT EXISTS idx_sesiones_clase_orden ON sesiones_clase(orden); -- Comentado: columna orden no existe
CREATE INDEX IF NOT EXISTS idx_calendario_eventos_fecha ON calendario_eventos(fecha);