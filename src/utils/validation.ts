/**
 * ThreadTS Universal - Validation Utilities
 *
 * Centralized input validation for ThreadTS operations.
 * Provides reusable validation functions to ensure data integrity
 * and consistent error messages across the library.
 *
 * @module utils/validation
 * @author ThreadTS Universal Team
 */

import {
  SerializationError,
  ThreadError,
} from '../types';

/**
 * Validation result containing success status and optional error.
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validates that a value is a function.
 *
 * @param fn - The value to validate
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is not a function
 *
 * @example
 * ```typescript
 * validateFunction(myCallback, 'callback');
 * validateFunction(() => 42, 'processor');
 * ```
 */
export function validateFunction(fn: unknown, paramName = 'fn'): void {
  if (typeof fn !== 'function') {
    const receivedType = fn === null ? 'null' : typeof fn;
    throw new ThreadError(
      `${paramName} must be a function, received ${receivedType}`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that a value is an array.
 *
 * @param arr - The value to validate
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is not an array
 *
 * @example
 * ```typescript
 * validateArray([1, 2, 3], 'items');
 * validateArray(myData, 'data');
 * ```
 */
export function validateArray(arr: unknown, paramName = 'array'): void {
  if (!Array.isArray(arr)) {
    const receivedType = arr === null ? 'null' : typeof arr;
    throw new ThreadError(
      `${paramName} must be an array, received ${receivedType}`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that an array is not empty.
 *
 * @param arr - The array to validate
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the array is empty
 *
 * @example
 * ```typescript
 * validateNonEmptyArray([1, 2, 3], 'items');
 * ```
 */
export function validateNonEmptyArray(arr: unknown[], paramName = 'array'): void {
  if (arr.length === 0) {
    throw new ThreadError(`${paramName} cannot be empty`, 'INVALID_ARGUMENT');
  }
}

/**
 * Validates that a number is positive.
 *
 * @param value - The value to validate
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is not a positive number
 *
 * @example
 * ```typescript
 * validatePositiveNumber(5, 'timeout');
 * validatePositiveNumber(batchSize, 'batchSize');
 * ```
 */
export function validatePositiveNumber(value: unknown, paramName = 'value'): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ThreadError(
      `${paramName} must be a number, received ${typeof value}`,
      'INVALID_ARGUMENT'
    );
  }

  if (value <= 0) {
    throw new ThreadError(
      `${paramName} must be positive, received ${value}`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that a number is non-negative (zero or positive).
 *
 * @param value - The value to validate
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is negative
 *
 * @example
 * ```typescript
 * validateNonNegativeNumber(0, 'delay');
 * validateNonNegativeNumber(retryCount, 'retries');
 * ```
 */
export function validateNonNegativeNumber(
  value: unknown,
  paramName = 'value'
): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ThreadError(
      `${paramName} must be a number, received ${typeof value}`,
      'INVALID_ARGUMENT'
    );
  }

  if (value < 0) {
    throw new ThreadError(
      `${paramName} must be non-negative, received ${value}`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that a value is within a specified range.
 *
 * @param value - The value to validate
 * @param min - Minimum allowed value (inclusive)
 * @param max - Maximum allowed value (inclusive)
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is outside the range
 *
 * @example
 * ```typescript
 * validateRange(priority, 1, 3, 'priority');
 * validateRange(poolSize, 1, 100, 'poolSize');
 * ```
 */
export function validateRange(
  value: number,
  min: number,
  max: number,
  paramName = 'value'
): void {
  if (value < min || value > max) {
    throw new ThreadError(
      `${paramName} must be between ${min} and ${max}, received ${value}`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that a value is one of the allowed options.
 *
 * @param value - The value to validate
 * @param allowedValues - Array of allowed values
 * @param paramName - Name of the parameter for error messages
 * @throws {ThreadError} If the value is not in the allowed list
 *
 * @example
 * ```typescript
 * validateEnum(priority, ['low', 'normal', 'high'], 'priority');
 * validateEnum(strategy, ['round-robin', 'least-busy'], 'strategy');
 * ```
 */
export function validateEnum<T>(
  value: T,
  allowedValues: readonly T[],
  paramName = 'value'
): void {
  if (!allowedValues.includes(value)) {
    const allowed = allowedValues.map(v => `"${String(v)}"`).join(', ');
    throw new ThreadError(
      `${paramName} must be one of [${allowed}], received "${String(value)}"`,
      'INVALID_ARGUMENT'
    );
  }
}

/**
 * Validates that data is serializable (can be passed to a worker).
 *
 * Checks for:
 * - Functions (not serializable as data)
 * - Circular references
 * - Symbols and undefined (limited support)
 *
 * @param value - The value to validate
 * @param seen - WeakSet to track circular references. A new WeakSet is created
 *               for each call by default. For batch validation of many items,
 *               callers can pass a shared WeakSet for better performance.
 * @throws {SerializationError} If the data cannot be serialized
 *
 * @example
 * ```typescript
 * // Single value validation
 * validateSerializable({ name: 'test', count: 42 });
 *
 * // Batch validation with shared WeakSet for performance
 * const seen = new WeakSet<object>();
 * for (const item of items) {
 *   validateSerializable(item, seen);
 * }
 * ```
 */
export function validateSerializable(
  value: unknown,
  seen = new WeakSet<object>()
): void {
  // Primitive types are always serializable
  if (value === null || value === undefined) {
    return;
  }

  const valueType = typeof value;

  // Check for non-serializable primitives
  if (valueType === 'function') {
    throw new SerializationError(
      'Functions cannot be transferred as task data. Pass data separately from the function.'
    );
  }

  if (valueType === 'symbol') {
    throw new SerializationError(
      'Symbols cannot be serialized. Use strings instead.'
    );
  }

  if (valueType === 'bigint') {
    throw new SerializationError(
      'BigInt values cannot be directly serialized. Convert to string first.'
    );
  }

  // Primitives (string, number, boolean) are serializable
  if (valueType !== 'object') {
    return;
  }

  // Check for circular references
  if (seen.has(value as object)) {
    throw new SerializationError(
      'Circular reference detected in task data. Remove circular references before passing data.'
    );
  }

  seen.add(value as object);

  // Handle arrays
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      try {
        validateSerializable(value[i], seen);
      } catch (error) {
        if (error instanceof SerializationError) {
          throw new SerializationError(
            `At array index ${i}: ${error.message}`
          );
        }
        throw error;
      }
    }
    return;
  }

  // Handle special objects that are serializable
  if (
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set
  ) {
    return; // These are handled by structured clone
  }

  // Handle plain objects
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    try {
      validateSerializable(val, seen);
    } catch (error) {
      if (error instanceof SerializationError) {
        throw new SerializationError(
          `At property "${key}": ${error.message}`
        );
      }
      throw error;
    }
  }
}

/**
 * Validates thread execution options.
 *
 * @param options - The options object to validate
 * @throws {ThreadError} If any option is invalid
 *
 * @example
 * ```typescript
 * validateThreadOptions({ timeout: 5000, priority: 'high' });
 * validateThreadOptions({ maxRetries: 3 });
 * ```
 */
export function validateThreadOptions(options: Record<string, unknown>): void {
  if (options.timeout !== undefined) {
    if (typeof options.timeout !== 'number' || options.timeout <= 0) {
      throw new ThreadError(
        `timeout must be a positive number, received ${options.timeout}`,
        'INVALID_OPTION'
      );
    }
  }

  if (options.maxRetries !== undefined) {
    if (typeof options.maxRetries !== 'number' || options.maxRetries < 0) {
      throw new ThreadError(
        `maxRetries must be a non-negative number, received ${options.maxRetries}`,
        'INVALID_OPTION'
      );
    }
  }

  if (options.priority !== undefined) {
    validateEnum(options.priority, ['low', 'normal', 'high'] as const, 'priority');
  }

  if (options.batchSize !== undefined) {
    if (typeof options.batchSize !== 'number' || options.batchSize < 1) {
      throw new ThreadError(
        `batchSize must be at least 1, received ${options.batchSize}`,
        'INVALID_OPTION'
      );
    }
  }

  if (options.signal !== undefined && !(options.signal instanceof AbortSignal)) {
    throw new ThreadError(
      'signal must be an AbortSignal instance',
      'INVALID_OPTION'
    );
  }
}

/**
 * Validates a task definition for batch/parallel execution.
 *
 * Accepts any value but validates that it:
 * 1. Is a non-null object
 * 2. Has either 'fn' or 'func' property that is a function
 *
 * @param task - The task to validate (accepts unknown for flexibility)
 * @param index - Optional index for error messages in batch operations
 * @throws {ThreadError} If the task is invalid
 *
 * @example
 * ```typescript
 * validateTask({ fn: (x) => x * 2, data: 5 });
 * validateTask({ fn: myFunction }, 0);
 * ```
 */
export function validateTask(
  task: unknown,
  index?: number
): asserts task is { fn?: (...args: unknown[]) => unknown; func?: (...args: unknown[]) => unknown } {
  const prefix = index !== undefined ? `Task at index ${index}: ` : '';

  // First check: must be a non-null object
  if (typeof task !== 'object' || task === null) {
    throw new ThreadError(
      `${prefix}Task must be an object with fn property`,
      'INVALID_TASK'
    );
  }

  // Safe to cast after null/object check
  const taskObj = task as Record<string, unknown>;

  // Support both 'fn' and 'func' property names
  const fn = taskObj.fn ?? taskObj.func;

  if (typeof fn !== 'function') {
    throw new ThreadError(
      `${prefix}Task must have a function property (fn or func)`,
      'INVALID_TASK'
    );
  }
}

/**
 * Validates multiple tasks for batch/parallel execution.
 *
 * @param tasks - Array of tasks to validate
 * @throws {ThreadError} If any task is invalid
 *
 * @example
 * ```typescript
 * validateTasks([
 *   { fn: (x) => x * 2, data: 5 },
 *   { fn: (x) => x + 1, data: 10 }
 * ]);
 * ```
 */
export function validateTasks(tasks: unknown[]): void {
  validateArray(tasks, 'tasks');

  for (let i = 0; i < tasks.length; i++) {
    validateTask(tasks[i], i);
  }
}

/**
 * Safely coerces a value to a positive integer.
 *
 * @param value - The value to coerce
 * @param defaultValue - Default value if coercion fails
 * @param minValue - Minimum allowed value (default: 1)
 * @returns The coerced positive integer
 *
 * @example
 * ```typescript
 * const batchSize = toPositiveInt(options.batchSize, 10);
 * const poolSize = toPositiveInt(config.poolSize, 4, 1);
 * ```
 */
export function toPositiveInt(
  value: unknown,
  defaultValue: number,
  minValue = 1
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return defaultValue;
  }

  const intValue = Math.floor(value);
  return Math.max(minValue, intValue);
}

/**
 * Safely coerces a value to a non-negative integer.
 *
 * @param value - The value to coerce
 * @param defaultValue - Default value if coercion fails
 * @returns The coerced non-negative integer
 *
 * @example
 * ```typescript
 * const retries = toNonNegativeInt(options.maxRetries, 2);
 * const delay = toNonNegativeInt(config.delay, 0);
 * ```
 */
export function toNonNegativeInt(value: unknown, defaultValue: number): number {
  if (typeof value !== 'number' || isNaN(value)) {
    return defaultValue;
  }

  const intValue = Math.floor(value);
  return Math.max(0, intValue);
}

/**
 * Validation utilities class for easier access.
 * Groups all validation functions as static methods.
 *
 * @example
 * ```typescript
 * ValidationUtils.validateFunction(callback, 'callback');
 * ValidationUtils.validateSerializable(data);
 * ```
 */
export class ValidationUtils {
  static validateFunction = validateFunction;
  static validateArray = validateArray;
  static validateNonEmptyArray = validateNonEmptyArray;
  static validatePositiveNumber = validatePositiveNumber;
  static validateNonNegativeNumber = validateNonNegativeNumber;
  static validateRange = validateRange;
  static validateEnum = validateEnum;
  static validateSerializable = validateSerializable;
  static validateThreadOptions = validateThreadOptions;
  static validateTask = validateTask;
  static validateTasks = validateTasks;
  static toPositiveInt = toPositiveInt;
  static toNonNegativeInt = toNonNegativeInt;
}
