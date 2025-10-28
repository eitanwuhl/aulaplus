/**
 * Normaliza cualquier valor a un array de strings para campos JSON de Supabase.
 * 
 * Maneja múltiples formatos de entrada:
 * - null/undefined → []
 * - string único → ["string"]
 * - string con comas → ["item1", "item2"]
 * - object con .codes o .ids → ["code1", "code2"]
 * - array → deduplica, limpia nulos/vacíos
 * 
 * @param value - Valor de cualquier tipo proveniente de IA o formulario
 * @returns Array de strings limpios, sin duplicados ni valores vacíos
 * 
 * @example
 * normalizeArrayField("CL10.1") → ["CL10.1"]
 * normalizeArrayField("CL10.1, CL10.2") → ["CL10.1", "CL10.2"]
 * normalizeArrayField({ codes: ["CL10.1"] }) → ["CL10.1"]
 * normalizeArrayField(null) → []
 * normalizeArrayField(["A", null, "", "B", "A"]) → ["A", "B"]
 */
export function normalizeArrayField(value: unknown): string[] {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return [];
  }

  // Handle single string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    
    // Check for comma-separated values
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .filter((item, index, self) => self.indexOf(item) === index); // dedupe
    }
    
    return [trimmed];
  }

  // Handle object with codes/ids property (AI sometimes returns {codes: [...]} or {ids: [...]})
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    
    // Try common property names
    if (obj.codes && Array.isArray(obj.codes)) {
      return normalizeArrayField(obj.codes);
    }
    if (obj.ids && Array.isArray(obj.ids)) {
      return normalizeArrayField(obj.ids);
    }
    if (obj.items && Array.isArray(obj.items)) {
      return normalizeArrayField(obj.items);
    }
    if (obj.values && Array.isArray(obj.values)) {
      return normalizeArrayField(obj.values);
    }
    
    // Object without recognized array property
    return [];
  }

  // Handle array
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return item.trim();
        if (item === null || item === undefined) return null;
        // Coerce numbers, booleans, etc to string
        return String(item).trim();
      })
      .filter((item): item is string => Boolean(item)) // Remove null, undefined, empty strings
      .filter((item, index, self) => self.indexOf(item) === index); // Dedupe
  }

  // Fallback for unexpected types
  console.warn('[normalizeArrayField] Tipo inesperado:', typeof value, value);
  return [];
}

/**
 * Normaliza campos array de un objeto de sesión antes de PATCH a Supabase.
 * 
 * Aplica normalizeArrayField() a todos los campos de tipo array en el schema
 * de sesiones_clase para garantizar compatibilidad con Postgres.
 * 
 * @param data - Objeto parcial de sesión con campos potencialmente inconsistentes
 * @returns Objeto con campos array normalizados a string[]
 * 
 * @example
 * normalizeSessionArrayFields({
 *   criterios_logro_anep: "CL10.1, CL10.2",
 *   competencias_anep: ["C1", null, "C2"]
 * })
 * → {
 *   criterios_logro_anep: ["CL10.1", "CL10.2"],
 *   competencias_anep: ["C1", "C2"]
 * }
 */
export function normalizeSessionArrayFields(data: Record<string, unknown>): Record<string, unknown> {
  const arrayFields = [
    'criterios_logro_anep',
    'competencias_anep',
    'contenidos_anep',
    'recursos',
    'competencias_especificas_ids',
    'contenidos_anep_ids'
  ];

  const normalized = { ...data };

  for (const field of arrayFields) {
    if (field in normalized) {
      normalized[field] = normalizeArrayField(normalized[field]);
    }
  }

  return normalized;
}
