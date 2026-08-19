// What the public catalogue says about a simulation, and where each sentence
// comes from.
//
// Three sources, in order. An administrator's wording wins, because they know
// their audience. Then whatever the simulation sent about itself when it
// registered. Then these defaults, which are the sentences that are true of
// every Rapid Sim — so a page is never blank and an administrator is always
// editing something rather than facing an empty box.
const DEFAULTS = {
  world: '',
  seat: '',
  clock: '',
  teaches: '',
  tangle: '',
  turn: '',
  after: 'The debrief says what actually happened, then reads the three commitments back with a verdict on each — including whether the evidence they named as decisive arrived, and whether they acted on it when it did.',

  // The parts that are true of every simulation. Editable all the same, since
  // an institution may want to say them differently.
  roomIntro: 'Four people, played by AI, who answer questions, disagree with each other, and can be taken aside privately. Each one\'s exposure is shown on screen from the start — this is not a hidden twist.',
  momentsIntro: 'The clock runs on its own. Three times, a student commits in writing to what they think is happening, the one action they are taking, and the evidence that would change their mind. Recording a position moves the incident on; there is no going back.',
  discussion: 'In a class, every student\'s three positions appear side by side on the projector. Most of the teaching happens there — in the twenty-five minutes of argument about why two people looking at identical evidence committed to opposite readings.',
  tryIt: 'Facilitators get seven days with any simulation, free, to play it as a student would before committing a class to it.',
  sessionShape: 'Five minutes to get everyone in. Twenty to play, each on their own screen. Ten while they read their own debrief. Twenty-five of discussion. No preparation beyond the cover note.'
};

// The fields an administrator can rewrite, in the order they appear on the page.
const FIELDS = [
  { key: 'world',        label: 'Setting',                  hint: 'Shown beside the number.',
    eg: 'IT operations · managed services' },
  { key: 'seat',         label: 'You are',                  hint: 'The chair the student occupies.',
    eg: 'VP of Operations' },
  { key: 'clock',        label: 'Spans',                    hint: 'From when to when.',
    eg: '02:14 Tuesday to Day 3' },
  { key: 'teaches',      label: 'Teaches',                  hint: 'One line. Shown on the list and in the sidebar.',
    eg: 'Sequencing under uncertainty · weighing advice from people with something at stake' },
  { key: 'tangle',       label: 'What makes it hard',       hint: 'The problem, without the answer.', rows: 3,
    eg: 'Two explanations produce identical symptoms, and the response to one destroys your ability to diagnose the other.' },
  { key: 'turn',         label: 'Why it teaches something', hint: 'The argument for the format — usually about exposure.', rows: 3,
    eg: 'Two people in the room are exposed by opposite explanations, and both are competent and honest.' },
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
