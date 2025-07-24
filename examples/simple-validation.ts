import { ThreadJS } from '../src/core/threadjs';

const threadjs = ThreadJS.getInstance();
console.log('ThreadJS Universal API:', Object.keys(threadjs));
