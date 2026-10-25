/**
 * test-routing.js — Express routing smoke test (no DB required)
 * Tests: 301 redirects, X-Robots-Tag noindex, sitemap/robots content-type, 404 behaviour.
 */
'use strict';

const path = require('path');

// Stub out modules that need DB/env before loading server routes
// We'll load just the routing portion in a minimal Express app.

const express = require('express');
const fs = require('fs');
const http = require('http');

const DIST = path.resolve(__dirname, '..', 'dist');
const PORT = 19999;

// Minimal Express app with ONLY the SEO middleware (no DB)
const app = express();

// ── replicate only the SEO-relevant server.js sections ──

// sitemap.xml explicit route
app.get('/sitemap.xml', (req, res) => {
  const file = path.join(DIST, 'sitemap.xml');
  if (fs.existsSync(file)) res.type('application/xml').sendFile(file);
  else res.status(404).send('not found');
});

// robots.txt explicit route
app.get('/robots.txt', (req, res) => {
  const file = path.join(DIST, 'robots.txt');
  if (fs.existsSync(file)) res.type('text/plain').sendFile(file);
  else res.status(404).send('not found');
});

// 301 redirects
function seoRedirect(from, to) {
  app.get(from, (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, to + qs);
  });
}
seoRedirect('/index',         '/');
seoRedirect('/index.html',    '/');
seoRedirect('/homepage',      '/');
seoRedirect('/homepage.html', '/');
seoRedirect('/blog.html',     '/blog');
seoRedirect('/privacy.html',  '/privacy');
seoRedirect('/terms.html',    '/terms');
seoRedirect('/logins/talabat-login', '/logins/talabat-login.html');
seoRedirect('/logins/staff-login',   '/logins/staff-login.html');
seoRedirect('/logins/trainer-login', '/logins/trainer-login.html');

// X-Robots-Tag noindex middleware
const NOINDEX_PREFIXES = ['/student/', '/staff/', '/trainer/', '/fitness/'];
app.use((req, res, next) => {
  if (NOINDEX_PREFIXES.some(p => req.path.startsWith(p))) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// Static serving
app.use(express.static(DIST));

// Catch-all 404
app.get('*', (req, res) => {
  const resourcePath = path.join(DIST, req.path);
  if (fs.existsSync(resourcePath) && fs.lstatSync(resourcePath).isDirectory()) {
    return res.status(403).send('Forbidden');
  }
  const filePath = resourcePath + '.html';
  if (fs.existsSync(filePath)) return res.sendFile(filePath);
  res.status(404).sendFile(path.join(DIST, 'Forbidden.html'));
});

// ── test harness ─────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function pass(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.log(`  ❌ ${msg}`); failed++; errors.push(msg); }

function req(options) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: 'localhost', port: PORT, ...options }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    r.end();
  });
}

const server = http.createServer(app);

async function runTests() {
  // ─── Redirects ────────────────────────────────────────────────
  console.log('\n[1] Redirect checks …');
  const redirects = [
    ['/index', '/'],
    ['/index.html', '/'],
    ['/homepage', '/'],
    ['/homepage.html', '/'],
    ['/blog.html', '/blog'],
    ['/privacy.html', '/privacy'],
    ['/terms.html', '/terms'],
    ['/logins/talabat-login', '/logins/talabat-login.html'],
    ['/logins/staff-login', '/logins/staff-login.html'],
    ['/logins/trainer-login', '/logins/trainer-login.html'],
  ];
  for (const [from, to] of redirects) {
    const res = await req({ path: from, method: 'GET' });
    if (res.status === 301 && res.headers.location === to) {
      pass(`301 ${from} → ${to}`);
    } else {
      fail(`Expected 301 ${from}→${to}, got ${res.status} location:${res.headers.location}`);
    }
  }

  // ─── Redirect with query string preserved ─────────────────────
  const resQ = await req({ path: '/homepage?utm_source=test', method: 'GET' });
  if (resQ.status === 301 && resQ.headers.location === '/?utm_source=test') {
    pass('Redirect preserves query string: /homepage?utm_source=test → /?utm_source=test');
  } else {
    fail(`Query string not preserved: ${resQ.status} → ${resQ.headers.location}`);
  }

  // ─── sitemap.xml ──────────────────────────────────────────────
  console.log('\n[2] sitemap.xml response …');
  const sm = await req({ path: '/sitemap.xml', method: 'GET' });
  if (sm.status === 200) pass('GET /sitemap.xml → 200');
  else fail(`GET /sitemap.xml → ${sm.status} (expected 200)`);
  if ((sm.headers['content-type'] || '').includes('xml')) pass('/sitemap.xml Content-Type includes xml');
  else fail(`/sitemap.xml Content-Type wrong: ${sm.headers['content-type']}`);
  if (sm.body.includes('<?xml')) pass('/sitemap.xml body is XML');
  else fail('/sitemap.xml body does not appear to be XML');

  // ─── robots.txt ───────────────────────────────────────────────
  console.log('\n[3] robots.txt response …');
  const rb = await req({ path: '/robots.txt', method: 'GET' });
  if (rb.status === 200) pass('GET /robots.txt → 200');
  else fail(`GET /robots.txt → ${rb.status} (expected 200)`);
  if ((rb.headers['content-type'] || '').includes('text/plain')) pass('/robots.txt Content-Type is text/plain');
  else fail(`/robots.txt Content-Type wrong: ${rb.headers['content-type']}`);

  // ─── X-Robots-Tag noindex for dashboard paths ─────────────────
  console.log('\n[4] X-Robots-Tag noindex checks …');
  const noindexPaths = [
    '/student/student-dashboard.html',
    '/staff/overview.html',
    '/trainer/trainer-dashboard.html',
    '/fitness/profile.html',
  ];
  for (const p of noindexPaths) {
    const res = await req({ path: p, method: 'GET' });
    if ((res.headers['x-robots-tag'] || '').includes('noindex')) {
      pass(`X-Robots-Tag: noindex on ${p}`);
    } else {
      fail(`Missing X-Robots-Tag: noindex on ${p} (got: ${res.headers['x-robots-tag'] || 'none'})`);
    }
  }

  // ─── Public pages must NOT get noindex header ─────────────────
  const publicPaths = ['/', '/blog.html', '/logins/talabat-login.html'];
  for (const p of publicPaths) {
    const res = await req({ path: p, method: 'GET' });
    if (!(res.headers['x-robots-tag'] || '').includes('noindex')) {
      pass(`No X-Robots-Tag noindex on public page ${p}`);
    } else {
      fail(`Public page ${p} incorrectly has X-Robots-Tag: ${res.headers['x-robots-tag']}`);
    }
  }

  // ─── Homepage (/) is 200 with real content ────────────────────
  console.log('\n[5] Homepage content checks …');
  const home = await req({ path: '/', method: 'GET' });
  if (home.status === 200) pass('GET / → 200');
  else fail(`GET / → ${home.status}`);
  if (home.body.includes('Jamea Gym')) pass('Homepage contains "Jamea Gym"');
  else fail('Homepage does not contain "Jamea Gym"');
  if (home.body.includes('href="/logins/talabat-login.html"')) pass('Homepage has crawlable student login anchor');
  else fail('Homepage missing crawlable student login anchor');
  if (!home.body.includes('setTimeout') || !home.body.includes('homepage.html')) {
    pass('Homepage: no old splash redirect detected');
  } else {
    fail('Homepage still contains old splash redirect code');
  }

  // ─── True 404 for nonexistent path ────────────────────────────
  console.log('\n[6] 404 behaviour …');
  const notFound = await req({ path: '/seo-audit-nonexistent-20261025', method: 'GET' });
  if (notFound.status === 404) pass('Nonexistent path returns 404');
  else fail(`Nonexistent path returned ${notFound.status} (expected 404)`);

  // ─── Summary ──────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════');
  console.log('ROUTING TEST SUMMARY');
  console.log('══════════════════════════════════════');
  console.log(`Passed: ${passed}   Failed: ${failed}`);
  if (errors.length) {
    console.log('\nFailed checks:');
    errors.forEach(e => console.log(`  ❌ ${e}`));
  }
  if (failed > 0) {
    console.log('\n❌ Routing tests FAILED\n');
    process.exit(1);
  } else {
    console.log('\n✅ All routing tests passed\n');
    process.exit(0);
  }
}

server.listen(PORT, () => {
  console.log(`Test server listening on :${PORT}`);
  runTests().catch(err => {
    console.error('Test runner error:', err);
    process.exit(1);
  }).finally(() => server.close());
});
