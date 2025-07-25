/**
 * ThreadTS Universal - Decorators
 * Method decorators for automatic parallelization
 */

import { ThreadTS } from '../core/threadjs';
import { ParallelMethodOptions } from '../types';

/**
 * Method decorator that automatically parallelizes method execution
 */
export function parallelMethod(options: ParallelMethodOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelMethod can only be applied to methods');
    }

    // Cache for results if enabled
    const resultCache = new Map<string, any>();

    descriptor.value = async function (...args: any[]) {
      // Generate cache key if caching is enabled
      const cacheKey = options.cacheResults ? JSON.stringify(args) : null;

      // Check cache first
      if (cacheKey && resultCache.has(cacheKey)) {
        return resultCache.get(cacheKey);
      }

      // Create thread pool instance with custom config if specified
      const threadjs = options.poolSize
        ? ThreadTS.getInstance({ maxWorkers: options.poolSize })
        : ThreadTS.getInstance();

      try {
        // Execute method in worker thread
        const result = await threadjs.run(
          originalMethod,
          { context: this, args },
          {
            timeout: options.timeout,
            priority: options.priority,
            signal: options.signal,
            transferable: options.transferable,
            maxRetries: options.maxRetries,
          }
        );

        // Cache result if enabled
        if (cacheKey) {
          resultCache.set(cacheKey, result);

          // Limit cache size to prevent memory leaks
          if (resultCache.size > 100) {
            const firstKey = resultCache.keys().next().value;
            if (firstKey) {
              resultCache.delete(firstKey);
            }
          }
        }

        return result;
      } catch (error) {
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Class decorator that parallelizes all methods marked with @parallel
 */
export function parallelClass(options: ParallelMethodOptions = {}) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);

        // Find all methods with parallel metadata
        const prototype = constructor.prototype;
        const methodNames = Object.getOwnPropertyNames(prototype);

        for (const methodName of methodNames) {
          const method = prototype[methodName];

          if (
            typeof method === 'function' &&
            methodName !== 'constructor' &&
            method._parallel
          ) {
            // Apply parallel decorator to method
            const originalMethod = method;
            (this as any)[methodName] = async function (...args: any[]) {
              const threadjs = ThreadTS.getInstance();
              return await threadjs.run(
                originalMethod.bind(this),
                args,
                options
              );
            };
          }
        }
      }
    };
  };
}

/**
 * Simple decorator to mark methods for parallelization
 */
export function parallel(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  descriptor.value._parallel = true;
  return descriptor;
}

/**
 * Decorator for parallel computation with automatic batching
 */
export function parallelBatch(batchSize: number = 4) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelBatch can only be applied to methods');
    }

    descriptor.value = async function (data: any[], ...otherArgs: any[]) {
      if (!Array.isArray(data)) {
        throw new Error('First argument must be an array for @parallelBatch');
      }

      const threadjs = ThreadTS.getInstance();

      const tasks = data.map((item) => ({
        fn: originalMethod,
        data: { context: this, args: [item, ...otherArgs] },
      }));

      return await threadjs.batch(tasks, batchSize);
    };

    return descriptor;
  };
}

/**
 * Decorator for parallel mapping operations
 */
export function parallelMap(options: { batchSize?: number } = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelMap can only be applied to methods');
    }

    descriptor.value = async function (data: any[], ...otherArgs: any[]) {
      if (!Array.isArray(data)) {
        throw new Error('First argument must be an array for @parallelMap');
      }

      const threadjs = ThreadTS.getInstance();

      return await threadjs.map(
        data,
        (item, index) => originalMethod.call(this, item, index, ...otherArgs),
        { batchSize: options.batchSize }
      );
    };

    return descriptor;
  };
}

/**
 * Decorator for methods that need to run with high priority
 */
export function highPriority(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const threadjs = ThreadTS.getInstance();
    return await threadjs.run(
      originalMethod,
      { context: this, args },
      {
        priority: 'high',
      }
    );
  };

  return descriptor;
}

/**
 * Decorator for methods that can run with low priority
 */
export function lowPriority(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const threadjs = ThreadTS.getInstance();
    return await threadjs.run(
      originalMethod,
      { context: this, args },
      {
        priority: 'low',
      }
    );
  };

  return descriptor;
}

/**
 * Decorator for methods with timeout
 */
export function timeout(ms: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const threadjs = ThreadTS.getInstance();
      return await threadjs.run(
        originalMethod,
        { context: this, args },
        {
          timeout: ms,
        }
      );
    };

    return descriptor;
  };
}
