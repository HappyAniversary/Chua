import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = resolve(import.meta.dirname, '../..');
const output = await mkdtemp(join(tmpdir(), 'chua-auth-session-'));
const bundle = join(output, 'auth-service.mjs');
const sessionKey = 'chua_active_uid_session';
const activeKey = 'chua_active_uid_local';
const accountsKey = 'chua_accounts_v1';
const previousWindow = globalThis.window;
let moduleVersion = 0;

// Bundle the public production service, replacing only external SDK boundaries.
await build({
  entryPoints: [join(root, 'src/services/authService.ts')],
  outfile: bundle, bundle: true, platform: 'node', format: 'esm', target: 'node20',
  plugins: [{ name: 'auth-sdk-fixtures', setup(builder) {
    builder.onResolve({ filter: /^\.\/firebaseConfig$/ }, () => ({ path: 'config', namespace: 'fixture' }));
    builder.onResolve({ filter: /^firebase\/auth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: {
      config: `const state = globalThis.__authSessionFixture;
        export const firebaseAuth = state.auth;
        export const firestoreDb = {};
        export const isFirebaseConfigured = state.configured;
        export const getBackendMode = () => state.configured ? 'firebase' : 'local';`,
      auth: `const state = globalThis.__authSessionFixture;
        export function onAuthStateChanged(auth, next) { queueMicrotask(() => next(auth.currentUser)); return () => {}; }
        async function authenticate(auth, email, password) {
          state.credentials.push({email, password});
          const user = {uid: state.credentialUid};
          auth.currentUser = {uid: state.authAfterCredential ?? user.uid};
          return {user};
        }
        export const createUserWithEmailAndPassword = authenticate;
        export const signInWithEmailAndPassword = authenticate;
        export async function signOut(auth) { auth.currentUser = null; }`,
      firestore: `const state = globalThis.__authSessionFixture;
        export const doc = (_db, collection, uid) => ({collection, uid});
        export async function getDoc(ref) {
          state.reads.push(ref.uid);
          if (state.switchDuringRead !== undefined) state.auth.currentUser = state.switchDuringRead;
          if (state.readError) throw new Error('permission-denied');
          return {exists: () => state.documents.has(ref.uid), data: () => state.documents.get(ref.uid)};
        }
        export async function setDoc(ref, profile) {
          state.writes.push(ref.uid);
          if (state.switchDuringSet !== undefined) state.auth.currentUser = state.switchDuringSet;
          if (state.setError) throw state.setError;
          state.documents.set(ref.uid, profile);
        }
        export async function updateDoc(ref, updates) {
          state.writes.push(ref.uid);
          if (state.switchDuringUpdate !== undefined) state.auth.currentUser = state.switchDuringUpdate;
          if (state.updateError) throw state.updateError;
          state.documents.set(ref.uid, {...state.documents.get(ref.uid), ...updates});
        }`,
    }[path] }));
  } }],
});

function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}
function profile(uid, username = uid) {
  return { uid, username, monkName: `Monk ${username}`, robeColor: '#d97706', meritPoints: 0, createdAt: 1 };
}
async function scenario({ uid = 'cloud_a', activeUid, cache = [], documents = [], configured = true, ...extra } = {}) {
  const state = {
    configured, auth: {currentUser: uid ? {uid} : null}, reads: [], writes: [], credentials: [],
    documents: new Map(documents.map((p) => [p.uid, p])), credentialUid: 'cloud_login', ...extra,
  };
  globalThis.__authSessionFixture = state;
  globalThis.window = { localStorage: storage(), sessionStorage: storage() };
  window.localStorage.setItem(accountsKey, JSON.stringify(cache.map((p) => ({uid: p.uid, username: p.username, passwordHash: 'firebase_managed', profile: p}))));
  if (activeUid) { window.localStorage.setItem(activeKey, activeUid); window.sessionStorage.setItem(sessionKey, activeUid); }
  const service = await import(`${pathToFileURL(bundle)}?case=${moduleVersion++}`);
  return {state, service};
}
function assertActiveUid(uid) {
  assert.equal(window.sessionStorage.getItem(sessionKey), uid);
  assert.equal(window.localStorage.getItem(activeKey), uid);
}

after(async () => {
  if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
  delete globalThis.__authSessionFixture;
  await rm(output, {recursive: true, force: true});
});

test('cloud restore follows the authenticated UID instead of a previous local account', async () => {
  const {state, service} = await scenario({activeUid: 'monk_local', cache: [profile('monk_local')], documents: [profile('cloud_a')]});
  const restored = await service.getCurrentMonkSession();
  assert.equal(restored?.uid, 'cloud_a');
  assert.deepEqual(state.reads, ['cloud_a']);
  assertActiveUid('cloud_a');
});

test('cloud restore cannot create a session from cached local data without Firebase authentication', async () => {
  const {state, service} = await scenario({uid: null, activeUid: 'monk_local', cache: [profile('monk_local')]});
  assert.equal(await service.getCurrentMonkSession(), null);
  assert.deepEqual(state.reads, []);
  assertActiveUid(null);
});

test('a cloud read failure may use only the matching authenticated profile cache', async () => {
  const {state, service} = await scenario({activeUid: 'cloud_b', readError: true, cache: [profile('cloud_b'), profile('cloud_a')]});
  assert.equal((await service.getCurrentMonkSession())?.uid, 'cloud_a');
  assert.deepEqual(state.reads, ['cloud_a']);
  assertActiveUid('cloud_a');
});

test('missing cloud profile does not revive a stale cached profile after a successful read', async () => {
  const {service} = await scenario({activeUid: 'cloud_a', cache: [profile('cloud_a')]});
  assert.equal(await service.getCurrentMonkSession(), null);
});

test('a cloud document payload cannot override its authenticated document UID', async () => {
  const {state, service} = await scenario({activeUid: 'cloud_a'});
  state.documents.set('cloud_a', profile('cloud_b'));
  assert.equal((await service.getCurrentMonkSession())?.uid, 'cloud_a');
  assertActiveUid('cloud_a');
});

test('auth changes during a profile read cannot restore the previous user', async () => {
  const {service} = await scenario({activeUid: 'cloud_a', documents: [profile('cloud_a')], switchDuringRead: {uid: 'cloud_b'}});
  assert.equal(await service.getCurrentMonkSession(), null);
  assertActiveUid('cloud_b');
});

test('cloud login binds the returned profile to its credential UID and preserves four-character password compatibility', async () => {
  const {state, service} = await scenario({activeUid: 'monk_local', uid: null});
  state.documents.set('cloud_login', profile('other_uid', 'demo'));
  assert.equal((await service.loginWithUsernamePassword({username: 'demo', password: 'four'})).uid, 'cloud_login');
  assert.equal(state.credentials[0].password, 'four#chua3d');
  assertActiveUid('cloud_login');
});

test('cloud login rejects an account switch while the profile request is in flight', async () => {
  const {service} = await scenario({documents: [profile('cloud_login')], switchDuringRead: {uid: 'cloud_b'}});
  await assert.rejects(service.loginWithUsernamePassword({username: 'demo', password: 'secret'}));
  assertActiveUid('cloud_b');
});

test('cloud login cannot create a missing profile after an account switch during its read', async () => {
  const {state, service} = await scenario({switchDuringRead: {uid: 'cloud_b'}});
  await assert.rejects(service.loginWithUsernamePassword({username: 'demo', password: 'secret'}));
  assert.deepEqual(state.writes, []);
  assertActiveUid('cloud_b');
});

test('cloud restore rejects a cache record whose embedded profile UID differs from its account UID', async () => {
  const {service} = await scenario({readError: true});
  window.localStorage.setItem(accountsKey, JSON.stringify([{uid: 'cloud_a', username: 'demo', passwordHash: 'firebase_managed', profile: profile('cloud_b')} ]));
  assert.equal(await service.getCurrentMonkSession(), null);
  assertActiveUid('cloud_a');
});

test('cloud registration never caches or writes a credential for a different current Firebase user', async () => {
  const {state, service} = await scenario({activeUid: 'monk_local', authAfterCredential: 'cloud_b'});
  await assert.rejects(service.registerWithUsernamePassword({username: 'demo', password: 'secret'}));
  assert.deepEqual(state.writes, []);
  assertActiveUid('cloud_b');
});

test('local-only session restoration retains its existing behavior', async () => {
  const {state, service} = await scenario({configured: false, uid: null, activeUid: 'monk_local', cache: [profile('monk_local')]});
  assert.equal((await service.getCurrentMonkSession())?.uid, 'monk_local');
  assert.deepEqual(state.reads, []);
  assertActiveUid('monk_local');
});

test('cloud profile updates reject an unauthenticated or different Firebase UID before requesting data', async () => {
  for (const uid of [null, 'cloud_b']) {
    const {state, service} = await scenario({uid, cache: [profile('cloud_a')]});
    const before = window.localStorage.getItem(accountsKey);
    await assert.rejects(service.updateMonkProfile('cloud_a', {monkName: 'Changed'}));
    assert.deepEqual(state.reads, []);
    assert.deepEqual(state.writes, []);
    assert.equal(window.localStorage.getItem(accountsKey), before);
  }
});

test('a rejected cloud profile update never reports local success or retries a denied write as a create', async () => {
  const denied = Object.assign(new Error('Missing or insufficient permissions'), {code: 'permission-denied'});
  const {state, service} = await scenario({cache: [profile('cloud_a')], updateError: denied, setError: denied});
  const before = window.localStorage.getItem(accountsKey);
  await assert.rejects(service.updateMonkProfile('cloud_a', {monkName: 'Changed'}), /permissions/);
  assert.deepEqual(state.writes, ['cloud_a']);
  assert.equal(window.localStorage.getItem(accountsKey), before);
});

test('cloud profile updates reject account changes during the initial read before writing', async () => {
  const {state, service} = await scenario({documents: [profile('cloud_a')], switchDuringRead: {uid: 'cloud_b'}});
  await assert.rejects(service.updateMonkProfile('cloud_a', {monkName: 'Changed'}));
  assert.deepEqual(state.writes, []);
  assert.equal(JSON.parse(window.localStorage.getItem(accountsKey)).length, 0);
  assertActiveUid('cloud_b');
});

test('a completed cloud profile write cannot cache a previous user after an account switch', async () => {
  const {state, service} = await scenario({cache: [profile('cloud_a')], switchDuringUpdate: {uid: 'cloud_b'}});
  const before = window.localStorage.getItem(accountsKey);
  await assert.rejects(service.updateMonkProfile('cloud_a', {monkName: 'Changed'}));
  assert.deepEqual(state.writes, ['cloud_a']);
  assert.equal(window.localStorage.getItem(accountsKey), before);
  assertActiveUid('cloud_b');
});

test('a missing cloud profile can be created only while the same Firebase user remains active', async () => {
  const missing = Object.assign(new Error('Missing document'), {code: 'not-found'});
  const {state, service} = await scenario({cache: [profile('cloud_a')], updateError: missing});
  const updated = await service.updateMonkProfile('cloud_a', {monkName: 'Updated', robeColor: '#78350f'});
  assert.equal(updated.monkName, 'Updated');
  assert.equal(state.documents.get('cloud_a').robeColor, '#78350f');
  assert.equal(JSON.parse(window.localStorage.getItem(accountsKey))[0].profile.monkName, 'Updated');

  const switched = await scenario({cache: [profile('cloud_a')], updateError: missing, switchDuringUpdate: {uid: 'cloud_b'}});
  await assert.rejects(switched.service.updateMonkProfile('cloud_a', {monkName: 'Changed'}));
  assert.deepEqual(switched.state.writes, ['cloud_a']);
});

test('a failed or superseded cloud profile creation never updates the local cache', async () => {
  const missing = Object.assign(new Error('Missing document'), {code: 'not-found'});
  const denied = Object.assign(new Error('Missing or insufficient permissions'), {code: 'permission-denied'});
  for (const extra of [{setError: denied}, {switchDuringSet: {uid: 'cloud_b'}}]) {
    const {state, service} = await scenario({cache: [profile('cloud_a')], updateError: missing, ...extra});
    const before = window.localStorage.getItem(accountsKey);
    await assert.rejects(service.updateMonkProfile('cloud_a', {monkName: 'Changed'}));
    assert.deepEqual(state.writes, ['cloud_a', 'cloud_a']);
    assert.equal(window.localStorage.getItem(accountsKey), before);
  }
});

test('local-only profile updates remain local without Firebase authentication', async () => {
  const {state, service} = await scenario({configured: false, uid: null, cache: [profile('monk_local')]});
  const updated = await service.updateMonkProfile('monk_local', {monkName: 'Local name', meritPoints: 7});
  assert.equal(updated.monkName, 'Local name');
  assert.equal(updated.meritPoints, 7);
  assert.deepEqual(state.writes, []);
  assert.equal(JSON.parse(window.localStorage.getItem(accountsKey))[0].profile.monkName, 'Local name');
});
