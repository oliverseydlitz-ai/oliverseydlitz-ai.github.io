#!/usr/bin/env node
// Test runner. Loads app.js as a whole file first and refuses to go further if
// that fails — the failure mode this exists to prevent is a broken top-level
// binding taking the app down while every unit suite still reports green.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { load } = require('./load.js');

const SUITES = path.join(__dirname, 'suites');
let failed = 0;

console.log('\n\x1b[1mGATE — does app.js actually load?\x1b[0m');
const r = load();
if (!r.ok) {
  r.errors.forEach(e => console.log('  \x1b[31mFAIL\x1b[0m  ' + e));
  console.log('\n\x1b[31mapp.js does not load. Unit suites are meaningless until this passes.\x1b[0m\n');
  process.exit(1);
}
console.log(`  \x1b[32mPASS\x1b[0m  whole file executes, ${Object.values(r.app).filter(Boolean).length} bindings reachable`);

console.log('\n\x1b[1mSUITES\x1b[0m');
for (const f of fs.readdirSync(SUITES).filter(f => f.endsWith('.js')).sort()) {
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, [path.join(SUITES, f)], { encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); ok = false; }
  const last = out.trim().split('\n').filter(l => /passed|FAILED/.test(l)).pop() || '(no result)';
  const fails = out.split('\n').filter(l => l.includes('FAIL'));
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${f.padEnd(18)} ${last.trim()}`);
  fails.forEach(l => console.log('        ' + l.trim()));
  if (!ok) failed++;
}

console.log(failed ? `\n\x1b[31m${failed} suite(s) failed\x1b[0m\n` : '\n\x1b[32mall green\x1b[0m\n');
process.exit(failed ? 1 : 0);
