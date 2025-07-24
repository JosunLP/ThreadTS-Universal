import { ThreadJS } from '../src/core/threadjs';

const threadjs = ThreadJS.getInstance();

console.log('🔍 ThreadJS Universal - Bibliothek Validierung (TS)\n');
console.log('Platform:', threadjs.getPlatform());
console.log('Worker Support:', threadjs.isSupported());
console.log(
  'API Methoden:',
  Object.getOwnPropertyNames(Object.getPrototypeOf(threadjs))
);
