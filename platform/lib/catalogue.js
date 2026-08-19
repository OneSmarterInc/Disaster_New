// What the public catalogue says about a simulation, and where each sentence
// comes from.
//
// Three sources, in order. An administrator's wording wins, because they know
// their audience. Then whatever the simulation sent about itself when it
// registered. Then these defaults, which are the sentences that are true of
// every RapidSim — so a page is never blank and an administrator is always
// editing something rather than facing an empty box.
const DEFAULTS = {
  world: '',
  seat: '',
  clock: '',
  teaches: '',
  tangle: '',
  turn: '',
  after: 'At the end they find out what was really going on. Then they see their own three answers, marked. Did the thing they said would change their mind turn up? Did they do anything about it?',

  // The parts that are true of every simulation. Editable all the same, since
  // an institution may want to say them differently.
  roomIntro: 'Four people. They answer questions, argue with each other, and will say different things in private. What each of them stands to lose is on screen from the start.',
  momentsIntro: 'The clock keeps going whether they are ready or not. Three times they write down what they think is going on, what they are doing about it, and what would change their mind. Then it moves on without them.',
  discussion: 'Every answer then goes up side by side. That is where the class is. Two students saw the same thing and decided the opposite, and now they have to say why.',
  tryIt: 'Seven days with any of them, free. Play it the way your students will, then decide.',
  sessionShape: 'Five minutes to get everyone in. Twenty to play. Ten to read what they got. Twenty-five to argue about it. Nothing to prepare.'
};

// The fields an administrator can rewrite, in the order they appear on the page.
const FIELDS = [
  { key: 'tagline',      label: 'One line',                 hint: 'Under the title, on the list and at the top of the page.',
    eg: 'Twenty minutes in a room where nobody knows what is wrong yet.' },
  { key: 'description',  label: 'The situation',            hint: 'The opening paragraph, on the list and at the top of the page.', rows: 3,
    eg: 'Data corruption is spreading across client applications at two in the morning.' },
  { key: 'world',        label: 'Setting',                  hint: 'Shown beside the number.',
    eg: 'IT operations · managed services' },
  { key: 'seat',         label: 'You are',                  hint: 'The chair the student occupies.',
    eg: 'VP of Operations' },
  { key: 'clock',        label: 'Spans',                    hint: 'From when to when.',
    eg: '02:14 Tuesday to Day 3' },
  { key: 'teaches',      label: 'Teaches',                  hint: 'One line. Shown on the list and in the sidebar.',
    eg: 'What to do first when you do not know · how to weigh advice from people with something to lose' },
  { key: 'tangle',       label: 'What makes it hard',       hint: 'The problem, without the answer.', rows: 3,
    eg: 'Two explanations, identical symptoms, and fixing one destroys the evidence for the other.' },
  { key: 'turn',         label: 'Why it teaches something', hint: 'The argument for the format — usually about exposure.', rows: 3,
    eg: 'Two people in the room are blamed by opposite explanations. Both are good at their jobs.' },
  { key: 'roomIntro',    label: 'Introducing the room',     hint: 'Above the four characters.', rows: 3 },
  { key: 'momentsIntro', label: 'Introducing the moments',  hint: 'Above the three beats.', rows: 3 },
  { key: 'after',        label: 'Afterwards',               hint: 'What the debrief does.', rows: 3 },
  { key: 'discussion',   label: 'The discussion',           hint: 'What happens in class after everyone has played.', rows: 3 },
  { key: 'tryIt',        label: 'Try it',                   hint: 'Beside the request button.', rows: 2 },
  { key: 'sessionShape', label: 'Running a session',        hint: 'How an hour is spent.', rows: 3 }
];

// What the page will actually show, whoever wrote it.
function effective(detail) {
  const d = detail || {};
  const out = {};
  for (const k of Object.keys(DEFAULTS)) {
    out[k] = (d[k] !== undefined && String(d[k]).trim()) ? d[k] : DEFAULTS[k];
  }
  out.cast = Array.isArray(d.cast) ? d.cast : [];
  out.beats = Array.isArray(d.beats) ? d.beats : [];
  out._edited = d._edited || [];
  return out;
}

module.exports = { DEFAULTS, FIELDS, effective };


// The catalogue is public. Copy that states the outcome is worse than no copy,
// and an administrator writing it by hand is as likely as a developer shipping
// it — this is the same list the simulations' own build guard uses.
const OUTCOME_TELLS = [
  'both are true', 'neither alone', 'it was both', 'turns out to be both',
  'the real cause', 'what actually caused', 'the answer is', 'the culprit',
  'destroys the evidence', 'unless somebody stops', 'unless someone stops'
];

function statesOutcome(text) {
  const t = String(text || '').toLowerCase();
  return OUTCOME_TELLS.filter(x => t.includes(x));
}

module.exports.OUTCOME_TELLS = OUTCOME_TELLS;
module.exports.statesOutcome = statesOutcome;
