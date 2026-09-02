# Browser checks

These are **not** part of `npm test`. The load gate and the unit suites run in
jsdom against the real `index.html`, which is enough for logic; these drive a
real Chromium against a real page and catch a different class of defect.

They need Playwright and a served copy of the site, so they are run by hand.
**`playwright-core` is deliberately not a dependency of this repo** — `npm
install` here stays jsdom-only, and the site itself still has no build step.

```bash
npm i --no-save playwright-core          # once per checkout

./test/browser/sync.sh                   # mirror the repo, vendor the CDN tags
cd test/browser/site && python3 -m http.server 8766 &
cd - && node test/browser/render-scan.js
```

The script says all of this if `playwright-core` is missing, rather than
throwing a module-resolution stack. `PW_CHROME` overrides the Chromium path
and `PW_URL` the server, if yours differ.

`fixtures/` holds the CSVs the checks import — including `bank.csv`, which is
a bank statement rather than a golf export, because the import flow has to
refuse it at the door.

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
