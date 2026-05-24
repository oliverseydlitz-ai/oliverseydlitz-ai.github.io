/* ═══════════════════════════════════════════════════════════════
   ShotLab — app.js
   Sections: DB · CSV Parser · Fault Engine · Benchmarks · UI · Router · Main
═══════════════════════════════════════════════════════════════ */

'use strict';

// ────────────────────────────────────────────────────────────────
// DB — IndexedDB via idb-keyval
// ────────────────────────────────────────────────────────────────
const DB = (() => {
  const store = idbKeyval.createStore('shotlab-db', 'sessions');

  async function getSessions() {
    const keys = await idbKeyval.keys(store);
    const sessions = await Promise.all(keys.map(k => idbKeyval.get(k, store)));
    return sessions.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async function getSession(id) {
    return idbKeyval.get(id, store);
  }

  async function saveSession(session) {
    await idbKeyval.set(session.id, session, store);
  }

  async function deleteSession(id) {
    await idbKeyval.del(id, store);
  }

  async function clearAll() {
    await idbKeyval.clear(store);
  }

  async function exportAll() {
    return getSessions();
  }

  return { getSessions, getSession, saveSession, deleteSession, clearAll, exportAll };
})();

// ────────────────────────────────────────────────────────────────
// CSV Parser
// ────────────────────────────────────────────────────────────────
const CSVParser = (() => {
  const COLUMN_MAP = {
    'Club Type': 'clubType',
    'Club Brand': 'clubBrand',
    'Club Model': 'clubModel',
    'Carry Distance': 'carryDistance',
    'Total Distance': 'totalDistance',
    'Ball Speed': 'ballSpeed',
    'Launch Angle': 'launchAngle',
    'Launch Direction': 'launchDirection',
    'Apex': 'apex',
    'Side Carry': 'sideCarry',
    'Club Speed': 'clubSpeed',
    'Smash Factor': 'smashFactor',
    'Descent Angle': 'descentAngle',
    'Attack Angle': 'attackAngle',
    'Club Path': 'clubPath',
    'Club Data Est Type': 'clubDataEstType',
    'Spin Rate': 'spinRate',
    'Spin Axis': 'spinAxis',
  };

  const NUM_FIELDS = new Set([
    'carryDistance','totalDistance','ballSpeed','launchAngle','launchDirection',
    'apex','sideCarry','clubSpeed','smashFactor','descentAngle','attackAngle',
    'clubPath','clubDataEstType','spinRate','spinAxis'
  ]);

  function parse(csvText) {
    const result = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
    });

    if (!result.data || result.data.length === 0) {
      throw new Error('No data found in CSV');
    }

    const shots = result.data.map((row, i) => {
      const shot = { _row: i + 2 };
      for (const [csvCol, field] of Object.entries(COLUMN_MAP)) {
        if (!(csvCol in row)) continue;
        const raw = row[csvCol];
        shot[field] = NUM_FIELDS.has(field) ? parseFloat(raw) || 0 : raw;
      }
      return shot;
    });

    return shots;
  }

  function getClubs(shots) {
    return [...new Set(shots.map(s => s.clubType))].filter(Boolean);
  }

  return { parse, getClubs };
})();

// ────────────────────────────────────────────────────────────────
// Fault Engine
// ────────────────────────────────────────────────────────────────
const FaultEngine = (() => {
  function smashThreshold(clubType) {
    return clubType === 'd' || clubType === '3w' || clubType === '2w' ? 1.40 : 1.35;
  }

  const RULES = [
    {
      id: 'poor-contact',
      name: 'Poor Contact / Thin Strike',
      severity: 'high',
      test: s => s.smashFactor < smashThreshold(s.clubType) && s.smashFactor > 0,
      drill: 'Focus on ball-first contact. Place a tee 1 inch behind the ball and practice not hitting it.',
    },
    {
      id: 'fat-shot',
      name: 'Fat / Heavy Strike',
      severity: 'high',
      test: s => s.ballSpeed > 0 && s.clubSpeed > 0 && (s.ballSpeed / s.clubSpeed) < 1.20 && s.attackAngle < -5,
      drill: 'Move ball position slightly forward. Focus on keeping weight on lead side through impact.',
    },
    {
      id: 'over-the-top',
      name: 'Over-the-Top / Early Extension',
      severity: 'medium',
      test: s => s.launchAngle > 26 && s.carryDistance > 0,
      drill: 'Feel your right elbow drop to your hip in transition. Try "slot drill" with alignment stick.',
    },
    {
      id: 'slice',
      name: 'Slice / Open Face',
      severity: 'high',
      test: s => s.clubPath < -3 && s.sideCarry > 15,
      drill: 'Strengthen grip slightly. Practice with an inside-out swing path. Use an alignment stick drill.',
    },
    {
      id: 'hook',
      name: 'Hook / Closed Face',
      severity: 'medium',
      test: s => s.clubPath > 3 && s.sideCarry < -15,
      drill: 'Weaken grip slightly. Focus on keeping face square through impact. Practice fade finish drill.',
    },
    {
      id: 'low-launch',
      name: 'Low Launch / Delofting',
      severity: 'low',
      test: s => s.launchAngle < 8 && s.clubType === 'd',
      drill: 'Tee the ball higher. Feel like you are sweeping up through the ball at impact.',
    },
    {
      id: 'high-spin',
      name: 'High Spin Rate',
      severity: 'medium',
      test: s => s.spinRate && s.spinRate > 3800 && s.clubType === 'd',
      drill: 'Check attack angle — try to hit slightly up on the driver. Move ball position forward.',
    },
    {
      id: 'inconsistent-contact',
      name: 'Inconsistent Contact',
      severity: 'medium',
      test: null, // computed across all shots
      drill: 'Focus on a consistent pre-shot routine and ball position. Slow down your transition.',
    },
    {
      id: 'variable-launch',
      name: 'Variable Launch Angle',
      severity: 'low',
      test: null,
      drill: 'Check ball position consistency. Video your setup from the front to verify.',
    },
  ];

  function stdDev(values) {
    if (values.length < 2) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sq = values.map(v => (v - mean) ** 2);
    return Math.sqrt(sq.reduce((a, b) => a + b, 0) / values.length);
  }

  function detectFaults(shots) {
    const faults = [];

    for (const rule of RULES) {
      if (!rule.test) continue;
      const affected = shots.filter(rule.test);
      if (affected.length === 0) continue;
      faults.push({
        ...rule,
        count: affected.length,
        total: shots.length,
        shots: affected.map(s => s._row),
      });
    }

    // consistency checks across all shots
    if (shots.length >= 5) {
      const smashValues = shots.map(s => s.smashFactor).filter(v => v > 0);
      if (stdDev(smashValues) > 0.08) {
        faults.push({
          ...RULES.find(r => r.id === 'inconsistent-contact'),
          count: shots.length,
          total: shots.length,
          detail: `Std dev: ${stdDev(smashValues).toFixed(3)}`,
        });
      }

      const launchValues = shots.map(s => s.launchAngle).filter(v => v > 0);
      if (stdDev(launchValues) > 5) {
        faults.push({
          ...RULES.find(r => r.id === 'variable-launch'),
          count: shots.length,
          total: shots.length,
          detail: `Std dev: ${stdDev(launchValues).toFixed(1)}°`,
        });
      }
    }

    return faults;
  }

  return { detectFaults };
})();

// ────────────────────────────────────────────────────────────────
// Benchmarks — PGA Tour + Amateur averages per club
// ────────────────────────────────────────────────────────────────
const Benchmarks = (() => {
  // Sources: TrackMan, PGA Tour, amateur research
  // Fields: smashFactor, carryDistance, ballSpeed, launchAngle
  const DATA = {
    d:   { label: 'Driver',  pga: { smashFactor: 1.48, carryDistance: 275, ballSpeed: 167, launchAngle: 10.9 }, am: { smashFactor: 1.41, carryDistance: 216, ballSpeed: 133, launchAngle: 12.6 } },
    '3w': { label: '3 Wood', pga: { smashFactor: 1.44, carryDistance: 243, ballSpeed: 158, launchAngle: 9.2  }, am: { smashFactor: 1.38, carryDistance: 183, ballSpeed: 116, launchAngle: 11.2 } },
    '2w': { label: '2 Wood', pga: { smashFactor: 1.45, carryDistance: 255, ballSpeed: 162, launchAngle: 9.5  }, am: { smashFactor: 1.38, carryDistance: 195, ballSpeed: 120, launchAngle: 11.0 } },
    '4h': { label: '4 Hybrid',pga: { smashFactor: 1.40, carryDistance: 225, ballSpeed: 147, launchAngle: 11.0 }, am: { smashFactor: 1.34, carryDistance: 170, ballSpeed: 105, launchAngle: 13.0 } },
    '5h': { label: '5 Hybrid',pga: { smashFactor: 1.39, carryDistance: 210, ballSpeed: 138, launchAngle: 12.5 }, am: { smashFactor: 1.33, carryDistance: 158, ballSpeed: 100, launchAngle: 14.0 } },
    '4i': { label: '4 Iron', pga: { smashFactor: 1.38, carryDistance: 210, ballSpeed: 140, launchAngle: 11.0 }, am: { smashFactor: 1.32, carryDistance: 154, ballSpeed: 100, launchAngle: 13.5 } },
    '5i': { label: '5 Iron', pga: { smashFactor: 1.37, carryDistance: 195, ballSpeed: 132, launchAngle: 13.0 }, am: { smashFactor: 1.32, carryDistance: 143, ballSpeed: 93,  launchAngle: 15.0 } },
    '6i': { label: '6 Iron', pga: { smashFactor: 1.36, carryDistance: 183, ballSpeed: 124, launchAngle: 14.5 }, am: { smashFactor: 1.31, carryDistance: 133, ballSpeed: 87,  launchAngle: 16.5 } },
    '7i': { label: '7 Iron', pga: { smashFactor: 1.35, carryDistance: 172, ballSpeed: 116, launchAngle: 16.3 }, am: { smashFactor: 1.30, carryDistance: 122, ballSpeed: 80,  launchAngle: 18.0 } },
    '8i': { label: '8 Iron', pga: { smashFactor: 1.34, carryDistance: 160, ballSpeed: 107, launchAngle: 18.0 }, am: { smashFactor: 1.29, carryDistance: 110, ballSpeed: 74,  launchAngle: 19.5 } },
    '9i': { label: '9 Iron', pga: { smashFactor: 1.33, carryDistance: 148, ballSpeed: 98,  launchAngle: 20.4 }, am: { smashFactor: 1.28, carryDistance: 98,  ballSpeed: 69,  launchAngle: 21.5 } },
    pw:   { label: 'PW',     pga: { smashFactor: 1.30, carryDistance: 136, ballSpeed: 89,  launchAngle: 24.0 }, am: { smashFactor: 1.26, carryDistance: 87,  ballSpeed: 62,  launchAngle: 25.0 } },
    aw:   { label: 'AW',     pga: { smashFactor: 1.28, carryDistance: 125, ballSpeed: 82,  launchAngle: 27.0 }, am: { smashFactor: 1.24, carryDistance: 78,  ballSpeed: 57,  launchAngle: 28.0 } },
    sw:   { label: 'SW',     pga: { smashFactor: 1.24, carryDistance: 110, ballSpeed: 74,  launchAngle: 32.0 }, am: { smashFactor: 1.20, carryDistance: 68,  ballSpeed: 50,  launchAngle: 33.0 } },
    lw:   { label: 'LW',     pga: { smashFactor: 1.20, carryDistance: 90,  ballSpeed: 62,  launchAngle: 38.0 }, am: { smashFactor: 1.16, carryDistance: 55,  ballSpeed: 42,  launchAngle: 40.0 } },
  };

  function get(clubType) {
    return DATA[clubType] || null;
  }

  function status(userVal, amVal, pgaVal, higherIsBetter = true) {
    if (higherIsBetter) {
      if (userVal >= pgaVal * 0.97) return 'green';
      if (userVal >= amVal * 0.95) return 'yellow';
      return 'red';
    } else {
      if (userVal <= pgaVal * 1.03) return 'green';
      if (userVal <= amVal * 1.05) return 'yellow';
      return 'red';
    }
  }

  return { get, status };
})();

// ────────────────────────────────────────────────────────────────
// UI helpers
// ────────────────────────────────────────────────────────────────
const UI = (() => {
  function avg(arr, field) {
    const vals = arr.map(s => s[field]).filter(v => typeof v === 'number' && !isNaN(v) && v !== 0);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function fmt(val, decimals = 1) {
    if (val === null || val === undefined || isNaN(val)) return '—';
    return Number(val).toFixed(decimals);
  }

  function clubLabel(type) {
    const labels = { d: 'Driver', '3w': '3W', '2w': '2W', '4h': '4H', '5h': '5H',
      '4i': '4i', '5i': '5i', '6i': '6i', '7i': '7i', '8i': '8i', '9i': '9i',
      pw: 'PW', aw: 'AW', sw: 'SW', lw: 'LW' };
    return labels[type] || type.toUpperCase();
  }

  function formatDate(iso) {
    if (!iso) return 'Unknown date';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function clubBreakdown(shots) {
    const counts = {};
    shots.forEach(s => { counts[s.clubType] = (counts[s.clubType] || 0) + 1; });
    return Object.entries(counts)
      .map(([club, n]) => `${clubLabel(club)} ×${n}`)
      .join(', ');
  }

  // ── Sessions list ──
  function renderSessionList(sessions) {
    const el = document.getElementById('sessionList');
    const empty = document.getElementById('sessions-empty');
    if (!sessions.length) {
      el.hidden = true;
      empty.style.display = '';
      return;
    }
    empty.style.display = 'none';
    el.hidden = false;
    el.innerHTML = sessions.map(s => {
      const faults = FaultEngine.detectFaults(s.shots);
      const avgSmash = avg(s.shots, 'smashFactor');
      return `
        <li>
          <div class="session-card" data-id="${s.id}">
            <div>
              <div class="session-date">${formatDate(s.date)}</div>
              <div class="session-meta">${clubBreakdown(s.shots)} · ${s.shots.length} shots</div>
              <div class="session-stats">
                <span class="session-stat">Smash <strong>${fmt(avgSmash, 2)}</strong></span>
                <span class="session-stat">Carry <strong>${fmt(avg(s.shots, 'carryDistance'))} yds</strong></span>
              </div>
            </div>
            <div>
              ${faults.length ? `<span class="fault-badge">${faults.length} fault${faults.length > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
        </li>`;
    }).join('');

    el.querySelectorAll('.session-card').forEach(card => {
      card.addEventListener('click', () => Router.showDetail(card.dataset.id));
    });
  }

  // ── Session detail ──
  let _activeSession = null;
  let _activeClubFilter = 'all';

  function renderDetail(session) {
    _activeSession = session;
    _activeClubFilter = 'all';
    document.getElementById('detailTitle').textContent = formatDate(session.date);
    document.getElementById('detailNotes').textContent = session.notes || '';
    renderDetailForFilter();
  }

  function renderDetailForFilter() {
    const session = _activeSession;
    const shots = _activeClubFilter === 'all'
      ? session.shots
      : session.shots.filter(s => s.clubType === _activeClubFilter);

    renderMetricsStrip(shots, session.shots);
    renderFaultCards(shots);
    renderBenchTable(shots);
    renderShotTable(shots);
    renderClubFilter(session.shots);
  }

  function renderClubFilter(shots) {
    const clubs = ['all', ...CSVParser.getClubs(shots)];
    const el = document.getElementById('clubFilter');
    el.innerHTML = clubs.map(c =>
      `<button class="chip ${c === _activeClubFilter ? 'active' : ''}" data-club="${c}">${c === 'all' ? 'All' : clubLabel(c)}</button>`
    ).join('');
    el.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeClubFilter = btn.dataset.club;
        renderDetailForFilter();
      });
    });
  }

  function renderMetricsStrip(shots, allShots) {
    const metrics = [
      { label: 'Avg Smash', field: 'smashFactor', decimals: 2, unit: '' },
      { label: 'Ball Speed', field: 'ballSpeed', decimals: 0, unit: 'mph' },
      { label: 'Carry', field: 'carryDistance', decimals: 0, unit: 'yds' },
      { label: 'Launch Angle', field: 'launchAngle', decimals: 1, unit: '°' },
    ];
    const el = document.getElementById('metricsStrip');
    el.innerHTML = metrics.map(m => {
      const val = avg(shots, m.field);
      const allVal = avg(allShots, m.field);
      let deltaHtml = '';
      if (val !== null && allVal !== null && shots !== allShots) {
        const diff = val - allVal;
        const cls = diff >= 0 ? 'up' : 'down';
        const sign = diff >= 0 ? '+' : '';
        deltaHtml = `<div class="metric-delta ${cls}">${sign}${fmt(diff, m.decimals)} vs all</div>`;
      }
      return `
        <div class="metric-card">
          <div class="metric-label">${m.label}</div>
          <div class="metric-value">${fmt(val, m.decimals)}<small style="font-size:0.55em;font-weight:400;opacity:.7">${m.unit}</small></div>
          ${deltaHtml}
        </div>`;
    }).join('');
  }

  function renderFaultCards(shots) {
    const faults = FaultEngine.detectFaults(shots);
    const el = document.getElementById('faultList');
    if (!faults.length) {
      el.innerHTML = `<div class="no-faults">✅ No faults detected in this selection</div>`;
      return;
    }
    el.innerHTML = faults.map(f => `
      <div class="fault-card severity-${f.severity}" data-fault="${f.id}">
        <div class="fault-header">
          <div>
            <div class="fault-name">${f.name}</div>
            <div class="fault-count">${f.count} of ${f.total} shots${f.detail ? ' · ' + f.detail : ''}</div>
          </div>
          <span class="fault-toggle">▼</span>
        </div>
        <div class="fault-body">
          <div class="fault-drill">💡 <strong>Drill:</strong> ${f.drill}</div>
          ${f.shots ? `<div class="fault-shots">Affected rows: ${f.shots.join(', ')}</div>` : ''}
        </div>
      </div>
    `).join('');

    el.querySelectorAll('.fault-card').forEach(card => {
      card.querySelector('.fault-header').addEventListener('click', () => card.classList.toggle('open'));
    });
  }

  function renderBenchTable(shots) {
    const clubs = CSVParser.getClubs(shots);
    const el = document.getElementById('benchTable');

    const rows = clubs.map(club => {
      const clubShots = shots.filter(s => s.clubType === club);
      const bench = Benchmarks.get(club);
      const userSmash = avg(clubShots, 'smashFactor');
      const userCarry = avg(clubShots, 'carryDistance');
      const userSpeed = avg(clubShots, 'ballSpeed');

      if (!bench) {
        return `<tr><td>${clubLabel(club)}</td><td colspan="5" style="color:var(--text-muted)">No benchmark data</td></tr>`;
      }

      const smashStatus = Benchmarks.status(userSmash, bench.am.smashFactor, bench.pga.smashFactor);
      const carryStatus = Benchmarks.status(userCarry, bench.am.carryDistance, bench.pga.carryDistance);
      const speedStatus = Benchmarks.status(userSpeed, bench.am.ballSpeed, bench.pga.ballSpeed);

      return `
        <tr>
          <td><strong>${bench.label}</strong></td>
          <td><span class="status-dot ${smashStatus}"></span>${fmt(userSmash, 2)}</td>
          <td>${fmt(bench.am.smashFactor, 2)}</td>
          <td>${fmt(bench.pga.smashFactor, 2)}</td>
          <td><span class="status-dot ${carryStatus}"></span>${fmt(userCarry, 0)} yds</td>
          <td>${fmt(bench.am.carryDistance, 0)} yds</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <thead>
        <tr>
          <th>Club</th>
          <th>Your Smash</th>
          <th>Am Avg</th>
          <th>PGA Avg</th>
          <th>Your Carry</th>
          <th>Am Avg</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>`;
  }

  let _sortField = null;
  let _sortDir = 1;

  function renderShotTable(shots, sortField, sortDir) {
    if (sortField) { _sortField = sortField; _sortDir = sortDir; }
    const sorted = [...shots];
    if (_sortField) {
      sorted.sort((a, b) => (a[_sortField] - b[_sortField]) * _sortDir);
    }

    const COLS = [
      { label: '#', render: (s, i) => i + 1, field: null },
      { label: 'Club', render: s => clubLabel(s.clubType), field: 'clubType' },
      { label: 'Ball Spd', render: s => fmt(s.ballSpeed, 0), field: 'ballSpeed', unit: 'mph' },
      { label: 'Club Spd', render: s => fmt(s.clubSpeed, 0), field: 'clubSpeed', unit: 'mph' },
      { label: 'Smash', render: s => fmt(s.smashFactor, 2), field: 'smashFactor' },
      { label: 'Launch∠', render: s => fmt(s.launchAngle, 1), field: 'launchAngle', unit: '°' },
      { label: 'Dir', render: s => fmt(s.launchDirection, 1), field: 'launchDirection', unit: '°' },
      { label: 'Carry', render: s => fmt(s.carryDistance, 0), field: 'carryDistance', unit: 'yds' },
      { label: 'Side', render: s => fmt(s.sideCarry, 1), field: 'sideCarry', unit: 'yds' },
      { label: 'Apex', render: s => fmt(s.apex, 0), field: 'apex', unit: 'ft' },
      { label: 'Path', render: s => fmt(s.clubPath, 1), field: 'clubPath', unit: '°' },
      { label: 'Atk∠', render: s => fmt(s.attackAngle, 1), field: 'attackAngle', unit: '°' },
      { label: 'Spin', render: s => s.spinRate ? fmt(s.spinRate, 0) : '—', field: 'spinRate', unit: 'rpm' },
    ];

    const el = document.getElementById('shotTable');
    const heads = COLS.map(c => {
      const active = _sortField === c.field;
      const arrow = active ? (_sortDir === 1 ? ' ↑' : ' ↓') : '';
      return `<th ${c.field ? `data-field="${c.field}"` : ''}>${c.label}${c.unit ? `<br><small style="font-weight:400;opacity:.6;font-size:.7em">${c.unit}</small>` : ''}${arrow}</th>`;
    }).join('');

    const bodyRows = sorted.map((s, i) =>
      `<tr>${COLS.map(c => `<td>${c.render(s, i)}</td>`).join('')}</tr>`
    ).join('');

    el.innerHTML = `<thead><tr>${heads}</tr></thead><tbody>${bodyRows}</tbody>`;

    el.querySelectorAll('th[data-field]').forEach(th => {
      th.addEventListener('click', () => {
        const f = th.dataset.field;
        const dir = _sortField === f ? _sortDir * -1 : 1;
        renderShotTable(shots, f, dir);
      });
    });
  }

  // ── Progress ──
  let _charts = {};

  function renderProgress(sessions) {
    const empty = document.getElementById('progress-empty');
    const content = document.getElementById('progress-content');

    if (sessions.length < 2) {
      empty.style.display = '';
      content.hidden = true;
      return;
    }
    empty.style.display = 'none';
    content.hidden = false;

    // populate club filter
    const allClubs = [...new Set(sessions.flatMap(s => CSVParser.getClubs(s.shots)))];
    const clubSel = document.getElementById('progressClub');
    clubSel.innerHTML = ['all', ...allClubs].map(c =>
      `<option value="${c}">${c === 'all' ? 'All clubs' : clubLabel(c)}</option>`
    ).join('');
    clubSel.onchange = () => renderProgressCharts(sessions, clubSel.value);
    renderProgressCharts(sessions, 'all');
  }

  function renderProgressCharts(sessions, clubFilter) {
    const filtered = sessions.map(s => ({
      label: formatDate(s.date),
      shots: clubFilter === 'all' ? s.shots : s.shots.filter(sh => sh.clubType === clubFilter),
    })).filter(s => s.shots.length > 0);

    const labels = filtered.map(s => s.label);
    const chartData = field => filtered.map(s => avg(s.shots, field));

    const chartCfg = (data, color) => ({
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: color + '22',
          tension: 0.3,
          pointRadius: 5,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#8891aa', font: { size: 10 } }, grid: { color: '#2d3148' } },
          y: { ticks: { color: '#8891aa', font: { size: 10 } }, grid: { color: '#2d3148' } },
        },
      },
    });

    const defs = [
      { id: 'chartSmash', field: 'smashFactor', color: '#16a34a' },
      { id: 'chartCarry', field: 'carryDistance', color: '#3b82f6' },
      { id: 'chartLaunch', field: 'launchAngle', color: '#eab308' },
      { id: 'chartBallSpeed', field: 'ballSpeed', color: '#a855f7' },
    ];

    defs.forEach(({ id, field, color }) => {
      if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; }
      const canvas = document.getElementById(id);
      if (canvas) {
        _charts[id] = new Chart(canvas, chartCfg(chartData(field), color));
      }
    });
  }

  return { renderSessionList, renderDetail, renderProgress, avg, formatDate, clubLabel };
})();

// ────────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────────
const Router = (() => {
  let _currentView = 'sessions';

  function show(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');
    _currentView = viewId;

    // sync nav items
    document.querySelectorAll('.bottom-nav-item, .nav-link').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
  }

  async function showDetail(sessionId) {
    const session = await DB.getSession(sessionId);
    if (!session) return;
    UI.renderDetail(session);
    show('session-detail');
    document.getElementById('deleteSessionBtn').dataset.id = sessionId;
  }

  async function showProgress() {
    const sessions = await DB.getSessions();
    UI.renderProgress(sessions);
    show('progress');
  }

  async function showSessions() {
    const sessions = await DB.getSessions();
    UI.renderSessionList(sessions);
    show('sessions');
  }

  function showImport() {
    // reset import steps
    document.querySelectorAll('.import-step').forEach(s => s.classList.remove('active'));
    document.getElementById('step-pick').classList.add('active');
    document.getElementById('fileInput').value = '';
    show('import');
  }

  return { show, showDetail, showProgress, showSessions, showImport };
})();

// ────────────────────────────────────────────────────────────────
// Import flow state
// ────────────────────────────────────────────────────────────────
const ImportFlow = (() => {
  let _parsedShots = null;

  function goStep(id) {
    document.querySelectorAll('.import-step').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      alert('Please select a CSV file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        _parsedShots = CSVParser.parse(e.target.result);
        showPreview(_parsedShots, file.name);
      } catch (err) {
        alert('Could not parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  function showPreview(shots, filename) {
    document.getElementById('previewCount').textContent = `${shots.length} shots detected`;

    // try extract date from filename e.g. mlm2pro_shotexport_051626.csv
    const match = filename.match(/(\d{6})/);
    if (match) {
      const d = match[1];
      const month = d.slice(0,2), day = d.slice(2,4), year = '20' + d.slice(4,6);
      const dateStr = `${year}-${month}-${day}`;
      document.getElementById('metaDate').value = dateStr;
    } else {
      document.getElementById('metaDate').value = new Date().toISOString().slice(0,10);
    }

    // preview table — first 5 rows
    const preview = shots.slice(0, 5);
    const cols = ['clubType','clubBrand','ballSpeed','smashFactor','carryDistance','launchAngle','clubPath'];
    const labels = { clubType:'Club', clubBrand:'Brand', ballSpeed:'Ball Spd', smashFactor:'Smash', carryDistance:'Carry', launchAngle:'Launch∠', clubPath:'Path' };
    const table = document.getElementById('previewTable');
    table.innerHTML = `
      <thead><tr>${cols.map(c => `<th>${labels[c]||c}</th>`).join('')}</tr></thead>
      <tbody>${preview.map(s => `<tr>${cols.map(c => `<td>${s[c] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody>
    `;
    goStep('step-preview');
  }

  async function save() {
    const date = document.getElementById('metaDate').value;
    const notes = document.getElementById('metaNotes').value.trim();
    const wind = document.getElementById('metaWind').value.trim();
    const temp = document.getElementById('metaTemp').value.trim();

    goStep('step-saving');

    const session = {
      id: crypto.randomUUID(),
      date: date || new Date().toISOString().slice(0,10),
      notes,
      conditions: (wind || temp) ? { wind, temp } : null,
      shots: _parsedShots,
      createdAt: Date.now(),
    };

    try {
      await DB.saveSession(session);
      await Router.showDetail(session.id);
    } catch (err) {
      alert('Failed to save session: ' + err.message);
      goStep('step-meta');
    }
  }

  return { goStep, handleFile, save };
})();

// ────────────────────────────────────────────────────────────────
// Confirm modal helper
// ────────────────────────────────────────────────────────────────
function showConfirm(title, body, onOk) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  modal.hidden = false;
  const ok = document.getElementById('confirmOk');
  const cancel = document.getElementById('confirmCancel');
  const cleanup = () => { modal.hidden = true; ok.onclick = null; cancel.onclick = null; };
  ok.onclick = () => { cleanup(); onOk(); };
  cancel.onclick = cleanup;
}

// ────────────────────────────────────────────────────────────────
// Main — init all event listeners
// ────────────────────────────────────────────────────────────────
async function init() {
  // ── Nav ──
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();
      const view = el.dataset.view;
      if (view === 'import') { Router.showImport(); return; }
      if (view === 'progress') { await Router.showProgress(); return; }
      if (view === 'sessions') { await Router.showSessions(); return; }
      Router.show(view);
    });
  });

  document.getElementById('topImportBtn')?.addEventListener('click', () => Router.showImport());
  document.getElementById('sessionsImportBtn')?.addEventListener('click', () => Router.showImport());
  document.getElementById('emptyCTA')?.addEventListener('click', () => Router.showImport());

  // ── Back buttons ──
  document.getElementById('importBackBtn').addEventListener('click', () => Router.showSessions());
  document.getElementById('detailBackBtn').addEventListener('click', () => Router.showSessions());

  // ── Import: file pick ──
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const dropZone = document.getElementById('dropZone');

  browseBtn.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('click', e => { if (e.target !== browseBtn) fileInput.click(); });
  fileInput.addEventListener('change', () => ImportFlow.handleFile(fileInput.files[0]));

  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    ImportFlow.handleFile(e.dataTransfer.files[0]);
  });

  // ── Import: navigation ──
  document.getElementById('previewBack').addEventListener('click', () => ImportFlow.goStep('step-pick'));
  document.getElementById('previewNext').addEventListener('click', () => ImportFlow.goStep('step-meta'));
  document.getElementById('metaBack').addEventListener('click', () => ImportFlow.goStep('step-preview'));
  document.getElementById('saveSession').addEventListener('click', () => ImportFlow.save());

  // ── Session detail: delete ──
  document.getElementById('deleteSessionBtn').addEventListener('click', async function() {
    const id = this.dataset.id;
    showConfirm('Delete session?', 'This cannot be undone.', async () => {
      await DB.deleteSession(id);
      await Router.showSessions();
    });
  });

  // ── Settings ──
  document.getElementById('exportDataBtn').addEventListener('click', async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shotlab-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  });

  document.getElementById('clearDataBtn').addEventListener('click', () => {
    showConfirm('Clear all data?', 'All sessions will be permanently deleted.', async () => {
      await DB.clearAll();
      await Router.showSessions();
    });
  });

  // ── Service worker ──
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // ── Initial render ──
  await Router.showSessions();
}

document.addEventListener('DOMContentLoaded', init);
