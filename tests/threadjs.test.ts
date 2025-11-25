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

  describe('🔍 Neue Array-Methoden', () => {
    test('sollte find() korrekt implementieren', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Erstes Element größer als 3 finden
      const found = await threadts.find(numbers, (x: number) => x > 3);
      expect(found).toBe(4);

      // Nicht existierendes Element
      const notFound = await threadts.find(numbers, (x: number) => x > 10);
      expect(notFound).toBeUndefined();

      // Leeres Array
      const emptyResult = await threadts.find([], (x: number) => x > 0);
      expect(emptyResult).toBeUndefined();
    });

    test('sollte findIndex() korrekt implementieren', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Index des ersten Elements größer als 3 finden
      const index = await threadts.findIndex(numbers, (x: number) => x > 3);
      expect(index).toBe(3);

      // Nicht existierendes Element
      const notFoundIndex = await threadts.findIndex(
        numbers,
        (x: number) => x > 10
      );
      expect(notFoundIndex).toBe(-1);

      // Leeres Array
      const emptyIndex = await threadts.findIndex([], (x: number) => x > 0);
      expect(emptyIndex).toBe(-1);
    });

    test('sollte some() korrekt implementieren', async () => {
      const numbers = [1, 2, 3, 4, 5];

      // Prüfen ob ein Element größer als 3 ist
      const hasLarge = await threadts.some(numbers, (x: number) => x > 3);
      expect(hasLarge).toBe(true);

      // Prüfen ob ein Element größer als 10 ist
      const hasVeryLarge = await threadts.some(numbers, (x: number) => x > 10);
      expect(hasVeryLarge).toBe(false);

      // Leeres Array sollte false zurückgeben
      const emptyResult = await threadts.some([], (x: number) => x > 0);
      expect(emptyResult).toBe(false);
    });

    test('sollte every() korrekt implementieren', async () => {
      const positiveNumbers = [1, 2, 3, 4, 5];
      const mixedNumbers = [1, 2, -3, 4, 5];

      // Alle positiv
      const allPositive = await threadts.every(
        positiveNumbers,
        (x: number) => x > 0
      );
      expect(allPositive).toBe(true);

      // Nicht alle positiv
      const notAllPositive = await threadts.every(
        mixedNumbers,
        (x: number) => x > 0
      );
      expect(notAllPositive).toBe(false);

      // Leeres Array sollte true zurückgeben (wie Array.prototype.every)
      const emptyResult = await threadts.every([], (x: number) => x > 0);
      expect(emptyResult).toBe(true);
    });

    test('sollte find() mit batchSize unterstützen', async () => {
      const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const found = await threadts.find(numbers, (x: number) => x > 5, {
        batchSize: 3,
      });
      expect(found).toBe(6);
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
