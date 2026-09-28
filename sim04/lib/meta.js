const config = require('../data/config');

const META = Object.freeze({
  id: config.simId,
  number: 4,
  title: 'Whose Number Is Right?',
  tagline: 'Twenty-five minutes to give the board one number.',
  description: 'Ridgeway Dispatch needs one customer-retention figure. Use the quarter’s records and your assigned definition to report a number, then compare how five valid definitions lead to different answers.',
  minutes: config.clockMinutes,
  catalogueRevision: 'sim04-v1',
  detail: {
    world: 'Customer retention at a software company for trade businesses',
    seat: 'A team asked to report retention to the board',
    clock: 'A 25-minute decision window',
    teaches: 'A business number depends on its definition, the records used, and its purpose.',
    tangle: 'Every group uses the same data, but its assigned definition changes which accounts count.',
    turn: 'Commit one figure before seeing how the other groups defined retention.',
    after: 'Compare the figures, definitions, and reasons each department might prefer its measure. There is no score.',
    discussion: 'Ask groups with far-apart figures to defend their calculations before revealing the definitions.',
    sessionShape: 'Choose team or individual mode and at least three groups. Allow 25 minutes to calculate and additional time to discuss.',
    activity: 'Read the account records, support tickets and your private definition sheet. Commit a retention percentage and confidence from 1 to 5.',
    suitableFor: 'Business analytics, measurement, management and information systems classes.',
    preparation: 'No advance reading; the data pack is included.',
    output: 'One locked percentage and a confidence rating for each group.',
    durationNote: '25 minutes of play, plus discussion.',
    tryIt: 'Preview the activity before assigning it to students.',
    catalogueFacts: [
      { label: 'Play', value: 'Team or individual; at least three groups' },
      { label: 'Before play', value: 'No advance reading' },
      { label: 'Feedback', value: 'Discussion; no score' }
    ],
    atAGlance: [
      { label: 'Main task', value: 'Report one customer-retention figure' },
      { label: 'Numbers', value: 'Use the supplied account records' },
      { label: 'Play mode', value: 'Team or individual' }
    ],
    beats: [
      { at: 'Read', what: 'Examine the records and your private definition.' },
      { at: 'Commit', what: 'Submit one percentage and your confidence.' },
      { at: 'Discuss', what: 'Compare definitions after all figures are locked.' }
    ]
  }
});

const BRIEFING = 'Ridgeway Dispatch sells scheduling and invoicing software to plumbers, HVAC contractors, landscapers and other trade businesses. Customers pay monthly on one of three plans, from a one-van operator on Solo to regional firms running dozens of trucks on Fleet. The quarter has just closed, and the board chair, Elena Varga, wants one figure before the next board meeting: what was our customer retention this quarter? Your team has the quarter\'s account records, the support tickets, and a definition sheet for retention. Report one number and say how confident you are in it. Once you commit, it can\'t be changed.';

function publicConfig() {
  return {
    sim: { id: META.id, title: META.title, tagline: META.tagline, minutes: META.minutes },
    briefing: BRIEFING,
    minTeams: config.minTeams,
    warningMinutes: config.warningMinutes
  };
}

module.exports = { META, BRIEFING, publicConfig };
