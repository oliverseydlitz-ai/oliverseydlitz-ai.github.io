// Thin shim so the existing suites get the REAL modules from a whole-file
// load instead of regex-extracted copies. Same call signature as before, so
// no suite needed changing — but now a broken top-level binding fails every
// suite at once instead of being invisible to all of them.
const { load } = require('./load.js');
module.exports = {
  load(appPath) {
    const r = load({});
    if (!r.ok) {
      const e = new Error('app.js failed to load as a whole file:\n  ' + r.errors.join('\n  '));
      e.loadErrors = r.errors;
      throw e;
    }
    return r.app;
  },
};
