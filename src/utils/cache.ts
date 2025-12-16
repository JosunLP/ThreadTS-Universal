/**
 * ThreadTS Universal - Cache Utilities
 *
 * Gemeinsame Cache-Implementierungen für Decorators.
 * Folgt dem DRY-Prinzip durch Extraktion gemeinsamer Cache-Logik.
 *
 * @module utils/cache
 * @author ThreadTS Universal Team
 */

/**
 * Eintrag im Cache mit Wert und optionalem Ablaufdatum.
 *
 * @template T - Typ des gecachten Wertes
 */
export interface CacheEntry<T> {
  /** Der gecachte Wert */
  value: T;
  /** Ablaufzeitpunkt in Millisekunden (optional) */
  expiry?: number;
}

/**
 * Konfiguration für den LRU-Cache.
 */
export interface LRUCacheConfig {
  /** Maximale Anzahl der Einträge im Cache */
  maxSize: number;
  /** Time-to-Live in Millisekunden (optional, 0 = kein Ablauf) */
  ttlMs?: number;
}

/**
 * LRU (Least Recently Used) Cache Implementierung.
 *
 * Features:
 * - Begrenzte Größe mit automatischer Eviction
 * - Optionale TTL (Time-to-Live) für Einträge
 * - Effiziente O(1) Operationen durch Map-basierte Implementierung
 *
 * @template K - Typ des Schlüssels
 * @template V - Typ des Wertes
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, number>({ maxSize: 100, ttlMs: 60000 });
 * cache.set('key1', 42);
 * const value = cache.get('key1'); // 42
 * ```
 */
export class LRUCache<K, V> {
  /** Interne Map für Cache-Einträge */
  private readonly cache: Map<K, CacheEntry<V>>;

  /** Maximale Cache-Größe */
  private readonly maxSize: number;

  /** Time-to-Live in Millisekunden (0 = kein Ablauf) */
  private readonly ttlMs: number;

  /**
   * Erstellt einen neuen LRU-Cache.
   *
   * @param config - Cache-Konfiguration
   */
  constructor(config: LRUCacheConfig) {
    this.cache = new Map();
    this.maxSize = Math.max(1, config.maxSize);
    this.ttlMs = config.ttlMs ?? 0;
  }

  /**
   * Holt einen Wert aus dem Cache.
   *
   * Aktualisiert die LRU-Ordnung (zuletzt verwendet -> Ende der Map).
   * Gibt undefined zurück, wenn der Schlüssel nicht existiert oder abgelaufen ist.
   *
   * @param key - Der Schlüssel
   * @returns Der gecachte Wert oder undefined
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Prüfe auf Ablauf
    if (entry.expiry !== undefined && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // LRU-Update: Eintrag ans Ende verschieben
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Speichert einen Wert im Cache.
   *
   * Bei Erreichen der maximalen Größe wird der älteste Eintrag entfernt.
   *
   * @param key - Der Schlüssel
   * @param value - Der zu speichernde Wert
   */
  set(key: K, value: V): void {
    // Wenn Schlüssel bereits existiert, entfernen (für korrekte LRU-Ordnung)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    // Eviction bei voller Kapazität
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    // Neuen Eintrag hinzufügen
    const entry: CacheEntry<V> = {
      value,
      expiry: this.ttlMs > 0 ? Date.now() + this.ttlMs : undefined,
    };
    this.cache.set(key, entry);
  }

  /**
   * Prüft, ob ein Schlüssel im Cache existiert und gültig ist.
   *
   * @param key - Der Schlüssel
   * @returns true wenn der Schlüssel existiert und nicht abgelaufen ist
   */
  has(key: K): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Prüfe auf Ablauf
    if (entry.expiry !== undefined && Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Entfernt einen Eintrag aus dem Cache.
   *
   * @param key - Der zu entfernende Schlüssel
   * @returns true wenn der Schlüssel existierte und entfernt wurde
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Leert den gesamten Cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gibt die aktuelle Anzahl der Einträge zurück.
   *
   * @returns Anzahl der Einträge im Cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Entfernt alle abgelaufenen Einträge aus dem Cache.
   *
   * Diese Methode wird nicht automatisch aufgerufen, um Performance
   * bei get/set nicht zu beeinträchtigen. Kann bei Bedarf manuell
   * aufgerufen werden (z.B. periodisch).
   *
   * @returns Anzahl der entfernten Einträge
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
   * Gibt Cache-Statistiken zurück.
   *
   * @returns Objekt mit Cache-Statistiken
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
 * Cache-Statistiken.
 */
export interface CacheStats {
  /** Aktuelle Anzahl der Einträge */
  size: number;
  /** Maximale Anzahl der Einträge */
  maxSize: number;
  /** Time-to-Live in Millisekunden */
  ttlMs: number;
}

/**
 * Erstellt einen String-Schlüssel aus Funktionsargumenten.
 *
 * Verwendet JSON.stringify für serialisierbare Argumente.
 * Warnung: Funktionen und zirkuläre Referenzen werden nicht unterstützt.
 *
 * @param args - Die zu serialisierenden Argumente
 * @returns Ein String-Schlüssel für den Cache
 *
 * @example
 * ```typescript
 * const key = createCacheKey([1, 'test', { a: 1 }]);
 * // '[[1,"test",{"a":1}]]' oder ähnlich
 * ```
 */
export function createCacheKey(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    // Fallback für nicht-serialisierbare Werte
    return args.map((arg) => String(arg)).join('::');
  }
}

/**
 * Lazy-Initialisierungszustand.
 *
 * Verwaltet den Zustand für einmalige Initialisierung mit
 * Unterstützung für parallele Aufrufe während der Initialisierung.
 *
 * @template T - Typ des initialisierten Wertes
 */
export class LazyInitializer<T> {
  /** Der initialisierte Wert */
  private value: T | undefined = undefined;

  /** Ob die Initialisierung abgeschlossen ist */
  private initialized = false;

  /** Promise für laufende Initialisierung (verhindert Race-Conditions) */
  private initializing: Promise<T> | null = null;

  /**
   * Holt den Wert, initialisiert bei Bedarf.
   *
   * Bei parallelen Aufrufen während der Initialisierung wird das
   * gleiche Promise zurückgegeben, um doppelte Initialisierung zu verhindern.
   *
   * @param initializer - Funktion zur Initialisierung des Wertes
   * @returns Promise mit dem initialisierten Wert
   */
  async get(initializer: () => Promise<T>): Promise<T> {
    // Bereits initialisiert?
    if (this.initialized) {
      return this.value as T;
    }

    // Initialisierung läuft bereits?
    if (this.initializing !== null) {
      return this.initializing;
    }

    // Starte neue Initialisierung
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
   * Setzt den Lazy-Zustand zurück.
   *
   * Nach dem Reset wird beim nächsten Aufruf von get()
   * die Initialisierung erneut durchgeführt.
   */
  reset(): void {
    this.value = undefined;
    this.initialized = false;
    this.initializing = null;
  }

  /**
   * Prüft, ob der Wert bereits initialisiert wurde.
   *
   * @returns true wenn initialisiert
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
