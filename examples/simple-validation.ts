import { ThreadTS } from '../src/core/threadjs';

const threadjs = ThreadTS.getInstance();
console.log('ThreadTS Universal API:', Object.keys(threadjs));
