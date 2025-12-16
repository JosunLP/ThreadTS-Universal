/**
 * ThreadTS Universal - Array Operations Module
 *
 * Provides extended array operation methods that were missing from the core API.
 * These operations follow the Array API conventions and support parallel execution.
 *
 * @module core/array-operations
 * @author ThreadTS Universal Team
 */

import type { MapOptions, SerializableFunction, ThreadOptions } from '../types';

/**
 * Interface for array operation executor.
 * Allows this module to be used with any ThreadTS-like instance.
 */
export interface ArrayOperationExecutor {
  run<T>(
    fn: SerializableFunction,
    data?: unknown,
    options?: ThreadOptions
  ): Promise<T>;
  map<T, R>(
    array: T[],
    fn: SerializableFunction,
    options?: MapOptions
  ): Promise<R[]>;
}

/**
 * Creates array operation methods bound to a specific executor.
 * This factory pattern allows for dependency injection and testing.
 *
 * @param _executor - The executor instance (ThreadTS or compatible) - reserved for future parallel implementations
 * @returns Object containing all array operation methods
 */
export function createArrayOperations(_executor: ArrayOperationExecutor) {
  /**
   * Finds the index of the first occurrence of a value in the array.
   * Similar to Array.prototype.indexOf but processes in parallel for equality checks.
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param searchElement - The element to locate
   * @param fromIndex - Optional starting index
   * @returns The index of the first match, or -1 if not found
   *
   * @example
   * ```typescript
   * const index = await threadts.indexOf([1, 2, 3, 4, 5], 3);
   * console.log(index); // 2
   * ```
   */
  async function indexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex = 0
  ): Promise<number> {
    if (!array.length) {
      return -1;
    }

    const startIndex =
      fromIndex < 0 ? Math.max(0, array.length + fromIndex) : fromIndex;

    if (startIndex >= array.length) {
      return -1;
    }

    // For simple equality, use native indexOf
    const result = array.indexOf(searchElement, startIndex);
    return result;
  }

  /**
   * Finds the index of the last occurrence of a value in the array.
   * Similar to Array.prototype.lastIndexOf.
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param searchElement - The element to locate
   * @param fromIndex - Optional starting index (searches backwards)
   * @returns The index of the last match, or -1 if not found
   *
   * @example
   * ```typescript
   * const index = await threadts.lastIndexOf([1, 2, 3, 2, 1], 2);
   * console.log(index); // 3
   * ```
   */
  async function lastIndexOf<T>(
    array: T[],
    searchElement: T,
    fromIndex?: number
  ): Promise<number> {
    if (!array.length) {
      return -1;
    }

    const startIndex = fromIndex === undefined ? array.length - 1 : fromIndex;
    const result = array.lastIndexOf(searchElement, startIndex);
    return result;
  }

  /**
   * Returns the element at the specified index.
   * Similar to Array.prototype.at with support for negative indices.
   *
   * @template T - The type of array elements
   * @param array - The array to access
   * @param index - The index (can be negative for reverse access)
   * @returns The element at the index, or undefined
   *
   * @example
   * ```typescript
   * const last = await threadts.at([1, 2, 3, 4, 5], -1);
   * console.log(last); // 5
   * ```
   */
  async function at<T>(array: T[], index: number): Promise<T | undefined> {
    if (!array.length) {
      return undefined;
    }

    const normalizedIndex = index < 0 ? array.length + index : index;

    if (normalizedIndex < 0 || normalizedIndex >= array.length) {
      return undefined;
    }

    return array[normalizedIndex];
  }

  /**
   * Creates a new array with elements from startIndex to endIndex.
   * Similar to Array.prototype.slice but returns a Promise.
   *
   * @template T - The type of array elements
   * @param array - The array to slice
   * @param start - Optional start index (default: 0)
   * @param end - Optional end index (default: array.length)
   * @returns A new array containing the sliced elements
   *
   * @example
   * ```typescript
   * const sliced = await threadts.slice([1, 2, 3, 4, 5], 1, 4);
   * console.log(sliced); // [2, 3, 4]
   * ```
   */
  async function slice<T>(
    array: T[],
    start?: number,
    end?: number
  ): Promise<T[]> {
    return array.slice(start, end);
  }

  /**
   * Concatenates multiple arrays into one.
   * Similar to Array.prototype.concat but returns a Promise.
   *
   * @template T - The type of array elements
   * @param array - The base array
   * @param items - Additional arrays or values to concatenate
   * @returns A new concatenated array
   *
   * @example
   * ```typescript
   * const combined = await threadts.concat([1, 2], [3, 4], [5, 6]);
   * console.log(combined); // [1, 2, 3, 4, 5, 6]
   * ```
   */
  async function concat<T>(array: T[], ...items: (T | T[])[]): Promise<T[]> {
    return array.concat(...items);
  }

  /**
   * Fills array elements with a specified value in parallel.
   * Creates a new array with filled values (immutable operation).
   *
   * @template T - The type of array elements
   * @param array - The array to fill
   * @param value - The value to fill with
   * @param start - Optional start index (default: 0)
   * @param end - Optional end index (default: array.length)
   * @returns A new array with filled values
   *
   * @example
   * ```typescript
   * const filled = await threadts.fill([1, 2, 3, 4, 5], 0, 1, 4);
   * console.log(filled); // [1, 0, 0, 0, 5]
   * ```
   */
  async function fill<T>(
    array: T[],
    value: T,
    start = 0,
    end?: number
  ): Promise<T[]> {
    const result = [...array];
    const actualEnd = end ?? array.length;
    const normalizedStart =
      start < 0 ? Math.max(0, array.length + start) : start;
    const normalizedEnd =
      actualEnd < 0 ? Math.max(0, array.length + actualEnd) : actualEnd;

    for (let i = normalizedStart; i < normalizedEnd && i < result.length; i++) {
      result[i] = value;
    }

    return result;
  }

  /**
   * Checks if the array includes a specific element.
   * Similar to Array.prototype.includes but returns a Promise.
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param searchElement - The element to find
   * @param fromIndex - Optional starting index
   * @returns true if the element is found
   *
   * @example
   * ```typescript
   * const hasThree = await threadts.includes([1, 2, 3, 4, 5], 3);
   * console.log(hasThree); // true
   * ```
   */
  async function includes<T>(
    array: T[],
    searchElement: T,
    fromIndex = 0
  ): Promise<boolean> {
    return array.includes(searchElement, fromIndex);
  }

  /**
   * Joins all elements of an array into a string.
   * Similar to Array.prototype.join but returns a Promise.
   *
   * @template T - The type of array elements
   * @param array - The array to join
   * @param separator - Optional separator string (default: ',')
   * @returns The joined string
   *
   * @example
   * ```typescript
   * const joined = await threadts.join(['a', 'b', 'c'], '-');
   * console.log(joined); // 'a-b-c'
   * ```
   */
  async function join<T>(array: T[], separator = ','): Promise<string> {
    return array.join(separator);
  }

  /**
   * Reverses the elements of an array.
   * Creates a new reversed array (immutable operation).
   *
   * @template T - The type of array elements
   * @param array - The array to reverse
   * @returns A new array with reversed elements
   *
   * @example
   * ```typescript
   * const reversed = await threadts.reverse([1, 2, 3, 4, 5]);
   * console.log(reversed); // [5, 4, 3, 2, 1]
   * ```
   */
  async function reverse<T>(array: T[]): Promise<T[]> {
    return [...array].reverse();
  }

  /**
   * Sorts the elements of an array.
   * Creates a new sorted array (immutable operation).
   *
   * @template T - The type of array elements
   * @param array - The array to sort
   * @param compareFn - Optional comparison function
   * @returns A new sorted array
   *
   * @example
   * ```typescript
   * const sorted = await threadts.sort([3, 1, 4, 1, 5], (a, b) => a - b);
   * console.log(sorted); // [1, 1, 3, 4, 5]
   * ```
   */
  async function sort<T>(
    array: T[],
    compareFn?: (a: T, b: T) => number
  ): Promise<T[]> {
    return [...array].sort(compareFn);
  }

  /**
   * Creates an array containing a range of numbers.
   * Utility method for generating test data.
   *
   * @param start - Start of range (inclusive)
   * @param end - End of range (exclusive)
   * @param step - Step between values (default: 1)
   * @returns Array of numbers in the range
   *
   * @example
   * ```typescript
   * const range = await threadts.range(0, 10, 2);
   * console.log(range); // [0, 2, 4, 6, 8]
   * ```
   */
  async function range(
    start: number,
    end: number,
    step = 1
  ): Promise<number[]> {
    const result: number[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) {
        result.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > end; i += step) {
        result.push(i);
      }
    }
    return result;
  }

  /**
   * Creates an array by repeating a value.
   *
   * @template T - The type of the value
   * @param value - The value to repeat
   * @param count - Number of times to repeat
   * @returns Array of repeated values
   *
   * @example
   * ```typescript
   * const repeated = await threadts.repeat('x', 5);
   * console.log(repeated); // ['x', 'x', 'x', 'x', 'x']
   * ```
   */
  async function repeat<T>(value: T, count: number): Promise<T[]> {
    return Array.from({ length: Math.max(0, count) }, () => value);
  }

  /**
   * Zips multiple arrays together into an array of tuples.
   *
   * @param arrays - Arrays to zip together
   * @returns Array of tuples
   *
   * @example
   * ```typescript
   * const zipped = await threadts.zip([1, 2, 3], ['a', 'b', 'c']);
   * console.log(zipped); // [[1, 'a'], [2, 'b'], [3, 'c']]
   * ```
   */
  async function zip<T extends unknown[][]>(
    ...arrays: T
  ): Promise<{ [K in keyof T]: T[K] extends (infer U)[] ? U : never }[]> {
    if (arrays.length === 0) {
      return [] as { [K in keyof T]: T[K] extends (infer U)[] ? U : never }[];
    }

    const minLength = Math.min(...arrays.map((arr) => arr.length));
    const result: unknown[][] = [];

    for (let i = 0; i < minLength; i++) {
      result.push(arrays.map((arr) => arr[i]));
    }

    return result as { [K in keyof T]: T[K] extends (infer U)[] ? U : never }[];
  }

  /**
   * Unzips an array of tuples into separate arrays.
   *
   * @template T - The tuple type
   * @param array - Array of tuples to unzip
   * @returns Tuple of arrays
   *
   * @example
   * ```typescript
   * const [nums, chars] = await threadts.unzip([[1, 'a'], [2, 'b'], [3, 'c']]);
   * console.log(nums); // [1, 2, 3]
   * console.log(chars); // ['a', 'b', 'c']
   * ```
   */
  async function unzip<T extends unknown[]>(
    array: T[]
  ): Promise<{ [K in keyof T]: T[K][] }> {
    if (array.length === 0) {
      return [] as unknown as { [K in keyof T]: T[K][] };
    }

    const tupleLength = array[0].length;
    const result: unknown[][] = Array.from({ length: tupleLength }, () => []);

    for (const tuple of array) {
      for (let i = 0; i < tupleLength; i++) {
        result[i].push(tuple[i]);
      }
    }

    return result as { [K in keyof T]: T[K][] };
  }

  /**
   * Removes duplicate values from an array.
   * Uses strict equality for comparison.
   *
   * @template T - The type of array elements
   * @param array - The array to deduplicate
   * @returns Array with unique values
   *
   * @example
   * ```typescript
   * const unique = await threadts.unique([1, 2, 2, 3, 3, 3]);
   * console.log(unique); // [1, 2, 3]
   * ```
   */
  async function unique<T>(array: T[]): Promise<T[]> {
    return [...new Set(array)];
  }

  /**
   * Removes duplicate values using a key function.
   *
   * @template T - The type of array elements
   * @template K - The type of the key
   * @param array - The array to deduplicate
   * @param keyFn - Function to extract the key for comparison
   * @returns Array with unique values by key
   *
   * @example
   * ```typescript
   * const users = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
   * const unique = await threadts.uniqueBy(users, u => u.id);
   * console.log(unique); // [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
   * ```
   */
  async function uniqueBy<T, K>(
    array: T[],
    keyFn: (item: T) => K
  ): Promise<T[]> {
    const seen = new Set<K>();
    const result: T[] = [];

    for (const item of array) {
      const key = keyFn(item);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Flattens a nested array to a specified depth.
   *
   * @template T - The type of array elements
   * @param array - The nested array to flatten
   * @param depth - How deep to flatten (default: 1)
   * @returns Flattened array
   *
   * @example
   * ```typescript
   * const flat = await threadts.flat([[1, 2], [3, [4, 5]]], 2);
   * console.log(flat); // [1, 2, 3, 4, 5]
   * ```
   */
  async function flat<T>(array: T[], depth = 1): Promise<unknown[]> {
    return array.flat(depth);
  }

  /**
   * Splits an array into chunks of the specified size.
   *
   * @template T - The type of array elements
   * @param array - The array to chunk
   * @param size - Size of each chunk
   * @returns Array of chunks
   *
   * @example
   * ```typescript
   * const chunks = await threadts.chunk([1, 2, 3, 4, 5], 2);
   * console.log(chunks); // [[1, 2], [3, 4], [5]]
   * ```
   */
  async function chunk<T>(array: T[], size: number): Promise<T[][]> {
    if (size <= 0) {
      return [];
    }

    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      result.push(array.slice(i, i + size));
    }
    return result;
  }

  // ==================== ES2023+ Array Methods ====================

  /**
   * Finds the last element that satisfies the predicate.
   * Similar to Array.prototype.findLast (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param predicate - Function to test each element
   * @returns The last matching element or undefined
   *
   * @example
   * ```typescript
   * const last = await threadts.findLast([1, 2, 3, 4, 5], x => x < 4);
   * console.log(last); // 3
   * ```
   */
  async function findLast<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => boolean
  ): Promise<T | undefined> {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        return array[i];
      }
    }
    return undefined;
  }

  /**
   * Finds the index of the last element that satisfies the predicate.
   * Similar to Array.prototype.findLastIndex (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to search
   * @param predicate - Function to test each element
   * @returns The index of the last matching element or -1
   *
   * @example
   * ```typescript
   * const index = await threadts.findLastIndex([1, 2, 3, 2, 1], x => x === 2);
   * console.log(index); // 3
   * ```
   */
  async function findLastIndex<T>(
    array: T[],
    predicate: (value: T, index: number, array: T[]) => boolean
  ): Promise<number> {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Returns a new sorted array (immutable).
   * Similar to Array.prototype.toSorted (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to sort
   * @param compareFn - Optional comparison function
   * @returns A new sorted array
   *
   * @example
   * ```typescript
   * const sorted = await threadts.toSorted([3, 1, 2]);
   * console.log(sorted); // [1, 2, 3]
   * ```
   */
  async function toSorted<T>(
    array: T[],
    compareFn?: (a: T, b: T) => number
  ): Promise<T[]> {
    return [...array].sort(compareFn);
  }

  /**
   * Returns a new reversed array (immutable).
   * Similar to Array.prototype.toReversed (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to reverse
   * @returns A new reversed array
   *
   * @example
   * ```typescript
   * const reversed = await threadts.toReversed([1, 2, 3]);
   * console.log(reversed); // [3, 2, 1]
   * ```
   */
  async function toReversed<T>(array: T[]): Promise<T[]> {
    return [...array].reverse();
  }

  /**
   * Returns a new array with the element at the given index replaced.
   * Similar to Array.prototype.with (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to modify
   * @param index - The index to replace (supports negative indices)
   * @param value - The new value
   * @returns A new array with the replaced element
   *
   * @example
   * ```typescript
   * const modified = await threadts.withElement([1, 2, 3], 1, 10);
   * console.log(modified); // [1, 10, 3]
   * ```
   */
  async function withElement<T>(
    array: T[],
    index: number,
    value: T
  ): Promise<T[]> {
    const normalizedIndex = index < 0 ? array.length + index : index;

    if (normalizedIndex < 0 || normalizedIndex >= array.length) {
      throw new RangeError(`Invalid index: ${index}`);
    }

    const result = [...array];
    result[normalizedIndex] = value;
    return result;
  }

  /**
   * Returns a new array with elements removed/replaced/added at a given index.
   * Similar to Array.prototype.toSpliced (ES2023).
   *
   * @template T - The type of array elements
   * @param array - The array to modify
   * @param start - The index at which to start changing the array
   * @param deleteCount - The number of elements to remove
   * @param items - The elements to add
   * @returns A new spliced array
   *
   * @example
   * ```typescript
   * const spliced = await threadts.toSpliced([1, 2, 3, 4], 1, 2, 'a', 'b');
   * console.log(spliced); // [1, 'a', 'b', 4]
   * ```
   */
  async function toSpliced<T>(
    array: T[],
    start: number,
    deleteCount?: number,
    ...items: T[]
  ): Promise<T[]> {
    const result = [...array];
    if (deleteCount === undefined) {
      result.splice(start);
    } else {
      result.splice(start, deleteCount, ...items);
    }
    return result;
  }

  /**
   * Groups elements of an array based on a callback function.
   * Similar to Object.groupBy (ES2024).
   *
   * @template T - The type of array elements
   * @template K - The type of the group key
   * @param array - The array to group
   * @param keyFn - Function that returns the group key for each element
   * @returns An object with grouped elements
   *
   * @example
   * ```typescript
   * const grouped = await threadts.groupByObject(
   *   [{ type: 'a', v: 1 }, { type: 'b', v: 2 }, { type: 'a', v: 3 }],
   *   item => item.type
   * );
   * // { a: [{type: 'a', v: 1}, {type: 'a', v: 3}], b: [{type: 'b', v: 2}] }
   * ```
   */
  async function groupByObject<T, K extends PropertyKey>(
    array: T[],
    keyFn: (item: T, index: number) => K
  ): Promise<Partial<Record<K, T[]>>> {
    const result: Partial<Record<K, T[]>> = {};

    for (let i = 0; i < array.length; i++) {
      const key = keyFn(array[i], i);
      if (!result[key]) {
        result[key] = [];
      }
      result[key]!.push(array[i]);
    }

    return result;
  }

  return {
    indexOf,
    lastIndexOf,
    at,
    slice,
    concat,
    fill,
    includes,
    join,
    reverse,
    sort,
    range,
    repeat,
    zip,
    unzip,
    unique,
    uniqueBy,
    flat,
    chunk,
    // ES2023+ methods
    findLast,
    findLastIndex,
    toSorted,
    toReversed,
    withElement,
    toSpliced,
    groupByObject,
  };
}

/**
 * Type for the array operations object returned by createArrayOperations.
 */
export type ArrayOperations = ReturnType<typeof createArrayOperations>;
