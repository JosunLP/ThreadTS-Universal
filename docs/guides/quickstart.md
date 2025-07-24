# 🚀 Schnellstart - ThreadJS Universal

**In 5 Minuten von null auf parallele Hochleistungs-Computing mit ThreadJS Universal.**

## 📦 Installation

```bash
npm install threadjs-universal
```

**Oder mit anderen Paket-Managern:**

```bash
# Yarn
yarn add threadjs-universal

# pnpm
pnpm add threadjs-universal

# Bun
bun add threadjs-universal
```

## ⚡ Erste Schritte

### 1. Import und Basis-Verwendung

```typescript
import threadjs from 'threadjs-universal';

// Einfachste parallele Ausführung - eine Zeile!
const result = await threadjs.run((x: number) => x * 2, 21);
console.log(result); // 42
```

### 2. CPU-intensive Berechnungen

```typescript
// Fibonacci-Berechnung parallel ausführen
const fibonacci = (n: number): number => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

// Sequential vs Parallel Vergleich
console.time('Sequential');
const seqResult = fibonacci(35);
console.timeEnd('Sequential'); // ~1000ms

console.time('Parallel');
const parallelResult = await threadjs.run(fibonacci, 35);
console.timeEnd('Parallel'); // ~1005ms (minimal overhead!)

console.log(seqResult === parallelResult); // true
```

### 3. Array-Verarbeitung

```typescript
const numbers = Array.from({ length: 1000 }, (_, i) => i + 1);

// Parallele Transformation
const squared = await threadjs.map(numbers, (n: number) => n * n, {
  batchSize: 50,
});

// Parallele Filterung
const evenSquares = await threadjs.filter(squared, (n: number) => n % 2 === 0);

console.log(`Found ${evenSquares.length} even squares`);
```

## 🌐 Plattform-spezifische Beispiele

### Browser

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module">
      import threadjs from 'https://cdn.skypack.dev/threadjs-universal';

      // Bildverarbeitung mit OffscreenCanvas
      const processImage = async (imageData) => {
        return await threadjs.run((data) => {
          // Graustufenkonvertierung
          const { width, height, data: pixels } = data;
          for (let i = 0; i < pixels.length; i += 4) {
            const gray =
              pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
            pixels[i] = pixels[i + 1] = pixels[i + 2] = gray;
          }
          return data;
        }, imageData);
      };

      // Event-Handler für File-Input hinzufügen
      document.getElementById('imageInput').onchange = async (e) => {
        const file = e.target.files[0];
        const canvas = document.getElementById('canvas');
        const ctx = canvas.getContext('2d');

        const img = new Image();
        img.onload = async () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const processed = await processImage(imageData);
          ctx.putImageData(processed, 0, 0);
        };
        img.src = URL.createObjectURL(file);
      };
    </script>
  </head>
  <body>
    <input type="file" id="imageInput" accept="image/*" />
    <canvas id="canvas"></canvas>
  </body>
</html>
```

### Node.js

```typescript
import threadjs from 'threadjs-universal';
import fs from 'fs/promises';

// Große Datei-Verarbeitung
async function processLargeFile(filename: string) {
  const content = await fs.readFile(filename, 'utf8');
  const lines = content.split('\n');

  // Parallele Zeilen-Verarbeitung
  const processed = await threadjs.map(
    lines,
    (line: string) => {
      // Komplexe String-Verarbeitung
      return line
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(' ')
        .filter((word) => word.length > 3)
        .join(' ');
    },
    { batchSize: 100 }
  );

  await fs.writeFile('processed.txt', processed.join('\n'));
  console.log(`Processed ${lines.length} lines`);
}

processLargeFile('large-text-file.txt');
```

### Deno

```typescript
import threadjs from 'https://deno.land/x/threadjs_universal/mod.ts';

// Parallele HTTP-Requests
const urls = [
  'https://api.github.com/users/octocat',
  'https://api.github.com/users/defunkt',
  'https://api.github.com/users/pjhyett',
];

const fetchUserData = async (url: string) => {
  const response = await fetch(url);
  return response.json();
};

// Alle Requests parallel ausführen
const results = await threadjs.parallel(
  urls.map((url) => ({ fn: fetchUserData, data: url }))
);

console.log('User data:', results);
```

### Bun

```typescript
import threadjs from 'threadjs-universal';

// Ultra-schnelle JSON-Verarbeitung
const largeJsonArray = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  data: Math.random(),
  created: new Date().toISOString(),
}));

// Parallele JSON-Serialisierung (Bun ist bereits sehr schnell)
const serialized = await threadjs.map(
  largeJsonArray,
  (item: any) => JSON.stringify(item),
  { batchSize: 500 }
);

console.log(`Serialized ${serialized.length} JSON objects`);
```

## 🎯 Erweiterte Funktionen

### Progress Tracking

```typescript
// Langlaufende Aufgabe mit Fortschritts-Updates
const longTask = await threadjs.run((iterations: number) => {
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    // Komplexe Berechnung
    result += Math.sqrt(i) * Math.sin(i);

    // Progress-Update alle 10%
    if (i % Math.floor(iterations / 10) === 0) {
      const progress = Math.floor((i / iterations) * 100);
      postMessage({
        type: 'progress',
        progress,
        message: `${progress}% completed`,
      });
    }
  }
  return result;
}, 1000000);
```

### Transferable Objects

```typescript
// Große Binärdaten ohne Kopier-Overhead übertragen
const largeBuffer = new ArrayBuffer(10 * 1024 * 1024); // 10MB
const view = new Uint8Array(largeBuffer);

// Buffer mit Daten füllen
for (let i = 0; i < view.length; i++) {
  view[i] = i % 256;
}

// Zero-Copy Transfer zu Worker
const processed = await threadjs.run(
  (buffer: ArrayBuffer) => {
    const view = new Uint8Array(buffer);
    let sum = 0;
    for (let i = 0; i < view.length; i++) {
      sum += view[i];
    }
    return sum;
  },
  largeBuffer,
  { transferable: [largeBuffer] } // Buffer wird übertragen, nicht kopiert
);

console.log('Processed sum:', processed);
// Achtung: largeBuffer ist jetzt leer! (wurde übertragen)
```

### Error Handling

```typescript
import { WorkerError, TimeoutError, ThreadError } from 'threadjs-universal';

try {
  const result = await threadjs.run(
    () => {
      throw new Error('Something went wrong!');
    },
    null,
    { timeout: 1000 }
  );
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Operation timed out');
  } else if (error instanceof WorkerError) {
    console.log('Worker encountered an error:', error.message);
  } else if (error instanceof ThreadError) {
    console.log('Thread error:', error.code);
  }
}
```

## 🎨 Decorator Magic

```typescript
import { parallelMethod, parallelBatch } from 'threadjs-universal';

class DataProcessor {
  @parallelMethod({ cacheResults: true })
  async processItem(data: any): Promise<any> {
    // Schwere Verarbeitung wird automatisch parallelisiert
    return heavyProcessing(data);
  }

  @parallelBatch(4) // Verarbeite 4 Items gleichzeitig
  async processMany(items: any[]): Promise<any[]> {
    return items.map((item) => this.processItem(item));
  }
}

const processor = new DataProcessor();
const results = await processor.processMany(largeDataset);
```

## 📊 Performance-Monitoring

```typescript
// Pool-Statistiken abrufen
const stats = threadjs.getStats();
console.log('Pool Statistics:', {
  activeWorkers: stats.activeWorkers,
  idleWorkers: stats.idleWorkers,
  queuedTasks: stats.queuedTasks,
  completedTasks: stats.completedTasks,
  averageExecutionTime: stats.averageExecutionTime,
});

// Pool-Größe dynamisch anpassen
await threadjs.resize(8); // Auf 8 Worker erweitern

// Plattform-Informationen
console.log('Platform:', threadjs.getPlatform());
console.log('Worker Support:', threadjs.isSupported());
```

## 🔧 Konfiguration

```typescript
import { ThreadJS } from 'threadjs-universal';

// Custom Pool-Konfiguration
const threadjs = ThreadJS.getInstance({
  minWorkers: 2, // Minimum Worker
  maxWorkers: 8, // Maximum Worker
  idleTimeout: 30000, // Worker-Cleanup nach 30s
  queueSize: 1000, // Max. 1000 Tasks in Queue
  strategy: 'least-busy', // Load-Balancing-Strategie
});
```

## 🎯 Best Practices

### ✅ Do's

- **Nutze `run()` für einfache Aufgaben**
- **Nutze `parallel()` für unabhängige Tasks**
- **Nutze `batch()` für große Task-Arrays**
- **Nutze Transferable Objects für große Binärdaten**
- **Implementiere Timeout für langlaufende Tasks**

### ❌ Don'ts

- **Vermeide Worker für triviale Operationen**
- **Vermeide riesige Daten-Transfers ohne Transferables**
- **Vermeide Worker-intensive Operationen in Schleifen**

## 🚀 Nächste Schritte

1. **Erkunde die [API-Referenz](../api/core.md)** für detaillierte Funktions-Dokumentation
2. **Schaue dir [Real-World-Beispiele](../examples/real-world.md)** für Produktions-Code an
3. **Lerne über [Platform-spezifische Features](./platform-features.md)**
4. **Optimiere mit dem [Performance-Guide](./performance.md)**

---

**🎉 Gratulation! Du nutzt jetzt die Zukunft der JavaScript-Parallelität.**

_ThreadJS Universal macht parallele Programmierung so einfach wie das Schreiben von synchronem Code._ ⚡
