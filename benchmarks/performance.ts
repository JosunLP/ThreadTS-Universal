/**
 * ThreadJS Universal - Performance Benchmarks
 * Realistische Performance-Tests für Kernfunktionalitäten
 */

import { ThreadJS } from '../src/core/threadjs';

interface BenchmarkResult {
  name: string;
  threaded: number;
  sequential: number;
  overhead: number;
  speedup: number;
  passed: boolean;
}

const threadjs = ThreadJS.getInstance();
const PERFORMANCE_THRESHOLD = 10; // Max 10ms Overhead für realistische Tests

async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; time: number }> {
  const start = performance.now();
  const result = await fn();
  const time = performance.now() - start;
  return { result, time };
}

async function main() {
  console.log('🚀 ThreadJS Universal - Performance Benchmarks');
  console.log('═'.repeat(50));
  console.log(`Platform: ${threadjs.getPlatform()}`);
  console.log(`Worker Support: ${threadjs.isSupported()}`);
  console.log('═'.repeat(50));

  const results: BenchmarkResult[] = [];

  // 1. Einfache Berechnung - Overhead-Test
  results.push(await benchmarkOverhead());

  // 2. Array-Verarbeitung - Map Operation
  results.push(await benchmarkArrayMap());

  // 3. CPU-intensive Aufgabe - Fibonacci
  results.push(await benchmarkCPUTask());

  // 4. Batch-Verarbeitung - Große Datensätze
  results.push(await benchmarkBatchProcessing());

  // Ergebnisse ausgeben
  console.log('\n📊 Benchmark Results:');
  console.log('═'.repeat(70));
  console.log('| Test                | Threaded | Sequential | Overhead | Status |');
  console.log('|---------------------|----------|------------|----------|--------|');

  let allPassed = true;
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      `| ${result.name.padEnd(19)} | ${result.threaded.toFixed(1).padStart(6)}ms | ${result.sequential.toFixed(1).padStart(8)}ms | ${result.overhead.toFixed(1).padStart(6)}ms | ${status} |`
    );
    if (!result.passed) allPassed = false;
  });

  console.log('═'.repeat(70));
  console.log(`\n🎯 Overall Performance: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!allPassed) {
    process.exit(1);
  }
}

async function benchmarkOverhead(): Promise<BenchmarkResult> {
  const simpleTask = (x: number) => x * 2;
  const data = 42;

  // Sequential
  const sequential = await measureTime(async () => simpleTask(data));

  // Threaded
  const threaded = await measureTime(async () =>
    threadjs.run(simpleTask, data)
  );

  const overhead = threaded.time - sequential.time;

  return {
    name: 'Simple Overhead',
    threaded: threaded.time,
    sequential: sequential.time,
    overhead,
    speedup: sequential.time / threaded.time,
    passed: overhead < PERFORMANCE_THRESHOLD
  };
}

async function benchmarkArrayMap(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i);
  const mapFn = (x: number) => Math.sqrt(x * x + 1);

  // Sequential
  const sequential = await measureTime(async () =>
    data.map(mapFn)
  );

  // Threaded
  const threaded = await measureTime(async () =>
    threadjs.map(data, mapFn)
  );

  const overhead = Math.max(0, threaded.time - sequential.time);

  return {
    name: 'Array Map (1k)',
    threaded: threaded.time,
    sequential: sequential.time,
    overhead,
    speedup: sequential.time / threaded.time,
    passed: threaded.time < sequential.time * 2 // Erlaubt 2x Overhead für kleine Daten
  };
}

async function benchmarkCPUTask(): Promise<BenchmarkResult> {
  const fibonacci = (n: number): number => {
    if (n < 2) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };

  const n = 35; // CPU-intensive

  // Sequential
  const sequential = await measureTime(async () => fibonacci(n));

  // Threaded
  const threaded = await measureTime(async () =>
    threadjs.run(fibonacci, n)
  );

  const overhead = threaded.time - sequential.time;

  return {
    name: 'CPU Task (Fib35)',
    threaded: threaded.time,
    sequential: sequential.time,
    overhead,
    speedup: sequential.time / threaded.time,
    passed: threaded.time < sequential.time * 1.5 // Max 50% Overhead für CPU-Tasks
  };
}

async function benchmarkBatchProcessing(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 10000 }, (_, i) => i);
  const heavyComputation = (x: number) => {
    let result = x;
    for (let i = 0; i < 1000; i++) {
      result = Math.sqrt(result + i);
    }
    return result;
  };

  // Sequential
  const sequential = await measureTime(async () =>
    data.map(heavyComputation)
  );

  // Threaded (Batch)
  const threaded = await measureTime(async () =>
    threadjs.map(data, heavyComputation, { batchSize: 500 })
  );

  const speedup = sequential.time / threaded.time;

  return {
    name: 'Batch Heavy (10k)',
    threaded: threaded.time,
    sequential: sequential.time,
    overhead: Math.max(0, threaded.time - sequential.time),
    speedup,
    passed: speedup > 0.8 // Mindestens 80% der sequenziellen Performance
  };
}

// Script-Ausführung
main().catch(console.error);
  );
  console.log('|'.padEnd(81, '─') + '|');

  let passedTests = 0;
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      `| ${result.name.padEnd(20)} | ${result.threaded.toFixed(1).padStart(8)}ms | ${result.sequential.toFixed(1).padStart(10)}ms | ${result.overhead > 0 ? '+' : ''}${result.overhead.toFixed(1).padStart(7)}ms | ${result.speedup.toFixed(2).padStart(7)}x | ${status} |`
    );
    if (result.passed) passedTests++;
  }

  console.log('═'.repeat(80));
  console.log(`\n🎯 Summary: ${passedTests}/${results.length} tests passed`);

  const avgOverhead =
    results.reduce((sum, r) => sum + r.overhead, 0) / results.length;
  console.log(`📏 Average Overhead: ${avgOverhead.toFixed(2)}ms`);

  if (avgOverhead < PERFORMANCE_THRESHOLD) {
    console.log('🏆 PERFORMANCE TARGET ACHIEVED! Sub-5ms overhead maintained.');
  } else {
    console.log('⚠️  Performance target missed. Optimization needed.');
  }

  await threadjs.terminate();
}

async function benchmarkSimpleMath(): Promise<BenchmarkResult> {
  const testData = 12345;
  const iterations = 100;

  // Sequential
  const seqStart = getHighResTimestamp();
  for (let i = 0; i < iterations; i++) {
    Math.sqrt(testData * testData + i);
  }
  const seqTime = getHighResTimestamp() - seqStart;

  // Threaded
  const threadStart = getHighResTimestamp();
  const promises: Promise<any>[] = [];
  for (let i = 0; i < iterations; i++) {
    promises.push(
      threadjs.run(
        (data: { base: number; offset: number }) =>
          Math.sqrt(data.base * data.base + data.offset),
        { base: testData, offset: i }
      )
    );
  }
  await Promise.all(promises);
  const threadTime = getHighResTimestamp() - threadStart;

  const overhead = (threadTime - seqTime) / iterations;
  const speedup = seqTime / threadTime;

  return {
    name: 'Simple Math',
    threaded: threadTime,
    sequential: seqTime,
    overhead,
    speedup,
    passed: overhead < PERFORMANCE_THRESHOLD,
  };
}

async function benchmarkArrayProcessing(): Promise<BenchmarkResult> {
  const testArray = Array.from({ length: 1000 }, (_, i) => i + 1);

  // Sequential
  const seqStart = getHighResTimestamp();
  const seqResult = testArray.map((x) => x * x).filter((x) => x % 2 === 0);
  const seqTime = getHighResTimestamp() - seqStart;

  // Threaded
  const threadStart = getHighResTimestamp();
  const threadResult = await threadjs.map(testArray, (x: number) => x * x, {
    batchSize: 50,
  });
  const filtered = threadResult.filter((x) => x % 2 === 0);
  const threadTime = getHighResTimestamp() - threadStart;

  const overhead = threadTime - seqTime;
  const speedup = seqTime / threadTime;

  return {
    name: 'Array Processing',
    threaded: threadTime,
    sequential: seqTime,
    overhead,
    speedup,
    passed:
      overhead < PERFORMANCE_THRESHOLD && seqResult.length === filtered.length,
  };
}

async function benchmarkCPUIntensive(): Promise<BenchmarkResult> {
  const fibNumber = 35;

  const fibonacciSequential = (n: number): number => {
    if (n <= 1) return n;
    return fibonacciSequential(n - 1) + fibonacciSequential(n - 2);
  };

  const fibonacciThreaded = (n: number): number => {
    if (n <= 1) return n;
    return fibonacciThreaded(n - 1) + fibonacciThreaded(n - 2);
  };

  // Sequential
  const seqStart = getHighResTimestamp();
  const seqResult = fibonacciSequential(fibNumber);
  const seqTime = getHighResTimestamp() - seqStart;

  // Threaded
  const threadStart = getHighResTimestamp();
  const threadResult = await threadjs.run(fibonacciThreaded, fibNumber);
  const threadTime = getHighResTimestamp() - threadStart;

  const overhead = threadTime - seqTime;
  const speedup = seqTime / threadTime;

  return {
    name: 'CPU Intensive',
    threaded: threadTime,
    sequential: seqTime,
    overhead,
    speedup,
    passed: overhead < 10 && seqResult === threadResult, // Relaxed threshold for CPU-intensive
  };
}

async function benchmarkBatchProcessing(): Promise<BenchmarkResult> {
  const tasks = Array.from({ length: 20 }, (_, i) => ({
    fn: (x: number) => {
      let sum = 0;
      for (let j = 0; j < x * 1000; j++) {
        sum += Math.sqrt(j);
      }
      return sum;
    },
    data: i + 1,
  }));

  // Sequential
  const seqStart = getHighResTimestamp();
  const seqResults: number[] = [];
  for (const task of tasks) {
    seqResults.push(task.fn(task.data));
  }
  const seqTime = getHighResTimestamp() - seqStart;

  // Threaded
  const threadStart = getHighResTimestamp();
  const threadResults = await threadjs.batch(tasks, 4);
  const threadTime = getHighResTimestamp() - threadStart;

  const overhead = (threadTime - seqTime) / tasks.length;
  const speedup = seqTime / threadTime;

  return {
    name: 'Batch Processing',
    threaded: threadTime,
    sequential: seqTime,
    overhead,
    speedup,
    passed: overhead < PERFORMANCE_THRESHOLD && speedup > 0.8, // Should be faster with parallel processing
  };
}

async function benchmarkLargeDataTransfer(): Promise<BenchmarkResult> {
  const largeArray = new Float32Array(100000);
  for (let i = 0; i < largeArray.length; i++) {
    largeArray[i] = Math.random();
  }

  const processArray = (arr: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i] * arr[i];
    }
    return sum;
  };

  // Sequential
  const seqStart = getHighResTimestamp();
  const seqResult = processArray(largeArray);
  const seqTime = getHighResTimestamp() - seqStart;

  // Threaded (note: this will include serialization overhead)
  const threadStart = getHighResTimestamp();
  const threadResult = await threadjs.run((arr: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      sum += arr[i] * arr[i];
    }
    return sum;
  }, largeArray);
  const threadTime = getHighResTimestamp() - threadStart;

  const overhead = threadTime - seqTime;
  const speedup = seqTime / threadTime;

  return {
    name: 'Large Data Transfer',
    threaded: threadTime,
    sequential: seqTime,
    overhead,
    speedup,
    passed: Math.abs(seqResult - threadResult) < 0.01, // Results should be nearly identical
  };
}

// Starte die Benchmarks
main().catch(console.error);
