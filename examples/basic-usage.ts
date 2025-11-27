/**
 * ThreadTS Universal - Example Usage
 */

import { ThreadTS, memoize, parallelMethod, rateLimit, retry } from '../src';

// Get instance for use throughout examples
const threadts = ThreadTS.getInstance();

// Example 1: Basic parallel execution
async function basicExample() {
  console.log('🚀 Basic Parallel Execution');

  // Basic parallel execution
  const result = await threadts.run((x: number) => x * x, 10);
  console.log('Square of 10:', result); // 100

  const complexResult = await threadts.run(
    (data: { numbers: number[] }) => {
      return data.numbers.reduce((sum, num) => sum + num * num, 0);
    },
    { numbers: [1, 2, 3, 4, 5] }
  );
  console.log('Sum of squares:', complexResult); // 55
}

// Example 2: Parallel array operations
async function arrayOperationsExample() {
  console.log('🔢 Parallel Array Operations');

  const numbers = Array.from({ length: 10 }, (_, i) => i + 1);

  // Parallel map
  const squares = await threadts.map(numbers, (x) => x * x);
  console.log('Squares:', squares);

  // Parallel filter
  const evens = await threadts.filter(numbers, (x) => x % 2 === 0);
  console.log('Even numbers:', evens);

  // Parallel reduce
  const sum = await threadts.reduce(numbers, (a, b) => a + b, 0);
  console.log('Sum:', sum);

  // Parallel find
  const firstGreaterThan5 = await threadts.find(numbers, (x) => x > 5);
  console.log('First > 5:', firstGreaterThan5); // 6

  // Parallel findIndex
  const indexGreaterThan5 = await threadts.findIndex(numbers, (x) => x > 5);
  console.log('Index of first > 5:', indexGreaterThan5); // 5

  // Parallel some
  const hasEven = await threadts.some(numbers, (x) => x % 2 === 0);
  console.log('Has even:', hasEven); // true

  // Parallel every
  const allPositive = await threadts.every(numbers, (x) => x > 0);
  console.log('All positive:', allPositive); // true

  // Parallel forEach
  console.log('forEach output:');
  await threadts.forEach(numbers.slice(0, 3), (x) => console.log(`  - ${x}`));
}

// Example 3: Batch processing
async function batchProcessingExample() {
  console.log('📦 Batch Processing');

  const largeDataset = Array.from({ length: 100 }, (_, i) => i + 1);

  const results = await threadts.batch(
    largeDataset.map((item) => ({
      fn: (x: number) => {
        // Simulate heavy computation
        let result = x;
        for (let i = 0; i < 1000; i++) {
          result = Math.sin(result) + Math.cos(result);
        }
        return result;
      },
      data: item,
    })),
    4 // Process in batches of 4
  );

  console.log('Processed', results.length, 'items');
}

// Example 4: Using decorators
class DataProcessor {
  @parallelMethod({ timeout: 5000 })
  async heavyComputation(data: number[]): Promise<number> {
    return data.reduce((sum, num) => {
      // Simulate heavy computation
      let result = num;
      for (let i = 0; i < 10000; i++) {
        result = Math.sqrt(result + i);
      }
      return sum + result;
    }, 0);
  }

  @memoize(50)
  async cachedComputation(input: string): Promise<string> {
    // This result will be cached
    return input.toUpperCase().split('').reverse().join('');
  }

  @retry(3, 500)
  async retryableOperation(): Promise<string> {
    // Simulate intermittent failure
    if (Math.random() > 0.7) {
      throw new Error('Random failure');
    }
    return 'Success!';
  }

  @rateLimit(5)
  async rateLimitedMethod(id: number): Promise<string> {
    return `Processed ${id}`;
  }
}

async function decoratorExample() {
  console.log('🎭 Decorator Example');

  const processor = new DataProcessor();

  // Parallel method
  const heavyResult = await processor.heavyComputation([1, 2, 3, 4, 5]);
  console.log('Heavy computation result:', heavyResult);

  // Memoized method (second call uses cache)
  const cached1 = await processor.cachedComputation('hello');
  const cached2 = await processor.cachedComputation('hello');
  console.log('Cached results:', cached1, cached2);

  // Retry method
  try {
    const retryResult = await processor.retryableOperation();
    console.log('Retry result:', retryResult);
  } catch (error: unknown) {
    console.log('Retry failed:', (error as Error).message);
  }

  // Rate limited method
  console.log('Rate limited calls (max 5/sec):');
  const promises = Array.from({ length: 10 }, (_, i) =>
    processor.rateLimitedMethod(i)
  );
  const rateResults = await Promise.all(promises);
  console.log('Rate limited results:', rateResults.slice(0, 3), '...');
}

// Example 5: Performance comparison
async function performanceComparison() {
  console.log('⚡ Performance Comparison');

  const fibonacci = (n: number): number => {
    if (n <= 1) return n;
    let a = 0,
      b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  };

  const numbers = [35, 36, 37, 38, 39, 40];

  // Sequential execution
  console.time('Sequential');
  const sequentialResults = numbers.map(fibonacci);
  console.timeEnd('Sequential');
  console.log('Sequential results:', sequentialResults);

  // Parallel execution
  console.time('Parallel');
  const parallelResults = await threadts.map(numbers, fibonacci);
  console.timeEnd('Parallel');
  console.log('Parallel results:', parallelResults);
}

// Example 6: Error handling
async function errorHandlingExample() {
  console.log('🚨 Error Handling');

  try {
    await threadts.run(() => {
      throw new Error('Something went wrong!');
    });
  } catch (error: unknown) {
    console.log('Caught error:', (error as Error).message);
  }

  // Timeout example
  try {
    await threadts.run(
      () => {
        // Simulate long-running task
        const start = Date.now();
        while (Date.now() - start < 2000) {
          // Busy wait
        }
        return 'This should timeout';
      },
      null,
      { timeout: 1000 }
    );
  } catch (error: unknown) {
    console.log('Timeout error:', (error as Error).message);
  }

  // Abort controller example
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 100);

  try {
    await threadts.run(
      () => {
        const start = Date.now();
        while (Date.now() - start < 500) {
          // Busy wait
        }
        return 'Should be aborted';
      },
      null,
      { signal: controller.signal }
    );
  } catch (error: unknown) {
    console.log('Abort error:', (error as Error).message);
  }
}

// Example 7: Event system
async function eventSystemExample() {
  console.log('📡 Event System');

  // Register event listeners
  const taskCompleteHandler = ({
    taskId,
    duration,
  }: {
    taskId: string;
    duration: number;
  }) => {
    console.log(`  Task ${taskId} completed in ${duration.toFixed(2)}ms`);
  };

  const taskErrorHandler = ({
    taskId,
    error,
  }: {
    taskId: string;
    error: string;
  }) => {
    console.log(`  Task ${taskId} failed: ${error}`);
  };

  threadts.on('task-complete', taskCompleteHandler);
  threadts.on('task-error', taskErrorHandler);

  // Run some tasks to trigger events
  await threadts.run((x: number) => x * 2, 5);
  await threadts.run((x: number) => x + 10, 3);

  // Cleanup listeners
  threadts.off('task-complete', taskCompleteHandler);
  threadts.off('task-error', taskErrorHandler);
}

// Main execution
async function main() {
  try {
    console.log('🌟 ThreadTS Universal Examples\n');

    await basicExample();
    console.log('');

    await arrayOperationsExample();
    console.log('');

    await batchProcessingExample();
    console.log('');

    await decoratorExample();
    console.log('');

    await performanceComparison();
    console.log('');

    await errorHandlingExample();
    console.log('');

    await eventSystemExample();
    console.log('');

    // Pool statistics
    const stats = threadts.getStats();
    console.log('📊 Pool Statistics:', stats);

    // Configuration
    const config = threadts.getConfig();
    console.log('⚙️ Current Config:', {
      poolSize: config.poolSize,
      timeout: config.timeout,
      retries: config.retries,
    });

    // Platform info
    console.log('🖥️ Platform:', threadts.getPlatform());
    console.log('✅ Worker Support:', threadts.isSupported());

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
  } finally {
    await threadts.terminate();
  }
}

// Run examples
main().catch(console.error);
