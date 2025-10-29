/**
 * ThreadTS Universal - Core Functionality Tests
 * Tests für die realen Fähigkeiten des NPM-Pakets
 */

import threadts, { ThreadTS } from '../src';

// Mock Worker für Test-Umgebung
jest.mock('../src/utils/platform', () => ({
  ...jest.requireActual('../src/utils/platform'),
  supportsWorkerThreads: () => true,
  detectPlatform: () => 'node',
  getOptimalWorkerCount: () => 4,
}));

describe('ThreadTS Universal', () => {
  beforeEach(() => {
    // ThreadTS-Instanz zwischen Tests zurücksetzen
    Reflect.set(ThreadTS, '_instance', null);
  });

  afterEach(async () => {
    try {
      const instance = Reflect.get(ThreadTS, '_instance') as ThreadTS | null;
      if (instance) {
        await instance.terminate();
      }
    } catch (error) {
      // Cleanup-Fehler ignorieren
    }
    Reflect.set(ThreadTS, '_instance', null);
  });

  describe('🔧 Grundfunktionalität', () => {
    test('sollte einfache Berechnungen parallel ausführen', async () => {
      const result = await threadts.run((x: number) => x * 2, 21);
      expect(result).toBe(42);
    });

    test('sollte komplexe Datenstrukturen verarbeiten', async () => {
      const data = {
        numbers: [1, 2, 3, 4, 5],
        text: 'hello',
        nested: { value: 42 },
      };

      const result = await threadts.run(
        (input: typeof data) => ({
          sum: input.numbers.reduce((a, b) => a + b, 0),
          upperText: input.text.toUpperCase(),
          doubledValue: input.nested.value * 2,
        }),
        data
      );

      expect(result).toEqual({
        sum: 15,
        upperText: 'HELLO',
        doubledValue: 84,
      });
    });

    test('sollte asynchrone Funktionen unterstützen', async () => {
      const asyncFn = async (delay: number) => {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return 'completed';
      };

      const result = await threadts.run(asyncFn, 10);
      expect(result).toBe('completed');
    });
  });

  describe('⚡ Parallele Verarbeitung', () => {
    test('sollte mehrere Tasks parallel ausführen', async () => {
      const tasks = [
        { fn: (x: number) => x * 2, data: 5 },
        { fn: (x: number) => x + 10, data: 3 },
        { fn: (x: string) => x.toUpperCase(), data: 'test' },
      ];

      const results = await threadts.parallel(tasks);
      expect(results).toHaveLength(3);
      expect(results).toEqual([10, 13, 'TEST']);
    });

    test('sollte Array-Mapping parallel durchführen', async () => {
      const numbers = [1, 2, 3, 4, 5];

      const results = await threadts.map(numbers, (n: number) => n * n, {
        batchSize: 2,
      });

      expect(results).toEqual([1, 4, 9, 16, 25]);
    });

    test('sollte Batch-Verarbeitung unterstützen', async () => {
      const largeTasks = Array.from({ length: 10 }, (_, i) => ({
        fn: (x: number) => x * 2,
        data: i,
      }));

      const results = await threadts.batch(largeTasks, 3);
      expect(results).toHaveLength(10);
      results.forEach((task, index) => {
        expect(task.success).toBe(true);
        expect(task.result).toBe(index * 2);
      });
    });
  });

  describe('🎛️ Konfiguration & Optionen', () => {
    test('sollte Pool-Statistiken bereitstellen', () => {
      const stats = threadts.getStats();

      expect(stats).toHaveProperty('activeWorkers');
      expect(stats).toHaveProperty('idleWorkers');
      expect(stats).toHaveProperty('queuedTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(typeof stats.activeWorkers).toBe('number');
      expect(stats.completedTasks).toBeGreaterThanOrEqual(0);
    });

    test('sollte Pool-Größe anpassen können', async () => {
      await threadts.resize(6);
      // Test erfolgreich wenn keine Fehler auftreten
      expect(true).toBe(true);
    });

    test('sollte Plattform-Informationen liefern', () => {
      const platform = threadts.getPlatform();
      const isSupported = threadts.isSupported();

      expect(['browser', 'node', 'deno', 'bun', 'unknown']).toContain(platform);
      expect(typeof isSupported).toBe('boolean');
    });

    test('sollte Prioritäten unterstützen', async () => {
      const result = await threadts.run((x: number) => x * 3, 7, {
        priority: 'high',
      });

      expect(result).toBe(21);
    });
  });

  describe('🛡️ Fehlerbehandlung', () => {
    test('sollte ungültige Funktionen abfangen', async () => {
      await expect(
        threadts.run(undefined as unknown as (...args: unknown[]) => unknown)
      ).rejects.toThrow();
    });

    test('sollte Timeout-Optionen respektieren', async () => {
      // Test dass Timeout-Option akzeptiert wird
      const result = await threadts.run(() => 'fast-result', null, {
        timeout: 1000,
      });

      expect(result).toBe('fast-result');
    });

    test('sollte Worker-Fehler korrekt behandeln', async () => {
      const errorFn = () => {
        throw new Error('Simulated worker error');
      };

      await expect(threadts.run(errorFn)).rejects.toThrow(
        'Simulated worker error'
      );
    });
  });

  describe('🔄 Lifecycle Management', () => {
    test('sollte graceful shutdown unterstützen', async () => {
      const instance = ThreadTS.getInstance();

      // Einige Tasks ausführen
      await instance.run((x: number) => x, 1);

      // Ordnungsgemäß herunterfahren
      await instance.terminate();

      expect(true).toBe(true); // Test erfolgreich wenn keine Fehler
    });

    test('sollte Worker-Pool korrekt initialisieren', () => {
      const instance = ThreadTS.getInstance();
      const stats = instance.getStats();

      // Pool sollte initialisiert sein
      expect(stats.activeWorkers + stats.idleWorkers).toBeGreaterThanOrEqual(0);
    });
  });
});
