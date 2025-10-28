/**
 * Tipos para validación a nivel de campo en el Planning Wizard
 * 
 * Este sistema permite mapear errores de validación a campos específicos,
 * facilitando errores inline y focus automático en el primer campo inválido.
 */

export interface FieldError {
  /**
   * ID único del campo que causó el error
   * Ejemplos: 'grupo_id', 'materia', 'configuracion[0].dia'
   */
  fieldId: string;
  
  /**
   * Mensaje de error en español para mostrar al usuario
   * Debe ser conciso y accionable
   */
  message: string;
  
  /**
   * Tipo de error (opcional, para clasificación)
   */
  type?: 'required' | 'format' | 'range' | 'custom';
}

export interface ValidationResult {
  /**
   * true si no hay errores, false en caso contrario
   */
  valid: boolean;
  
  /**
   * Array de errores con campo asociado
   * Vacío si valid === true
   */
  errors: FieldError[];
  
  /**
   * ID del primer campo inválido (para focus automático)
   * undefined si valid === true
   */
  firstInvalidField?: string;
}
