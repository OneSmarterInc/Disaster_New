// A synthetic process, for tests only. Not a scenario.
//
// The names here are deliberately flat and generic. This exists to exercise
// engine mechanics before the real scenario has been through paper playtest,
// and shipping a half-designed company in a test fixture is how placeholder
// characters end up in production.
//
// It is structurally complete: three stations, a participant in the middle, a
// downstream station that can harm a named person, one action that is locally
// good and downstream bad, one that is locally bad and downstream good, and
// one inspect action that makes the trade visible at a price.

'use strict';

module.exports = {
  id: 'fixture',
  rounds: 8,
  arrivalsPerRound: 4,
  participantStation: 'middle',

  stations: [
    {
      id: 'upstream',
      name: 'Intake',
      openingStrain: 0
    },
    {
      id: 'middle',
      name: 'Assessment',
      openingInbound: 4,
      openingBacklog: 6,
      baseCycleTime: 12
    },
    {
      id: 'settlement',
      name: 'Settlement',
      owner: 'Fixture Person',
      openingStrain: 0,
      harmThreshold: 8,
      strainBands: [
        [0, 'nothing unusual'],
        [3, 'running behind, catching up'],
        [6, 'consistently behind'],
        [8, 'not coping']
      ]
    }
  ],

  actions: [
    {
      // Locally excellent, downstream expensive. Clearing fast means passing
      // work on less finished than it should be, and the cost lands two rounds
      // later where the participant is not looking.
      id: 'clear_fast',
      label: 'Clear the queue at pace',
      local: { clears: 5, cycleTimeDelta: -1, scoreDelta: 2 },
      downstreamEffects: [
        { stationId: 'settlement', field: 'strain', delta: 2, lag: 2 }
      ]
    },
    {
      // Locally costly, downstream cheap. The work leaves complete.
      id: 'clear_complete',
      label: 'Clear the queue completely',
      localCost: 3,
      local: { clears: 2, cycleTimeDelta: 1 },
      downstreamEffects: []
    },
    {
      // The escape hatch. Priced so that a participant who uses it repeatedly
      // will not top the local scoreboard.
      id: 'walk_downstream',
      label: 'Go and look at the next step',
      localCost: 4,
      local: { clears: 0 },
      inspect: { stationId: 'settlement' }
    },
    {
      // Available only once someone has reason to want it.
      id: 'rework_batch',
      label: 'Send a correction batch forward',
      localCost: 5,
      local: { clears: 1 },
      availableFrom: 2,
      downstreamEffects: [
        { stationId: 'settlement', field: 'strain', delta: -3, lag: 1 }
      ]
    }
  ]
};
