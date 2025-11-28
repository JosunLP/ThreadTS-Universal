/**
 * ThreadTS Universal - Pipeline Module
 *
 * Provides fluent chaining of parallel operations with lazy evaluation.
 * Operations are only executed when execute() is called.
 *
 * @module core/pipeline
 */

import type { MapOptions, SerializableFunction, ThreadOptions } from '../types';
import type { ThreadTS } from './threadts';

/**
 * Pipeline operation definition for lazy evaluation.
 */
export interface PipelineOperation {
  type: string;
  fn?: SerializableFunction;
  options?: MapOptions | ThreadOptions;
  initialValue?: unknown;
  count?: number;
}

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
   * Executes all operations in the pipeline and returns the result array.
   */
  async execute(): Promise<T[]> {
    let result: unknown[] = this.array;

    for (const op of this.operations) {
      result = await this.executeOperation(result, op);
    }

    return result as T[];
  }

  /**
   * Execute a single pipeline operation.
   * @internal
   */
  protected async executeOperation(
    data: unknown[],
    op: PipelineOperation
  ): Promise<unknown[]> {
    switch (op.type) {
      case 'map':
        return this.threadts.map(data, op.fn!, op.options as MapOptions);
      case 'filter':
        return this.threadts.filter(data, op.fn!, op.options as MapOptions);
      case 'flatMap':
        return this.threadts.flatMap(data, op.fn!, op.options as MapOptions);
      case 'take':
        return data.slice(0, op.count ?? 0);
      case 'skip':
        return data.slice(op.count ?? 0);
      case 'chunk': {
        const chunkSize = op.count ?? 1;
        const chunks: unknown[][] = [];
        for (let i = 0; i < data.length; i += chunkSize) {
          chunks.push(data.slice(i, i + chunkSize));
        }
        return chunks;
      }
      case 'unique': {
        const seen = new Set<string>();
        const uniqueResult: unknown[] = [];
        for (const item of data) {
          const key = op.fn
            ? JSON.stringify(op.fn(item))
            : JSON.stringify(item);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResult.push(item);
          }
        }
        return uniqueResult;
      }
      case 'reverse':
        return [...data].reverse();
      case 'sort':
        return [...data].sort(
          op.fn as ((a: unknown, b: unknown) => number) | undefined
        );
      default:
        return data;
    }
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
   * Execute a single pipeline operation.
   * @internal
   */
  private async executeIntermediateOperation(
    data: unknown[],
    op: PipelineOperation
  ): Promise<unknown[]> {
    switch (op.type) {
      case 'map':
        return this.threadts.map(data, op.fn!, op.options as MapOptions);
      case 'filter':
        return this.threadts.filter(data, op.fn!, op.options as MapOptions);
      case 'flatMap':
        return this.threadts.flatMap(data, op.fn!, op.options as MapOptions);
      case 'take':
        return data.slice(0, op.count ?? 0);
      case 'skip':
        return data.slice(op.count ?? 0);
      case 'chunk': {
        const chunkSize = op.count ?? 1;
        const chunks: unknown[][] = [];
        for (let j = 0; j < data.length; j += chunkSize) {
          chunks.push(data.slice(j, j + chunkSize));
        }
        return chunks;
      }
      case 'unique': {
        const seen = new Set<string>();
        const uniqueResult: unknown[] = [];
        for (const item of data) {
          const key = op.fn
            ? JSON.stringify(op.fn(item))
            : JSON.stringify(item);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueResult.push(item);
          }
        }
        return uniqueResult;
      }
      case 'reverse':
        return [...data].reverse();
      case 'sort':
        return [...data].sort(
          op.fn as ((a: unknown, b: unknown) => number) | undefined
        );
      default:
        return data;
    }
  }

  /**
   * Execute a terminal operation and return the result.
   * @internal
   */
  private async executeTerminalOperation(
    data: unknown[],
    op: PipelineOperation
  ): Promise<R> {
    switch (op.type) {
      case 'reduce':
        return this.threadts.reduce(
          data,
          op.fn!,
          op.initialValue as R,
          op.options as ThreadOptions
        );
      case 'forEach':
        await this.threadts.forEach(data, op.fn!, op.options as MapOptions);
        return undefined as R;
      case 'find':
        return this.threadts.find(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'findIndex':
        return this.threadts.findIndex(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'some':
        return this.threadts.some(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'every':
        return this.threadts.every(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'count':
        return this.threadts.count(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'groupBy':
        return this.threadts.groupBy(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'partition':
        return this.threadts.partition(
          data,
          op.fn!,
          op.options as MapOptions
        ) as Promise<R>;
      case 'first':
        return (data.length > 0 ? data[0] : undefined) as R;
      case 'last':
        return (data.length > 0 ? data[data.length - 1] : undefined) as R;
      case 'isEmpty':
        return (data.length === 0) as R;
      case 'sum':
        return data.reduce(
          (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
          0
        ) as R;
      case 'average': {
        if (data.length === 0) return NaN as R;
        const sumValue = data.reduce(
          (acc: number, val) => acc + (typeof val === 'number' ? val : 0),
          0
        );
        return (sumValue / data.length) as R;
      }
      case 'min': {
        if (data.length === 0) return undefined as R;
        const minCompareFn = op.fn as
          | ((a: unknown, b: unknown) => number)
          | undefined;
        return [...data].sort(
          minCompareFn ??
            ((a, b) => {
              if (a === b) return 0;
              return (a as number) < (b as number) ? -1 : 1;
            })
        )[0] as R;
      }
      case 'max': {
        if (data.length === 0) return undefined as R;
        const maxCompareFn = op.fn as
          | ((a: unknown, b: unknown) => number)
          | undefined;
        return [...data].sort(
          maxCompareFn ??
            ((a, b) => {
              if (a === b) return 0;
              return (a as number) > (b as number) ? -1 : 1;
            })
        )[0] as R;
      }
      default:
        return data as R;
    }
  }

  /**
   * Executes all operations in the pipeline and returns the final result.
   */
  async execute(): Promise<R> {
    let result: unknown[] = this.array;

    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];
      const isLast = i === this.operations.length - 1;

      if (isLast && this.isTerminalOperation(op.type)) {
        return this.executeTerminalOperation(result, op);
      }

      result = await this.executeIntermediateOperation(result, op);
    }

    return result as R;
  }

  /**
   * Check if operation type is a terminal operation.
   */
  private isTerminalOperation(type: string): boolean {
    return [
      'reduce',
      'forEach',
      'find',
      'findIndex',
      'some',
      'every',
      'count',
      'groupBy',
      'partition',
      'first',
      'last',
      'isEmpty',
      'sum',
      'average',
      'min',
      'max',
    ].includes(type);
  }
}
