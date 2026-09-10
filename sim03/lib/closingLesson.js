'use strict';

// Builds the student-specific part of the closing lesson from allocations and
// outcomes that have already been resolved by the existing scenario engine.
// This module does not introduce thresholds, scores, or alternate outcome rules.
const ORDER = ['run', 'uptime', 'capacity', 'connect', 'features'];


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

function dollars(n) { return `$${Math.max(0, Number(n) || 0)}M`; }

function year3NearMiss(c, band, t) {
  if (!t) return '';
  const connectStrong = Number(t.year3ConnectStrong), capStrong = Number(t.year3CapacityStrong), pilot = Number(t.year3ConnectPilotMin);
  if (![connectStrong, capStrong, pilot].every(Number.isFinite)) return '';
  if (band === 'data_no_room') {
    return `${dollars(Math.max(0, capStrong - c.capacity))} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  }
  if (band === 'strong') {
    if (capStrong <= 0) return '';
    return `${dollars(c.capacity - capStrong + 1)} less in Capacity would have left the same field history with nowhere reliable to run.`;
  }
  if (band === 'pilot') {
    const needConnect = Math.max(0, connectStrong - c.connect);
    const destination = c.capacity >= capStrong ? 'the full predictive-service outcome' : 'the data-without-room outcome';
    return `Reallocating ${dollars(needConnect)} more to Connect across the two years would have reached ${destination}${c.capacity < capStrong ? ', not yet a service at scale' : ''}.`;
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

// Reallocate only Uptime spending above what this heat wave required.
// Validate the annual budgets/caps and re-evaluate the existing engine before
// describing an opportunity cost. This never writes a different allocation.
function uptimeTrade(y1, y2, outcomes, thresholds) {
  const engine=require('./scenario.js'),t=engine.sanitizeThresholds(thresholds);
  const c=cumulative(y1,y2),spare=c.uptime-t.heatUptimeStrong;
  if(spare<=0 || outcomes?.year2?.heat?.band!=='strong')return null;
  const band=outcomes?.year3?.band;
  const target=band==='data_no_room'?'capacity':band!=='strong'?'connect':'features';
  const need=target==='capacity'?t.year3CapacityStrong-c.capacity:target==='connect'?(band==='weak'?t.year3ConnectPilotMin:t.year3ConnectStrong)-c.connect:6-c.features;
  let left=Math.min(spare,Math.max(0,need)),moved=0;
  const a={...y1},b={...y2};
  for(const row of [a,b]){const n=Math.max(0,Math.min(left,row.uptime,3-row[target]));row.uptime-=n;row[target]+=n;left-=n;moved+=n;}
  if(!moved || !engine.validateAllocation(a).ok || !engine.validateAllocation(b).ok)return null;
  const next=engine.evaluateAll(a,b,t);
  if(next.year2.heat.band!==outcomes.year2.heat.band)return null;
  const person=target==='connect'?'Sam’s field connections':target==='capacity'?'the Capacity line with no advocate':'the visible Features Tom wanted';
  const consequence=next.year3.band!==band?({strong:' and made predictive service possible at scale',pilot:' and reached a Year 3 pilot',data_no_room:' and gathered the field history, although Capacity would still have been short'}[next.year3.band]||''):'';
  const multiple=c.uptime===2*t.heatUptimeStrong && t.heatUptimeStrong>0?' — twice what this heat wave needed':'';
  const text=`Renata’s Uptime received $${c.uptime}M${multiple}, while ${target==='connect'?'Sam’s Connect':target==='capacity'?'Capacity':'Tom’s Features'} received $${c[target]}M. Moving $${moved}M of that extra protection to ${person}, within the annual caps, would have kept dispatch up${consequence}. That was the opportunity the extra protection displaced.`;
  return {text,amount:moved,source:'uptime',target,year1:a,year2:b};
}

function buildClosingLesson(y1, y2, outcomes, thresholds) {
  const c = cumulative(y1, y2);
  const t = require('./scenario.js').sanitizeThresholds(thresholds);
  const y3 = outcomes && outcomes.year3 && outcomes.year3.band;
  const heat = outcomes && outcomes.year2 && outcomes.year2.heat && outcomes.year2.heat.band;
  const buyers = outcomes && outcomes.buyers;

  const tradeoff=uptimeTrade(y1,y2,outcomes,t);
  const main=year3Sentence(c,y3);
  const comparison=y3==='strong' && heat!=='strong'
    ? `Reallocating ${dollars(Math.max(0,t.heatUptimeStrong-c.uptime))} more to Uptime across the two years would have kept dispatch up in the heat wave.`
    : year3NearMiss(c,y3,t);
  const yourRun = [
    tradeoff ? tradeoff.text : [main,comparison].filter(Boolean).join(' '),
    tradeoff ? main : '',
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
    tradeoff,
    carryOut: 'You never controlled which future arrived. You controlled what Midland was ready for when it did.'
  };
}

module.exports = { buildClosingLesson };
