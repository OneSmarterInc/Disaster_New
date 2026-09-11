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
  if (!t) return '';
  if (band === 'strong') return '';
  return `${dollars(Math.max(0, t.heatUptimeStrong - c.uptime))} more in Uptime would have kept dispatch up throughout the heat wave.`;
}

function year3NearMiss(c, band, t) {
  if (!t) return '';
  const connectStrong = Number(t.year3ConnectStrong), capStrong = Number(t.year3CapacityStrong), pilot = Number(t.year3ConnectPilotMin);
  if (![connectStrong, capStrong, pilot].every(Number.isFinite)) return '';
  if (band === 'data_no_room') {
    return `${dollars(Math.max(0, capStrong - c.capacity))} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  }
  if (band === 'strong') {
    if (capStrong === 0) return `${dollars(c.connect - connectStrong + 1)} less in Connect would have left too little connected history for the full service.`;
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

// A transfer preserves the annual $9M totals, Run's minimum, and each destination's $3M cap.
// Restrict Uptime/Capacity donors to spending above the already-earned event's requirement.
function transferRoom(y1, y2, from, to, available) {
  let remaining = available;
  const moved = [y1, y2].map(y => {
    const donor = Math.max(0, amount(y[from]) - (from === 'run' ? 3 : 0));
    const room = Math.max(0, 3 - amount(y[to]));
    const n = Math.min(donor, room, remaining);
    remaining -= n;
    return n;
  });
  return { moved, total: moved[0] + moved[1] };
}

function opportunityCost(y1, y2, c, band, heat, t) {
  if (!t) return '';
  const destination = band === 'data_no_room' ? 'capacity' : 'connect';
  const target = destination === 'capacity' ? t.year3CapacityStrong
    : band === 'weak' ? t.year3ConnectPilotMin : t.year3ConnectStrong;
  const need = Math.max(0, target - c[destination]);
  const uptimeSurplus = heat === 'strong' ? Math.max(0, c.uptime - t.heatUptimeStrong) : 0;
  let from, available, intro;
  if (uptimeSurplus > 0) {
    from = 'uptime'; available = uptimeSurplus;
    const ratio = c.uptime === 2 * t.heatUptimeStrong ? ' — twice what this heat wave needed' : '';
    intro = `Renata’s Uptime line received ${dollars(c.uptime)}${ratio}. ${dollars(uptimeSurplus)} of it did not improve that week’s outcome, while Sam’s Connect line received ${dollars(c.connect)}${c.connect === 0 ? ' — nothing for the remote path he asked for' : ''}.`;
  } else if (c.run > 6) {
    from = 'run'; available = c.run - 6;
    intro = `Dale wanted the running cost down. You put ${dollars(c.run)} into Run across two years, ${dollars(available)} above the two annual minimums, while ${destination === 'capacity' ? 'the unrepresented Capacity line' : 'Sam’s Connect line'} received ${dollars(c[destination])}.`;
  } else if (destination === 'connect' && c.capacity > t.year3CapacityStrong && need > 0) {
    from = 'capacity'; available = c.capacity - t.year3CapacityStrong;
    intro = `Capacity received ${dollars(c.capacity)}, but Sam’s Connect line received ${dollars(c.connect)}. Spare computing room could not supply the missing field history.`;
  } else if (c.features > 0 && need > 0) {
    from = 'features'; available = c.features;
    intro = `Tom’s visible Features received ${dollars(c.features)}, while ${destination === 'capacity' ? 'Capacity, with no one speaking for it,' : 'Sam’s Connect line'} received ${dollars(c[destination])}. Those were competing uses of the same budget.`;
  } else {
    return '';
  }
  if (need === 0) return intro + ' Both field history and computing room were funded; the extra commitment was to resilience or continuity, not another capability shown in this run.';
  const room = transferRoom(y1, y2, from, destination, available);
  if (room.total === 0) return intro + ' The annual ceilings also limited where those dollars could move.';
  const moved = Math.min(need, room.total);
  const protection = from === 'uptime' ? ' Dispatch would still have held through the heat wave.' : '';
  let result = 'built more of the missing foundation, but not enough for the next Year 3 outcome';
  if (moved === need) {
    result = destination === 'capacity' || (band === 'pilot' && c.capacity >= t.year3CapacityStrong)
      ? 'made predictive service available at scale'
      : band === 'pilot' ? 'supplied the field history, though computing room would still have been missing'
      : 'reached the Year 3 prediction pilot, not a full service';
  }
  return `${intro} Moving ${dollars(moved)} from ${LABELS[from]} to ${LABELS[destination]} within the annual ceilings could have ${result}.${protection}`;
}

function buildClosingLesson(y1, y2, outcomes, thresholds) {
  const c = cumulative(y1, y2);
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const competitor = outcomes && outcomes.year2 && outcomes.year2.competitor && outcomes.year2.competitor.band;
  const buyers = outcomes && outcomes.buyers;

  const trade = opportunityCost(y1, y2, c, y3, heat, thresholds);
  const heatLeads = y3 === 'strong' && heat !== 'strong';
  const lead = heatLeads
    ? [heatSentence(c, heat), heatNearMiss(c, heat, thresholds)].filter(Boolean).join(' ')
    : [year3Sentence(c, y3), trade.includes('could have') ? '' : year3NearMiss(c, y3, thresholds)].filter(Boolean).join(' ');
  const yourRun = [lead, trade, buyerSentence(buyers)].filter(Boolean);
  const otherConsequences = [
    { title: heatLeads ? 'Year 3' : 'The heat wave', text: heatLeads ? year3Sentence(c, y3) : heatSentence(c, heat) },
    { title: 'The competitor', text: competitorSentence(c, competitor) }
  ].filter(x => x.text);


  return {
    title: 'What this run was teaching you',
    paragraphs: [
      'You spent two years making choices before you knew which consequences would matter. That is the work of architecture. It is not predicting the future. It is deciding which capabilities Midland will already have when the future arrives.',
      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. Dale was right that Run consumed money without producing something new. Renata was right that her trucks and technicians were stretched. Tom was right that the board needed something visible. Sam was right that the machines already knew more than Midland could hear. The hard part was seeing the whole company while each person was correctly defending only one part of it.',
      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. Foundations get starved precisely because nobody is asking for them yet, while the visible and urgent work arrives with a person attached.',
      'The three buyers were the final reminder that value depends on who is looking. You did not control which future arrived or what an eventual buyer would care about. You controlled whether Midland had built enough real capability that more than one future could still work.'
    ],
    yourRun,
    otherConsequences,
    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}

module.exports = { buildClosingLesson, transferRoom };
