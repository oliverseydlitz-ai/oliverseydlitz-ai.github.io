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
# Vendored CDN libs live in test/browser/vendor/ (committed) and are copied into
# the served mirror here. Rewriting the <script> tags without shipping the files
# left every dep 404ing behind the route-blocker, so the import flow could not
# parse a CSV and render-scan died at the preview step.
VENDOR="$(dirname "$0")/vendor"
[ -d "$VENDOR" ] || { echo "MISSING test/browser/vendor/ — run: see test/browser/README.md"; exit 1; }
mkdir -p "$SITE/vendor" && cp "$VENDOR"/*.js "$SITE/vendor/" || exit 1
sed -i \
  -e 's#https://cdn.jsdelivr.net/npm/papaparse@5/papaparse.min.js#vendor/papaparse.min.js#' \
  -e 's#https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js#vendor/chart.umd.js#' \
  -e 's#https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js#vendor/idb-keyval.js#' \
  -e 's#https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js#vendor/supabase.js#' \
  "$SITE/index.html"
left=$(grep -c '<script src="https://cdn.jsdelivr.net' "$SITE/index.html")
[ "$left" = "0" ] || { echo "STILL UNVENDORED: $left tag(s)"; grep -n '<script src="https://cdn.jsdelivr.net' "$SITE/index.html"; exit 1; }
echo "synced ($(grep -c '' "$SITE/app.js") lines of app.js)"
