/**
 * ThreadJS Universal - Node.js Worker Adapter
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

export class NodeWorkerAdapter implements WorkerAdapter {
  readonly platform = 'node' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new NodeWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    try {
      const nodeRequire = (globalThis as any).require;
      if (nodeRequire) {
        nodeRequire('worker_threads');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

class NodeWorkerInstance implements WorkerInstance {
  readonly id: string;
  private worker: any = null;
  private isTerminated = false;
  private isExecuting = false;
  private workerThreads: any = null;

  constructor(private script: string) {
    this.id = `node-worker-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const nodeRequire = (globalThis as any).require;
      if (nodeRequire) {
        this.workerThreads = nodeRequire('worker_threads');
      }
    } catch (error) {
      throw new WorkerError(
        'Worker threads not available in this Node.js environment'
      );
    }
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

    if (!this.workerThreads) {
      throw new WorkerError('Worker threads not available');
    }

    this.isExecuting = true;
    const startTime = getHighResTimestamp();

    try {
      // Create worker script
      const workerScript = createWorkerScript(fn, data, {
        timeout: options.timeout,
      });

      return await new Promise<ThreadResult<T>>((resolve, reject) => {
        let timeoutId: number | undefined;
        let isResolved = false;

        // Create worker
        this.worker = new this.workerThreads.Worker(workerScript, {
          eval: true,
          transferList: options.transferable || [],
        });

        // Set up abort signal
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(timeoutId);
              reject(new WorkerError('Operation was aborted'));
            }
          });
        }

        // Set up timeout
        if (options.timeout) {
          timeoutId = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              this.cleanup(timeoutId);
              reject(
                new WorkerError(
                  `Operation timed out after ${options.timeout}ms`
                )
              );
            }
          }, options.timeout) as any;
        }

        // Handle worker messages
        this.worker.on('message', (event: any) => {
          if (isResolved) return;
          isResolved = true;

          const { result, error, executionTime } = event;

          this.cleanup(timeoutId);

          if (error) {
            reject(new WorkerError(error));
          } else {
            resolve({
              result,
              executionTime: executionTime || getHighResTimestamp() - startTime,
              workerId: this.id,
            });
          }
        });

        // Handle worker errors
        this.worker.on('error', (error: Error) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(timeoutId);
          reject(new WorkerError(`Worker error: ${error.message}`, error));
        });

        // Handle worker exit
        this.worker.on('exit', (code: number) => {
          if (isResolved) return;
          if (code !== 0) {
            isResolved = true;
            this.cleanup(timeoutId);
            reject(new WorkerError(`Worker stopped with exit code ${code}`));
          }
        });

        // Send data to worker
        this.worker.postMessage(data, options.transferable);
      });
    } finally {
      this.isExecuting = false;
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.isTerminated = true;
  }

  isIdle(): boolean {
    return !this.isExecuting && !this.isTerminated;
  }

  private cleanup(timeoutId?: number): void {
    if (this.worker) {
      this.worker.terminate().catch(() => {
        // Ignore termination errors
      });
      this.worker = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
