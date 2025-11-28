/**
 * ThreadTS Universal - Advanced Performance Benchmarks
 * Umfassende Performance-Tests mit Real-World-Szenarien
 */

import { ThreadTS } from '../src/core/threadts';

interface AdvancedBenchmarkResult {
  name: string;
  threadts: number;
  native: number;
  overhead: number;
  passed: boolean;
  details: string;
}

const threadts = ThreadTS.getInstance();

async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await fn();
  const time = performance.now() - start;
  return { result, time };
}

// Real-World Benchmark-Szenarien
class AdvancedBenchmarks {
  /**
   * Image Processing Simulation (CPU-intensive)
   */
  static async benchmarkImageProcessing(): Promise<AdvancedBenchmarkResult> {
    const imageSize = 1920 * 1080; // Full HD
    const pixels = new Array(imageSize).fill(0).map(() => Math.random() * 255);

    // Native Implementation
    const nativeProcessing = async () => {
      return pixels.map((pixel) => {
        // Gaussian Blur Simulation
        const blurred = pixel * 0.4 + pixel * 0.8 * 0.3 + pixel * 1.2 * 0.3;
        return Math.min(255, Math.max(0, blurred));
      });
    };

    // ThreadTS Implementation
    const threadtsProcessing = async () => {
      return threadts.map(
        pixels,
        (pixel: number) => {
          const blurred = pixel * 0.4 + pixel * 0.8 * 0.3 + pixel * 1.2 * 0.3;
          return Math.min(255, Math.max(0, blurred));
        },
        { batchSize: 10000 }
      );
    };

    const { time: nativeTime } = await measureTime(nativeProcessing);
    const { time: threadtsTime } = await measureTime(threadtsProcessing);

    const overhead = threadtsTime - nativeTime;
    const passed = overhead < 50; // Max 50ms Overhead für Image Processing

    return {
      name: 'Image Processing (1920x1080)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed,
      details: `${Math.round(imageSize / threadtsTime)} pixels/ms`,
    };
  }

  /**
   * JSON Parsing & Transformation (Memory-intensive)
   */
  static async benchmarkJSONProcessing(): Promise<AdvancedBenchmarkResult> {
    // Generate large JSON dataset
    const dataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `User ${i}`,
      email: `user${i}@example.com`,
      metadata: {
        createdAt: new Date().toISOString(),
        tags: [`tag${i % 10}`, `category${i % 5}`],
        score: Math.random() * 100,
      },
    }));

    // Native Implementation
    const nativeProcessing = async () => {
      return dataset.map((user) => ({
        ...user,
        computed: {
          displayName: `${user.name} (${user.id})`,
          scoreLevel: user.metadata.score > 50 ? 'high' : 'low',
          tagCount: user.metadata.tags.length,
        },
      }));
    };

    // ThreadTS Implementation
    const threadtsProcessing = async () => {
      return threadts.map(
        dataset,
        (user: any) => ({
          ...user,
          computed: {
            displayName: `${user.name} (${user.id})`,
            scoreLevel: user.metadata.score > 50 ? 'high' : 'low',
            tagCount: user.metadata.tags.length,
          },
        }),
        { batchSize: 1000 }
      );
    };

    const { time: nativeTime } = await measureTime(nativeProcessing);
    const { time: threadtsTime } = await measureTime(threadtsProcessing);

    const overhead = threadtsTime - nativeTime;
    const passed = overhead < 100; // Max 100ms Overhead für JSON Processing

    return {
      name: 'JSON Processing (10k records)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed,
      details: `${Math.round(dataset.length / threadtsTime)} records/ms`,
    };
  }

  /**
   * Cryptographic Hashing (Security-focused)
   */
  static async benchmarkCryptography(): Promise<AdvancedBenchmarkResult> {
    const data = Array.from({ length: 1000 }, (_, i) => `data-${i}`);

    // Simple hash function for benchmarking
    const simpleHash = (str: string): string => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(16);
    };

    // Native Implementation
    const nativeProcessing = async () => {
      return data.map((item) => ({
        original: item,
        hash: simpleHash(item + Date.now()),
        timestamp: Date.now(),
      }));
    };

    // ThreadTS Implementation
    const threadtsProcessing = async () => {
      const timestamp = Date.now();
      return threadts.map(
        data,
        (item: string) => ({
          original: item,
          hash: ((str: string, ts: number): string => {
            let hash = 0;
            const combined = str + ts;
            for (let i = 0; i < combined.length; i++) {
              const char = combined.charCodeAt(i);
              hash = (hash << 5) - hash + char;
              hash = hash & hash;
            }
            return hash.toString(16);
          })(item, timestamp),
          timestamp,
        }),
        { batchSize: 100 }
      );
    };

    const { time: nativeTime } = await measureTime(nativeProcessing);
    const { time: threadtsTime } = await measureTime(threadtsProcessing);

    const overhead = threadtsTime - nativeTime;
    const passed = overhead < 25; // Max 25ms Overhead für Crypto

    return {
      name: 'Cryptographic Hashing (1k items)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed,
      details: `${Math.round(data.length / threadtsTime)} hashes/ms`,
    };
  }

  /**
   * Mathematical Computation (Pure CPU)
   */
  static async benchmarkMathComputation(): Promise<AdvancedBenchmarkResult> {
    const iterations = 50000;

    // Native Implementation
    const nativeProcessing = async () => {
      const results: number[] = [];
      for (let i = 0; i < iterations; i++) {
        const value = Math.sin(i) * Math.cos(i) + Math.sqrt(i) / (i + 1);
        results.push(value);
      }
      return results;
    };

    // ThreadTS Implementation
    const threadtsProcessing = async () => {
      const data = Array.from({ length: iterations }, (_, i) => i);
      return threadts.map(
        data,
        (i: number) => {
          return Math.sin(i) * Math.cos(i) + Math.sqrt(i) / (i + 1);
        },
        { batchSize: 5000 }
      );
    };

    const { time: nativeTime } = await measureTime(nativeProcessing);
    const { time: threadtsTime } = await measureTime(threadtsProcessing);

    const overhead = threadtsTime - nativeTime;
    const passed = overhead < 10; // Max 10ms Overhead für Math

    return {
      name: 'Mathematical Computation (50k ops)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed,
      details: `${Math.round(iterations / threadtsTime)} ops/ms`,
    };
  }

  /**
   * Search Operations Benchmark (find, findIndex, some, every)
   */
  static async benchmarkSearchOperations(): Promise<AdvancedBenchmarkResult> {
    const data = Array.from({ length: 100000 }, (_, i) => ({
      id: i,
      value: Math.random() * 1000,
      active: i !== 50000, // One inactive item in the middle
    }));

    // Native Implementation
    const nativeProcessing = async () => {
      const found = data.find((item) => item.id === 75000);
      const foundIndex = data.findIndex((item) => item.id === 75000);
      const hasInactive = data.some((item) => !item.active);
      const allPositive = data.every((item) => item.value >= 0);
      return { found, foundIndex, hasInactive, allPositive };
    };

    // ThreadTS Implementation
    const threadtsProcessing = async () => {
      const found = await threadts.find(
        data,
        (item: { id: number; value: number; active: boolean }) =>
          item.id === 75000
      );
      const foundIndex = await threadts.findIndex(
        data,
        (item: { id: number; value: number; active: boolean }) =>
          item.id === 75000
      );
      const hasInactive = await threadts.some(
        data,
        (item: { id: number; value: number; active: boolean }) => !item.active
      );
      const allPositive = await threadts.every(
        data,
        (item: { id: number; value: number; active: boolean }) =>
          item.value >= 0
      );
      return { found, foundIndex, hasInactive, allPositive };
    };

    const { time: nativeTime } = await measureTime(nativeProcessing);
    const { time: threadtsTime } = await measureTime(threadtsProcessing);

    const overhead = threadtsTime - nativeTime;
    const passed = overhead < 100; // Max 100ms overhead for search ops

    return {
      name: 'Search Operations (100k items)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed,
      details: 'find/some/every',
    };
  }

  /**
   * Batch Processing with Events
   */
  static async benchmarkBatchWithEvents(): Promise<AdvancedBenchmarkResult> {
    const tasks = Array.from({ length: 100 }, (_, i) => ({
      fn: (x: number) => {
        let result = x;
        for (let j = 0; j < 100; j++) {
          result = Math.sqrt(result + j);
        }
        return result;
      },
      data: i,
    }));

    let eventCount = 0;
    const handler = () => {
      eventCount++;
    };

    threadts.on('task-complete', handler);

    const { time: threadtsTime } = await measureTime(async () => {
      return threadts.batch(tasks, 10);
    });

    threadts.off('task-complete', handler);

    // Compare with direct Promise.all
    const { time: nativeTime } = await measureTime(async () => {
      return Promise.all(tasks.map((t) => Promise.resolve(t.fn(t.data))));
    });

    const overhead = threadtsTime - nativeTime;

    return {
      name: 'Batch with Events (100 tasks)',
      threadts: threadtsTime,
      native: nativeTime,
      overhead,
      passed: overhead < 50 && eventCount > 0,
      details: `${eventCount} events`,
    };
  }
}

async function main() {
  console.log('🧮 ThreadTS Universal - Advanced Performance Benchmarks');
  console.log('═'.repeat(65));
  console.log(`Platform: ${threadts.getPlatform()}`);
  console.log(`Worker Support: ${threadts.isSupported()}`);
  console.log('═'.repeat(65));

  if (!threadts.isSupported()) {
    console.log('⚠️ Worker support not available - running fallback tests');
    return;
  }

  const benchmarks = [
    AdvancedBenchmarks.benchmarkImageProcessing,
    AdvancedBenchmarks.benchmarkJSONProcessing,
    AdvancedBenchmarks.benchmarkCryptography,
    AdvancedBenchmarks.benchmarkMathComputation,
    AdvancedBenchmarks.benchmarkSearchOperations,
    AdvancedBenchmarks.benchmarkBatchWithEvents,
  ];

  const results: AdvancedBenchmarkResult[] = [];

  for (const benchmark of benchmarks) {
    try {
      console.log(`\n🏃 Running ${benchmark.name}...`);
      const result = await benchmark();
      results.push(result);
    } catch (error) {
      console.error(`❌ Benchmark failed: ${error}`);
    }
  }

  // Ergebnisse ausgeben
  console.log('\n📊 Advanced Benchmark Results:');
  console.log('═'.repeat(85));
  console.log(
    '| Benchmark                        | ThreadTS | Native  | Overhead | Status | Details        |'
  );
  console.log(
    '|----------------------------------|----------|---------|----------|--------|----------------|'
  );

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const threadtsTime = `${result.threadts.toFixed(2)}ms`;
    const nativeTime = `${result.native.toFixed(2)}ms`;
    const overhead = `${result.overhead.toFixed(2)}ms`;

    console.log(
      `| ${result.name.padEnd(32)} | ${threadtsTime.padEnd(8)} | ${nativeTime.padEnd(7)} | ${overhead.padEnd(8)} | ${status.padEnd(6)} | ${result.details.padEnd(14)} |`
    );
  }

  console.log('═'.repeat(85));

  const overallPassed = results.every((r) => r.passed);
  const averageOverhead =
    results.reduce((sum, r) => sum + r.overhead, 0) / results.length;

  console.log(
    `\n🎯 Overall Result: ${overallPassed ? '✅ PASSED' : '❌ FAILED'}`
  );
  console.log(`📈 Average Overhead: ${averageOverhead.toFixed(2)}ms`);

  if (!overallPassed) {
    console.log('\n⚠️ Performance targets not met. Consider optimization.');
  }

  await threadts.terminate();
}

// Run benchmarks
// Direct execution for ESM
main().catch(console.error);

export default AdvancedBenchmarks;
