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

/**
 * Decorator for timeout handling
 * Automatically rejects if execution exceeds the specified timeout
 */
export function timeout(ms: number = 5000) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return Promise.race([
        originalMethod.apply(this, args),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Operation timed out after ${ms}ms`)),
            ms
          )
        ),
      ]);
    };

    return descriptor;
  };
}

/**
 * Decorator for debouncing method calls
 * Delays execution until no calls have been made for the specified duration
 */
export function debounce(ms: number = 300) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingResolve: ((value: unknown) => void) | null = null;
    let pendingReject: ((error: Error) => void) | null = null;

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return new Promise((resolve, reject) => {
        // Clear previous timeout and reject pending promise
        if (timeoutId) {
          clearTimeout(timeoutId);
          if (pendingReject) {
            pendingReject(new Error('Debounced: superseded by new call'));
          }
        }

        pendingResolve = resolve;
        pendingReject = reject;

        timeoutId = setTimeout(async () => {
          try {
            const result = await originalMethod.apply(this, args);
            if (pendingResolve) {
              pendingResolve(result);
            }
          } catch (error) {
            if (pendingReject) {
              pendingReject(
                error instanceof Error ? error : new Error(String(error))
              );
            }
          } finally {
            timeoutId = null;
            pendingResolve = null;
            pendingReject = null;
          }
        }, ms);
      });
    };

    return descriptor;
  };
}

/**
 * Decorator for throttling method calls
 * Ensures the method is called at most once per specified interval
 */
export function throttle(ms: number = 300) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let lastCall = 0;
    let lastResult: unknown = undefined;

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const now = Date.now();

      if (now - lastCall >= ms) {
        lastCall = now;
        lastResult = await originalMethod.apply(this, args);
      }

      return lastResult;
    };

    return descriptor;
  };
}

/**
 * Decorator for logging method execution
 * Logs method calls, arguments, results, and execution time
 */
export function logged(
  options: { logArgs?: boolean; logResult?: boolean; logTiming?: boolean } = {}
) {
  const { logArgs = true, logResult = true, logTiming = true } = options;

  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const className =
      (target as { constructor?: { name?: string } })?.constructor?.name ||
      'Unknown';

    descriptor.value = async function (...args: unknown[]) {
      const startTime = Date.now();
      const argsLog = logArgs ? ` with args: ${JSON.stringify(args)}` : '';

      console.log(`[${className}.${propertyKey}] Starting${argsLog}`);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;
        const timingLog = logTiming ? ` in ${duration}ms` : '';
        const resultLog = logResult ? ` Result: ${JSON.stringify(result)}` : '';

        console.log(
          `[${className}.${propertyKey}] Completed${timingLog}.${resultLog}`
        );

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        const timingLog = logTiming ? ` after ${duration}ms` : '';
        console.error(
          `[${className}.${propertyKey}] Failed${timingLog}:`,
          error
        );
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for caching method results with TTL (Time To Live) support.
 * Similar to memoize but with expiration support.
 *
 * @param ttlMs - Time to live in milliseconds (default: 60000 = 1 minute)
 * @param maxSize - Maximum cache size (default: 100)
 *
 * @example
 * ```typescript
 * class DataService {
 *   @cache(30000, 50) // Cache for 30 seconds, max 50 entries
 *   async fetchData(id: string): Promise<Data> {
 *     return await api.getData(id);
 *   }
 * }
 * ```
 */
export function cache(ttlMs: number = 60000, maxSize: number = 100) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const cacheMap = new Map<string, { value: unknown; expiry: number }>();
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const key = JSON.stringify(args);
      const now = Date.now();

      // Check if cached and not expired
      const cached = cacheMap.get(key);
      if (cached && cached.expiry > now) {
        return cached.value;
      }

      // Execute and cache
      const result = await originalMethod.apply(this, args);

      // Implement LRU eviction if at capacity
      if (cacheMap.size >= maxSize) {
        // Remove oldest entry
        const firstKey = cacheMap.keys().next().value;
        if (firstKey !== undefined) {
          cacheMap.delete(firstKey);
        }
      }

      cacheMap.set(key, { value: result, expiry: now + ttlMs });
      return result;
    };

    // Add method to clear cache
    (descriptor.value as { clearCache?: () => void }).clearCache = () => {
      cacheMap.clear();
    };

    return descriptor;
  };
}

/**
 * Decorator for limiting concurrent executions of a method.
 * Useful for controlling resource usage when calling expensive operations.
 *
 * @param maxConcurrent - Maximum number of concurrent executions (default: 1)
 *
 * @example
 * ```typescript
 * class FileProcessor {
 *   @concurrent(3) // Max 3 concurrent file operations
 *   async processFile(path: string): Promise<void> {
 *     await heavyFileOperation(path);
 *   }
 * }
 * ```
 */
export function concurrent(maxConcurrent: number = 1) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let currentCount = 0;
    const queue: Array<{
      resolve: () => void;
      reject: (error: Error) => void;
    }> = [];

    const originalMethod = descriptor.value;

    const tryNext = () => {
      if (queue.length > 0 && currentCount < maxConcurrent) {
        currentCount++;
        const { resolve } = queue.shift()!;
        resolve();
      }
    };

    descriptor.value = async function (...args: unknown[]) {
      // Wait for a slot to become available
      if (currentCount >= maxConcurrent) {
        await new Promise<void>((resolve, reject) => {
          queue.push({ resolve, reject });
        });
      } else {
        currentCount++;
      }

      try {
        return await originalMethod.apply(this, args);
      } finally {
        currentCount--;
        tryNext();
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for circuit breaker pattern.
 * Prevents repeated calls to a failing service.
 *
 * @param options - Circuit breaker configuration
 *
 * @example
 * ```typescript
 * class ApiService {
 *   @circuitBreaker({ failureThreshold: 5, resetTimeout: 30000 })
 *   async callExternalApi(): Promise<Data> {
 *     return await externalApi.getData();
 *   }
 * }
 * ```
 */
export function circuitBreaker(
  options: {
    failureThreshold?: number;
    resetTimeout?: number;
    halfOpenRequests?: number;
  } = {}
) {
  const {
    failureThreshold = 5,
    resetTimeout = 30000,
    halfOpenRequests = 1,
  } = options;

  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let failures = 0;
    let lastFailureTime = 0;
    let state: 'closed' | 'open' | 'half-open' = 'closed';
    let halfOpenAttempts = 0;

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const now = Date.now();

      // Check if circuit should be reset to half-open
      if (state === 'open' && now - lastFailureTime >= resetTimeout) {
        state = 'half-open';
        halfOpenAttempts = 0;
      }

      // Reject if circuit is open
      if (state === 'open') {
        throw new Error(
          `Circuit breaker is open for ${propertyKey}. Try again later.`
        );
      }

      // Limit requests in half-open state
      if (state === 'half-open' && halfOpenAttempts >= halfOpenRequests) {
        throw new Error(
          `Circuit breaker is half-open for ${propertyKey}. Too many test requests.`
        );
      }

      if (state === 'half-open') {
        halfOpenAttempts++;
      }

      try {
        const result = await originalMethod.apply(this, args);

        // Success - reset failures
        if (state === 'half-open') {
          state = 'closed';
        }
        failures = 0;

        return result;
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (state === 'half-open' || failures >= failureThreshold) {
          state = 'open';
          console.warn(
            `Circuit breaker opened for ${propertyKey} after ${failures} failures`
          );
        }

        throw error;
      }
    };

    // Add method to get circuit state
    (descriptor.value as { getState?: () => string }).getState = () => state;

    // Add method to reset circuit
    (descriptor.value as { reset?: () => void }).reset = () => {
      state = 'closed';
      failures = 0;
      halfOpenAttempts = 0;
    };

    return descriptor;
  };
}

/**
 * Decorator for measuring method performance.
 * Collects timing statistics across multiple calls.
 *
 * @example
 * ```typescript
 * class Calculator {
 *   @measure()
 *   async compute(data: number[]): Promise<number> {
 *     return data.reduce((a, b) => a + b, 0);
 *   }
 * }
 * // Access stats: Calculator.prototype.compute.getStats()
 * ```
 */
export function measure() {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const timings: number[] = [];
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const start = performance.now();

      try {
        return await originalMethod.apply(this, args);
      } finally {
        const duration = performance.now() - start;
        timings.push(duration);

        // Keep only last 100 measurements
        if (timings.length > 100) {
          timings.shift();
        }
      }
    };

    // Add method to get statistics
    (descriptor.value as { getStats?: () => object }).getStats = () => {
      if (timings.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          avg: 0,
          median: 0,
          p95: 0,
          p99: 0,
        };
      }

      const sorted = [...timings].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);

      return {
        count: sorted.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: sum / sorted.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
    };

    // Add method to clear statistics
    (descriptor.value as { clearStats?: () => void }).clearStats = () => {
      timings.length = 0;
    };

    return descriptor;
  };
}

/**
 * Decorator for validating method arguments.
 * Throws an error if validation fails.
 *
 * @param validators - Array of validator functions for each argument
 *
 * @example
 * ```typescript
 * class UserService {
 *   @validate([
 *     (id) => typeof id === 'string' && id.length > 0,
 *     (data) => data && typeof data.name === 'string'
 *   ])
 *   async updateUser(id: string, data: UserData): Promise<void> {
 *     await api.updateUser(id, data);
 *   }
 * }
 * ```
 */
export function validate(
  validators: Array<(arg: unknown) => boolean | string>
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      for (let i = 0; i < validators.length; i++) {
        if (i >= args.length) break;

        const result = validators[i](args[i]);
        if (result === false) {
          throw new Error(
            `Validation failed for argument ${i} in ${propertyKey}`
          );
        }
        if (typeof result === 'string') {
          throw new Error(result);
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Decorator for lazy initialization of a method result.
 * The method is executed only once on first access.
 *
 * @example
 * ```typescript
 * class ConfigService {
 *   @lazy()
 *   async loadConfig(): Promise<Config> {
 *     return await fetchConfig(); // Only called once
 *   }
 * }
 * ```
 */
export function lazy() {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    let result: unknown;
    let initialized = false;
    let initializing: Promise<unknown> | null = null;

    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      if (initialized) {
        return result;
      }

      // Handle concurrent initialization
      if (initializing) {
        return initializing;
      }

      initializing = (async () => {
        result = await originalMethod.apply(this, args);
        initialized = true;
        initializing = null;
        return result;
      })();

      return initializing;
    };

    // Add method to reset lazy state
    (descriptor.value as { reset?: () => void }).reset = () => {
      result = undefined;
      initialized = false;
      initializing = null;
    };

    return descriptor;
  };
}
