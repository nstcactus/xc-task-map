import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

const requiredFiles = [
  new URL('../dist/xc-task-map.js', import.meta.url),
  new URL('../dist/xc-task-map.cjs', import.meta.url),
];

for (const fileUrl of requiredFiles) {
  await access(fileUrl, constants.F_OK);
}

const esm = await import('../dist/xc-task-map.js');

if (!esm?.XcTaskMap) {
  throw new Error('Smoke test failed: missing named export XcTaskMap');
}

console.log('Smoke test passed: package build artifacts and exports look valid.');
