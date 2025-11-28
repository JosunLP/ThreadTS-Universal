/**
 * ThreadTS Universal - Array Operations Tests
 * Tests for the extended array operation methods
 */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import threadts, { ThreadTS } from '../src';

// Mock Worker for test environment
vi.mock('../src/utils/platform', async () => {
  const actual = await vi.importActual('../src/utils/platform');
  return {
    ...actual,
    supportsWorkerThreads: () => true,
    detectPlatform: () => 'node',
    getOptimalWorkerCount: () => 4,
  };
});

describe('Array Operations', () => {
  beforeEach(() => {
    // Reset ThreadTS instance between tests
    Reflect.set(ThreadTS, '_instance', null);
  });

  afterEach(async () => {
    try {
      const instance = Reflect.get(ThreadTS, '_instance') as ThreadTS | null;
      if (instance) {
        await instance.terminate();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    Reflect.set(ThreadTS, '_instance', null);
  });

  describe('indexOf', () => {
    test('should find the first occurrence of an element', async () => {
      const result = await threadts.indexOf([1, 2, 3, 4, 5], 3);
      expect(result).toBe(2);
    });

    test('should return -1 for non-existent elements', async () => {
      const result = await threadts.indexOf([1, 2, 3], 10);
      expect(result).toBe(-1);
    });

    test('should search from the specified index', async () => {
      const result = await threadts.indexOf([1, 2, 3, 2, 1], 2, 2);
      expect(result).toBe(3);
    });

    test('should handle empty arrays', async () => {
      const result = await threadts.indexOf([], 1);
      expect(result).toBe(-1);
    });

    test('should handle negative fromIndex', async () => {
      const result = await threadts.indexOf([1, 2, 3, 4, 5], 3, -3);
      expect(result).toBe(2);
    });
  });

  describe('lastIndexOf', () => {
    test('should find the last occurrence of an element', async () => {
      const result = await threadts.lastIndexOf([1, 2, 3, 2, 1], 2);
      expect(result).toBe(3);
    });

    test('should return -1 for non-existent elements', async () => {
      const result = await threadts.lastIndexOf([1, 2, 3], 10);
      expect(result).toBe(-1);
    });

    test('should search from the specified index', async () => {
      const result = await threadts.lastIndexOf([1, 2, 3, 2, 1], 2, 2);
      expect(result).toBe(1);
    });
  });

  describe('at', () => {
    test('should return element at positive index', async () => {
      const result = await threadts.at([1, 2, 3, 4, 5], 2);
      expect(result).toBe(3);
    });

    test('should return element at negative index', async () => {
      const result = await threadts.at([1, 2, 3, 4, 5], -1);
      expect(result).toBe(5);
    });

    test('should return undefined for out-of-bounds index', async () => {
      const result = await threadts.at([1, 2, 3], 10);
      expect(result).toBeUndefined();
    });

    test('should handle empty arrays', async () => {
      const result = await threadts.at([], 0);
      expect(result).toBeUndefined();
    });
  });

  describe('slice', () => {
    test('should slice array from start to end', async () => {
      const result = await threadts.slice([1, 2, 3, 4, 5], 1, 4);
      expect(result).toEqual([2, 3, 4]);
    });

    test('should slice from start to end of array', async () => {
      const result = await threadts.slice([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([3, 4, 5]);
    });

    test('should return copy of array without arguments', async () => {
      const result = await threadts.slice([1, 2, 3]);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('concat', () => {
    test('should concatenate arrays', async () => {
      const result = await threadts.concat([1, 2], [3, 4], [5, 6]);
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });

    test('should concatenate values', async () => {
      const result = await threadts.concat([1, 2], 3, [4, 5]);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    test('should handle empty arrays', async () => {
      const result = await threadts.concat([], [1, 2]);
      expect(result).toEqual([1, 2]);
    });
  });

  describe('range', () => {
    test('should create a range of numbers', async () => {
      const result = await threadts.range(0, 5);
      expect(result).toEqual([0, 1, 2, 3, 4]);
    });

    test('should create a range with custom step', async () => {
      const result = await threadts.range(0, 10, 2);
      expect(result).toEqual([0, 2, 4, 6, 8]);
    });

    test('should create a descending range', async () => {
      const result = await threadts.range(5, 0, -1);
      expect(result).toEqual([5, 4, 3, 2, 1]);
    });

    test('should return empty array for zero step', async () => {
      const result = await threadts.range(0, 5, 0);
      expect(result).toEqual([]);
    });
  });

  describe('repeat', () => {
    test('should repeat a value', async () => {
      const result = await threadts.repeat('x', 5);
      expect(result).toEqual(['x', 'x', 'x', 'x', 'x']);
    });

    test('should return empty array for count 0', async () => {
      const result = await threadts.repeat('x', 0);
      expect(result).toEqual([]);
    });

    test('should handle negative count', async () => {
      const result = await threadts.repeat('x', -5);
      expect(result).toEqual([]);
    });
  });

  describe('unique', () => {
    test('should remove duplicates', async () => {
      const result = await threadts.unique([1, 2, 2, 3, 3, 3]);
      expect(result).toEqual([1, 2, 3]);
    });

    test('should handle empty arrays', async () => {
      const result = await threadts.unique([]);
      expect(result).toEqual([]);
    });

    test('should preserve order', async () => {
      const result = await threadts.unique([3, 1, 2, 1, 3, 2]);
      expect(result).toEqual([3, 1, 2]);
    });
  });

  describe('uniqueBy', () => {
    test('should remove duplicates by key', async () => {
      const users = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 1, name: 'Charlie' },
      ];
      const result = await threadts.uniqueBy(users, (u) => u.id);
      expect(result).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });
  });

  describe('chunk', () => {
    test('should split array into chunks', async () => {
      const result = await threadts.chunk([1, 2, 3, 4, 5], 2);
      expect(result).toEqual([[1, 2], [3, 4], [5]]);
    });

    test('should return empty array for zero size', async () => {
      const result = await threadts.chunk([1, 2, 3], 0);
      expect(result).toEqual([]);
    });

    test('should handle size larger than array', async () => {
      const result = await threadts.chunk([1, 2, 3], 10);
      expect(result).toEqual([[1, 2, 3]]);
    });
  });

  describe('zip', () => {
    test('should zip two arrays', async () => {
      const result = await threadts.zip([1, 2, 3], ['a', 'b', 'c']);
      expect(result).toEqual([
        [1, 'a'],
        [2, 'b'],
        [3, 'c'],
      ]);
    });

    test('should handle arrays of different lengths', async () => {
      const result = await threadts.zip([1, 2, 3], ['a', 'b']);
      expect(result).toEqual([
        [1, 'a'],
        [2, 'b'],
      ]);
    });

    test('should handle empty arrays', async () => {
      const result = await threadts.zip([], []);
      expect(result).toEqual([]);
    });
  });

  describe('getArrayOps', () => {
    test('should return the array operations module', () => {
      const ops = threadts.getArrayOps();
      expect(ops).toBeDefined();
      expect(typeof ops.indexOf).toBe('function');
      expect(typeof ops.lastIndexOf).toBe('function');
      expect(typeof ops.chunk).toBe('function');
    });
  });

  // ES2023+ Array Methods
  describe('findLast', () => {
    test('should find the last element matching predicate', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.findLast(
        [1, 2, 3, 4, 5],
        (x: number) => x < 4
      );
      expect(result).toBe(3);
    });

    test('should return undefined if no element matches', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.findLast([1, 2, 3], (x: number) => x > 10);
      expect(result).toBeUndefined();
    });

    test('should handle empty arrays', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.findLast([], () => true);
      expect(result).toBeUndefined();
    });
  });

  describe('findLastIndex', () => {
    test('should find the last index matching predicate', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.findLastIndex(
        [1, 2, 3, 2, 1],
        (x: number) => x === 2
      );
      expect(result).toBe(3);
    });

    test('should return -1 if no element matches', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.findLastIndex(
        [1, 2, 3],
        (x: number) => x > 10
      );
      expect(result).toBe(-1);
    });
  });

  describe('toSorted', () => {
    test('should return a new sorted array', async () => {
      const instance = ThreadTS.getInstance();
      const original = [3, 1, 4, 1, 5];
      const result = await instance.toSorted(original);
      expect(result).toEqual([1, 1, 3, 4, 5]);
      expect(original).toEqual([3, 1, 4, 1, 5]); // Original unchanged
    });

    test('should accept a custom comparator', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.toSorted(
        [3, 1, 4],
        (a: number, b: number) => b - a
      );
      expect(result).toEqual([4, 3, 1]);
    });
  });

  describe('toReversed', () => {
    test('should return a new reversed array', async () => {
      const instance = ThreadTS.getInstance();
      const original = [1, 2, 3];
      const result = await instance.toReversed(original);
      expect(result).toEqual([3, 2, 1]);
      expect(original).toEqual([1, 2, 3]); // Original unchanged
    });
  });

  describe('withElement', () => {
    test('should return a new array with element replaced', async () => {
      const instance = ThreadTS.getInstance();
      const original = [1, 2, 3];
      const result = await instance.withElement(original, 1, 10);
      expect(result).toEqual([1, 10, 3]);
      expect(original).toEqual([1, 2, 3]); // Original unchanged
    });

    test('should support negative indices', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.withElement([1, 2, 3], -1, 10);
      expect(result).toEqual([1, 2, 10]);
    });

    test('should throw on out-of-bounds index', async () => {
      const instance = ThreadTS.getInstance();
      await expect(instance.withElement([1, 2, 3], 10, 10)).rejects.toThrow(
        RangeError
      );
    });
  });

  describe('toSpliced', () => {
    test('should return a new spliced array', async () => {
      const instance = ThreadTS.getInstance();
      const original = [1, 2, 3, 4];
      const result = await instance.toSpliced(original, 1, 2, 10, 20);
      expect(result).toEqual([1, 10, 20, 4]);
      expect(original).toEqual([1, 2, 3, 4]); // Original unchanged
    });

    test('should handle delete without insert', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.toSpliced([1, 2, 3, 4], 1, 2);
      expect(result).toEqual([1, 4]);
    });

    test('should handle insert without delete', async () => {
      const instance = ThreadTS.getInstance();
      const result = await instance.toSpliced([1, 2, 3], 1, 0, 99);
      expect(result).toEqual([1, 99, 2, 3]);
    });
  });

  describe('groupByObject', () => {
    test('should group elements by key function', async () => {
      const instance = ThreadTS.getInstance();
      const items = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ];
      const result = await instance.groupByObject(
        items,
        (item: { type: string }) => item.type
      );
      expect(result).toEqual({
        a: [
          { type: 'a', value: 1 },
          { type: 'a', value: 3 },
        ],
        b: [{ type: 'b', value: 2 }],
      });
    });
  });
});

describe('Pipeline Extended Operations', () => {
  beforeEach(() => {
    Reflect.set(ThreadTS, '_instance', null);
  });

  afterEach(async () => {
    try {
      const instance = Reflect.get(ThreadTS, '_instance') as ThreadTS | null;
      if (instance) {
        await instance.terminate();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    Reflect.set(ThreadTS, '_instance', null);
  });

  describe('slicePipe', () => {
    test('should slice elements in pipeline', async () => {
      const result = await threadts
        .pipe([1, 2, 3, 4, 5])
        .slicePipe(1, 4)
        .execute();
      expect(result).toEqual([2, 3, 4]);
    });
  });

  describe('concatPipe', () => {
    test('should concatenate arrays in pipeline', async () => {
      const result = await threadts
        .pipe([1, 2, 3])
        .concatPipe([4, 5, 6])
        .execute();
      expect(result).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe('rotate', () => {
    test('should rotate array right', async () => {
      const result = await threadts.pipe([1, 2, 3, 4, 5]).rotate(2).execute();
      expect(result).toEqual([4, 5, 1, 2, 3]);
    });

    test('should rotate array left', async () => {
      const result = await threadts.pipe([1, 2, 3, 4, 5]).rotate(-2).execute();
      expect(result).toEqual([3, 4, 5, 1, 2]);
    });
  });

  describe('truthy', () => {
    test('should filter truthy values', async () => {
      const result = await threadts
        .pipe([1, 0, 2, '', 3, null, 4, undefined, false])
        .truthy()
        .execute();
      expect(result).toEqual([1, 2, 3, 4]);
    });
  });

  describe('falsy', () => {
    test('should filter falsy values', async () => {
      const result = await threadts
        .pipe([1, 0, 2, '', 3, null, 4])
        .falsy()
        .execute();
      expect(result).toEqual([0, '', null]);
    });
  });
});
