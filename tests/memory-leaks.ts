/**
 * ThreadTS Universal - Memory Leak Detection Tests
 * Automatisierte Überwachung auf Memory-Leaks im Worker-Pool
 */

import { ThreadTS } from '../src/core/threadjs';

describe('Memory Leak Detection', () => {
  let threadjs: ThreadTS;
  let initialMemory: number;

  beforeEach(() => {
    threadjs = ThreadTS.getInstance();
    // Baseline Memory-Usage ermitteln
    if (typeof process !== 'undefined' && process.memoryUsage) {
      initialMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      initialMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      initialMemory = 0;
    }
  });

  afterEach(async () => {
    // Cleanup nach jedem Test
    await threadjs.terminate();

    // Force Garbage Collection wenn verfügbar
    if (typeof global !== 'undefined' && (global as any).gc) {
      (global as any).gc();
    }
  });

  it('should not leak memory after multiple worker executions', async () => {
    const iterations = 100;

    // Mehrfache Worker-Ausführung
    for (let i = 0; i < iterations; i++) {
      await threadjs.run((x: number) => x * 2, i);
    }

    // Memory-Usage nach Verarbeitung prüfen
    let finalMemory: number;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      finalMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      finalMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      finalMemory = 0;
    }

    // Memory-Increase sollte minimal sein (< 5MB)
    const memoryIncrease = finalMemory - initialMemory;
    const maxAllowedIncrease = 5 * 1024 * 1024; // 5MB

    expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
  });

  it('should clean up worker pool properly', async () => {
    // Worker-Pool mit mehreren Aufgaben belasten
    const tasks = Array.from({ length: 50 }, (_, i) =>
      threadjs.run((x: number) => x ** 2, i)
    );

    await Promise.all(tasks);

    // Pool-Statistiken prüfen
    const stats = threadjs.getStats();
    expect(stats.activeWorkers).toBe(0);
    expect(stats.idleWorkers).toBeGreaterThanOrEqual(0);
  });

  it('should handle worker termination gracefully', async () => {
    // Worker starten
    const task1 = threadjs.run((x: number) => x * 2, 10);
    const task2 = threadjs.run((x: number) => x * 3, 20);

    // Während Ausführung terminieren
    const terminatePromise = threadjs.terminate();

    // Tasks sollten graceful abgebrochen werden
    await expect(
      Promise.all([task1, task2, terminatePromise])
    ).resolves.toBeDefined();
  });

  it('should prevent circular reference memory leaks', async () => {
    // Objekt mit zirkulären Referenzen erstellen
    const circularObj: any = { name: 'test' };
    circularObj.self = circularObj;

    // Worker sollte mit Serialization-Error fehlschlagen
    await expect(
      threadjs.run((obj: any) => obj.name, circularObj)
    ).rejects.toThrow();

    // Memory sollte nicht geleakt sein
    const stats = threadjs.getStats();
    expect(stats.activeWorkers).toBe(0);
  });

  it('should handle large data transfers without memory buildup', async () => {
    // Große Arrays verarbeiten (10MB)
    const largeArray = new Array(1_000_000).fill(0).map((_, i) => i);

    for (let i = 0; i < 10; i++) {
      await threadjs.run(
        (arr: number[]) => arr.reduce((a, b) => a + b, 0),
        largeArray
      );
    }

    // Memory-Usage sollte stabil bleiben
    let currentMemory: number;
    if (typeof process !== 'undefined' && process.memoryUsage) {
      currentMemory = process.memoryUsage().heapUsed;
    } else if (
      typeof performance !== 'undefined' &&
      (performance as any).memory
    ) {
      currentMemory = (performance as any).memory.usedJSHeapSize;
    } else {
      currentMemory = 0;
    }

    const memoryIncrease = currentMemory - initialMemory;
    const maxAllowedIncrease = 50 * 1024 * 1024; // 50MB für große Arrays

    expect(memoryIncrease).toBeLessThan(maxAllowedIncrease);
  });
});
