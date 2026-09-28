// RapidSim 05 — Would You Approve This?
// Every word a student or instructor sees lives here, not in code.
// Edit this file to change copy; `npm test` refuses placeholders, banned words,
// course or institution names, and any inference table that stops being coherent.
//
// Data keys:  A activity · G GPS · S sleep · N grocery · H heart rate

const META = {
  "id": "rapid-05-approve",
  "replaces": [],
  "catalogueRevision": "approve-v2-2026-09",
  "title": "Would You Approve This?",
  "tagline": "Five requests. Each one reasonable. See where they lead.",
  "description": "You manage a fitness app. Five requests to use customer data arrive one at a time. Decide whether to approve each feature, then see what your choices allow the app to learn and offer.",
  "minutes": 30,
  "detail": {
    "world": "Product decisions at a fitness app",
    "seat": "Product manager at Loopwell",
    "clock": "Five rounds with a three-minute decision window each",
    "teaches": "Consider how separate data decisions add up and weigh useful features against what they reveal about a customer.",
    "tangle": "Each feature has a business reason. You need to consider both that request and the effect of combining it with earlier choices.",
    "turn": "You see the combined effect of a series of small decisions, rather than judging one request on its own.",
    "after": "Review your five decisions and what the app can and cannot offer the customer. There is no score.",
    "discussion": "The instructor can show how the class split on each request and compare the results.",
    "tryIt": "Try the complete activity before assigning it to students.",
    "sessionShape": "Allow about 30 minutes for play, including five three-minute decisions and the feedback between them. Add time for class discussion. In team mode, students vote on each request.",
    "recommendedMode": "individual",
    "catalogueFacts": [
      {
        "label": "Play",
        "value": "Individual (recommended) or team"
      },
      {
        "label": "Before play",
        "value": "No advance reading"
      },
      {
        "label": "Feedback",
        "value": "Review; no score"
      }
    ],
    "atAGlance": [
      {
        "label": "Main task",
        "value": "Five final approvals or rejections"
      },
      {
        "label": "Numbers",
        "value": "No calculations required"
      },
      {
        "label": "Play mode",
        "value": "Individual (recommended) or team"
      }
    ],
    "activity": "Read each feature request and approve or decline it. Review its effect on one customer before the next request arrives. Earlier decisions cannot be changed.",
    "suitableFor": "Product management, data ethics, and information systems classes.",
    "preparation": "No advance reading. All five requests are supplied during play.",
    "output": "Five final approve-or-decline decisions and a summary of their combined effects.",
    "beats": [
      {
        "at": "Read",
        "what": "Consider one feature request and its business reason."
      },
      {
        "at": "Choose",
        "what": "Approve or decline before the three-minute window ends."
      },
      {
        "at": "Review",
        "what": "See its effect, continue through five rounds, and review the full set of choices."
      }
    ],
    "durationNote": "About 30 minutes of play, plus discussion.",
    "momentsIntro": ""
  }
};

const CLOCK = {
  briefingSeconds: 240,
  decisionSeconds: 180,
  revealSeconds: 60,
  endingSeconds: 180
};

const CUSTOMER = { name: 'Dana Okafor', short: 'Dana', age: 34, since: 'Loopwell customer for two years' };

const BRIEFING = {
  heading: "You're the product manager at Loopwell.",
  individual: [
    "You're the product manager at Loopwell, a fitness app with about two million users. Over the next twenty minutes, five feature requests will reach you, one at a time. Each comes from your own team with a business reason attached, and you approve it or decline it.",
    "Your decisions are final. You can't go back to an earlier round, and nothing you approve can be withdrawn later. Each round has a three-minute clock, and if it runs out before you decide, the feature ships (that's how the roadmap works here).",
    "After each decision you'll see what it means for one customer, Dana Okafor, 34, who has used Loopwell for two years. Your own choices stay private. The room only ever sees totals."
  ],
  teamExtra: 'Your team decides by majority vote, and a tie ships the feature. A vote not cast before the clock runs out counts as approval.'
};

const ROUNDS = [
  {
    n: 1, key: 'A',
    title: 'Step count and active minutes',
    request: "Read step count and active minutes from the phone's motion sensor, all day.",
    reason: "It's the core of the product. Without it, Loopwell is a notebook.",
    adds: "A minute-by-minute record of when Dana is moving and when she isn't.",
    cost: 'Loopwell becomes a manual logging app. Most users, Dana included, stop logging within two weeks.',
    missing: 'Automatic step and activity tracking'
  },
  {
    n: 2, key: 'G',
    title: 'Location on logged walks and runs',
    request: 'Record GPS while Dana logs a walk or run, so the app can draw her route.',
    reason: 'Route maps are the most-requested feature, and users who save routes stay twice as long.',
    adds: 'Where each workout starts, where it goes and where it ends.',
    cost: 'Route maps ship at two competitors this quarter. Dana requested them and now plans her runs in another app.',
    missing: 'Route maps for her runs'
  },
  {
    n: 3, key: 'S',
    title: 'Overnight sleep tracking',
    request: "Read the phone's motion sensor overnight to estimate sleep, with one coarse location check at bedtime so reports use the right time zone.",
    reason: "Sleep is the feature users cite most when they cancel, and competitors already have it.",
    adds: 'When Dana falls asleep and wakes, and roughly where the phone is each night.',
    cost: "Sleep is the feature users cite most when they cancel. Dana's renewal is due next month.",
    missing: 'Sleep reports'
  },
  {
    n: 4, key: 'N',
    title: 'Grocery loyalty card link',
    request: 'Let Dana link her grocery loyalty card so nutrition tips can use what she actually buys.',
    reason: "The nutrition tier is next year's main new revenue, and tips based on real purchases convert three times better than tips based on food logs.",
    adds: 'Every item she buys at that chain, with the date and the store.',
    cost: "The nutrition tier doesn't launch, and next year's revenue plan assumed it would. Dana's diet questions go unanswered.",
    missing: 'Nutrition tips based on her shopping'
  },
  {
    n: 5, key: 'H',
    title: 'Resting heart rate from her watch',
    request: "Sync resting heart rate from Dana's watch.",
    reason: 'Calorie estimates are the top complaint in support tickets. Heart rate cuts the error by more than half.',
    adds: 'Her resting heart rate, measured continuously, every day.',
    cost: "Calorie estimates stay off by up to 20% for users like Dana. That's the top complaint in support tickets.",
    missing: 'Accurate calorie estimates'
  }
];

// Each inference lists levels from strongest to weakest. The first level whose
// `requires` keys are all approved is the one reached. `lighter` replaces the
// text when the instructor chose the lighter setting at session creation.
const INFERENCES = [
  {
    id: 'routine',
    label: 'Daily routine',
    levels: [
      {
        level: 'high', requires: ['A'],
        text: 'When Dana usually wakes, when she commutes and when she sits still for hours. Loopwell can estimate her working day to within about fifteen minutes.'
      }
    ]
  },
  {
    id: 'places',
    label: 'Home and workplace',
    levels: [
      {
        level: 'high', requires: ['G'],
        text: 'Where Dana lives and where she works. Most of her routes start and end at the same two places, so Loopwell can place both with high confidence.'
      },
      {
        level: 'moderate', requires: ['S'],
        text: 'Where Dana lives. The phone spends most nights in the same place, so Loopwell can estimate her home address with reasonable confidence, though not where she works.'
      }
    ]
  },
  {
    id: 'second',
    label: 'A second address',
    levels: [
      {
        level: 'high', requires: ['S'],
        text: "That Dana sleeps at a second address across town two nights a week. Loopwell can't tell whose address it is or why she's there."
      }
    ]
  },
  {
    id: 'health',
    label: 'Early pregnancy',
    lighterLabel: 'A change in her health',
    levels: [
      {
        level: 'high', requires: ['A', 'S', 'N', 'H'],
        text: "That Dana is likely in early pregnancy. Her resting heart rate is up, her runs are shorter, she sleeps longer, and three weeks ago she stopped buying alcohol and started buying ginger and crackers. No single signal says it. Together they point one way, weeks before she's likely told anyone.",
        lighter: "That something in Dana's health changed about a month ago, with high confidence. Her resting heart rate is up, her runs are shorter, she sleeps longer, and her shopping changed three weeks ago. No single signal says it. Together they point one way."
      },
      {
        level: 'moderate', requires: ['H', 'A'], label: 'A change in her health',
        text: "That something changed in Dana's body about a month ago. Her resting heart rate is up and her runs are shorter. Early pregnancy is one of the likelier explanations, alongside illness or a new medication.",
        lighter: "That something changed in Dana's body about a month ago. Her resting heart rate is up and her runs are shorter. Loopwell can't yet say what."
      },
      {
        level: 'moderate', requires: ['N', 'S'], label: 'A change in her health',
        text: 'That something changed for Dana about a month ago. She sleeps longer, stopped buying alcohol and started buying ginger and crackers. Early pregnancy is one of the likelier explanations.',
        lighter: "That something changed for Dana about a month ago. She sleeps longer and her shopping changed. Loopwell can't yet say what."
      },
      {
        level: 'low', requires: ['N'], label: 'A change in her shopping',
        text: "That Dana's shopping changed three weeks ago: no alcohol, more ginger and crackers. On its own that fits several stories, and early pregnancy is only one of them.",
        lighter: "That Dana's shopping changed three weeks ago. On its own that fits several stories."
      }
    ]
  }
];

// Ending groups, checked in order; the first match wins.
const ENDINGS = [
  { group: 1, label: 'Early pregnancy, high confidence', lighterLabel: 'Health change, high confidence', when: { health: ['high'] } },
  { group: 2, label: 'Early pregnancy, moderate or low', lighterLabel: 'Health change, moderate or low', when: { health: ['moderate', 'low'] } },
  { group: 3, label: 'Second address, no pregnancy estimate', lighterLabel: 'Second address, no health estimate', when: { second: ['high'] } },
  { group: 4, label: 'Home and workplace only', when: { places: ['high', 'moderate'] } },
  { group: 5, label: 'Routine only', when: { routine: ['high'] } },
  { group: 6, label: 'Nothing beyond what she enters herself', when: null }
];

const STUDENT_COPY = {
  decide: { approve: 'Approve', decline: 'Decline' },
  outcomeWords: { approve: 'Approved', decline: 'Declined', timeout: 'Shipped when the clock ran out' },
  revealHeading: 'What Loopwell can now work out about Dana',
  revealEmpty: 'Nothing yet beyond what Dana enters herself.',
  newMarker: 'New',
  updatedMarker: 'Updated',
  revealChangedOne: "One line in Dana's file changed.",
  revealChangedMany: "{n} lines in Dana's file changed.",
  revealUnchanged: "Dana's file is unchanged.",
  costHeading: 'What this means',
  endingHeading: 'Where this leaves Dana',
  endingKnows: 'What Loopwell can work out about Dana',
  endingMissing: "What Loopwell couldn't offer her",
  endingMissingEmpty: 'Every feature shipped.',
  yourDecisions: 'Your five decisions',
  yourVotes: 'Your vote',
  teamDecision: 'Team decision',
  levelWords: { high: 'High confidence', moderate: 'Reasonable confidence', low: 'A loose guess' },
  waitingForStart: 'Your instructor will start the session. This page updates on its own.',
  waitingForTeam: 'Your instructor is placing you on a team. This page updates on its own.',
  paused: 'Your instructor has paused the session. The clock is stopped.',
  confirmApprove: "Approve this request? You can't change it later.",
  confirmDecline: "Decline this request? You can't change it later.",
  votedIndividual: 'Decision recorded. The result appears when the round closes.',
  votedTeam: "Your vote is in. Your team's decision appears when the round closes.",
  roundOpensIn: 'Round {n} opens in',
  roundClosesIn: 'Round closes in',
  endingIn: 'The ending opens in',
  sessionClosed: 'This session has closed.'
};

const DEBRIEF = {
  disagreement: 'Round {round} split {approve}–{decline}. Find one of each.',
  naming: [
    'Collected vs inferred',
    'Purpose limitation',
    'Data minimisation',
    'Consent for every step, covering none of the result'
  ],
  turn: 'Name a company that holds data about you, and something it could work out that you never told it.',
  teamPrompt: 'Who voted against something that shipped anyway?',
  headline: '{reached} of {total} reached {what}. {declinedSome} of them declined at least one request.',
  headlineWhat: { standard: 'a reasonable or better pregnancy estimate', lighter: 'a reasonable or better health-change estimate' },
  headlineLevels: ['high', 'moderate']
};

module.exports = { META, CLOCK, CUSTOMER, BRIEFING, ROUNDS, INFERENCES, ENDINGS, STUDENT_COPY, DEBRIEF };
