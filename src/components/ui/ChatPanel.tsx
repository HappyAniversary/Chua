import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  MessageCircle,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { ROBE_COLOR_OPTIONS } from '../../constants/templeLayout';
import type { MultiplayerConnectionStatus } from '../../services/multiplayerService';
import { connectionPresentation, countHumanPlayers, sendFailureMessage } from '../../utils/multiplayerPresentation';
import type {
  ChatMessage,
  MonkActionState,
  MonkPresence,
  MonkProfile,
  RobeColor,
} from '../../types/game';

export interface ChatPanelProps {
  profile: MonkProfile;
  messages: ChatMessage[];
  onlineMonks: MonkPresence[];
  onSendMessage: (text: string) => Promise<void> | void;
  connectionStatus: MultiplayerConnectionStatus;
  aiMonksEnabled?: boolean;
  onToggleAiMonks?: (enabled: boolean) => void;
}

const QUICK_BLESSINGS: string[] = [
  'A Di Đà Phật 🙏',
  'Tâm an vạn sự an 🌸',
  'Chúc đạo hữu bình an ✨',
  'Công đức vô lượng 🪷',
];

function getActionStateLabel(state: MonkActionState): string {
  switch (state) {
    case 'walking':
      return 'Đang đi dạo';
    case 'praying':
      return 'Đang lễ Phật';
    case 'wooden_fish':
      return 'Đang gõ mõ';
    case 'bell':
      return 'Đang thỉnh chuông';
    case 'fortune':
      return 'Đang xin xăm';
    case 'idle':
    default:
      return 'Đang tĩnh tâm';
  }
}

function getRobeName(color: RobeColor): string {
  return (
    ROBE_COLOR_OPTIONS.find((opt) => opt.color === color)?.name ?? 'Áo Cà Sa'
  );
}

function formatMessageTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  profile,
  messages,
  onlineMonks,
  onSendMessage,
  connectionStatus,
  aiMonksEnabled = true,
  onToggleAiMonks,
}) => {
  const [isOpen, setIsOpen] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia('(max-width: 639px)').matches
  );
  const [activeTab, setActiveTab] = useState<'chat' | 'online'>('chat');
  const [draftText, setDraftText] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [lastSeenCount, setLastSeenCount] = useState<number>(messages.length);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Tự động cuộn xuống cuối danh sách khi có tin nhắn mới hoặc mở khung Chat
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setLastSeenCount(messages.length);
    }
  }, [messages.length, isOpen, activeTab]);

  const unreadCount = isOpen
    ? 0
    : Math.max(0, messages.length - lastSeenCount);

  const totalOnline = countHumanPlayers(onlineMonks, profile.uid);
  const connection = connectionPresentation(connectionStatus);

  const handleSendText = async (rawText: string) => {
    const trimmed = rawText.trim().replace(/\s+/g, ' ');
    if (!trimmed || isSending) return;

    setIsSending(true);
    setSendError(null);
    try {
      await onSendMessage(trimmed);
      setDraftText((current) => current.trim().replace(/\s+/g, ' ') === trimmed ? '' : current);
    } catch (error) {
      setSendError(sendFailureMessage(error));
      setDraftText((current) => current.trim() ? current : rawText);
    } finally {
      setIsSending(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSendText(draftText);
  };

  // Trạng thái thu gọn ở góc dưới bên phải (không che Virtual Joystick ở góc dưới bên trái)
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-30 select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setLastSeenCount(messages.length);
          }}
          className="group flex items-center gap-2.5 px-3 sm:px-4 py-2.5 rounded-2xl bg-stone-950/90 hover:bg-stone-900/95 border border-amber-500/45 shadow-[0_8px_28px_rgba(0,0,0,0.65)] backdrop-blur-md text-amber-100 transition-all hover:border-amber-400"
          aria-label="Mở khung Trò Chuyện Sân Chùa"
        >
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300">
            <MessageCircle className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-amber-100 flex items-center gap-1.5">
              <span>Trò Chuyện Sân Chùa</span>
            </div>
            <div className="text-[11px] text-amber-300/80 flex items-center gap-2">
              <span>👥 {totalOnline} người chơi{connection.isOnline ? ' online' : ' trong phiên'}</span>
              <span>•</span>
              <span>💬 {messages.length} tin</span>
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Khung Trò Chuyện Sân Chùa và Người Chơi"
      className="fixed bottom-4 right-4 z-30 w-[310px] sm:w-[356px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-stone-950/90 border border-amber-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.75)] backdrop-blur-md text-amber-50 flex flex-col overflow-hidden pointer-events-auto"
    >
      {/* Thanh tiêu đề & Nút chuyển Tab */}
      <div className="px-3 pt-2.5 pb-2 bg-stone-900/90 border-b border-amber-500/25 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-stone-950/80 p-1 rounded-xl border border-amber-500/20 flex-1">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'chat'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-sm'
                : 'text-amber-200/65 hover:text-amber-100'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Trò Chuyện</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('online')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'online'
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/40 shadow-sm'
                : 'text-amber-200/65 hover:text-amber-100'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Người chơi ({totalOnline})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Thu gọn khung trò chuyện"
          aria-label="Thu gọn khung trò chuyện"
          className="w-8 h-8 rounded-xl bg-stone-950/75 hover:bg-stone-800 border border-amber-500/25 flex items-center justify-center text-amber-200/80 hover:text-amber-100 transition shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Nội dung Tab 1: Trò Chuyện Sân Chùa */}
      {activeTab === 'chat' ? (
        <div className="flex flex-col h-[310px] sm:h-[340px]">
          {/* Danh sách tin nhắn */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2 scrollbar-thin">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 text-amber-200/60 text-xs">
                <Sparkles className="w-5 h-5 text-amber-400/70 mb-1.5" />
                <p>Sân chùa đang thanh tịnh.</p>
                <p className="text-[11px] text-amber-200/45 mt-0.5">
                  Hãy gửi lời chào hoặc chọn câu chúc nhanh bên dưới để hiện bong bóng thoại trên đầu Chú Tiểu!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.type === 'system') {
                  return (
                    <div
                      key={msg.id}
                      className="flex justify-center my-1"
                    >
                      <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-[11px] text-amber-200/85 text-center leading-snug">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                if (msg.type === 'wish') {
                  return (
                    <div
                      key={msg.id}
                      className="rounded-xl bg-gradient-to-r from-amber-950/75 via-stone-900/90 to-red-950/60 border border-amber-400/40 p-2.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/60"
                            style={{ backgroundColor: msg.robeColor }}
                          />
                          <span className="text-xs font-bold text-amber-200 truncate">
                            {msg.monkName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold shrink-0">
                            🏮 Nguyện Ước
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-200/50 shrink-0">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-amber-50/95 italic leading-relaxed break-words">
                        “{msg.text}”
                      </p>
                    </div>
                  );
                }

                const isSelf = msg.uid === profile.uid;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isSelf ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-3 py-2 border ${
                        isSelf
                          ? 'bg-amber-500/20 border-amber-400/45 text-amber-50 rounded-br-sm'
                          : 'bg-stone-900/90 border-amber-500/20 text-amber-100 rounded-bl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border border-white/60"
                            style={{ backgroundColor: msg.robeColor }}
                          />
                          <span className="text-[11px] font-bold text-amber-300 truncate">
                            {msg.monkName}
                            {isSelf ? ' (Bạn)' : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-amber-200/45 shrink-0">
                          {formatMessageTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-amber-50 leading-relaxed break-words">
                        {msg.text}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {sendError && <p role="alert" className="border-t border-red-500/25 bg-red-950/60 px-3 py-2 text-[11px] text-red-200">{sendError}</p>}

          {/* Các chip câu chúc nhanh 1 chạm */}
          <div className="px-2.5 py-1.5 bg-stone-900/70 border-t border-amber-500/15 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_BLESSINGS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={isSending}
                onClick={() => void handleSendText(chip)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-stone-950/85 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400/60 text-[11px] font-medium text-amber-200 transition disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Ô nhập tin nhắn + Nút gửi */}
          <form
            onSubmit={handleFormSubmit}
            className="p-2 bg-stone-900/95 border-t border-amber-500/25 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={draftText}
              onChange={(e) => { setDraftText(e.target.value); setSendError(null); }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              placeholder="Gửi lời chào sân chùa (Enter)..."
              maxLength={140}
              disabled={isSending}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-stone-950/90 border border-amber-500/30 text-xs text-amber-50 placeholder-amber-200/40 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={isSending || !draftText.trim()}
              aria-label="Gửi tin nhắn"
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-bold text-xs flex items-center gap-1 shadow transition disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Gửi</span>
            </button>
          </form>
        </div>
      ) : (
        /* Nội dung Tab 2: Đạo Hữu Trong Chùa */
        <div className="flex flex-col h-[310px] sm:h-[340px]">
          {/* Công tắc bật/tắt Sư Huynh NPC đi kinh hành */}
          <div className="px-3 py-2 bg-stone-900/70 border-b border-amber-500/20 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-amber-100/90 leading-snug">
              Hiển thị các Sư Huynh NPC đi kinh hành
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={aiMonksEnabled}
              onClick={() => onToggleAiMonks?.(!aiMonksEnabled)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                aiMonksEnabled ? 'bg-amber-500' : 'bg-stone-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  aiMonksEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Danh sách bản thân + các onlineMonks */}
          <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2">
            {/* Thẻ Bản Thân (Bạn) */}
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/45 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-4 h-4 rounded-full shrink-0 border-2 border-white/80 shadow"
                  style={{ backgroundColor: profile.robeColor }}
                  title={getRobeName(profile.robeColor)}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-amber-100 truncate flex items-center gap-1.5">
                    <span className="truncate">{profile.monkName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-400/25 text-amber-200 font-semibold shrink-0">
                      Bạn
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-200/75 truncate">
                    {getRobeName(profile.robeColor)} • Đang tại sân chùa
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/25 border border-amber-400/40 text-[11px] font-bold text-amber-200">
                  ✨ {profile.meritPoints}
                </span>
              </div>
            </div>

            {/* Danh sách các Đạo Hữu khác */}
            {onlineMonks.map((monk) => (
              <div
                key={monk.uid}
                className="p-2.5 rounded-xl bg-stone-900/85 border border-amber-500/20 flex items-center justify-between gap-2 hover:border-amber-500/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/70 shadow"
                    style={{ backgroundColor: monk.robeColor }}
                    title={getRobeName(monk.robeColor)}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-amber-100 truncate">
                      {monk.monkName}
                      {monk.isNpc && <span className="ml-1.5 text-[10px] text-amber-300/60">NPC</span>}
                    </div>
                    <div className="text-[11px] text-amber-300/75 truncate">
                      {getActionStateLabel(monk.actionState)}
                    </div>
                    {monk.chatBubble?.text && (
                      <div className="text-[10px] text-amber-200/70 italic truncate mt-0.5">
                        “{monk.chatBubble.text}”
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-950/90 border border-amber-500/30 text-[11px] font-semibold text-amber-300">
                    ✨ {monk.meritPoints}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

export default ChatPanel;
