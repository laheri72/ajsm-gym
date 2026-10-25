/**
 * check-seo.js — Post-build SEO verification script
 * Run via: node scripts/check-seo.js
 * Added to npm script "check:seo" and invoked in CI after npm run build.
 *
 * Verifies the BUILT dist/ output (not just source files).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const ORIGIN = 'https://ajsm-gym.onrender.com';

// Canonical public URL allowlist
const PUBLIC_CANONICAL_URLS = [
  `${ORIGIN}/`,
  `${ORIGIN}/logins/talabat-login.html`,
  `${ORIGIN}/logins/staff-login.html`,
  `${ORIGIN}/logins/trainer-login.html`,
  `${ORIGIN}/blog`,
  `${ORIGIN}/privacy`,
  `${ORIGIN}/terms`,
];

// Private routes that must NOT appear in sitemap
const PRIVATE_ROUTE_PATTERNS = [
  /\/student\//,
  /\/staff\//,
  /\/trainer\//,
  /\/fitness\//,
  /\/api\//,
  /Forbidden/,
  /dashboard/,
];

// Dashboard HTML files that must have noindex
const NOINDEX_FILES = [
  'student/student-dashboard.html',
  'student/fitness-test.html',
  'trainer/trainer-dashboard.html',
  'staff/overview.html',
  'staff/entry.html',
  'staff/admin.html',
  'staff/records.html',
  'staff/progress.html',
  'staff/test.html',
  'staff/attendance.html',
  'staff/fitness-attendance.html',
  'staff/leaves.html',
  'staff/blacklist.html',
  'staff/profile.html',
  'staff/evaluation.html',
  'staff/comment-entry.html',
  'staff/evaluation-log.html',
  'fitness/profile.html',
  'fitness/cohort.html',
];

// Public pages that must NOT have noindex
const PUBLIC_PAGES = [
  { file: 'index.html', canonical: `${ORIGIN}/`, title: 'Jamea Gym Marol' },
  { file: 'logins/talabat-login.html', canonical: `${ORIGIN}/logins/talabat-login.html`, title: 'Student Login' },
  { file: 'logins/staff-login.html', canonical: `${ORIGIN}/logins/staff-login.html`, title: 'Staff Login' },
  { file: 'logins/trainer-login.html', canonical: `${ORIGIN}/logins/trainer-login.html`, title: 'Trainer Login' },
  { file: 'blog.html', canonical: `${ORIGIN}/blog`, title: 'Jamea Gym News' },
];

let errors = [];
let warnings = [];
let passes = [];

function pass(msg) { passes.push(`  ✅ ${msg}`); }
function warn(msg) { warnings.push(`  ⚠️  ${msg}`); }
function fail(msg) { errors.push(`  ❌ ${msg}`); }

function readDist(rel) {
  const full = path.join(DIST, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

// ─── 1. sitemap.xml ───────────────────────────────────────────────
console.log('\n[1] Checking sitemap.xml …');
const sitemapContent = readDist('sitemap.xml');
if (!sitemapContent) {
  fail('dist/sitemap.xml does not exist');
} else if (sitemapContent.trim().startsWith('<html') || sitemapContent.includes('<!DOCTYPE')) {
  fail('dist/sitemap.xml appears to be HTML, not XML');
} else if (!sitemapContent.includes('<?xml')) {
  fail('dist/sitemap.xml missing XML declaration');
} else {
  pass('dist/sitemap.xml exists and is XML');

  // Check all canonical URLs are present
  for (const url of PUBLIC_CANONICAL_URLS) {
    if (sitemapContent.includes(`<loc>${url}</loc>`)) {
      pass(`Sitemap contains: ${url}`);
    } else {
      fail(`Sitemap MISSING: ${url}`);
    }
  }

  // Check no private routes
  for (const pattern of PRIVATE_ROUTE_PATTERNS) {
    const match = sitemapContent.match(pattern);
    if (match) {
      fail(`Sitemap contains private route matching ${pattern}: ${match[0]}`);
    }
  }

  // Check no priority/changefreq
  if (sitemapContent.includes('<priority>')) warn('Sitemap contains <priority> — Google ignores it; consider removing');
  if (sitemapContent.includes('<changefreq>')) warn('Sitemap contains <changefreq> — Google ignores it; consider removing');
}

// ─── 2. robots.txt ───────────────────────────────────────────────
console.log('\n[2] Checking robots.txt …');
const robotsContent = readDist('robots.txt');
if (!robotsContent) {
  fail('dist/robots.txt does not exist');
} else if (robotsContent.trim().startsWith('<')) {
  fail('dist/robots.txt appears to be HTML, not plain text');
} else {
  pass('dist/robots.txt exists and is plain text');
  if (robotsContent.includes('Sitemap:')) {
    pass('robots.txt contains Sitemap: declaration');
  } else {
    fail('robots.txt missing Sitemap: declaration');
  }
  if (robotsContent.includes('Disallow: /api/')) {
    pass('robots.txt disallows /api/');
  } else {
    warn('robots.txt does not explicitly disallow /api/');
  }
}

// ─── 3. Public pages ─────────────────────────────────────────────
console.log('\n[3] Checking public pages …');
for (const page of PUBLIC_PAGES) {
  const html = readDist(page.file);
  if (!html) {
    fail(`dist/${page.file} missing`);
    continue;
  }

  // Title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch && titleMatch[1].includes(page.title)) {
    pass(`${page.file}: title contains "${page.title}"`);
  } else {
    fail(`${page.file}: title missing expected text "${page.title}" — got: ${titleMatch ? titleMatch[1] : 'NO TITLE'}`);
  }

  // Description
  if (html.match(/<meta name="description" content="[^"]{10,}"/i)) {
    pass(`${page.file}: has meta description`);
  } else {
    fail(`${page.file}: missing or empty meta description`);
  }

  // Canonical
  if (html.includes(`<link rel="canonical" href="${page.canonical}"`)) {
    pass(`${page.file}: correct canonical`);
  } else {
    fail(`${page.file}: missing/wrong canonical (expected ${page.canonical})`);
  }

  // Must NOT have noindex
  if (html.match(/name="robots"[^>]*noindex/i)) {
    fail(`${page.file}: has noindex — PUBLIC page must be indexable`);
  } else {
    pass(`${page.file}: no noindex (correct)`);
  }
}

// ─── 4. App shells must have noindex ─────────────────────────────
console.log('\n[4] Checking noindex on app shells …');
for (const rel of NOINDEX_FILES) {
  const html = readDist(rel);
  if (!html) {
    warn(`dist/${rel} not in dist (may not be built — check vite.config.js inputs)`);
    continue;
  }
  if (html.match(/name="robots"[^>]*noindex/i)) {
    pass(`${rel}: has noindex`);
  } else {
    fail(`${rel}: MISSING noindex — dashboard shell can be indexed`);
  }
}

// ─── 5. Homepage must not have old splash redirect ────────────────
console.log('\n[5] Checking index.html for old splash redirect …');
const indexHtml = readDist('index.html');
if (indexHtml) {
  if (indexHtml.includes('setTimeout') && indexHtml.includes('homepage.html')) {
    fail('index.html still contains old splash redirect to homepage.html');
  } else {
    pass('index.html: no old timed splash redirect');
  }
  if (indexHtml.includes('<a ') && indexHtml.includes('login')) {
    pass('index.html: contains anchor links (crawlable navigation)');
  } else {
    warn('index.html: could not confirm anchor-based login links');
  }
}

// ─── 6. JSON-LD on root ───────────────────────────────────────────
console.log('\n[6] Checking JSON-LD on index.html …');
if (indexHtml) {
  if (indexHtml.includes('"@type": "WebSite"') || indexHtml.includes('"@type":"WebSite"')) {
    pass('index.html: WebSite JSON-LD present');
  } else {
    warn('index.html: WebSite JSON-LD not found — add schema.org/WebSite markup');
  }
}

// ─── Summary ─────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log('SEO CHECK SUMMARY');
console.log('══════════════════════════════════════');
passes.forEach(p => console.log(p));
warnings.forEach(w => console.log(w));
errors.forEach(e => console.log(e));
console.log('──────────────────────────────────────');
console.log(`Passes: ${passes.length}  Warnings: ${warnings.length}  Errors: ${errors.length}`);

if (errors.length > 0) {
  console.log('\n❌ SEO checks FAILED — fix the errors above before deploying.\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('\n⚠️  SEO checks passed with warnings — review them above.\n');
  process.exit(0);
} else {
  console.log('\n✅ All SEO checks passed.\n');
  process.exit(0);
}
