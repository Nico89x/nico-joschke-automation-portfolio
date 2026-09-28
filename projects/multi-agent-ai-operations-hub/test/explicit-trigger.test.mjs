import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExplicitTrigger } from '../src/explicit-trigger.mjs';

test('explicit start events are resolved without depending on missing downstream details', () => {
  assert.equal(resolveExplicitTrigger('A confirmed signed HTTP POST event arrives for each new order; CRM permissions are not yet known.'), 'webhook');
  assert.equal(resolveExplicitTrigger('New invoices arrive in a dedicated mailbox and need a review draft; mailbox permissions remain open.'), 'email');
  assert.equal(resolveExplicitTrigger('Every Friday at 18:00, produce a local stock report; the API scopes remain open.'), 'schedule');
  assert.equal(resolveExplicitTrigger('Jeden Werktag um 07:00 Uhr soll ein lokaler Bericht erstellt werden.'), 'schedule');
  assert.equal(resolveExplicitTrigger('On the first Monday of each quarter, prepare a capacity review.'), 'schedule');
  assert.equal(resolveExplicitTrigger('Every 15 minutes, inspect the local queue.'), 'schedule');
  assert.equal(resolveExplicitTrigger('An analyst clicks Generate Preview after choosing a date range.'), 'manual');
});

test('ambiguous or unconfirmed start events stay with the model', () => {
  assert.equal(resolveExplicitTrigger('A form should update a CRM, but event delivery is not known.'), null);
  assert.equal(resolveExplicitTrigger('The owner has not confirmed which event begins the job: an email or a portal event.'), null);
  assert.equal(resolveExplicitTrigger('No webhook is supported; the source of the event remains undecided.'), null);
  assert.equal(resolveExplicitTrigger('The team hopes a vendor will provide a webhook, but this is not confirmed.'), null);
});
