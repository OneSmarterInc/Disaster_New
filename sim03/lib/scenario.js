// RapidSim 03 scenario and deterministic outcome engine.
// Outcome rules stay server-side. The browser receives only the outcome it has
// already earned, never future thresholds or alternate branches.

const META = {
  id: 'rapid-03-midland',
  replaces: ['rapid-03-bench'],
  catalogueRevision: 'midland-v1-2026-09',
  title: 'Midland Equipment',
  tagline: 'Two years to choose. The third year tells you what those choices bought.',
  description:
    'You run technology for a mid-sized HVAC company and allocate a fixed budget across two years. ' +
    'The consequences of Year 1 arrive in Year 2, and the consequences of both arrive in a final year you cannot influence.',
  minutes: 20,
  detail: {
    world: 'Technology architecture · mid-sized HVAC company',
    seat: 'Technology leader at Midland Equipment',
    clock: 'Year 1 through Year 3',
    teaches:
      'Infrastructure has lead time · every allocation buys one thing by not buying another',
    tangle:
      'A fixed annual budget has to cover today, resilience, capacity, connection and features. ' +
      'The limits force trade-offs before the events that reveal them.',
    turn:
      'There is no scored or ranked answer. The same portfolio is later seen through different consequences and buyer perspectives.',
    roomIntro:
      'There is no cast of advisers in this RapidSim. The argument is inside the allocation: what do you fund now when the evidence arrives later?',
    momentsIntro:
      'You commit a view, allocate Year 1, see what that made possible, allocate Year 2, then watch Year 3 arrive after your ability to change course has ended.',
    after:
      'The close returns the student to the sentence they wrote before allocating, their Year 1 portfolio, and two reflection questions. Instructor comparisons stay on the projector, never in the student view.',
    discussion:
      'The instructor view compares allocation distributions, Year 3 outcome bands, and Connect versus Uptime. Two contrasting anonymous runs can be put side by side for the room.',
    tryIt:
      'Run the same fixed-budget problem your students will see. Nothing is scored and no allocation is labelled correct.',
    sessionShape:
      'About twenty minutes to play. The debrief is designed for the rest of the class hour.',
    catalogueFacts: [
      { label: 'played', value: 'individual or team' },
      { label: 'preparation', value: 'briefing packet before class' },
      { label: 'assessment', value: 'not marked' }
    ],
    atAGlance: [
      { label: 'Decisions', value: 'Two annual allocations' },
      { label: 'Quantitative', value: 'Five-line $9M budget' },
      { label: 'Played', value: 'Individual or team' },
      { label: 'Session', value: 'About an hour' }
    ],
    cast: [],
    beats: [
      { at: 'Year 1', what: 'Commit a technology portfolio before the first consequence appears.' },
      { at: 'Year 2', what: 'Allocate again with Year 1 totals still visible, then face two events.' },
      { at: 'Year 3', what: 'No more allocation. The accumulated architecture now answers for you.' }
    ]
  }
};

const LINES = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = {
  run: 'Run',
  uptime: 'Uptime',
  capacity: 'Capacity',
  connect: 'Connect',
  features: 'Features'
};

// First-draft calibration lives in data rather than engine code. Facilitated
// sessions copy these defaults and may edit their own copy while still in the
// lobby, so thresholds can change between sections without a deploy.
const DEFAULT_THRESHOLDS = Object.freeze(require('../config/thresholds.json'));

const COPY = Object.freeze({
  year1: {
    strong: 'Report produced in a day. District renews early, mentions it to two others.',
    middle: 'Two techs on roofs with clipboards. Report late and thin. Grudging renewal.',
    weak: 'No report. Renews on price, starts taking competitor calls.'
  },
  heat: {
    strong: 'Systems hold. Best month the service department has ever had.',
    middle: 'Six hours down on the worst day. Paper dispatch, mistakes, annoyed customers.',
    weak: 'Four days down in the hottest week. Two hospital accounts publicly furious.'
  },
  competitor: {
    strong: 'Match it. You know which units are healthy, so you can price the risk.',
    middle: 'Pilot on thirty units. Slow, but in the game.',
    weak: 'Cannot respond. Buying it now takes eighteen months and the cap blocks it.'
  },
  year3: {
    strong: 'It works. Three years of fault history, somewhere to run it. Uptime becomes a product you sell.',
    pilot: 'Pilot on the newest units. Promising, not a business.',
    weak: 'Nothing to predict from. The model is fine. There is no data.'
  }
});

function integer(v) {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function validateAllocation(a) {
  if (!a || typeof a !== 'object') return { ok: false, error: 'allocation_required' };
  const out = {};
  for (const line of LINES) {
    const n = integer(a[line]);
    if (n === null || n < 0) return { ok: false, error: `invalid_${line}` };
    out[line] = n;
  }
  const total = LINES.reduce((s, k) => s + out[k], 0);
  if (total !== 9) return { ok: false, error: 'budget_must_equal_9', total };
  if (out.run < 3) return { ok: false, error: 'run_minimum_3' };
  for (const k of ['uptime', 'capacity', 'connect', 'features']) {
    if (out[k] > 3) return { ok: false, error: `${k}_maximum_3` };
  }
  return { ok: true, allocation: out };
}

function cumulative(y1, y2) {
  const out = {};
  for (const k of LINES) out[k] = (y1[k] || 0) + (y2[k] || 0);
  return out;
}

function sanitizeThresholds(input) {
  const d = { ...DEFAULT_THRESHOLDS };
  if (!input || typeof input !== 'object') return d;
  for (const k of Object.keys(d)) {
    const n = integer(input[k]);
    if (n !== null && n >= 0 && n <= 6) d[k] = n;
  }
  return d;
}

// Faculty may retune between sections, but a saved calibration must still tile
// the authored bands without silently turning an in-between value into "weak".
function validateThresholds(input) {
  const t = sanitizeThresholds(input);
  const errors = [];

  if (t.year1ConnectStrong < 1 || t.year1ConnectStrong > 3) {
    errors.push('Year 1 strong Connect must be between 1 and 3.');
  }
  if (t.heatUptimeMiddle >= t.heatUptimeStrong) {
    errors.push('Heat-wave middle must start below the strong threshold.');
  }
  if (t.competitorConnectPilotMin > t.competitorConnectPilotMax) {
    errors.push('Competitor pilot minimum cannot exceed its maximum.');
  }
  if (t.competitorConnectPilotMax !== t.competitorConnectStrong - 1) {
    errors.push('Competitor pilot maximum must sit immediately below the strong threshold.');
  }
  if (t.year3ConnectPilotMin > t.year3ConnectPilotMax) {
    errors.push('Year 3 pilot minimum cannot exceed its maximum.');
  }
  if (t.year3ConnectPilotMax !== t.year3ConnectStrong - 1) {
    errors.push('Year 3 pilot maximum must sit immediately below the strong Connect threshold.');
  }

  return errors.length
    ? { ok: false, error: 'invalid_thresholds', errors, thresholds: t }
    : { ok: true, thresholds: t };
}

function evaluateYear1(y1, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = y1.connect;
  if (c >= t.year1ConnectStrong) {
    return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong };
  }
  if (c > 0) {
    return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle };
  }
  return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak };
}

function evaluateYear2(y1, y2, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = cumulative(y1, y2);
  let heat;
  if (c.uptime >= t.heatUptimeStrong) heat = { band: 'strong', narrative: COPY.heat.strong };
  else if (c.uptime >= t.heatUptimeMiddle) heat = { band: 'middle', narrative: COPY.heat.middle };
  else heat = { band: 'weak', narrative: COPY.heat.weak };

  let competitor;
  if (c.connect >= t.competitorConnectStrong) competitor = { band: 'strong', narrative: COPY.competitor.strong };
  else if (c.connect >= t.competitorConnectPilotMin && c.connect <= t.competitorConnectPilotMax) {
    competitor = { band: 'middle', narrative: COPY.competitor.middle };
  } else competitor = { band: 'weak', narrative: COPY.competitor.weak };

  return {
    cumulative: c,
    heat: { title: 'The heat wave', ...heat },
    competitor: { title: "The competitor's flat-rate plan", ...competitor }
  };
}

function evaluateYear3(y1, y2, thresholds) {
  const t = sanitizeThresholds(thresholds);
  const c = cumulative(y1, y2);

  if (c.connect >= t.year3ConnectStrong && c.capacity >= t.year3CapacityStrong) {
    return { band: 'strong', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.strong, cumulative: c };
  }
  if (c.connect >= t.year3ConnectPilotMin && c.connect <= t.year3ConnectPilotMax) {
    return { band: 'pilot', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.pilot, cumulative: c };
  }
  if (c.connect < t.year3ConnectPilotMin) {
    return { band: 'weak', title: 'The CEO wants AI failure prediction', narrative: COPY.year3.weak, cumulative: c };
  }

  // The authored build spec has no row for Connect >= strong with Capacity below
  // the strong capacity requirement. Students must never see development
  // scaffolding, so use the nearest authored non-success narrative while
  // retaining a separate calibrationGap flag for the instructor console.
  return {
    band: 'pilot',
    calibrationGap: true,
    internalBand: 'unresolved_calibration',
    title: 'The CEO wants AI failure prediction',
    narrative: COPY.year3.pilot,
    cumulative: c
  };
}

function evaluateAll(y1, y2, thresholds) {
  return {
    year1: evaluateYear1(y1, thresholds),
    year2: evaluateYear2(y1, y2, thresholds),
    year3: evaluateYear3(y1, y2, thresholds)
  };
}

function publicConfig() {
  return {
    meta: {
      id: META.id,
      title: META.title,
      tagline: META.tagline,
      description: META.description,
      minutes: META.minutes
    },
    lines: LINES.map(id => ({ id, label: LABELS[id] })),
    annualBudget: 9,
    runMinimum: 3,
    lineMaximum: 3,
    briefing: {
      title: 'Midland Equipment — Briefing & exhibits',
      note: 'Reference copy of the pre-class packet. It is collapsed by default so the simulation does not reteach the briefing.',
      company: [
        'Midland sells and services commercial HVAC systems — the large rooftop units that heat and cool schools, hospitals, and office buildings. The company operates in Ohio, Indiana, and Michigan, and has roughly 4,000 of its units installed in customers’ buildings. Revenue comes from two places: selling equipment, and a service department that bills by the visit. Sixty-two field technicians drive to those buildings all day, every day.',
        'The company is 41 years old, profitable, and nobody thinks it is in trouble.'
      ],
      exhibits: [
        {
          title: 'Exhibit 1 — Where the revenue comes from',
          columns: ['', 'Revenue', 'Gross margin', 'Gross profit'],
          rows: [
            ['Equipment sales', '$187M (78%)', '9%', '$16.8M'],
            ['Service', '$53M (22%)', '34%', '$18.0M']
          ],
          note: 'Read those last two numbers again before you move on.'
        },
        {
          title: 'Exhibit 2 — Where last year’s technology money went',
          body: ['The technology budget is $9 million a year and has not changed in four years.'],
          columns: ['Line', 'Last year'],
          rows: [
            ['Keeping current systems running (the 14-year-old ERP, help desk, licenses)', '$6.1M'],
            ['Backup and redundancy', '$0.7M'],
            ['Extra capacity', '$0.4M'],
            ['Getting data back from units in the field', '$0.2M'],
            ['New features and visible projects', '$1.6M']
          ]
        },
        {
          title: 'Exhibit 3 — The service department last year',
          columns: ['', ''],
          rows: [
            ['Service visits', '14,000'],
            ['Visits where the technician found nothing wrong', '19%'],
            ['Repeat visits to the same unit within 30 days', '11%'],
            ['Average cost of sending a truck', '$290']
          ],
          note: 'That is roughly 4,200 trips that arguably should not have happened, at something close to $1.2 million.'
        },
        {
          title: 'Exhibit 4 — System outages, last three years',
          body: ['Eleven unplanned outages, 214 total hours down. Sixty-one percent of those hours fell between June and August. The dispatch system is what technicians use to know where to go.']
        },
        {
          title: 'Exhibit 5 — Customers lost last year',
          body: ['Two accounts, worth $2.1 million a year in service revenue between them. Both gave the same reason on the way out, and it was not price. It was how long they waited for someone to show up.']
        },
        {
          title: 'Exhibit 6 — What the machines already know',
          body: [
            'Every unit Midland has installed since 2016 — about 3,100 of the 4,000 in the field — has a controller that records run hours, temperatures, and fault codes. The data exists today. The only way anyone at Midland can see it is for a technician to drive out and plug a laptop into the unit.',
            'Trade press, March: Carrolton Systems has been piloting a flat-rate coverage program for commercial customers in Georgia and Tennessee.'
          ]
        }
      ]
    },
    coldOpen: [
      'Midland Equipment is a mid-sized HVAC company.',
      'You are about to take responsibility for the technology choices that shape what it can become.',
      'The choices arrive before the consequences.',
      'Once the consequences show up, some of them will be too late to change.'
    ],
    position:
      'You run technology at Midland. You have $9 million to allocate this year across five lines. ' +
      'You cannot borrow from next year, and the annual caps are real.',
    viewPrompt: 'In one sentence: what should this company become?',
    viewDisclosure: 'Your instructor can see this sentence in the instructor view. It is not scored.',
    reflectionPrompts: [
      'Which Year 1 choice mattered later in a way you did not expect?',
      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'
    ],
    buyers: {
      authored: false,
      note:
        'The build specification requires three buyer valuations but does not yet define their valuation rules or copy.'
    }
  };
}

module.exports = {
  META, LINES, LABELS, DEFAULT_THRESHOLDS, sanitizeThresholds, validateThresholds,
  validateAllocation, cumulative, evaluateYear1, evaluateYear2, evaluateYear3,
  evaluateAll, publicConfig
};
