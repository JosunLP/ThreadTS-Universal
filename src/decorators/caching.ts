/**
 * ThreadTS Universal - Caching Decorators
 *
 * Decorators for caching and memoization of method results.
 * Supports both legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * @module decorators/caching
 */

import { createMethodDecorator } from './utils';

/**
 * Decorator for memoization with optional cache size limit
 */
export function memoize(maxCacheSize: number = 100) {
  const cache = new Map<string, unknown>();

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
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

    return wrappedMethod as typeof originalMethod;
  });
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
  const cacheMap = new Map<string, { value: unknown; expiry: number }>();

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
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
    (wrappedMethod as { clearCache?: () => void }).clearCache = () => {
      cacheMap.clear();
    };

    return wrappedMethod as typeof originalMethod;
  });
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
  let result: unknown;
  let initialized = false;
  let initializing: Promise<unknown> | null = null;

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
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
    (wrappedMethod as { reset?: () => void }).reset = () => {
      result = undefined;
      initialized = false;
      initializing = null;
    };

    return wrappedMethod as typeof originalMethod;
  });
}
