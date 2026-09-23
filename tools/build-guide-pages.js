#!/usr/bin/env node
// Renders the guides in docs/guides/*.md into standalone pages at
// /guides/<slug>/, plus the /guides/ index, and rewrites the guides block of
// sitemap.xml.
//
// Same arrangement as tools/build-legal-pages.js, for the same reason: the app
// is one URL whose views are hash routes, so a crawler can index nothing but
// the homepage. A guide is a real page with its own pre-rendered content that
// answers one question people actually search. It needs no JavaScript to show
// a word of itself.
//
// WHERE THE NUMBERS COME FROM. A public page is the easiest place in this
// repository to ship a fabricated constant: nothing downstream consumes the
// text, so a wrong figure never surfaces anywhere else. Two rules, both
// enforced by test/suites/guide-pages.js:
//
//   1. A number the APP owns is never typed. It is written as a token,
//      {{Metrics.MIN_SHOTS_REPORT}} or {{Benchmarks.get('7i').pga.sf|2}}, and
//      resolved here against the real modules loaded from app.js. Change the
//      floor in the code and the guide moves with it on the next build — and
//      the guard fails until that build is committed.
//   2. Every other number in the prose must appear in the research base
//      (docs/research-base-v2.md) or the short-game evidence file. A figure
//      that appears in neither has no source in this repository.
//
// PHOTO SLOTS. A line `[[photo: what it should show]]` renders as an HTML
// comment — invisible to a reader, easy to find in the source — until Oliver
// supplies the image. The guard lists the open slots on every run.
//
// Run after editing a guide:  node tools/build-guide-pages.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const DOMAIN = 'https://shotlab.oliverseydlitz.com';
const AUTHOR = 'Oliver Seydlitz';

// ── The guides ───────────────────────────────────────────────────────────
// Order here is the order on the /guides/ index. `updated` is the date the
// text last changed in substance; it is what the page and the sitemap print.
const GUIDES = [
  { slug: 'mlm2pro-accuracy',
    title: 'How accurate is the Rapsodo MLM2PRO?',
    description: 'What the MLM2PRO measures, what it calculates, what it cannot see at all, and which of its numbers you can build practice on.',
    source: 'docs/guides/mlm2pro-accuracy.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'launch-monitor-spin-accuracy',
    title: 'Is launch-monitor spin accurate?',
    description: 'Why spin rate is the least trustworthy number on a consumer launch monitor, what the peer-reviewed agreement data says, and what to do with it instead.',
    source: 'docs/guides/launch-monitor-spin-accuracy.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'smash-factor-by-club',
    title: 'Smash factor by club: what good looks like',
    description: 'Tour smash factor for every club from driver to wedge, why it falls with loft, what moves yours, and how many shots before your average means anything.',
    source: 'docs/guides/smash-factor-by-club.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'driver-attack-angle',
    title: "Driver attack angle: why the tour average isn't your target",
    description: 'The PGA Tour hits slightly down on the driver. Why that is not what you should copy, why yards-per-degree charts mislead, and how far to trust your launch monitor on it.',
    source: 'docs/guides/driver-attack-angle.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'range-balls-vs-premium-balls',
    title: 'Range balls vs premium balls: what changes in your numbers',
    description: 'What a swing robot found when it hit range balls and premium balls: distance, dispersion and spin, what mats add on top, and how to compare sessions honestly.',
    source: 'docs/guides/range-balls-vs-premium-balls.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'how-many-shots',
    title: 'How many shots before a launch-monitor average means anything?',
    description: 'How many shots per club before an average, a change or a dispersion figure is worth reading, and how big a change has to be before it is real.',
    source: 'docs/guides/how-many-shots.md', published: '2026-09-23', updated: '2026-09-23' },
  { slug: 'gapping-chart-from-launch-monitor',
    title: 'How to build a gapping chart from launch monitor data',
    description: 'A step-by-step method for an honest yardage book from your launch monitor: one ball and surface, enough shots per club, averages with ranges, and gaps that are real.',
    source: 'docs/guides/gapping-chart-from-launch-monitor.md', published: '2026-09-23', updated: '2026-09-23' },
];

// ── Tokens: numbers the app owns ─────────────────────────────────────────
// Resolved against the real modules, from a whole-file load of app.js — the
// same load the test gate uses, not a regex copy of a constant.
let _app = null;
function app() {
  if (_app) return _app;
  const { load } = require(path.join(ROOT, 'test', 'load.js'));
  const r = load();
  if (!r.ok) throw new Error('app.js does not load, so no guide token can be resolved:\n  ' + r.errors.join('\n  '));
  return (_app = r.app);
}

const TOKEN = /\{\{\s*([^}|]+?)\s*(?:\|\s*(\d))?\s*\}\}/g;

function resolveToken(expr, digits) {
  const A = app();
  const names = ['Metrics', 'Benchmarks', 'Conditions', 'Dispersion', 'Strike', 'ShortGame', 'Rounds', 'DrillLibrary'];
  // eslint-disable-next-line no-new-func
  const v = new Function(...names, `return (${expr});`)(...names.map(n => A[n]));
  if (typeof v !== 'number' && typeof v !== 'string')
    throw new Error(`guide token {{${expr}}} resolved to ${v === undefined ? 'undefined' : typeof v} — it names something the app does not export`);
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`guide token {{${expr}}} is not a finite number`);
  if (typeof v === 'number' && digits != null) return v.toFixed(Number(digits));
  // A negative number prints with a real minus sign, the way the prose writes one.
  return typeof v === 'number' && v < 0 ? '−' + String(-v) : String(v);
}

const fillTokens = text => text.replace(TOKEN, (_, expr, d) => resolveToken(expr, d));

// ── Markdown, the small subset the guides use ────────────────────────────
const esc = t => String(t).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Links: absolute https (opens as a citation, no referrer) or root-relative
// (into the site or the app). Nothing else becomes an href.
const inline = t => esc(t)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*(?!\s)(.+?)\*(?!\w)/g, '$1<em>$2</em>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>')
  .replace(/\[([^\]]+)\]\((\/[^)\s]*)\)/g, '<a href="$2">$1</a>');

const cells = row => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isDivider = row => /^\|?[\s:|-]+\|[\s:|-]*$/.test(row) && row.includes('-');
const PHOTO = /^\[\[photo:\s*(.+?)\s*\]\]$/i;

function render(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (PHOTO.test(t)) {
      // "--" cannot appear inside an HTML comment.
      out.push(`<!-- PHOTO SLOT (Oliver to supply): ${t.match(PHOTO)[1].replace(/--/g, '—')} -->`);
      i++; continue;
    }
    if (t.startsWith('|') && isDivider(lines[i + 1] || '')) {
      const head = cells(t); i += 2; const body = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { body.push(cells(lines[i].trim())); i++; }
      out.push('<div class="doc-table-wrap"><table class="doc-table"><thead><tr>' +
        head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if (/^[-*] /.test(t)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) { items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`); i++; }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(t)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) { items.push(`<li>${inline(lines[i].trim().replace(/^\d+\. /, ''))}</li>`); i++; }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.startsWith('### ')) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.startsWith('> ')) out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (t !== '') out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return out.join('\n');
}

// ── Page shell ───────────────────────────────────────────────────────────
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; " +
            "form-action 'none'; upgrade-insecure-requests";

const longDate = iso => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1]} ${y}`;
};

function head({ title, description, url, type, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)} — ShotLab TOUR</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="ShotLab TOUR">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${DOMAIN}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c')}
</script>
</head>
<body>`;
}

const NAV = `<header class="top-nav legal-nav">
  <div class="top-nav-brand">
    <a href="/" class="legal-home">
      <span class="brand-name">ShotLab</span>
      <span class="brand-tag">TOUR</span>
    </a>
    <span class="beta-tag">Beta</span>
  </div>
  <nav class="top-nav-links">
    <a href="/guides/" class="nav-link">Guides</a>
    <a href="/privacy/" class="nav-link">Privacy</a>
    <a href="/contact/" class="nav-link">Contact</a>
  </nav>
</header>`;

// What the app is, stated once and plainly. No rating, no user count, no
// testimonial: there are none, and a page that invents them is the same
// fabrication as CommunityInsights' old "simulated benchmark data".
const CTA = `<aside class="guide-cta">
<p><strong>ShotLab</strong> is a free web app that reads the CSV your Rapsodo exports and tells you which of your numbers are solid enough to practise on — per club, with the sample size it needs before it says anything.</p>
<p><a class="btn-primary guide-cta-link" href="/">Open ShotLab</a></p>
</aside>`;

const published = () => GUIDES;

function guidePage(g) {
  const url = `${DOMAIN}/guides/${g.slug}/`;
  const md = fillTokens(fs.readFileSync(path.join(ROOT, g.source), 'utf8'));
  // The byline sits under the <h1>, which is the first line of every guide.
  const body = render(md).replace(/(<h1>[^]*?<\/h1>)/,
    `$1\n<p class="guide-meta">By ${AUTHOR} · Updated <time datetime="${g.updated}">${longDate(g.updated)}</time></p>`);
  const others = published().filter(o => o.slug !== g.slug);
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.title,
    description: g.description,
    url,
    mainEntityOfPage: url,
    datePublished: g.published,
    dateModified: g.updated,
    inLanguage: 'en',
    author: { '@type': 'Person', name: AUTHOR, url: `${DOMAIN}/contact/` },
    publisher: { '@type': 'Organization', name: 'ShotLab TOUR', url: `${DOMAIN}/` },
    image: `${DOMAIN}/og-image.png`,
  };
  return `${head({ title: g.title, description: g.description, url, type: 'article', jsonld })}
<!-- GENERATED FROM /${g.source} by tools/build-guide-pages.js — DO NOT EDIT.
     Edit the markdown and re-run the generator. test/suites/guide-pages.js
     fails if this file and the markdown disagree. -->
${NAV}
<main class="legal-page">
<article class="modal-document doc-standalone">
${body}
</article>
${CTA}
<nav class="guide-related" aria-label="More guides">
<h2>More guides</h2>
<ul>
${others.map(o => `<li><a href="/guides/${o.slug}/">${esc(o.title)}</a></li>`).join('\n')}
</ul>
</nav>
</main>
</body>
</html>
`;
}

function indexPage() {
  const url = `${DOMAIN}/guides/`;
  const title = 'Launch monitor guides';
  const description = 'Plain answers, with sources, to the questions golfers ask about their Rapsodo MLM2PRO numbers: what it measures, what to trust, and how many shots before an average means anything.';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title, description, url, inLanguage: 'en',
    hasPart: published().map(g => ({ '@type': 'Article', headline: g.title, url: `${DOMAIN}/guides/${g.slug}/` })),
  };
  return `${head({ title, description, url, type: 'website', jsonld })}
<!-- GENERATED by tools/build-guide-pages.js from its GUIDES list — DO NOT EDIT. -->
${NAV}
<main class="legal-page">
<article class="modal-document doc-standalone">
<h1>Guides</h1>
<p>Straight answers to the questions people ask about their launch monitor numbers. Every figure on these pages comes from a published source or from the app's own code, and each guide lists its sources at the bottom.</p>
<ul class="guide-list">
${published().map(g => `<li><a href="/guides/${g.slug}/">${esc(g.title)}</a><p>${esc(g.description)}</p></li>`).join('\n')}
</ul>
</article>
${CTA}
</main>
</body>
</html>
`;
}

// ── sitemap.xml: the guides block is generated, the rest is hand-written ──
const SM_START = '  <!-- guides:start (generated by tools/build-guide-pages.js) -->';
const SM_END = '  <!-- guides:end -->';
function sitemapBlock() {
  const url = (loc, lastmod, freq, pri) =>
    `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${freq}</changefreq>\n    <priority>${pri}</priority>\n  </url>`;
  const newest = published().map(g => g.updated).sort().pop();
  return [SM_START,
    url(`${DOMAIN}/guides/`, newest, 'monthly', '0.6'),
    ...published().map(g => url(`${DOMAIN}/guides/${g.slug}/`, g.updated, 'monthly', '0.7')),
    SM_END].join('\n');
}
function sitemap(current) {
  const a = current.indexOf(SM_START), b = current.indexOf(SM_END);
  if (a === -1 || b === -1) return current.replace('</urlset>', sitemapBlock() + '\n</urlset>');
  return current.slice(0, a) + sitemapBlock() + current.slice(b + SM_END.length);
}

// Every output this tool owns, as { file: expected contents }.
function outputs() {
  const out = {};
  for (const g of published()) out[`guides/${g.slug}/index.html`] = guidePage(g);
  out['guides/index.html'] = indexPage();
  out['sitemap.xml'] = sitemap(fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'));
  return out;
}

if (require.main === module) {
  for (const [file, text] of Object.entries(outputs())) {
    fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, file), text);
    console.log(`wrote ${file}`);
  }
}

module.exports = { GUIDES, render, fillTokens, resolveToken, guidePage, indexPage, sitemap, outputs, TOKEN, PHOTO, DOMAIN };
