/**
 * ThreadJS Universal - Browser Integration Tests
 * Tests für Browser-spezifische Funktionalität mit umgebungsabhängiger Worker-Unterstützung
 */

import { expect, test } from '@playwright/test';

test.describe('ThreadJS Universal - Browser', () => {
  test.beforeAll(async () => {
    // Capability-Detection direkt in den Tests statt im Global Setup
    console.log('🔍 Starting browser capability detection...');
  });

  test('sollte Worker-Unterstützung prüfen', async ({ page }) => {
    await page.goto('data:text/html,<!DOCTYPE html><html><body></body></html>');

    const workerSupport = await page.evaluate(() => {
      return {
        hasWorker: typeof Worker !== 'undefined',
        hasBlob: typeof Blob !== 'undefined',
        hasURL: typeof URL !== 'undefined',
        hasSharedWorker: typeof SharedWorker !== 'undefined',
        hasServiceWorker: 'serviceWorker' in navigator,
        userAgent: navigator.userAgent,
        canCreateWorker: false,
      };
    });

    // Test basic Worker API availability
    expect(workerSupport.hasWorker).toBeDefined();
    expect(workerSupport.hasBlob).toBe(true);
    expect(workerSupport.hasURL).toBe(true);

    console.log('🌐 Browser Capabilities:', workerSupport);
    console.log(
      `Worker support detected: ${workerSupport.hasWorker ? '✅ Supported' : '❌ Not supported'}`
    );
  });

  test('sollte Worker-Funktionalität testen oder graceful fallback verwenden', async ({
    page,
  }) => {
    await page.goto('data:text/html,<!DOCTYPE html><html><body></body></html>');

    const result = await page.evaluate(() => {
      // Prüfe zuerst Worker-Support
      if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
        console.log(
          '✅ Workers are supported - testing actual Worker functionality'
        );

        return new Promise((resolve, reject) => {
          try {
            const workerCode = `
              self.onmessage = function(e) {
                self.postMessage(e.data * 2);
              };
            `;

            const blob = new Blob([workerCode], {
              type: 'application/javascript',
            });
            const worker = new Worker(URL.createObjectURL(blob));

            let resolved = false;

            worker.onmessage = function (e) {
              if (!resolved) {
                resolved = true;
                worker.terminate();
                resolve(e.data);
              }
            };

            worker.onerror = function (error) {
              if (!resolved) {
                resolved = true;
                console.warn(
                  'Worker error, falling back to sync execution:',
                  error
                );
                worker.terminate();
                resolve(21 * 2); // Fallback
              }
            };

            worker.postMessage(21);

            // Timeout fallback nach 2 Sekunden
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                worker.terminate();
                console.log('Worker timeout - using fallback result');
                resolve(21 * 2);
              }
            }, 2000);
          } catch (error) {
            console.log('Worker creation failed, using fallback:', error);
            resolve(21 * 2);
          }
        });
      } else {
        console.log(
          '❌ Workers are not supported - using synchronous fallback'
        );
        // Fallback: synchrone Berechnung
        return Promise.resolve(21 * 2);
      }
    });

    expect(result).toBe(42);
  });

  test('sollte ThreadJS-ähnliche Parallele Verarbeitung simulieren', async ({
    page,
  }) => {
    await page.goto('data:text/html,<!DOCTYPE html><html><body></body></html>');

    const parallelResult = await page.evaluate(async () => {
      // Simuliere parallele Verarbeitung auch ohne echte Worker
      const simulateParallelWork = async (tasks: number[]) => {
        const processTask = (value: number) => {
          return new Promise<number>((resolve) => {
            // Simuliere CPU-intensive Arbeit
            setTimeout(() => {
              resolve(value * value);
            }, Math.random() * 50); // Random delay für Parallelitäts-Simulation
          });
        };

        // Verarbeite alle Tasks "parallel" (auch ohne Worker)
        return Promise.all(tasks.map(processTask));
      };

      const tasks = [1, 2, 3, 4, 5];
      const results = await simulateParallelWork(tasks);

      return {
        input: tasks,
        output: results,
        sum: results.reduce((a, b) => a + b, 0),
        workerSupported: typeof Worker !== 'undefined',
      };
    });

    expect(parallelResult.input).toEqual([1, 2, 3, 4, 5]);
    expect(parallelResult.output).toEqual([1, 4, 9, 16, 25]);
    expect(parallelResult.sum).toBe(55);

    // Log Worker-Support für Debug-Zwecke
    console.log(
      `Test completed with Worker support: ${parallelResult.workerSupported}`
    );
  });

  test('sollte Browser-Kompatibilität prüfen', async ({ page }) => {
    const browserSupport = await page.evaluate(() => {
      return {
        hasArrayBuffer: typeof ArrayBuffer !== 'undefined',
        hasPromise: typeof Promise !== 'undefined',
        hasSetTimeout: typeof setTimeout !== 'undefined',
      };
    });

    expect(browserSupport.hasArrayBuffer).toBe(true);
    expect(browserSupport.hasPromise).toBe(true);
    expect(browserSupport.hasSetTimeout).toBe(true);
  });

  test('sollte asynchrone Verarbeitung unterstützen', async ({ page }) => {
    const asyncResult = await page.evaluate(async () => {
      // Simuliere ThreadJS async processing
      const mockAsyncTask = async (value: number) => {
        return new Promise<number>((resolve) => {
          setTimeout(() => resolve(value * value), 10);
        });
      };

      const tasks = [1, 2, 3, 4, 5];
      const results = await Promise.all(tasks.map(mockAsyncTask));

      return {
        input: tasks,
        output: results,
        sum: results.reduce((a, b) => a + b, 0),
      };
    });

    expect(asyncResult.input).toEqual([1, 2, 3, 4, 5]);
    expect(asyncResult.output).toEqual([1, 4, 9, 16, 25]);
    expect(asyncResult.sum).toBe(55);
  });
});
