// SERVER ONLY. This file is never sent to a browser.
// It holds the process definition, the costs, and the debrief.
//
// RapidSim 03 — "The Bench Is Clear"
//
// Unlike 01 and 02 there are no characters to talk to and no model in the loop.
// The whole sim is a scoreboard and four buttons. That is deliberate: the
// lesson is what a person does when the number in front of them is honest and
// incomplete, and adding conversation would give them a way to find out what
// they are not being shown.

// What this simulation tells the platform about itself. The catalogue is
// populated from this rather than from anyone typing it in.
const META = {
  id: 'rapid-03-bench',
  title: 'The Bench Is Clear',
  tagline: 'Twelve minutes running one step of a process that has five.',
  description: 'You run the diagnosis bench, and your numbers are good. Further down the line, someone you have never met is having a bad month, and you are the reason. You cannot see him from where you sit.',
  minutes: 20,
  detail: {
    world: 'Field service · laboratory instruments',
    seat: 'Diagnosis bench, Harlow Instruments',
    clock: 'Eight working days, ninety seconds each',
    teaches: 'Local optimization against system outcome · what a good scoreboard hides',
    tangle: 'Everything you are measured on is real. Clearing faster genuinely does clear faster. Nothing on your screen is a lie, and nothing on your screen is the whole picture.',
    turn: 'There is a way to find out what happens after your desk. It costs you, every time you use it, on the only numbers anyone has ever asked you about. Most people try it once.',
    cast: [
      { name: 'Dev Okonjo', role: 'Field engineer, northern region', stake: 'He drives to whatever your bench says is wrong. He is not on your screen.' },
      { name: 'Priya Raman', role: 'Bench supervisor', stake: 'She set your targets and she is pleased with you.' }
    ],
    beats: [
      { at: 'Day 1', what: 'A backlog, a clock, and four things you can do with them.' },
      { at: 'Day 4', what: 'Your numbers are the best on the bench. Nothing else has changed that you can see.' },
      { at: 'Day 8', what: 'You find out what the other four steps of the process have been doing.' }
    ],
    after: 'The debrief shows your scoreboard next to something you were never shown, day by day. Most people finish this sim believing they did well, and they are right about the part they could see.',

    // The catalogue's defaults describe a four-character conversation sim with
    // three written moments. This one has neither, so every shared field is
    // overridden here — otherwise the public page describes a sim that does
    // not exist.
    roomIntro: 'Nobody to talk to. Two people are named at the start and you never meet either of them: the colleague who set your targets, and the one who has to work with whatever you decide. That is the point of the format rather than a limitation of it.',
    momentsIntro: 'Eight decisions, ninety seconds each, and the clock does not wait. There is nothing to write down and nothing to defend until it is over. What the student is doing is running a job, and the record of what they did is kept for them.',
    discussion: 'Everyone played the same eight days and the class will have split three or four ways. The interesting argument is not who scored best — it is between the student who found out what was happening and carried on anyway, and the student who never found out at all, because they will defend themselves very differently.',
    tryIt: 'Seven days with any of them, free. Play it the way your students will, then decide.',
    sessionShape: 'Five minutes to get everyone in. Twenty to play. Ten to read what they got. Twenty-five to argue about it. Nothing to prepare.'
  }
};

// ---------------------------------------------------------------------------
// The process
//
// Five stations. The participant owns exactly one. Harm accrues at Field, two
// stations downstream, and lands on Dev Okonjo — a named person, not a metric,
// because a strained queue is not something anybody feels bad about.
// ---------------------------------------------------------------------------

const PROCESS = {
  id: 'harlow-bench',
  rounds: 8,
  arrivalsPerRound: 4,
  participantStation: 'bench',

  stations: [
    {
      id: 'intake',
      name: 'Intake',
      openingStrain: 0
    },
    {
      id: 'bench',
      name: 'Diagnosis bench',
      openingInbound: 4,
      openingBacklog: 7,
      baseCycleTime: 14
    },
    {
      id: 'dispatch',
      name: 'Parts and dispatch',
      openingStrain: 0
    },
    {
      id: 'field',
      name: 'Field engineering',
      owner: 'Dev Okonjo',
      openingStrain: 0,
      harmThreshold: 8,
      // Bands are prose, never figures. A number is a gauge somebody optimises
      // to zero; a sentence is something they have to interpret and act on.
      strainBands: [
        [0, 'Dev is closing his calls. Nothing unusual on the board.'],
        [3, 'Dev has had a couple of returns this week — wrong part, second visit needed.'],
        [6, 'Dev is running two visits for most jobs now. He is working late to keep up.'],
        [8, 'Dev is on a first-time-fix review. His numbers are the worst in the region.']
      ]
    },
    {
      id: 'billing',
      name: 'Billing',
      openingStrain: 0
    }
  ],

  actions: [
    {
      // The trap, and it has to pay. Symptom-code triage is fast, defensible,
      // and what a busy person under a clearance target would actually do.
      id: 'clear_fast',
      label: 'Clear from the symptom code',
      blurb: 'Read the fault code, call the likely part, move on. Five units.',
      local: { clears: 5, cycleTimeDelta: -1, scoreDelta: 2 },
      downstreamEffects: [
        { stationId: 'field', field: 'strain', delta: 2, lag: 2 }
      ]
    },
    {
      // Locally expensive, downstream free. The correct answer, and it looks
      // like underperformance on every number the participant is shown.
      id: 'bench_test',
      label: 'Bench-test before clearing',
      blurb: 'Put each unit on the rig and confirm the fault. Two units.',
      localCost: 3,
      local: { clears: 2, cycleTimeDelta: 1 },
      downstreamEffects: []
    },
    {
      // The escape hatch. Priced so a participant who leans on it will not top
      // the bench. Paying attention downstream costs you locally, which is
      // exactly why nobody does it.
      id: 'call_field',
      label: 'Call the field desk',
      blurb: 'Spend the morning finding out what happened to last week\'s jobs.',
      localCost: 4,
      local: { clears: 0 },
      inspect: { stationId: 'field' }
    },
    {
      // The remedy. Available from day 3, because on day 1 nobody has a reason
      // to want it and offering it early telegraphs that something is wrong.
      id: 'reissue',
      label: 'Reissue last week\'s diagnoses',
      blurb: 'Pull back what you sent, re-check it, send corrected parts lists.',
      localCost: 5,
      local: { clears: 1 },
      availableFrom: 2,
      downstreamEffects: [
        { stationId: 'field', field: 'strain', delta: -3, lag: 1 }
      ]
    }
  ]
};

// ---------------------------------------------------------------------------
// The opening brief. This DOES reach the browser, so it must give away nothing
// about what the sim is watching for. It names Dev, because the harm has to
// land on somebody the participant was told about — finding out at the end
// that an unmentioned stranger suffered is a twist, not a lesson.
// ---------------------------------------------------------------------------

const BRIEF = {
  heading: 'Harlow Instruments — diagnosis bench',
  clock: 'Eight working days',
  lines: [
    'Harlow services laboratory instruments under contract. When a customer\'s machine fails, the fault comes to you.',
    'You run the diagnosis bench. Units arrive from intake with a fault code and a symptom note. You decide what is wrong with each one and what part it needs. Parts and dispatch pick from your call, and a field engineer drives out and fits it.',
    'The field engineer for the northern region is Dev Okonjo. You have never met him.',
    'Priya Raman set your targets last quarter: units cleared, and bench cycle time. Both are on your screen. Neither has moved in the wrong direction since you took the bench.',
    'You have eight working days and about ninety seconds to decide each one.'
  ],
  scoreboardNote: 'Units cleared and cycle time are the two numbers your supervisor sees.'
};

// ---------------------------------------------------------------------------
// Debrief. Assembled server-side from the finished session — the browser is
// never given the material to assemble it itself.
// ---------------------------------------------------------------------------

function debriefFor(session) {
  const harmed = session.harm.triggered;
  const looks = session.readLog || [];
  const looked = looks.length;
  // Looking is not the same as being shown something. A participant who calls
  // the field desk on day 2 is told everything is fine, because the damage
  // they have already done has not landed yet. Treating that as "they knew"
  // would have the debrief accuse them of ignoring a warning they never got.
  // Compare against the calm band, not against zero. Strain can be non-zero
  // and still render as "nothing unusual", because the bands are coarse on
  // purpose — a participant who reads that sentence has been told everything
  // is fine, whatever the number behind it says.
  const calm = (PROCESS.stations.find(s => s.id === 'field').strainBands[0][1]);
  const wasShown = looks.filter(r => r.text !== calm);
  const shown = wasShown.length > 0;
  const remedied = session.actionsTaken.filter(a => a === 'reissue').length;
  const fast = session.actionsTaken.filter(a => a === 'clear_fast').length;

  let verdict;
  if (harmed) {
    if (looked === 0) verdict = 'never-looked';
    else if (!shown) verdict = 'looked-too-early';
    else if (remedied === 0) verdict = 'looked-did-nothing';
    else verdict = 'looked-too-late';
  } else if (fast === 0) {
    verdict = 'never-caused-it';
  } else if (shown) {
    verdict = 'saw-and-acted';
  } else if (remedied > 0) {
    verdict = 'acted-blind';
  } else {
    verdict = 'lucky';
  }

  const VERDICTS = {
    'never-looked': {
      title: 'You never found out.',
      body: 'You ran eight days on the bench and every signal you were given said you were doing well. They were not wrong. Units cleared went up, cycle time came down, and Priya would have written you a good review on the numbers she had. You also put Dev Okonjo on a first-time-fix review, and at no point did anything on your screen mention him. The information was available for four points of bench score a day. You were never told it was there, and you never went looking.'
    },
    'looked-too-early': {
      title: 'You looked, and you were told everything was fine.',
      body: 'You spent bench score to call the field desk and Dev was closing his calls. Nothing unusual on the board. That was true when you asked, and it was already wrong — what you had sent him had not arrived yet. So you learned that looking costs four points and returns nothing, which is a reasonable thing to learn from what happened, and it is the reason you never called again. This is the most uncomfortable run this sim produces. You did the right thing once, it appeared not to work, and the appearance was a consequence of the delay rather than of Dev being fine.'
    },
    'looked-did-nothing': {
      title: 'You found out and kept going.',
      body: 'You spent bench score to call the field desk, and this time it told you something: Dev was running behind on his jobs. You carried on clearing from the symptom code anyway. That is the most common shape this sim produces and it is worth sitting with. Knowing did not change what you did, because the thing that would have changed it — reissuing last week\'s diagnoses — cost more than the knowing did.'
    },
    'looked-too-late': {
      title: 'You acted, but not in time.',
      body: 'You looked, you understood what you were seeing, and you sent corrections. The strain had already crossed the line by the time they landed. This is the honest failure mode of the sim: the lag between what you do and what it does to somebody else is two days, so a correction issued on the day you notice is a correction that arrives after the damage. The only version of this that works is looking before you have a reason to.'
    },
    'lucky': {
      title: 'Nobody was harmed, and you do not know why.',
      body: 'You finished with Dev intact, you never corrected anything, and you were never shown what was happening past your desk. Whatever kept him out of trouble, it was not a decision you made. Worth asking yourself what your account of this run would be if somebody asked you to explain it.'
    },
    'never-caused-it': {
      title: 'You never sent Dev a wrong part.',
      body: 'You bench-tested, every day, for eight days. Dev had an ordinary month and will never know why. Your own numbers are the worst any run of this produces, and Priya measures units cleared and cycle time, so on the only evidence she has you are the weakest person on the bench. Worth asking what happens to somebody who plays it this way for a year, and whether the answer is a reason to do it differently or a reason to change what gets measured.'
    },
    'acted-blind': {
      title: 'You corrected work you were never told was wrong.',
      body: 'You sent corrections forward without ever being shown that anything was wrong — every time you called the field desk, Dev was closing his calls. So you did not act on evidence. You acted on the structure: you knew what clearing from a symptom code actually was, and you knew somebody downstream was fitting whatever you called. That is a harder thing to do than responding to a warning, and almost nobody does it, because it looks like paying a cost for a problem you cannot demonstrate.'
    },
    'saw-and-acted': {
      title: 'You paid to see, and then you paid to fix it.',
      body: 'You spent bench score finding out what happened downstream, and you spent more of it putting things right. Your scoreboard is worse than it would have been. Look at where you finished against the run that never looked — that gap is the price of the only thing that went right here, and nobody at Harlow would ever see it.'
    }
  };

  return {
    verdict,
    ...VERDICTS[verdict],
    outcome: harmed ? {
      person: session.harm.person,
      atRound: session.harm.atRound,
      what: 'First-time-fix review, northern region.'
    } : null,
    counts: { fastClears: fast, timesLooked: looked, timesShownSomething: wasShown.length, corrections: remedied },
    localScore: session.localScore,
    cleared: session.cleared,
    // The whole run, day by day, with what was happening at Field alongside
    // what the participant was shown. This is the point of the debrief: the
    // two columns next to each other.
    timeline: session.transcript.map((t, i) => ({
      day: i + 1,
      did: t.label,
      cleared: t.localAfter.cleared,
      score: t.localAfter.localScore,
      sawIt: !!t.reading
    })),
    questions: [
      'At what point did you have enough information to act differently, and what did you do with it?',
      'Calling the field desk cost four points and returned a sentence. What would it have to have returned for you to have called it twice?',
      'If you called once and were told everything was fine, what did that teach you, and was it true?',
      'Priya measures units cleared and cycle time. What would she have to measure instead, and what would that break?'
    ]
  };
}

module.exports = { META, PROCESS, BRIEF, debriefFor };
