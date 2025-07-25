import { ThreadTS } from '../src/core/threadjs';

const threadjs = ThreadTS.getInstance();

console.log('🔍 ThreadTS Universal - Bibliothek Validierung (TS)\n');
console.log('Platform:', threadjs.getPlatform());
console.log('Worker Support:', threadjs.isSupported());
console.log(
  'API Methoden:',
  Object.getOwnPropertyNames(Object.getPrototypeOf(threadjs))
);
