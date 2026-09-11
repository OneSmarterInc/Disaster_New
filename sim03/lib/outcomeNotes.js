'use strict';

// Presentation only: use the resolved event and the session's existing calibration.
// These notes are never included in publicConfig or sent before the event occurs.
function year1AllocationNote(connect, band, t) {
  const start = `You put $${connect}M into Connect in Year 1.`;
  if (band === 'weak') {
    const result = t.year1ConnectStrong <= 1 ? 'the next-day report' : 'partial coverage';
    return `${start} That left Sam without a remote path. Moving $1M into Connect that year would have provided ${result}.`;
  }
  if (band === 'middle') {
    return `${start} Moving $${t.year1ConnectStrong - connect}M more into that line would have covered the gaps and delivered the report the next day.`;
  }
  const surplus = connect - t.year1ConnectStrong;
  if (surplus > 0) {
    return `${start} The report needed $${t.year1ConnectStrong}M; the other $${surplus}M did not change this renewal outcome.`;
  }
  const lesser = t.year1ConnectStrong > 1 ? 'left gaps in the report' : 'left Sam without a remote path';
  return `${start} That was enough for the next-day report. $1M less would have ${lesser}.`;
}

function heatAllocationNote(uptime, band, t) {
  const start = `You put $${uptime}M into Uptime across both allocations.`;
  if (band === 'strong') {
    const surplus = uptime - t.heatUptimeStrong;
    return surplus > 0
      ? `${start} Dispatch held at $${t.heatUptimeStrong}M; the other $${surplus}M did not change this heat-wave outcome.`
      : `${start} That kept dispatch up throughout the week. $1M less would have meant six hours on paper.`;
  }
  if (band === 'middle') {
    return `${start} $${t.heatUptimeStrong - uptime}M more would have kept dispatch up throughout the week.`;
  }
  return `${start} $${t.heatUptimeMiddle - uptime}M more would have limited the outage to six hours instead of four days.`;
}

module.exports = { year1AllocationNote, heatAllocationNote };
