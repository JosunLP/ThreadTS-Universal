/**
 * ThreadTS Universal - Core Performance Benchmarks
 * Fokussierte Tests auf echte Parallelisierungs-Fähigkeiten
 */

import { ThreadTS } from '../src/core/threadts';

interface BenchmarkResult {
  name: string;
  time: number;
  passed: boolean;
  details?: string;
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

async function main() {
  console.log('🚀 ThreadTS Universal - Core Performance Benchmarks');
  console.log('═'.repeat(55));
  console.log(`Platform: ${threadts.getPlatform()}`);
  console.log(`Worker Support: ${threadts.isSupported()}`);
  console.log('═'.repeat(55));

  const results: BenchmarkResult[] = [];

  if (threadts.isSupported()) {
    // Worker-basierte Tests
    results.push(await testWorkerOverhead());
    results.push(await testParallelArrayProcessing());
    results.push(await testCPUIntensiveTask());
    results.push(await testBatchProcessing());
    results.push(await testFindOperations());
    results.push(await testSomeEveryOperations());
  } else {
    // Fallback-Tests für Plattformen ohne Worker
    results.push(await testSequentialProcessing());
    results.push(await testAsynchronousProcessing());
    results.push(await testMemoryEfficiency());
  }

  // Ergebnisse ausgeben
  console.log('\n📊 Benchmark Results:');
  console.log('═'.repeat(70));
  console.log(
    '| Test                        | Time     | Status | Details        |'
  );
  console.log(
    '|-----------------------------|----------|--------|----------------|'
  );

  let allPassed = true;
  results.forEach((result) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const details = result.details || '';
    console.log(
      `| ${result.name.padEnd(27)} | ${result.time.toFixed(2).padStart(6)}ms | ${status} | ${details.padEnd(14)} |`
    );
    if (!result.passed) allPassed = false;
  });

  console.log('═'.repeat(70));
  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!allPassed) {
    console.log(
      '\n💡 Some tests failed. This might be expected on platforms without Worker support.'
    );
  }
}

// Worker-basierte Tests
async function testWorkerOverhead(): Promise<BenchmarkResult> {
  const task = (x: number) => x * 2;

  const { time } = await measureTime(async () => {
    return threadts.run(task, 42);
  });

  return {
    name: 'Worker Overhead',
    time,
    passed: time < 50, // Max 50ms für Worker-Setup
    details: 'Init cost',
  };
}

async function testParallelArrayProcessing(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i);
  const computeFn = (x: number) => Math.sqrt(x * x + 1);

  const { time } = await measureTime(async () => {
    return threadts.map(data, computeFn);
  });

  return {
    name: 'Parallel Array Map',
    time,
    passed: time < 1000, // Max 1s für 1k items
    details: '1k items',
  };
}

async function testCPUIntensiveTask(): Promise<BenchmarkResult> {
  const fibonacci = (n: number): number => {
    if (n < 2) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  };

  const { time } = await measureTime(async () => {
    return threadts.run(fibonacci, 30);
  });

  return {
    name: 'CPU Intensive Task',
    time,
    passed: time < 5000, // Max 5s für Fibonacci(30)
    details: 'Fibonacci(30)',
  };
}

async function testBatchProcessing(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 2000 }, (_, i) => i);
  const heavyTask = (x: number) => {
    let result = x;
    for (let i = 0; i < 50; i++) {
      result = Math.sqrt(result + i);
    }
    return result;
  };

  const { time } = await measureTime(async () => {
    return threadts.map(data, heavyTask, { batchSize: 200 });
  });

  return {
    name: 'Batch Processing',
    time,
    passed: time < 3000, // Max 3s für 2k items
    details: '2k batched',
  };
}

// Tests für neue Array-Methoden
async function testFindOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 10000 }, (_, i) => i);
  const targetIndex = 7500; // Element near the end

  const { time, result } = await measureTime(async () => {
    const found = await threadts.find(data, (x: number) => x === targetIndex);
    const foundIndex = await threadts.findIndex(
      data,
      (x: number) => x === targetIndex
    );
    return { found, foundIndex };
  });

  const passed =
    result.found === targetIndex &&
    result.foundIndex === targetIndex &&
    time < 2000;

  return {
    name: 'Find Operations',
    time,
    passed,
    details: 'find+findIndex',
  };
}

async function testSomeEveryOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 5000 }, (_, i) => i + 1); // 1 to 5000, all positive

  const { time, result } = await measureTime(async () => {
    const someResult = await threadts.some(
      data,
      (x: number) => x > 4000 // Should find one quickly
    );
    const everyResult = await threadts.every(
      data,
      (x: number) => x > 0 // All are positive
    );
    return { someResult, everyResult };
  });

  const passed = result.someResult === true && result.everyResult === true;

  return {
    name: 'Some/Every Operations',
    time,
    passed: passed && time < 2000,
    details: 'some+every',
  };
}

// Fallback-Tests für Plattformen ohne Worker
async function testSequentialProcessing(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i);
  const computeFn = (x: number) => Math.sqrt(x * x + 1);

  const { time } = await measureTime(async () => {
    return data.map(computeFn);
  });

  return {
    name: 'Sequential Processing',
    time,
    passed: time < 100, // Max 100ms für sequential
    details: '1k items',
  };
}

async function testAsynchronousProcessing(): Promise<BenchmarkResult> {
  const tasks = Array.from({ length: 10 }, (_, i) => i * 10);

  const { time } = await measureTime(async () => {
    return Promise.all(
      tasks.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1)); // 1ms delay
        return x * 2;
      })
    );
  });

  return {
    name: 'Async Processing',
    time,
    passed: time < 50, // Max 50ms für 10 async tasks
    details: '10 parallel',
  };
}

async function testMemoryEfficiency(): Promise<BenchmarkResult> {
  const initialMemory = process.memoryUsage().heapUsed;

  const { time } = await measureTime(async () => {
    // Erstelle und verarbeite große Arrays
    const largeArrays = Array.from({ length: 10 }, () =>
      Array.from({ length: 10000 }, (_, i) => i)
    );

    return largeArrays.map((arr) => arr.reduce((sum, val) => sum + val, 0));
  });

  const finalMemory = process.memoryUsage().heapUsed;
  const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

  return {
    name: 'Memory Efficiency',
    time,
    passed: memoryIncrease < 50, // Max 50MB memory increase
    details: `${memoryIncrease.toFixed(1)}MB`,
  };
}

// Script-Ausführung
main().catch(console.error);
