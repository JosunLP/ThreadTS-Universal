/**
 * ThreadTS Universal - Validation Utilities Tests
 * Tests für die Validierungs-Hilfsfunktionen
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
} from '../src/utils/validation';

describe('Validation Utilities', () => {
  describe('validateFunction', () => {
    test('sollte gültige Funktionen akzeptieren', () => {
      expect(() => validateFunction(() => {})).not.toThrow();
      expect(() => validateFunction(function test() {})).not.toThrow();
      expect(() => validateFunction(async () => {})).not.toThrow();
    });

    test('sollte ungültige Werte ablehnen', () => {
      expect(() => validateFunction(null)).toThrow();
      expect(() => validateFunction(undefined)).toThrow();
      expect(() => validateFunction(42)).toThrow();
      expect(() => validateFunction('string')).toThrow();
      expect(() => validateFunction({})).toThrow();
    });

    test('sollte benutzerdefinierten Parameter-Namen verwenden', () => {
      expect(() => validateFunction(null, 'callback')).toThrow(/callback/);
    });
  });

  describe('validateArray', () => {
    test('sollte gültige Arrays akzeptieren', () => {
      expect(() => validateArray([])).not.toThrow();
      expect(() => validateArray([1, 2, 3])).not.toThrow();
      expect(() => validateArray(['a', 'b'])).not.toThrow();
    });

    test('sollte ungültige Werte ablehnen', () => {
      expect(() => validateArray(null)).toThrow();
      expect(() => validateArray(undefined)).toThrow();
      expect(() => validateArray(42)).toThrow();
      expect(() => validateArray('string')).toThrow();
      expect(() => validateArray({})).toThrow();
    });
  });

  describe('validateNonEmptyArray', () => {
    test('sollte nicht-leere Arrays akzeptieren', () => {
      expect(() => validateNonEmptyArray([1])).not.toThrow();
      expect(() => validateNonEmptyArray([1, 2, 3])).not.toThrow();
    });

    test('sollte leere Arrays ablehnen', () => {
      expect(() => validateNonEmptyArray([])).toThrow();
    });
  });

  describe('validatePositiveNumber', () => {
    test('sollte positive Zahlen akzeptieren', () => {
      expect(() => validatePositiveNumber(1)).not.toThrow();
      expect(() => validatePositiveNumber(0.5)).not.toThrow();
      expect(() => validatePositiveNumber(100)).not.toThrow();
    });

    test('sollte null, negative und Nicht-Zahlen ablehnen', () => {
      expect(() => validatePositiveNumber(0)).toThrow();
      expect(() => validatePositiveNumber(-1)).toThrow();
      expect(() => validatePositiveNumber(NaN)).toThrow();
      expect(() => validatePositiveNumber('5')).toThrow();
    });
  });

  describe('validateNonNegativeNumber', () => {
    test('sollte nicht-negative Zahlen akzeptieren', () => {
      expect(() => validateNonNegativeNumber(0)).not.toThrow();
      expect(() => validateNonNegativeNumber(1)).not.toThrow();
      expect(() => validateNonNegativeNumber(100)).not.toThrow();
    });

    test('sollte negative Zahlen ablehnen', () => {
      expect(() => validateNonNegativeNumber(-1)).toThrow();
      expect(() => validateNonNegativeNumber(-0.1)).toThrow();
    });
  });

  describe('validateRange', () => {
    test('sollte Werte innerhalb des Bereichs akzeptieren', () => {
      expect(() => validateRange(5, 1, 10)).not.toThrow();
      expect(() => validateRange(1, 1, 10)).not.toThrow();
      expect(() => validateRange(10, 1, 10)).not.toThrow();
    });

    test('sollte Werte außerhalb des Bereichs ablehnen', () => {
      expect(() => validateRange(0, 1, 10)).toThrow();
      expect(() => validateRange(11, 1, 10)).toThrow();
    });
  });

  describe('validateEnum', () => {
    test('sollte gültige Enum-Werte akzeptieren', () => {
      const priorities = ['low', 'normal', 'high'] as const;
      expect(() => validateEnum('low', priorities)).not.toThrow();
      expect(() => validateEnum('normal', priorities)).not.toThrow();
      expect(() => validateEnum('high', priorities)).not.toThrow();
    });

    test('sollte ungültige Enum-Werte ablehnen', () => {
      const priorities = ['low', 'normal', 'high'] as const;
      expect(() =>
        validateEnum('invalid' as 'low' | 'normal' | 'high', priorities)
      ).toThrow();
    });
  });

  describe('validateSerializable', () => {
    test('sollte serialisierbare Daten akzeptieren', () => {
      expect(() => validateSerializable(null)).not.toThrow();
      expect(() => validateSerializable(undefined)).not.toThrow();
      expect(() => validateSerializable(42)).not.toThrow();
      expect(() => validateSerializable('string')).not.toThrow();
      expect(() => validateSerializable(true)).not.toThrow();
      expect(() => validateSerializable([1, 2, 3])).not.toThrow();
      expect(() => validateSerializable({ a: 1, b: 2 })).not.toThrow();
      expect(() => validateSerializable({ nested: { value: 42 } })).not.toThrow();
    });

    test('sollte Funktionen ablehnen', () => {
      expect(() => validateSerializable(() => {})).toThrow(/Functions/);
    });

    test('sollte Symbole ablehnen', () => {
      expect(() => validateSerializable(Symbol('test'))).toThrow(/Symbols/);
    });

    test('sollte BigInt ablehnen', () => {
      expect(() => validateSerializable(BigInt(42))).toThrow(/BigInt/);
    });

    test('sollte zirkuläre Referenzen erkennen', () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;
      expect(() => validateSerializable(circular)).toThrow(/Circular/);
    });

    test('sollte verschachtelte Funktionen ablehnen', () => {
      const withNestedFn = {
        value: 42,
        callback: () => {},
      };
      expect(() => validateSerializable(withNestedFn)).toThrow(/Functions/);
    });
  });

  describe('validateThreadOptions', () => {
    test('sollte gültige Optionen akzeptieren', () => {
      expect(() => validateThreadOptions({})).not.toThrow();
      expect(() => validateThreadOptions({ timeout: 5000 })).not.toThrow();
      expect(() => validateThreadOptions({ priority: 'high' })).not.toThrow();
      expect(() => validateThreadOptions({ maxRetries: 3 })).not.toThrow();
      expect(() => validateThreadOptions({ batchSize: 10 })).not.toThrow();
    });

    test('sollte ungültige Optionen ablehnen', () => {
      expect(() => validateThreadOptions({ timeout: -1 })).toThrow();
      expect(() => validateThreadOptions({ timeout: 0 })).toThrow();
      expect(() => validateThreadOptions({ maxRetries: -1 })).toThrow();
      expect(() => validateThreadOptions({ priority: 'invalid' })).toThrow();
      expect(() => validateThreadOptions({ batchSize: 0 })).toThrow();
    });

    test('sollte NaN Werte ablehnen', () => {
      expect(() => validateThreadOptions({ timeout: NaN })).toThrow();
      expect(() => validateThreadOptions({ maxRetries: NaN })).toThrow();
      expect(() => validateThreadOptions({ batchSize: NaN })).toThrow();
    });
  });

  describe('validateTask', () => {
    test('sollte gültige Tasks akzeptieren', () => {
      expect(() => validateTask({ fn: () => {} })).not.toThrow();
      expect(() => validateTask({ func: () => {} })).not.toThrow();
      expect(() => validateTask({ fn: () => {}, data: 42 })).not.toThrow();
    });

    test('sollte ungültige Tasks ablehnen', () => {
      expect(() => validateTask(null)).toThrow();
      expect(() => validateTask({})).toThrow();
      expect(() => validateTask({ fn: 'not a function' })).toThrow();
    });

    test('sollte Index in Fehlermeldung enthalten', () => {
      expect(() => validateTask({}, 5)).toThrow(/index 5/);
    });
  });

  describe('validateTasks', () => {
    test('sollte gültige Task-Arrays akzeptieren', () => {
      expect(() =>
        validateTasks([{ fn: () => {} }, { func: () => {} }])
      ).not.toThrow();
    });

    test('sollte ungültige Tasks ablehnen', () => {
      expect(() => validateTasks([{ fn: () => {} }, {}])).toThrow(/index 1/);
    });
  });

  describe('toPositiveInt', () => {
    test('sollte positive Ganzzahlen zurückgeben', () => {
      expect(toPositiveInt(5, 10)).toBe(5);
      expect(toPositiveInt(5.7, 10)).toBe(5);
    });

    test('sollte Standardwert bei ungültigen Werten zurückgeben', () => {
      expect(toPositiveInt(NaN, 10)).toBe(10);
      expect(toPositiveInt('5', 10)).toBe(10);
      expect(toPositiveInt(null, 10)).toBe(10);
    });

    test('sollte Minimalwert respektieren', () => {
      expect(toPositiveInt(0, 10, 1)).toBe(1);
      expect(toPositiveInt(-5, 10, 1)).toBe(1);
    });
  });

  describe('toNonNegativeInt', () => {
    test('sollte nicht-negative Ganzzahlen zurückgeben', () => {
      expect(toNonNegativeInt(5, 10)).toBe(5);
      expect(toNonNegativeInt(0, 10)).toBe(0);
      expect(toNonNegativeInt(5.7, 10)).toBe(5);
    });

    test('sollte Standardwert bei ungültigen Werten zurückgeben', () => {
      expect(toNonNegativeInt(NaN, 10)).toBe(10);
      expect(toNonNegativeInt('5', 10)).toBe(10);
    });

    test('sollte negative Werte auf 0 setzen', () => {
      expect(toNonNegativeInt(-5, 10)).toBe(0);
    });
  });
});
