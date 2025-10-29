/**
 * Production-safe debug utility for Class Planning Wizard
 * 
 * Enable in browser console:
 * localStorage.setItem('DEBUG_WIZARD', '1')
 * 
 * Disable:
 * localStorage.removeItem('DEBUG_WIZARD')
 * // or localStorage.setItem('DEBUG_WIZARD', '0')
 */

// Safe JSON serialization that handles circular refs, functions, and non-serializable values
const safeSerialize = (value: any): any => {
  const seen = new WeakSet();

  const serialize = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      if (typeof obj === 'function') {
        return `[Function: ${obj.name || 'anonymous'}]`;
      }
      if (typeof obj === 'bigint') {
        return `[BigInt: ${obj.toString()}]`;
      }
      if (typeof obj === 'symbol') {
        return `[Symbol: ${obj.toString()}]`;
      }
      return obj;
    }

    if (seen.has(obj)) {
      return '[Circular Reference]';
    }
    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj.map(serialize);
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: obj.message,
        stack: obj.stack
      };
    }

    const result: any = {};
    for (const [key, val] of Object.entries(obj)) {
      try {
        result[key] = serialize(val);
      } catch (error) {
        result[key] = `[Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
      }
    }

    return result;
  };

  try {
    return serialize(value);
  } catch (error) {
    return `[Fatal Serialization Error: ${error instanceof Error ? error.message : 'Unknown'}]`;
  }
};

// Check if debug logging is enabled
const isDebugEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('DEBUG_WIZARD') === '1';
};

/**
 * Main debug logging function
 * @param scope - Logging scope (e.g., 'LIFECYCLE:MOUNT', 'VALIDATION:PASO0')
 * @param data - Optional data to log (will be safely serialized)
 */
export const DBG = (scope: string, data?: any): void => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WIZARD:${scope}]`;

  if (data !== undefined) {
    const safeData = safeSerialize(data);
    console.log(prefix, safeData);
  } else {
    console.log(prefix);
  }
};

/**
 * Debug helper for React useEffect dependencies
 * Shows what changed to trigger the effect
 * @param scope - Dependency tracking scope
 * @param deps - Object with dependency key-value pairs
 */
export const DBG_DEPS = (scope: string, deps: Record<string, any>): void => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WIZARD:${scope}:DEPS]`;

  const serializedDeps = safeSerialize(deps);
  console.log(prefix, serializedDeps);
};

/**
 * Specialized debug helper for validation results
 * @param scope - Validation scope (e.g., 'VALIDATION:PASO0', 'VALIDATION:FINAL')
 * @param result - Validation result object
 */
export const DBG_VALIDATION = (
  scope: string,
  result: {
    valid: boolean;
    errors?: any[];
    firstInvalidField?: string;
    [key: string]: any;
  }
): void => {
  if (!isDebugEnabled()) return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [WIZARD:${scope}:VALIDATION]`;

  const validationData = {
    valid: result.valid,
    errorCount: result.errors?.length || 0,
    errors: result.errors || [],
    firstInvalidField: result.firstInvalidField,
    ...Object.fromEntries(
      Object.entries(result).filter(([key]) =>
        !['valid', 'errors', 'firstInvalidField'].includes(key)
      )
    )
  };

  console.log(prefix, safeSerialize(validationData));
};

/**
 * Generate a unique correlation ID for tracking wizard runs
 * @returns Correlation ID in format "wiz_${timestamp}_${random}"
 */
export const generateCorrelationId = (): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6);
  return `wiz_${timestamp}_${random}`;
};


