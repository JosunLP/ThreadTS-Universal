/**
 * ThreadTS Universal - Bun Worker Adapter
 *
 * Implementiert Worker-Unterstützung für Bun-Umgebungen.
 * Nutzt Bun-spezifische Optimierungen wie High-Precision-Timing
 * und native Garbage Collection.
 *
 * @module adapters/bun
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Bun-Worker-Optionen.
 */
interface BunWorkerOptions extends WorkerOptions {
  /** Credential-Handling für Cross-Origin-Requests */
  credentials?: 'omit' | 'same-origin' | 'include';
}

/**
 * Bun-Runtime-Namespace für Typprüfung.
 *
 * Bun bietet zusätzliche APIs für Performance und System-Interaktion.
 */
interface BunGlobal {
  Bun: {
    /** Bun-Versionsnummer */
    version: string;
    /** Bun Git-Revision */
    revision: string;
    /** Umgebungsvariablen */
    env: Record<string, string | undefined>;
    /** Pfad zum Hauptmodul */
    main: string;
    /** Kommandozeilenargumente */
    argv: string[];
    /**
     * Findet ein Binary im PATH.
     * @param binary - Name des Binaries
     * @returns Vollständiger Pfad oder null
     */
    which(binary: string): string | null;
    /**
     * Führt einen Subprozess synchron aus.
     */
    spawnSync(
      cmd: string[],
      options?: {
        cwd?: string;
        env?: Record<string, string>;
        stdin?: 'pipe' | 'inherit' | 'ignore';
        stdout?: 'pipe' | 'inherit' | 'ignore';
        stderr?: 'pipe' | 'inherit' | 'ignore';
      }
    ): {
      success: boolean;
      exitCode: number | null;
      signalCode: string | null;
      stdout: Buffer;
      stderr: Buffer;
    };
    /**
     * Löst Garbage Collection aus.
     * @param force - Erzwingt sofortige Collection
     */
    gc(force?: boolean): void;
    /**
     * Gibt aktuelle Zeit in Nanosekunden zurück.
     * Höhere Präzision als performance.now()
     */
    nanoseconds(): number;
    /**
     * Allokiert unsicheren Speicher ohne Initialisierung.
     * @param size - Größe in Bytes
     */
    allocUnsafe(size: number): Uint8Array;
    /**
     * Schreibt Daten in einen File-Descriptor.
     */
    write(fd: number, data: string | Uint8Array): number;
    /**
     * File-System-Router für Next.js-Style Routing.
     */
    FileSystemRouter: new (options: { dir: string; style?: 'nextjs' }) => {
      match(pathname: string): { filePath: string; kind: string } | null;
    };
  };
}

/**
 * Worker-Adapter für Bun-Umgebungen.
 *
 * Unterstützt:
 * - High-Performance Workers mit Bun-Optimierungen
 * - Nanosekunden-präzises Timing
 * - Native Garbage Collection
 * - Modul-Worker mit ES Module Syntax
 *
 * @extends AbstractWorkerAdapter
 *
 * @example
 * ```typescript
 * const adapter = new BunWorkerAdapter();
 * console.log(adapter.getBunVersion()); // "1.0.0"
 * console.log(adapter.nanoseconds()); // 1234567890123456
 * ```
 */
export class BunWorkerAdapter extends AbstractWorkerAdapter {
  readonly platform = 'bun' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new BunWorkerInstance(script);
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as BunGlobal).Bun !== 'undefined' &&
      typeof Worker !== 'undefined'
    );
  }

  /**
   * Gibt die Bun-Versionsnummer zurück.
   *
   * @returns Bun-Version oder null wenn nicht verfügbar
   *
   * @example
   * ```typescript
   * const version = adapter.getBunVersion();
   * console.log(version); // "1.0.0"
   * ```
   */
  getBunVersion(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.version || null;
  }

  /**
   * Gibt die Bun-Git-Revision zurück.
   *
   * @returns Bun-Revision oder null wenn nicht verfügbar
   */
  getBunRevision(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.revision || null;
  }

  /**
   * Löst Garbage Collection aus (Bun-spezifisches Feature).
   *
   * Nützlich für Memory-Profiling oder nach speicherintensiven Operationen.
   *
   * @param force - Erzwingt sofortige Collection (Standard: false)
   *
   * @example
   * ```typescript
   * // Nach großer Operation:
   * adapter.gc(true);
   * ```
   */
  gc(force = false): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(force);
    }
  }

  /**
   * Gibt die aktuelle Zeit in Nanosekunden zurück.
   *
   * Höhere Präzision als performance.now() für Performance-Messungen.
   *
   * @returns Zeit in Nanosekunden
   *
   * @example
   * ```typescript
   * const start = adapter.nanoseconds();
   * // ... Operation ...
   * const duration = adapter.nanoseconds() - start;
   * console.log(`${duration / 1000000}ms`);
   * ```
   */
  nanoseconds(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || Date.now() * 1000000;
  }
}

/**
 * Bun-Worker-Instanz.
 *
 * Erweitert AbstractWebWorkerInstance mit Bun-spezifischen Features:
 * - Nanosekunden-Timing für präzise Performance-Messungen
 * - Native Garbage Collection Unterstützung
 * - Optimiertes Transferable-Object Handling
 *
 * @extends AbstractWebWorkerInstance
 */
class BunWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Erstellt eine neue Bun-Worker-Instanz.
   *
   * @param _script - Initiales Script (wird bei execute() überschrieben)
   */
  constructor(_script: string) {
    super('bun', {
      workerName: undefined, // Wird automatisch generiert
      workerType: 'module', // Bun bevorzugt Module-Worker
    });
  }

  /**
   * Erstellt Bun-spezifische Worker-Optionen.
   *
   * Konfiguriert:
   * - Modul-Worker (ES Module Syntax)
   * - credentials: 'omit' für Sicherheit
   *
   * @returns BunWorkerOptions
   */
  protected createPlatformWorkerOptions(): BunWorkerOptions {
    return {
      type: 'module',
      name: this.id,
      credentials: 'omit', // Sicherheit: Keine Credentials inkludieren
    };
  }

  /**
   * Gibt Bun-spezifische Worker-Informationen zurück.
   *
   * @returns Objekt mit Worker-ID, Bun-Version und Fähigkeiten
   *
   * @example
   * ```typescript
   * const info = worker.getWorkerInfo();
   * console.log(info.capabilities); // ['transferable-objects', ...]
   * ```
   */
  getWorkerInfo(): {
    id: string;
    bunVersion: string | null;
    bunRevision: string | null;
    capabilities: string[];
  } {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return {
      id: this.id,
      bunVersion: bun?.version || null,
      bunRevision: bun?.revision || null,
      capabilities: [
        'transferable-objects',
        'blob-urls',
        'module-workers',
        'high-precision-timing',
        'garbage-collection',
      ],
    };
  }

  /**
   * Erzwingt Garbage Collection für diesen Worker.
   *
   * Nutzt Buns native GC-API für sofortige Speicherfreigabe.
   */
  forceGC(): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(true);
    }
  }

  /**
   * Gibt Zeit mit hoher Präzision in Nanosekunden zurück.
   *
   * Nutzt Buns nanoseconds() für maximale Präzision.
   *
   * @returns Zeit in Nanosekunden
   */
  getHighPrecisionTime(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || performance.now() * 1000000;
  }
}
