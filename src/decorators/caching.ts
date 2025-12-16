/**
 * ThreadTS Universal - Caching Decorators
 *
 * Decorators for caching and memoization of method results.
 * Supports both legacy (experimentalDecorators) and Stage-3 decorator syntax.
 *
 * Uses the shared LRUCache class for consistent caching behavior
 * and follows the DRY principle (Don't Repeat Yourself).
 *
 * @module decorators/caching
 * @author ThreadTS Universal Team
 */

import { createCacheKey, LazyInitializer, LRUCache } from '../utils/cache';
import { createMethodDecorator } from './utils';

/**
 * Type for augmented methods with cache controls.
 */
export interface CacheableMethod {
  /** Clears the method's cache */
  clearCache?: () => void;
  /** Returns cache statistics */
  getCacheStats?: () => { size: number; maxSize: number };
}

/**
 * Type for augmented methods with reset controls.
 */
export interface LazyMethod {
  /** Resets the lazy state */
  reset?: () => void;
  /** Checks whether it's already initialized */
  isInitialized?: () => boolean;
}

/**
 * Decorator for memoization with an optional cache size limit.
 *
 * Caches method results based on arguments. If called with the same
 * arguments, the cached result is returned. Uses LRU (Least Recently Used)
 * eviction when the maximum size is reached.
 *
 * @param maxCacheSize - Maximum number of cached entries (default: 100)
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class Calculator {
 *   @memoize(50) // Cache up to 50 inputs
 *   async computeExpensive(input: number): Promise<number> {
 *     // Expensive computation...
 *     return result;
 *   }
 * }
 * ```
 */
export function memoize(maxCacheSize: number = 100) {
  // Use the shared LRUCache class
  const lruCache = new LRUCache<string, unknown>({
    maxSize: maxCacheSize,
    ttlMs: 0, // No expiration for memoize
  });

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const key = createCacheKey(args);

      // Check cache hit
      if (lruCache.has(key)) {
        return lruCache.get(key);
      }

      // Execute method and cache
      const result = await originalMethod.apply(this, args);
      lruCache.set(key, result);
      return result;
    };

    // Augment method with cache controls
    const cacheableMethod = wrappedMethod as typeof originalMethod &
      CacheableMethod;
    cacheableMethod.clearCache = () => lruCache.clear();
    cacheableMethod.getCacheStats = () => ({
      size: lruCache.size,
      maxSize: maxCacheSize,
    });

    return cacheableMethod;
  });
}

/**
 * Decorator for caching with TTL (time-to-live) support.
 *
 * Similar to memoize, but with automatic expiration of cache entries.
 * Ideal for data that may change periodically.
 *
 * @param ttlMs - Time-to-live in milliseconds (default: 60000 = 1 minute)
 * @param maxSize - Maximum cache size (default: 100)
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class DataService {
 *   @cache(30000, 50) // Cache for 30 seconds, max 50 entries
 *   async fetchData(id: string): Promise<Data> {
 *     return await api.getData(id);
 *   }
 *
 *   refreshData(id: string) {
 *     // Manual clear if needed
 *     (this.fetchData as any).clearCache();
 *   }
 * }
 * ```
 */
export function cache(ttlMs: number = 60000, maxSize: number = 100) {
  // Use the shared LRUCache class with TTL
  const lruCache = new LRUCache<string, unknown>({
    maxSize,
    ttlMs,
  });

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const key = createCacheKey(args);

      // Check cache hit (LRUCache handles expiration automatically)
      const cached = lruCache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Execute method and cache
      const result = await originalMethod.apply(this, args);
      lruCache.set(key, result);
      return result;
    };

    // Augment method with cache controls
    const cacheableMethod = wrappedMethod as typeof originalMethod &
      CacheableMethod;
    cacheableMethod.clearCache = () => lruCache.clear();
    cacheableMethod.getCacheStats = () => ({
      size: lruCache.size,
      maxSize,
    });

    return cacheableMethod;
  });
}

/**
 * Decorator for lazy initialization.
 *
 * The method is executed only once on the first call.
 * All subsequent calls return the stored result.
 * Supports concurrent calls during initialization without race conditions.
 *
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class ConfigService {
 *   @lazy()
 *   async loadConfig(): Promise<Config> {
 *     console.log('Loading config...'); // Printed only once
 *     return await fetchConfig();
 *   }
 *
 *   async resetAndReload() {
 *     (this.loadConfig as any).reset();
 *     return await this.loadConfig();
 *   }
 * }
 * ```
 */
export function lazy() {
  // Use the shared LazyInitializer class
  const initializer = new LazyInitializer<unknown>();

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return initializer.get(() => originalMethod.apply(this, args));
    };

    // Augment method with controls
    const lazyMethod = wrappedMethod as typeof originalMethod & LazyMethod;
    lazyMethod.reset = () => initializer.reset();
    lazyMethod.isInitialized = () => initializer.isInitialized();

    return lazyMethod;
  });
}
