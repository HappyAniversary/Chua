import type { MultiplayerConnectionStatus } from '../../services/multiplayerService';
import { connectionPresentation } from '../../utils/multiplayerPresentation';

export function MultiplayerStatus({ status, onRetry }: {
  status: MultiplayerConnectionStatus;
  onRetry?: () => void;
}) {
  const view = connectionPresentation(status);
  const color = view.tone === 'success' ? 'text-emerald-200' : view.tone === 'danger' ? 'text-red-200' : 'text-amber-200';
  return <div className={`basis-full text-[11px] leading-relaxed ${color}`} role="status" aria-live="polite" aria-label="Trạng thái kết nối nhiều người chơi">
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-semibold">{view.label}</span>
      {view.canRetry && onRetry && <button type="button" onClick={onRetry} className="rounded-md border border-white/25 px-2 py-0.5 hover:bg-white/10">Kết nối lại</button>}
    </div>
    {!view.isOnline && <p className="max-w-xl text-[10px] opacity-80">{view.detail}</p>}
  </div>;
}
