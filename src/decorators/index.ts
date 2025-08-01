/**
 * ThreadTS Universal - Decorators
 * Method decorators for automatic parallelization
 */

import { ThreadTS } from '../core/threadts';
import { ParallelMethodOptions } from '../types';

/**
 * Method decorator that automatically parallelizes method execution
 */
export function parallelMethod(options: ParallelMethodOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelMethod can only be applied to methods');
    }

    // Cache for results if enabled
    const resultCache = new Map<string, unknown>();

    descriptor.value = async function (...args: unknown[]) {
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
          retries: options.maxRetries,
        }
      );

      // Cache result if enabled
      if (cacheKey && options.cacheResults) {
        resultCache.set(cacheKey, result);
      }

      return result;
    };

    return descriptor;
  };
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
export function parallel(
  target: unknown,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  (descriptor.value as { _parallel?: boolean })._parallel = true;
  return descriptor;
}

/**
 * Decorator for parallel computation with automatic batching
 */
export function parallelBatch(batchSize: number = 4) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelBatch can only be applied to methods');
    }

    descriptor.value = async function (
      data: unknown[],
      ...otherArgs: unknown[]
    ) {
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

    return descriptor;
  };
}

/**
 * Decorator for parallel map operations
 */
export function parallelMap() {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@parallelMap can only be applied to methods');
    }

    descriptor.value = async function (data: unknown[]) {
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

    return descriptor;
  };
}

/**
 * Decorator for memoization with optional cache size limit
 */
export function memoize(maxCacheSize: number = 100) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const cache = new Map<string, unknown>();
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = JSON.stringify(args);

      if (cache.has(key)) {
        return cache.get(key);
      }

      const result = await originalMethod.apply(this, args);

      // Implement LRU-like behavior
      if (cache.size >= maxCacheSize) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }

      cache.set(key, result);
      return result;
    };

    return descriptor;
  };
}

/**
 * Decorator for retry logic with exponential backoff
 */
export function retry(maxAttempts: number = 3, baseDelay: number = 1000) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      let lastError: Error;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (attempt === maxAttempts) {
            throw lastError;
          }

          // Exponential backoff
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };

    return descriptor;
  };
}

/**
 * Decorator for rate limiting method calls
 */
export function rateLimit(callsPerSecond: number = 10) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const queue: Array<{
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      args: unknown[];
    }> = [];
    const interval = 1000 / callsPerSecond;
    let lastCall = 0;

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return new Promise((resolve, reject) => {
        queue.push({ resolve, reject, args });
        processQueue.call(this);
      });
    };

    async function processQueue(this: unknown) {
      if (queue.length === 0) return;

      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= interval) {
        const { resolve, reject, args } = queue.shift()!;
        lastCall = now;

        try {
          const result = await originalMethod.apply(this, args);
          resolve(result);
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }

        // Process next item if any
        if (queue.length > 0) {
          setTimeout(() => processQueue.call(this), interval);
        }
      } else {
        // Wait for the remaining time
        setTimeout(() => processQueue.call(this), interval - timeSinceLastCall);
      }
    }

    return descriptor;
  };
}
