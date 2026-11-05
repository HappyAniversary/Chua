import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const result = await build({
  entryPoints: [fileURLToPath(new URL('../../src/utils/sessionOperation.ts', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20',
});
const { completeSessionOperation } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function pending() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('an acknowledged chat cannot become the replacement account bubble', async () => {
  let current = {uid: 'player_a'};
  const acknowledgement = pending(), bubbles = [];
  const sending = completeSessionOperation('player_a', () => current?.uid, () => acknowledgement.promise, (text) => bubbles.push({uid: current.uid, text}));
  current = {uid: 'player_b'};
  acknowledgement.resolve('Message written by player A');
  assert.equal(await sending, false);
  assert.deepEqual(bubbles, []);
});

test('an old merit response cannot replace a newly signed-in profile or publish its presence', async () => {
  let current = {uid: 'player_a', meritPoints: 1};
  const response = pending(), presence = [];
  const earning = completeSessionOperation(current.uid, () => current?.uid, () => response.promise, (profile) => {current = profile; presence.push(profile);});
  current = {uid: 'player_b', meritPoints: 50};
  response.resolve({uid: 'player_a', meritPoints: 11});
  assert.equal(await earning, false);
  assert.deepEqual(current, {uid: 'player_b', meritPoints: 50});
  assert.deepEqual(presence, []);
});

test('logging out before an acknowledgement prevents completion effects', async () => {
  let currentUid = 'player_a';
  const acknowledgement = pending(), applied = [];
  const operation = completeSessionOperation(currentUid, () => currentUid, () => acknowledgement.promise, (value) => applied.push(value));
  currentUid = null;
  acknowledgement.resolve('shared fortune');
  assert.equal(await operation, false);
  assert.deepEqual(applied, []);
});

test('a profile update for the same UID does not discard a valid acknowledgement', async () => {
  let current = {uid: 'player_a', monkName: 'Before'};
  const acknowledgement = pending(), applied = [];
  const operation = completeSessionOperation(current.uid, () => current?.uid, () => acknowledgement.promise, (value) => applied.push(value));
  current = {uid: 'player_a', monkName: 'After'};
  acknowledgement.resolve('delivered');
  assert.equal(await operation, true);
  assert.deepEqual(applied, ['delivered']);
});

test('a rejected cloud request remains rejected and applies no success effects', async () => {
  const applied = [];
  await assert.rejects(completeSessionOperation('player_a', () => 'player_a', () => Promise.reject(new Error('permission denied')), (value) => applied.push(value)), /permission denied/);
  assert.deepEqual(applied, []);
});
