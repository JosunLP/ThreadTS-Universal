/**
 * ThreadTS Universal - Array Helper Utilities
 *
 * Shared array operations reused in multiple places in the library.
 * Follows the DRY principle (Don't Repeat Yourself).
 *
 * @module utils/array-helpers
 * @author ThreadTS Universal Team
 */

/**
 * Fisher-Yates (Knuth) shuffle algorithm.
 *
 * Shuffles an array in-place with a uniform random distribution.
 * Time complexity: O(n), space complexity: O(1)
 *
 * @template T - Array element type
 * @param array - Array to shuffle (mutated)
 * @returns The same array, shuffled
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * fisherYatesShuffle(arr);
 * console.log(arr); // e.g. [3, 1, 5, 2, 4]
 * ```
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Creates a shuffled copy of an array.
 *
 * Unlike {@link fisherYatesShuffle}, this function does not mutate the
 * original array.
 *
 * @template T - Array element type
 * @param array - Array to shuffle (not mutated)
 * @returns A new, shuffled array
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const shuffled = shuffleCopy(arr);
 * console.log(arr);      // [1, 2, 3, 4, 5] - unchanged
 * console.log(shuffled); // e.g. [3, 1, 5, 2, 4]
 * ```
 */
export function shuffleCopy<T>(array: T[]): T[] {
  return fisherYatesShuffle([...array]);
}

/**
 * Takes a random sample of n elements from an array.
 *
 * Uses Fisher-Yates shuffle for efficient random selection.
 * Returns at most array.length elements.
 *
 * @template T - Array element type
 * @param array - Array to sample from
 * @param count - Number of elements to sample
 * @returns Array of randomly selected elements
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const sample = randomSample(arr, 3);
 * console.log(sample); // e.g. [7, 2, 9]
 * ```
 */
export function randomSample<T>(array: T[], count: number): T[] {
  const sampleSize = Math.min(Math.max(0, count), array.length);
  if (sampleSize === 0) {
    return [];
  }
  return shuffleCopy(array).slice(0, sampleSize);
}

/**
 * Splits an array into chunks (sub-arrays) of a given size.
 *
 * @template T - Array element type
 * @param array - Array to split
 * @param size - Size of each chunk (must be > 0)
 * @returns Array of chunks
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const chunks = chunkArray(arr, 2);
 * console.log(chunks); // [[1, 2], [3, 4], [5]]
 * ```
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    return [];
  }
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Creates sliding windows over an array.
 *
 * @template T - Array element type
 * @param array - Array to create windows over
 * @param size - Window size
 * @param step - Step between windows (default: 1)
 * @returns Array of windows
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * const windows = slidingWindow(arr, 3);
 * console.log(windows); // [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
 *
 * const steppedWindows = slidingWindow(arr, 2, 2);
 * console.log(steppedWindows); // [[1, 2], [3, 4]]
 * ```
 */
export function slidingWindow<T>(array: T[], size: number, step = 1): T[][] {
  if (size <= 0 || step <= 0 || array.length < size) {
    return size <= 0 || step <= 0 ? [] : [];
  }
  const result: T[][] = [];
  for (let i = 0; i <= array.length - size; i += step) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Interleaves two arrays.
 *
 * @template T - Array element type
 * @param array1 - First array
 * @param array2 - Second array
 * @returns Interleaved array
 *
 * @example
 * ```typescript
 * const a = [1, 3, 5];
 * const b = [2, 4, 6];
 * console.log(interleaveArrays(a, b)); // [1, 2, 3, 4, 5, 6]
 * ```
 */
export function interleaveArrays<T>(array1: T[], array2: T[]): T[] {
  const result: T[] = [];
  const maxLen = Math.max(array1.length, array2.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < array1.length) result.push(array1[i]);
    if (i < array2.length) result.push(array2[i]);
  }
  return result;
}

/**
 * Rotates an array by n positions.
 *
 * Positive n rotates right (end -> start),
 * negative n rotates left (start -> end).
 *
 * @template T - Array element type
 * @param array - Array to rotate
 * @param positions - Positions to rotate (positive = right, negative = left)
 * @returns New rotated array
 *
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * console.log(rotateArray(arr, 2));  // [4, 5, 1, 2, 3]
 * console.log(rotateArray(arr, -2)); // [3, 4, 5, 1, 2]
 * ```
 */
export function rotateArray<T>(array: T[], positions: number): T[] {
  if (array.length === 0 || positions === 0) {
    return [...array];
  }
  const n = ((positions % array.length) + array.length) % array.length;
  return [...array.slice(-n), ...array.slice(0, -n)];
}

/**
 * Finds unique elements based on a key function.
 *
 * @template T - Array element type
 * @template K - Key type
 * @param array - Array to scan
 * @param keyFn - Function that extracts the comparison key
 * @returns Array of unique elements (keeps the first occurrence)
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, name: 'Alice' },
 *   { id: 2, name: 'Bob' },
 *   { id: 1, name: 'Alice Clone' }
 * ];
 * const unique = uniqueBy(users, u => u.id);
 * // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
 * ```
 */
export function uniqueBy<T, K>(array: T[], keyFn: (item: T) => K): T[] {
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
 * Finds unique elements using JSON stringification as the key.
 *
 * @template T - Array element type
 * @param array - Array to scan
 * @param keyFn - Optional function to extract the value to stringify
 * @returns Array of unique elements
 */
export function uniqueByJson<T>(array: T[], keyFn?: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of array) {
    const key = JSON.stringify(keyFn ? keyFn(item) : item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}
