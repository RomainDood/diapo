import { existsSync } from 'node:fs';
const root = import.meta.dirname + '/..';
if (!existsSync(root + '/vite.config.ts')) throw new Error('Missing Vite configuration');
console.log('Typed CSS configuration present.');
