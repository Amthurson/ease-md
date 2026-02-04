const { readFileSync } = require('fs');
const path = require('path');
const dist = path.resolve(__dirname, 'dist');
console.log('dist:', dist);
console.log('index exists:', require('fs').existsSync(path.join(dist,'index.html')));
