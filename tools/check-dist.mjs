import { existsSync } from "node:fs";
import { resolve } from "node:path";
const dist = resolve('dist');
console.log('dist:', dist);
console.log('index exists:', existsSync(resolve(dist, 'index.html')));
