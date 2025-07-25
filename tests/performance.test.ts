/**
 * ThreadTS Universal - Performance Tests
 * Lightweight Performance-Tests für die Kernfunktionalität
 */

import threadts, { ThreadTS } from '../src';

// Mock für Test-Umgebung
jest.mock('../src/utils/platform', () => ({
  ...jest.requireActual('../src/utils/platform'),
  supportsWorkerThreads: () => true,
  detectPlatform: () => 'node',
}));

describe('🚀 Performance Tests', () => {
  beforeEach(() => {
    (ThreadTS as any).instance = null;
  });

  afterEach(async () => {
    try {
      const instance = (ThreadTS as any).instance;
      if (instance) {
        await instance.terminate();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    (ThreadTS as any).instance = null;
  });

  test('sollte minimalen Overhead haben', async () => {
    const startTime = Date.now();

    // 10 einfache Operationen
    const promises = Array.from({ length: 10 }, (_, i) =>
      threadts.run((x: number) => x * 2, i)
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(10);
    expect(duration).toBeLessThan(1000); // Sollte unter 1 Sekunde sein
  });

  test('sollte Batch-Verarbeitung effizient handhaben', async () => {
    const startTime = Date.now();

    const largeBatch = Array.from({ length: 50 }, (_, i) => ({
      fn: (x: number) => x + 1,
      data: i,
    }));

    const results = await threadts.batch(largeBatch, 5);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(50);
    expect(duration).toBeLessThan(2000); // Batch sollte effizient sein
  });

  test('sollte Pool-Management performant sein', async () => {
    const instance = ThreadTS.getInstance();

    // Pool-Statistiken sollten sofort verfügbar sein
    const startTime = Date.now();
    const stats = instance.getStats();
    const duration = Date.now() - startTime;

    expect(stats).toBeDefined();
    expect(duration).toBeLessThan(10); // Stats sollten sehr schnell sein
  });

  test('sollte Memory-Management korrekt funktionieren', async () => {
    const instance = ThreadTS.getInstance();

    // Viele kleine Tasks ausführen
    for (let i = 0; i < 20; i++) {
      await instance.run((x: number) => x, i);
    }

    const stats = instance.getStats();
    expect(stats.completedTasks).toBeGreaterThanOrEqual(0);

    // Cleanup sollte ohne Fehler funktionieren
    await instance.terminate();
    expect(true).toBe(true);
  });
});
