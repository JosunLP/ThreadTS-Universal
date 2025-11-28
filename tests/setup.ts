/**
 * Test setup for ThreadTS Universal
 */


// Mock worker threads for testing environments that don't support them
(globalThis as any).Worker =
  (globalThis as any).Worker ||
  class MockWorker {
    constructor(script: string) {
      // Mock implementation
    }

    postMessage(data: any) {
      // Mock implementation
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({ data: { result: data, executionTime: 1 } });
        }
      }, 10);
    }

    terminate() {
      // Mock implementation
    }

    addEventListener(event: string, handler: Function) {
      // Mock implementation
    }

    onmessage: Function | null = null;
    onerror: Function | null = null;
  };

// Mock Node.js worker_threads
(globalThis as any).require =
  (globalThis as any).require ||
  function (module: string) {
    if (module === 'worker_threads') {
      return {
        Worker: class MockNodeWorker {
          constructor(script: string, options?: any) {
            // Mock implementation
          }

          postMessage(data: any, transferList?: any[]) {
            setTimeout(() => {
              if (this.messageHandlers) {
                this.messageHandlers.forEach((handler: Function) => {
                  handler({ result: data, executionTime: 1 });
                });
              }
            }, 10);
          }

          terminate() {
            return Promise.resolve();
          }

          on(event: string, handler: Function) {
            if (event === 'message') {
              this.messageHandlers = this.messageHandlers || [];
              this.messageHandlers.push(handler);
            }
          }

          messageHandlers: Function[] = [];
        },
      };
    }
    if (module === 'os') {
      return {
        cpus: () => [1, 2, 3, 4], // Mock 4 CPUs
      };
    }
    if (module === 'perf_hooks') {
      return {
        performance: {
          now: () => Date.now(),
        },
      };
    }
    throw new Error(`Module not found: ${module}`);
  };

// Setup global test timeout (configured in vitest.config.ts)
// vi.setConfig({ testTimeout: 30000 }) - not needed, configured in vitest.config.ts

// Mock performance.now for consistent timing
(globalThis as any).performance = (globalThis as any).performance || {
  now: () => Date.now(),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
};

// Mock URL.createObjectURL for blob worker creation
(globalThis as any).URL = (globalThis as any).URL || {
  createObjectURL: (blob: any) => 'blob:mock-url',
  revokeObjectURL: (url: string) => {
    /* mock */
  },
};

(globalThis as any).Blob =
  (globalThis as any).Blob ||
  class MockBlob {
    constructor(parts: any[], options?: any) {
      // Mock implementation
    }
  };

// Mock navigator for hardware concurrency
// In Vitest/Node environment, navigator might be read-only, so we check first
if (typeof (globalThis as any).navigator === 'undefined') {
  (globalThis as any).navigator = {
    hardwareConcurrency: 4,
  };
} else if (typeof (globalThis as any).navigator.hardwareConcurrency === 'undefined') {
  try {
    Object.defineProperty((globalThis as any).navigator, 'hardwareConcurrency', {
      value: 4,
      writable: true,
      configurable: true,
    });
  } catch {
    // Navigator is read-only in this environment, skip mocking
  }
}
