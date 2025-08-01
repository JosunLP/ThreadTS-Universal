/**
 * ThreadTS Universal - Bun Worker Adapter
 * Enhanced with Bun-specific APIs and optimizations
 */

import {
  SerializableFunction,
  ThreadOptions,
  ThreadResult,
  WorkerAdapter,
  WorkerError,
  WorkerInstance,
} from '../types';
import { getHighResTimestamp } from '../utils/platform';
import { createWorkerScript } from '../utils/serialization';

// Bun Worker API types and interfaces
interface BunWorkerOptions {
  name?: string;
  type?: 'classic' | 'module';
  credentials?: 'omit' | 'same-origin' | 'include';
}

interface BunGlobal {
  Bun: {
    version: string;
    revision: string;
    env: Record<string, string | undefined>;
    main: string;
    argv: string[];
    which(binary: string): string | null;
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
    gc(force?: boolean): void;
    nanoseconds(): number;
    allocUnsafe(size: number): Uint8Array;
    write(fd: number, data: string | Uint8Array): number;
    FileSystemRouter: new (options: { dir: string; style?: 'nextjs' }) => {
      match(pathname: string): { filePath: string; kind: string } | null;
    };
  };
}

export class BunWorkerAdapter implements WorkerAdapter {
  readonly platform = 'bun' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new BunWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as BunGlobal).Bun !== 'undefined' &&
      typeof Worker !== 'undefined'
    );
  }

  /**
   * Get Bun version information
   */
  getBunVersion(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.version || null;
  }

  /**
   * Get Bun revision
   */
  getBunRevision(): string | null {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.revision || null;
  }

  /**
   * Trigger garbage collection (Bun-specific feature)
   */
  gc(force = false): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(force);
    }
  }

  /**
   * Get high-precision nanoseconds timestamp (Bun-specific)
   */
  nanoseconds(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || Date.now() * 1000000;
  }
}

class BunWorkerInstance implements WorkerInstance {
  readonly id: string;
  private worker: Worker | null = null;
  private isTerminated = false;
  private isExecuting = false;
  private workerUrl: string | null = null;

  constructor(private script: string) {
    this.id = `bun-worker-${Math.random().toString(36).substr(2, 9)}`;
  }

  async execute<T = unknown>(
    fn: SerializableFunction,
    data: unknown,
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

      // Create blob URL for worker (Bun supports blob URLs)
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.workerUrl = URL.createObjectURL(blob);

      return await new Promise<ThreadResult<T>>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let isResolved = false;

        // Enhanced Bun worker options
        const workerOptions: BunWorkerOptions = {
          name: this.id,
          type: 'module',
          credentials: 'omit', // Security: don't include credentials
        };

        // Create worker with Bun-optimized settings
        this.worker = new Worker(this.workerUrl!, workerOptions);

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

        // Set up timeout with high precision using Bun's nanoseconds
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
          }, options.timeout);
        }

        // Handle worker messages
        this.worker.onmessage = (event) => {
          if (isResolved) return;
          isResolved = true;

          const { result, error, executionTime } = event.data as {
            result: T;
            error?: string;
            executionTime?: number;
          };

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
        };

        // Handle worker errors
        this.worker.onerror = (event) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(timeoutId);
          reject(
            new WorkerError(`Worker error: ${(event as ErrorEvent).message}`)
          );
        };

        // Handle message errors (for structured clone errors)
        this.worker.onmessageerror = (event) => {
          if (isResolved) return;
          isResolved = true;

          this.cleanup(timeoutId);
          reject(new WorkerError(`Message serialization error: ${event.type}`));
        };

        // Optimized message passing for Bun
        // Bun has better support for transferable objects
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

  private cleanup(timeoutId?: ReturnType<typeof setTimeout>): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
  }

  /**
   * Get Bun-specific worker information
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
   * Trigger garbage collection for this worker's memory
   */
  forceGC(): void {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    if (bun?.gc) {
      bun.gc(true);
    }
  }

  /**
   * Get high-precision timing using Bun's nanoseconds
   */
  getHighPrecisionTime(): number {
    const bun = (globalThis as unknown as BunGlobal).Bun;
    return bun?.nanoseconds() || performance.now() * 1000000;
  }
}
