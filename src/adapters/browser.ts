/**
 * ThreadJS Universal - Browser Worker Adapter
 */

import {
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
  WorkerInstance,
} from '../types';
import { getHighResTimestamp } from '../utils/platform';
import { createWorkerScript } from '../utils/serialization';

export class BrowserWorkerAdapter implements WorkerAdapter {
  readonly platform = 'browser' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new BrowserWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    return (
      typeof Worker !== 'undefined' &&
      typeof Blob !== 'undefined' &&
      typeof URL !== 'undefined'
    );
  }
}

class BrowserWorkerInstance implements WorkerInstance {
  readonly id: string;
  private worker: Worker | null = null;
  private isTerminated = false;
  private isExecuting = false;

  constructor(private script: string) {
    this.id = `browser-worker-${Math.random().toString(36).substr(2, 9)}`;
  }

  async execute<T = any>(
    fn: Function,
    data: any,
    options: ThreadOptions = {}
  ): Promise<ThreadResult<T>> {
    if (this.isTerminated) {
      throw new WorkerError('Worker has been terminated');
    }

    if (this.isExecuting) {
      throw new WorkerError('Worker is already executing a task');
    }

    this.isExecuting = true;
    const startTime = getHighResTimestamp();

    try {
      // Create worker script
      const workerScript = createWorkerScript(fn, data, {
        timeout: options.timeout,
      });

      // Create blob URL for worker
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);

      return await new Promise<ThreadResult<T>>((resolve, reject) => {
        let timeoutId: number | undefined;
        let isResolved = false;

        // Create worker
        this.worker = new Worker(workerUrl);

        // Set up abort signal
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(workerUrl, timeoutId);
              reject(new WorkerError('Operation was aborted'));
            }
          });
        }

        // Set up timeout
        if (options.timeout) {
          timeoutId = window.setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(workerUrl, timeoutId);
              reject(
                new WorkerError(
                  `Operation timed out after ${options.timeout}ms`
                )
              );
            }
          }, options.timeout);
        }

        // Handle worker messages
        this.worker.onmessage = (event) => {
          if (isResolved) return;
          isResolved = true;

          const { result, error, executionTime } = event.data;

          this.cleanup(workerUrl, timeoutId);

          if (error) {
            reject(new WorkerError(error));
          } else {
            resolve({
              result,
              executionTime: executionTime || getHighResTimestamp() - startTime,
              workerId: this.id,
            });
          }
        };

        // Handle worker errors
        this.worker.onerror = (event) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(workerUrl, timeoutId);
          reject(new WorkerError(`Worker error: ${event.message}`));
        };

        // Transfer data if transferable objects are present
        if (options.transferable && options.transferable.length > 0) {
          this.worker.postMessage(data, options.transferable);
        } else {
          this.worker.postMessage(data);
        }
      });
    } finally {
      this.isExecuting = false;
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isTerminated = true;
  }

  isIdle(): boolean {
    return !this.isExecuting && !this.isTerminated;
  }

  private cleanup(workerUrl: string, timeoutId?: number): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    URL.revokeObjectURL(workerUrl);
  }
}
