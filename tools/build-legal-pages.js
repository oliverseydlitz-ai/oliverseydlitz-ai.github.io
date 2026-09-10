#!/usr/bin/env node
// Renders PRIVACY.md and TERMS.md into the standalone pages at /privacy and
// /terms.
//
// Why pre-render rather than fetch at runtime: a legal page that needs
// JavaScript to show a single word of its own content is not a legal page. A
// crawler, an app-store reviewer, a regulator, a text browser and anyone with
// scripting off all get "Loading…". A privacy policy behind a fetch is barely
// an improvement on one behind a modal.
//
// The cost is that the HTML is a second copy of the markdown, which this
// codebase otherwise refuses. That is why test/suites/legal-pages.js
// re-renders from source and fails if the committed HTML differs — the copy
// is allowed to exist because it cannot silently drift.
//
// Run after editing either document:  node tools/build-legal-pages.js
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const esc = t => String(t).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const inline = t => esc(t)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/`(.+?)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
           '<a href="$2" rel="noopener noreferrer">$1</a>');

const cells = row => row.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
const isDivider = row => /^\|?[\s:|-]+\|[\s:|-]*$/.test(row) && row.includes('-');

function render(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('|') && isDivider(lines[i + 1] || '')) {
      const head = cells(line.trim()); i += 2; const body = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { body.push(cells(lines[i].trim())); i++; }
      out.push('<div class="doc-table-wrap"><table class="doc-table"><thead><tr>' +
        head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }
    if (/^[-*] /.test(line.trim())) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(`<li>${inline(lines[i].trim().slice(2))}</li>`); i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.startsWith('### ')) out.push(`<h3>${inline(line.slice(4))}</h3>`);
    else if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
    else if (line.startsWith('> ')) out.push(`<blockquote>${inline(line.slice(2))}</blockquote>`);
    else if (line.trim() !== '') out.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return out.join('\n');
}

const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
            "font-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; " +
            "form-action 'none'; upgrade-insecure-requests";

function page({ slug, title, description, source }) {
  const md = fs.readFileSync(path.join(ROOT, source), 'utf8');
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
<link rel="canonical" href="https://oliverseydlitz-ai.github.io/${slug}/">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<!-- GENERATED FROM /${source} by tools/build-legal-pages.js — DO NOT EDIT.
     Edit the markdown and re-run the generator. test/suites/legal-pages.js
     fails if this file and the markdown disagree. -->
<header class="top-nav legal-nav">
  <div class="top-nav-brand">
    <a href="/" class="legal-home">
      <span class="brand-name">ShotLab</span>
      <span class="brand-tag">TOUR</span>
    </a>
    <span class="beta-tag">Beta</span>
  </div>
  <nav class="top-nav-links">
    <a href="/terms/" class="nav-link">Terms</a>
    <a href="/privacy/" class="nav-link">Privacy</a>
    <a href="/contact/" class="nav-link">Contact</a>
    <button class="btn-secondary btn-sm no-print" id="docPrint">Print / PDF</button>
  </nav>
</header>
<main class="legal-page">
<article class="modal-document doc-standalone">
${render(md)}
</article>
<p class="legal-source">Also available as <a href="/${source}">plain text</a>.</p>
</main>
<script src="/legal.js"></script>
</body>
</html>
`;
}

const PAGES = [
  { slug: 'terms', title: 'Terms of Service', source: 'TERMS.md',
    description: 'The terms governing use of ShotLab TOUR, a free beta golf launch-monitor analysis tool.' },
  { slug: 'privacy', title: 'Privacy Policy', source: 'PRIVACY.md',
    description: 'How ShotLab TOUR handles personal data, what it stores, who processes it, and your rights under the GDPR and CCPA.' },
];

if (require.main === module) {
  for (const p of PAGES) {
    const dir = path.join(ROOT, p.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page(p));
    console.log(`wrote ${p.slug}/index.html from ${p.source}`);
  }
}

module.exports = { render, page, PAGES };
