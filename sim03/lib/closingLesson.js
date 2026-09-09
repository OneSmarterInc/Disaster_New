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

function dollars(n) { return `$${Math.max(0, Number(n) || 0)}M`; }

function heatNearMiss(c, band, t) {
  if (!t || !Number.isFinite(Number(t.heatUptimeStrong)) || !Number.isFinite(Number(t.heatUptimeMiddle))) return '';
  const strong = Number(t.heatUptimeStrong), middle = Number(t.heatUptimeMiddle), x = c.uptime;
  if (band === 'strong') {
    const toMiddle = x - strong + 1;
    const toWeak = x - middle + 1;
    return `${dollars(toMiddle)} less in Uptime would have produced the six-hour paper-dispatch outcome; ${dollars(toWeak)} less would have produced the four-day outage.`;
  }
  if (band === 'middle') {
    const toStrong = strong - x;
    const toWeak = x - middle + 1;
    return `${dollars(toStrong)} more in Uptime would have made dispatch hold; ${dollars(toWeak)} less would have produced the four-day outage.`;
  }
  return `${dollars(Math.max(0, middle - x))} more in Uptime would have reached the six-hour outcome, and ${dollars(Math.max(0, strong - x))} more would have made dispatch hold.`;
}

function competitorNearMiss(c, band, t) {
  if (!t || !Number.isFinite(Number(t.competitorConnectStrong)) || !Number.isFinite(Number(t.competitorConnectPilotMin))) return '';
  const strong = Number(t.competitorConnectStrong), pilot = Number(t.competitorConnectPilotMin), x = c.connect;
  if (band === 'strong') {
    return `${dollars(x - strong + 1)} less in Connect would have left Midland with only the thirty-unit pilot.`;
  }
  if (band === 'middle') {
    return `${dollars(strong - x)} more in Connect would have let Midland match the competitor outright; ${dollars(x - pilot + 1)} less would have left it unable to respond.`;
  }
  return `${dollars(Math.max(0, pilot - x))} more in Connect would have reached the pilot, and ${dollars(Math.max(0, strong - x))} more would have let Midland match the offer outright.`;
}

function year3NearMiss(c, band, t) {
  if (!t) return '';
  const connectStrong = Number(t.year3ConnectStrong), capStrong = Number(t.year3CapacityStrong), pilot = Number(t.year3ConnectPilotMin);
  if (![connectStrong, capStrong, pilot].every(Number.isFinite)) return '';
  if (band === 'data_no_room') {
    return `${dollars(Math.max(0, capStrong - c.capacity))} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  }
  if (band === 'strong') {
    return `${dollars(c.capacity - capStrong + 1)} less in Capacity would have left the same field history with nowhere reliable to run.`;
  }
  if (band === 'pilot') {
    const needConnect = Math.max(0, connectStrong - c.connect);
    const destination = c.capacity >= capStrong ? 'the full predictive-service outcome' : 'the data-without-room outcome';
    return `${dollars(needConnect)} more in Connect would have moved Midland out of the pilot; with Capacity at ${dollars(c.capacity)}, that next outcome would have been ${destination}.`;
  }
  return `${dollars(Math.max(0, pilot - c.connect))} more in Connect would have reached the Year 3 pilot threshold.`;
}

function buyerSentence(buyers) {
  const ridge = buyers && buyers.ridge_hollow && buyers.ridge_hollow.interest;
  const corven = buyers && buyers.corven && buyers.corven.interest;
  if (!ridge || !corven) return '';
  if (ridge === corven) {
    return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was asking Dale’s question about the spending base while Corven was asking Sam’s question about the connected-data asset.`;
  }
  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. Ridge Hollow was asking Dale’s question about the cost base; Corven was asking Sam’s question about the connected-data asset. The portfolio did not change between those judgments; what each buyer valued did.`;
}

function buildClosingLesson(y1, y2, outcomes, thresholds) {
  const c = cumulative(y1, y2);
  const top = largestLine(c);
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const buyers = outcomes && outcomes.buyers;

  const yourRun = [
    [`Your largest cumulative commitment was ${top.label} at $${top.amount}M.`, year3Sentence(c, y3), year3NearMiss(c, y3, thresholds)].filter(Boolean).join(' '),
    [heatSentence(c, heat), heatNearMiss(c, heat, thresholds), competitorSentence(c, competitor), competitorNearMiss(c, competitor, thresholds)].filter(Boolean).join(' '),
    buyerSentence(buyers)
  ].filter(Boolean);

  return {
    title: 'What this run was teaching you',
    paragraphs: [
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. Dale was right that Run consumed money without producing something new. Renata was right that her trucks and technicians were stretched. Tom was right that the board needed something visible. Sam was right that the machines already knew more than Midland could hear. The hard part was seeing the whole company while each person was correctly defending only one part of it.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. Foundations get starved precisely because nobody is asking for them yet, while the visible and urgent work arrives with a person attached.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}

module.exports = { buildClosingLesson };
