import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

const account = {
  identity: 'support.lab@example.test',
  password: 'Synthetic-lab-fixture-only',
};

test('LAB-02 diagnoses a typed sign-in address and verifies the corrected sign-in', async () => {
  const signInEvents = new Map();
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/sign-in') {
      response.writeHead(404).end();
      return;
    }
    let body = '';
    for await (const chunk of request) body += chunk.toString();
    const input = JSON.parse(body);
    const reason = input.identity !== account.identity
      ? 'identity_not_found'
      : input.password !== account.password
        ? 'invalid_credentials'
        : 'succeeded';
    const id = randomUUID();
    signInEvents.set(id, { timeUtc: new Date().toISOString(), reason });
    const accepted = reason === 'succeeded';
    response.writeHead(accepted ? 200 : 401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ accepted, requestId: id }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/sign-in`;
  const signIn = async (identity) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password: account.password }),
    });
    return { status: response.status, payload: await response.json() };
  };
  try {
    const first = await signIn('suport.lab@example.test');
    assert.equal(first.status, 401);
    assert.equal(first.payload.accepted, false);
    const incident = signInEvents.get(first.payload.requestId);
    assert.equal(incident.reason, 'identity_not_found');
    assert.ok(Number.isFinite(Date.parse(incident.timeUtc)));

    const second = await signIn(account.identity);
    assert.equal(second.status, 200);
    assert.equal(second.payload.accepted, true);
    assert.equal(signInEvents.get(second.payload.requestId).reason, 'succeeded');
    assert.notEqual(second.payload.requestId, first.payload.requestId);
    assert.equal(signInEvents.size, 2);
    console.log('LAB-02: HTTP 401 identity_not_found, corrected address HTTP 200');
  } finally {
    const stopped = once(server, 'close');
    server.close();
    server.closeAllConnections();
    await stopped;
  }
});
