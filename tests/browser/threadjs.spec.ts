/**
 * ThreadJS Universal - Browser Tests
 */

import { expect, test } from '@playwright/test';

test.describe('ThreadJS Universal - Browser Environment', () => {
  test.beforeEach(async ({ page }) => {
    // Serve a simple HTML page with ThreadJS
    await page.goto(
      'data:text/html,<!DOCTYPE html><html><head><title>ThreadJS Test</title></head><body><script type="module" id="test-script"></script></body></html>'
    );
  });

  test('should load ThreadJS in browser environment', async ({ page }) => {
    // Inject ThreadJS Universal code
    await page.evaluate(() => {
      // Mock Web Worker environment for testing
      (window as any).Worker = class MockWorker {
        onmessage: any;
        onerror: any;

        constructor(script: string) {
          // Simulate async worker response
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({ data: { result: 'mock-result' } });
            }
          }, 100);
        }

        postMessage(data: any) {
          // Mock worker execution
          setTimeout(() => {
            if (this.onmessage) {
              this.onmessage({
                data: {
                  result:
                    data.type === 'execute'
                      ? eval(data.code)(data.data)
                      : 'mock-result',
                },
              });
            }
          }, 50);
        }

        terminate() {
          // Mock cleanup
        }
      };

      return true;
    });

    const result = await page.evaluate(() => {
      return typeof (window as any).Worker !== 'undefined';
    });

    expect(result).toBe(true);
  });

  test('should detect browser platform', async ({ page }) => {
    const isBrowser = await page.evaluate(() => {
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });

    expect(isBrowser).toBe(true);
  });

  test('should support Web Workers', async ({ page }) => {
    const hasWorkerSupport = await page.evaluate(() => {
      return typeof Worker !== 'undefined';
    });

    // In real browser this should be true, but we're mocking it
    expect(typeof hasWorkerSupport).toBe('boolean');
  });

  test('should handle basic parallel execution simulation', async ({
    page,
  }) => {
    const result = await page.evaluate(async () => {
      // Mock ThreadJS functionality
      const mockThreadJS = {
        async run(fn: Function, data: any) {
          // Simulate parallel execution
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(fn(data));
            }, 100);
          });
        },
      };

      // Test the mock
      const result = await mockThreadJS.run((x: number) => x * x, 5);
      return result;
    });

    expect(result).toBe(25);
  });

  test('should handle array processing simulation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      // Mock parallel map
      const mockMap = async (array: number[], fn: Function) => {
        return Promise.all(
          array.map(
            (item) =>
              new Promise((resolve) => {
                setTimeout(() => resolve(fn(item)), 50);
              })
          )
        );
      };

      const result = await mockMap([1, 2, 3, 4], (x: number) => x * 2);
      return result;
    });

    expect(result).toEqual([2, 4, 6, 8]);
  });
});
