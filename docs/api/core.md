# 🔧 Core API - ThreadJS Universal

**Die Kern-API von ThreadJS Universal bietet eine einheitliche Schnittstelle für parallele Verarbeitung auf allen JavaScript-Plattformen.**

## 📋 Inhaltsverzeichnis

- [ThreadJS Klasse](#threadjs-klasse)
- [Haupt-Methoden](#haupt-methoden)
- [Erweiterte Methoden](#erweiterte-methoden)
- [Pool-Management](#pool-management)
- [Plattform-APIs](#plattform-apis)

## ThreadJS Klasse

### Singleton-Instanz

```typescript
import { ThreadJS } from 'threadjs-universal';

// Standard-Instanz
const threadjs = ThreadJS.getInstance();

// Mit benutzerdefinierter Pool-Konfiguration
const customThreadjs = ThreadJS.getInstance({
  minWorkers: 2,
  maxWorkers: 8,
  idleTimeout: 30000,
  queueSize: 1000,
  strategy: 'least-busy',
});
```

## Haupt-Methoden

### `run<T>(fn, data?, options?) → Promise<T>`

**Die Hauptmethode für parallele Ausführung. Ein-Zeilen-API für sofortige Parallelisierung.**

#### Parameter

- `fn: Function` - Die auszuführende Funktion
- `data?: any` - Eingabedaten für die Funktion
- `options?: ThreadOptions` - Optionale Konfiguration

#### Rückgabe (run)

- `Promise<T>` - Das Ergebnis der Funktionsausführung

#### Beispiele

```typescript
// Einfache Berechnung
const result = await threadjs.run((x: number) => x * 2, 21);
console.log(result); // 42

// Komplexe Datenverarbeitung
const processed = await threadjs.run(
  (data: number[]) => data.map((x) => Math.sqrt(x)).reduce((a, b) => a + b, 0),
  [1, 4, 9, 16, 25]
);

// Mit Optionen
const result = await threadjs.run(
  (data: { iterations: number }) => {
    let sum = 0;
    for (let i = 0; i < data.iterations; i++) {
      sum += Math.random();
    }
    return sum;
  },
  { iterations: 1000000 },
  {
    timeout: 5000,
    priority: 'high',
    signal: abortController.signal,
  }
);
```

### `execute<T>(fn, data?, options?) → Promise<ThreadResult<T>>`

**Erweiterte Ausführung mit detaillierten Metadaten.**

#### Execute Parameter

Identisch mit `run()`, aber liefert erweiterte Ausführungsinformationen.

#### Rückgabe

```typescript
interface ThreadResult<T> {
  result: T; // Funktionsergebnis
  executionTime: number; // Ausführungszeit in ms
  workerId?: string; // ID des verwendeten Workers
  error?: Error; // Fehlerinformationen (falls vorhanden)
}
```

#### Beispiel für parallel

```typescript
const result = await threadjs.execute((n: number) => {
  // Fibonacci-Berechnung
  const fib = (n: number): number => (n <= 1 ? n : fib(n - 1) + fib(n - 2));
  return fib(n);
}, 35);

console.log(`Ergebnis: ${result.result}`);
console.log(`Ausführungszeit: ${result.executionTime}ms`);
console.log(`Worker ID: ${result.workerId}`);
```

## Erweiterte Methoden

### `parallel<T>(tasks) → Promise<T[]>`

**Führt mehrere Funktionen parallel aus.**

#### Parallel Parameter

```typescript
interface Task {
  fn: Function;
  data?: any;
  options?: ThreadOptions;
}

tasks: Task[]
```

#### Beispiel (parallel)

```typescript
const results = await threadjs.parallel([
  {
    fn: (x: number) => x * 2,
    data: 5,
  },
  {
    fn: (x: number) => x * 3,
    data: 7,
  },
  {
    fn: (x: number) => x * 4,
    data: 9,
  },
]);
console.log(results); // [10, 21, 36]
```

### `batch<T>(tasks, batchSize?) → Promise<T[]>`

**Führt Tasks in kontrollierten Batches aus.**

#### Batch Parameter

- `tasks: Task[]` - Array von auszuführenden Tasks
- `batchSize: number = 4` - Anzahl gleichzeitiger Tasks

#### Beispiel (batch)

```typescript
const heavyTasks = Array.from({ length: 20 }, (_, i) => ({
  fn: (n: number) => {
    // Schwere Berechnung
    let result = 0;
    for (let j = 0; j < n * 1000000; j++) {
      result += Math.sqrt(j);
    }
    return result;
  },
  data: i + 1,
}));

// Verarbeite in 4er-Batches
const results = await threadjs.batch(heavyTasks, 4);
```

### `map<TInput, TOutput>(data, fn, options?) → Promise<TOutput[]>`

**Parallele Array-Transformation.**

#### Map Parameter

- `data: TInput[]` - Eingabe-Array
- `fn: (item: TInput, index: number) => TOutput` - Transformation-Funktion
- `options?: ThreadOptions & { batchSize?: number }` - Optionen mit Batch-Größe

#### Beispiel (filter)

```typescript
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const squared = await threadjs.map(
  numbers,
  (n: number, index: number) => ({
    index,
    value: n,
    squared: n * n,
    isEven: n % 2 === 0,
  }),
  { batchSize: 3 }
);
```

### `filter<T>(data, fn, options?) → Promise<T[]>`

**Parallele Array-Filterung.**

#### Beispiel

```typescript
const numbers = Array.from({ length: 1000 }, (_, i) => i + 1);

const primes = await threadjs.filter(
  numbers,
  (n: number) => {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  },
  { batchSize: 50 }
);
```

## Pool-Management

### `resize(size) → Promise<void>`

**Ändert die Größe des Worker-Pools.**

```typescript
// Pool auf 8 Worker erweitern
await threadjs.resize(8);

// Pool auf 2 Worker reduzieren
await threadjs.resize(2);
```

### `getStats() → PoolStats`

**Liefert Pool-Statistiken.**

```typescript
const stats = threadjs.getStats();
console.log(stats);
/* Output:
{
  activeWorkers: 3,
  idleWorkers: 5,
  queuedTasks: 12,
  completedTasks: 1547,
  averageExecutionTime: 23.4
}
*/
```

### `terminate() → Promise<void>`

**Beendet den Thread-Pool und bereinigt Ressourcen.**

```typescript
// Beim App-Shutdown
await threadjs.terminate();
```

## Plattform-APIs

### `getPlatform() → Platform`

**Erkennt die aktuelle JavaScript-Laufzeitumgebung.**

```typescript
const platform = threadjs.getPlatform();
console.log(platform); // 'browser' | 'node' | 'deno' | 'bun' | 'unknown'
```

### `isSupported() → boolean`

**Prüft Worker-Thread-Unterstützung.**

```typescript
if (threadjs.isSupported()) {
  // Parallele Verarbeitung verfügbar
  const result = await threadjs.run(heavyComputation, data);
} else {
  // Fallback zu synchroner Ausführung
  const result = heavyComputation(data);
}
```

## ThreadOptions Interface

```typescript
interface ThreadOptions {
  timeout?: number; // Timeout in ms
  priority?: 'low' | 'normal' | 'high'; // Task-Priorität
  signal?: AbortSignal; // Abbruch-Signal
  transferable?: Transferable[]; // Transferable Objects
  maxRetries?: number; // Max. Wiederholungen
  poolSize?: number; // Gewünschte Pool-Größe
}
```

## Fehlerbehandlung

```typescript
import { WorkerError, TimeoutError, ThreadError } from 'threadjs-universal';

try {
  const result = await threadjs.run(riskyFunction, data, { timeout: 1000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Operation timed out');
  } else if (error instanceof WorkerError) {
    console.log('Worker error:', error.message);
  } else if (error instanceof ThreadError) {
    console.log('Thread error:', error.code, error.message);
  }
}
```

## Performance-Tipps

### ✅ Do's

```typescript
// Verwende run() für einfache Anwendungsfälle
const result = await threadjs.run(simpleFunction, data);

// Verwende parallel() für unabhängige Tasks
const results = await threadjs.parallel(independentTasks);

// Verwende batch() für große Task-Arrays
const results = await threadjs.batch(largeTasks, 4);
```

### ❌ Don'ts

```typescript
// Vermeide Worker für triviale Operationen
await threadjs.run((x) => x + 1, 5); // Overhead > Nutzen

// Vermeide riesige Datentransfers ohne Transferables
await threadjs.run(fn, hugeBinaryData); // Langsam ohne transferable

// Vermeide Worker-intensive Operationen in Schleifen
for (const item of items) {
  await threadjs.run(fn, item); // Besser: threadjs.map(items, fn)
}
```

---

**Nächste Schritte**: [Worker Adapters](./adapters.md) | [Pool Manager](./pool.md) | [Types](./types.md)
