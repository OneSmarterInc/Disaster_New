'use strict';

// Builds the student-specific part of the closing lesson from allocations and
// outcomes that have already been resolved by the existing scenario engine.
// This module does not introduce thresholds, scores, or alternate outcome rules.
const ORDER = ['run', 'uptime', 'capacity', 'connect', 'features'];
const LABELS = {
  run: 'Run',
  uptime: 'Uptime',
  capacity: 'Capacity',
  connect: 'Connect',
  features: 'Features'
};

function amount(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function cumulative(y1, y2) {
  const out = {};
  for (const key of ORDER) out[key] = amount(y1 && y1[key]) + amount(y2 && y2[key]);
  return out;
}

function largestLine(c) {
  let key = ORDER[0];
  for (const candidate of ORDER.slice(1)) {
    if (c[candidate] > c[key]) key = candidate;
  }
  return { key, label: LABELS[key], amount: c[key] };
}

function year3Sentence(c, band) {
  if (band === 'strong') {
    return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity worked together: Midland had both field history and room to turn predictive service into something it could actually sell.`;
  }
  if (band === 'data_no_room') {
    return `By Year 3, your $${c.connect}M in Connect had created the field history, but $${c.capacity}M in Capacity left too little room to run the model reliably at scale.`;
  }
  if (band === 'pilot') {
    return `By Year 3, your $${c.connect}M in Connect and $${c.capacity}M in Capacity got Midland to a promising pilot, but not yet to a predictive-service business.`;
  }
  if (band === 'weak') {
    return `By Year 3, your $${c.connect}M in Connect had not created enough usable field history for prediction to become a real capability.`;
  }
  return '';
}

function heatSentence(c, band) {
  if (band === 'strong') return `Your $${c.uptime}M in Uptime also meant dispatch held when the heat wave tested it.`;
  if (band === 'middle') return `Your $${c.uptime}M in Uptime kept the heat wave from becoming a full breakdown, but the service operation still had to fall back to manual work.`;
  if (band === 'weak') return `Your $${c.uptime}M in Uptime left the service operation exposed when the heat wave arrived.`;
  return '';
}

function competitorSentence(c, band) {
  if (band === 'strong') return `The same $${c.connect}M Connect investment let Midland answer the competitor from a position of strength.`;
  if (band === 'middle') return `The same $${c.connect}M Connect investment got Midland only as far as a limited pilot against the competitor.`;
  if (band === 'weak') return `The same $${c.connect}M Connect investment was not enough to answer the competitor quickly.`;
  return '';
}

function buyerSentence(buyers) {
  const ridge = buyers && buyers.ridge_hollow && buyers.ridge_hollow.interest;
  const corven = buyers && buyers.corven && buyers.corven.interest;
  if (!ridge || !corven) return '';
  if (ridge === corven) {
    return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was testing the spending base while Corven was testing the connected-data asset.`;
  }
  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. The portfolio did not change between those judgments; what each buyer valued did.`;
}

function buildClosingLesson(y1, y2, outcomes) {
  const c = cumulative(y1, y2);
  const top = largestLine(c);
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const buyers = outcomes && outcomes.buyers;

  const yourRun = [
    `Your largest cumulative commitment was ${top.label} at $${top.amount}M. ${year3Sentence(c, y3)}`.trim(),
    [heatSentence(c, heat), competitorSentence(c, competitor)].filter(Boolean).join(' '),
    buyerSentence(buyers)
  ].filter(Boolean);

  return {
    title: 'What this run was teaching you',
    paragraphs: [
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. The people in the room made every choice sound reasonable because each of them was right about their own part. The hard part was seeing the whole company before the evidence made the answer obvious.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. That imbalance was intentional: important foundations are often easiest to starve when nobody is asking for them yet.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}

module.exports = { buildClosingLesson };
