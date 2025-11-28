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
    results.push(await testFlatMapOperation());
    results.push(await testGroupByPartitionOperations());
    results.push(await testPipelineAPI());
    // NEW: Pipeline Extension Tests
    results.push(await testPipelineTakeSkipOperations());
    results.push(await testPipelineDistinctChunkOperations());
    results.push(await testPipelineSortReverseOperations());
    results.push(await testPipelineFirstLastOperations());
    // NEW: Advanced Pipeline Extension Tests
    results.push(await testPipelineZipOperations());
    results.push(await testPipelineCompactFlattenOperations());
    results.push(await testPipelineShuffleSampleOperations());
    results.push(await testPipelineDropTakeWhileOperations());
    results.push(await testPipelineJoinIncludesOperations());
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

// Tests für neue Array-Methoden (flatMap, groupBy, partition)
async function testFlatMapOperation(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i + 1);

  const { time, result } = await measureTime(async () => {
    return threadts.flatMap(data, (x: number) => [x, x * 2]);
  });

  const passed = result.length === 2000 && result[0] === 1 && result[1] === 2;

  return {
    name: 'FlatMap Operation',
    time,
    passed: passed && time < 2000,
    details: '1k -> 2k items',
  };
}

async function testGroupByPartitionOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 2000 }, (_, i) => ({
    id: i,
    category: i % 5, // 5 different categories
    value: i * 10,
  }));

  const { time, result } = await measureTime(async () => {
    const grouped = await threadts.groupBy(data, (item: { category: number }) =>
      String(item.category)
    );
    const [evens, odds] = await threadts.partition(
      data,
      (item: { id: number }) => item.id % 2 === 0
    );
    return {
      groupedKeys: Object.keys(grouped).length,
      evensCount: evens.length,
      oddsCount: odds.length,
    };
  });

  const passed =
    result.groupedKeys === 5 &&
    result.evensCount === 1000 &&
    result.oddsCount === 1000;

  return {
    name: 'GroupBy/Partition',
    time,
    passed: passed && time < 3000,
    details: 'group+partition',
  };
}

async function testPipelineAPI(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 5000 }, (_, i) => i + 1);

  const { time, result } = await measureTime(async () => {
    // Pipeline: map -> filter -> reduce
    const pipelineResult = await threadts
      .pipe(data)
      .map((x: number) => x * 2)
      .filter((x: number) => x % 4 === 0)
      .reduce((acc: number, x: number) => acc + x, 0)
      .execute();
    return pipelineResult;
  });

  // Sum of all even numbers doubled: 2+4+6+...+10000 = 2*(1+2+3+...+5000) = 2*12502500 = 25005000
  // But we filter only those divisible by 4 after doubling (i.e., multiples of 4)
  // Original evens: 2,4,6,...,5000 -> doubled: 4,8,12,...,10000 (all divisible by 4)
  // Sum: 4+8+12+...+10000 = 4*(1+2+...+2500) = 4*3126250 = 12505000
  const expectedSum = 12505000;
  const passed = result === expectedSum;

  return {
    name: 'Pipeline API',
    time,
    passed: passed && time < 3000,
    details: 'map->filter->reduce',
  };
}

// NEW: Tests for new Pipeline operations
async function testPipelineTakeSkipOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 10000 }, (_, i) => i + 1);

  const { time, result } = await measureTime(async () => {
    // Test take and skip operations
    const takeResult = await threadts.pipe(data).take(100).execute();

    const skipResult = await threadts.pipe(data).skip(9900).execute();

    const combinedResult = await threadts
      .pipe(data)
      .skip(500)
      .take(50)
      .execute();

    return { takeResult, skipResult, combinedResult };
  });

  const passed =
    result.takeResult.length === 100 &&
    result.takeResult[0] === 1 &&
    result.takeResult[99] === 100 &&
    result.skipResult.length === 100 &&
    result.skipResult[0] === 9901 &&
    result.combinedResult.length === 50 &&
    result.combinedResult[0] === 501;

  return {
    name: 'Pipeline Take/Skip',
    time,
    passed: passed && time < 1000,
    details: 'take+skip ops',
  };
}

async function testPipelineDistinctChunkOperations(): Promise<BenchmarkResult> {
  // Create data with duplicates
  const data = Array.from({ length: 1000 }, (_, i) => i % 100); // 0-99 repeated 10 times

  const { time, result } = await measureTime(async () => {
    // Test unique operation (distinct)
    const uniqueResult = await threadts.pipe(data).unique().execute();

    // Test chunk operation
    const chunkResult = await threadts.pipe(data).chunk(100).execute();

    return { uniqueResult, chunkResult };
  });

  const passed =
    result.uniqueResult.length === 100 &&
    result.chunkResult.length === 10 &&
    result.chunkResult[0].length === 100;

  return {
    name: 'Pipeline Unique/Chunk',
    time,
    passed: passed && time < 1000,
    details: 'unique+chunk',
  };
}

async function testPipelineSortReverseOperations(): Promise<BenchmarkResult> {
  // Create shuffled data
  const data = Array.from({ length: 1000 }, (_, i) => i + 1).sort(
    () => Math.random() - 0.5
  );

  const { time, result } = await measureTime(async () => {
    // Test sort operation
    const sortedResult = await threadts
      .pipe(data)
      .sort((a: number, b: number) => a - b)
      .execute();

    // Test reverse operation
    const reversedResult = await threadts
      .pipe([1, 2, 3, 4, 5])
      .reverse()
      .execute();

    // Test combined sort + reverse
    const combinedResult = await threadts
      .pipe(data)
      .sort((a: number, b: number) => a - b)
      .reverse()
      .take(5)
      .execute();

    return { sortedResult, reversedResult, combinedResult };
  });

  const passed =
    result.sortedResult[0] === 1 &&
    result.sortedResult[999] === 1000 &&
    result.reversedResult[0] === 5 &&
    result.reversedResult[4] === 1 &&
    result.combinedResult[0] === 1000 &&
    result.combinedResult.length === 5;

  return {
    name: 'Pipeline Sort/Reverse',
    time,
    passed: passed && time < 2000,
    details: 'sort+reverse',
  };
}

async function testPipelineFirstLastOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 5000 }, (_, i) => i + 1);

  const { time, result } = await measureTime(async () => {
    // Test first operation
    const firstResult = await threadts.pipe(data).first().execute();

    // Test last operation
    const lastResult = await threadts.pipe(data).last().execute();

    // Test first with condition (via filter + first)
    const firstEvenOver100 = await threadts
      .pipe(data)
      .filter((x: number) => x > 100 && x % 2 === 0)
      .first()
      .execute();

    // Test groupBy in pipeline
    const groupedResult = await threadts
      .pipe(data)
      .take(100)
      .groupBy((x: number) => x % 10)
      .execute();

    return { firstResult, lastResult, firstEvenOver100, groupedResult };
  });

  const passed =
    result.firstResult === 1 &&
    result.lastResult === 5000 &&
    result.firstEvenOver100 === 102 &&
    Object.keys(result.groupedResult).length === 10;

  return {
    name: 'Pipeline First/Last',
    time,
    passed: passed && time < 1500,
    details: 'first+last+groupBy',
  };
}

// NEW: Advanced Pipeline Operations Tests
async function testPipelineZipOperations(): Promise<BenchmarkResult> {
  const names = Array.from({ length: 1000 }, (_, i) => `User${i}`);
  const ages = Array.from({ length: 1000 }, (_, i) => 20 + (i % 50));

  const { time, result } = await measureTime(async () => {
    // Test zip
    const zipped = await threadts.pipe(names).zip(ages).execute();

    // Test zipWith
    const combined = await threadts
      .pipe(names)
      .zipWith(ages, (name, age) => ({ name, age }))
      .execute();

    // Test interleave
    const interleaved = await threadts
      .pipe(['a', 'b', 'c'])
      .interleave([1, 2, 3])
      .execute();

    return { zipped: zipped.length, combined: combined.length, interleaved };
  });

  const passed =
    result.zipped === 1000 &&
    result.combined === 1000 &&
    result.interleaved.length === 6;

  return {
    name: 'Pipeline Zip/Interleave',
    time,
    passed: passed && time < 500,
    details: `${result.zipped} items`,
  };
}

async function testPipelineCompactFlattenOperations(): Promise<BenchmarkResult> {
  const sparseData = Array.from({ length: 2000 }, (_, i) =>
    i % 3 === 0 ? null : i % 5 === 0 ? undefined : i
  );
  const nestedData = Array.from({ length: 500 }, (_, i) => [i * 2, i * 2 + 1]);

  const { time, result } = await measureTime(async () => {
    // Test compact
    const compacted = await threadts.pipe(sparseData).compact().execute();

    // Test flatten
    const flattened = await threadts.pipe(nestedData).flatten().execute();

    return { compactedLen: compacted.length, flattenedLen: flattened.length };
  });

  const passed = result.compactedLen > 0 && result.flattenedLen === 1000;

  return {
    name: 'Pipeline Compact/Flatten',
    time,
    passed: passed && time < 500,
    details: `${result.compactedLen} compact`,
  };
}

async function testPipelineShuffleSampleOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i);

  const { time, result } = await measureTime(async () => {
    // Test shuffle (verify length is preserved)
    const shuffled = await threadts.pipe(data).shuffle().execute();

    // Test sample
    const sampled = await threadts.pipe(data).sample(100).execute();

    // Verify shuffle actually shuffles (first 10 elements should differ)
    let shuffledDiffers = false;
    for (let i = 0; i < 10; i++) {
      if (shuffled[i] !== data[i]) {
        shuffledDiffers = true;
        break;
      }
    }

    return {
      shuffledLen: shuffled.length,
      sampledLen: sampled.length,
      shuffledDiffers,
    };
  });

  const passed =
    result.shuffledLen === 1000 &&
    result.sampledLen === 100 &&
    result.shuffledDiffers;

  return {
    name: 'Pipeline Shuffle/Sample',
    time,
    passed: passed && time < 200,
    details: `${result.sampledLen} sampled`,
  };
}

async function testPipelineDropTakeWhileOperations(): Promise<BenchmarkResult> {
  const data = Array.from({ length: 1000 }, (_, i) => i);

  const { time, result } = await measureTime(async () => {
    // Test dropWhile
    const dropped = await threadts
      .pipe(data)
      .dropWhile((x: number) => x < 500)
      .execute();

    // Test takeWhile
    const taken = await threadts
      .pipe(data)
      .takeWhile((x: number) => x < 200)
      .execute();

    return {
      droppedLen: dropped.length,
      takenLen: taken.length,
      droppedFirst: dropped[0],
      takenLast: taken[taken.length - 1],
    };
  });

  const passed =
    result.droppedLen === 500 &&
    result.takenLen === 200 &&
    result.droppedFirst === 500 &&
    result.takenLast === 199;

  return {
    name: 'Pipeline Drop/TakeWhile',
    time,
    passed: passed && time < 200,
    details: `${result.droppedLen} dropped`,
  };
}

async function testPipelineJoinIncludesOperations(): Promise<BenchmarkResult> {
  const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
  const numbers = Array.from({ length: 1000 }, (_, i) => i);

  const { time, result } = await measureTime(async () => {
    // Test join
    const joined = await threadts.pipe(words).join(', ').execute();

    // Test includes (existing element)
    const hasWord50 = await threadts.pipe(words).includes('word50').execute();

    // Test includes (non-existing element)
    const hasWord999 = await threadts.pipe(words).includes('word999').execute();

    // Test includes with numbers
    const has500 = await threadts.pipe(numbers).includes(500).execute();

    return { joinedLen: joined.length, hasWord50, hasWord999, has500 };
  });

  const passed =
    result.joinedLen > 0 &&
    result.hasWord50 === true &&
    result.hasWord999 === false &&
    result.has500 === true;

  return {
    name: 'Pipeline Join/Includes',
    time,
    passed: passed && time < 200,
    details: `join: ${result.joinedLen} chars`,
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
