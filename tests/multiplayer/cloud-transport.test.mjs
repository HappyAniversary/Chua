import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = await mkdtemp(join(tmpdir(), 'chua-cloud-tests-'));
const outfile = join(directory, 'multiplayer.mjs');
await build({
  entryPoints: [resolve('src/services/multiplayerService.ts')], outfile,
  bundle: true, platform: 'node', format: 'esm', target: 'node20', logLevel: 'silent',
  plugins: [{ name: 'firebase-double', setup(builder) {
    builder.onResolve({ filter: /firebaseConfig$/ }, () => ({ path: 'config', namespace: 'cloud-double' }));
    builder.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: 'firestore', namespace: 'cloud-double' }));
    builder.onLoad({ filter: /.*/, namespace: 'cloud-double' }, ({ path }) => ({ contents: path === 'config'
      ? `export const isFirebaseConfigured = globalThis.__cloudMock.configured; export const firestoreDb = isFirebaseConfigured ? {} : null;`
      : `const mock=globalThis.__cloudMock;
         export const collection=(_db,path)=>({path});
         export const doc=(_db,path,id)=>({path,id});
         export const orderBy=(...args)=>({orderBy:args});
         export const limit=(count)=>({limit:count});
         export const query=(ref,...constraints)=>({...ref,constraints});
         export const setDoc=(ref,data)=>mock.setDoc(ref,data);
         export const deleteDoc=(ref)=>mock.deleteDoc(ref);
         export const addDoc=(ref,data)=>mock.addDoc(ref,data);
         export const onSnapshot=(ref,...args)=>mock.onSnapshot(ref,...args);`, loader: 'js' }));
  } }],
});
after(async () => { await rm(directory, { recursive: true, force: true }); });

let serial = 0;
const profile = { uid: 'cloud_player_a', username: 'player_a', monkName: 'An Tâm', robeColor: '#d97706', meritPoints: 0, createdAt: 1, updatedAt: 1 };
const position = { x: 0, y: 0, z: 5 };
const denied = () => Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' });
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

async function fixture(t, configured = true, configure) {
  const storage = new Map(), listeners = [], timers = new Map(), events = new Map(), broadcasts = [];
  let timerId = 0;
  const mock = {
    configured, writes: [], adds: [], deletes: [],
    write: () => Promise.resolve(), add: () => Promise.resolve({ id: 'saved' }),
    setDoc(ref, data) { this.writes.push({ ref, data }); return this.write(ref, data); },
    addDoc(ref, data) { this.adds.push({ ref, data }); return this.add(ref, data); },
    deleteDoc(ref) { this.deletes.push(ref); return Promise.resolve(); },
    onSnapshot(ref, ...args) {
      const hasOptions = typeof args[0] === 'object';
      const item = { ref, next: args[hasOptions ? 1 : 0], error: args[hasOptions ? 2 : 1], options: hasOptions ? args[0] : {}, active: true };
      listeners.push(item); return () => { item.active = false; };
    },
  };
  configure?.(mock);
  const oldWindow = globalThis.window, oldBroadcast = globalThis.BroadcastChannel;
  globalThis.__cloudMock = mock;
  globalThis.window = {
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    setInterval: () => ++timerId, clearInterval: () => {},
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (event, handler) => { const set = events.get(event) ?? new Set(); set.add(handler); events.set(event, set); },
    removeEventListener: (event, handler) => events.get(event)?.delete(handler),
  };
  globalThis.BroadcastChannel = class { postMessage(value) { broadcasts.push(value); } addEventListener() {} removeEventListener() {} };
  const service = await import(`${pathToFileURL(outfile)}?fixture=${++serial}`);
  const statuses = [], monks = [], messages = [], wishes = [];
  const stop = service.startMultiplayerSession(profile, position, {
    onMonksUpdate: (value) => monks.push(value), onMessagesUpdate: (value) => messages.push(value),
    onWishesUpdate: (value) => wishes.push(value), onConnectionUpdate: (value) => statuses.push(value),
  });
  let stopped = false;
  t.after(() => { if (!stopped) stop(); globalThis.window = oldWindow; globalThis.BroadcastChannel = oldBroadcast; delete globalThis.__cloudMock; });
  return {
    service, mock, statuses, monks, messages, wishes, broadcasts, storage, listeners, timers,
    status: () => statuses.at(-1),
    stop: () => { if (!stopped) { stop(); stopped = true; } },
    emit(channel, metadata = { fromCache: false, hasPendingWrites: false }, documents = []) {
      for (const item of [...listeners]) if (item.active && item.ref.path === channel) {
        item.next({ metadata, docChanges: () => [], forEach: (visit) => documents.forEach((record) => visit({ id: record.id, data: () => record.data, metadata: record.metadata ?? { hasPendingWrites: false } })) });
      }
    },
    fail(channel, error = denied()) { for (const item of [...listeners]) if (item.active && item.ref.path === channel) item.error(error); },
    server() { for (const channel of ['presence', 'messages', 'wishes']) this.emit(channel); },
    async runTimers() { const current = [...timers.entries()]; for (const [id, item] of current) { timers.delete(id); item.fn(); } await flush(); },
  };
}

test('cloud readiness requires an acknowledged presence write and all server listeners', async (t) => {
  const pending = deferred();
  const f = await fixture(t, true, (mock) => { mock.write = () => pending.promise; });
  await flush();
  assert.equal(f.status()?.state, 'connecting');
  f.emit('presence'); f.emit('messages');
  assert.equal(f.status()?.state, 'connecting');
  f.emit('wishes');
  assert.equal(f.status()?.state, 'connecting', 'listeners alone do not prove a successful presence write');
  pending.resolve(); await flush();
  assert.equal(f.status()?.state, 'connected');
  assert.ok(f.listeners.every((item) => item.options.includeMetadataChanges), 'offline/cache transitions must be observed');
});

test('cached or pending snapshots never prove a live multiplayer connection', async (t) => {
  const f = await fixture(t);
  await flush();
  for (const channel of ['presence', 'messages', 'wishes']) f.emit(channel, { fromCache: true, hasPendingWrites: false });
  assert.equal(f.status()?.state, 'connecting');
  for (const channel of ['presence', 'messages', 'wishes']) f.emit(channel, { fromCache: false, hasPendingWrites: true });
  assert.equal(f.status()?.state, 'connecting', 'initial pending snapshots must not count as server acknowledgements');
  f.server();
  assert.equal(f.status()?.state, 'connected');
  f.emit('presence', { fromCache: true, hasPendingWrites: false });
  assert.notEqual(f.status()?.state, 'connected');
});

test('listener errors survive unrelated successes and recover only after that channel acknowledges server data', async (t) => {
  const f = await fixture(t);
  await flush(); f.server();
  f.fail('messages');
  assert.equal(f.status()?.state, 'error');
  assert.equal(f.status()?.code, 'permission-denied');
  f.emit('presence'); f.emit('wishes');
  assert.equal(f.status()?.state, 'error');
  await f.runTimers();
  f.emit('messages', { fromCache: true, hasPendingWrites: false });
  assert.equal(f.status()?.state, 'error');
  f.emit('messages');
  assert.equal(f.status()?.state, 'connected');
});

test('a rejected presence write remains visible and retries without consuming the successful publish throttle', async (t) => {
  const f = await fixture(t);
  await flush(); f.server();
  const attempts = f.mock.writes.length;
  f.mock.write = () => Promise.reject(denied());
  f.service.publishLocalMonkState(profile, { x: 2, y: 0, z: 7 }, 1, 'walking');
  await flush();
  assert.equal(f.status()?.state, 'error');
  assert.equal(f.status()?.code, 'permission-denied');
  f.mock.write = () => Promise.resolve();
  await f.runTimers();
  assert.ok(f.mock.writes.length > attempts + 1, 'failed sample must be retried');
  assert.equal(f.status()?.state, 'connected');
  assert.equal(f.mock.writes.at(-1).data.position.x, 2);
});

test('chat and wishes reject cloud failures without broadcasting or claiming local delivery', async (t) => {
  const f = await fixture(t);
  await flush(); f.server();
  const beforeStorage = JSON.stringify([...f.storage]), beforeBroadcasts = f.broadcasts.length;
  const beforeMessages = f.messages.length, beforeWishes = f.wishes.length;
  f.mock.add = () => Promise.reject(denied());
  await assert.rejects(f.service.sendTempleChatMessage(profile, 'Không được gửi'), /quyền|đồng bộ|gửi/i);
  await assert.rejects(f.service.submitTempleIncenseWish(profile, 'Không được lưu'), /quyền|đồng bộ|gửi/i);
  assert.equal(JSON.stringify([...f.storage]), beforeStorage);
  assert.equal(f.broadcasts.length, beforeBroadcasts);
  assert.equal(f.messages.length, beforeMessages);
  assert.equal(f.wishes.length, beforeWishes);
  assert.equal(f.status()?.state, 'error');
});

test('successful chat delivery waits for the backend and one success cannot erase another operation failure', async (t) => {
  const f = await fixture(t);
  await flush(); f.server();
  f.mock.add = () => Promise.reject(denied());
  await assert.rejects(f.service.submitTempleIncenseWish(profile, 'Denied wish'));
  const pending = deferred(); f.mock.add = () => pending.promise;
  const before = f.messages.length;
  const sending = f.service.sendTempleChatMessage(profile, 'Cloud acknowledged');
  await flush();
  assert.equal(f.messages.length, before);
  pending.resolve({ id: 'cloud-message' }); await sending;
  assert.equal(f.messages.at(-1).at(-1).text, 'Cloud acknowledged');
  assert.equal(f.status()?.state, 'error', 'failed wish must remain visible after a chat success');
  f.mock.add = () => Promise.resolve({ id: 'saved-wish' });
  await f.service.submitTempleIncenseWish(profile, 'Recovered wish');
  assert.equal(f.status()?.state, 'connected');
});

test('stopping a failed session cancels listener/presence retries and late callbacks', async (t) => {
  const f = await fixture(t);
  await flush(); f.server(); f.fail('presence');
  assert.ok(f.timers.size > 0);
  const late = f.listeners.find((item) => item.ref.path === 'presence');
  f.stop();
  const before = f.listeners.length, statuses = f.statuses.length, writes = f.mock.writes.length;
  await f.runTimers(); f.emit('presence');
  late.next({ metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [], forEach: () => {} });
  assert.equal(f.listeners.length, before);
  assert.equal(f.statuses.length, statuses);
  assert.equal(f.mock.writes.length, writes);
  assert.ok(f.listeners.every((item) => !item.active));
});

test('local mode reports its actual scope, keeps local sends and marks NPCs explicitly', async (t) => {
  const f = await fixture(t, false);
  assert.deepEqual(f.status(), { mode: 'local', state: 'local' });
  await f.service.sendTempleChatMessage(profile, 'Local message');
  assert.equal(f.mock.adds.length, 0);
  assert.equal(f.messages.at(-1).at(-1).text, 'Local message');
  const npcs = f.monks.at(-1).filter((monk) => monk.uid.startsWith('npc_'));
  assert.equal(npcs.length, 3);
  assert.ok(npcs.every((monk) => monk.isNpc === true));
});


test('optimistic SDK snapshots cannot deliver chat or wishes that the server rejects', async (t) => {
  const f = await fixture(t);
  await flush(); f.server();
  const beforeMessages = f.messages.length, beforeWishes = f.wishes.length;
  const beforeStorage = JSON.stringify([...f.storage]);
  f.mock.add = (ref, data) => {
    f.emit(ref.path, { fromCache: false, hasPendingWrites: true }, [{ id: 'pending-write', data, metadata: { hasPendingWrites: true } }]);
    return Promise.reject(denied());
  };
  await assert.rejects(f.service.sendTempleChatMessage(profile, 'Pending denied chat'));
  await assert.rejects(f.service.submitTempleIncenseWish(profile, 'Pending denied wish'));
  assert.equal(f.messages.length, beforeMessages);
  assert.equal(f.wishes.length, beforeWishes);
  assert.equal(JSON.stringify([...f.storage]), beforeStorage);
});

test('a late presence completion cannot replace the position of a restarted session', async (t) => {
  const oldWrite = deferred(), newWrite = deferred();
  let calls = 0;
  const f = await fixture(t, true, (mock) => {
    mock.write = () => ++calls === 1 ? oldWrite.promise : calls === 2 ? newWrite.promise : Promise.resolve();
  });
  await flush();
  f.service.publishLocalMonkState(profile, { x: 1, y: 0, z: 5 }, 0, 'walking');
  f.stop();
  const stopNew = f.service.startMultiplayerSession(profile, { x: 9, y: 0, z: 5 }, {
    onMonksUpdate() {}, onMessagesUpdate() {}, onWishesUpdate() {},
  });
  try {
    await flush();
    oldWrite.resolve(); await flush();
    newWrite.resolve(); await flush();
    assert.equal(f.mock.writes.at(-1).data.position.x, 9, 'old queued position replaced the new session');
    assert.equal(f.mock.writes.length, 2, 'stale completion submitted an extra old presence');
  } finally { stopNew(); }
});
