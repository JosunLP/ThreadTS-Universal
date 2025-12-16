/**
 * ThreadTS Universal - Caching Decorators
 *
 * Decorators für Caching und Memoization von Methodenergebnissen.
 * Unterstützt sowohl Legacy (experimentalDecorators) als auch Stage-3 Decorator-Syntax.
 *
 * Verwendet die gemeinsame LRUCache-Klasse für konsistentes Caching-Verhalten
 * und folgt dem DRY-Prinzip (Don't Repeat Yourself).
 *
 * @module decorators/caching
 * @author ThreadTS Universal Team
 */

import { createCacheKey, LazyInitializer, LRUCache } from '../utils/cache';
import { createMethodDecorator } from './utils';

/**
 * Typ für erweiterte Methoden mit Cache-Kontrolle.
 */
export interface CacheableMethod {
  /** Leert den Cache der Methode */
  clearCache?: () => void;
  /** Gibt Cache-Statistiken zurück */
  getCacheStats?: () => { size: number; maxSize: number };
}

/**
 * Typ für erweiterte Methoden mit Reset-Funktion.
 */
export interface LazyMethod {
  /** Setzt den Lazy-Zustand zurück */
  reset?: () => void;
  /** Prüft ob bereits initialisiert */
  isInitialized?: () => boolean;
}

/**
 * Decorator für Memoization mit optionalem Cache-Größenlimit.
 *
 * Cacht Methodenergebnisse basierend auf den Argumenten. Bei gleichem
 * Aufruf wird das gecachte Ergebnis zurückgegeben. Verwendet LRU
 * (Least Recently Used) Eviction bei Erreichen der maximalen Größe.
 *
 * @param maxCacheSize - Maximale Anzahl gecachter Einträge (Standard: 100)
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class Calculator {
 *   @memoize(50) // Cache für max 50 Eingaben
 *   async computeExpensive(input: number): Promise<number> {
 *     // Teure Berechnung...
 *     return result;
 *   }
 * }
 * ```
 */
export function memoize(maxCacheSize: number = 100) {
  // Verwende die gemeinsame LRUCache-Klasse
  const lruCache = new LRUCache<string, unknown>({
    maxSize: maxCacheSize,
    ttlMs: 0, // Kein Ablauf bei memoize
  });

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      const key = createCacheKey(args);

      // Cache-Hit prüfen
      if (lruCache.has(key)) {
        return lruCache.get(key);
      }

      // Methode ausführen und cachen
      const result = await originalMethod.apply(this, args);
      lruCache.set(key, result);
      return result;
    };

    // Erweitere Methode mit Cache-Kontrollfunktionen
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
 * Decorator für Caching mit TTL (Time To Live) Unterstützung.
 *
 * Ähnlich wie memoize, aber mit automatischem Ablauf der Cache-Einträge.
 * Ideal für Daten, die sich periodisch ändern können.
 *
 * @param ttlMs - Time-to-Live in Millisekunden (Standard: 60000 = 1 Minute)
 * @param maxSize - Maximale Cache-Größe (Standard: 100)
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class DataService {
 *   @cache(30000, 50) // Cache für 30 Sekunden, max 50 Einträge
 *   async fetchData(id: string): Promise<Data> {
 *     return await api.getData(id);
 *   }
 *
 *   refreshData(id: string) {
 *     // Manuelles Leeren bei Bedarf
 *     (this.fetchData as any).clearCache();
 *   }
 * }
 * ```
 */
export function cache(ttlMs: number = 60000, maxSize: number = 100) {
  // Verwende die gemeinsame LRUCache-Klasse mit TTL
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

      // Cache-Hit prüfen (LRUCache behandelt Ablauf automatisch)
      const cached = lruCache.get(key);
      if (cached !== undefined) {
        return cached;
      }

      // Methode ausführen und cachen
      const result = await originalMethod.apply(this, args);
      lruCache.set(key, result);
      return result;
    };

    // Erweitere Methode mit Cache-Kontrollfunktionen
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
 * Decorator für Lazy-Initialisierung.
 *
 * Die Methode wird nur einmal beim ersten Aufruf ausgeführt.
 * Alle nachfolgenden Aufrufe geben das gespeicherte Ergebnis zurück.
 * Unterstützt parallele Aufrufe während der Initialisierung ohne
 * Race-Conditions.
 *
 * @returns Method Decorator
 *
 * @example
 * ```typescript
 * class ConfigService {
 *   @lazy()
 *   async loadConfig(): Promise<Config> {
 *     console.log('Loading config...'); // Wird nur einmal ausgegeben
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
  // Verwende die gemeinsame LazyInitializer-Klasse
  const initializer = new LazyInitializer<unknown>();

  return createMethodDecorator((originalMethod) => {
    const wrappedMethod = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      return initializer.get(() => originalMethod.apply(this, args));
    };

    // Erweitere Methode mit Kontrollfunktionen
    const lazyMethod = wrappedMethod as typeof originalMethod & LazyMethod;
    lazyMethod.reset = () => initializer.reset();
    lazyMethod.isInitialized = () => initializer.isInitialized();

    return lazyMethod;
  });
}
