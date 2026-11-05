import React, { useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  LogIn,
  ShieldCheck,
  Sparkles,
  User,
  UserPlus,
} from 'lucide-react';
import { ROBE_COLOR_OPTIONS } from '../../constants/templeLayout';
import {
  getAuthBackendMode,
  listRegisteredLocalMonks,
  loginWithUsernamePassword,
  registerWithUsernamePassword,
} from '../../services/authService';
import type { MonkProfile } from '../../types/game';

export interface AuthModalProps {
  onAuthSuccess: (profile: MonkProfile, isNewRegistration: boolean) => void;
}

type AuthTabMode = 'login' | 'register';

export const AuthModal: React.FC<AuthModalProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<AuthTabMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const backendMode = useMemo(() => getAuthBackendMode(), []);
  const existingLocalMonks = useMemo(() => listRegisteredLocalMonks(), [mode]);

  const switchMode = (nextMode: AuthTabMode) => {
    setMode(nextMode);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage('Vui lòng nhập tên tài khoản (Username).');
      return;
    }

    if (!password) {
      setErrorMessage('Vui lòng nhập mật khẩu.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 4) {
        setErrorMessage('Mật khẩu cần có ít nhất 4 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'register') {
        const profile = await registerWithUsernamePassword({
          username: trimmedUsername,
          password,
          monkName: '',
          robeColor: ROBE_COLOR_OPTIONS[0].color,
        });
        onAuthSuccess(profile, true);
      } else {
        const profile = await loginWithUsernamePassword({
          username: trimmedUsername,
          password,
        });
        const needsSetup = !profile.monkName || profile.monkName.trim() === '';
        onAuthSuccess(profile, needsSetup);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi xác thực. Vui lòng thử lại.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoRegister = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const demoUsername = `chutieu_${randomSuffix}`;
      const demoPassword = `anlac${randomSuffix}`;
      const randomRobe =
        ROBE_COLOR_OPTIONS[
          Math.floor(Math.random() * ROBE_COLOR_OPTIONS.length)
        ].color;

      const profile = await registerWithUsernamePassword({
        username: demoUsername,
        password: demoPassword,
        monkName: '',
        robeColor: randomRobe,
      });
      onAuthSuccess(profile, true);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể khởi tạo tài khoản thử nghiệm lúc này.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-md scrollable-modal overflow-y-auto">
      {/* Hiệu ứng hào quang chùa ban đêm phía sau */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-amber-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[380px] h-[380px] rounded-full bg-orange-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md my-auto rounded-3xl bg-stone-900/95 border border-amber-500/35 shadow-[0_0_60px_rgba(245,158,11,0.18)] p-6 sm:p-8 text-amber-50">
        {/* Biểu tượng hoa sen / ngọn đèn thiền định */}
        <div className="text-center space-y-2 mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-700/30 border border-amber-400/50 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Flame className="w-7 h-7 text-amber-300 animate-pulse" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-medium">
            <ShieldCheck className={`w-3.5 h-3.5 ${backendMode === 'firebase' ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>
              {backendMode === 'firebase'
                ? 'Đăng nhập tài khoản trực tuyến'
                : 'Chơi cục bộ trên trình duyệt này'}
            </span>
          </div>
          {backendMode === 'local' && <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-200" role="status">Chế độ cục bộ chưa hỗ trợ nhiều người chơi giữa các thiết bị hoặc trình duyệt khác nhau.</p>}

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-200">
            Chùa Từ Tâm 3D
          </h1>
          <p className="text-xs sm:text-sm text-amber-100/75 leading-relaxed">
            Bước qua cổng Tam Quan, hóa thân thành Chú Tiểu lễ Phật, gõ mõ và gieo duyên lành.
          </p>
        </div>

        {/* Chuyển đổi tab Đăng Nhập / Đăng Ký */}
        <div className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-stone-950/90 border border-amber-500/20 mb-5">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
              mode === 'login'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md'
                : 'text-amber-200/75 hover:text-amber-100 hover:bg-stone-900/60'
            }`}
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng Nhập</span>
          </button>

          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
              mode === 'register'
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 shadow-md'
                : 'text-amber-200/75 hover:text-amber-100 hover:bg-stone-900/60'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Đăng Ký Mới</span>
          </button>
        </div>

        {/* Thông báo lỗi nếu có */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-950/80 border border-red-400/40 px-4 py-3 text-xs sm:text-sm text-red-200 flex items-start gap-2.5"
          >
            <span className="text-red-400 font-bold shrink-0">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Đăng nhập / Đăng ký */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="auth-username"
              className="block text-xs font-semibold uppercase tracking-wider text-amber-200/85 mb-1.5"
            >
              Tên tài khoản (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-amber-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ví dụ: chutieu_taman"
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950/90 border border-amber-500/30 text-amber-50 placeholder-amber-200/35 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
              />
            </div>
            <p className="text-[11px] text-amber-200/55 mt-1">
              Từ 3–24 ký tự (chữ cái, chữ số hoặc dấu gạch dưới).
            </p>
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold uppercase tracking-wider text-amber-200/85 mb-1.5"
            >
              Mật khẩu (Password)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-amber-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu bảo mật..."
                disabled={isLoading}
                className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-stone-950/90 border border-amber-500/30 text-amber-50 placeholder-amber-200/35 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-300/70 hover:text-amber-200 p-1"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-semibold uppercase tracking-wider text-amber-200/85 mb-1.5"
              >
                Nhập lại mật khẩu
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-amber-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="auth-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Xác nhận lại mật khẩu..."
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950/90 border border-amber-500/30 text-amber-50 placeholder-amber-200/35 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 transition"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Đang xử lý...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Bước Vào Cổng Chùa</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Đăng Ký & Chọn Pháp Danh</span>
              </>
            )}
          </button>
        </form>

        {/* Gợi ý điền nhanh tài khoản đã tạo trên máy (nếu đang ở tab Đăng nhập) */}
        {mode === 'login' && existingLocalMonks.length > 0 && (
          <div className="mt-4 pt-3 border-t border-amber-500/15">
            <div className="text-[11px] text-amber-300/75 mb-2">
              Tài khoản Chú Tiểu đã lưu trên thiết bị này (chọn để điền tên):
            </div>
            <div className="flex flex-wrap gap-1.5">
              {existingLocalMonks.slice(0, 4).map((m) => (
                <button
                  key={m.uid}
                  type="button"
                  onClick={() => {
                    setUsername(m.username);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-950/80 hover:bg-amber-500/20 border border-amber-500/25 text-xs text-amber-100 transition"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: m.robeColor }}
                  />
                  <span className="font-medium">
                    {m.monkName || m.username}
                  </span>
                  <span className="text-[10px] text-amber-300/60">
                    (@{m.username})
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nút vào nhanh bằng tài khoản thử nghiệm (Demo) */}
        <div className="mt-5 pt-5 border-t border-amber-500/20">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleQuickDemoRegister}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 font-semibold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-inner"
          >
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Vào Nhanh Bằng Tài Khoản Thử Nghiệm (Demo)</span>
          </button>
          <p className="text-[11px] text-center text-amber-200/55 mt-2">
            Tự động khởi tạo tài khoản Chú Tiểu mới để bạn đặt Pháp Danh và trải nghiệm ngay.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
