import { ThreadTS } from '../src/core/threadts';

const threadts = ThreadTS.getInstance();

console.log('🔍 ThreadTS Universal - Bibliothek Validierung (TS)\n');
console.log('Platform:', threadts.getPlatform());
console.log('Worker Support:', threadts.isSupported());
console.log(
  'API Methoden:',
  Object.getOwnPropertyNames(Object.getPrototypeOf(threadts))
);
