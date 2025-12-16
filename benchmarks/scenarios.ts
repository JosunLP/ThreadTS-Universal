/**
 * ThreadTS Universal - Real-World Scenarios Benchmark
 * Practical use cases for performance validation
 */

import { ThreadTS } from '../src/core/threadts';

const threadts = ThreadTS.getInstance();

async function main() {
  console.log('🌍 ThreadTS Universal - Real-World Scenarios');
  console.log('═'.repeat(50));
  console.log(`Platform: ${threadts.getPlatform()}`);
  console.log(`Worker Support: ${threadts.isSupported()}`);
  console.log('═'.repeat(50));

  // 1. Image Processing Simulation
  await imageProcessingScenario();

  // 2. Data Analysis Scenario
  await dataAnalysisScenario();

  // 3. Mathematical Computation
  await mathematicalComputationScenario();

  // 4. Search Operations Scenario
  await searchOperationsScenario();

  // 5. Validation Scenario
  await validationScenario();

  // 6. Pipeline Operations Scenario
  await pipelineScenario();

  console.log('\n✅ All real-world scenarios completed successfully!');
}

async function imageProcessingScenario() {
  console.log('\n📸 Scenario: Image Processing');
  console.log('Simulating pixel manipulation on 100x100 image...');

  // Reduced from 1M to 10K for faster execution without real workers
  const imageData = Array.from({ length: 10000 }, () =>
    Math.floor(Math.random() * 255)
  );

  const start = performance.now();

  // Simulate image processing (brightness adjustment) with ThreadTS
  const processedData = await threadts.map(
    imageData,
    (pixel: number) => {
      // Simulate complex pixel processing
      const brightness = 1.2;
      const adjusted = Math.min(255, pixel * brightness);
      return Math.floor(adjusted);
    },
    { batchSize: 5000 } // Larger batches = fewer tasks
  );

  const duration = performance.now() - start;

  console.log(
    `✅ Processed ${processedData.length} pixels in ${duration.toFixed(2)}ms`
  );
  console.log(
    `   Average: ${((duration / imageData.length) * 1000).toFixed(3)}μs per pixel`
  );
}

async function dataAnalysisScenario() {
  console.log('\n📊 Scenario: Data Analysis');
  console.log('Analyzing 50,000 data points...');

  const salesData = Array.from({ length: 50000 }, (_, i) => ({
    id: i,
    amount: Math.random() * 1000,
    date: new Date(
      2024,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28)
    ),
    category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
  }));

  const start = performance.now();

  // Direct data analysis without workers
  const analysis = {
    totalSales: Math.round(
      salesData.reduce((sum, item) => sum + item.amount, 0)
    ),
    avgSales: Math.round(
      salesData.reduce((sum, item) => sum + item.amount, 0) / salesData.length
    ),
    categoryTotals: salesData.reduce(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + item.amount;
        return acc;
      },
      {} as Record<string, number>
    ),
    recordCount: salesData.length,
  };

  // Round the category totals
  Object.keys(analysis.categoryTotals).forEach((key) => {
    analysis.categoryTotals[key] = Math.round(analysis.categoryTotals[key]);
  });

  const duration = performance.now() - start;

  console.log(
    `✅ Analyzed ${salesData.length} records in ${duration.toFixed(2)}ms`
  );
  console.log(`   Total Sales: $${analysis.totalSales.toLocaleString()}`);
  console.log(`   Average: $${analysis.avgSales.toLocaleString()}`);
  console.log(`   Categories:`, analysis.categoryTotals);
}

async function mathematicalComputationScenario() {
  console.log('\n🧮 Scenario: Mathematical Computation');
  console.log('Computing prime numbers up to 1,000...');

  const start = performance.now();

  // Reduced from 10K to 1K for faster execution
  const numbers = Array.from({ length: 1000 }, (_, i) => i + 2);
  const primes = await threadts.filter(numbers, (num: number) => {
    if (num < 2) return false;
    for (let i = 2; i <= Math.sqrt(num); i++) {
      if (num % i === 0) return false;
    }
    return true;
  });

  const duration = performance.now() - start;

  console.log(
    `✅ Found ${primes.length} prime numbers in ${duration.toFixed(2)}ms`
  );
  console.log(`   First 10 primes: [${primes.slice(0, 10).join(', ')}]`);
  console.log(`   Last 10 primes: [${primes.slice(-10).join(', ')}]`);
}

async function searchOperationsScenario() {
  console.log('\n🔍 Scenario: Search Operations');
  console.log('Testing find, findIndex, some, every on datasets...');

  interface User {
    id: number;
    name: string;
    active: boolean;
    score: number;
  }

  // Reduced to 100 for fast execution without real workers
  const users: User[] = Array.from({ length: 100 }, (_, i) => ({
    id: i,
    name: `User ${i}`,
    active: Math.random() > 0.1,
    score: Math.floor(Math.random() * 100),
  }));

  const start = performance.now();

  // Find a specific user
  const targetUser = await threadts.find(users, (user: User) => user.id === 75);
  console.log(`   Found user: ${targetUser?.name}`);

  // Find index of high scorer
  const highScorerIndex = await threadts.findIndex(
    users,
    (user: User) => user.score > 95
  );
  console.log(`   First high scorer at index: ${highScorerIndex}`);

  // Check if any user is inactive
  const hasInactive = await threadts.some(users, (user: User) => !user.active);
  console.log(`   Has inactive users: ${hasInactive}`);

  // Check if all users have valid IDs
  const allValidIds = await threadts.every(users, (user: User) => user.id >= 0);
  console.log(`   All valid IDs: ${allValidIds}`);

  const duration = performance.now() - start;
  console.log(`✅ Search operations completed in ${duration.toFixed(2)}ms`);
}

async function validationScenario() {
  console.log('\n✔️ Scenario: Data Validation');
  console.log('Validating 100 form submissions...');

  interface FormData {
    email: string;
    age: number;
    username: string;
  }

  // Reduced from 50K to 100 for fast execution
  const formSubmissions: FormData[] = Array.from({ length: 100 }, (_, i) => ({
    email: i % 10 === 0 ? 'invalid' : `user${i}@example.com`,
    age: Math.floor(Math.random() * 100),
    username: `user_${i}`,
  }));

  const start = performance.now();

  // Validate emails
  const validEmails = await threadts.filter(
    formSubmissions,
    (form: FormData) => form.email.includes('@') && form.email.includes('.')
  );

  // Find first invalid submission
  const firstInvalid = await threadts.find(
    formSubmissions,
    (form: FormData) => !form.email.includes('@')
  );

  // Check if all users are adults
  const allAdults = await threadts.every(
    formSubmissions,
    (form: FormData) => form.age >= 18
  );

  const duration = performance.now() - start;

  console.log(`✅ Validation completed in ${duration.toFixed(2)}ms`);
  console.log(
    `   Valid emails: ${validEmails.length}/${formSubmissions.length}`
  );
  console.log(`   First invalid email: ${firstInvalid?.email}`);
  console.log(`   All adults: ${allAdults}`);
}

async function pipelineScenario() {
  console.log('\n🔗 Scenario: Pipeline Operations');
  console.log('Testing new pipeline features: tap, window...');

  const numbers = Array.from({ length: 1000 }, (_, i) => i + 1);
  const start = performance.now();

  // Test tap for debugging
  let tapCount = 0;
  const tappedResult = await threadts
    .pipe(numbers.slice(0, 100))
    .tap(() => {
      tapCount++;
    })
    .map((x) => x * 2)
    .filter((x) => x > 50)
    .execute();

  // Test window for sliding windows
  const windowedResult = await threadts
    .pipe(numbers.slice(0, 20))
    .window(5, 2) // size=5, step=2
    .execute();

  // Test complex pipeline with new features
  const complexResult = await threadts
    .pipe(numbers)
    .filter((x) => x % 2 === 0)
    .take(50)
    .chunk(10)
    .execute();

  const duration = performance.now() - start;

  console.log(`✅ Pipeline operations completed in ${duration.toFixed(2)}ms`);
  console.log(`   Tap executed ${tapCount} times`);
  console.log(`   Filtered result count: ${tappedResult.length}`);
  console.log(`   Windows created: ${windowedResult.length}`);
  console.log(`   Chunks created: ${complexResult.length}`);
}

// Script execution
main().catch(console.error);
