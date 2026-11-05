import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const result = await build({ entryPoints: [resolve(root, 'src/utils/multiplayerPresentation.ts')], bundle: true, write: false, platform: 'node', format: 'esm', target: 'node20' });
const { countHumanPlayers, connectionPresentation, sendFailureMessage } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('human presence count excludes simulated companions, duplicate UIDs and duplicate self', () => {
  assert.equal(countHumanPlayers([
    { uid: 'npc_1', isNpc: true }, { uid: 'npc_2', isNpc: true }, { uid: 'npc_3', isNpc: true },
    { uid: 'human_a' }, { uid: 'human_a' }, { uid: 'self' }, { uid: 'human_b', isNpc: false },
  ], 'self'), 3);
  assert.equal(countHumanPlayers([{ uid: 'npc_1', isNpc: true }], 'self'), 1);
});

test('local and connecting states never advertise cross-device connectivity', () => {
  const local = connectionPresentation({ mode: 'local', state: 'local' });
  assert.equal(local.isOnline, false);
  assert.equal(local.canRetry, false);
  assert.match(local.detail, /thiết bị hoặc trình duyệt khác/);
  const connecting = connectionPresentation({ mode: 'firebase', state: 'connecting' });
  assert.equal(connecting.isOnline, false);
  assert.match(connecting.label, /Đang kết nối/);
  assert.equal(connectionPresentation({ mode: 'local', state: 'connected' }).isOnline, false);
});

test('a confirmed shared-room connection is distinct from retryable errors', () => {
  assert.equal(connectionPresentation({ mode: 'firebase', state: 'connected' }).isOnline, true);
  const error = connectionPresentation({ mode: 'firebase', state: 'error', code: 'firestore/permission-denied', message: 'INTERNAL_STACK_NOT_FOR_PRODUCT_UI' });
  assert.equal(error.isOnline, false);
  assert.equal(error.canRetry, true);
  assert.match(error.detail, /chưa cho phép truy cập/);
  assert.doesNotMatch(error.detail, /INTERNAL_STACK/);
  const offline = connectionPresentation({ mode: 'firebase', state: 'error', code: 'unavailable' });
  assert.match(offline.detail, /Kiểm tra mạng/);
});

test('send rejection has a user-visible message rather than a success acknowledgement', () => {
  assert.equal(sendFailureMessage(new Error('Không gửi được tin nhắn lên phòng chung.')), 'Không gửi được tin nhắn lên phòng chung.');
  assert.match(sendFailureMessage(null), /Nội dung được giữ lại/);
});
