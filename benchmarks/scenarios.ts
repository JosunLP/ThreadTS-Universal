/**
 * ThreadTS Universal - Real-World Scenarios Benchmark
 * Praktische Anwendungsfälle für Performance-Validierung
 */

import { ThreadTS } from '../src/core/threadjs';

const threadjs = ThreadTS.getInstance();

async function main() {
  console.log('🌍 ThreadTS Universal - Real-World Scenarios');
  console.log('═'.repeat(50));
  console.log(`Platform: ${threadjs.getPlatform()}`);
  console.log(`Worker Support: ${threadjs.isSupported()}`);
  console.log('═'.repeat(50));

  // 1. Image Processing Simulation
  await imageProcessingScenario();

  // 2. Data Analysis Scenario
  await dataAnalysisScenario();

  // 3. Mathematical Computation
  await mathematicalComputationScenario();

  console.log('\n✅ All real-world scenarios completed successfully!');
}

async function imageProcessingScenario() {
  console.log('\n📸 Scenario: Image Processing');
  console.log('Simulating pixel manipulation on 1000x1000 image...');

  const imageData = Array.from({ length: 1000000 }, () =>
    Math.floor(Math.random() * 255)
  );

  const start = performance.now();

  // Simuliere Bildverarbeitung (Brightness Adjustment) - ohne Worker
  const processedData = imageData.map((pixel: number) => {
    // Simuliere komplexe Pixelverarbeitung
    const brightness = 1.2;
    const adjusted = Math.min(255, pixel * brightness);
    return Math.floor(adjusted);
  });

  const duration = performance.now() - start;

  console.log(
    `✅ Processed ${imageData.length} pixels in ${duration.toFixed(2)}ms`
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

  // Direkte Datenanalyse ohne Worker
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

  // Runde die Category-Totals
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
  console.log('Computing prime numbers up to 10,000...');

  const start = performance.now();

  const primes = Array.from({ length: 10000 }, (_, i) => i + 2) // Numbers 2 to 10,001
    .filter((num: number) => {
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

// Script-Ausführung
main().catch(console.error);
