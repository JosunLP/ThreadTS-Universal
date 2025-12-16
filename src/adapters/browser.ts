/**
 * ThreadTS Universal - Browser Worker Adapter
 *
 * Implements worker support for browser environments.
 * Uses the Web Worker API with blob URLs for dynamic script execution.
 *
 * @module adapters/browser
 * @author ThreadTS Universal Team
 */

import { WorkerInstance } from '../types';
import { AbstractWebWorkerInstance, AbstractWorkerAdapter } from './base';

/**
 * Worker adapter for browser environments.
 *
 * Supports:
 * - Web Workers with blob URLs
 * - Transferable Objects (ArrayBuffer, MessagePort, etc.)
 * - AbortSignal support for cancellation
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
      // Extended detection with error handling
      if (
        typeof Worker === 'undefined' ||
        typeof Blob === 'undefined' ||
        typeof URL === 'undefined'
      ) {
        return false;
      }

      // Test whether we can actually create a worker
      // (in some environments Worker is defined but not functional)
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
 * Browser worker instance.
 *
 * Uses the shared AbstractWebWorkerInstance base class
 * for consistent behavior and reduced code duplication.
 *
 * @extends AbstractWebWorkerInstance
 */
class BrowserWorkerInstance extends AbstractWebWorkerInstance {
  /**
   * Creates a new browser worker instance.
   *
   * @param _script - Initial script (overridden by execute())
   */
  constructor(_script: string) {
    super('browser', {
      workerName: undefined, // Auto-generated
      workerType: 'classic', // Browser default
    });
  }

  /**
   * Creates browser-specific worker options.
   *
   * Browser workers use 'classic' by default.
   * Module workers are not yet supported by all browsers.
   *
   * @returns WorkerOptions for new Worker()
   */
  protected createPlatformWorkerOptions(): WorkerOptions {
    return {
      type: this.webConfig.workerType,
      name: this.webConfig.workerName,
    };
  }
}
