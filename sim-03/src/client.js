// Client. Knows nothing.
//
// Every string a participant reads comes from the server on the turn it is
// needed. There is no action table here, no cost table, no notion that a
// second step exists. If you find yourself wanting to branch on which option
// was chosen, that logic belongs on the server — putting it here ships the
// answer key.
//
// The clock is the one piece of real logic in this file, and it is advisory:
// the server does not enforce it. A participant who lets it run out gets the
// decision made for them by the client, which is the same as a real deadline.

(function () {
  'use strict';

  const app = document.getElementById('app');
  const SECONDS_PER_DAY = 90;

  const state = {
    runId: null,
    view: null,
    reading: null,
    brief: null,
    timer: null,
    left: SECONDS_PER_DAY,
    busy: false
  };

  // Resume across a lost tab or a break between class sessions.
  const KEY = 'rapidsim03.run';
  const remember = (id) => { try { sessionStorage.setItem(KEY, id); } catch (e) {} };
  const recall = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };
  const forget = () => { try { sessionStorage.removeItem(KEY); } catch (e) {} };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  async function post(action, extra) {
    const headers = { 'content-type': 'application/json' };
    // Passed through by the platform when the sim is launched from a course.
    const params = new URLSearchParams(location.search);
    const lt = params.get('lt') || params.get('launch');
    if (lt) headers['x-launch-token'] = lt;
    const ac = params.get('code');
    if (ac) headers['x-access-code'] = ac;

    const r = await fetch('/api/run', {
      method: 'POST',
      headers,
      body: JSON.stringify(Object.assign({ action: action, runId: state.runId }, extra || {}))
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(data.message || data.error || ('HTTP ' + r.status));
      e.code = data.error;
      throw e;
    }
    return data;
  }

  function fail(msg) {
    const d = document.createElement('div');
    d.className = 'err';
    d.textContent = msg;
    app.prepend(d);
  }

  // -------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------

  function renderBrief() {
    const b = state.brief.brief;
    app.innerHTML =
      '<h1>' + esc(b.heading) + '</h1>' +
      '<p class="sub">' + esc(b.clock) + ' · you run the ' + esc(state.brief.station).toLowerCase() + '</p>' +
      '<div class="panel"><ul class="brief">' +
      b.lines.map(l => '<li>' + esc(l) + '</li>').join('') +
      '</ul></div>' +
      '<button class="primary" id="go">Start day 1</button>';
    document.getElementById('go').onclick = start;
  }

  function renderDay() {
    const v = state.view;
    const day = v.round + 1;

    let readingHtml = '';
    if (state.reading) {
      readingHtml =
        '<div class="reading"><div class="who">' + esc(state.reading.stationName) + '</div>' +
        esc(state.reading.text) + '</div>';
    }

    app.innerHTML =
      '<div class="day">Day ' + day + ' of ' + v.roundsTotal +
      '<span class="clock" id="clk">1:30</span></div>' +
      '<div class="board">' +
      cell('Units cleared', v.cleared) +
      cell('Bench score', v.localScore, true) +
      cell('In the queue', v.backlog) +
      cell('Cycle time', v.localCycleTime + 'h') +
      '</div>' +
      readingHtml +
      '<div class="panel"><h3>What do you do today?</h3><div class="choices" id="ch">' +
      v.availableActions.map(a =>
        '<button class="choice" data-id="' + esc(a.id) + '">' +
        (a.localCost ? '<span class="cost">−' + a.localCost + ' bench score</span>' : '') +
        '<span class="lab">' + esc(a.label) + '</span>' +
        '<span class="bl">' + esc(a.blurb || '') + '</span>' +
        '</button>').join('') +
      '</div></div>';

    Array.prototype.forEach.call(document.querySelectorAll('.choice'), (btn) => {
      btn.onclick = () => choose(btn.getAttribute('data-id'));
    });

    startClock(v.availableActions);
  }

  function cell(k, v, accent) {
    return '<div class="cell"><div class="k">' + esc(k) + '</div>' +
      '<div class="v' + (accent ? ' up' : '') + '">' + esc(v) + '</div></div>';
  }

  function renderDebrief(d) {
    const tail = d.outcome
      ? '<div class="tail"><div class="name">' + esc(d.outcome.person) + '</div>' +
        esc(d.outcome.what) + ' Day ' + esc(d.outcome.atRound) + '.</div>'
      : '';

    app.innerHTML =
      '<h1>' + esc(d.title) + '</h1>' +
      '<p class="sub">Bench score ' + esc(d.localScore) + ' · ' + esc(d.cleared) + ' units cleared · ' +
      'you called the field desk ' + esc(d.counts.timesLooked) +
      (d.counts.timesLooked === 1 ? ' time' : ' times') + '</p>' +
      tail +
      '<div class="panel"><p>' + esc(d.body) + '</p></div>' +
      '<div class="panel"><h3>Day by day</h3>' +
      '<table class="tl"><thead><tr><th>Day</th><th>What you did</th><th>Cleared</th><th>Score</th><th></th></tr></thead><tbody>' +
      d.timeline.map(t =>
        '<tr><td>' + esc(t.day) + '</td><td>' + esc(t.did) + '</td><td>' + esc(t.cleared) +
        '</td><td>' + esc(t.score) + '</td><td class="saw">' + (t.sawIt ? 'you looked' : '') + '</td></tr>'
      ).join('') +
      '</tbody></table></div>' +
      '<div class="panel"><h3>For the debrief</h3><ul class="qs">' +
      d.questions.map(q => '<li>' + esc(q) + '</li>').join('') +
      '</ul></div>';

    forget();
  }

  // -------------------------------------------------------------------------
  // The clock
  //
  // Advisory, and it does not stop the run. When it expires the most recently
  // hovered option is not chosen for them — the first one is, which is the
  // fast one, because a decision not made under time pressure defaults to the
  // path of least resistance. That is not a trick; it is the point.
  // -------------------------------------------------------------------------

  function startClock(actions) {
    stopClock();
    state.left = SECONDS_PER_DAY;
    const el = document.getElementById('clk');
    const tick = () => {
      state.left -= 1;
      if (el) {
        const m = Math.floor(Math.max(state.left, 0) / 60);
        const s = Math.max(state.left, 0) % 60;
        el.textContent = m + ':' + (s < 10 ? '0' : '') + s;
        if (state.left <= 15) el.className = 'clock low';
      }
      if (state.left <= 0) {
        stopClock();
        if (!state.busy && actions.length) choose(actions[0].id);
      }
    };
    state.timer = setInterval(tick, 1000);
  }

  function stopClock() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  // -------------------------------------------------------------------------
  // Flow
  // -------------------------------------------------------------------------

  async function start() {
    try {
      const d = await post('start');
      state.runId = d.runId;
      state.view = d.view;
      state.reading = null;
      remember(d.runId);
      renderDay();
    } catch (e) { fail(e.message); }
  }

  async function choose(id) {
    if (state.busy) return;
    state.busy = true;
    stopClock();
    Array.prototype.forEach.call(document.querySelectorAll('.choice'), b => b.disabled = true);
    try {
      const d = await post('act', { choice: id });
      state.view = d.view;
      state.reading = d.reading || null;
      state.busy = false;
      if (d.finished) return finish();
      renderDay();
    } catch (e) {
      state.busy = false;
      fail(e.message);
    }
  }

  async function finish() {
    try {
      const d = await post('debrief');
      renderDebrief(d.debrief);
    } catch (e) { fail(e.message); }
  }

  async function boot() {
    try {
      state.brief = await post('brief');
    } catch (e) {
      return fail('Could not reach the server. ' + e.message);
    }

    const prior = recall();
    if (prior) {
      state.runId = prior;
      try {
        const d = await post('resume');
        state.view = d.view;
        if (d.finished) return finish();
        return renderDay();
      } catch (e) {
        // Expired or unknown. Start clean rather than showing an error for
        // something the participant did not do.
        forget();
        state.runId = null;
      }
    }
    renderBrief();
  }

  boot();
})();
