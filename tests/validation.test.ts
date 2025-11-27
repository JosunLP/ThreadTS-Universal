/**
 * ThreadTS Universal - Validation Utilities Tests
 * Tests for the validation utility functions
 */

import {
  validateFunction,
  validateArray,
  validateNonEmptyArray,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateRange,
  validateEnum,
  validateSerializable,
  validateThreadOptions,
  validateTask,
  validateTasks,
  toPositiveInt,
  toNonNegativeInt,
  ValidationUtils,
} from '../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateFunction', () => {
    test('should accept valid functions', () => {
      expect(() => validateFunction(() => {})).not.toThrow();
      expect(() => validateFunction(function test() {})).not.toThrow();
      expect(() => validateFunction(async () => {})).not.toThrow();
    });

    test('should reject invalid values', () => {
      expect(() => validateFunction(null)).toThrow();
      expect(() => validateFunction(undefined)).toThrow();
      expect(() => validateFunction(42)).toThrow();
      expect(() => validateFunction('string')).toThrow();
      expect(() => validateFunction({})).toThrow();
    });

    test('should use custom parameter name', () => {
      expect(() => validateFunction(null, 'callback')).toThrow(/callback/);
    });
  });

  describe('validateArray', () => {
    test('should accept valid arrays', () => {
      expect(() => validateArray([])).not.toThrow();
      expect(() => validateArray([1, 2, 3])).not.toThrow();
      expect(() => validateArray(['a', 'b'])).not.toThrow();
    });

    test('should reject invalid values', () => {
      expect(() => validateArray(null)).toThrow();
      expect(() => validateArray(undefined)).toThrow();
      expect(() => validateArray(42)).toThrow();
      expect(() => validateArray('string')).toThrow();
      expect(() => validateArray({})).toThrow();
    });
  });

  describe('validateNonEmptyArray', () => {
    test('should accept non-empty arrays', () => {
      expect(() => validateNonEmptyArray([1])).not.toThrow();
      expect(() => validateNonEmptyArray([1, 2, 3])).not.toThrow();
    });

    test('should reject empty arrays', () => {
      expect(() => validateNonEmptyArray([])).toThrow();
    });
  });

  describe('validatePositiveNumber', () => {
    test('should accept positive numbers', () => {
      expect(() => validatePositiveNumber(1)).not.toThrow();
      expect(() => validatePositiveNumber(0.5)).not.toThrow();
      expect(() => validatePositiveNumber(100)).not.toThrow();
    });

    test('should reject zero, negative values and non-numbers', () => {
      expect(() => validatePositiveNumber(0)).toThrow();
      expect(() => validatePositiveNumber(-1)).toThrow();
      expect(() => validatePositiveNumber(NaN)).toThrow();
      expect(() => validatePositiveNumber('5')).toThrow();
    });
  });

  describe('validateNonNegativeNumber', () => {
    test('should accept non-negative numbers', () => {
      expect(() => validateNonNegativeNumber(0)).not.toThrow();
      expect(() => validateNonNegativeNumber(1)).not.toThrow();
      expect(() => validateNonNegativeNumber(100)).not.toThrow();
    });

    test('should reject negative numbers', () => {
      expect(() => validateNonNegativeNumber(-1)).toThrow();
      expect(() => validateNonNegativeNumber(-0.1)).toThrow();
    });
  });

  describe('validateRange', () => {
    test('should accept values within range', () => {
      expect(() => validateRange(5, 1, 10)).not.toThrow();
      expect(() => validateRange(1, 1, 10)).not.toThrow();
      expect(() => validateRange(10, 1, 10)).not.toThrow();
    });

    test('should reject values outside range', () => {
      expect(() => validateRange(0, 1, 10)).toThrow();
      expect(() => validateRange(11, 1, 10)).toThrow();
    });
  });

  describe('validateEnum', () => {
    test('should accept valid enum values', () => {
      const priorities = ['low', 'normal', 'high'] as const;
      expect(() => validateEnum('low', priorities)).not.toThrow();
      expect(() => validateEnum('normal', priorities)).not.toThrow();
      expect(() => validateEnum('high', priorities)).not.toThrow();
    });

    test('should reject invalid enum values', () => {
      const priorities = ['low', 'normal', 'high'] as const;
      expect(() =>
        validateEnum('invalid' as 'low' | 'normal' | 'high', priorities)
      ).toThrow();
    });
  });

  describe('validateSerializable', () => {
    test('should accept serializable data', () => {
      expect(() => validateSerializable(null)).not.toThrow();
      expect(() => validateSerializable(undefined)).not.toThrow();
      expect(() => validateSerializable(42)).not.toThrow();
      expect(() => validateSerializable('string')).not.toThrow();
      expect(() => validateSerializable(true)).not.toThrow();
      expect(() => validateSerializable([1, 2, 3])).not.toThrow();
      expect(() => validateSerializable({ a: 1, b: 2 })).not.toThrow();
      expect(() => validateSerializable({ nested: { value: 42 } })).not.toThrow();
    });

    test('should reject functions', () => {
      expect(() => validateSerializable(() => {})).toThrow(/Functions/);
    });

    test('should reject symbols', () => {
      expect(() => validateSerializable(Symbol('test'))).toThrow(/Symbols/);
    });

    test('should reject BigInt', () => {
      expect(() => validateSerializable(BigInt(42))).toThrow(/BigInt/);
    });

    test('should detect circular references', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;
      expect(() => validateSerializable(circular)).toThrow(/Circular/);
    });

    test('should reject nested functions', () => {
      const withNestedFn = {
        value: 42,
        callback: () => {},
      };
      expect(() => validateSerializable(withNestedFn)).toThrow(/Functions/);
    });
  });

  describe('validateThreadOptions', () => {
    test('should accept valid options', () => {
      expect(() => validateThreadOptions({})).not.toThrow();
      expect(() => validateThreadOptions({ timeout: 5000 })).not.toThrow();
      expect(() => validateThreadOptions({ priority: 'high' })).not.toThrow();
      expect(() => validateThreadOptions({ maxRetries: 3 })).not.toThrow();
      expect(() => validateThreadOptions({ batchSize: 10 })).not.toThrow();
    });

    test('should reject invalid options', () => {
      expect(() => validateThreadOptions({ timeout: -1 })).toThrow();
      expect(() => validateThreadOptions({ timeout: 0 })).toThrow();
      expect(() => validateThreadOptions({ maxRetries: -1 })).toThrow();
      expect(() => validateThreadOptions({ priority: 'invalid' })).toThrow();
      expect(() => validateThreadOptions({ batchSize: 0 })).toThrow();
    });

    test('should reject NaN values', () => {
      expect(() => validateThreadOptions({ timeout: NaN })).toThrow();
      expect(() => validateThreadOptions({ maxRetries: NaN })).toThrow();
      expect(() => validateThreadOptions({ batchSize: NaN })).toThrow();
    });

    test('should accept valid AbortSignal', () => {
      const controller = new AbortController();
      expect(() => validateThreadOptions({ signal: controller.signal })).not.toThrow();
    });

    test('should reject invalid signal values', () => {
      expect(() => validateThreadOptions({ signal: {} })).toThrow(/AbortSignal/);
      expect(() => validateThreadOptions({ signal: 'invalid' })).toThrow(/AbortSignal/);
      expect(() => validateThreadOptions({ signal: null })).toThrow(/AbortSignal/);
      expect(() => validateThreadOptions({ signal: 123 })).toThrow(/AbortSignal/);
    });
  });

  describe('validateTask', () => {
    test('should accept valid tasks', () => {
      expect(() => validateTask({ fn: () => {} })).not.toThrow();
      expect(() => validateTask({ func: () => {} })).not.toThrow();
      expect(() => validateTask({ fn: () => {}, data: 42 })).not.toThrow();
    });

    test('should reject invalid tasks', () => {
      expect(() => validateTask(null)).toThrow();
      expect(() => validateTask({})).toThrow();
      expect(() => validateTask({ fn: 'not a function' })).toThrow();
    });

    test('should include index in error message', () => {
      expect(() => validateTask({}, 5)).toThrow(/index 5/);
    });
  });

  describe('validateTasks', () => {
    test('should accept valid task arrays', () => {
      expect(() =>
        validateTasks([{ fn: () => {} }, { func: () => {} }])
      ).not.toThrow();
    });

    test('should reject invalid tasks', () => {
      expect(() => validateTasks([{ fn: () => {} }, {}])).toThrow(/index 1/);
    });
  });

  describe('toPositiveInt', () => {
    test('should return positive integers', () => {
      expect(toPositiveInt(5, 10)).toBe(5);
      expect(toPositiveInt(5.7, 10)).toBe(5);
    });

    test('should return default value for invalid inputs', () => {
      expect(toPositiveInt(NaN, 10)).toBe(10);
      expect(toPositiveInt('5', 10)).toBe(10);
      expect(toPositiveInt(null, 10)).toBe(10);
    });

    test('should respect minimum value', () => {
      expect(toPositiveInt(0, 10, 1)).toBe(1);
      expect(toPositiveInt(-5, 10, 1)).toBe(1);
    });
  });

  describe('toNonNegativeInt', () => {
    test('should return non-negative integers', () => {
      expect(toNonNegativeInt(5, 10)).toBe(5);
      expect(toNonNegativeInt(0, 10)).toBe(0);
      expect(toNonNegativeInt(5.7, 10)).toBe(5);
    });

    test('should return default value for invalid inputs', () => {
      expect(toNonNegativeInt(NaN, 10)).toBe(10);
      expect(toNonNegativeInt('5', 10)).toBe(10);
    });

    test('should set negative values to 0', () => {
      expect(toNonNegativeInt(-5, 10)).toBe(0);
    });
  });

  describe('ValidationUtils class', () => {
    test('should provide static wrapper for validateFunction', () => {
      expect(() => ValidationUtils.validateFunction(() => {})).not.toThrow();
      expect(() => ValidationUtils.validateFunction(null)).toThrow();
    });

    test('should provide static wrapper for validateArray', () => {
      expect(() => ValidationUtils.validateArray([1, 2])).not.toThrow();
      expect(() => ValidationUtils.validateArray(null)).toThrow();
    });

    test('should provide static wrapper for validateNonEmptyArray', () => {
      expect(() => ValidationUtils.validateNonEmptyArray([1])).not.toThrow();
      expect(() => ValidationUtils.validateNonEmptyArray([])).toThrow();
    });

    test('should provide static wrapper for validatePositiveNumber', () => {
      expect(() => ValidationUtils.validatePositiveNumber(5)).not.toThrow();
      expect(() => ValidationUtils.validatePositiveNumber(-1)).toThrow();
    });

    test('should provide static wrapper for validateNonNegativeNumber', () => {
      expect(() => ValidationUtils.validateNonNegativeNumber(0)).not.toThrow();
      expect(() => ValidationUtils.validateNonNegativeNumber(-1)).toThrow();
    });

    test('should provide static wrapper for validateRange', () => {
      expect(() => ValidationUtils.validateRange(5, 1, 10)).not.toThrow();
      expect(() => ValidationUtils.validateRange(15, 1, 10)).toThrow();
    });

    test('should provide static wrapper for validateEnum', () => {
      expect(() => ValidationUtils.validateEnum('a', ['a', 'b'])).not.toThrow();
      expect(() => ValidationUtils.validateEnum('c', ['a', 'b'])).toThrow();
    });

    test('should provide static wrapper for validateSerializable', () => {
      expect(() => ValidationUtils.validateSerializable({ a: 1 })).not.toThrow();
      expect(() => ValidationUtils.validateSerializable(() => {})).toThrow();
    });

    test('should provide static wrapper for validateThreadOptions', () => {
      expect(() => ValidationUtils.validateThreadOptions({ timeout: 1000 })).not.toThrow();
      expect(() => ValidationUtils.validateThreadOptions({ timeout: -1 })).toThrow();
    });

    test('should provide static wrapper for validateTask', () => {
      expect(() => ValidationUtils.validateTask({ fn: () => {} })).not.toThrow();
      expect(() => ValidationUtils.validateTask({})).toThrow();
    });

    test('should provide static wrapper for validateTasks', () => {
      expect(() => ValidationUtils.validateTasks([{ fn: () => {} }])).not.toThrow();
      expect(() => ValidationUtils.validateTasks([{}])).toThrow();
    });

    test('should provide static wrapper for toPositiveInt', () => {
      expect(ValidationUtils.toPositiveInt(5, 10)).toBe(5);
      expect(ValidationUtils.toPositiveInt(NaN, 10)).toBe(10);
    });

    test('should provide static wrapper for toNonNegativeInt', () => {
      expect(ValidationUtils.toNonNegativeInt(5, 10)).toBe(5);
      expect(ValidationUtils.toNonNegativeInt(NaN, 10)).toBe(10);
    });
  });
});
