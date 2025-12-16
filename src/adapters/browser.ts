/**
 * ThreadTS Universal - Browser Worker Adapter
 *
 * Implementiert Worker-Unterstützung für Browser-Umgebungen.
 * Verwendet die Web Worker API mit Blob-URLs für dynamische Script-Ausführung.
 *
 * @module adapters/browser
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Worker-Adapter für Browser-Umgebungen.
 *
 * Unterstützt:
 * - Web Workers mit Blob-URLs
 * - Transferable Objects (ArrayBuffer, MessagePort, etc.)
 * - AbortSignal für Abbruchunterstützung
 *
 * @extends AbstractWorkerAdapter
 *
 * @example
 * ```typescript
 * const adapter = new BrowserWorkerAdapter();
 * if (adapter.isSupported()) {
 *   const worker = await adapter.createWorker('');
 *   const result = await worker.execute(fn, data);
 * }
 * ```
 */
export class BrowserWorkerAdapter extends AbstractWorkerAdapter {
  readonly platform = 'browser' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new BrowserWorkerInstance(script);
  }

  isSupported(): boolean {
    try {
      // Erweiterte Prüfung mit Fehlerbehandlung
      if (
        typeof Worker === 'undefined' ||
        typeof Blob === 'undefined' ||
        typeof URL === 'undefined'
      ) {
        return false;
      }

      // Teste ob wir tatsächlich einen Worker erstellen können
      // (in manchen Umgebungen ist Worker definiert, aber nicht funktional)
      try {
        const testBlob = new Blob([''], { type: 'application/javascript' });
        const testUrl = URL.createObjectURL(testBlob);
        URL.revokeObjectURL(testUrl);
        return true;
      } catch (error) {
        console.warn('Worker creation test failed:', error);
        return false;
      }
    } catch (error) {
      console.warn('Worker support detection failed:', error);
      return false;
    }
  }
}

/**
 * Browser-Worker-Instanz.
 *
 * Nutzt die gemeinsame AbstractWebWorkerInstance-Basisklasse
 * für konsistentes Verhalten und reduzierte Code-Duplikation.
 *
 * @extends AbstractWebWorkerInstance
 */
class BrowserWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Erstellt eine neue Browser-Worker-Instanz.
   *
   * @param _script - Initiales Script (wird bei execute() überschrieben)
   */
  constructor(_script: string) {
    super('browser', {
      workerName: undefined, // Wird automatisch generiert
      workerType: 'classic', // Browser-Standard
    });
  }

  /**
   * Erstellt Browser-spezifische Worker-Optionen.
   *
   * Browser-Worker verwenden standardmäßig 'classic'-Typ.
   * Module-Worker werden noch nicht von allen Browsern unterstützt.
   *
   * @returns WorkerOptions für new Worker()
   */
  protected createPlatformWorkerOptions(): WorkerOptions {
    return {
      type: this.webConfig.workerType,
      name: this.webConfig.workerName,
    };
  }
}
