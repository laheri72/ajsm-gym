# AJSM Gym / FitTracker: SEO audit and AGY implementation prompt

**Audited:** 25 October 2026. **Website:** https://ajsm-gym.onrender.com/ . **Repository:** https://github.com/laheri72/ajsm-gym .

**Verdict:** The sitemap failure is real and has a concrete build-configuration explanation. Fix that, put the real homepage at the root, make navigation crawlable, consolidate duplicate URLs, and exclude dashboard shells from indexing. Then improve the public site's identity around Jamea Gym, Marol, and FitTracker. Adding keyword tags alone will not solve this.

## 1. Scope and confidence

I inspected the supplied Search Console screenshot/table, public repository source, and unauthenticated HTTP GET responses from 23 live URLs. The repository main commit was **dc666cf132aa2eba7bb65ba9f1471db373ae58d3**, dated 23 October 2026. The live /api/version returned that same commit, tying the inspected source to the deployment.

Reviewed files include vite.config.js, server.js, package.json, the homepage and login HTML, homepage JavaScript/CSS, blog, sitemap, robots file, relevant middleware, and deployment workflow. This was an audit: no repository changes, login submissions, private-record retrieval, or deployment occurred. It was not a comprehensive security audit.

I did not reproduce the full production build locally. The configuration and live missing-file responses establish the omission diagnosis; the implementation agent must validate the corrected build artifact. There was no authenticated Search Console access beyond the provided material, no Lighthouse run, and no CrUX assessment. Timings from this audit's network are not user-performance measurements. Search sampling is not keyword-volume research.

## 2. What the Search Console screenshot means

| Metric | Observed | Interpretation |
|---|---:|---|
| Clicks, three months | 3 | Very little recorded organic traffic |
| Impressions | 11 | Too small a sample to assess ranking performance confidently |
| CTR | 27.3% | Correct arithmetic, but not evidence of strong SEO with only 11 impressions |
| Average position | 5.7 | An average for recorded impressions, not proof of ranking fifth for the requested terms |

The sitemap entry says Unknown, Couldn't fetch, zero discovered pages, and no last-read date. This indicates a retrieval problem, not by itself a penalty. Zero URLs discovered from this sitemap does not mean zero indexed pages across the website. Google can discover pages without a sitemap. [G1]

The live 404 explains the current failure. The screenshot alone cannot establish exactly what Google received on 15 July 2026.

## 3. Confirmed live findings

Results below are HTTP responses before client-side JavaScript. Publicly fetchable dashboard shells do not prove private data is accessible.

| Path | Observed | Finding |
|---|---|---|
| / | 200 HTML | Intro splash; no canonical; no ordinary HTML navigation anchors |
| /index.html | 200 HTML | Duplicate intro |
| /homepage.html and /homepage | 200 HTML each | Duplicate actual homepage; title “FitTracker - Home”; no description/canonical |
| /sitemap.xml | **404 HTML** | Access Denied template instead of XML |
| /robots.txt | **404 HTML** | Repository crawl rules are not delivered |
| /blog and /blog.html | 200 HTML each | Duplicate blog URLs with no canonical |
| /logins/talabat-login.html | 200 HTML | Student login exists; omitted from source sitemap |
| /logins/staff-login.html | 200 HTML | No description/canonical; broken return-home link |
| /logins/trainer-login.html | 200 HTML | No description/canonical |
| /logins/staff-login and /logins/trainer-login | 200 HTML each | Additional duplicate login URLs |
| /logins/homepage.html | 404 HTML | Broken staff return-home destination |
| /privacy and /terms | 200 HTML each | Public legal pages; no canonical |
| /student/student-dashboard.html | 200 HTML | No robots noindex meta or X-Robots-Tag |
| /trainer/trainer-dashboard.html | 200 HTML | No robots noindex meta or X-Robots-Tag |
| /staff/overview.html | 200 HTML | No robots noindex meta or X-Robots-Tag |
| /fitness/profile.html | 200 HTML | No robots noindex meta or X-Robots-Tag |
| /seo-audit-nonexistent-20261025 | 404 HTML | Correct status; misleading “403 Forbidden” page heading |
| /images/optimized/logo.webp | 200 image/webp | Existing logo/social asset works |
| /api/version | 200 JSON | Deployed commit matches repository |

None of the inspected public HTML pages had a canonical. The root and blog already contain some descriptive metadata, but the actual homepage and logins have much less.

## 4. Sitemap root cause and minimal correction

The source has both public/sitemap.xml and public/robots.txt. However:

- vite.config.js line 8 sets root to 'public'.
- Its static-copy targets are images, gifs, assets, and js; XML/TXT are omitted.
- Build output is ../dist.
- server.js line 41 serves the dist directory.

**The folder called public is the Vite project root in this repository.** It is not automatically the dedicated unprocessed-assets directory. Vite's default publicDir is relative to its configured root; here that would be public/public. Unreferenced files directly in the configured root are not all automatically emitted. [V1, V2]

Consequently, the XML/TXT source files are neither emitted HTML entries nor configured copy targets. Live requests fall into the missing-file handler. Despite its visible “403 Forbidden” wording, the sitemap response's actual HTTP status is **404**.

The smallest correction is to add explicit copies to the existing plugin:

~~~js
// Add to existing viteStaticCopy targets; keep existing targets.
{ src: resolve(__dirname, 'public/sitemap.xml'), dest: '' },
{ src: resolve(__dirname, 'public/robots.txt'), dest: '' },
~~~

Normalize paths if required by the installed plugin on Windows. Verify both files in dist after a clean build and on the live server after deployment. This snippet is a proposed correction, not a tested patch from this audit.

Do not set publicDir to the entire application source root, serve the repository folder from Express, or add an SPA catch-all returning homepage HTML for missing files.

The existing sitemap also omits student login and hardcodes every lastmod to 2026-06-03. Omit lastmod unless it represents a truthful significant update to that page. Do not replace all dates with the build date. Google ignores priority and changefreq. [G2]

## 5. Recommended URL/indexing policy

Serve the real homepage immediately at /. Keep existing login filenames. Preserve /blog, /privacy, and /terms as their already-linked extensionless public URLs.

| Page | Canonical path | Indexable? | In sitemap? |
|---|---|---|---|
| Homepage | / | Yes | Yes |
| Student login | /logins/talabat-login.html | Yes, for branded navigation searches | Yes |
| Staff login | /logins/staff-login.html | Yes, for branded navigation searches | Yes |
| Trainer login | /logins/trainer-login.html | Yes, for branded navigation searches | Yes |
| Blog/resources | /blog | Yes; improve content | Yes |
| Privacy | /privacy | Yes; low SEO priority | Yes |
| Terms | /terms | Yes; low SEO priority | Yes |
| Dashboards and fitness shells | Existing paths | No | No |
| APIs, private records, exports | Existing paths | No | No |
| Error pages | Existing paths | No | No |

Your five main discovery targets remain the homepage, three logins, and blog. The two legal pages can stay public and in the sitemap without being keyword targets.

Add explicit one-hop 301 redirects **before express.static**:

| Alias | Destination |
|---|---|
| /index, /index.html, /homepage, /homepage.html | / |
| /blog.html | /blog |
| /privacy.html | /privacy |
| /terms.html | /terms |
| /logins/talabat-login | /logins/talabat-login.html |
| /logins/staff-login | /logins/staff-login.html |
| /logins/trainer-login | /logins/trainer-login.html |

Preserve legitimate query parameters during redirects, but omit parameters/fragments from canonical metadata and sitemaps. Handle trailing-slash aliases consistently. Avoid broad rules affecting APIs, POSTs, assets, or dashboard paths.

Each public page should have one self-referencing absolute canonical. Sitemap, internal links, canonical, and og:url should agree. A canonical is a preference signal, not a guarantee; server redirects are preferable to relying on JavaScript when consolidating URLs. [G3, G4]

Recommended sitemap after implementation:

~~~xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ajsm-gym.onrender.com/</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/logins/talabat-login.html</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/logins/staff-login.html</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/logins/trainer-login.html</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/blog</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/privacy</loc></url>
  <url><loc>https://ajsm-gym.onrender.com/terms</loc></url>
</urlset>
~~~

Add future first-party articles only once their actual URLs return useful indexable 200 HTML. Do not list external articles, fragments, redirects, or private records.

## 6. Dashboards: authentication and indexing are separate

“Dashboards require passwords, so Google cannot access them” is incomplete for this app. Express serves static HTML before session middleware. The shell can be retrieved even if its data API requires login.

This does not establish a private-data leak. It does establish an indexing-control gap.

For existing crawlable shells, add initial-HTML robots noindex and a scoped X-Robots-Tag: noindex header before static serving. Cover /student/, /staff/, /trainer/, /fitness/, extensionless aliases, and non-public error/utility pages. Keep existing authenticated data controls intact. Noindex is not security.

Do not copy the current robots rules unchanged while relying on noindex: disallowing dashboard directories would prevent Google from reading the new noindex directives. A suitable initial policy for this public-shell architecture is:

~~~text
User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://ajsm-gym.onrender.com/sitemap.xml
~~~

This permits crawling of empty shells so their noindex can be processed; it does not authorize access to private records. API disallow reduces crawling but does not replace API authentication or guarantee deindexing. Do not claim that Google will read headers from a robots-blocked endpoint. [G5]

If you later server-gate all private HTML, test that as an access-control change. Never remove protection so a crawler can inspect sensitive content.

## 7. Homepage and login improvements

The live intro waits 4,000 ms, then another 1,000 ms for the transition: about **five seconds**, excluding loading, not three. It also has no ordinary link onward without JavaScript. Remove the mandatory intermediate screen. A decorative animation can stay only if content and navigation are immediately usable and reduced-motion preferences are respected.

The actual homepage consists mainly of a brand label, motivational quotes, login cards, and a small Khaima al-Riyada - Marol line. Explain how FitTracker connects to Jamea Gym and Al Jamea Tus Saifiyah.

Replace button[data-href] navigation with normal anchor links styled as cards. Google recommends crawlable href links. Update the associated JS instead of keeping redundant click navigation. [G6]

Fix the staff login's ./homepage.html link: from that directory it resolves to /logins/homepage.html, which is a real 404. Use / for all home links after migration.

Homepage CSS currently uses desktop overflow:hidden and a 100vh container. Adding content without adjusting this would clip it. Allow scrolling, flexible height, accessible keyboard focus, and usable small/zoomed layouts.

### Keyword map

| Query family | Page | Recommendation |
|---|---|---|
| jamea gym; marol jamea gym; jamea gym marol | Homepage | Make the campus/gym identity explicit |
| fittracker jamea; fit tracker marol | Homepage | Tie product name to institution/location |
| jamea gym student login; fittracker student login | Student login | Clear role-specific title/help |
| jamea gym staff login | Staff login | Clear staff identity and access context |
| jamea gym trainer login | Trainer login | Clear trainer identity and access context |
| khaima al-riyada gym | Homepage | Use the name already supported by the site |
| khaimat gym | Homepage, if confirmed | Confirm it is a genuinely used local alias before publishing it as fact |
| fittracker; fit tracker | Secondary objective | Broad ambiguous terms shared with other products |

Search sampling found unrelated products called FitTracker and Fit Tracker. Prioritizing compound local/brand phrases is an inference from that overlap, not a measured difficulty score or search-volume estimate. [C1, C2]

Standardize the product name as FitTracker. Use the requested terms naturally in useful text; do not create a near-duplicate page per spelling or add keyword-stuffed footers. Google does not use the meta keywords tag for ranking/indexing. [G7, G8]

Suggested titles:

| Page | Title |
|---|---|
| Homepage | Jamea Gym Marol – FitTracker \| Khaima al-Riyada |
| Student | Student Login \| Jamea Gym FitTracker |
| Staff | Staff Login \| Jamea Gym FitTracker |
| Trainer | Trainer Login \| Jamea Gym FitTracker |
| Blog | Jamea Gym News & Fitness Resources \| FitVerse |

**Homepage H1:** Jamea Gym, Marol — FitTracker

**Description:** FitTracker for Jamea Gym at Al Jamea Tus Saifiyah, Marol. Access student, staff and trainer logins, track attendance, and follow your fitness progress.

**Opening text:** FitTracker supports gym attendance, workout logging and fitness progress at Khaima al-Riyada, Al Jamea Tus Saifiyah, Marol. Students, staff and trainers can use their respective login pages to access the tools available to their role.

Add short, accurate sections explaining what the app does, who uses each login, the attendance/workout workflow, and where updates/help are available. Keep login access prominent. Do not invent membership offers, opening hours, prices, addresses, or default credentials.

The login pages can stay indexable as requested. Each should have a distinct description, concise role-specific instructions, and a home link. Their job is branded navigation, not ranking for broad fitness advice.

Google can choose different title links/snippets, so metadata wording is not a guaranteed search-result display. [G9, G10]

## 8. Blog, structured data, and external visibility

The blog embeds a Heyzine newsletter and generates three article cards through JavaScript. Two link to external publishers; one uses # while claiming new equipment. There are no first-party article pages behind those cards.

That makes it primarily a newsletter/resources hub. Useful external resources do not become full first-party articles on your domain. Keep the embed, but add clear original HTML context. Render resource titles, summaries, and links in initial HTML; identify external reading. Remove the dead link and verify the equipment claim. Use og:type=website for the hub rather than article.

Good future first-party content includes a current FitTracker user guide, how to find attendance history, how workout logging works, and real approved gym announcements. Each substantial article needs a real URL, original content, internal links, and truthful authorship/dates. Do not generate large numbers of generic health articles just to expand the sitemap.

Add restrained WebSite JSON-LD at the root, with a truthful name such as Jamea Gym FitTracker and genuine alternate names. Site-name markup is a suggestion, not a way to force Google. Validate it in Schema Markup Validator; Google's Rich Results Test does not support testing the site-name feature. [G11]

Organization markup is optional only if the entity relationship is clear. Do not invent LocalBusiness details, reviews, ratings, prices, opening hours, or addresses. Article markup belongs on real first-party articles. Rich-result display is not guaranteed. [G12]

Add consistent Open Graph/Twitter metadata using a verified existing public logo initially. These help shared-link previews; they are not substitutes for content. A dedicated share image can follow later.

An authorized institutional website/student-resources link would give users a reliable route to the portal. Keep branding consistent across legitimate existing profiles. Do not buy links or create fake listings. A custom domain can improve identity and ownership, but is not required to fix indexing. Keep the current origin for this patch.

## 9. Hosting, performance, and CI

This is an Express-backed deployment, not simply a Render Static Site. Implement the relevant redirects/headers in Express. Do not blindly follow static-site dashboard rewrite instructions.

The Render plan was not verified. If this is a Free Web Service, Render documents idle spin-down; do not assume that explains the confirmed sitemap 404. [R1]

The server listens only after connectDB() succeeds. Consequently public static pages also depend on successful database startup. Consider this separately as a reliability improvement; do not casually rewrite production startup as part of metadata work.

Performance priorities: remove the forced delay, show meaningful HTML immediately, eliminate clipping, preserve image dimensions, assess above-the-fold lazy loading, keep offscreen images lazy, and avoid unnecessary public-page scripts/font variants. Existing WebP assets and background preloads are useful foundations.

Measure mobile performance after implementation. Core Web Vitals targets are LCP ≤2.5 seconds, INP ≤200 ms, CLS ≤0.1 at the 75th percentile. These are targets, not measured results for this website. Low traffic may mean insufficient field data. [G13]

The existing workflow runs npm ci and npm run build, then checks the live commit. Add artifact-level SEO checks after the build: a successful bundle currently does not establish that sitemap/robots files shipped.

## 10. Priorities and owner checklist

| Priority | Change | Acceptance criterion |
|---|---|---|
| P0 | Ship sitemap/robots | Built files exist; live 200 XML/plain text |
| P0 | Exclude dashboard shells | Noindex delivered, including aliases; no private URLs in sitemap |
| P1 | Real homepage at root | Useful HTML and links without JS; old aliases redirect |
| P1 | Canonicals and URL rules | One canonical per page; destinations 200; no loops |
| P1 | Navigation and home-link fix | Links work without JS; staff return link repaired |
| P1 | Local identity and metadata | Distinct accurate public-page titles/descriptions/content |
| P1 | Correct missing-page template | Real 404 status and correct visible message |
| P2 | Better blog/schema/sharing | Truthful static resources, valid JSON, real assets |
| P2 | Performance/reliability | Measured after change; startup dependency assessed separately |

After deployment:

1. Verify sitemap/robots GET responses while logged out, including status, content type, and body.
2. Check all seven canonical URLs, alias redirects, and a deliberate nonexistent URL.
3. In the correct HTTPS URL-prefix Search Console property, submit sitemap.xml again. Submission tells Google where the file is; it does not upload or host it. If necessary, remove the failed report entry and add the same repaired URL. [G1]
4. URL Inspection → Test live URL for /, the three logins, and /blog. Check crawl access, visible/rendered content, and absence of accidental noindex. Request indexing for important changed pages within tool limits.
5. When indexed data refreshes, check Google's selected canonical. A live test is not an indexing guarantee.
6. Verify representative dashboards receive noindex. Do not request their indexing. If unwanted results already exist, assess them individually; temporary removals are an urgent follow-up, not a lasting fix.
7. Review query/page impressions and clicks after roughly 2–4 weeks and again after 6–8 weeks. These are monitoring checkpoints, not guaranteed processing times. Record the deployment date.

Sitemap success does not guarantee indexing or rankings. The goal is reliable discovery and a clear useful result for the intended audience. [G14]

## 11. Copy-ready AGY implementation prompt

Copy the full block below into AGY while it is opened in your repository. It requests complete local implementation and verification, with deployment kept as a separate step.

~~~text
Implement the SEO fixes in my existing laheri72/ajsm-gym repository. Do the work, not just advice. First inspect the working tree, applicable AGENTS.md files, package scripts, Vite/Express configuration, public pages, and current tests. Preserve unrelated changes. Revalidate findings against the current checkout; the audit inspected commit dc666cf132aa2eba7bb65ba9f1471db373ae58d3 on 2026-10-25.

GOAL
Improve discovery for Jamea Gym, Jamea Gym Marol, Marol Jamea Gym, FitTracker Jamea, Fit Tracker Marol, and verified Khaima al-Riyada branding. The homepage, student/staff/trainer logins, and blog are public search targets. Legal pages remain public. Dashboard shells, fitness profiles, private records, and APIs must not become search landing pages. Keep https://ajsm-gym.onrender.com as the origin and preserve working authentication.

AUDIT FINDINGS TO RECHECK
- Vite root:'public', base:'./', outDir:'../dist'; static-copy includes images/gifs/assets/js but not sitemap.xml or robots.txt.
- Both SEO files exist in public source but live requests return 404 HTML. Express serves dist.
- index.html is a splash with 4000 ms timeout plus 1000 ms transition to homepage.html.
- Actual homepage lacks description/canonical and uses button[data-href] navigation.
- Staff login links to ./homepage.html, which resolves to a nonexistent path.
- Student login /logins/talabat-login.html is missing from source sitemap.
- Static HTML is served before session middleware. Dashboard shells return 200 without noindex; private data access is a separate layer.
- .html and extensionless public aliases both return 200 with no canonicals.
- Blog uses an external newsletter iframe, JS-inserted external resources, and a dead '#' article link.
- Homepage CSS clips desktop overflow and fixes container height.
- Missing URLs return HTTP 404 but show a “403 Forbidden” template.

1. BUILD OUTPUT
Keep the multi-page Vite setup. Explicitly copy sitemap.xml and robots.txt to dist root with the existing plugin or an equally small deterministic step. Resolve paths correctly for root:'public' and Windows; normalize plugin paths if needed. Keep all existing copy targets and unrelated build entries.
Do not set publicDir to the entire app source tree, expose the repository/source folder, add a framework, or introduce an SPA fallback.
Serve /sitemap.xml as 200 XML with an appropriate XML content type and /robots.txt as 200 text/plain. Both must be public and return actual content, not HTML or login redirects.

2. HOMEPAGE AND PUBLIC URL RULES
Consolidate the maintained homepage into public/index.html so / immediately serves real useful content. Keep the established look and three login destinations. Remove the mandatory splash delay and client-side page transition. Optional decorative animation must not hide or block content/navigation and must respect reduced motion.
Add explicit one-hop 301 GET/HEAD redirects before express.static:
/index, /index.html, /homepage, /homepage.html -> /
/blog.html -> /blog
/privacy.html -> /privacy
/terms.html -> /terms
/logins/talabat-login -> /logins/talabat-login.html
/logins/staff-login -> /logins/staff-login.html
/logins/trainer-login -> /logins/trainer-login.html
Handle trailing-slash variants consistently. Preserve legitimate queries on redirects, avoid open redirects, and keep queries/fragments out of canonical metadata/sitemap.
Do not broadly rewrite POSTs, APIs, assets, or dashboard paths. Avoid loops and stale splash output. Adjust the old homepage build entry coherently rather than maintaining two independent homepages.

Canonical public URL allowlist:
https://ajsm-gym.onrender.com/
https://ajsm-gym.onrender.com/logins/talabat-login.html
https://ajsm-gym.onrender.com/logins/staff-login.html
https://ajsm-gym.onrender.com/logins/trainer-login.html
https://ajsm-gym.onrender.com/blog
https://ajsm-gym.onrender.com/privacy
https://ajsm-gym.onrender.com/terms
Put exactly one absolute self-referencing canonical in the initial HTML of each public page. Match og:url and internal links. Do not canonicalize unrelated pages to the homepage. Verify every destination returns 200.

3. CRAWLABLE NAVIGATION AND CONTENT
Convert homepage login buttons to ordinary anchor links styled as the existing cards. Update/remove redundant JS navigation interception. Make all public home links point to /, especially the broken staff link.
Preserve login forms, IDs/names, POST payloads, handlers, role redirects, forced-password-change flows, and student next behavior. Do not rename talabat-login.html.
Allow desktop/mobile scrolling, flexible page height, visible keyboard focus, and small/zoomed viewport usability. Ensure essential content and navigation work with JS disabled.

4. METADATA AND BRANDING
Use FitTracker consistently and connect it visibly with Jamea Gym, Marol and Al Jamea Tus Saifiyah.
Suggested titles:
Home: Jamea Gym Marol – FitTracker | Khaima al-Riyada
Student: Student Login | Jamea Gym FitTracker
Staff: Staff Login | Jamea Gym FitTracker
Trainer: Trainer Login | Jamea Gym FitTracker
Blog: Jamea Gym News & Fitness Resources | FitVerse
Home H1: Jamea Gym, Marol — FitTracker
Home description: FitTracker for Jamea Gym at Al Jamea Tus Saifiyah, Marol. Access student, staff and trainer logins, track attendance, and follow your fitness progress.
Write distinct accurate descriptions and brief role-specific introductions for each login. Explain verified app capabilities, who uses which login, and how to find help/updates. Keep login access prominent.
Do not invent public membership, hours, addresses, equipment announcements, credentials, ratings, or medical claims. “Khaimat Gym” is a requested search phrase, but its status as an actual alternate name is unverified: record that editorial question and complete independent work without publishing it as fact.
Preserve the existing Google verification token and analytics integration; do not duplicate GTM when moving content. Add coherent Open Graph/Twitter metadata using verified existing public assets. Do not keyword-stuff, hide keywords, create duplicate spelling pages, or promise rankings.

5. NOINDEX AND PRIVACY
Inventory HTML under public/student, public/staff, public/trainer, public/fitness and relevant non-public utility/error pages. Add initial-HTML robots noindex to app shells and a scoped X-Robots-Tag noindex policy before static serving, including extensionless aliases.
Do not noindex the homepage, public logins, or blog. Keep session, API, role, membership, and password controls intact. Noindex is not access control. Do not retrieve or publish private records for testing. Do not undertake a broad authentication rewrite for this SEO patch.
For the current crawlable-shell architecture, allow Google to crawl the shells so it can see noindex. Do not disallow those directories in robots while relying on noindex removal. Use a simple robots file allowing public crawling, disallowing /api/, and declaring the sitemap URL. API disallow reduces crawling; it is not authentication or guaranteed deindexing. Never use a Noindex: directive in robots.txt.
If a distinct security flaw is discovered, report it separately without exposing data or silently weakening protections.

6. SITEMAP AND ERRORS
Generate/maintain valid sitemap XML containing the seven canonical allowlist URLs exactly once. Future first-party articles may be added only if actually published and indexable. Exclude dashboard/API/private/redirect/error/external/query/fragment/placeholder URLs.
Omit priority and changefreq. Omit lastmod unless it truthfully tracks significant changes per page; never stamp every page with the build date.
Keep missing URLs as real HTTP 404. Add a proper small 404 page with noindex and a normal home link if necessary, include it in the build, and keep Forbidden semantics for actual access denial. Do not return the homepage with 200 for missing XML/TXT/pages. Preserve API error semantics.

7. BLOG AND STRUCTURED DATA
Keep useful newsletter functionality, add truthful first-party HTML context, and render resource titles/descriptions/links in initial HTML. Label external reading. Remove the dead '#' article action and remove or flag unverified equipment claims. Ensure resource content is available without JS; JS may enhance tabs/theme.
Use og:type=website for this hub. Do not scrape full external articles or create thin generic posts just to increase the sitemap.
Add valid root WebSite JSON-LD using the exact origin and truthful visible name/alternateName. Organization markup is optional only with clear verified identity. Do not invent LocalBusiness details, reviews, ratings, prices, authors, or search actions. Article markup belongs only on real first-party articles.
Validate JSON/schema; site-name WebSite markup is checked with Schema Markup Validator, not treated as a required Rich Results Test feature.

8. VERIFICATION AND REGRESSION CHECKS
Add a focused check:seo npm script and invoke it in the existing CI build-verification job after npm run build. Verify the BUILT output, not just source:
- sitemap.xml and robots.txt exist, parse correctly, and are not HTML.
- Sitemap URLs equal the public canonical allowlist and exclude private routes.
- Public pages have exactly one correct title/description/canonical, no accidental noindex, and essential initial-HTML text/links.
- App shells contain noindex; header middleware also covers aliases.
- Root has no old timed splash redirect.
- Essential local links and assets resolve.
Use appropriate parsers/existing dependencies without introducing a large SEO framework.
Test Express redirects, status codes, and headers through actual routing code, not merely a Vite static preview. If database credentials prevent starting the complete app, test a small reusable module containing the actual public routing/header middleware in a safe harness, preserve production startup, and clearly state the remaining full-app test limitation.
Run a lockfile-respecting install where appropriate, production build, SEO checks, and relevant existing tests. Inspect desktop/mobile and JS-disabled navigation if browser tools exist. Check login form contracts, no redirect loops, query handling, canonical destinations, noindex coverage, and true 404 behavior.
Do not use production credentials or submit production login forms in automated tests. If authenticated test credentials are unavailable, list role-specific authenticated smoke tests as pending manual verification.

9. HANDOFF
Complete local implementation. Report changed files, final URL/indexing map, actual commands/results, unresolved editorial facts, and manual deployment checks. Add short SEO maintenance documentation so sitemap shipping and dashboard exclusions do not regress.
Include post-deployment curl GET checks and Search Console steps: resubmit sitemap.xml, inspect canonical homepage/logins/blog, review Google-selected canonicals later, and monitor impressions by relevant query.
Do not claim sitemap acceptance guarantees indexing/ranking. Do not commit, push, change DNS/hosting, or deploy production unless I separately request it.
~~~

## 12. Evidence and official sources

Commit-pinned repository evidence:

- [Vite configuration](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/vite.config.js)
- [Express server](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/server.js)
- [Intro HTML](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/index.html)
- [Homepage HTML](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/homepage.html)
- [Homepage JavaScript](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/js/new-site.js)
- [Homepage CSS](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/css/new-styles.css)
- [Staff login](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/logins/staff-login.html)
- [Blog](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/blog.html)
- [Sitemap source](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/sitemap.xml)
- [Robots source](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/public/robots.txt)
- [CI workflow](https://github.com/laheri72/ajsm-gym/blob/dc666cf132aa2eba7bb65ba9f1471db373ae58d3/.github/workflows/release-and-deploy.yml)

Official guidance checked during this audit:

- G1: [Google Sitemaps report and fetch errors](https://support.google.com/webmasters/answer/7451001)
- G2: [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- G3: [Redirects and Google Search](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- G4: [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- G5: [Block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- G6: [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- G7: [Supported and unsupported meta tags](https://developers.google.com/search/docs/crawling-indexing/special-tags)
- G8: [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
- G9: [Title links](https://developers.google.com/search/docs/appearance/title-link)
- G10: [Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)
- G11: [Site names](https://developers.google.com/search/docs/appearance/site-names)
- G12: [Structured data](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- G13: [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)
- G14: [Crawling and indexing FAQ](https://developers.google.com/search/help/crawling-index-faq)
- V1: [Vite static assets/public directory](https://vite.dev/guide/assets)
- V2: [Vite root/publicDir configuration](https://vite.dev/config/shared-options#publicdir)
- R1: [Render free-service behavior](https://render.com/docs/free)

Examples demonstrating overlapping product names, not keyword-volume research:

- C1: [FitTracker – Gym Workout Log](https://apps.apple.com/us/app/fittracker-gym-workout-log/id1529770987)
- C2: [Fit Tracker](https://play.google.com/store/apps/details?id=com.crashaw.fittracker)

Live-response findings come from direct audit HTTP requests. Search Console figures come from the supplied screenshot/table. Recheck against current code before implementation.
