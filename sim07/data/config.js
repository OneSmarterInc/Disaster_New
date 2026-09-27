// RapidSim 07 — Would You Have Bought It?
// All teaching content lives here. Code never carries scenario text.
//
// Two zones:
//   PRE_REVEAL  — may reach the browser at any time (served by /api/config).
//   REVEAL      — served only after the participant's decision is recorded and
//                 the instructor (or the auto-advance fallback) has released the stage.
// The build gate checks that nothing in PRE_REVEAL names the companies or points forward.

const META = {
  id: 'rapid-07-bought',
  replaces: [],
  catalogueRevision: 'bought-v1-2026-09',
  title: 'Would You Have Bought It?',
  tagline: 'The year 2000, and you can only see what they could see.',
  description:
    'You run the country\'s largest video rental chain. A small, loss-making company offers to sell itself to you for fifty million dollars. ' +
    'You decide on the evidence of the time, and then history arrives in stages.',
  minutes: 20,
  detail: {
    world: 'Video rental · autumn 2000',
    seat: 'Chief executive of the largest video rental chain',
    clock: 'Ten minutes to decide; the reveal follows in three stages',
    teaches: 'what was knowable at the time · how hindsight rewrites a judgement',
    tangle:
      'Four advisers, each right about the part of the business they run. A price that is small for you and large for what you are buying.',
    turn: 'Nothing is scored. Your own reasoning stays on screen while the next ten years arrive.',
    after: 'Best run early in a course that teaches by case. Individual mode is recommended.',
    format: 'individual or team · no preparation · not marked'
  }
};

const SETTINGS = {
  decisionMinutes: 10,        // decision clock
  justificationMinWords: 8,   // "at least a full sentence"
  lapseMinWords: 3,           // the one line after a lapsed offer
  lapseGraceSeconds: 20,      // decisions arriving just after the clock still count
  autoAdvanceSeconds: 90,     // reveal fallback when no console is connected
  consoleHeartbeatSeconds: 90 // console (presenter or projector) considered absent after this long
};

const PRE_REVEAL = {
  setting: {
    eyebrow: 'Autumn 2000',
    title: 'An offer on your desk',
    body: [
      'You are the chief executive of the country\'s largest video rental chain. Your stores are in almost every town, your brand is known to nearly every household that rents a film, and your company went public last year.',
      'This morning a small company asked to sell itself to you. The price is fifty million dollars. You have about ten minutes to read what your team has put together, hear from four of your senior people, and decide.'
    ],
    recognition:
      'Some of you may think you recognise this situation. Decide on the evidence in front of you, not on anything you think you remember.'
  },

  briefing: {
    sections: [
      {
        title: 'Your company',
        rows: [
          ['Stores', 'About 7,000 worldwide, most of them in the United States'],
          ['Revenue, 1999', '$4.46 billion, up about 15% on 1998. Tracking toward about $5 billion this year.'],
          ['Operating income, 1999', 'About $122 million'],
          ['Net result, 1999', 'A loss of about $69 million, after goodwill charges from a past acquisition'],
          ['Long-term debt', 'About $1.1 billion'],
          ['Extended-viewing ("late") fees', 'About 16% of revenue'],
          ['DVD', 'Under 10% of rental revenue so far; most rentals are still VHS tapes'],
          ['Ownership', 'Public since August 1999; a media group holds the majority']
        ]
      },
      {
        title: 'The offer',
        rows: [
          ['Seller', 'A four-year-old California company that rents DVDs by mail for a flat monthly fee. No due dates and no late fees.'],
          ['Price', '$50 million, fixed. Buy or decline.'],
          ['Terms', 'The founders propose that their team runs your online business as part of the deal.']
        ]
      },
      {
        title: 'The seller',
        rows: [
          ['Revenue, 1999', '$5.0 million'],
          ['Net loss, 1999', '$29.8 million'],
          ['Accumulated losses', '$41.3 million since founding'],
          ['Subscribers', 'Over 120,000 paying subscribers in March, and growing quickly'],
          ['How it finds customers', 'Mostly free-trial coupons packed inside the boxes of new DVD players'],
          ['Operations', 'One distribution centre. Discs travel both ways by the postal service.'],
          ['Recent history', 'Filed to go public in April. Withdrew the offering in July as technology shares fell.']
        ]
      },
      {
        title: 'The market',
        rows: [
          ['DVD players', 'In about 5.4 million US homes at the end of 1999. The industry forecast is about 39 million by 2004.'],
          ['Technology shares', 'Down sharply since March. Many internet start-ups are closing or looking for a buyer.'],
          ['The mood', 'Most serious observers now think the internet excitement of the last two years was overblown.']
        ]
      },
      {
        title: 'Legal notes',
        note: 'Routine items from the general counsel\'s quarterly summary.',
        rows: [
          ['Antitrust', 'Independent video stores allege that your revenue-sharing deals with the studios restrain competition.'],
          ['Employment', 'A class action in California argues that store managers should be paid overtime.'],
          ['Customers', 'Several class actions challenge your policies for customers who keep rentals past the initial rental period.']
        ]
      }
    ]
  },

  advisers: [
    {
      id: 'finance',
      name: 'Marcus Hale',
      role: 'Chief Financial Officer',
      position: 'Decline',
      text: [
        'They lost thirty million dollars on five million of revenue last year, and they pulled their share offering in July because nobody would buy it.',
        'Fifty million is ten times last year\'s sales for a company that pays to win every customer with a free trial. We carry more than a billion dollars of debt and a net loss of our own. I would need a reason to spend this, and I don\'t see one.'
      ]
    },
    {
      id: 'stores',
      name: 'Dana Whitlock',
      role: 'Executive Vice President, Store Operations',
      position: 'Decline',
      text: [
        'People decide what to watch at six o\'clock on a Friday. They want the new release tonight, not in three days.',
        'Our stores are where the habit lives, and we are a short drive from most of the country. A mail service is a niche for people who plan their evenings a week ahead.'
      ]
    },
    {
      id: 'online',
      name: 'Priya Anand',
      role: 'Vice President, Online and New Ventures',
      position: 'Buy',
      text: [
        'Our website is weak, and we don\'t know how to run a subscription business. They do.',
        'Fifty million is about one percent of our revenue. If this goes nowhere, we have lost a rounding error. If it works, we own it instead of competing with it. I\'m not predicting anything. I\'m saying the option is cheap.'
      ]
    },
    {
      id: 'studios',
      name: 'Tom Keller',
      role: 'Executive Vice President, Studio Relations and Distribution',
      position: 'Wait',
      text: [
        'Our economics rest on revenue-sharing deals with the studios, and those deals were built for stores. They buy discs wholesale and ship from one warehouse.',
        'Folding that into our supply chain would be messy. Watch them for a year. If it works, we can buy it then.'
      ]
    }
  ],

  decision: {
    title: 'Your decision',
    prompt: 'Buy the company for $50 million, or decline the offer.',
    justificationPrompt: 'In your own words, why? Write at least one full sentence.',
    confirm: 'This decision is binding. It cannot be changed after you submit it.',
    lapsedTitle: 'The offer lapsed',
    lapsedPrompt: 'The clock ran out and the offer lapsed, which counts as declining it. In one sentence, why hadn\'t you decided?',
    recognitionPrompt: 'Did you recognise these companies?',
    recognitionOptions: [['yes', 'Yes'], ['no', 'No'], ['unsure', 'Not sure']],
    hold: 'Your decision is recorded. Wait for your instructor to continue.'
  },

  team: {
    help: 'Individual works best for this sim; each student owns a judgement.',
    rule: 'Team mode: every member votes privately and writes their own reason. The majority decides for the team. A tie counts as declining, because an offer nobody can agree to accept lapses.'
  },

  debriefPrompts: [
    { stage: 'disagreement', title: 'Disagreement first', text: 'Who bought? What did you see? Now, someone who declined: answer them.' },
    { stage: 'naming', title: 'Naming', text: 'Hindsight bias. A bad decision is not the same as a bad outcome. The people who declined were right about the market and wrong about the company.' },
    { stage: 'turn', title: 'The turn', text: 'Name a decision you have made on incomplete information. What would have to be true for it to look foolish later?' }
  ]
};

const REVEAL = {
  stages: [
    {
      n: 1,
      year: '2002',
      title: 'Two years later',
      body: [
        'The seller survives the downturn and goes public in May 2002, with about 600,000 subscribers. Its revenue that year is about $150 million.',
        'Your company is still growing. Revenue passes $5 billion. On the evidence of 2002, neither choice looks foolish yet.'
      ]
    },
    {
      n: 2,
      year: '2005',
      title: 'Five years later',
      body: [
        'The seller ends 2005 with about 4 million subscribers.',
        'Your company launched its own DVD-by-mail service in 2004, and in January 2005 it stopped charging late fees. Between the fees it gave up and the cost of the new service, the change was estimated at about $400 million.',
        'It removed the fees without rebuilding what sat underneath them: the stores, the leases and the way the business made money were the same as before.'
      ]
    },
    {
      n: 3,
      year: '2010',
      title: 'Ten years later',
      body: [
        'In September 2010 your company files for bankruptcy.',
        'The seller ends 2010 with 20 million subscribers. By then most of them watch over the internet rather than on discs.'
      ],
      names: 'Your company was Blockbuster. The seller was Netflix.'
    }
  ],
  close: {
    title: 'What you wrote',
    body: 'Nothing here is scored.',
    handoff: 'Your instructor will take it from here.'
  }
};

// Strings that must never appear before the reveal. Stage 3 is the only place
// the company names may appear. Case-insensitive.
const FORBIDDEN_PRE_REVEAL = [
  'Blockbuster', 'Netflix', 'Hastings', 'Randolph', 'Antioco', 'Viacom',
  'Los Gatos', 'San Jose', 'Dallas', 'McKinney', 'streaming', 'broadband',
  'video-on-demand', 'on demand', 'bankrupt', 'Redbox'
];

module.exports = { META, SETTINGS, PRE_REVEAL, REVEAL, FORBIDDEN_PRE_REVEAL };
