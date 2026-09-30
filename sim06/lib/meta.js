'use strict';
// Catalogue identity for Sim-06. Registration is unpublished until an administrator publishes it.
const cfg = require('../data/config');

const META = {
  id: cfg.sim.id,
  replaces: [], // not an alias of any retired id
  catalogueRevision: 'switch-v1-2026-09',
  title: cfg.sim.title,
  tagline: cfg.sim.cardLine,
  description:
    'Card payments are failing across a twelve-store retail chain. Reports arrive one at a time, ' +
    'and at some point you decide whether to fail over to the backup provider or hold on the first. ' +
    'The reveal shows what the second contract actually bought.',
  minutes: 15,
  detail: {
    world: 'Network continuity · regional retail chain',
    seat: 'Head of store operations at Harlow Home & Hardware',
    teaches: cfg.sim.teaches,
    modes: 'individual or team',
    marking: 'not marked',
  },
};

module.exports = { META };
