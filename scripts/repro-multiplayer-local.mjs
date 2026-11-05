import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Exercise the real service with independent browser globals, without creating
// accounts or contacting Firebase. Browser-local transport is intentionally
// scoped to one storage/BroadcastChannel partition, as on separate devices.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const bundled = await build({
  absWorkingDir: root,
  entryPoints: ['src/services/multiplayerService.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'TempleMultiplayer',
  platform: 'browser',
  target: 'es2022',
  plugins: [{
    name: 'offline-reproduction-only',
    setup(builder) {
      builder.onResolve({ filter: /(?:^firebase\/firestore$|\/firebaseConfig$)/ }, ({ path }) => ({ path, namespace: 'offline-repro' }));
      builder.onLoad({ filter: /.*/, namespace: 'offline-repro' }, ({ path }) => ({
        contents: path === 'firebase/firestore'
          ? 'const unexpected=()=>{throw new Error("Unexpected cloud access in local-mode reproduction")}; export {unexpected as addDoc,unexpected as collection,unexpected as deleteDoc,unexpected as doc,unexpected as limit,unexpected as onSnapshot,unexpected as orderBy,unexpected as query,unexpected as setDoc};'
          : 'export const isFirebaseConfigured=false; export const firestoreDb=null; export const firebaseAuth=null; export const realtimeDb=null; export function getBackendMode(){return "local"}',
        loader: 'js',
      }));
    },
  }],
});
const serviceCode = bundled.outputFiles[0].text;

function browserPartition() {
  const storage = new Map();
  const tabs = new Set();
  const channels = new Set();
  const events = [];
  const flush = () => {
    for (let count = 0; events.length; count++) {
      assert.ok(count < 1000, 'Browser event queue did not settle');
      events.shift()();
    }
  };
  const createClient = (uid) => {
    const listeners = new Map();
    const intervals = new Map();
    let intervalId = 0;
    const window = {
      addEventListener(type, listener) {
        const set = listeners.get(type) ?? new Set();
        set.add(listener); listeners.set(type, set);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      setInterval(callback) { intervals.set(++intervalId, callback); return intervalId; },
      clearInterval(id) { intervals.delete(id); },
      localStorage: {
        getItem(key) { return storage.get(key) ?? null; },
        setItem(key, value) {
          value = String(value);
          const oldValue = storage.get(key) ?? null;
          if (oldValue === value) return;
          storage.set(key, value);
          for (const other of tabs) if (other !== window) {
            events.push(() => other.dispatch('storage', { key, oldValue, newValue: value }));
          }
        },
      },
      dispatch(type, event) { for (const callback of listeners.get(type) ?? []) callback(event); },
    };
    tabs.add(window);
    class BroadcastChannel {
      constructor(name) { this.name = name; this.listeners = new Set(); channels.add(this); }
      addEventListener(type, callback) { if (type === 'message') this.listeners.add(callback); }
      removeEventListener(type, callback) { if (type === 'message') this.listeners.delete(callback); }
      postMessage(data) {
        for (const other of channels) if (other !== this && other.name === this.name) {
          const copy = structuredClone(data);
          events.push(() => { for (const callback of other.listeners) callback({ data: copy }); });
        }
      }
      close() { channels.delete(this); }
    }
    const context = vm.createContext({ window, BroadcastChannel, console });
    vm.runInContext(serviceCode, context, { timeout: 5000 });
    const api = context.TempleMultiplayer;
    api.setAiFellowMonksEnabled(false);
    const snapshot = { monks: [], messages: [], wishes: [] };
    const copy = (value) => JSON.parse(JSON.stringify(value));
    const profile = { uid, username: uid, monkName: uid, robeColor: '#d97706', meritPoints: 0, createdAt: Date.now() };
    let stop;
    return {
      api, profile, snapshot,
      start() {
        stop = api.startMultiplayerSession(profile, { x: 0, y: 0, z: 0 }, {
          onMonksUpdate(value) { snapshot.monks = copy(value); },
          onMessagesUpdate(value) { snapshot.messages = copy(value); },
          onWishesUpdate(value) { snapshot.wishes = copy(value); },
        });
      },
      tick() { for (const callback of intervals.values()) callback(); },
      stop() { stop?.(); tabs.delete(window); },
    };
  };
  return { createClient, flush };
}

async function exercise(sharedBrowser) {
  const firstBrowser = browserPartition();
  const secondBrowser = sharedBrowser ? firstBrowser : browserPartition();
  const first = firstBrowser.createClient('repro_client_a');
  const second = secondBrowser.createClient('repro_client_b');
  const flush = () => { firstBrowser.flush(); secondBrowser.flush(); };
  first.start(); second.start(); flush(); first.tick(); second.tick(); flush();
  await first.api.sendTempleChatMessage(first.profile, 'repro-only-chat-marker');
  await first.api.submitTempleIncenseWish(first.profile, 'repro-only-wish-marker');
  first.api.publishLocalMonkState(first.profile, { x: 3, y: 0, z: 7 }, 0.6, 'walking', null);
  flush(); second.tick(); flush();
  const remote = second.snapshot.monks.find(({ uid }) => uid === first.profile.uid);
  const result = {
    presence: Boolean(remote),
    movement: remote?.position.x === 3 && remote?.position.z === 7,
    chat: second.snapshot.messages.some(({ text }) => text === 'repro-only-chat-marker'),
    wish: second.snapshot.wishes.some(({ wishText }) => wishText === 'repro-only-wish-marker'),
  };
  first.stop(); second.stop(); flush();
  return result;
}

const shared = await exercise(true);
assert.ok(Object.values(shared).every(Boolean), `Control failed: same-browser clients did not synchronize: ${JSON.stringify(shared)}`);
console.log(`PASS same-browser local transport: ${JSON.stringify(shared)}`);
const isolated = await exercise(false);
assert.ok(Object.values(isolated).every((value) => !value), `Unexpected external transport in local mode: ${JSON.stringify(isolated)}`);
console.log(`CONFIRMED isolated-browser local mode: ${JSON.stringify(isolated)}`);
if (process.argv.includes('--require-cross-device')) {
  if (!Object.values(isolated).every(Boolean)) {
    console.error('FAIL cross-device expectation: independent browsers cannot exchange presence, movement, chat or wishes while Firebase is unconfigured.');
    process.exitCode = 1;
  }
}
