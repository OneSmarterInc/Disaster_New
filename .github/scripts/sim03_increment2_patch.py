from pathlib import Path
import re

SCENARIO = Path('sim03/lib/scenario.js')
INDEX = Path('sim03/public/index.html')
FINISH = Path('sim03/api/finish.js')
LESSON = Path('sim03/lib/closingLesson.js')
BUILD = Path('sim03/build.js')
CHECK = Path('sim03/tools/check.js')
INC2 = Path('sim03/tools/increment2-check.js')


def once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, repl, label, flags=0):
    out, n = re.subn(pattern, repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit(f'{label}: expected one match, got {n}')
    return out

# ---------------- Scenario/content ----------------
s = SCENARIO.read_text()
s = once(s, "  minutes: 20,", "  minutes: 30,", 'minutes')
s = once(s,
    "      'About twenty minutes to play. The debrief is designed for the rest of the class hour.',",
    "      'About thirty minutes to play. The debrief is designed for the rest of the class hour.',",
    'session shape')
s = once(s,
    "      { label: 'Session', value: 'About an hour' }",
    "      { label: 'Session', value: '30-minute simulation + debrief' }",
    'at a glance session')
s = once(s,
    "        stake: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.',\n        quote: 'Those machines have been telling us they were about to fail for years. There has never been anywhere to put what they say.'",
    "        stake: 'Nineteen percent of 14,000 service visits find nothing wrong. At $290 a truck roll, the machines should be able to tell us before we drive there.',\n        quote: 'Nineteen percent of our visits find nothing wrong. At $290 a truck roll, I would rather hear the machine before I drive there. Those machines have been telling us they were about to fail for years.'",
    'Sam concrete want')

line_block = """const LINE_DESCRIPTIONS = Object.freeze({
  run: \"Keeps the existing systems alive. Dale: six million a year keeps the lights on and he wants that number down.\",
  uptime: \"Backup and redundancy so dispatch survives a bad day. Renata: she would rather have eight more technicians than another system.\",
  capacity: 'Headroom for growth and for anything that needs to compute.',
  connect: \"Gets the data back from the units in the field, automatically. Sam: the machines already know things his technicians still have to drive out to learn.\",
  features: \"Visible new things the business can point at. Tom: in eighteen months he needs something real to show the board.\"
});"""
s = regex_once(s, r"const LINE_DESCRIPTIONS = Object\.freeze\(\{[\s\S]*?\n\}\);", line_block, 'line descriptions')

copy_block = r'''const COPY = Object.freeze({
  year1: {
    strong: 'The school district is six weeks from renewing its service contract and asks Midland for a performance report across its rooftop units: faults, downtime, and service history. With the units connected, Sam can pull the evidence in an afternoon and the report goes out the next day instead of sending trucks to buildings. The district renews early and mentions the capability to two neighboring districts. Sam: “This is what I meant — the machines already knew; we finally stopped making a technician drive out to ask them.”',
    middle: 'The school district is six weeks from renewal and asks for the same performance report. Some unit data comes back, but coverage is patchy, so the service team still has to fill gaps by hand in a business that makes 14,000 visits a year at about $290 every time a truck rolls. The report arrives late and thin, and the district renews grudgingly. Sam: “We wired enough to prove the idea and not enough to keep my people off roofs.”',
    weak: 'The school district is six weeks from renewal and asks Midland to show how its rooftop units actually performed. With no remote path to the machines, two of Sam’s technicians spend a week on roofs pulling histories by hand, and they still cannot assemble a credible report before the deadline. The district renews on price but starts taking competitor calls. Sam: “Nineteen percent of our visits find nothing wrong, and here we are sending people out again because the data still has nowhere to go.”'
  },
  heat: {
    strong: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch is the only thing standing between sixty-two technicians and chaos, and the backup path holds through the surge; the service department closes its best month ever. The trucks stay moving because the system stays up. Renata: “I still want eight more technicians. But if dispatch had gone down this week, eight more trucks would have been eight more people waiting for paper directions.”',
    middle: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch goes down for six hours on the worst day, so the team falls back to paper, duplicate trips and callbacks in a service operation where every truck roll costs about $290. Customers wait, but the department keeps moving. Renata: “Six hours was enough to turn my department into a clipboard. I can argue about software all year; I cannot argue with that day.”',
    weak: 'July brings ten straight days above 95 degrees and service calls triple. Dispatch is down for four days in the hottest week, leaving sixty-two technicians working from phones and paper while repeat visits pile up and two hospital accounts go public with their anger. The system that was supposed to tell the trucks where to go becomes the failure inside the failure. Renata: “I asked for eight more trucks. Four days like this and I would not have known where to send them.”'
  },
  competitor: {
    strong: 'The Carrolton pilot from the trade press has become a national flat-rate coverage offer, and Midland customers start asking when they can buy the same thing. Flat-rate service only works if Midland can see which units are healthy and price the risk, and the connected history is already there when the question arrives. The alternative would have been starting an eighteen-month connectivity build after the market moved; this portfolio does not have to wait for that clock. Tom: “This is something real. I can put it in front of the board before my eighteen months are up.”',
    middle: 'The Carrolton pilot from Georgia and Tennessee has become a national flat-rate coverage offer, and Midland customers immediately ask for an answer. Midland has enough connected data to price a thirty-unit pilot, but not enough coverage to make the offer broadly without guessing at the risk. Finishing the missing connection now is an eighteen-month job, which is exactly Tom’s board window. Tom: “Thirty units is a pilot. I have a board in eighteen months. I need to know whether this becomes a business before I walk into that room.”',
    weak: 'A national rival turns Carrolton’s flat-rate pilot into a real market offer, and Midland customers start asking why they cannot have it too. Midland cannot price the risk because it still cannot see enough of the four thousand units in the field, and building that visibility now takes about eighteen months; the annual cap means money cannot buy the lost lead time back in one move. The market question arrived after the architecture decision had already been made. Tom: “That is my board window. Eighteen months to build the thing after customers ask for it means we decided this before we knew we were deciding it.”'
  },
  year3: {
    strong: 'In Year 3 the CEO asks whether Midland can predict failures before a customer calls and sell that capability across the installed base. The company now has years of field history and enough capacity to run the model continuously, so patterns across thousands of units become service calls Midland can prevent instead of emergencies it reacts to. Predictive uptime becomes something Midland can actually sell, not a demo. Sam: “We used to spend $290 to send a truck to hear what the machine could have told us yesterday. Now it tells us before the customer calls.”',
    data_no_room: 'In Year 3 the CEO asks whether Midland can predict failures before a customer calls, and the answer is painful because you have three years of fault history and nowhere to put it. The data exists, but the model runs overnight on borrowed capacity and finishes only some mornings; a conference-room demo works while a service for roughly 4,000 units does not. The CEO asks why it cannot go to every customer by spring, and the honest answer is that the harder half was built while the cheap half was starved. Sam: “You finally listened to the machines and then built nowhere for the answer to live. Now we can see the service we still cannot deliver.”',
    pilot: 'In Year 3 the CEO asks for failure prediction across Midland’s installed base. There is enough connected history to make the model real on the newest units, but not enough coverage to promise the same service across roughly 4,000 machines, so the result is a pilot rather than a business. It catches some failures early and proves the idea without yet changing what Midland can sell at scale. Sam: “It is real on the units we can hear. Four thousand units is a business; a corner of the fleet is still a demonstration.”',
    weak: 'In Year 3 the CEO asks for AI failure prediction, and the model itself is not the problem. Midland never accumulated enough usable field history, so the failure was effectively decided back in Year 1 when connecting controllers looked like plumbing and something else looked more urgent; three years later there is no history to reconstruct. Technicians are still making 14,000 service visits a year and 19% still find nothing wrong because the machines cannot tell Midland what they know remotely. Sam: “There has never been anywhere to put what they say. Three years later, that is still true.”'
  }
});

const YEAR2_INTRO = Object.freeze({
  strong: 'A year has passed. The district renewed early, and Sam’s report is now the example people point to when they argue that the machines can do more than Midland has been asking of them. Dale is back at the table looking at the Run number, and the same $9 million is available again.',
  middle: 'A year has passed. The district renewed, grudgingly, after Midland patched together a late report and the service team did work the architecture could not do for them. Dale is back at the table looking at the Run number, and the same $9 million is available again.',
  weak: 'A year has passed. The district renewed on price but has started taking competitor calls, and Sam’s team remembers the week spent on roofs because Midland could not pull its own machine history. Dale is back at the table looking at the Run number, and the same $9 million is available again.'
});'''
s = regex_once(s, r"const COPY = Object\.freeze\(\{[\s\S]*?\n\}\);\n\nconst BUYERS", copy_block + "\n\nconst BUYERS", 'outcome copy')

buyers_block = r'''const BUYERS = Object.freeze({
  carrolton: {
    id: 'carrolton',
    name: 'Carrolton Systems',
    description: 'Regional competitor',
    copy: 'We are buying the customers and the service contracts. Your systems are overhead we plan to retire in the first year.'
  },
  ridge_hollow: {
    id: 'ridge_hollow',
    name: 'Ridge Hollow Partners',
    description: 'Private equity',
    roomLink: 'This is Dale’s argument from the room, judged by a buyer: keep the cost base lean and do not carry spending that has to be defended forever.',
    high: 'Likes what it sees: a lean operation with no expensive habits. Plans to hold four years and sell, and nothing in your portfolio gets in the way of that.',
    qualified: 'Interested, with reservations about how much of the spending it would have to keep funding.',
    low: 'Sees a cost base it would have to cut hard, and it has done this often enough to know how that goes.'
  },
  corven: {
    id: 'corven',
    name: 'Corven Building Systems',
    description: 'Platform acquirer',
    roomLink: 'This is Sam’s argument from the room, judged by a buyer: the field data and customer relationships are valuable because they cannot be recreated quickly.',
    high: 'This is the only reason it is at the table. Three years of fault history from four thousand units in buildings it does not yet serve. It is not buying an HVAC dealer, it is buying what those machines have been saying.',
    qualified: 'Sees the beginning of something and would want to finish it themselves, which changes the price and who runs the company afterward.',
    low: 'It came for the fault history from four thousand units and cannot find enough connected history to buy. Without that asset, Corven sees an HVAC dealer rather than the platform Sam kept arguing Midland could become.'
  }
});'''
s = regex_once(s, r"const BUYERS = Object\.freeze\(\{[\s\S]*?\n\}\);", buyers_block, 'buyers')

# Add Year 2 context to the already-earned Year 1 outcome; no future branch data is exposed.
s = once(s,
    "return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong };",
    "return { band: 'strong', title: 'The school district asks for a performance report', narrative: COPY.year1.strong, year2Intro: YEAR2_INTRO.strong };",
    'year1 strong')
s = once(s,
    "return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle };",
    "return { band: 'middle', title: 'The school district asks for a performance report', narrative: COPY.year1.middle, year2Intro: YEAR2_INTRO.middle };",
    'year1 middle')
s = once(s,
    "return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak };",
    "return { band: 'weak', title: 'The school district asks for a performance report', narrative: COPY.year1.weak, year2Intro: YEAR2_INTRO.weak };",
    'year1 weak')

# Carry room connections with the buyer verdicts.
s = once(s,
    "      interest: ridgeInterest,\n      reason: BUYERS.ridge_hollow[ridgeInterest]",
    "      interest: ridgeInterest,\n      reason: BUYERS.ridge_hollow[ridgeInterest],\n      roomLink: BUYERS.ridge_hollow.roomLink",
    'ridge room link')
s = once(s,
    "      interest: corvenInterest,\n      reason: BUYERS.corven[corvenInterest]",
    "      interest: corvenInterest,\n      reason: BUYERS.corven[corvenInterest],\n      roomLink: BUYERS.corven.roomLink",
    'corven room link')

s = once(s,
    "    viewPrompt: 'In one sentence: what should this company become?',\n    viewDisclosure: 'Your instructor can see this sentence in the instructor view. It is not scored.',\n    reflectionPrompts: [\n      'Which Year 1 choice mattered later in a way you did not expect?',\n      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'\n    ],",
    "    viewPrompt: 'Midland should become a company that can ___ for customers by ___.',\n    viewDisclosure: 'Your instructor can see this sentence in the instructor view. It is not scored, and it will come back to you at the close.',\n    reflectionPrompts: [\n      'Dale, Renata, Tom, or Sam: whose argument did you overrule most, and would you make the same call after seeing Year 3?',\n      'If you could change one Year 1 million after seeing Year 3, where would it move and why?'\n    ],\n    reflectionDisclosure: 'Your instructor can see these responses and may use them in the class debrief. They are not scored.',",
    'view/reflection prompts')
SCENARIO.write_text(s)

# ---------------- Dynamic closing / near misses ----------------
l = LESSON.read_text()
l = once(l,
    "function buyerSentence(buyers) {",
    r'''function dollars(n) { return `$${Math.max(0, Number(n) || 0)}M`; }

function heatNearMiss(c, band, t) {
  if (!t || !Number.isFinite(Number(t.heatUptimeStrong)) || !Number.isFinite(Number(t.heatUptimeMiddle))) return '';
  const strong = Number(t.heatUptimeStrong), middle = Number(t.heatUptimeMiddle), x = c.uptime;
  if (band === 'strong') {
    const toMiddle = x - strong + 1;
    const toWeak = x - middle + 1;
    return `${dollars(toMiddle)} less in Uptime would have produced the six-hour paper-dispatch outcome; ${dollars(toWeak)} less would have produced the four-day outage.`;
  }
  if (band === 'middle') {
    const toStrong = strong - x;
    const toWeak = x - middle + 1;
    return `${dollars(toStrong)} more in Uptime would have made dispatch hold; ${dollars(toWeak)} less would have produced the four-day outage.`;
  }
  return `${dollars(Math.max(0, middle - x))} more in Uptime would have reached the six-hour outcome, and ${dollars(Math.max(0, strong - x))} more would have made dispatch hold.`;
}

function competitorNearMiss(c, band, t) {
  if (!t || !Number.isFinite(Number(t.competitorConnectStrong)) || !Number.isFinite(Number(t.competitorConnectPilotMin))) return '';
  const strong = Number(t.competitorConnectStrong), pilot = Number(t.competitorConnectPilotMin), x = c.connect;
  if (band === 'strong') {
    return `${dollars(x - strong + 1)} less in Connect would have left Midland with only the thirty-unit pilot.`;
  }
  if (band === 'middle') {
    return `${dollars(strong - x)} more in Connect would have let Midland match the competitor outright; ${dollars(x - pilot + 1)} less would have left it unable to respond.`;
  }
  return `${dollars(Math.max(0, pilot - x))} more in Connect would have reached the pilot, and ${dollars(Math.max(0, strong - x))} more would have let Midland match the offer outright.`;
}

function year3NearMiss(c, band, t) {
  if (!t) return '';
  const connectStrong = Number(t.year3ConnectStrong), capStrong = Number(t.year3CapacityStrong), pilot = Number(t.year3ConnectPilotMin);
  if (![connectStrong, capStrong, pilot].every(Number.isFinite)) return '';
  if (band === 'data_no_room') {
    return `${dollars(Math.max(0, capStrong - c.capacity))} more in Capacity would have turned the working demo into a capability Midland could run at scale.`;
  }
  if (band === 'strong') {
    return `${dollars(c.capacity - capStrong + 1)} less in Capacity would have left the same field history with nowhere reliable to run.`;
  }
  if (band === 'pilot') {
    const needConnect = Math.max(0, connectStrong - c.connect);
    const destination = c.capacity >= capStrong ? 'the full predictive-service outcome' : 'the data-without-room outcome';
    return `${dollars(needConnect)} more in Connect would have moved Midland out of the pilot; with Capacity at ${dollars(c.capacity)}, that next outcome would have been ${destination}.`;
  }
  return `${dollars(Math.max(0, pilot - c.connect))} more in Connect would have reached the Year 3 pilot threshold.`;
}

function buyerSentence(buyers) {''',
    'near miss helpers')
l = once(l,
    "    return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was testing the spending base while Corven was testing the connected-data asset.`;",
    "    return `Ridge Hollow and Corven both showed ${ridge} interest, but for different reasons: Ridge Hollow was asking Dale’s question about the spending base while Corven was asking Sam’s question about the connected-data asset.`;",
    'buyer same-interest link')
l = once(l,
    "  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. The portfolio did not change between those judgments; what each buyer valued did.`;",
    "  return `Ridge Hollow showed ${ridge} interest while Corven showed ${corven} interest. Ridge Hollow was asking Dale’s question about the cost base; Corven was asking Sam’s question about the connected-data asset. The portfolio did not change between those judgments; what each buyer valued did.`;",
    'buyer different-interest link')
l = once(l,
    "function buildClosingLesson(y1, y2, outcomes) {",
    "function buildClosingLesson(y1, y2, outcomes, thresholds) {",
    'closing signature')
l = once(l,
    "    `Your largest cumulative commitment was ${top.label} at $${top.amount}M. ${year3Sentence(c, y3)}`.trim(),\n    [heatSentence(c, heat), competitorSentence(c, competitor)].filter(Boolean).join(' '),",
    "    [`Your largest cumulative commitment was ${top.label} at $${top.amount}M.`, year3Sentence(c, y3), year3NearMiss(c, y3, thresholds)].filter(Boolean).join(' '),\n    [heatSentence(c, heat), heatNearMiss(c, heat, thresholds), competitorSentence(c, competitor), competitorNearMiss(c, competitor, thresholds)].filter(Boolean).join(' '),",
    'dynamic lesson near misses')
l = once(l,
    "      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. The people in the room made every choice sound reasonable because each of them was right about their own part. The hard part was seeing the whole company before the evidence made the answer obvious.',\n      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. That imbalance was intentional: important foundations are often easiest to starve when nobody is asking for them yet.',",
    "      'Every million you put into Run, Uptime, Capacity, Connect, or Features was also a million you did not put somewhere else. Dale was right that Run consumed money without producing something new. Renata was right that her trucks and technicians were stretched. Tom was right that the board needed something visible. Sam was right that the machines already knew more than Midland could hear. The hard part was seeing the whole company while each person was correctly defending only one part of it.',\n      'Capacity had no advocate. Connect did. Features were visible. Run and Uptime had immediate operational arguments. Foundations get starved precisely because nobody is asking for them yet, while the visible and urgent work arrives with a person attached.',",
    'named teaching paragraph')
LESSON.write_text(l)

# Pass the thresholds already used by the existing outcome engine into the closing-only renderer.
f = FINISH.read_text()
f = once(f, "  let y1, y2, outcomes, summary;", "  let y1, y2, outcomes, summary, lessonThresholds;", 'finish vars')
f = once(f,
    "      y1 = sr.run.year1;\n      y2 = sr.run.year2;\n      outcomes = sr.run.outcomes || S.evaluateAll(y1, y2, sr.sess.thresholds);",
    "      y1 = sr.run.year1;\n      y2 = sr.run.year2;\n      lessonThresholds = sr.sess.thresholds || S.DEFAULT_THRESHOLDS;\n      outcomes = sr.run.outcomes || S.evaluateAll(y1, y2, lessonThresholds);",
    'session thresholds')
f = once(f,
    "      y1 = v1.allocation; y2 = v2.allocation;\n      outcomes = S.evaluateAll(y1, y2, S.DEFAULT_THRESHOLDS);",
    "      y1 = v1.allocation; y2 = v2.allocation;\n      lessonThresholds = S.DEFAULT_THRESHOLDS;\n      outcomes = S.evaluateAll(y1, y2, lessonThresholds);",
    'standalone thresholds')
f = once(f,
    "  const closingLesson = buildClosingLesson(y1, y2, outcomes);",
    "  const closingLesson = buildClosingLesson(y1, y2, outcomes, lessonThresholds);",
    'closing call')
FINISH.write_text(f)

# ---------------- Student UI ----------------
h = INDEX.read_text()
h = once(h,
    ".copy{font-size:17px;color:#C9C6BE;line-height:1.7;max-width:780px}.copy p{margin-bottom:14px}",
    ".copy{font-size:17px;color:#C9C6BE;line-height:1.7;max-width:780px}.copy p{margin-bottom:14px}.copy .brief-profit{font-size:20px;color:var(--bone);border-left:2px solid var(--amber);padding:11px 14px;background:rgba(240,166,60,.05)}",
    'brief profit style')
h = once(h,
    ".alloc h3{font-size:20px;font-weight:400}.alloc .constraint{font:10px var(--mono);color:var(--dimmer);margin-top:3px;letter-spacing:.04em}",
    ".alloc h3{font-size:20px;font-weight:400}.alloc .constraint{font:10px var(--mono);color:var(--dimmer);margin-top:5px;letter-spacing:.02em;line-height:1.5}.alloc-rule{font:9px var(--mono);letter-spacing:.09em;text-transform:uppercase;color:var(--amber);margin-top:7px}",
    'alloc rules style')
h = once(h,
    ".buyers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:21px}.buyer{border:1px solid var(--line);background:var(--panel);padding:18px}.buyer h3{font-size:21px;font-weight:400}.buyer .value{font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--dimmer);margin-top:12px}.buyer p{font-size:14px;color:var(--dim);margin-top:7px}",
    ".buyers{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:21px}.buyer{border:1px solid var(--line);background:var(--panel);padding:18px}.buyer h3{font-size:21px;font-weight:400}.buyer .value{font:10px var(--mono);letter-spacing:.13em;text-transform:uppercase;color:var(--dimmer);margin-top:12px}.buyer p{font-size:14px;color:var(--dim);margin-top:7px}.buyer-room-link{margin-top:13px;padding-top:11px;border-top:1px solid var(--line);font-size:13px;color:#C7C4BC;font-style:italic}",
    'buyer room style')
h = once(h,
    ".timeline-body{display:grid;gap:10px}.timeline-body .outcome{margin-top:0}@media(max-width:760px){.timeline-year{grid-template-columns:1fr}.timeline-label{padding-top:0}}",
    ".timeline-body{display:grid;gap:10px}.timeline-body .outcome{margin-top:0}.timeline-pair{display:grid;gap:10px;border-left:2px solid var(--line2);padding-left:12px}.year3-stage{border:1px solid #8A6427;background:rgba(240,166,60,.035);padding:26px;margin-top:22px}.year3-opening{max-width:68ch;margin:20px 0 24px;padding:13px 15px;border-left:2px solid var(--line2);font-size:19px;font-style:italic;color:#D2CFC7}.year3-stage .outcome{margin-top:0;padding:29px}.year3-stage .outcome p{font-size:19px;line-height:1.72}@media(max-width:760px){.timeline-year{grid-template-columns:1fr}.timeline-label{padding-top:0}.year3-stage{padding:17px}}",
    'timeline/year3 style')
h = once(h,
    "@media print{header,.actions,.team,.run-complete{display:none!important}.page{width:100%!important;padding:0!important}body{background:#fff!important;background-image:none!important;color:#000!important}.page,.page *{color:#000!important}.card,.outcome,.run-cell,.mini div{background:#fff!important;border-color:#999!important;color:#000!important}.eyebrow,.hint,.run-cell .k,.mini span{color:#222!important}.card,.outcome{break-inside:avoid}.summary{break-inside:avoid}}",
    "@media print{header,.actions,.team,.run-complete{display:none!important}.page{width:100%!important;padding:0!important}body{background:#fff!important;background-image:none!important;color:#000!important}.page,.page *{color:#000!important}.card,.outcome,.run-cell,.mini div,.buyer,.result-hero,.closing-lesson,.closing-run,.closing-carry,.year3-stage{background:#fff!important;border-color:#888!important;color:#000!important}.closing-carry{border-left:3px solid #aaa!important}.eyebrow,.hint,.run-cell .k,.mini span{color:#222!important}.card,.outcome,.buyer,.closing-lesson,.year3-stage{break-inside:avoid;page-break-inside:avoid}.summary{break-inside:avoid}.timeline-pair{border-left-color:#aaa!important}}",
    'print')
h = once(h, "<div class=\"timer\">20 MIN</div>", "<div class=\"timer\">30 MIN</div>", 'timer')
h = once(h,
    "const STEPS=['Brief','Position','Room','View','Year 1','Outcome','Year 2','Events','Year 3','Buyers','Close'];",
    "const STEPS=['Brief','Room','Position','View','Year 1','Outcome','Year 2','Events','Year 3','Buyers','Close'];",
    'step order')
h = once(h,
    "    case 1:return renderPosition();\n    case 2:return renderRoom();",
    "    case 1:return renderRoom();\n    case 2:return renderPosition();",
    'render order')
h = once(h,
    "  <div class=\"copy\">${C.coldOpen.map(x=>`<p>${esc(x)}</p>`).join('')}</div>",
    "  <div class=\"copy\">${C.coldOpen.map((x,i)=>`<p class=\"${i===1?'brief-profit':''}\">${esc(x)}</p>`).join('')}</div>",
    'brief emphasis')

# Useful-view validation and commitment confirmation helpers.
h = once(h,
    "function renderView(){",
    r'''function usefulOpeningView(v){const words=String(v||'').trim().split(/\s+/).filter(Boolean);return String(v||'').trim().length>=20&&words.length>=4}
function allocationRule(line){return line.id==='run'?'$3M minimum · balance of budget is the only ceiling':'$3M annual ceiling'}
function allocationConfirmation(year,a){const text=C.lines.map(l=>`${l.label}: $${a[l.id]}M`).join('\n');return window.confirm(`Commit Year ${year}?\n\n${text}\n\nYou cannot change this allocation after the outcome is revealed.`)}
function renderView(){''',
    'helpers')
h = once(h,
    "    if(!v)return document.getElementById('viewText').focus();",
    "    if(!usefulOpeningView(v)){alert('Write a complete opening view of at least four words and 20 characters. It will come back to you at the close.');return document.getElementById('viewText').focus()}",
    'view minimum')

# Replace allocation function to add Year 2 context, Year 1 split, caps and confirmation without changing commit APIs.
new_alloc = r'''function renderAllocation(year){
  const key=year===1?'year1':'year2';
  const teamReadOnly=!S.canSubmit&&S.session?.mode==='team';
  const heading=year===1?'The first $9 million is yours.':'A year later, the same $9 million is back on the table.';
  const intro=year===1
    ? 'The ERP is fourteen years old, the service operation is profitable, and every line has a constituency. This is the first portfolio you set before anyone knows which problem arrives first.'
    : (S.year1Outcome?.year2Intro||'A year has passed. The first consequence is now part of Midland’s history, and the same five lines are competing for the same budget again.');
  if(teamReadOnly){
    const committed=S.teamRun?.[key]||null;
    if(committed)S[key]=committed;
    const captain=S.mates.find(m=>m.isCaptain)?.name||'your captain';
    const running=year===2&&S.year1&&committed?runningTotals(S.year1,committed):null;
    shell(`<div class="eyebrow">Year ${year} allocation</div><h2>${heading}</h2><p class="lede">${esc(intro)}</p>
    ${briefingPanel()}
    ${year===2&&S.year1?runningHTML(S.year1,'Year 1 committed'):''}
    ${committed?readOnlyAllocationHTML(committed,`Team Year ${year} allocation`):notice(`Waiting for ${captain} to commit Year ${year}.`)}
    ${running?runningHTML(running,'Cumulative team portfolio'):''}
    <div class="locked">Team allocation is read-only for non-captains. ${committed?`Committed by ${esc(captain)}.`:`${esc(captain)} is choosing the shared allocation.`}</div>
    ${nav({backOk:year===1,nextLabel:committed?'Continue':'Waiting for captain',disabled:blocked()||!committed})}`);
    wireNav(async()=>{
      if(!committed)return;
      try{
        if(year===1){const d=await request('/api/outcome',{stage:'year1',year1:S.year1,sessionCode:S.sessionCode,participantId:S.participantId});S.year1Outcome=d.outcome}
        else {const d=await request('/api/outcome',{stage:'year2',year1:S.year1,year2:S.year2,sessionCode:S.sessionCode,participantId:S.participantId});S.year2Outcome=d.outcome}
        next();
      }catch(e){alert(e.message)}
    });
    return;
  }
  if(!S[key])S[key]=defaultAlloc();
  const a=S[key],used=Object.values(a).reduce((x,y)=>x+y,0),left=9-used;
  const running=year===2&&S.year1?runningTotals(S.year1,a):null;
  shell(`<div class="eyebrow">Year ${year} allocation</div><h2>${heading}</h2><p class="lede">${esc(intro)}</p>
  ${briefingPanel()}
  ${year===2&&S.year1?runningHTML(S.year1,'Year 1 committed'):''}
  ${running?runningHTML(running,'Running totals, including this draft'):''}
  <div class="alloc-wrap"><div class="allocs">${C.lines.map(l=>allocRow(l,a,year)).join('')}</div>
  <aside class="budget"><div class="n">${left}</div><div class="lab">$M remaining</div><div class="total">Allocated: <b>$${used}M</b> of $9M<br>Submit unlocks only at exactly $9M.</div></aside></div>
  ${nav({backOk:year===1,nextLabel:left===0?`Commit Year ${year}`:'Allocate all $9M',disabled:blocked()||left!==0})}`);
  document.querySelectorAll('.step').forEach(b=>b.onclick=()=>changeAlloc(key,b.dataset.line,Number(b.dataset.delta)));
  wireNav(async()=>{
    const v=validateClient(S[key]);if(v)return alert(v);
    if(!allocationConfirmation(year,S[key]))return;
    try{
      await saveRun({[key]:S[key]});
      if(year===1){const d=await request('/api/outcome',{stage:'year1',year1:S.year1,sessionCode:S.sessionCode,participantId:S.participantId});S.year1Outcome=d.outcome}
      else {const d=await request('/api/outcome',{stage:'year2',year1:S.year1,year2:S.year2,sessionCode:S.sessionCode,participantId:S.participantId});S.year2Outcome=d.outcome}
      next();
    }catch(e){alert(e.message)}
  });
}
'''
h = regex_once(h, r"function renderAllocation\(year\)\{[\s\S]*?\n\}\nfunction readOnlyAllocationHTML", new_alloc + "function readOnlyAllocationHTML", 'allocation function')
h = regex_once(h,
    r"function readOnlyAllocationHTML\(a,label\)\{[^\n]*\}",
    "function readOnlyAllocationHTML(a,label){return `<div class=\"eyebrow\" style=\"margin-top:24px\">${esc(label)}</div><div class=\"allocs\">${C.lines.map(l=>`<div class=\"alloc\"><div><h3>${esc(l.label)}</h3><div class=\"constraint\">${esc(l.description||'')}</div><div class=\"alloc-rule\">${esc(allocationRule(l))}</div></div><div class=\"amount\">${a[l.id]}<small> M</small></div></div>`).join('')}</div>`}",
    'readonly allocation')

old_alloc_row = r'''function allocRow(l,a,key){
  const n=a[l.id],min=l.id==='run'?3:0,max=l.id==='run'?9:3;
  const readOnly=!S.canSubmit&&S.session?.mode==='team';
  return `<div class="alloc"><div><h3>${esc(l.label)}</h3><div class="constraint">${esc(l.description||'')}</div></div><div class="stepper">
    <button class="step" data-line="${l.id}" data-delta="-1" ${readOnly||n<=min?'disabled':''}>−</button>
    <div class="amount">${n}<small> M</small></div>
    <button class="step" data-line="${l.id}" data-delta="1" ${readOnly||n>=max?'disabled':''}>+</button></div></div>`;
}'''
new_alloc_row = r'''function allocRow(l,a,key){
  const n=a[l.id],min=l.id==='run'?3:0,max=l.id==='run'?9:3,used=Object.values(a).reduce((x,y)=>x+y,0);
  const readOnly=!S.canSubmit&&S.session?.mode==='team';
  const minusDisabled=readOnly||n<=min,plusDisabled=readOnly||n>=max||used>=9;
  const minusTitle=readOnly?'Read-only team allocation':n<=min?(l.id==='run'?'Run has a $3M minimum':'Already at $0M'):'Remove $1M';
  const plusTitle=readOnly?'Read-only team allocation':n>=max&&l.id!=='run'?'$3M annual ceiling reached':used>=9?'All $9M is already allocated':'Add $1M';
  return `<div class="alloc"><div><h3>${esc(l.label)}</h3><div class="constraint">${esc(l.description||'')}</div><div class="alloc-rule">${esc(allocationRule(l))}</div></div><div class="stepper">
    <button class="step" title="${esc(minusTitle)}" data-line="${l.id}" data-delta="-1" ${minusDisabled?'disabled':''}>−</button>
    <div class="amount">${n}<small> M</small></div>
    <button class="step" title="${esc(plusTitle)}" data-line="${l.id}" data-delta="1" ${plusDisabled?'disabled':''}>+</button></div></div>`;
}'''
h = once(h, old_alloc_row, new_alloc_row, 'alloc row')

h = once(h,
    "  shell(`<div class=\"eyebrow\">Year 1 outcome</div><h2>The first consequence arrives.</h2>",
    "  shell(`<div class=\"eyebrow\">Year 1 outcome</div><h2>A renewal is six weeks away. The district wants proof.</h2>",
    'year1 heading')
h = once(h,
    "  shell(`<div class=\"eyebrow\">Year 2 outcomes</div><h2>Two events resolve in sequence.</h2>${cum?runningHTML(cum,'Cumulative portfolio'):''}",
    "  shell(`<div class=\"eyebrow\">Year 2 outcomes</div><h2>Year 2 stops being quiet.</h2><p class=\"lede\">First the weather turns. Then the market does.</p>${cum?runningHTML(cum,'Cumulative portfolio'):''}",
    'year2 outcome heading')

new_y3 = r'''function renderYear3(){
  const o=S.allOutcomes?.year3;
  const cum=o?.cumulative||(S.year1&&S.year2?runningTotals(S.year1,S.year2):null);
  shell(`<div class="eyebrow">Year 3</div><h2>The CEO asks whether Midland can predict a failure before the truck rolls.</h2>
  <p class="lede">The request is now on the table. The architecture underneath it is the one built over the previous two years.</p>
  ${cum?runningHTML(cum,'Cumulative portfolio'):''}
  <section class="year3-stage">
    <div class="eyebrow">Your opening view</div><div class="year3-opening">“${esc(S.strategicView||'—')}”</div>
    ${o?`<div class="outcome"><h3>${esc(o.title)}</h3><p>${esc(o.narrative)}</p></div>`:notice('Year 3 outcome is unavailable.',true)}
  </section>
  ${nav({backOk:false,nextLabel:C.buyers?.authored===false?'Continue to close':'See the three buyers'})}`);wireNav(next,false);
}'''
h = regex_once(h, r"function renderYear3\(\)\{[\s\S]*?\n\}", new_y3, 'year3 screen')

# Room links on both buyer displays.
h = once(h,
    "<div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p></div>`).join('')}</div>",
    "<div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p>${x.roomLink?`<div class=\"buyer-room-link\">${esc(x.roomLink)}</div>`:''}</div>`).join('')}</div>",
    'buyer screen room link')
h = once(h,
    "<div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p></div>`).join('')}</div><div class=\"buyer-close\">${esc(S.allOutcomes.buyers.closing||'')}</div>",
    "<div class=\"buyer-interest ${esc(x.interest)}\">${esc(x.interest)}</div><p>${esc(x.reason)}</p>${x.roomLink?`<div class=\"buyer-room-link\">${esc(x.roomLink)}</div>`:''}</div>`).join('')}</div><div class=\"buyer-close\">${esc(S.allOutcomes.buyers.closing||'')}</div>",
    'final buyers room link')

# Pair the two Year 2 events visually in the final summary.
h = once(h,
    "        <div class=\"timeline-year\"><div class=\"timeline-label\">Year 2</div><div class=\"timeline-body\">\n          ${y2o?.heat?`<div class=\"outcome\"><h3>${esc(y2o.heat.title)}</h3><p>${esc(y2o.heat.narrative)}</p></div>`:''}\n          ${y2o?.competitor?`<div class=\"outcome\"><h3>${esc(y2o.competitor.title)}</h3><p>${esc(y2o.competitor.narrative)}</p></div>`:''}\n        </div></div>",
    "        <div class=\"timeline-year\"><div class=\"timeline-label\">Year 2</div><div class=\"timeline-body\"><div class=\"timeline-pair\">\n          ${y2o?.heat?`<div class=\"outcome\"><h3>${esc(y2o.heat.title)}</h3><p>${esc(y2o.heat.narrative)}</p></div>`:''}\n          ${y2o?.competitor?`<div class=\"outcome\"><h3>${esc(y2o.competitor.title)}</h3><p>${esc(y2o.competitor.narrative)}</p></div>`:''}\n        </div></div></div>",
    'timeline pair')

h = once(h,
    "  shell(`<div class=\"eyebrow\">Close</div><h2>Return to what you believed before the consequences.</h2>",
    "  shell(`<div class=\"eyebrow\">Close</div><h2>The decisions are over. What changed your mind?</h2>",
    'close heading')
h = once(h,
    "  <div class=\"field\"><label>${esc(C.reflectionPrompts[1])}</label><textarea id=\"r2\" maxlength=\"1500\">${esc(S.reflection2)}</textarea></div>\n  <div class=\"actions\"><button class=\"btn pri\" id=\"finishBtn\">Complete run</button></div>`);",
    "  <div class=\"field\"><label>${esc(C.reflectionPrompts[1])}</label><textarea id=\"r2\" maxlength=\"1500\">${esc(S.reflection2)}</textarea></div>\n  <div class=\"hint\">${esc(C.reflectionDisclosure||'Your instructor can see these responses. They are not scored.')}</div>\n  <div class=\"actions\"><button class=\"btn pri\" id=\"finishBtn\">Complete run</button></div>`);",
    'reflection notice')
INDEX.write_text(h)

# ---------------- Regression tests / build guards ----------------
if INC2.exists():
    raise SystemExit('increment2-check.js already exists')
INC2.write_text(r'''const assert = require('assert');
const fs = require('fs');
const path = require('path');
const S = require('../lib/scenario.js');
const { buildClosingLesson } = require('../lib/closingLesson.js');

const valid = x => { const v=S.validateAllocation(x); assert.equal(v.ok,true,JSON.stringify(v)); return v.allocation; };
const cfg=S.publicConfig();
assert.equal(S.META.minutes,30);
assert.ok(S.META.detail.sessionShape.includes('thirty minutes'));
assert.ok(cfg.lines.find(x=>x.id==='capacity').description.includes('Nobody asks for this')===false);
assert.ok(cfg.lines.find(x=>x.id==='uptime').description.includes('Renata'));
assert.ok(cfg.lines.find(x=>x.id==='connect').description.includes('Sam'));
assert.ok(cfg.lines.find(x=>x.id==='features').description.includes('Tom'));
assert.ok(cfg.reflectionPrompts[0].includes('Dale') && cfg.reflectionPrompts[0].includes('Sam'));
assert.ok(cfg.reflectionDisclosure.includes('class debrief'));
assert.ok(cfg.viewPrompt.includes('___'));

const y1Weak=valid({run:3,uptime:2,capacity:2,connect:0,features:2});
const y1Mid=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
const y1Strong=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
for(const [band,a] of [['weak',y1Weak],['middle',y1Mid],['strong',y1Strong]]){
  const o=S.evaluateYear1(a); assert.equal(o.band,band); assert.ok(o.narrative.length>300); assert.ok(o.narrative.includes('Sam:')); assert.ok(o.year2Intro.length>100);
}
assert.ok(S.evaluateYear1(y1Weak).narrative.includes('two of Sam’s technicians spend a week on roofs'));

const strongA=valid({run:3,uptime:2,capacity:0,connect:2,features:2});
const strongB=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
const midA=valid({run:3,uptime:1,capacity:1,connect:1,features:3});
const midB=valid({run:3,uptime:1,capacity:1,connect:2,features:2});
const weakA=valid({run:3,uptime:0,capacity:3,connect:0,features:3});
const weakB=valid({run:3,uptime:1,capacity:3,connect:1,features:1});
const y2Strong=S.evaluateYear2(strongA,strongB), y2Mid=S.evaluateYear2(midA,midB), y2Weak=S.evaluateYear2(weakA,weakB);
for(const o of [y2Strong.heat,y2Mid.heat,y2Weak.heat]){ assert.ok(o.narrative.length>300); assert.ok(o.narrative.includes('Renata:')); assert.ok(o.narrative.includes('95')); }
for(const o of [y2Strong.competitor,y2Mid.competitor,y2Weak.competitor]){ assert.ok(o.narrative.length>350); assert.ok(o.narrative.includes('Tom:')); assert.ok(o.narrative.includes('eighteen')); assert.ok(o.narrative.includes('Carrolton')); }

const y3StrongA=valid({run:3,uptime:1,capacity:1,connect:3,features:1});
const y3StrongB=valid({run:3,uptime:2,capacity:1,connect:2,features:1});
const noRoomA=valid({run:3,uptime:3,capacity:0,connect:3,features:0});
const noRoomB=valid({run:3,uptime:0,capacity:0,connect:3,features:3});
const pilotA=valid({run:3,uptime:2,capacity:1,connect:2,features:1});
const pilotB=valid({run:3,uptime:1,capacity:1,connect:1,features:3});
const y3WeakA=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
const y3WeakB=valid({run:3,uptime:2,capacity:1,connect:1,features:2});
for(const o of [S.evaluateYear3(y3StrongA,y3StrongB),S.evaluateYear3(noRoomA,noRoomB),S.evaluateYear3(pilotA,pilotB),S.evaluateYear3(y3WeakA,y3WeakB)]){
  assert.ok(o.narrative.length>350); assert.ok(o.narrative.includes('Sam:'));
}
assert.ok(S.evaluateYear3(noRoomA,noRoomB).narrative.includes('three years of fault history and nowhere to put it'));
assert.ok(S.evaluateYear3(y3WeakA,y3WeakB).narrative.includes('Year 1'));

const buyers=S.evaluateBuyers(noRoomA,noRoomB);
assert.ok(!buyers.carrolton.reason.includes('worth sitting with'));
assert.ok(buyers.ridge_hollow.roomLink.includes('Dale'));
assert.ok(buyers.corven.roomLink.includes('Sam'));
const corvenLow=S.evaluateBuyers(y3WeakA,y3WeakB).corven;
assert.equal(corvenLow.interest,'low'); assert.ok(corvenLow.reason.includes('Sam'));

const lesson=buildClosingLesson(midA,midB,S.evaluateAll(midA,midB),S.DEFAULT_THRESHOLDS);
const text=[...lesson.paragraphs,...lesson.yourRun].join(' ');
for(const name of ['Dale','Renata','Tom','Sam']) assert.ok(text.includes(name));
assert.equal(text.includes('That imbalance was intentional'),false);
assert.ok(text.includes('more in Connect would have let Midland match the competitor outright'));
assert.ok(/less in Uptime|more in Uptime/.test(text));

const html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
assert.ok(html.includes("const STEPS=['Brief','Room','Position','View'"));
assert.ok(html.includes('case 1:return renderRoom()') && html.includes('case 2:return renderPosition()'));
for(const marker of ['30 MIN','brief-profit','allocationConfirmation','usefulOpeningView','Year 1 committed','year3-stage','timeline-pair','reflectionDisclosure','buyer-room-link','$3M annual ceiling reached']) assert.ok(html.includes(marker),marker);
for(const old of ['The first consequence arrives.','You get one more allocation.','Two events resolve in sequence.','You do not get another move.','Return to what you believed before the consequences.']) assert.equal(html.includes(old),false,old);
console.log('RapidSim 03 Increment 2 checks passed.');
''')

# Update old Increment 1 assertions that deliberately changed in Increment 2.
c = CHECK.read_text()
c = once(c,
    "assert.equal(inc1.lines.find(x => x.id === 'capacity').description, 'Headroom for growth and for anything that needs to compute. Nobody asks for this.');\nassert.equal(inc1.lines.find(x => x.id === 'connect').description, \"Gets the data back from the units in the field, automatically. Sam's line.\");",
    "assert.equal(inc1.lines.find(x => x.id === 'capacity').description, 'Headroom for growth and for anything that needs to compute.');\nassert.equal(inc1.lines.find(x => x.id === 'connect').description.includes('Sam'), true);",
    'existing checks')
CHECK.write_text(c)

b = BUILD.read_text()
b = once(b,
    "if (!finishSource.includes('buildClosingLesson(y1, y2, outcomes)')) refuse('server-authored dynamic closing lesson missing');",
    "if (!finishSource.includes('buildClosingLesson(y1, y2, outcomes, lessonThresholds)')) refuse('server-authored dynamic closing lesson missing');",
    'closing build call')
b = once(b,
    "if (index.includes('calibrationGap') || index.includes('unresolved_calibration')) refuse('resolved Year 3 calibration scaffolding remains in the student UI');",
    "for (const marker of ['30 MIN','allocationConfirmation','usefulOpeningView','year3-stage','timeline-pair','reflectionDisclosure','buyer-room-link']) if (!index.includes(marker)) refuse('Increment 2 student marker missing: ' + marker);\nif (S.META.minutes !== 30) refuse('Increment 2 catalogue duration is not 30 minutes');\nif (index.includes('That imbalance was intentional')) refuse('simulation-design language leaked into the debrief');\nif (index.includes('calibrationGap') || index.includes('unresolved_calibration')) refuse('resolved Year 3 calibration scaffolding remains in the student UI');",
    'inc2 guards')
b = once(b,
    "execFileSync(process.execPath, [path.join(__dirname, 'tools', 'closing-lesson-check.js')], { stdio: 'inherit' });",
    "execFileSync(process.execPath, [path.join(__dirname, 'tools', 'closing-lesson-check.js')], { stdio: 'inherit' });\nexecFileSync(process.execPath, [path.join(__dirname, 'tools', 'increment2-check.js')], { stdio: 'inherit' });",
    'inc2 check hook')
BUILD.write_text(b)
