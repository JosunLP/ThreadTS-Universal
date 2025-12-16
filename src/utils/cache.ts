/**
 * ThreadTS Universal - Cache Utilities
 *
 * Shared cache implementations for decorators.
 * Follows the DRY principle by extracting common cache logic.
 *
 * @module utils/cache
 * @author ThreadTS Universal Team
 */

/**
 * Cache entry containing a value and an optional expiration timestamp.
 *
 * @template T - Type of the cached value
 */
export interface CacheEntry<T> {
  /** Cached value */
  value: T;
  /** Expiration timestamp in milliseconds (optional) */
  expiry?: number;
}

/**
 * Configuration for the LRU cache.
 */
export interface LRUCacheConfig {
  /** Maximum number of entries in the cache */
  maxSize: number;
  /** Time-to-live in milliseconds (optional, 0 = no expiration) */
  ttlMs?: number;
}

/**
 * LRU (Least Recently Used) Cache Implementierung.
 *
 * Features:
 * - Bounded size with automatic eviction
 * - Optional TTL (time-to-live) for entries
 * - Efficient O(1) operations via a Map-based implementation
 *
 * @template K - Key type
 * @template V - Value type
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>({ maxSize: 100, ttlMs: 60000 });
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // 42
 * ```
 */
export class LRUCache<K, V> {
  /** Internal map for cache entries */
  private readonly cache: Map<K, CacheEntry<V>>;

  /** Maximum cache size */
  private readonly maxSize: number;

  /** Time-to-live in milliseconds (0 = no expiration) */
  private readonly ttlMs: number;

  /**
   * Creates a new LRU cache.
   *
   * @param config - Cache configuration
   */
  constructor(config: LRUCacheConfig) {
    this.cache = new Map();
    this.maxSize = Math.max(1, config.maxSize);
    this.ttlMs = config.ttlMs ?? 0;
  }

  /**
   * Retrieves a value from the cache.
   *
   * Updates the LRU order (most recently used -> end of the Map).
   * Returns undefined if the key does not exist or has expired.
   *
   * @param key - The key
   * @returns The cached value or undefined
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check expiration
    if (entry.expiry !== undefined && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU update: move entry to the end
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Stores a value in the cache.
   *
   * When reaching maximum capacity, the oldest entry is evicted.
   *
   * @param key - The key
   * @param value - The value to store
   */
  set(key: K, value: V): void {
    // If the key already exists, delete it (to maintain correct LRU ordering)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Evict oldest entry when at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Add new entry
    const entry: CacheEntry<V> = {
      value,
      expiry: this.ttlMs > 0 ? Date.now() + this.ttlMs : undefined,
    };
    this.cache.set(key, entry);
  }

  /**
   * Checks whether a key exists in the cache and is still valid.
   *
   * @param key - The key
   * @returns true if the key exists and has not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check expiration
    if (entry.expiry !== undefined && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Removes an entry from the cache.
   *
   * @param key - The key to remove
   * @returns true if the key existed and was removed
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the current number of entries.
   *
   * @returns Number of entries in the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Removes all expired entries from the cache.
   *
   * This method is not called automatically to avoid impacting get/set
   * performance. Call it manually if needed (e.g. periodically).
   *
   * @returns Number of removed entries
   */
  prune(): number {
    if (this.ttlMs === 0) {
      return 0;
    }

    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache) {
      if (entry.expiry !== undefined && now > entry.expiry) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Returns cache statistics.
   *
   * @returns Cache statistics object
   */
  stats(): CacheStats {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  /** Current number of entries */
  size: number;
  /** Maximum number of entries */
  maxSize: number;
  /** Time-to-live in milliseconds */
  ttlMs: number;
}

/**
 * Creates a string cache key from function arguments.
 *
 * Uses JSON.stringify for serializable arguments.
 * Warning: functions and circular references are not supported.
 *
 * @param args - Arguments to serialize
 * @returns A string key for the cache
 *
 * @example
 * ```typescript
 * const key = createCacheKey([1, 'test', { a: 1 }]);
 * // '[[1,"test",{"a":1}]]' or similar
 * ```
 */
export function createCacheKey(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    // Fallback for non-serializable values
    return args.map((arg) => String(arg)).join('::');
  }
}

/**
 * Lazy initialization state.
 *
 * Manages state for one-time initialization with support for concurrent
 * callers while initialization is in progress.
 *
 * @template T - Type of the initialized value
 */
export class LazyInitializer<T> {
  /** Initialized value */
  private value: T | undefined = undefined;

  /** Whether initialization has completed */
  private initialized = false;

  /** Promise for an in-flight initialization (prevents race conditions) */
  private initializing: Promise<T> | null = null;

  /**
   * Returns the value, initializing it if needed.
   *
   * If called concurrently while initialization is in progress, the same
   * Promise is returned to prevent duplicate initialization.
   *
   * @param initializer - Function that initializes the value
   * @returns Promise resolving to the initialized value
   */
  async get(initializer: () => Promise<T>): Promise<T> {
    // Already initialized?
    if (this.initialized) {
      return this.value as T;
    }

    // Initialization already in progress?
    if (this.initializing !== null) {
      return this.initializing;
    }

    // Start a new initialization
    this.initializing = (async () => {
      try {
        this.value = await initializer();
        this.initialized = true;
        return this.value;
      } finally {
        this.initializing = null;
      }
    })();

    return this.initializing;
  }

  /**
   * Resets the lazy state.
   *
   * After reset, the next call to get() will initialize again.
   */
  reset(): void {
    this.value = undefined;
    this.initialized = false;
    this.initializing = null;
  }

  /**
   * Checks whether the value has already been initialized.
   *
   * @returns true if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
