// The only script on /terms and /privacy: the Print / PDF button.
//
// The document content itself is pre-rendered into those pages by
// tools/build-legal-pages.js and is present in the HTML. That is deliberate —
// a legal page that needs JavaScript to show a word of its own content is not
// a legal page. A crawler, an app-store reviewer, a regulator, a text browser
// and anyone with scripting off must all see the full text, and they do.
//
// So nothing here is load-bearing. If this file fails to load, the pages are
// still complete; only the print shortcut is missing, and the browser's own
// print command still works.
(function () {
  'use strict';
  var b = document.getElementById('docPrint');
  if (b) b.addEventListener('click', function () { window.print(); });
})();
