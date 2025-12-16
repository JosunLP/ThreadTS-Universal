/**
 * ThreadTS Universal - Parallel Decorators
 *
 * Decorators for automatic parallelization of method execution.
 * Supports both legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * @module decorators/parallel
 */

import { ThreadTS } from '../core/threadts';
import type { ParallelMethodOptions } from '../types';
import { createMethodDecorator } from './utils';

/**
 * Method decorator that automatically parallelizes method execution
 */
export function parallelMethod(options: ParallelMethodOptions = {}) {
  // Cache for results if enabled
  const resultCache = new Map<string, unknown>();

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      // Generate cache key if caching is enabled
      const cacheKey = options.cacheResults ? JSON.stringify(args) : null;

      // Check cache first
      if (cacheKey && resultCache.has(cacheKey)) {
        return resultCache.get(cacheKey);
      }

      // Create thread pool instance with custom config if specified
      const threadts = options.poolSize
        ? ThreadTS.getInstance({ poolSize: options.poolSize })
        : ThreadTS.getInstance();

      // Execute method in worker thread
      const result = await threadts.run(
        originalMethod,
        { context: this, args },
        {
          timeout: options.timeout,
          maxRetries: options.maxRetries,
          priority: options.priority,
        }
      );

      // Cache result if enabled
      if (cacheKey && options.cacheResults) {
        resultCache.set(cacheKey, result);
      }

      return result;
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Class decorator that auto-parallelizes all marked methods
 */
export function parallelClass() {
  return function <T extends new (...args: unknown[]) => object>(
    constructor: T
  ): T {
    const parallelMethods =
      (constructor as unknown as { parallelMethods?: string[] })
        .parallelMethods || [];

    // Return the same constructor but with modified prototype methods
    for (const methodName of parallelMethods) {
      const originalMethod = constructor.prototype[methodName];
      if (typeof originalMethod === 'function') {
        constructor.prototype[methodName] = async function (
          ...args: unknown[]
        ) {
          const threadts = ThreadTS.getInstance();
          return threadts.run(originalMethod.bind(this), args);
        };
      }
    }

    return constructor;
  };
}

/**
 * Mark a method for auto-parallelization in parallel classes
 */
export function parallel() {
  return createMethodDecorator((originalMethod) => {
    (originalMethod as { _parallel?: boolean })._parallel = true;
    return originalMethod;
  });
}

/**
 * Decorator for parallel computation with automatic batching
 */
export function parallelBatch(batchSize: number = 4) {
  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      data: unknown[],
      ...otherArgs: unknown[]
    ): Promise<unknown[]> {
      if (!Array.isArray(data)) {
        throw new Error('First argument must be an array for @parallelBatch');
      }

      const threadts = ThreadTS.getInstance();

      // Split data into batches
      const batches: unknown[][] = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
      }

      // Process each batch in parallel
      const batchPromises = batches.map((batch) =>
        threadts.run(originalMethod.bind(this), [batch, ...otherArgs])
      );

      const batchResults = await Promise.all(batchPromises);
      return batchResults.flat();
    };

    return wrappedMethod as typeof originalMethod;
  });
}

/**
 * Decorator for parallel map operations
 */
export function parallelMap() {
  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      data: unknown[]
    ): Promise<unknown[]> {
      if (!Array.isArray(data)) {
        throw new Error('First argument must be an array for @parallelMap');
      }

      const threadts = ThreadTS.getInstance();

      // Execute parallel operations using Promise.all for parallel execution
      const promises = data.map((item) =>
        threadts.run(originalMethod.bind(this), [item])
      );

      return Promise.all(promises);
    };

    return wrappedMethod as typeof originalMethod;
  });
}
