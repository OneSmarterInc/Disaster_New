'use strict';
// Auto-assignment on join and dropping unfilled slots at start.
const assert = require('node:assert/strict');
const room = require('../lib/room');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('ok ' + name); };
const make = (mode, count) => room.createSession({ code: 'ABCDE', owner: 'F', mode, count, now: 0 });
const joinMany = (s, n) => { for (let i = 0; i < n; i++) s = room.join(s, 'p' + i, 'Person ' + i, 0); return s; };

check('team mode places each joiner in the smallest group, earliest first', () => {
  const s = joinMany(make('team', 3), 7);
  assert.deepEqual(s.slots.map(x => x.memberIds.length), [3, 2, 2]);
  assert.ok(Object.values(s.participants).every(p => p.slotId));
});
check('team mode: instructor can still move someone before start', () => {
  let s = joinMany(make('team', 3), 4);
  s = room.assign(s, 'p0', 'slot-3');
  assert.equal(room.slotFor(s, 'p0').id, 'slot-3');
});
check('team mode: unfilled groups are dropped at start, spread-first sheets kept', () => {
  const s = room.start(joinMany(make('team', 6), 4), 1);
  assert.deepEqual(s.slots.map(x => x.sheetId), ['A', 'E', 'D', 'C']);
  assert.equal(s.count, 4);
});
check('lobby moves cannot leave duplicate definitions in a three-group room', () => {
  let lobby = joinMany(make('team', 6), 3);
  lobby = room.assign(lobby, 'p2', 'slot-6');
  const s = room.start(lobby, 1);
  assert.deepEqual(s.slots.map(x => x.id), ['slot-1', 'slot-2', 'slot-6']);
  assert.deepEqual(s.slots.map(x => x.sheetId), ['A', 'E', 'D']);
  assert.equal(s.count, 3);
  assert.equal(room.slotFor(s, 'p2').id, 'slot-6');
  assert.deepEqual(room.studentView(s, 'p2', 2).data.sheet.lines,
    require('../data/sheets').sheetLines('D'));
  assert.equal(lobby.slots.length, 6, 'starting must not mutate the lobby snapshot');
  assert.equal(lobby.slots[5].sheetId, 'A');
});
check('individual mode: empty seats are dropped at start', () => {
  const s = room.start(joinMany(make('individual', 30), 5), 1);
  assert.deepEqual(s.slots.map(x => x.sheetId), ['A', 'E', 'D', 'C', 'B']);
  assert.equal(s.count, 5);
});
check('start refused with fewer than three filled', () => {
  assert.throws(() => room.start(joinMany(make('individual', 10), 2), 1), /At least 3/);
  assert.throws(() => room.start(joinMany(make('team', 5), 2), 1), /At least 3/);
});
check('individual mode refuses joins past the seat count', () => {
  assert.throws(() => joinMany(make('individual', 3), 4), /full/);
});
check('reveal after dropping covers only groups that played', () => {
  let s = room.start(joinMany(make('individual', 8), 3), 1);
  s = room.advance(s, 1 + s.clockMinutes * 60000);
  s = room.advance(s, 1 + s.clockMinutes * 60000);
  const p = room.projector(s, 1 + s.clockMinutes * 60000);
  assert.equal(p.numbers.length, 3);
  assert.deepEqual(p.reveal.map(r => r.sheetId), ['A', 'E', 'D']);
});
check('no sheet reaches a participant before the clock starts', () => {
  let s = joinMany(make('team', 3), 4);
  assert.equal(room.studentView(s, 'p0', 0).data, null);
  s = room.assign(s, 'p0', 'slot-2');
  s = room.start(s, 1);
  assert.equal(room.studentView(s, 'p0', 2).data.sheet.lines.length, 5);
});
console.log(`${passed} room-fill checks passed, 0 failed`);
