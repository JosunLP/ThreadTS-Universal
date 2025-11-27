/**
 * ThreadTS Universal - Example Usage
 */

import { ThreadTS, logged, memoize, parallelMethod, rateLimit, retry, throttle, timeout } from '../src';

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

  // Parallel reduceRight
  const concatenated = await threadts.reduceRight(
    ['a', 'b', 'c', 'd'],
    (acc, x) => acc + x,
    ''
  );
  console.log('ReduceRight concat:', concatenated); // 'dcba'

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

  // Parallel flatMap
  const flatMapped = await threadts.flatMap([1, 2, 3], (x) => [x, x * 2]);
  console.log('FlatMap [1,2,3] -> [x, x*2]:', flatMapped); // [1, 2, 2, 4, 3, 6]

  // Parallel groupBy
  const users = [
    { name: 'Alice', role: 'admin' },
    { name: 'Bob', role: 'user' },
    { name: 'Charlie', role: 'admin' },
    { name: 'David', role: 'user' },
  ];
  const groupedByRole = await threadts.groupBy(users, (user) => user.role);
  console.log('GroupBy role:', groupedByRole);

  // Parallel partition
  const [evenNumbers, oddNumbers] = await threadts.partition(numbers, (x) => x % 2 === 0);
  console.log('Partition evens:', evenNumbers); // [2, 4, 6, 8, 10]
  console.log('Partition odds:', oddNumbers); // [1, 3, 5, 7, 9]

  // Parallel count
  const evenCount = await threadts.count(numbers, (x) => x % 2 === 0);
  console.log('Count evens:', evenCount); // 5
}

// Example 3: Pipeline API for fluent chaining
async function pipelineExample() {
  console.log('🔗 Pipeline API');

  const numbers = Array.from({ length: 20 }, (_, i) => i + 1);

  // Basic pipeline: map -> filter -> reduce
  const sumOfDoubledEvens = await threadts.pipe(numbers)
    .map((x) => x * 2)
    .filter((x) => x % 4 === 0)
    .reduce((acc, x) => acc + x, 0)
    .execute();
  console.log('Sum of doubled evens:', sumOfDoubledEvens);

  // Pipeline with count (counts all filtered elements)
  const countGreaterThan10 = await threadts.pipe(numbers)
    .map((x) => x * 3)
    .filter((x) => x > 10)
    .count() // Counts all remaining elements
    .execute();
  console.log('Count of items > 10 after tripling:', countGreaterThan10);

  // Pipeline with find
  const firstMatch = await threadts.pipe(numbers)
    .filter((x) => x > 15)
    .map((x) => x * 10)
    .find((x) => x > 200)
    .execute();
  console.log('First match > 200:', firstMatch);

  // Pipeline with flatMap
  const flatResult = await threadts.pipe([1, 2, 3])
    .flatMap((x) => [x, x * 10, x * 100])
    .filter((x) => x > 5)
    .reduce((acc, x) => acc + x, 0)
    .execute();
  console.log('FlatMap pipeline result:', flatResult);

  // Pipeline with some/every
  const hasLargeValue = await threadts.pipe(numbers)
    .map((x) => x * 2)
    .some((x) => x > 30)
    .execute();
  console.log('Has value > 30:', hasLargeValue);

  const allPositive = await threadts.pipe(numbers)
    .map((x) => x - 5)
    .every((x) => x > -10)
    .execute();
  console.log('All values > -10:', allPositive);
}

// Example 4: Batch processing
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

// Example 5: Using decorators
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

  @timeout(1000)
  async timedOperation(): Promise<string> {
    // Simulates long operation (will timeout if > 1000ms)
    await new Promise((resolve) => setTimeout(resolve, 500));
    return 'Completed within timeout';
  }

  @logged({ logArgs: true, logResult: true, logTiming: true })
  async loggedOperation(a: number, b: number): Promise<number> {
    return a + b;
  }

  private lastThrottleCall = 0;

  @throttle(1000)
  async throttledOperation(): Promise<string> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastThrottleCall;
    this.lastThrottleCall = now;
    return `Throttled call (interval: ${timeSinceLastCall}ms)`;
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

  // Timeout decorator
  try {
    const timedResult = await processor.timedOperation();
    console.log('Timed operation result:', timedResult);
  } catch (error: unknown) {
    console.log('Timeout error:', (error as Error).message);
  }

  // Logged decorator
  console.log('Logged operation:');
  const loggedResult = await processor.loggedOperation(5, 10);
  console.log('Logged result:', loggedResult);

  // Throttle decorator
  console.log('Throttle demo (only first call executes immediately):');
  const throttleResults = [];
  for (let i = 0; i < 3; i++) {
    const result = await processor.throttledOperation();
    throttleResults.push(result);
    await new Promise((resolve) => setTimeout(resolve, 300)); // Wait 300ms between calls
  }
  console.log('Throttle results:', throttleResults);
}

// Example 6: Performance comparison
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

// Example 7: Error handling
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

// Example 8: Event system
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

    await pipelineExample();
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
