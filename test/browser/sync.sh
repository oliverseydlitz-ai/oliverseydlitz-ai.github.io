#!/bin/sh
# Mirror the repo into the served site and point the CDN tags at ./vendor.
# The route-blocker aborts every non-127.0.0.1 request, so an unvendored tag
# is a silently missing library, not an error — which is why this is a script.
# Where the served copy lives. Override with SITE=... when running elsewhere.
SITE="${SITE:-$(dirname "$0")/site}"
mkdir -p "$SITE" || exit 1
REPO="${REPO:-$(cd "$(dirname "$0")/../.." && pwd)}"
# PRIVACY.md and TERMS.md are fetched at runtime by the legal modals. Without
# them in the mirror the fetch 404s and the documents render empty — so the
# browser checks could never see that half of the app at all.
cp "$REPO/app.js" "$REPO/index.html" "$REPO/style.css" "$REPO/sw.js" \
   "$REPO/PRIVACY.md" "$REPO/TERMS.md" "$SITE/" || exit 1
# self-hosted fonts: without these the mirror falls back to system-ui and
# every width measurement the render scan takes is of the wrong typeface
mkdir -p "$SITE/fonts" && cp "$REPO/fonts"/*.woff2 "$SITE/fonts/" || exit 1
# The four dependencies now ship from /vendor in the repo itself, so the mirror
# copies the SAME files the site serves rather than a second set that can drift
# from them — which is what test/browser/vendor/ had become.
[ -d "$REPO/vendor" ] || { echo "MISSING vendor/ — the site's own dependencies"; exit 1; }
mkdir -p "$SITE/vendor" && cp "$REPO/vendor"/*.js "$SITE/vendor/" || exit 1
# The guard stays, inverted: if a CDN tag ever comes back, the mirror would
# silently start measuring a page the route-blocker cannot serve.
left=$(grep -c 'cdn.jsdelivr.net' "$SITE/index.html" || true)
[ "$left" = "0" ] || { echo "CDN TAG REINTRODUCED: $left"; grep -n 'cdn.jsdelivr.net' "$SITE/index.html"; exit 1; }
echo "synced ($(grep -c '' "$SITE/app.js") lines of app.js)"
