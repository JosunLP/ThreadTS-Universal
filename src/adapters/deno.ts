/**
 * ThreadTS Universal - Deno Worker Adapter
 * Enhanced with Deno-specific APIs and features
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

// Deno Worker API types and interfaces
interface DenoWorkerOptions {
  type?: 'classic' | 'module';
  deno?: {
    permissions?: {
      net?: boolean | string[];
      read?: boolean | string[];
      write?: boolean | string[];
      env?: boolean | string[];
      run?: boolean | string[];
      ffi?: boolean | string[];
      hrtime?: boolean;
      sys?: boolean | string[];
    };
    namespace?: boolean;
  };
  name?: string;
}

interface DenoPermissions {
  query(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  request(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
  revoke(descriptor: PermissionDescriptor): Promise<PermissionStatus>;
}

interface DenoNamespace {
  permissions: DenoPermissions;
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

export class DenoWorkerAdapter implements WorkerAdapter {
  readonly platform = 'deno' as const;

  async createWorker(script: string): Promise<WorkerInstance> {
    return new DenoWorkerInstance(script);
  }

  async terminateWorker(worker: WorkerInstance): Promise<void> {
    await worker.terminate();
  }

  isSupported(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
        'undefined' && typeof Worker !== 'undefined'
    );
  }

  /**
   * Get Deno version information
   */
  getDenoVersion(): string | null {
    const deno = (globalThis as unknown as { Deno?: DenoNamespace }).Deno;
    return deno?.version.deno || null;
  }

  /**
   * Check if specific permission is granted
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

class DenoWorkerInstance implements WorkerInstance {
  readonly id: string;
  private worker: Worker | null = null;
  private isTerminated = false;
  private isExecuting = false;
  private workerUrl: string | null = null;

  constructor(private script: string) {
    this.id = `deno-worker-${Math.random().toString(36).substr(2, 9)}`;
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

      // Create blob URL for worker (Deno supports blob URLs like browsers)
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      this.workerUrl = URL.createObjectURL(blob);

      return await new Promise<ThreadResult<T>>((resolve, reject) => {
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        let isResolved = false;

        // Enhanced Deno worker options with fine-grained permissions
        const workerOptions: DenoWorkerOptions = {
          type: 'module',
          name: this.id,
          deno: {
            permissions: {
              // Minimal permissions for security
              net: false,
              read: false,
              write: false,
              env: false,
              run: false,
              ffi: false,
              hrtime: true, // Allow high-resolution timing for performance monitoring
              sys: false,
            },
            namespace: false, // Don't expose Deno namespace to worker
          },
        };

        // Create worker with enhanced security options
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
   * Get Deno-specific worker information
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
      permissions: ['hrtime'], // Currently granted permissions
    };
  }

  /**
   * Check if Deno API is available in worker context
   */
  hasDenoAPI(): boolean {
    return (
      typeof (globalThis as unknown as { Deno?: DenoNamespace }).Deno !==
      'undefined'
    );
  }
}
