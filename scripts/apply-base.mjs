#!/usr/bin/env node
// GitHub Pages project sites live under /<repo>/. Astro handles generated
// assets, but hand-written absolute links need the same base prefix.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'web/frontend/website/dist';
const rawBase = process.env.BASE_PATH ?? '/';
const base = rawBase === '/' ? '' : `/${rawBase.replace(/^\/+|\/+$/g, '')}`;
if (!base) process.exit(0);

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry.endsWith('.html')) files.push(path);
  }
};
walk(root);

const withBase = (match, attr, quote, target) => {
  if (!target.startsWith('/') || target.startsWith('//')) return match;
  if (target === base || target.startsWith(`${base}/`)) return match;
  return `${attr}${quote}${base}${target}`;
};

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const next = html
    .replace(/(href=)(["'])(\/[^"']*)/g, withBase)
    .replace(/(src=)(["'])(\/[^"']*)/g, withBase);
  writeFileSync(file, next);
  console.log(`based ${relative(root, file)}`);
}
