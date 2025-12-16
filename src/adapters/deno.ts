/**
 * ThreadTS Universal - Deno Worker Adapter
 *
 * Implementiert Worker-Unterstützung für Deno-Umgebungen.
 * Nutzt Deno-spezifische Features wie Permission-Control und Modul-Worker.
 *
 * @module adapters/deno
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Deno-Worker-Optionen mit Permission-Kontrolle.
 *
 * Ermöglicht feingranulare Zugriffsrechte für Worker.
 */
interface DenoWorkerOptions extends WorkerOptions {
  /** Deno-spezifische Einstellungen */
  deno?: {
    /** Permission-Konfiguration für den Worker */
    permissions?: DenoWorkerPermissions;
    /** Ob Deno-Namespace im Worker verfügbar sein soll */
    namespace?: boolean;
  };
}

/**
 * Deno Permission-Konfiguration.
 *
 * Jede Permission kann:
 * - `true`: Vollzugriff
 * - `false`: Kein Zugriff
 * - `string[]`: Zugriff auf spezifische Ressourcen
 */
interface DenoWorkerPermissions {
  /** Netzwerkzugriff */
  net?: boolean | string[];
  /** Dateisystem-Lesezugriff */
  read?: boolean | string[];
  /** Dateisystem-Schreibzugriff */
  write?: boolean | string[];
  /** Umgebungsvariablen */
  env?: boolean | string[];
  /** Subprozess-Ausführung */
  run?: boolean | string[];
  /** Foreign Function Interface */
  ffi?: boolean | string[];
  /** High-Resolution Timer */
  hrtime?: boolean;
  /** System-Informationen */
  sys?: boolean | string[];
}

/**
 * Deno-Namespace Interface für Typprüfung.
 */
interface DenoNamespace {
  permissions: {
    query(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
    request(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
    revoke(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  };
  version: {
    deno: string;
    v8: string;
    typescript: string;
  };
  build: {
    target: string;
    arch: string;
    os: string;
    vendor: string;
    env?: string;
  };
  env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    has(key: string): boolean;
    toObject(): Record<string, string>;
  };
}

/**
 * Worker-Adapter für Deno-Umgebungen.
 *
 * Unterstützt:
 * - Modul-Worker (ES Module Syntax)
 * - Feingranulare Permission-Kontrolle
 * - Sandbox-Isolation
 *
 * @extends AbstractWorkerAdapter
 *
 * @example
 * ```typescript
 * const adapter = new DenoWorkerAdapter();
 * console.log(adapter.getDenoVersion()); // "1.40.0"
 * const worker = await adapter.createWorker('');
 * ```
 */
export class DenoWorkerAdapter extends AbstractWorkerAdapter {
  readonly platform = 'deno' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new DenoWorkerInstance(script);
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
        'undefined' && typeof Worker !== 'undefined'
    );
  }

  /**
   * Gibt die Deno-Versionsinformationen zurück.
   *
   * @returns Deno-Version oder null wenn nicht verfügbar
   *
   * @example
   * ```typescript
   * const version = adapter.getDenoVersion();
   * console.log(version); // "1.40.0"
   * ```
   */
  getDenoVersion(): string | null {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    return deno?.version.deno || null;
  }

  /**
   * Prüft ob eine spezifische Permission gewährt wurde.
   *
   * @param name - Permission-Name (z.B. 'read', 'write', 'net')
   * @param descriptor - Optionaler Permission-Deskriptor für spezifische Ressourcen
   * @returns true wenn Permission gewährt
   *
   * @example
   * ```typescript
   * if (await adapter.checkPermission('read')) {
   *   // Dateisystem lesen erlaubt
   * }
   * ```
   */
  async checkPermission(
    name: string,
    descriptor?: PermissionDescriptor
  ): Promise<boolean> {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    if (!deno) return false;

    try {
      const status = await deno.permissions.query(
        descriptor || ({ name } as PermissionDescriptor)
      );
      return status.state === 'granted';
    } catch {
      return false;
    }
  }
}

/**
 * Deno-Worker-Instanz.
 *
 * Erweitert AbstractWebWorkerInstance mit Deno-spezifischen Features:
 * - Permission-Isolation (minimal by default)
 * - Modul-Worker-Support
 * - Kein Deno-Namespace im Worker (Sandbox)
 *
 * @extends AbstractWebWorkerInstance
 */
class DenoWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Erstellt eine neue Deno-Worker-Instanz.
   *
   * @param _script - Initiales Script (wird bei execute() überschrieben)
   */
  constructor(_script: string) {
    super('deno', {
      workerName: undefined, // Wird automatisch generiert
      workerType: 'module', // Deno bevorzugt Module-Worker
    });
  }

  /**
   * Erstellt Deno-spezifische Worker-Optionen.
   *
   * Konfiguriert minimale Permissions für maximale Sicherheit:
   * - Nur hrtime für Performance-Messung erlaubt
   * - Kein Netzwerk-, Dateisystem- oder Subprozess-Zugriff
   * - Deno-Namespace nicht exponiert (Sandbox)
   *
   * @returns DenoWorkerOptions mit Permission-Konfiguration
   */
  protected createPlatformWorkerOptions(): DenoWorkerOptions {
    return {
      type: 'module',
      name: this.id,
      deno: {
        permissions: {
          // Minimale Permissions für Sicherheit
          net: false,
          read: false,
          write: false,
          env: false,
          run: false,
          ffi: false,
          hrtime: true, // Für Performance-Monitoring
          sys: false,
        },
        namespace: false, // Deno-Namespace nicht im Worker exponieren
      },
    };
  }

  /**
   * Gibt Deno-spezifische Worker-Informationen zurück.
   *
   * @returns Objekt mit Worker-ID, Deno-Version und aktiven Permissions
   *
   * @example
   * ```typescript
   * const info = worker.getWorkerInfo();
   * console.log(info.denoVersion); // "1.40.0"
   * console.log(info.permissions); // ["hrtime"]
   * ```
   */
  getWorkerInfo(): {
    id: string;
    denoVersion: string | null;
    permissions: string[];
  } {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    return {
      id: this.id,
      denoVersion: deno?.version.deno || null,
      permissions: ['hrtime'], // Aktuell gewährte Permissions
    };
  }

  /**
   * Prüft ob die Deno-API im Worker-Kontext verfügbar ist.
   *
   * @returns true wenn Deno-Namespace verfügbar
   */
  hasDenoAPI(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
      'undefined'
    );
  }
}
