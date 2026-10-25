#!/usr/bin/env node
// Crawl the built marketing site and fail on broken internal routes or anchors.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = 'web/frontend/website/dist';
if (!existsSync(root)) {
  console.error(`missing ${root}; run npm run build:website first`);
  process.exit(1);
}

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (entry.endsWith('.html')) files.push(path);
  }
};
walk(root);

const routes = new Set();
for (const file of files) {
  const rel = relative(root, file);
  if (rel === 'index.html') routes.add('/');
  else if (rel.endsWith('/index.html')) routes.add('/' + rel.slice(0, -'index.html'.length));
  else routes.add('/' + rel);
}

const idsCache = new Map();
const idsFor = (route) => {
  if (idsCache.has(route)) return idsCache.get(route);
  const file = route === '/' ? join(root, 'index.html')
    : route.endsWith('/') ? join(root, route.slice(1), 'index.html')
    : join(root, route.slice(1));
  let ids = new Set();
  if (existsSync(file)) {
    const html = readFileSync(file, 'utf8');
    ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  }
  idsCache.set(route, ids);
  return ids;
};

const problems = new Set();
for (const file of files) {
  const page = '/' + relative(root, file).replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|tel:|pixcut:)/.test(href) || /\.(png|jpe?g|svg|ico|xml|css|js|webp)$/.test(href)) continue;
    const [beforeHash, fragment] = href.split('#');
    const pathPart = (beforeHash || '').split('?')[0];
    let route = pathPart || page;
    if (!route.endsWith('/') && !route.endsWith('.html')) route += '/';
    if (!pathPart) {
      if (fragment && !idsFor(page).has(fragment)) problems.add(`${page} -> ${href} (missing anchor)`);
      continue;
    }
    if (!routes.has(route)) {
      problems.add(`${page} -> ${href} (route not built)`);
    } else if (fragment && !idsFor(route).has(fragment)) {
      problems.add(`${page} -> ${href} (missing anchor)`);
    }
  }
}

if (problems.size > 0) {
  for (const problem of [...problems].sort()) console.error('broken link:', problem);
  process.exit(1);
}
console.log(`link check passed: ${routes.size} routes, ${files.length} pages`);
