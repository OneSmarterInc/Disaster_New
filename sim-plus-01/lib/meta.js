'use strict';

const META = {
  // Keep the established catalogue identity. Courses, approvals, launches and
  // completions all reference this id; changing it creates a second sim rather
  // than replacing Sim 03.
  id: 'rapid-03-bench',
  catalogueRevision: 'claims-interview-v1',
  replaces: ['rapid-sim-03'],
  title: 'Why Don\'t They Have Any Patience?',
  tagline: 'Three interviews. Fifteen minutes each. Every question has a cost.',
  description: 'Document a dental-claims intake process by interviewing three people who each hold one part of the same problem.',
  minutes: 180,
  detail: {
    world: 'Dental claims administration · platform migration',
    seat: 'Internal process analyst',
    clock: 'Three fixed fifteen-minute interviews',
    teaches: 'Question formulation · evidence synthesis · process documentation',
    tangle: 'Every source is truthful, but no single source can see the complete feedback loop.',
    turn: 'A plausible question can consume scarce access or permanently close the most important source.',
    roomIntro: 'Three people hold different parts of the process: claim intake, the receipt log, and first-pass review. Each answers truthfully from the part they can see.',
    momentsIntro: 'First inspect the incomplete vendor chart and observe the review desk. Then choose one permitted interview schedule and use three fixed fifteen-minute appointments before filing a configuration report.',
    after: 'The instructor view places every question, its time cost, and any posture change beside the submitted report. It shows which evidence was available, which was missed, and what the recommendation would cause.',
    discussion: 'Participants compare how different opening questions, interview orders, and assumptions produced different evidence from the same three truthful sources.',
    tryIt: 'Play the complete brief, observation, interview and reporting sequence before assigning it to a course.',
    sessionShape: 'Twenty minutes briefing, ten observation, forty-five interviews, twenty report, fifteen break, forty-five debrief.',
    cast: [
      { name: 'Ray Duffy', role: 'Claim intake', stake: 'He controls four arrival channels and the twice-daily releases.' },
      { name: 'Terry Voss', role: 'Receipt log', stake: 'He maintains the only receipt record and answers provider status calls.' },
      { name: 'Ruth Kessler', role: 'First-pass review', stake: 'She holds undocumented matching judgment and can close when replacement is framed carelessly.' }
    ],
    beats: [
      { at: 'Brief and observation', what: 'An incomplete vendor chart and a thirty-second routine-claim observation.' },
      { at: 'Three interviews', what: 'Fixed appointments where every question consumes scarce access.' },
      { at: 'Configuration report', what: 'Four decisions and a root cause that the platform vendor will implement.' }
    ]
  }
};

module.exports = { META };
