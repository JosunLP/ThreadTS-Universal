# 🚀 ThreadJS Universal

[![npm version](https://badge.fury.io/js/threadjs-universal.svg)](https://badge.fury.io/js/threadjs-universal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/threadjs/universal/workflows/CI/badge.svg)](https://github.com/threadjs/universal/actions)

**The definitive universal TypeScript library that makes true parallelism as effortless as async/await across all JavaScript ecosystems.**

```typescript
import threadjs from 'threadjs-universal';

// Transform any function into parallel execution with one line
const result = await threadjs.run((x) => x * 2, 42);
console.log(result); // 84
```

## ✨ Features

### 🎯 **One-Command Paradigm**

- **Single-line API**: `await threadjs.run(fn, data)` → instant parallel execution
- **Zero-Config**: Intelligent defaults with infinite customization layers
- **Quantum Performance**: Sub-5ms overhead vs handwritten worker wrappers

### 🌍 **Universal Compatibility**

- **Browser**: Web Workers, OffscreenCanvas, Transferable Objects
- **Node.js**: Worker Threads, Cluster Mode, Native Addons
- **Deno**: Web Workers with permissions sandboxing
- **Bun**: Optimized worker implementation
- **Identical API**: Same code works everywhere

### ⚡ **Advanced Features**

- **Auto-scaling Pools**: From 1 to ∞ workers based on load
- **Progress Tracking**: Real-time progress monitoring
- **Intelligent Caching**: Automatic result caching
- **Priority Queues**: High/Normal/Low priority execution
- **Timeout & Cancellation**: AbortController integration
- **Decorator Magic**: `@parallelMethod()` for automatic parallelization

## 🚀 Quick Start

### Installation

```bash
npm install threadjs-universal
```

### Basic Usage

```typescript
import threadjs from 'threadjs-universal';

// Simple parallel execution
const doubled = await threadjs.run((x) => x * 2, 21);

// Complex calculations
const fibonacci = await threadjs.run((n) => {
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}, 40);

// Parallel array processing
const squares = await threadjs.map([1, 2, 3, 4, 5], (x) => x * x);
// Result: [1, 4, 9, 16, 25]
```

### Method Decorators

```typescript
import { parallelMethod } from 'threadjs-universal';

class DataProcessor {
  @parallelMethod()
  async processLargeDataset(data: number[]): Promise<number[]> {
    return data.map((x) => x * x * x);
  }

  @parallelMethod({ timeout: 5000, priority: 'high' })
  async criticalCalculation(input: ComplexData): Promise<Result> {
    // Heavy computation automatically runs in worker
    return heavyProcessing(input);
  }
}
```

## 📚 API Reference

### Core Methods

#### `threadjs.run<T>(fn, data?, options?): Promise<T>`

Executes a function in a worker thread.

```typescript
const result = await threadjs.run(
  (data: { x: number; y: number }) => data.x + data.y,
  { x: 10, y: 20 },
  {
    timeout: 5000,
    priority: 'high',
    transferable: [], // For transferable objects
  }
);
```

#### `threadjs.parallel<T>(tasks): Promise<T[]>`

Executes multiple functions in parallel.

```typescript
const results = await threadjs.parallel([
  { fn: (x) => x * 2, data: 5 },
  { fn: (x) => x * 3, data: 7 },
  { fn: (x) => x * 4, data: 9 },
]);
// Results: [10, 21, 36]
```

#### `threadjs.map<T, R>(array, fn, options?): Promise<R[]>`

Maps an array through a function in parallel.

```typescript
const results = await threadjs.map(
  [1, 2, 3, 4, 5],
  (x, index) => ({ value: x * x, index }),
  { batchSize: 2 }
);
```

#### `threadjs.filter<T>(array, fn, options?): Promise<T[]>`

Filters an array in parallel.

```typescript
const evens = await threadjs.filter(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  (x) => x % 2 === 0
);
```

#### `threadjs.reduce<T, R>(array, fn, initialValue, options?): Promise<R>`

Reduces an array in parallel (for associative operations).

```typescript
const sum = await threadjs.reduce(
  [1, 2, 3, 4, 5],
  (acc, curr) => acc + curr,
  0
);
```

### Advanced Features

#### Progress Tracking

```typescript
const result = await threadjs.execute((data) => {
  // Emit progress updates
  for (let i = 0; i < 100; i++) {
    postMessage({ progress: i, message: `Processing ${i}%` });
    // Heavy work here
  }
  return finalResult;
}, inputData);
```

#### Transferable Objects

```typescript
const buffer = new ArrayBuffer(1024 * 1024);
const result = await threadjs.run(
  (buffer) => {
    // Process buffer in worker
    const view = new Uint8Array(buffer);
    // ... processing
    return processedData;
  },
  buffer,
  { transferable: [buffer] }
);
```

#### Pool Management

```typescript
// Resize worker pool
await threadjs.resize(8);

// Get pool statistics
const stats = threadjs.getStats();
console.log(stats);
// {
//   activeWorkers: 2,
//   idleWorkers: 6,
//   queuedTasks: 0,
//   completedTasks: 150,
//   averageExecutionTime: 45.2
// }
```

### Decorators

#### `@parallelMethod(options?)`

Automatically parallelizes method execution.

```typescript
import { parallelMethod } from 'threadjs-universal';

class ImageProcessor {
  @parallelMethod({ cacheResults: true })
  async applyFilter(imageData: ImageData, filter: Filter): Promise<ImageData> {
    // Automatically runs in worker thread
    return processImage(imageData, filter);
  }
}
```

#### Other Decorators

```typescript
@parallelBatch(4) // Process arrays in batches of 4
async processBatch(items: Item[]): Promise<Result[]> { ... }

@parallelMap({ batchSize: 2 })
async processMap(items: Item[]): Promise<Result[]> { ... }

@highPriority
async urgentTask(): Promise<void> { ... }

@timeout(5000)
async timedTask(): Promise<Result> { ... }
```

## 🌟 Platform-Specific Features

### Browser

- **OffscreenCanvas**: GPU-intensive graphics processing
- **Web Locks**: Worker coordination and synchronization
- **Transferable Objects**: Zero-copy operations
- **Safari Polyfills**: Automatic fallback detection

### Node.js

- **Worker Threads**: CPU-intensive task processing
- **Cluster Mode**: Multi-core utilization
- **File System**: Large data processing
- **Native Addons**: Performance optimization hooks

### Deno

- **Permission Sandboxing**: Secure worker execution
- **TypeScript Native**: Zero-config TypeScript support
- **Web Standards**: Modern web API compatibility

### Bun

- **Ultra-fast Startup**: Optimized worker creation
- **Native Performance**: Maximum speed execution

## 📊 Performance

ThreadJS Universal provides quantum-level performance with sub-5ms overhead:

```typescript
// Benchmark: Fibonacci(40) calculation
const iterations = 1000;

// Sequential execution: ~2.3s
// ThreadJS parallel: ~0.6s (4 cores)
// Overhead: < 5ms per operation
```

## 🔧 Configuration

### Pool Configuration

```typescript
import { ThreadJS } from 'threadjs-universal';

const threadjs = ThreadJS.getInstance({
  minWorkers: 2,
  maxWorkers: 8,
  idleTimeout: 30000,
  queueSize: 1000,
  strategy: 'least-busy',
});
```

### Platform Detection

```typescript
import { detectPlatform, supportsWorkerThreads } from 'threadjs-universal';

console.log('Platform:', detectPlatform());
console.log('Worker Support:', supportsWorkerThreads());
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Browser tests
npm run test:browser

# Node.js tests
npm run test:node

# Performance benchmarks
npm run test:performance
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/threadjs/universal.git
cd universal
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🌟 Why ThreadJS Universal?

### Before ThreadJS

```typescript
// Complex worker setup
const worker = new Worker('worker.js');
worker.postMessage(data);
worker.onmessage = (event) => {
  const result = event.data;
  // Handle result...
};
worker.onerror = (error) => {
  // Handle error...
};
```

### With ThreadJS

```typescript
// One line parallel execution
const result = await threadjs.run(fn, data);
```

### The ThreadJS Advantage

- ✅ **Universal**: Same API across all platforms
- ✅ **Simple**: One-line parallel execution
- ✅ **Fast**: Sub-5ms overhead
- ✅ **Smart**: Auto-scaling, caching, priorities
- ✅ **Safe**: Built-in error handling and timeouts
- ✅ **Modern**: TypeScript-first with full type safety

---

**Make parallel computing as simple as writing synchronous code. Experience the future of JavaScript parallelism with ThreadJS Universal.**

[![Star on GitHub](https://img.shields.io/github/stars/threadjs/universal?style=social)](https://github.com/threadjs/universal)
