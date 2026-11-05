import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { MonkProfile, RobeColor } from '../types/game';
import {
  firebaseAuth,
  firestoreDb,
  getBackendMode,
  isFirebaseConfigured,
} from './firebaseConfig';

export interface RegisterAccountInput {
  username: string;
  password: string;
  monkName?: string;
  robeColor?: RobeColor;
}

export interface LoginAccountInput {
  username: string;
  password: string;
}

export interface UpdateMonkProfileInput {
  monkName?: string;
  robeColor?: RobeColor;
  meritPoints?: number;
}

interface StoredLocalAccount {
  uid: string;
  username: string;
  passwordHash: string;
  profile: MonkProfile;
}

const LOCAL_ACCOUNTS_STORAGE_KEY = 'chua_accounts_v1';
const ACTIVE_UID_SESSION_KEY = 'chua_active_uid_session';
const ACTIVE_UID_LOCAL_KEY = 'chua_active_uid_local';
const INTERNAL_EMAIL_DOMAIN = 'chua-thanh-tinh.local';
const DEFAULT_ROBE_COLOR: RobeColor = '#d97706';

const VALID_ROBE_COLORS: readonly RobeColor[] = [
  '#d97706',
  '#991b1b',
  '#78350f',
  '#4b5563',
  '#1e3a8a',
];

/**
 * Trả về chế độ xác thực hiện tại ('firebase' hoặc 'local').
 */
export function getAuthBackendMode(): 'firebase' | 'local' {
  return getBackendMode();
}

/**
 * Chuẩn hóa tên tài khoản: cắt khoảng trắng hai đầu và chuyển về chữ thường.
 */
export function normalizeUsername(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

function isValidRobeColor(color: unknown): color is RobeColor {
  return typeof color === 'string' && VALID_ROBE_COLORS.includes(color as RobeColor);
}

function validateCredentials(rawUsername: string, rawPassword: string): {
  normalizedUsername: string;
  password: string;
} {
  const normalizedUsername = normalizeUsername(rawUsername);

  if (!normalizedUsername) {
    throw new Error('Tên tài khoản phải từ 3 đến 24 ký tự (chữ cái, số, dấu gạch dưới).');
  }

  if (normalizedUsername.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedUsername)) {
      throw new Error('Địa chỉ email đăng nhập không hợp lệ.');
    }
  } else {
    const usernameRegex = /^[a-z0-9_]{3,24}$/;
    if (!usernameRegex.test(normalizedUsername)) {
      throw new Error('Tên tài khoản phải từ 3 đến 24 ký tự (chữ cái, số, dấu gạch dưới).');
    }
  }

  const password = rawPassword ?? '';
  if (password.length < 4) {
    throw new Error('Mật khẩu phải có ít nhất 4 ký tự.');
  }

  return { normalizedUsername, password };
}

function toInternalAuthEmail(normalizedUsername: string): string {
  if (normalizedUsername.includes('@')) {
    return normalizedUsername;
  }
  return `${normalizedUsername}@${INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Đảm bảo mật khẩu gửi lên Firebase Auth có tối thiểu 6 ký tự
 * nhưng vẫn cho phép người dùng đặt mật khẩu từ 4 ký tự trở lên theo yêu cầu.
 */
function toFirebaseAuthPassword(password: string): string {
  if (password.length >= 6) {
    return password;
  }
  return `${password}#chua3d`;
}

/**
 * Hàm băm nhẹ một chiều phục vụ lưu trữ đối chiếu mật khẩu ở Local Fallback.
 */
function hashPasswordLocal(username: string, password: string): string {
  const salted = `chua_salt_v1:${username}:${password}`;
  let hash1 = 5381;
  let hash2 = 52711;
  for (let i = 0; i < salted.length; i++) {
    const charCode = salted.charCodeAt(i);
    hash1 = (hash1 * 33) ^ charCode;
    hash2 = (hash2 * 33) ^ (charCode + i);
  }
  return `h1_${(hash1 >>> 0).toString(16)}_${(hash2 >>> 0).toString(16)}`;
}

function readLocalAccounts(): StoredLocalAccount[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_ACCOUNTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is StoredLocalAccount =>
        Boolean(
          item &&
            typeof item.uid === 'string' &&
            typeof item.username === 'string' &&
            typeof item.passwordHash === 'string' &&
            item.profile &&
            typeof item.profile.uid === 'string'
        )
    );
  } catch {
    return [];
  }
}

function writeLocalAccounts(accounts: StoredLocalAccount[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(LOCAL_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.warn('[AuthService] Không thể lưu danh sách tài khoản vào localStorage:', error);
  }
}

function setActiveSessionUid(uid: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.sessionStorage.setItem(ACTIVE_UID_SESSION_KEY, uid);
  } catch {
    // Ignore sessionStorage quota/security errors
  }
  try {
    window.localStorage.setItem(ACTIVE_UID_LOCAL_KEY, uid);
  } catch {
    // Ignore localStorage quota/security errors
  }
}

function getActiveSessionUid(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const sessionUid = window.sessionStorage.getItem(ACTIVE_UID_SESSION_KEY);
    if (sessionUid) {
      return sessionUid;
    }
  } catch {
    // Ignore
  }

  try {
    const localUid = window.localStorage.getItem(ACTIVE_UID_LOCAL_KEY);
    if (localUid) {
      // Đồng bộ sang sessionStorage của tab hiện tại để giữ phiên độc lập nếu mở thêm tab mới
      try {
        window.sessionStorage.setItem(ACTIVE_UID_SESSION_KEY, localUid);
      } catch {
        // Ignore
      }
      return localUid;
    }
  } catch {
    // Ignore
  }

  return null;
}

function clearActiveSessionUid(): void {
  if (typeof window === 'undefined') {
    return;
  }
  let currentTabUid: string | null = null;
  try {
    currentTabUid = window.sessionStorage.getItem(ACTIVE_UID_SESSION_KEY);
    window.sessionStorage.removeItem(ACTIVE_UID_SESSION_KEY);
  } catch {
    // Ignore
  }

  try {
    const localUid = window.localStorage.getItem(ACTIVE_UID_LOCAL_KEY);
    if (!currentTabUid || localUid === currentTabUid) {
      window.localStorage.removeItem(ACTIVE_UID_LOCAL_KEY);
    }
  } catch {
    // Ignore
  }
}

/** Browser storage may remember local accounts, but never establishes Cloud identity. */
function synchronizeCloudSessionUid(): string | null {
  const uid = firebaseAuth?.currentUser?.uid ?? null;
  if (uid) {
    if (getActiveSessionUid() !== uid) clearActiveSessionUid();
    setActiveSessionUid(uid);
  } else {
    clearActiveSessionUid();
    // Cloud sign-out also invalidates a different UID left by another local tab.
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem(ACTIVE_UID_LOCAL_KEY); } catch { /* Storage may be unavailable. */ }
    }
  }
  return uid;
}

function requireCurrentCloudUser(uid: string): void {
  if (synchronizeCloudSessionUid() !== uid) {
    throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.');
  }
}

function upsertLocalProfileCache(
  profile: MonkProfile,
  passwordHash = 'firebase_managed'
): void {
  const accounts = readLocalAccounts();
  const existingIndex = accounts.findIndex(
    (acc) => acc.uid === profile.uid || acc.username === profile.username
  );

  if (existingIndex >= 0) {
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      uid: profile.uid,
      username: profile.username,
      profile,
    };
  } else {
    accounts.push({
      uid: profile.uid,
      username: profile.username,
      passwordHash,
      profile,
    });
  }

  writeLocalAccounts(accounts);
}

function sanitizeMonkProfile(raw: Partial<MonkProfile>, fallbackUid: string): MonkProfile {
  const now = Date.now();
  return {
    uid: typeof raw.uid === 'string' && raw.uid ? raw.uid : fallbackUid,
    username:
      typeof raw.username === 'string' && raw.username
        ? normalizeUsername(raw.username)
        : `monk_${fallbackUid.slice(0, 6)}`,
    monkName: typeof raw.monkName === 'string' ? raw.monkName.trim() : '',
    robeColor: isValidRobeColor(raw.robeColor) ? raw.robeColor : DEFAULT_ROBE_COLOR,
    meritPoints:
      typeof raw.meritPoints === 'number' && Number.isFinite(raw.meritPoints)
        ? Math.max(0, Math.floor(raw.meritPoints))
        : 0,
    createdAt:
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : now,
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : now,
  };
}

function waitForFirebaseAuthInit(): Promise<User | null> {
  if (!isFirebaseConfigured || !firebaseAuth) {
    return Promise.resolve(null);
  }
  const auth = firebaseAuth;
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(auth.currentUser ?? null);
      }
    }, 2500);

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(user);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(null);
        }
      }
    );
  });
}

function extractFirebaseErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '');
  }
  return '';
}

/**
 * Đăng ký tài khoản Chú Tiểu mới bằng tên tài khoản và mật khẩu.
 * Nếu chưa truyền `monkName`, mặc định đặt `monkName = ""` để UI mở `MonkSetupModal`.
 */
export async function registerWithUsernamePassword(
  input: RegisterAccountInput
): Promise<MonkProfile> {
  const { normalizedUsername, password } = validateCredentials(
    input.username,
    input.password
  );
  const initialMonkName = typeof input.monkName === 'string' ? input.monkName.trim() : '';
  const initialRobeColor: RobeColor = isValidRobeColor(input.robeColor)
    ? input.robeColor
    : DEFAULT_ROBE_COLOR;
  const now = Date.now();

  if (isFirebaseConfigured && firebaseAuth && firestoreDb) {
    synchronizeCloudSessionUid();
    try {
      const authEmail = toInternalAuthEmail(normalizedUsername);
      const authPassword = toFirebaseAuthPassword(password);
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        authEmail,
        authPassword
      );
      requireCurrentCloudUser(credential.user.uid);

      const newProfile: MonkProfile = {
        uid: credential.user.uid,
        username: normalizedUsername,
        monkName: initialMonkName,
        robeColor: initialRobeColor,
        meritPoints: 0,
        createdAt: now,
        updatedAt: now,
      };

      const userDocRef = doc(firestoreDb, 'users', credential.user.uid);
      await setDoc(userDocRef, newProfile);
      requireCurrentCloudUser(credential.user.uid);

      upsertLocalProfileCache(
        newProfile,
        hashPasswordLocal(normalizedUsername, password)
      );
      setActiveSessionUid(newProfile.uid);
      return newProfile;
    } catch (error) {
      const code = extractFirebaseErrorCode(error);
      if (code === 'auth/email-already-in-use') {
        throw new Error(
          'Tên tài khoản này đã được đăng ký. Vui lòng chọn tên khác hoặc đăng nhập.'
        );
      }
      if (code === 'auth/invalid-email') {
        throw new Error('Tên tài khoản không hợp lệ.');
      }
      if (code === 'auth/weak-password') {
        throw new Error('Mật khẩu phải có ít nhất 4 ký tự.');
      }
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error('Không thể đăng ký tài khoản lúc này. Vui lòng thử lại.');
    }
  }

  // Chế độ Local Fallback
  const accounts = readLocalAccounts();
  const existing = accounts.find((acc) => acc.username === normalizedUsername);
  if (existing) {
    throw new Error(
      'Tên tài khoản này đã được đăng ký. Vui lòng chọn tên khác hoặc đăng nhập.'
    );
  }

  const uid = `monk_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const newProfile: MonkProfile = {
    uid,
    username: normalizedUsername,
    monkName: initialMonkName,
    robeColor: initialRobeColor,
    meritPoints: 0,
    createdAt: now,
    updatedAt: now,
  };

  const passwordHash = hashPasswordLocal(normalizedUsername, password);
  accounts.push({
    uid,
    username: normalizedUsername,
    passwordHash,
    profile: newProfile,
  });

  writeLocalAccounts(accounts);
  setActiveSessionUid(uid);
  return newProfile;
}

/**
 * Đăng nhập bằng tên tài khoản và mật khẩu.
 */
export async function loginWithUsernamePassword(
  input: LoginAccountInput
): Promise<MonkProfile> {
  const { normalizedUsername, password } = validateCredentials(
    input.username,
    input.password
  );

  if (isFirebaseConfigured && firebaseAuth && firestoreDb) {
    synchronizeCloudSessionUid();
    try {
      const authEmail = toInternalAuthEmail(normalizedUsername);
      const authPassword = toFirebaseAuthPassword(password);
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        authEmail,
        authPassword
      );

      const uid = credential.user.uid;
      requireCurrentCloudUser(uid);
      const userDocRef = doc(firestoreDb, 'users', uid);
      const snapshot = await getDoc(userDocRef);
      requireCurrentCloudUser(uid);

      let profile: MonkProfile;
      if (snapshot.exists()) {
        profile = sanitizeMonkProfile({ ...snapshot.data() as Partial<MonkProfile>, uid }, uid);
      } else {
        const now = Date.now();
        profile = {
          uid,
          username: normalizedUsername,
          monkName: '',
          robeColor: DEFAULT_ROBE_COLOR,
          meritPoints: 0,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userDocRef, profile);
      }

      requireCurrentCloudUser(uid);
      upsertLocalProfileCache(profile, hashPasswordLocal(normalizedUsername, password));
      setActiveSessionUid(uid);
      return profile;
    } catch (error) {
      const code = extractFirebaseErrorCode(error);
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-email'
      ) {
        throw new Error('Tài khoản không tồn tại hoặc sai mật khẩu.');
      }
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error('Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    }
  }

  // Chế độ Local Fallback
  const accounts = readLocalAccounts();
  const expectedHash = hashPasswordLocal(normalizedUsername, password);
  const matched = accounts.find(
    (acc) => acc.username === normalizedUsername && acc.passwordHash === expectedHash
  );

  if (!matched) {
    throw new Error('Tài khoản không tồn tại hoặc sai mật khẩu.');
  }

  const profile = sanitizeMonkProfile(matched.profile, matched.uid);
  setActiveSessionUid(profile.uid);
  return profile;
}

/**
 * Đăng xuất tài khoản Chú Tiểu hiện tại khỏi phiên làm việc.
 */
export async function logoutCurrentMonk(): Promise<void> {
  clearActiveSessionUid();
  if (isFirebaseConfigured && firebaseAuth) {
    try {
      await signOut(firebaseAuth);
    } catch (error) {
      console.warn('[AuthService] Lỗi khi đăng xuất khỏi Firebase Auth:', error);
    }
  }
}

/**
 * Restore Cloud sessions only from Firebase Auth; local mode retains per-tab restoration.
 */
export async function getCurrentMonkSession(): Promise<MonkProfile | null> {
  if (isFirebaseConfigured && firebaseAuth && firestoreDb) {
    await waitForFirebaseAuthInit();
    const targetUid = synchronizeCloudSessionUid();
    if (!targetUid) {
      return null;
    }

    try {
      const userDocRef = doc(firestoreDb, 'users', targetUid);
      const snapshot = await getDoc(userDocRef);
      if (synchronizeCloudSessionUid() !== targetUid) return null;
      if (snapshot.exists()) {
        const profile = sanitizeMonkProfile(
          { ...snapshot.data() as Partial<MonkProfile>, uid: targetUid },
          targetUid
        );
        upsertLocalProfileCache(profile);
        setActiveSessionUid(profile.uid);
        return profile;
      }
      return null;
    } catch (error) {
      if (synchronizeCloudSessionUid() !== targetUid) return null;
      console.warn(
        '[AuthService] Không thể tải hồ sơ từ Firestore, thử đọc từ bộ nhớ đệm:',
        error
      );
      const cached = readLocalAccounts().find(
        (account) => account.uid === targetUid && account.profile.uid === targetUid
      );
      return cached ? sanitizeMonkProfile(cached.profile, targetUid) : null;
    }
  }

  // Chế độ Local Fallback
  const activeUid = getActiveSessionUid();
  if (!activeUid) {
    return null;
  }

  const accounts = readLocalAccounts();
  const found = accounts.find((acc) => acc.uid === activeUid);
  if (!found) {
    return null;
  }

  return sanitizeMonkProfile(found.profile, found.uid);
}

/**
 * Cập nhật thông tin Pháp danh, màu áo cà sa hoặc điểm công đức của Chú Tiểu.
 */
export async function updateMonkProfile(
  uid: string,
  updates: UpdateMonkProfileInput
): Promise<MonkProfile> {
  if (!uid) {
    throw new Error('Không xác định được định danh Chú Tiểu cần cập nhật.');
  }

  const now = Date.now();
  const accounts = readLocalAccounts();
  const localIndex = accounts.findIndex((acc) => acc.uid === uid);

  let baseProfile: MonkProfile | null =
    localIndex >= 0
      ? sanitizeMonkProfile(accounts[localIndex].profile, uid)
      : null;

  if (isFirebaseConfigured) {
    requireCurrentCloudUser(uid);
    if (!firestoreDb) {
      throw new Error('Chưa thiết lập được kết nối hồ sơ trực tuyến.');
    }
    const userDocRef = doc(firestoreDb, 'users', uid);
    if (!baseProfile) {
      const snapshot = await getDoc(userDocRef);
      requireCurrentCloudUser(uid);
      if (snapshot.exists()) {
        baseProfile = sanitizeMonkProfile(
          { ...snapshot.data() as Partial<MonkProfile>, uid },
          uid
        );
      }
    }

    const updatedProfile: MonkProfile = {
      uid,
      username: baseProfile?.username ?? `monk_${uid.slice(0, 6)}`,
      monkName:
        updates.monkName !== undefined
          ? updates.monkName.trim()
          : (baseProfile?.monkName ?? ''),
      robeColor:
        updates.robeColor !== undefined && isValidRobeColor(updates.robeColor)
          ? updates.robeColor
          : (baseProfile?.robeColor ?? DEFAULT_ROBE_COLOR),
      meritPoints:
        updates.meritPoints !== undefined && Number.isFinite(updates.meritPoints)
          ? Math.max(0, Math.floor(updates.meritPoints))
          : (baseProfile?.meritPoints ?? 0),
      createdAt: baseProfile?.createdAt ?? now,
      updatedAt: now,
    };

    requireCurrentCloudUser(uid);
    try {
      await updateDoc(userDocRef, {
        monkName: updatedProfile.monkName,
        robeColor: updatedProfile.robeColor,
        meritPoints: updatedProfile.meritPoints,
        updatedAt: updatedProfile.updatedAt,
      });
    } catch (error) {
      requireCurrentCloudUser(uid);
      // Only a missing document permits creation; denied/failed writes remain failures.
      if (extractFirebaseErrorCode(error) !== 'not-found') throw error;
      await setDoc(userDocRef, updatedProfile, { merge: true });
    }
    requireCurrentCloudUser(uid);
    upsertLocalProfileCache(updatedProfile);
    return updatedProfile;
  }

  if (!baseProfile) {
    throw new Error('Không tìm thấy hồ sơ Chú Tiểu để cập nhật.');
  }

  const updatedLocalProfile: MonkProfile = {
    ...baseProfile,
    monkName:
      updates.monkName !== undefined ? updates.monkName.trim() : baseProfile.monkName,
    robeColor:
      updates.robeColor !== undefined && isValidRobeColor(updates.robeColor)
        ? updates.robeColor
        : baseProfile.robeColor,
    meritPoints:
      updates.meritPoints !== undefined && Number.isFinite(updates.meritPoints)
        ? Math.max(0, Math.floor(updates.meritPoints))
        : baseProfile.meritPoints,
    updatedAt: now,
  };

  accounts[localIndex] = {
    ...accounts[localIndex],
    profile: updatedLocalProfile,
  };
  writeLocalAccounts(accounts);

  return updatedLocalProfile;
}

/**
 * Cộng thêm (hoặc điều chỉnh) điểm công đức cho Chú Tiểu và lưu lại bền vững.
 */
export async function addMonkMeritPoints(
  uid: string,
  delta: number
): Promise<MonkProfile> {
  const safeDelta = Number.isFinite(delta) ? Math.floor(delta) : 0;
  const accounts = readLocalAccounts();
  const localAccount = accounts.find((acc) => acc.uid === uid);

  let currentMerit = localAccount?.profile.meritPoints ?? 0;

  if (isFirebaseConfigured && firestoreDb && !localAccount) {
    try {
      const snapshot = await getDoc(doc(firestoreDb, 'users', uid));
      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<MonkProfile>;
        if (typeof data.meritPoints === 'number' && Number.isFinite(data.meritPoints)) {
          currentMerit = data.meritPoints;
        }
      }
    } catch {
      // Ignore fallback
    }
  }

  const nextMerit = Math.max(0, currentMerit + safeDelta);
  return updateMonkProfile(uid, { meritPoints: nextMerit });
}

/**
 * Trả về danh sách các hồ sơ Chú Tiểu đã đăng ký trên trình duyệt cục bộ.
 */
export function listRegisteredLocalMonks(): MonkProfile[] {
  return readLocalAccounts().map((acc) => sanitizeMonkProfile(acc.profile, acc.uid));
}
