# Browser checks

These are **not** part of `npm test`. The load gate and the unit suites run in
jsdom against the real `index.html`, which is enough for logic; these drive a
real Chromium against a real page and catch a different class of defect.

They need Playwright and a served copy of the site, so they are run by hand:

```bash
# 1. mirror the repo into a served directory with the CDN tags vendored
./test/browser/sync.sh          # writes into the directory it names

# 2. serve it, and run a check
cd <that directory> && python3 -m http.server 8766 &
node test/browser/render-scan.js
```

`sync.sh` exists because a browser check can quietly test the **wrong build**.
The served copy has its CDN `<script>` tags rewritten to vendored files —
the route-blocker aborts every non-localhost request, so an unvendored tag is a
silently missing library rather than an error — and the copy had gone stale
once, reporting a rewritten feature's OLD text with nothing wrong in the code.
The script refuses to finish if a CDN tag survives the rewrite.

## `render-scan.js`

Imports three sessions across two ball types, then renders every view, the
session detail with all fault cards open, and all nine drill-library tabs, and
greps the resulting DOM for `NaN`, `undefined`, `null`, `[object Object]` and
`Infinity`.

It exists because a red high-severity alert on the home screen read
**"NaN% of recent shots. Priority fix."** for an unknown length of time. The
cause was `faults[0].pct` — a field that does not exist on a fault; the real
one is `rate`. Nothing in a unit suite catches a template literal reading a
property that was never there, because the function under test returns a
perfectly well-formed object; the defect only exists at the point of render.

Run it after touching any render path.
