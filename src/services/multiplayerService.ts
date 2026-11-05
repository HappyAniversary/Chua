import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { firestoreDb, isFirebaseConfigured } from './firebaseConfig';
import type {
  ChatBubbleState,
  ChatMessage,
  IncenseWish,
  MonkActionState,
  MonkPresence,
  MonkProfile,
  Vector3Tuple,
} from '../types/game';

export interface MultiplayerConnectionStatus {
  mode: 'firebase' | 'local';
  state: 'local' | 'connecting' | 'connected' | 'error';
  message?: string;
  code?: string;
}

export interface MultiplayerCallbacks {
  onConnectionUpdate?: (status: MultiplayerConnectionStatus) => void;
  onMonksUpdate: (remoteMonks: MonkPresence[]) => void;
  onMessagesUpdate: (messages: ChatMessage[]) => void;
  onWishesUpdate: (wishes: IncenseWish[]) => void;
}

const BROADCAST_CHANNEL_NAME = 'chua_multiplayer_channel_v1';
const STORAGE_PRESENCE_KEY = 'chua_presence_map_v1';
const STORAGE_MESSAGES_KEY = 'chua_messages_v1';
const STORAGE_WISHES_KEY = 'chua_wishes_v1';

const STALE_MONK_TIMEOUT_MS = 18_000;
const HEARTBEAT_INTERVAL_MS = 250;
const FIRESTORE_PRESENCE_THROTTLE_MS = 850;
const MAX_STORED_MESSAGES = 60;
const MAX_STORED_WISHES = 60;

type BroadcastPayload =
  | { type: 'presence_update'; monk: MonkPresence }
  | { type: 'presence_remove'; uid: string }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'incense_wish'; wish: IncenseWish };

type CloudChannel = 'presence' | 'messages' | 'wishes';
interface CloudFailure { code: string; message: string }
interface CloudConnection {
  acknowledgedWrite: boolean;
  ready: Set<CloudChannel>;
  failures: Map<string, CloudFailure>;
  disposed: boolean;
  lastStatus?: string;
}
interface PresencePublishState {
  latest: MonkPresence;
  inFlight: boolean;
  lastSuccessfulAt: number;
  action: MonkActionState | null;
  bubbleText: string | null;
  timer?: number;
  failures: number;
}

interface ActiveSession {
  id: string;
  uid: string;
  callbacks: MultiplayerCallbacks;
  cloud?: CloudConnection;
}

let aiFellowMonksEnabled = true;
const activeSessions = new Map<string, ActiveSession>();
const firestorePresenceMap = new Map<string, MonkPresence>();
let sharedBroadcastChannel: BroadcastChannel | null = null;
const presencePublishes = new Map<string, PresencePublishState>();
let lastKnownLocalPresence: MonkPresence | null = null;


function connectionFailure(error: unknown, message: string): CloudFailure {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'unknown';
  if (code.includes('permission-denied')) return { code, message: 'Chưa có quyền đồng bộ trực tuyến. Vui lòng kiểm tra cấu hình kết nối.' };
  if (code.includes('unauthenticated')) return { code, message: 'Phiên đăng nhập trực tuyến đã hết hạn. Vui lòng đăng nhập lại.' };
  if (code.includes('unavailable') || code.includes('offline')) return { code, message: 'Mất kết nối trực tuyến. Đang chờ kết nối lại.' };
  return { code, message };
}

function notifyConnection(session: ActiveSession): void {
  const cloud = session.cloud;
  if (!cloud) { session.callbacks.onConnectionUpdate?.({ mode: 'local', state: 'local' }); return; }
  if (cloud.disposed) return;
  const error = cloud.failures.values().next().value as CloudFailure | undefined;
  const status: MultiplayerConnectionStatus = error
    ? { mode: 'firebase', state: 'error', ...error }
    : cloud.acknowledgedWrite && cloud.ready.size === 3
      ? { mode: 'firebase', state: 'connected' }
      : { mode: 'firebase', state: 'connecting' };
  const signature = JSON.stringify(status);
  if (signature !== cloud.lastStatus) {
    cloud.lastStatus = signature;
    session.callbacks.onConnectionUpdate?.(status);
  }
}

function updateCloudForUid(uid: string, mutate: (cloud: CloudConnection) => void): void {
  for (const session of activeSessions.values()) if (session.uid === uid && session.cloud && !session.cloud.disposed) {
    mutate(session.cloud); notifyConnection(session);
  }
}

function reportCloudFailure(uid: string, scope: string, error: unknown, message: string): void {
  updateCloudForUid(uid, (cloud) => { cloud.failures.set(scope, connectionFailure(error, message)); });
}

function retryDelay(attempt: number): number { return Math.min(30_000, 1_000 * 2 ** Math.min(attempt, 5)); }

function hasActiveUid(uid: string): boolean {
  return [...activeSessions.values()].some((session) => session.uid === uid);
}

function getSharedBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch {
      sharedBroadcastChannel = null;
    }
  }
  return sharedBroadcastChannel;
}

function postBroadcast(payload: BroadcastPayload): void {
  const channel = getSharedBroadcastChannel();
  if (!channel) return;
  try {
    channel.postMessage(payload);
  } catch {
    // Ignore broadcast channel errors on closed tabs
  }
}

function createUniqueId(prefix: string): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function readLocalPresenceMap(): Record<string, MonkPresence> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PRESENCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, MonkPresence>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeLocalPresenceMap(map: Record<string, MonkPresence>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PRESENCE_KEY, JSON.stringify(map));
  } catch {
    // Ignore localStorage quota errors
  }
}

function pruneAndSaveLocalPresence(
  mutator?: (map: Record<string, MonkPresence>) => void
): Record<string, MonkPresence> {
  const now = Date.now();
  const map = readLocalPresenceMap();

  if (mutator) {
    mutator(map);
  }

  for (const [uid, monk] of Object.entries(map)) {
    if (!monk || typeof monk.lastUpdated !== 'number' || now - monk.lastUpdated > STALE_MONK_TIMEOUT_MS) {
      delete map[uid];
    }
  }

  writeLocalPresenceMap(map);
  return map;
}

function createInitialMessagesSeed(): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: 'seed_msg_system_welcome',
      uid: 'system_temple',
      monkName: 'Ban Quản Tự',
      robeColor: '#d97706',
      text: 'Chào mừng quý đạo hữu thập phương về chiêm bái. Chúc quý vị thân tâm thường an lạc! 🙏',
      createdAt: now - 360_000,
      type: 'system',
    },
    {
      id: 'seed_msg_minh_tam',
      uid: 'npc_thich_minh_tam',
      monkName: 'Thích Minh Tâm',
      robeColor: '#d97706',
      text: 'Nam Mô A Di Đà Phật 🙏 Sớm mai gió mát trăng thanh, bước chân kinh hành thấy lòng nhẹ nhõm.',
      createdAt: now - 240_000,
      type: 'chat',
    },
    {
      id: 'seed_msg_hue_dang',
      uid: 'npc_dao_huu_hue_dang',
      monkName: 'Đạo Hữu Huệ Đăng',
      robeColor: '#991b1b',
      text: 'Cầu chúc bách gia trăm họ bốn mùa bình an, gia đạo sum vầy hạnh phúc 🌸',
      createdAt: now - 140_000,
      type: 'wish',
    },
    {
      id: 'seed_msg_an_nhien',
      uid: 'npc_tieu_su_an_nhien',
      monkName: 'Tiểu Sư An Nhiên',
      robeColor: '#78350f',
      text: 'Cốc... Cốc... Tâm an vạn sự an, mỗi nhịp mõ là một niệm lành gửi vào hư không.',
      createdAt: now - 60_000,
      type: 'chat',
    },
  ];
}

function createInitialWishesSeed(): IncenseWish[] {
  const now = Date.now();
  return [
    {
      id: 'seed_wish_hue_dang',
      uid: 'npc_dao_huu_hue_dang',
      monkName: 'Đạo Hữu Huệ Đăng',
      robeColor: '#991b1b',
      wishText: 'Nguyện cầu cha mẹ hai bên luôn mạnh khỏe, sống lâu trăm tuổi, gia đình hòa thuận êm ấm.',
      createdAt: now - 320_000,
    },
    {
      id: 'seed_wish_minh_tam',
      uid: 'npc_thich_minh_tam',
      monkName: 'Thích Minh Tâm',
      robeColor: '#d97706',
      wishText: 'Nguyện cho mưa thuận gió hòa, quốc thái dân an, muôn loài chúng sinh đều được an vui.',
      createdAt: now - 220_000,
    },
    {
      id: 'seed_wish_an_nhien',
      uid: 'npc_tieu_su_an_nhien',
      monkName: 'Tiểu Sư An Nhiên',
      robeColor: '#78350f',
      wishText: 'Cầu mong trí tuệ sáng suốt, việc học hành và công việc hanh thông, giữ trọn tấm lòng thiện lương.',
      createdAt: now - 120_000,
    },
    {
      id: 'seed_wish_tinh_lien',
      uid: 'seed_phat_tu_tinh_lien',
      monkName: 'Tịnh Liên',
      robeColor: '#1e3a8a',
      wishText: 'Dâng nén tâm hương cầu bình an qua mọi thử thách, tâm sáng như hoa sen nở giữa hồ.',
      createdAt: now - 45_000,
    },
  ];
}

function readStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return createInitialMessagesSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_MESSAGES_KEY);
    if (!raw) {
      const seeded = createInitialMessagesSeed();
      window.localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = createInitialMessagesSeed();
      window.localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed
      .filter((m) => m && typeof m.id === 'string' && typeof m.text === 'string')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return createInitialMessagesSeed();
  }
}

function writeStoredMessages(messages: ChatMessage[]): ChatMessage[] {
  const dedupedMap = new Map<string, ChatMessage>();
  for (const msg of messages) {
    if (msg && msg.id) {
      dedupedMap.set(msg.id, msg);
    }
  }
  const sorted = Array.from(dedupedMap.values())
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_STORED_MESSAGES);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage errors
    }
  }
  return sorted;
}

function readStoredWishes(): IncenseWish[] {
  if (typeof window === 'undefined') return createInitialWishesSeed();
  try {
    const raw = window.localStorage.getItem(STORAGE_WISHES_KEY);
    if (!raw) {
      const seeded = createInitialWishesSeed();
      window.localStorage.setItem(STORAGE_WISHES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw) as IncenseWish[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = createInitialWishesSeed();
      window.localStorage.setItem(STORAGE_WISHES_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return parsed
      .filter((w) => w && typeof w.id === 'string' && typeof w.wishText === 'string')
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_STORED_WISHES);
  } catch {
    return createInitialWishesSeed();
  }
}

function writeStoredWishes(wishes: IncenseWish[]): IncenseWish[] {
  const dedupedMap = new Map<string, IncenseWish>();
  for (const wish of wishes) {
    if (wish && wish.id) {
      dedupedMap.set(wish.id, wish);
    }
  }
  const sorted = Array.from(dedupedMap.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_STORED_WISHES);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_WISHES_KEY, JSON.stringify(sorted));
    } catch {
      // Ignore storage errors
    }
  }
  return sorted;
}

interface PatrolStep {
  from: Vector3Tuple;
  to: Vector3Tuple;
  durationSec: number;
  actionState: MonkActionState;
  fixedRotationY?: number;
}

function evaluatePatrolPath(
  steps: PatrolStep[],
  timeSec: number
): { position: Vector3Tuple; rotationY: number; actionState: MonkActionState } {
  const totalDuration = steps.reduce((acc, s) => acc + s.durationSec, 0);
  let cycleTime = ((timeSec % totalDuration) + totalDuration) % totalDuration;

  for (const step of steps) {
    if (cycleTime <= step.durationSec) {
      const progress = step.durationSec > 0 ? cycleTime / step.durationSec : 1;
      const x = step.from.x + (step.to.x - step.from.x) * progress;
      const y = step.from.y + (step.to.y - step.from.y) * progress;
      const z = step.from.z + (step.to.z - step.from.z) * progress;

      const dx = step.to.x - step.from.x;
      const dz = step.to.z - step.from.z;
      const rotationY =
        step.fixedRotationY !== undefined
          ? step.fixedRotationY
          : Math.hypot(dx, dz) > 0.001
            ? Math.atan2(dx, dz)
            : 0;

      return {
        position: { x, y, z },
        rotationY,
        actionState: step.actionState,
      };
    }
    cycleTime -= step.durationSec;
  }

  const last = steps[steps.length - 1];
  return {
    position: { ...last.to },
    rotationY: last.fixedRotationY ?? 0,
    actionState: last.actionState,
  };
}

const MINH_TAM_PATROL: PatrolStep[] = [
  // Đi kinh hành chậm rãi quanh Cội Bồ Đề (0, 0, 9) và sân chùa
  {
    from: { x: -3.6, y: 0, z: 6.2 },
    to: { x: -3.6, y: 0, z: 12.2 },
    durationSec: 5.5,
    actionState: 'walking',
  },
  {
    from: { x: -3.6, y: 0, z: 12.2 },
    to: { x: 0, y: 0, z: 13.4 },
    durationSec: 3.6,
    actionState: 'walking',
  },
  // Dừng lại trước Cội Bồ Đề hướng về cây & Chánh Điện chắp tay niệm Phật
  {
    from: { x: 0, y: 0, z: 13.4 },
    to: { x: 0, y: 0, z: 13.4 },
    durationSec: 4.2,
    actionState: 'praying',
    fixedRotationY: Math.PI,
  },
  {
    from: { x: 0, y: 0, z: 13.4 },
    to: { x: 3.6, y: 0, z: 12.2 },
    durationSec: 3.6,
    actionState: 'walking',
  },
  {
    from: { x: 3.6, y: 0, z: 12.2 },
    to: { x: 3.6, y: 0, z: 6.2 },
    durationSec: 5.5,
    actionState: 'walking',
  },
  {
    from: { x: 3.6, y: 0, z: 6.2 },
    to: { x: 0, y: 0, z: 5.2 },
    durationSec: 3.5,
    actionState: 'walking',
  },
  // Dừng lại giữa sân chùa hướng về Chánh Điện
  {
    from: { x: 0, y: 0, z: 5.2 },
    to: { x: 0, y: 0, z: 5.2 },
    durationSec: 3.5,
    actionState: 'idle',
    fixedRotationY: Math.PI,
  },
  {
    from: { x: 0, y: 0, z: 5.2 },
    to: { x: -3.6, y: 0, z: 6.2 },
    durationSec: 3.5,
    actionState: 'walking',
  },
];

const HUE_DANG_PATROL: PatrolStep[] = [
  // Đứng lễ Phật trước Lư Hương Chánh Điện
  {
    from: { x: 1.35, y: 0, z: -2.1 },
    to: { x: 1.35, y: 0, z: -2.1 },
    durationSec: 5.0,
    actionState: 'praying',
    fixedRotationY: Math.PI,
  },
  // Đi từ Chánh Điện sang Gác Chuông Đại Hồng Chung
  {
    from: { x: 1.35, y: 0, z: -2.1 },
    to: { x: 4.8, y: 0, z: 3.8 },
    durationSec: 6.2,
    actionState: 'walking',
  },
  // Thỉnh chuông và chắp tay tại Gác Chuông (7, 0, 4)
  {
    from: { x: 4.8, y: 0, z: 3.8 },
    to: { x: 4.8, y: 0, z: 3.8 },
    durationSec: 4.5,
    actionState: 'bell',
    fixedRotationY: Math.PI / 2,
  },
  // Đi từ Gác Chuông về lại Chánh Điện
  {
    from: { x: 4.8, y: 0, z: 3.8 },
    to: { x: 1.35, y: 0, z: -2.1 },
    durationSec: 6.2,
    actionState: 'walking',
  },
];

function computePeriodicBubble(
  now: number,
  periodMs: number,
  offsetMs: number,
  visibleDurationMs: number,
  text: string
): ChatBubbleState | null {
  const cyclePos = (now + offsetMs) % periodMs;
  if (cyclePos <= visibleDurationMs) {
    const cycleStart = now - cyclePos;
    return {
      text,
      expiresAt: cycleStart + visibleDurationMs,
    };
  }
  return null;
}

function buildAiFellowMonks(now: number): MonkPresence[] {
  if (!aiFellowMonksEnabled) {
    return [];
  }

  const timeSec = now / 1000;
  const minhTamState = evaluatePatrolPath(MINH_TAM_PATROL, timeSec);
  const hueDangState = evaluatePatrolPath(HUE_DANG_PATROL, timeSec + 4.2);

  // 1. Thích Minh Tâm (Áo Vàng Từ Bi #d97706) — đi kinh hành quanh sân chùa & Cội Bồ Đề
  const minhTamBubble = computePeriodicBubble(
    now,
    16_000,
    0,
    6_500,
    'Nam Mô A Di Đà Phật 🙏'
  );

  // 2. Tiểu Sư An Nhiên (Áo Nâu Thiền Định #78350f) — ngồi tụng kinh gõ mõ tại Bàn Mõ (-3.8, 0, -2.2)
  const anNhienBubble = computePeriodicBubble(
    now,
    18_000,
    6_000,
    7_000,
    'Cốc... Cốc... Tâm an vạn sự an'
  );

  // 3. Đạo Hữu Huệ Đăng (Áo Đỏ Hồng Phúc #991b1b) — đi lễ Phật giữa Chánh Điện và Gác Chuông
  const hueDangBubble = computePeriodicBubble(
    now,
    19_000,
    11_000,
    7_000,
    'Cầu chúc bách gia trăm họ bình an 🌸'
  );

  return [
    {
      uid: 'npc_thich_minh_tam',
      isNpc: true,
      monkName: 'Thích Minh Tâm',
      robeColor: '#d97706',
      position: minhTamState.position,
      rotationY: minhTamState.rotationY,
      actionState: minhTamState.actionState,
      chatBubble: minhTamBubble,
      meritPoints: 108,
      lastUpdated: now,
    },
    {
      uid: 'npc_tieu_su_an_nhien',
      isNpc: true,
      monkName: 'Tiểu Sư An Nhiên',
      robeColor: '#78350f',
      position: { x: -3.8, y: 0, z: -2.2 },
      rotationY: Math.atan2(-5 - -3.8, -2 - -2.2),
      actionState: 'wooden_fish',
      chatBubble: anNhienBubble,
      meritPoints: 96,
      lastUpdated: now,
    },
    {
      uid: 'npc_dao_huu_hue_dang',
      isNpc: true,
      monkName: 'Đạo Hữu Huệ Đăng',
      robeColor: '#991b1b',
      position: hueDangState.position,
      rotationY: hueDangState.rotationY,
      actionState: hueDangState.actionState,
      chatBubble: hueDangBubble,
      meritPoints: 88,
      lastUpdated: now,
    },
  ];
}

function collectCombinedRemoteMonks(excludeUid: string): MonkPresence[] {
  const now = Date.now();
  const combinedMap = new Map<string, MonkPresence>();

  // 1. Đạo Hữu AI Thiền Hành (nếu bật)
  for (const npc of buildAiFellowMonks(now)) {
    if (npc.uid !== excludeUid) {
      combinedMap.set(npc.uid, npc);
    }
  }

  // 2. Các Monk từ LocalStorage / Đa Tab cùng trình duyệt
  const localMap = pruneAndSaveLocalPresence();
  for (const monk of Object.values(localMap)) {
    if (
      monk &&
      monk.uid &&
      monk.uid !== excludeUid &&
      now - monk.lastUpdated <= STALE_MONK_TIMEOUT_MS
    ) {
      combinedMap.set(monk.uid, monk);
    }
  }

  // 3. Các Monk từ Cloud Firestore (nếu có cấu hình Firebase)
  for (const [uid, monk] of firestorePresenceMap.entries()) {
    if (now - monk.lastUpdated > STALE_MONK_TIMEOUT_MS) {
      firestorePresenceMap.delete(uid);
      continue;
    }
    if (uid !== excludeUid) {
      const existing = combinedMap.get(uid);
      if (!existing || monk.lastUpdated >= existing.lastUpdated) {
        combinedMap.set(uid, monk);
      }
    }
  }

  return Array.from(combinedMap.values());
}

function notifyAllMonksUpdate(): void {
  for (const session of activeSessions.values()) {
    const remoteMonks = collectCombinedRemoteMonks(session.uid);
    session.callbacks.onMonksUpdate(remoteMonks);
  }
}

function notifyAllMessagesUpdate(messages: ChatMessage[]): void {
  for (const session of activeSessions.values()) {
    session.callbacks.onMessagesUpdate(messages);
  }
}

function notifyAllWishesUpdate(wishes: IncenseWish[]): void {
  for (const session of activeSessions.values()) {
    session.callbacks.onWishesUpdate(wishes);
  }
}

function syncPresenceToFirestore(presence: MonkPresence, forceImmediate = false): void {
  if (!isFirebaseConfigured || !firestoreDb || !hasActiveUid(presence.uid)) return;
  let state = presencePublishes.get(presence.uid);
  if (!state) {
    state = { latest: presence, inFlight: false, lastSuccessfulAt: 0, action: null, bubbleText: null, failures: 0 };
    presencePublishes.set(presence.uid, state);
  }
  state.latest = presence;
  if (state.inFlight) return;
  if (state.timer !== undefined) {
    if (!forceImmediate) return;
    window.clearTimeout(state.timer); state.timer = undefined;
  }
  const pending = state;
  const schedule = (delay: number) => {
    if (!hasActiveUid(presence.uid) || presencePublishes.get(presence.uid) !== pending) return;
    pending.timer = window.setTimeout(() => {
      pending.timer = undefined;
      syncPresenceToFirestore(pending.latest);
    }, delay);
  };
  const bubbleText = presence.chatBubble?.text ?? null;
  const changed = presence.actionState !== state.action || bubbleText !== state.bubbleText;
  const remaining = FIRESTORE_PRESENCE_THROTTLE_MS - (Date.now() - state.lastSuccessfulAt);
  if (!forceImmediate && !changed && remaining > 0) { schedule(remaining); return; }
  pending.inFlight = true;
  const ref = doc(firestoreDb, 'presence', presence.uid);
  void Promise.resolve().then(() => setDoc(ref, {
    uid: presence.uid, monkName: presence.monkName, robeColor: presence.robeColor,
    position: { x: Number(presence.position.x.toFixed(3)), y: Number(presence.position.y.toFixed(3)), z: Number(presence.position.z.toFixed(3)) },
    rotationY: Number(presence.rotationY.toFixed(3)), actionState: presence.actionState,
    chatBubble: presence.chatBubble ?? null, meritPoints: presence.meritPoints, lastUpdated: presence.lastUpdated,
  })).then(() => {
    if (presencePublishes.get(presence.uid) !== pending) return;
    // Only an acknowledged write consumes the publish throttle.
    pending.lastSuccessfulAt = Date.now(); pending.action = presence.actionState;
    pending.bubbleText = bubbleText; pending.failures = 0;
    updateCloudForUid(presence.uid, (cloud) => { cloud.acknowledgedWrite = true; cloud.failures.delete('write:presence'); });
  }).catch((error) => {
    if (presencePublishes.get(presence.uid) !== pending) return;
    updateCloudForUid(presence.uid, (cloud) => { cloud.acknowledgedWrite = false; });
    reportCloudFailure(presence.uid, 'write:presence', error, 'Không thể đồng bộ vị trí trực tuyến. Đang thử lại.');
    schedule(retryDelay(pending.failures++));
  }).finally(() => {
    if (presencePublishes.get(presence.uid) !== pending) return;
    pending.inFlight = false;
    if (pending.timer === undefined && pending.latest !== presence) syncPresenceToFirestore(pending.latest);
  });
}

function removePresenceEverywhere(uid: string): void {
  pruneAndSaveLocalPresence((map) => {
    delete map[uid];
  });
  firestorePresenceMap.delete(uid);
  postBroadcast({ type: 'presence_remove', uid });

  if (isFirebaseConfigured && firestoreDb) {
    const presenceDocRef = doc(firestoreDb, 'presence', uid);
    void deleteDoc(presenceDocRef).catch(() => {
      // Ignore cleanup errors
    });
  }
}

export function startMultiplayerSession(
  profile: MonkProfile,
  initialPosition: Vector3Tuple,
  callbacks: MultiplayerCallbacks
): () => void {
  const sessionId = createUniqueId('session');
  const session: ActiveSession = {
    id: sessionId, uid: profile.uid, callbacks,
    ...(isFirebaseConfigured ? { cloud: { acknowledgedWrite: false, ready: new Set<CloudChannel>(), failures: new Map(), disposed: false } } : {}),
  };
  activeSessions.set(sessionId, session);
  notifyConnection(session);
  if (isFirebaseConfigured && !firestoreDb) reportCloudFailure(profile.uid, 'configuration', { code: 'firebase/missing-firestore' }, 'Chưa thiết lập được kết nối trực tuyến.');

  // Khởi tạo trạng thái hiện diện ban đầu của người chơi
  const initialPresence: MonkPresence = {
    uid: profile.uid,
    monkName: profile.monkName || profile.username,
    robeColor: profile.robeColor,
    position: { ...initialPosition },
    rotationY: 0,
    actionState: 'idle',
    chatBubble: null,
    meritPoints: profile.meritPoints,
    lastUpdated: Date.now(),
  };

  lastKnownLocalPresence = initialPresence;
  pruneAndSaveLocalPresence((map) => {
    map[profile.uid] = initialPresence;
  });
  postBroadcast({ type: 'presence_update', monk: initialPresence });
  syncPresenceToFirestore(initialPresence, true);

  // Phát dữ liệu ban đầu ngay lập tức
  callbacks.onMessagesUpdate(readStoredMessages());
  callbacks.onWishesUpdate(readStoredWishes());
  callbacks.onMonksUpdate(collectCombinedRemoteMonks(profile.uid));

  // Lắng nghe BroadcastChannel giữa các Tab trình duyệt
  const channel = getSharedBroadcastChannel();
  const handleBroadcastMessage = (event: MessageEvent<BroadcastPayload>) => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') return;

    switch (payload.type) {
      case 'presence_update': {
        pruneAndSaveLocalPresence((map) => {
          map[payload.monk.uid] = payload.monk;
        });
        notifyAllMonksUpdate();
        break;
      }
      case 'presence_remove': {
        pruneAndSaveLocalPresence((map) => {
          delete map[payload.uid];
        });
        firestorePresenceMap.delete(payload.uid);
        notifyAllMonksUpdate();
        break;
      }
      case 'chat_message': {
        const updated = writeStoredMessages([...readStoredMessages(), payload.message]);
        notifyAllMessagesUpdate(updated);
        break;
      }
      case 'incense_wish': {
        const updated = writeStoredWishes([payload.wish, ...readStoredWishes()]);
        notifyAllWishesUpdate(updated);
        break;
      }
    }
  };

  if (channel) {
    channel.addEventListener('message', handleBroadcastMessage);
  }

  // Lắng nghe sự kiện storage của trình duyệt để đảm bảo đồng bộ đa cửa sổ
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === STORAGE_PRESENCE_KEY) {
      notifyAllMonksUpdate();
    } else if (event.key === STORAGE_MESSAGES_KEY) {
      notifyAllMessagesUpdate(readStoredMessages());
    } else if (event.key === STORAGE_WISHES_KEY) {
      notifyAllWishesUpdate(readStoredWishes());
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  // Dọn dẹp presence khi người chơi đóng tab trình duyệt
  const handleBeforeUnload = () => {
    removePresenceEverywhere(profile.uid);
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload);
  }

  // Vòng lặp cập nhật chuyển động của Đạo Hữu AI, gia hạn heartbeat và lọc Monk ngắt kết nối (>18s)
  const tickInterval = window.setInterval(() => {
    const now = Date.now();

    // Nếu người chơi đứng yên lâu không phát sinh sự kiện mới, tự động gia hạn lastUpdated mỗi 3.5s
    if (
      lastKnownLocalPresence &&
      lastKnownLocalPresence.uid === profile.uid &&
      now - lastKnownLocalPresence.lastUpdated >= 3_500
    ) {
      const refreshed: MonkPresence = {
        ...lastKnownLocalPresence,
        lastUpdated: now,
      };
      lastKnownLocalPresence = refreshed;
      pruneAndSaveLocalPresence((map) => {
        map[profile.uid] = refreshed;
      });
      postBroadcast({ type: 'presence_update', monk: refreshed });
      syncPresenceToFirestore(refreshed, false);
    }

    notifyAllMonksUpdate();
  }, HEARTBEAT_INTERVAL_MS);

  // Server acknowledgements, rather than configuration or cached data, prove connectivity.
  const cloudUnsubscribes = new Map<CloudChannel, () => void>();
  const listenerTimers = new Map<CloudChannel, number>();
  const listenerAttempts = new Map<CloudChannel, number>();
  const generations = new Map<CloudChannel, number>();
  const cloud = session.cloud;
  const listen = (channel: CloudChannel): void => {
    if (!cloud || cloud.disposed || !firestoreDb) return;
    const oldTimer = listenerTimers.get(channel);
    if (oldTimer !== undefined) window.clearTimeout(oldTimer);
    listenerTimers.delete(channel);
    cloudUnsubscribes.get(channel)?.();
    const generation = (generations.get(channel) ?? 0) + 1;
    generations.set(channel, generation);
    cloud.ready.delete(channel); notifyConnection(session);
    const current = () => !cloud.disposed && generations.get(channel) === generation;
    const failed = (error: unknown) => {
      if (!current()) return;
      cloud.ready.delete(channel);
      cloud.failures.set(`listen:${channel}`, connectionFailure(error, 'Không thể nhận dữ liệu trực tuyến. Đang thử kết nối lại.'));
      notifyConnection(session);
      const attempt = listenerAttempts.get(channel) ?? 0;
      listenerAttempts.set(channel, attempt + 1);
      listenerTimers.set(channel, window.setTimeout(() => { listenerTimers.delete(channel); listen(channel); }, retryDelay(attempt)));
    };
    try {
      const ref = channel === 'presence' ? collection(firestoreDb, channel)
        : query(collection(firestoreDb, channel), orderBy('createdAt', 'desc'), limit(channel === 'messages' ? MAX_STORED_MESSAGES : MAX_STORED_WISHES));
      const unsubscribe = onSnapshot(ref, { includeMetadataChanges: true }, (snapshot) => {
        if (!current()) return;
        if (snapshot.metadata.fromCache === false && !snapshot.metadata.hasPendingWrites) {
          cloud.ready.add(channel); cloud.failures.delete(`listen:${channel}`); listenerAttempts.set(channel, 0);
        } else if (snapshot.metadata.fromCache !== false) cloud.ready.delete(channel);
        notifyConnection(session);
        if (channel === 'presence') {
          const now = Date.now();
          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data() as MonkPresence, uid = data?.uid || change.doc.id;
            if (change.type === 'removed') firestorePresenceMap.delete(uid);
            else if (data && typeof data.lastUpdated === 'number' && now - data.lastUpdated <= STALE_MONK_TIMEOUT_MS) firestorePresenceMap.set(uid, { ...data, uid });
          });
          notifyAllMonksUpdate();
        } else if (channel === 'messages') {
          const messages: ChatMessage[] = [];
          snapshot.forEach((record) => { if (record.metadata.hasPendingWrites) return; const data = record.data() as ChatMessage; if (data && typeof data.text === 'string') messages.push({ ...data, id: data.id || record.id }); });
          if (messages.length) notifyAllMessagesUpdate(writeStoredMessages([...readStoredMessages(), ...messages]));
        } else {
          const wishes: IncenseWish[] = [];
          snapshot.forEach((record) => { if (record.metadata.hasPendingWrites) return; const data = record.data() as IncenseWish; if (data && typeof data.wishText === 'string') wishes.push({ ...data, id: data.id || record.id }); });
          if (wishes.length) notifyAllWishesUpdate(writeStoredWishes([...wishes, ...readStoredWishes()]));
        }
      }, failed);
      cloudUnsubscribes.set(channel, unsubscribe);
    } catch (error) { failed(error); }
  };
  const channels: CloudChannel[] = ['presence', 'messages', 'wishes'];
  if (cloud && firestoreDb) channels.forEach(listen);
  const handleOffline = () => {
    if (!cloud || cloud.disposed) return;
    cloud.ready.clear();
    cloud.failures.set('network', connectionFailure({ code: 'network/offline' }, 'Mất kết nối trực tuyến.'));
    notifyConnection(session);
  };
  const handleOnline = () => {
    if (!cloud || cloud.disposed) return;
    cloud.failures.delete('network');
    channels.forEach(listen);
    if (lastKnownLocalPresence?.uid === profile.uid) syncPresenceToFirestore({ ...lastKnownLocalPresence, lastUpdated: Date.now() }, true);
    notifyConnection(session);
  };
  if (cloud) {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) handleOffline();
  }

  return () => {
    window.clearInterval(tickInterval);
    if (cloud) cloud.disposed = true;
    activeSessions.delete(sessionId);
    if (!hasActiveUid(profile.uid)) {
      const pending = presencePublishes.get(profile.uid);
      if (pending?.timer !== undefined) window.clearTimeout(pending.timer);
      presencePublishes.delete(profile.uid);
    }
    listenerTimers.forEach((timer) => window.clearTimeout(timer));
    cloudUnsubscribes.forEach((unsubscribe) => unsubscribe());
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('online', handleOnline);

    if (channel) {
      channel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }

    removePresenceEverywhere(profile.uid);
  };
}

export function publishLocalMonkState(
  profile: MonkProfile,
  position: Vector3Tuple,
  rotationY: number,
  actionState: MonkActionState,
  chatBubble?: ChatBubbleState | null
): void {
  const now = Date.now();
  const activeBubble =
    chatBubble && chatBubble.expiresAt > now ? chatBubble : null;

  const presence: MonkPresence = {
    uid: profile.uid,
    monkName: profile.monkName || profile.username,
    robeColor: profile.robeColor,
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    rotationY,
    actionState,
    chatBubble: activeBubble,
    meritPoints: profile.meritPoints,
    lastUpdated: now,
  };

  lastKnownLocalPresence = presence;
  pruneAndSaveLocalPresence((map) => {
    map[profile.uid] = presence;
  });
  postBroadcast({ type: 'presence_update', monk: presence });
  syncPresenceToFirestore(presence, false);
}

export async function sendTempleChatMessage(
  profile: MonkProfile,
  text: string,
  type: 'chat' | 'system' | 'wish' = 'chat'
): Promise<ChatMessage> {
  const cleanText = text.trim();
  const newMessage: ChatMessage = {
    id: createUniqueId('msg'),
    uid: profile.uid,
    monkName: profile.monkName || profile.username,
    robeColor: profile.robeColor,
    text: cleanText,
    createdAt: Date.now(),
    type,
  };

  if (isFirebaseConfigured) {
    try {
      if (!firestoreDb) throw Object.assign(new Error('Missing Firestore configuration'), { code: 'firebase/missing-firestore' });
      await addDoc(collection(firestoreDb, 'messages'), newMessage);
      updateCloudForUid(profile.uid, (cloud) => { cloud.failures.delete('write:messages'); });
    } catch (error) {
      const failure = connectionFailure(error, 'Không thể gửi tin nhắn trực tuyến. Vui lòng thử lại.');
      reportCloudFailure(profile.uid, 'write:messages', error, failure.message);
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  }
  const updatedMessages = writeStoredMessages([...readStoredMessages(), newMessage]);
  postBroadcast({ type: 'chat_message', message: newMessage });
  notifyAllMessagesUpdate(updatedMessages);

  return newMessage;
}

export async function submitTempleIncenseWish(
  profile: MonkProfile,
  wishText: string
): Promise<IncenseWish> {
  const cleanWish = wishText.trim();
  const newWish: IncenseWish = {
    id: createUniqueId('wish'),
    uid: profile.uid,
    monkName: profile.monkName || profile.username,
    robeColor: profile.robeColor,
    wishText: cleanWish,
    createdAt: Date.now(),
  };

  if (isFirebaseConfigured) {
    try {
      if (!firestoreDb) throw Object.assign(new Error('Missing Firestore configuration'), { code: 'firebase/missing-firestore' });
      await addDoc(collection(firestoreDb, 'wishes'), newWish);
      updateCloudForUid(profile.uid, (cloud) => { cloud.failures.delete('write:wishes'); });
    } catch (error) {
      const failure = connectionFailure(error, 'Không thể gửi lời nguyện trực tuyến. Vui lòng thử lại.');
      reportCloudFailure(profile.uid, 'write:wishes', error, failure.message);
      throw Object.assign(new Error(failure.message), { code: failure.code });
    }
  }
  const updatedWishes = writeStoredWishes([newWish, ...readStoredWishes()]);
  postBroadcast({ type: 'incense_wish', wish: newWish });
  notifyAllWishesUpdate(updatedWishes);

  return newWish;
}

export function setAiFellowMonksEnabled(enabled: boolean): void {
  aiFellowMonksEnabled = enabled;
  notifyAllMonksUpdate();
}

export function getAiFellowMonksEnabled(): boolean {
  return aiFellowMonksEnabled;
}
