/**
 * ThreadTS Universal - Extended Array Operations Demo
 *
 * This example demonstrates the new extended array operations
 * that go beyond the standard JavaScript Array API.
 */

import { ThreadTS } from '../src';

// Get ThreadTS instance
const threadts = ThreadTS.getInstance();

// ===========================================
// Section 1: Basic Array Lookup Operations
// ===========================================
async function basicLookupOperations() {
  console.log('🔍 Basic Array Lookup Operations\n');

  const numbers = [1, 2, 3, 4, 2, 5, 2, 6];

  // indexOf - find first occurrence
  const firstIndex = await threadts.indexOf(numbers, 2);
  console.log('indexOf(2):', firstIndex); // 1

  // indexOf with fromIndex
  const indexFrom = await threadts.indexOf(numbers, 2, 2);
  console.log('indexOf(2, fromIndex=2):', indexFrom); // 4

  // lastIndexOf - find last occurrence
  const lastIndex = await threadts.lastIndexOf(numbers, 2);
  console.log('lastIndexOf(2):', lastIndex); // 6

  // at - access by index (supports negative)
  const first = await threadts.at(numbers, 0);
  const last = await threadts.at(numbers, -1);
  const secondLast = await threadts.at(numbers, -2);
  console.log('at(0):', first); // 1
  console.log('at(-1):', last); // 6
  console.log('at(-2):', secondLast); // 2

  // Not found cases
  const notFound = await threadts.indexOf(numbers, 99);
  console.log('indexOf(99):', notFound); // -1

  const outOfBounds = await threadts.at(numbers, 100);
  console.log('at(100):', outOfBounds); // undefined
}

// ===========================================
// Section 2: Array Slicing and Concatenation
// ===========================================
async function sliceAndConcatOperations() {
  console.log('\n✂️ Array Slicing and Concatenation\n');

  const letters = ['a', 'b', 'c', 'd', 'e', 'f'];

  // slice - extract portions
  const middle = await threadts.slice(letters, 1, 4);
  console.log('slice(1, 4):', middle); // ['b', 'c', 'd']

  const fromStart = await threadts.slice(letters, 0, 3);
  console.log('slice(0, 3):', fromStart); // ['a', 'b', 'c']

  const fromEnd = await threadts.slice(letters, -2);
  console.log('slice(-2):', fromEnd); // ['e', 'f']

  const negativeRange = await threadts.slice(letters, -4, -1);
  console.log('slice(-4, -1):', negativeRange); // ['c', 'd', 'e']

  // concat - combine arrays and values
  const arr1 = [1, 2];
  const arr2 = [3, 4];
  const combined = await threadts.concat(arr1, arr2, 5, [6, 7]);
  console.log('concat([1,2], [3,4], 5, [6,7]):', combined);
  // [1, 2, 3, 4, 5, 6, 7]
}

// ===========================================
// Section 3: Range and Repeat Generators
// ===========================================
async function generatorOperations() {
  console.log('\n🔢 Range and Repeat Generators\n');

  // range - generate number sequences
  const basicRange = await threadts.range(0, 5);
  console.log('range(0, 5):', basicRange); // [0, 1, 2, 3, 4]

  const rangeWithStep = await threadts.range(0, 10, 2);
  console.log('range(0, 10, 2):', rangeWithStep); // [0, 2, 4, 6, 8]

  const countdown = await threadts.range(5, 0, -1);
  console.log('range(5, 0, -1):', countdown); // [5, 4, 3, 2, 1]

  const negativeRange = await threadts.range(-5, 5, 2);
  console.log('range(-5, 5, 2):', negativeRange); // [-5, -3, -1, 1, 3]

  // repeat - create repeated values
  const repeatedX = await threadts.repeat('x', 5);
  console.log("repeat('x', 5):", repeatedX); // ['x', 'x', 'x', 'x', 'x']

  const repeatedObject = await threadts.repeat({ value: 0 }, 3);
  console.log('repeat({ value: 0 }, 3):', repeatedObject);
  // [{ value: 0 }, { value: 0 }, { value: 0 }]
}

// ===========================================
// Section 4: Unique Operations
// ===========================================
async function uniqueOperations() {
  console.log('\n🎯 Unique Operations\n');

  // unique - remove duplicates (primitives)
  const numbers = [1, 2, 2, 3, 3, 3, 4, 4, 4, 4];
  const uniqueNumbers = await threadts.unique(numbers);
  console.log('unique([1,2,2,3,3,3,4,4,4,4]):', uniqueNumbers);
  // [1, 2, 3, 4]

  const strings = ['apple', 'banana', 'apple', 'cherry', 'banana'];
  const uniqueStrings = await threadts.unique(strings);
  console.log('unique(strings):', uniqueStrings);
  // ['apple', 'banana', 'cherry']

  // uniqueBy - remove duplicates by key function
  const users = [
    { id: 1, name: 'Alice', role: 'admin' },
    { id: 2, name: 'Bob', role: 'user' },
    { id: 1, name: 'Alice Clone', role: 'admin' },
    { id: 3, name: 'Charlie', role: 'user' },
    { id: 2, name: 'Bob Clone', role: 'moderator' },
  ];

  const uniqueById = await threadts.uniqueBy(users, (u) => u.id);
  console.log('uniqueBy(id):');
  console.log('  Result:', uniqueById);
  // [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Charlie' }]

  const uniqueByRole = await threadts.uniqueBy(users, (u) => u.role);
  console.log('uniqueBy(role):');
  console.log('  Result:', uniqueByRole);
  // First of each role: admin, user, moderator
}

// ===========================================
// Section 5: Chunk Operation
// ===========================================
async function chunkOperations() {
  console.log('\n📦 Chunk Operations\n');

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Basic chunking
  const chunks2 = await threadts.chunk(numbers, 2);
  console.log('chunk(10 items, size 2):', chunks2);
  // [[1,2], [3,4], [5,6], [7,8], [9,10]]

  const chunks3 = await threadts.chunk(numbers, 3);
  console.log('chunk(10 items, size 3):', chunks3);
  // [[1,2,3], [4,5,6], [7,8,9], [10]]

  const chunks5 = await threadts.chunk(numbers, 5);
  console.log('chunk(10 items, size 5):', chunks5);
  // [[1,2,3,4,5], [6,7,8,9,10]]

  // Chunk size larger than array
  const largeChunk = await threadts.chunk([1, 2, 3], 10);
  console.log('chunk(3 items, size 10):', largeChunk);
  // [[1, 2, 3]]
}

// ===========================================
// Section 6: Zip Operation
// ===========================================
async function zipOperations() {
  console.log('\n🤝 Zip Operations\n');

  const names = ['Alice', 'Bob', 'Charlie', 'David'];
  const ages = [25, 30, 35, 40];
  const cities = ['NYC', 'LA', 'Chicago', 'Miami'];

  // Basic zip
  const zipped = await threadts.zip(names, ages);
  console.log('zip(names, ages):');
  console.log('  Result:', zipped);
  // [['Alice', 25], ['Bob', 30], ['Charlie', 35], ['David', 40]]

  // Zip with different lengths (takes minimum)
  const shortAges = [25, 30];
  const partialZip = await threadts.zip(names, shortAges);
  console.log('zip(4 names, 2 ages):');
  console.log('  Result:', partialZip);
  // [['Alice', 25], ['Bob', 30]]
}

// ===========================================
// Section 7: Using the Array Operations Factory
// ===========================================
async function factoryUsage() {
  console.log('\n🏭 Using Array Operations Factory\n');

  // Get the array operations factory
  const arrayOps = threadts.getArrayOps();

  // Use operations through the factory
  const data = [5, 3, 1, 4, 2, 3, 5, 1];

  console.log('Original data:', data);

  // Chain of operations through factory
  const uniqueData = await arrayOps.unique(data);
  console.log('unique():', uniqueData); // [5, 3, 1, 4, 2]

  const sortedUnique = (await arrayOps.unique(data)).sort((a, b) => a - b);
  console.log('unique + sort:', sortedUnique); // [1, 2, 3, 4, 5]

  // Generate ranges
  const rangeData = await arrayOps.range(1, 11);
  console.log('range(1, 11):', rangeData); // [1...10]

  // Chunk the range
  const chunkedRange = await arrayOps.chunk(rangeData, 3);
  console.log('chunk(range, 3):', chunkedRange);
  // [[1,2,3], [4,5,6], [7,8,9], [10]]

  // Find indices
  const sampleArray = ['a', 'b', 'c', 'b', 'a'];
  console.log('\nSample array:', sampleArray);
  console.log("indexOf('b'):", await arrayOps.indexOf(sampleArray, 'b')); // 1
  console.log(
    "lastIndexOf('b'):",
    await arrayOps.lastIndexOf(sampleArray, 'b')
  ); // 3
}

// ===========================================
// Section 8: New Pipeline Operations
// ===========================================
async function pipelineOperationsDemo() {
  console.log('\n🔗 New Pipeline Operations\n');

  // slicePipe - extract portion in pipeline
  const sliced = await threadts
    .pipe([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    .slicePipe(2, 7)
    .execute();
  console.log('slicePipe(2, 7):', sliced); // [3, 4, 5, 6, 7]

  // concatPipe - append arrays in pipeline
  const concatenated = await threadts
    .pipe([1, 2, 3])
    .concatPipe([4, 5, 6])
    .map((x) => x * 2)
    .execute();
  console.log('concatPipe + map(*2):', concatenated); // [2,4,6,8,10,12]

  // rotate - rotate array elements
  const rotatedRight = await threadts
    .pipe([1, 2, 3, 4, 5])
    .rotate(2) // Rotate right by 2
    .execute();
  console.log('rotate(2) [right]:', rotatedRight); // [4, 5, 1, 2, 3]

  const rotatedLeft = await threadts
    .pipe([1, 2, 3, 4, 5])
    .rotate(-2) // Rotate left by 2
    .execute();
  console.log('rotate(-2) [left]:', rotatedLeft); // [3, 4, 5, 1, 2]

  // truthy - keep only truthy values
  const mixedValues = [0, 1, '', 'hello', null, undefined, true, false, 42];
  const truthyValues = await threadts.pipe(mixedValues).truthy().execute();
  console.log('truthy():', truthyValues); // [1, 'hello', true, 42]

  // falsy - keep only falsy values
  const falsyValues = await threadts.pipe(mixedValues).falsy().execute();
  console.log('falsy():', falsyValues); // [0, '', null, undefined, false]

  // Combined pipeline example
  console.log('\n--- Combined Pipeline Example ---');
  const result = await threadts
    .pipe([10, 20, 30, 40, 50])
    .concatPipe([60, 70, 80])
    .slicePipe(1, 6)
    .map((x) => x / 10)
    .rotate(1)
    .execute();
  console.log('Combined result:', result);
  // concatPipe: [10,20,30,40,50,60,70,80]
  // slicePipe(1,6): [20,30,40,50,60]
  // map(/10): [2,3,4,5,6]
  // rotate(1): [6,2,3,4,5]
}

// ===========================================
// Section 9: Practical Use Cases
// ===========================================
async function practicalUseCases() {
  console.log('\n💡 Practical Use Cases\n');

  // Use Case 1: Pagination
  console.log('--- Use Case 1: Pagination ---');
  const allItems = await threadts.range(1, 101); // 100 items
  const pageSize = 10;
  const pageNumber = 3; // Get page 3 (1-indexed)

  const pageStart = (pageNumber - 1) * pageSize;
  const pageItems = await threadts.slice(
    allItems,
    pageStart,
    pageStart + pageSize
  );
  console.log(
    `Page ${pageNumber} (items ${pageStart + 1}-${pageStart + pageSize}):`,
    pageItems
  );

  // Use Case 2: Deduplication with key
  console.log('\n--- Use Case 2: Deduplicate API Results ---');
  const apiResults = [
    { id: 'a1', timestamp: 100, data: 'first' },
    { id: 'a2', timestamp: 200, data: 'second' },
    { id: 'a1', timestamp: 150, data: 'duplicate' }, // Duplicate ID
    { id: 'a3', timestamp: 300, data: 'third' },
  ];

  const uniqueResults = await threadts.uniqueBy(apiResults, (r) => r.id);
  console.log(
    'Unique by ID:',
    uniqueResults.map((r) => r.id)
  );

  // Use Case 3: Batch Processing Setup
  console.log('\n--- Use Case 3: Batch Processing Setup ---');
  const itemsToProcess = await threadts.range(1, 51); // 50 items
  const batches = await threadts.chunk(itemsToProcess, 10);
  console.log(
    `Split ${itemsToProcess.length} items into ${batches.length} batches`
  );
  console.log(
    'Batch sizes:',
    batches.map((b) => b.length)
  );

  // Use Case 4: Finding Elements
  console.log('\n--- Use Case 4: Finding Elements ---');
  const logs = [
    'INFO: Start',
    'DEBUG: Step 1',
    'ERROR: Failed',
    'INFO: End',
    'ERROR: Critical',
  ];

  // Find first error
  const firstErrorIndex = await threadts.indexOf(
    logs,
    logs.find((l) => l.startsWith('ERROR'))!
  );
  console.log('First ERROR at index:', firstErrorIndex);

  // Use Case 5: Circular Buffer Simulation
  console.log('\n--- Use Case 5: Circular Buffer ---');
  const buffer = ['A', 'B', 'C', 'D', 'E'];
  console.log('Original buffer:', buffer);

  // Simulate adding new item and rotating
  const rotated = await threadts.pipe(buffer).rotate(-1).execute();
  console.log('After rotate(-1) [shift left]:', rotated);
  // Oldest item moved to end, simulating circular behavior
}

// ===========================================
// Main Runner
// ===========================================
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   ThreadTS Universal - Extended Array Operations Demo');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await basicLookupOperations();
    await sliceAndConcatOperations();
    await generatorOperations();
    await uniqueOperations();
    await chunkOperations();
    await zipOperations();
    await factoryUsage();
    await pipelineOperationsDemo();
    await practicalUseCases();

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   ✅ All Array Operations Demos Complete!');
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    // Cleanup
    await threadts.terminate();
  }
}

// Run the demo
main().catch(console.error);
