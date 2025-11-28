/**
 * ThreadTS Universal - Pipeline Module
 *
 * Provides fluent chaining of parallel operations with lazy evaluation.
 * Operations are only executed when execute() is called.
 *
 * @module core/pipeline
 */

import type { MapOptions, SerializableFunction, ThreadOptions } from '../types';
import {
  executeIntermediateOperation,
  executeTerminalOperation,
  isTerminalOperation,
  type PipelineOperation,
} from './pipeline-operations';
import type { ThreadTS } from './threadts';

// Re-export PipelineOperation for backward compatibility
export type { PipelineOperation };

/**
 * Pipeline class for fluent chaining of parallel operations.
 * Supports lazy evaluation - operations are only executed when execute() is called.
 *
 * @template T - The current type of array elements
 *
 * @example
 * ```typescript
 * const result = await ThreadTS.pipe([1, 2, 3, 4, 5])
 *   .map(x => x * 2)
 *   .filter(x => x > 4)
 *   .reduce((acc, x) => acc + x, 0)
 *   .execute();
 * ```
 */
export class Pipeline<T> {
  protected operations: PipelineOperation[] = [];

  constructor(
    protected array: T[],
    protected threadts: ThreadTS
  ) {}

  /**
   * Adds a map operation to the pipeline.
   */
  map<R>(fn: SerializableFunction, options?: MapOptions): Pipeline<R> {
    this.operations.push({ type: 'map', fn, options });
    return this as unknown as Pipeline<R>;
  }

  /**
   * Adds a filter operation to the pipeline.
   */
  filter(fn: SerializableFunction, options?: MapOptions): Pipeline<T> {
    this.operations.push({ type: 'filter', fn, options });
    return this;
  }

  /**
   * Adds a flatMap operation to the pipeline.
   */
  flatMap<R>(fn: SerializableFunction, options?: MapOptions): Pipeline<R> {
    this.operations.push({ type: 'flatMap', fn, options });
    return this as unknown as Pipeline<R>;
  }

  /**
   * Takes the first n elements from the pipeline.
   * This is a synchronous operation that limits results.
   *
   * @param count - Number of elements to take
   * @returns Pipeline with limited elements
   *
   * @example
   * ```typescript
   * const first3 = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .take(3)
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  take(count: number): Pipeline<T> {
    this.operations.push({
      type: 'take',
      count: Math.max(0, Math.floor(count)),
    });
    return this;
  }

  /**
   * Skips the first n elements from the pipeline.
   * This is a synchronous operation that offsets results.
   *
   * @param count - Number of elements to skip
   * @returns Pipeline with offset elements
   *
   * @example
   * ```typescript
   * const afterFirst2 = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .skip(2)
   *   .execute();
   * // Result: [3, 4, 5]
   * ```
   */
  skip(count: number): Pipeline<T> {
    this.operations.push({
      type: 'skip',
      count: Math.max(0, Math.floor(count)),
    });
    return this;
  }

  /**
   * Splits the array into chunks of the specified size.
   * Returns a pipeline of arrays.
   *
   * @param size - Size of each chunk
   * @returns Pipeline with chunked arrays
   *
   * @example
   * ```typescript
   * const chunks = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .chunk(2)
   *   .execute();
   * // Result: [[1, 2], [3, 4], [5]]
   * ```
   */
  chunk(size: number): Pipeline<T[]> {
    this.operations.push({
      type: 'chunk',
      count: Math.max(1, Math.floor(size)),
    });
    return this as unknown as Pipeline<T[]>;
  }

  /**
   * Executes a side-effect function for each element without modifying the pipeline.
   * Useful for debugging, logging, or triggering side effects.
   *
   * @param fn - Function to execute for each element (return value is ignored)
   * @returns Pipeline unchanged
   *
   * @example
   * ```typescript
   * const result = await ThreadTS.pipe([1, 2, 3])
   *   .tap(x => console.log('Processing:', x))
   *   .map(x => x * 2)
   *   .execute();
   * // Logs: Processing: 1, Processing: 2, Processing: 3
   * // Result: [2, 4, 6]
   * ```
   */
  tap(fn: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'tap', fn });
    return this;
  }

  /**
   * Creates sliding windows of elements.
   * Each window contains `size` consecutive elements.
   *
   * @param size - Size of each window
   * @param step - Number of elements to slide (default: 1)
   * @returns Pipeline with arrays of windowed elements
   *
   * @example
   * ```typescript
   * const windows = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .window(3)
   *   .execute();
   * // Result: [[1, 2, 3], [2, 3, 4], [3, 4, 5]]
   * ```
   */
  window(size: number, step: number = 1): Pipeline<T[]> {
    this.operations.push({
      type: 'window',
      count: Math.max(1, Math.floor(size)),
      step: Math.max(1, Math.floor(step)),
    });
    return this as unknown as Pipeline<T[]>;
  }

  /**
   * Removes duplicate elements from the pipeline.
   * Uses JSON.stringify for comparison by default.
   *
   * @param keyFn - Optional function to extract comparison key
   * @returns Pipeline with unique elements
   *
   * @example
   * ```typescript
   * const unique = await ThreadTS.pipe([1, 2, 2, 3, 3, 3])
   *   .unique()
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  unique(keyFn?: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'unique', fn: keyFn });
    return this;
  }

  /**
   * Removes duplicate elements using strict equality or a key function.
   * Similar to unique but uses Set-based comparison for primitives.
   *
   * @param keyFn - Optional function to extract comparison key
   * @returns Pipeline with distinct elements
   */
  distinct(keyFn?: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'distinct', fn: keyFn });
    return this;
  }

  /**
   * Reverses the order of elements in the pipeline.
   *
   * @returns Pipeline with reversed elements
   *
   * @example
   * ```typescript
   * const reversed = await ThreadTS.pipe([1, 2, 3])
   *   .reverse()
   *   .execute();
   * // Result: [3, 2, 1]
   * ```
   */
  reverse(): Pipeline<T> {
    this.operations.push({ type: 'reverse' });
    return this;
  }

  /**
   * Sorts elements in the pipeline.
   *
   * @param compareFn - Optional comparison function
   * @returns Pipeline with sorted elements
   *
   * @example
   * ```typescript
   * const sorted = await ThreadTS.pipe([3, 1, 2])
   *   .sort((a, b) => a - b)
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  sort(compareFn?: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'sort', fn: compareFn });
    return this;
  }

  /**
   * Zips this pipeline with another array, creating pairs.
   *
   * @param other - Array to zip with
   * @returns Pipeline of tuples [thisElement, otherElement]
   *
   * @example
   * ```typescript
   * const zipped = await ThreadTS.pipe([1, 2, 3])
   *   .zip(['a', 'b', 'c'])
   *   .execute();
   * // Result: [[1, 'a'], [2, 'b'], [3, 'c']]
   * ```
   */
  zip<U>(other: U[]): Pipeline<[T, U]> {
    this.operations.push({ type: 'zip', initialValue: other });
    return this as unknown as Pipeline<[T, U]>;
  }

  /**
   * Zips this pipeline with another array using a combiner function.
   *
   * @param other - Array to zip with
   * @param fn - Function to combine elements: (thisEl, otherEl, index) => result
   * @returns Pipeline of combined results
   *
   * @example
   * ```typescript
   * const zipped = await ThreadTS.pipe([1, 2, 3])
   *   .zipWith([10, 20, 30], (a, b) => a + b)
   *   .execute();
   * // Result: [11, 22, 33]
   * ```
   */
  zipWith<U, R>(other: U[], fn: SerializableFunction): Pipeline<R> {
    this.operations.push({ type: 'zipWith', initialValue: other, fn });
    return this as unknown as Pipeline<R>;
  }

  /**
   * Interleaves this pipeline's elements with another array.
   *
   * @param other - Array to interleave with
   * @returns Pipeline with interleaved elements
   *
   * @example
   * ```typescript
   * const interleaved = await ThreadTS.pipe([1, 3, 5])
   *   .interleave([2, 4, 6])
   *   .execute();
   * // Result: [1, 2, 3, 4, 5, 6]
   * ```
   */
  interleave(other: T[]): Pipeline<T> {
    this.operations.push({ type: 'interleave', initialValue: other });
    return this;
  }

  /**
   * Removes null and undefined values from the pipeline.
   *
   * @param predicate - Optional custom filter function
   * @returns Pipeline without null/undefined values
   *
   * @example
   * ```typescript
   * const compacted = await ThreadTS.pipe([1, null, 2, undefined, 3])
   *   .compact()
   *   .execute();
   * // Result: [1, 2, 3]
   * ```
   */
  compact(predicate?: SerializableFunction): Pipeline<NonNullable<T>> {
    this.operations.push({ type: 'compact', fn: predicate });
    return this as unknown as Pipeline<NonNullable<T>>;
  }

  /**
   * Flattens nested arrays to the specified depth.
   *
   * @param depth - Depth to flatten (default: 1)
   * @returns Pipeline with flattened arrays
   *
   * @example
   * ```typescript
   * const flat = await ThreadTS.pipe([[1, 2], [3, [4, 5]]])
   *   .flatten(2)
   *   .execute();
   * // Result: [1, 2, 3, 4, 5]
   * ```
   */
  flatten(depth: number = 1): Pipeline<unknown> {
    this.operations.push({ type: 'flatten', count: depth });
    return this as unknown as Pipeline<unknown>;
  }

  /**
   * Randomly shuffles elements in the pipeline.
   *
   * @returns Pipeline with shuffled elements
   */
  shuffle(): Pipeline<T> {
    this.operations.push({ type: 'shuffle' });
    return this;
  }

  /**
   * Takes a random sample of n elements.
   *
   * @param count - Number of elements to sample
   * @returns Pipeline with sampled elements
   */
  sample(count: number): Pipeline<T> {
    this.operations.push({ type: 'sample', count: Math.max(0, count) });
    return this;
  }

  /**
   * Drops elements from the beginning while predicate returns true.
   *
   * @param predicate - Function to test each element
   * @returns Pipeline without dropped elements
   *
   * @example
   * ```typescript
   * const result = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .dropWhile(x => x < 3)
   *   .execute();
   * // Result: [3, 4, 5]
   * ```
   */
  dropWhile(predicate: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'dropWhile', fn: predicate });
    return this;
  }

  /**
   * Takes elements from the beginning while predicate returns true.
   *
   * @param predicate - Function to test each element
   * @returns Pipeline with taken elements
   *
   * @example
   * ```typescript
   * const result = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .takeWhile(x => x < 3)
   *   .execute();
   * // Result: [1, 2]
   * ```
   */
  takeWhile(predicate: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'takeWhile', fn: predicate });
    return this;
  }

  /**
   * Executes a side-effect function for debugging without modifying the pipeline.
   * Alias for tap().
   *
   * @param fn - Function to execute for each element
   * @returns Pipeline unchanged
   */
  peek(fn: SerializableFunction): Pipeline<T> {
    this.operations.push({ type: 'peek', fn });
    return this;
  }

  /**
   * Adds a reduce operation to the pipeline. This is a terminal operation.
   */
  reduce<R>(
    fn: SerializableFunction,
    initialValue: R,
    options?: ThreadOptions
  ): TerminalPipeline<R> {
    this.operations.push({ type: 'reduce', fn, initialValue, options });
    return new TerminalPipeline<R>(this.array, this.operations, this.threadts);
  }

  /**
   * Adds a forEach operation to the pipeline. This is a terminal operation.
   */
  forEach(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<void> {
    this.operations.push({ type: 'forEach', fn, options });
    return new TerminalPipeline<void>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a find operation to the pipeline. This is a terminal operation.
   */
  find(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'find', fn, options });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a findIndex operation to the pipeline. This is a terminal operation.
   */
  findIndex(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<number> {
    this.operations.push({ type: 'findIndex', fn, options });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a some operation to the pipeline. This is a terminal operation.
   */
  some(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<boolean> {
    this.operations.push({ type: 'some', fn, options });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds an every operation to the pipeline. This is a terminal operation.
   */
  every(
    fn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<boolean> {
    this.operations.push({ type: 'every', fn, options });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Adds a count operation to the pipeline. This is a terminal operation.
   * If no predicate is provided, counts all elements.
   */
  count(
    fn?: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<number> {
    const countFn = fn ?? (() => true);
    this.operations.push({ type: 'count', fn: countFn, options });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Groups elements by a key function. This is a terminal operation.
   *
   * @param keyFn - Function that returns the group key for each element
   * @param options - Execution options
   * @returns TerminalPipeline that resolves to a Map of grouped elements
   *
   * @example
   * ```typescript
   * const grouped = await ThreadTS.pipe(users)
   *   .groupBy(user => user.role)
   *   .execute();
   * ```
   */
  groupBy<K extends string | number | symbol>(
    keyFn: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<Map<K, T[]>> {
    this.operations.push({ type: 'groupBy', fn: keyFn, options });
    return new TerminalPipeline<Map<K, T[]>>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Partitions elements into two arrays based on a predicate. This is a terminal operation.
   *
   * @param predicate - Function that returns true for elements in the first partition
   * @param options - Execution options
   * @returns TerminalPipeline that resolves to a tuple of [matching, non-matching]
   *
   * @example
   * ```typescript
   * const [evens, odds] = await ThreadTS.pipe([1, 2, 3, 4, 5])
   *   .partition(x => x % 2 === 0)
   *   .execute();
   * ```
   */
  partition(
    predicate: SerializableFunction,
    options?: MapOptions
  ): TerminalPipeline<[T[], T[]]> {
    this.operations.push({ type: 'partition', fn: predicate, options });
    return new TerminalPipeline<[T[], T[]]>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Gets the first element of the pipeline. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the first element or undefined
   */
  first(): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'first' });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Gets the last element of the pipeline. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the last element or undefined
   */
  last(): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'last' });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Checks if the pipeline contains no elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to true if empty
   */
  isEmpty(): TerminalPipeline<boolean> {
    this.operations.push({ type: 'isEmpty' });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Calculates the sum of numeric elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the sum
   */
  sum(): TerminalPipeline<number> {
    this.operations.push({ type: 'sum' });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Calculates the average of numeric elements. This is a terminal operation.
   *
   * @returns TerminalPipeline that resolves to the average or NaN if empty
   */
  average(): TerminalPipeline<number> {
    this.operations.push({ type: 'average' });
    return new TerminalPipeline<number>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Finds the minimum element. This is a terminal operation.
   *
   * @param compareFn - Optional comparison function
   * @returns TerminalPipeline that resolves to the minimum element
   */
  min(compareFn?: SerializableFunction): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'min', fn: compareFn });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Finds the maximum element. This is a terminal operation.
   *
   * @param compareFn - Optional comparison function
   * @returns TerminalPipeline that resolves to the maximum element
   */
  max(compareFn?: SerializableFunction): TerminalPipeline<T | undefined> {
    this.operations.push({ type: 'max', fn: compareFn });
    return new TerminalPipeline<T | undefined>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Joins all elements into a string with the specified separator. This is a terminal operation.
   *
   * @param separator - The separator to use between elements (default: ',')
   * @returns TerminalPipeline that resolves to the joined string
   *
   * @example
   * ```typescript
   * const result = await thread.pipe(['a', 'b', 'c'])
   *   .join('-')
   *   .execute(); // 'a-b-c'
   * ```
   */
  join(separator = ','): TerminalPipeline<string> {
    this.operations.push({ type: 'join', initialValue: separator });
    return new TerminalPipeline<string>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Checks if the pipeline contains a specific element. This is a terminal operation.
   *
   * @param searchElement - The element to search for
   * @returns TerminalPipeline that resolves to true if found, false otherwise
   *
   * @example
   * ```typescript
   * const hasThree = await thread.pipe([1, 2, 3, 4])
   *   .includes(3)
   *   .execute(); // true
   * ```
   */
  includes(searchElement: T): TerminalPipeline<boolean> {
    this.operations.push({ type: 'includes', initialValue: searchElement });
    return new TerminalPipeline<boolean>(
      this.array,
      this.operations,
      this.threadts
    );
  }

  /**
   * Executes all operations in the pipeline and returns the result array.
   */
  async execute(): Promise<T[]> {
    let result: unknown[] = this.array;

    for (const op of this.operations) {
      result = await executeIntermediateOperation(result, op, this.threadts);
    }

    return result as T[];
  }

  /**
   * Collects the pipeline results into an array.
   * Alias for execute().
   */
  async toArray(): Promise<T[]> {
    return this.execute();
  }

  /**
   * Collects the pipeline results into a Set.
   */
  async toSet(): Promise<Set<T>> {
    const result = await this.execute();
    return new Set(result);
  }

  /**
   * Collects the pipeline results into a Map using a key function.
   *
   * @param keyFn - Function that returns the key for each element
   * @returns Promise that resolves to a Map
   */
  async toMap<K>(keyFn: (item: T) => K): Promise<Map<K, T>> {
    const result = await this.execute();
    const map = new Map<K, T>();
    for (const item of result) {
      map.set(keyFn(item), item);
    }
    return map;
  }
}

/**
 * Terminal pipeline for operations that produce a single value.
 */
export class TerminalPipeline<R> {
  constructor(
    private array: unknown[],
    private operations: PipelineOperation[],
    private threadts: ThreadTS
  ) {}

  /**
   * Executes all operations in the pipeline and returns the final result.
   */
  async execute(): Promise<R> {
    let result: unknown[] = this.array;

    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];
      const isLast = i === this.operations.length - 1;

      if (isLast && isTerminalOperation(op.type)) {
        return executeTerminalOperation<R>(result, op, this.threadts);
      }

      result = await executeIntermediateOperation(result, op, this.threadts);
    }

    return result as R;
  }
}
