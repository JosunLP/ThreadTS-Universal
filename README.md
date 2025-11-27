# 🚀 ThreadTS Universal

[![npm version](https://badge.fury.io/js/threadts-universal.svg)](https://badge.fury.io/js/threadts-universal)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![🚀 CI/CD Pipeline](https://github.com/JosunLP/ThreadTS-Universal/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/JosunLP/ThreadTS-Universal/actions/workflows/ci-cd.yml)
[![CodeQL](https://github.com/JosunLP/ThreadTS-Universal/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/JosunLP/ThreadTS-Universal/actions/workflows/github-code-scanning/codeql)

**The definitive universal TypeScript library that makes true parallelism as effortless as async/await across all JavaScript ecosystems.**

```typescript
import threadts from 'threadts-universal';

// Transform any function into parallel execution with one line
const result = await threadts.run((x) => x * 2, 42);
console.log(result); // 84

// Full Array API support with parallel execution
const found = await threadts.find([1, 2, 3, 4, 5], (x) => x > 3);
console.log(found); // 4
```

## ✨ Features

### 🎯 **One-Command Paradigm**

- **Single-line API**: `await threadts.run(fn, data)` → instant parallel execution
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
- **Full Array API**: `map`, `filter`, `reduce`, `reduceRight`, `find`, `findIndex`, `some`, `every`, `forEach`, `flatMap`, `groupBy`, `partition`, `count`
- **Pipeline API**: Fluent chaining with lazy evaluation
- **Progress Tracking**: Real-time progress monitoring
- **Intelligent Caching**: Automatic result caching with `@memoize` decorator
- **Priority Queues**: High/Normal/Low priority execution
- **Timeout & Cancellation**: AbortController integration
- **Decorator Suite**: `@parallelMethod()`, `@retry()`, `@rateLimit()`, `@timeout()`, `@debounce()`, `@throttle()`, `@logged()`
- **Monitoring**: Built-in performance monitoring, health checks, and error handling

## 🚀 Quick Start

### Installation

```bash
npm install threadts-universal
```

### Basic Usage

```typescript
import threadts from 'threadts-universal';

// Simple parallel execution
const doubled = await threadts.run((x) => x * 2, 21);

// Complex calculations
const fibonacci = await threadts.run((n) => {
  if (n <= 1) return n;
  let a = 0,
    b = 1;
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b];
  }
  return b;
}, 40);

// Parallel array processing
const squares = await threadts.map([1, 2, 3, 4, 5], (x) => x * x);
// Result: [1, 4, 9, 16, 25]

// Find elements in parallel
const firstMatch = await threadts.find([1, 2, 3, 4, 5], (x) => x > 3);
// Result: 4

// Check conditions across array
const hasEven = await threadts.some([1, 3, 5, 6], (x) => x % 2 === 0);
// Result: true

// Group and partition data
const [evens, odds] = await threadts.partition([1, 2, 3, 4, 5], (x) => x % 2 === 0);
// evens: [2, 4], odds: [1, 3, 5]

// Pipeline API for chained operations
const result = await threadts.pipe([1, 2, 3, 4, 5])
  .map((x) => x * 2)
  .filter((x) => x > 4)
  .reduce((acc, x) => acc + x, 0)
  .execute();
// Result: 24
```

### Method Decorators

```typescript
import { parallelMethod, memoize, retry, rateLimit, timeout, debounce } from 'threadts-universal';

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

  @memoize(100) // Cache up to 100 results
  async expensiveComputation(input: string): Promise<Result> {
    return computeResult(input);
  }

  @retry(3, 1000) // 3 attempts with exponential backoff
  async unreliableOperation(): Promise<void> {
    await callExternalService();
  }

  @rateLimit(10) // Max 10 calls per second
  async rateLimitedAPI(): Promise<Data> {
    return fetchFromAPI();
  }
}
```

## 📚 API Reference

### Core Methods

#### `threadts.run<T>(fn, data?, options?): Promise<T>`

Executes a function in a worker thread.

```typescript
const result = await threadts.run(
  (data: { x: number; y: number }) => data.x + data.y,
  { x: 10, y: 20 },
  {
    timeout: 5000,
    priority: 'high',
    transferable: [], // For transferable objects
  }
);
```

#### `threadts.parallel<T>(tasks): Promise<T[]>`

Executes multiple functions in parallel.

```typescript
const results = await threadts.parallel([
  { fn: (x) => x * 2, data: 5 },
  { fn: (x) => x * 3, data: 7 },
  { fn: (x) => x * 4, data: 9 },
]);
// Results: [10, 21, 36]
```

#### `threadts.map<T, R>(array, fn, options?): Promise<R[]>`

Maps an array through a function in parallel.

```typescript
const results = await threadts.map(
  [1, 2, 3, 4, 5],
  (x, index) => ({ value: x * x, index }),
  { batchSize: 2 }
);
```

#### `threadts.filter<T>(array, fn, options?): Promise<T[]>`

Filters an array in parallel.

```typescript
const evens = await threadts.filter(
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  (x) => x % 2 === 0
);
```

#### `threadts.reduce<T, R>(array, fn, initialValue, options?): Promise<R>`

Reduces an array in parallel (for associative operations).

```typescript
const sum = await threadts.reduce(
  [1, 2, 3, 4, 5],
  (acc, curr) => acc + curr,
  0
);
```

#### `threadts.reduceRight<T, R>(array, fn, initialValue, options?): Promise<R>`

Reduces an array from right to left.

```typescript
const result = await threadts.reduceRight(
  ['a', 'b', 'c'],
  (acc, item) => acc + item,
  ''
);
// Result: 'cba'
```

#### `threadts.find<T>(array, predicate, options?): Promise<T | undefined>`

Finds the first element that satisfies the predicate (processes in parallel batches).

```typescript
const found = await threadts.find(
  [1, 2, 3, 4, 5],
  (x) => x > 3
);
// Result: 4
```

#### `threadts.findIndex<T>(array, predicate, options?): Promise<number>`

Finds the index of the first element that satisfies the predicate.

```typescript
const index = await threadts.findIndex(
  [1, 2, 3, 4, 5],
  (x) => x > 3
);
// Result: 3
```

#### `threadts.some<T>(array, predicate, options?): Promise<boolean>`

Tests whether at least one element satisfies the predicate.

```typescript
const hasEven = await threadts.some(
  [1, 3, 5, 6, 7],
  (x) => x % 2 === 0
);
// Result: true
```

#### `threadts.every<T>(array, predicate, options?): Promise<boolean>`

Tests whether all elements satisfy the predicate.

```typescript
const allPositive = await threadts.every(
  [1, 2, 3, 4, 5],
  (x) => x > 0
);
// Result: true
```

#### `threadts.forEach<T>(array, fn, options?): Promise<void>`

Iterates over an array in parallel (like Array.forEach but parallel).

```typescript
await threadts.forEach([1, 2, 3], (x) => {
  console.log(x);
});
```

#### `threadts.flatMap<T, R>(array, fn, options?): Promise<R[]>`

Maps each element to an array and flattens the result.

```typescript
const result = await threadts.flatMap(
  [1, 2, 3],
  (x) => [x, x * 2]
);
// Result: [1, 2, 2, 4, 3, 6]
```

#### `threadts.groupBy<T, K>(array, keyFn, options?): Promise<Map<K, T[]>>`

Groups array elements by a key returned from the function.

```typescript
const grouped = await threadts.groupBy(
  [{ type: 'a', value: 1 }, { type: 'b', value: 2 }, { type: 'a', value: 3 }],
  (item) => item.type
);
// Map { 'a' => [{type: 'a', value: 1}, {type: 'a', value: 3}], 'b' => [{type: 'b', value: 2}] }
```

#### `threadts.partition<T>(array, predicate, options?): Promise<[T[], T[]]>`

Partitions an array into two arrays based on a predicate.

```typescript
const [evens, odds] = await threadts.partition(
  [1, 2, 3, 4, 5],
  (x) => x % 2 === 0
);
// evens: [2, 4], odds: [1, 3, 5]
```

#### `threadts.count<T>(array, predicate, options?): Promise<number>`

Counts elements that satisfy a predicate. More efficient than `filter().length`.

```typescript
const count = await threadts.count(
  [1, 2, 3, 4, 5],
  (x) => x > 2
);
// Result: 3
```

#### `threadts.batch(tasks, batchSize?): Promise<TaskResult[]>`

Executes multiple tasks as a batch with configurable batch size.

```typescript
const results = await threadts.batch(
  [
    { fn: (x) => x * 2, data: 5 },
    { fn: (x) => x + 1, data: 10 },
  ],
  2 // Process 2 tasks at a time
);
```

### Pipeline API

The Pipeline API provides a fluent interface for chaining parallel operations with lazy evaluation.

```typescript
// Chain multiple operations
const result = await threadts.pipe([1, 2, 3, 4, 5])
  .map((x) => x * 2)
  .filter((x) => x > 4)
  .reduce((acc, x) => acc + x, 0)
  .execute();
// Result: 24 (6 + 8 + 10)

// Using flatMap in pipeline
const flattened = await threadts.pipe([1, 2, 3])
  .flatMap((x) => [x, x * 10])
  .filter((x) => x > 5)
  .toArray();
// Result: [10, 20, 30]

// Terminal operations: reduce, forEach, find, some, every, count
const hasLarge = await threadts.pipe([1, 2, 3, 4, 5])
  .map((x) => x * 2)
  .some((x) => x > 8)
  .execute();
// Result: true
```

### Advanced Features

#### Progress Tracking

```typescript
const result = await threadts.execute((data) => {
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
const result = await threadts.run(
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
await threadts.resize(8);

// Get pool statistics
const stats = threadts.getStats();
console.log(stats);
// {
//   activeWorkers: 2,
//   idleWorkers: 6,
//   queuedTasks: 0,
//   completedTasks: 150,
//   averageExecutionTime: 45.2
// }

// Get/Update configuration
const config = threadts.getConfig();
threadts.updateConfig({ timeout: 10000, debug: true });

// Check platform and support
console.log(threadts.getPlatform()); // 'node', 'browser', 'deno', 'bun'
console.log(threadts.isSupported()); // true if workers are supported

// Cleanup
await threadts.terminate(); // Terminate instance
await ThreadTS.terminateAll(); // Terminate all instances
```

### Decorators

#### `@parallelMethod(options?)`

Automatically parallelizes method execution.

```typescript
import { parallelMethod } from 'threadts-universal';

class ImageProcessor {
  @parallelMethod({ cacheResults: true, timeout: 5000 })
  async applyFilter(imageData: ImageData, filter: Filter): Promise<ImageData> {
    // Automatically runs in worker thread
    return processImage(imageData, filter);
  }
}
```

**Options:**

- `timeout`: Maximum execution time in milliseconds
- `priority`: Execution priority ('low', 'normal', 'high')
- `maxRetries`: Number of retry attempts on failure
- `poolSize`: Custom worker pool size
- `cacheResults`: Enable result caching

#### `@memoize(maxCacheSize?)`

Caches method results with LRU eviction policy.

```typescript
@memoize(100) // Cache up to 100 unique results
async expensiveComputation(input: string): Promise<Result> {
  return computeResult(input);
}
```

#### `@retry(maxAttempts?, baseDelay?)`

Retry logic with exponential backoff.

```typescript
@retry(3, 1000) // 3 attempts, starting with 1s delay
async unreliableOperation(): Promise<void> {
  await callExternalService();
}
```

#### `@rateLimit(callsPerSecond?)`

Limits method call frequency.

```typescript
@rateLimit(10) // Max 10 calls per second
async apiCall(): Promise<Data> {
  return fetchFromAPI();
}
```

#### `@timeout(ms?)`

Automatically rejects if execution exceeds the specified timeout.

```typescript
@timeout(5000) // Reject after 5 seconds
async longRunningTask(): Promise<Result> {
  return performTask();
}
```

#### `@debounce(ms?)`

Delays execution until no calls have been made for the specified duration.

```typescript
@debounce(300) // Wait 300ms after last call
async handleInput(value: string): Promise<void> {
  await saveToServer(value);
}
```

#### `@throttle(ms?)`

Ensures the method is called at most once per specified interval.

```typescript
@throttle(1000) // At most once per second
async trackEvent(event: Event): Promise<void> {
  await sendAnalytics(event);
}
```

#### `@logged(options?)`

Logs method calls, arguments, results, and execution time.

```typescript
@logged({ logArgs: true, logResult: true })
async processData(data: Data): Promise<Result> {
  return transform(data);
}
// Logs: [ClassName.processData] Starting with args: [...]
// Logs: [ClassName.processData] Completed in 45ms. Result: {...}
```

#### `@parallelBatch(batchSize?)`

Processes array data in parallel batches.

```typescript
@parallelBatch(4)
async processBatch(items: Item[]): Promise<Result[]> {
  return items.map(processItem);
}
```

#### `@parallelMap()`

Parallel map operation on array input.

```typescript
@parallelMap()
async processItems(items: Item[]): Promise<Result[]> {
  return items.map(transform);
}
```

#### Decorator Summary

```typescript
@parallelMethod() // Parallelize method execution
@parallelBatch(4) // Process arrays in batches of 4
@parallelMap() // Parallel map over array
@memoize(100) // LRU cache with 100 entries
@retry(3, 1000) // Retry up to 3 times with exponential backoff
@rateLimit(10) // Max 10 calls per second
@timeout(5000) // Timeout after 5 seconds
@debounce(300) // Debounce with 300ms delay
@throttle(1000) // Throttle to once per second
@logged() // Log execution details
```

### Event System

```typescript
// Listen to task completion events
threadts.on('task-complete', ({ taskId, result, duration }) => {
  console.log(`Task ${taskId} completed in ${duration}ms`);
});

// Listen to task errors
threadts.on('task-error', ({ taskId, error, duration }) => {
  console.error(`Task ${taskId} failed: ${error}`);
});

// Listen to pool resize events
threadts.on('pool-resize', ({ oldSize, newSize }) => {
  console.log(`Pool resized from ${oldSize} to ${newSize}`);
});

// Remove event listener
threadts.off('task-complete', listener);
```

### Monitoring & Diagnostics

```typescript
import {
  PerformanceMonitor,
  HealthMonitor,
  ErrorHandler
} from 'threadts-universal';

// Performance Monitoring
const perfMonitor = new PerformanceMonitor();
perfMonitor.startMonitoring(2000); // Check every 2 seconds
const metrics = perfMonitor.collectMetrics();

// Health Monitoring
const healthMonitor = new HealthMonitor();
healthMonitor.startHealthMonitoring(5000); // Check every 5 seconds
const health = await healthMonitor.performHealthCheck();
console.log(health.overall); // 'healthy', 'degraded', or 'unhealthy'

// Error Handling with auto-recovery
const errorHandler = new ErrorHandler();
const result = await errorHandler.executeWithRetry(
  'operation-name',
  async () => riskyOperation(),
  { platform: 'node', workerCount: 4 }
);
```

## 🌟 Platform-Specific Features

### Browser

- **OffscreenCanvas**: GPU-intensive graphics processing
- **Web Locks**: Worker coordination and synchronization
- **Transferable Objects**: Zero-copy operations
- **Safari Polyfills**: Automatic fallback detection

### Node.js

- **Worker Threads**: CPU-intensive task processing
- **Resource Limits**: Memory control per worker
- **Cluster Mode**: Multi-core utilization
- **Native Addons**: Performance optimization hooks

```typescript
// Node.js specific resource limits
const result = await threadts.run(heavyTask, data, {
  resourceLimits: {
    maxOldGenerationSizeMb: 128,
    maxYoungGenerationSizeMb: 64,
    codeRangeSizeMb: 16,
    stackSizeMb: 4,
  },
  workerName: 'heavy-worker',
  trackResources: true,
});
```

### Deno

- **Permission Sandboxing**: Secure worker execution
- **TypeScript Native**: Zero-config TypeScript support
- **Web Standards**: Modern web API compatibility

```typescript
// Deno specific permissions
const result = await threadts.run(task, data, {
  denoPermissions: {
    net: ['api.example.com'],
    read: ['/data'],
    env: true,
    hrtime: true,
  },
});
```

### Bun

- **Ultra-fast Startup**: Optimized worker creation
- **Native Performance**: Maximum speed execution
- **High Precision Timing**: Microsecond accuracy

```typescript
// Bun specific options
const result = await threadts.run(task, data, {
  bunOptions: {
    name: 'compute-worker',
    highPrecisionTiming: true,
    forceGC: true,
  },
});
```

## 📊 Performance

ThreadTS Universal provides quantum-level performance with sub-5ms overhead:

```typescript
// Benchmark: Fibonacci(40) calculation
const iterations = 1000;

// Sequential execution: ~2.3s
// ThreadTS parallel: ~0.6s (4 cores)
// Overhead: < 5ms per operation
```

### Performance Benchmarks

| Operation             | Data Size   | Time   | Throughput      |
| --------------------- | ----------- | ------ | --------------- |
| Image Processing      | 1920x1080   | ~50ms  | ~40k pixels/ms  |
| JSON Transformation   | 10k records | ~30ms  | ~300 records/ms |
| Cryptographic Hashing | 1k items    | ~15ms  | ~65 hashes/ms   |
| Array Map             | 100k items  | ~200ms | ~500k items/s   |

## 🔧 Configuration

### Pool Configuration

```typescript
import { ThreadTS } from 'threadts-universal';

const threadts = ThreadTS.getInstance({
  poolSize: 8, // Number of workers
  timeout: 30000, // Default timeout in ms
  retries: 2, // Default retry attempts
  autoResize: true, // Auto-scale pool
  debug: false, // Enable debug logging
  maxQueueSize: 1000, // Max queued tasks
  workerIdleTimeout: 60000, // Worker idle timeout
  taskPriority: 'normal', // Default priority
});
```

### Platform Detection

```typescript
import {
  detectPlatform,
  supportsWorkerThreads,
  getOptimalThreadCount,
  getMemoryInfo
} from 'threadts-universal';

console.log('Platform:', detectPlatform()); // 'node', 'browser', 'deno', 'bun'
console.log('Worker Support:', supportsWorkerThreads());
console.log('Optimal Threads:', getOptimalThreadCount());
console.log('Memory:', getMemoryInfo());
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
git clone https://github.com/JosunLP/ThreadTS-Universal.git
cd universal
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🌟 Why ThreadTS Universal?

### Before ThreadTS

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

### With ThreadTS

```typescript
// One line parallel execution
const result = await threadts.run(fn, data);

// Full Array API
const found = await threadts.find(array, predicate);
const all = await threadts.every(array, test);
const any = await threadts.some(array, test);
```

### The ThreadTS Advantage

- ✅ **Universal**: Same API across all platforms
- ✅ **Simple**: One-line parallel execution
- ✅ **Complete**: Full Array API (map, filter, reduce, find, some, every)
- ✅ **Fast**: Sub-5ms overhead
- ✅ **Smart**: Auto-scaling, caching, priorities
- ✅ **Safe**: Built-in error handling, retries, and timeouts
- ✅ **Observable**: Monitoring, health checks, and events
- ✅ **Modern**: TypeScript-first with full type safety

---

**Make parallel computing as simple as writing synchronous code. Experience the future of JavaScript parallelism with ThreadTS Universal.**

[![Star on GitHub](https://img.shields.io/github/stars/threadts/universal?style=social)](https://github.com/JosunLP/ThreadTS-Universal)
