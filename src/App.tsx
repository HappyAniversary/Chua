import { useCallback, useEffect, useRef, useState } from 'react';
import { FortuneDrawModal } from './components/activities/FortuneDrawModal';
import { IncensePrayerModal } from './components/activities/IncensePrayerModal';
import { WoodenFishAndBellOverlay } from './components/activities/WoodenFishAndBellOverlay';
import { VirtualJoystick } from './components/controls/VirtualJoystick';
import { FigureLab } from './components/dev/FigureLab';
import type { MonkTransformState } from './components/player/MonkAvatar';
import { AuthModal } from './components/ui/AuthModal';
import { ChatPanel } from './components/ui/ChatPanel';
import { HUD } from './components/ui/HUD';
import { MonkSetupModal } from './components/ui/MonkSetupModal';
import { TempleScene } from './components/world/TempleScene';
import {
  CAMERA_DEFAULTS,
  INTERACTION_ZONES,
  SPAWN_POINT,
  findNearestInteractionZone,
  getGroundHeight,
} from './constants/templeLayout';
import { useInputControls } from './hooks/useInputControls';
import {
  addMonkMeritPoints,
  getAuthBackendMode,
  getCurrentMonkSession,
  logoutCurrentMonk,
} from './services/authService';
import {
  getAiFellowMonksEnabled,
  publishLocalMonkState,
  sendTempleChatMessage,
  setAiFellowMonksEnabled,
  startMultiplayerSession,
  submitTempleIncenseWish,
} from './services/multiplayerService';
import type { MultiplayerConnectionStatus } from './services/multiplayerService';
import { countHumanPlayers } from './utils/multiplayerPresentation';
import { completeSessionOperation } from './utils/sessionOperation';
import type {
  CameraControlState,
  ChatBubbleState,
  ChatMessage,
  FortuneSlip,
  GraphicsQuality,
  IncenseWish,
  InteractionZoneConfig,
  InteractionZoneId,
  MonkActionState,
  MonkPresence,
  MonkProfile,
  TimeOfDay,
  Vector3Tuple,
} from './types/game';
import {
  isAmbientZenMusicPlaying,
  isSoundEffectsEnabled,
  setSoundEffectsEnabled,
  toggleAmbientZenMusic,
} from './utils/soundEffects';

export function App() {
  const [currentProfile, setCurrentProfile] = useState<MonkProfile | null>(null);
  const [isInitializingSession, setIsInitializingSession] = useState<boolean>(true);
  const [isEditingMonk, setIsEditingMonk] = useState<boolean>(false);
  const [isFigureLabOpen, setIsFigureLabOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.has('figure-lab') || params.has('lab');
    }
    return false;
  });

  // Môi trường & Âm thanh
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day');
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
    try {
      const saved = localStorage.getItem('chua_graphics_quality');
      if (saved === 'high' || saved === 'balanced' || saved === 'low') {
        return saved;
      }
    } catch {
      // Ignore localStorage error
    }
    return 'balanced';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() =>
    isSoundEffectsEnabled()
  );
  const [ambientMusicEnabled, setAmbientMusicEnabled] = useState<boolean>(() =>
    isAmbientZenMusicPlaying()
  );

  // Trạng thái nhân vật & Vùng tương tác
  const [hudPosition, setHudPosition] = useState<Vector3Tuple>({ ...SPAWN_POINT });
  const [hudActionState, setHudActionState] = useState<MonkActionState>('idle');
  const [activeZone, setActiveZone] = useState<InteractionZoneConfig | null>(() =>
    findNearestInteractionZone(SPAWN_POINT)
  );
  const [forcedActionState, setForcedActionState] =
    useState<MonkActionState | null>(null);
  const [chatBubble, setChatBubble] = useState<ChatBubbleState | null>(null);

  // Hoạt động tâm linh đang mở (Modal / Overlay)
  const [activeActivityModal, setActiveActivityModal] =
    useState<InteractionZoneId | null>(null);
  const [bellStrikePulse, setBellStrikePulse] = useState<number>(0);
  const [woodenFishPulse, setWoodenFishPulse] = useState<number>(0);
  const [isHudPanelBlocking, setIsHudPanelBlocking] = useState(false);
  const [isChatPanelBlocking, setIsChatPanelBlocking] = useState(false);

  // Trạng thái Multiplayer thời gian thực
  const [remoteMonks, setRemoteMonks] = useState<MonkPresence[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [recentWishes, setRecentWishes] = useState<IncenseWish[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<MultiplayerConnectionStatus>(() => ({
    mode: getAuthBackendMode(),
    state: getAuthBackendMode() === 'firebase' ? 'connecting' : 'local',
  }));
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [aiMonksEnabled, setAiMonksEnabled] = useState<boolean>(() =>
    getAiFellowMonksEnabled()
  );

  const needsMonkSetup =
    Boolean(currentProfile) &&
    (currentProfile!.monkName.trim() === '' || isEditingMonk);

  // Bật điều khiển di chuyển khi không mở modal nhập liệu (Incense / Fortune / Setup)
  const isModalBlockingMovement =
    needsMonkSetup ||
    isHudPanelBlocking ||
    isChatPanelBlocking ||
    activeActivityModal === 'incense_altar' ||
    activeActivityModal === 'bodhi_tree' ||
    activeActivityModal === 'fortune_stall';

  const { joystickVector, inputVectorRef, setJoystickInput, resetInput } =
    useInputControls(Boolean(currentProfile) && !isModalBlockingMovement);

  // Ref lưu trữ biến đổi 3D của Chú Tiểu ở 60fps
  const playerTransformRef = useRef<MonkTransformState>({
    position: { ...SPAWN_POINT },
    rotationY: Math.PI, // Hướng mặt về phía Chánh Điện (-Z)
    actionState: 'idle',
  });

  // Ref lưu trữ góc xoay Camera góc nhìn thứ 3
  const cameraControlRef = useRef<CameraControlState>({
    yaw: CAMERA_DEFAULTS.yaw,
    pitch: CAMERA_DEFAULTS.pitch,
    distance: CAMERA_DEFAULTS.distance,
    resetVersion: 0,
  });

  const currentProfileRef = useRef<MonkProfile | null>(currentProfile);
  currentProfileRef.current = currentProfile;

  const chatBubbleRef = useRef<ChatBubbleState | null>(chatBubble);
  chatBubbleRef.current = chatBubble;

  // Khôi phục phiên đăng nhập khi F5
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const sessionProfile = await getCurrentMonkSession();
        if (isMounted) {
          setCurrentProfile(sessionProfile);
        }
      } catch {
        if (isMounted) {
          setCurrentProfile(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializingSession(false);
        }
      }
    }
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Khởi chạy phiên đồng bộ Multiplayer khi người chơi đã đăng nhập và có Pháp danh
  useEffect(() => {
    if (!currentProfile || !currentProfile.monkName.trim()) {
      setRemoteMonks([]);
      return;
    }

    let active = true;
    const stopSession = startMultiplayerSession(
      currentProfile,
      playerTransformRef.current.position,
      {
        onMonksUpdate: (monks) => { if (active) setRemoteMonks(monks); },
        onMessagesUpdate: (msgs) => { if (active) setChatMessages(msgs); },
        onWishesUpdate: (wishes) => { if (active) setRecentWishes(wishes); },
        onConnectionUpdate: (status) => { if (active) setConnectionStatus(status); },
      }
    );

    return () => {
      active = false;
      stopSession();
    };
  }, [
    currentProfile?.uid,
    currentProfile?.monkName,
    currentProfile?.robeColor,
    connectionAttempt,
  ]);

  // Khi người chơi di chuyển bằng Joystick / WASD, tự động hủy động tác cố định và đóng overlay Gõ Mõ / Chuông
  useEffect(() => {
    if (joystickVector.active) {
      if (forcedActionState !== null) {
        setForcedActionState(null);
      }
      if (
        activeActivityModal === 'wooden_fish' ||
        activeActivityModal === 'temple_bell'
      ) {
        setActiveActivityModal(null);
      }
    }
  }, [joystickVector.active, forcedActionState, activeActivityModal]);

  // Tự động ẩn bong bóng thoại khi hết thời gian hiển thị
  useEffect(() => {
    if (!chatBubble) return;
    const remainingMs = Math.max(0, chatBubble.expiresAt - Date.now());
    const timer = window.setTimeout(() => {
      setChatBubble(null);
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [chatBubble]);

  const showMonkBubble = useCallback((text: string, durationMs = 5500) => {
    const bubble: ChatBubbleState = {
      text,
      expiresAt: Date.now() + durationMs,
    };
    setChatBubble(bubble);
    chatBubbleRef.current = bubble;

    if (currentProfileRef.current) {
      publishLocalMonkState(
        currentProfileRef.current,
        playerTransformRef.current.position,
        playerTransformRef.current.rotationY,
        playerTransformRef.current.actionState,
        bubble
      );
    }
  }, []);

  const earnMeritPoints = useCallback(async (delta: number) => {
    const active = currentProfileRef.current;
    if (!active || delta <= 0) return;
    try {
      await completeSessionOperation(
        active.uid,
        () => currentProfileRef.current?.uid,
        () => addMonkMeritPoints(active.uid, delta),
        (updated) => {
          setCurrentProfile(updated);
          currentProfileRef.current = updated;
          publishLocalMonkState(
            updated,
            playerTransformRef.current.position,
            playerTransformRef.current.rotationY,
            playerTransformRef.current.actionState,
            chatBubbleRef.current
          );
        }
      );
    } catch {
      // Ignore transient storage error
    }
  }, []);

  const handleAuthSuccess = (
    profile: MonkProfile,
    isNewRegistration: boolean
  ) => {
    setCurrentProfile(profile);
    if (isNewRegistration || !profile.monkName || !profile.monkName.trim()) {
      setIsEditingMonk(true);
    } else {
      showMonkBubble(
        `A Di Đà Phật! Chào mừng ${profile.monkName} bước vào Chùa Thanh Tịnh 🙏`
      );
    }
  };

  const handleMonkSetupSave = (updatedProfile: MonkProfile) => {
    setCurrentProfile(updatedProfile);
    setIsEditingMonk(false);
    showMonkBubble(
      `Pháp danh ${updatedProfile.monkName} đã sẵn sàng hành hương 🙏`
    );
  };

  const handleLogout = async () => {
    resetInput();
    setActiveActivityModal(null);
    if (ambientMusicEnabled) {
      toggleAmbientZenMusic(false);
      setAmbientMusicEnabled(false);
    }
    await logoutCurrentMonk();
    setCurrentProfile(null);
    setIsEditingMonk(false);
    setForcedActionState(null);
    setChatBubble(null);
  };

  const handleResetCamera = useCallback(() => {
    cameraControlRef.current = {
      yaw: CAMERA_DEFAULTS.yaw,
      pitch: CAMERA_DEFAULTS.pitch,
      distance: CAMERA_DEFAULTS.distance,
      resetVersion: (cameraControlRef.current.resetVersion ?? 0) + 1,
    };
  }, []);

  const handleToggleSound = useCallback(() => {
    const next = !soundEnabled;
    setSoundEffectsEnabled(next);
    setSoundEnabled(next);
  }, [soundEnabled]);

  const handleChangeGraphicsQuality = useCallback((quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    try {
      localStorage.setItem('chua_graphics_quality', quality);
    } catch {
      // Ignore localStorage error
    }
  }, []);

  const handleToggleAmbientMusic = useCallback(() => {
    const next = toggleAmbientZenMusic();
    setAmbientMusicEnabled(next);
  }, []);

  const handleToggleAiMonks = useCallback((enabled: boolean) => {
    setAiFellowMonksEnabled(enabled);
    setAiMonksEnabled(enabled);
  }, []);

  const handlePositionSync = useCallback(
    (
      position: Vector3Tuple,
      rotationY: number,
      actionState: MonkActionState
    ) => {
      setHudPosition(position);
      setHudActionState(actionState);

      if (currentProfileRef.current) {
        publishLocalMonkState(
          currentProfileRef.current,
          position,
          rotationY,
          actionState,
          chatBubbleRef.current
        );
      }
    },
    []
  );

  const handleZoneChange = useCallback((zone: InteractionZoneConfig | null) => {
    setActiveZone(zone);
  }, []);

  // Mở hoạt động lễ chùa tương ứng với khu vực
  const handleTriggerZoneActivity = useCallback(
    (zone: InteractionZoneConfig) => {
      resetInput();

      if (zone.id === 'incense_altar' || zone.id === 'bodhi_tree') {
        setActiveActivityModal(zone.id);
        setForcedActionState('praying');
      } else if (zone.id === 'wooden_fish') {
        setActiveActivityModal(zone.id);
        setForcedActionState('wooden_fish');
      } else if (zone.id === 'temple_bell') {
        setActiveActivityModal(zone.id);
        setForcedActionState('bell');
      } else if (zone.id === 'fortune_stall') {
        setActiveActivityModal(zone.id);
        setForcedActionState('fortune');
      } else if (zone.id === 'avalokitesvara_pavilion') {
        setForcedActionState('praying');
        showMonkBubble(
          'Nam Mô Đại Bi Quán Thế Âm Bồ Tát cứu khổ cứu nạn 🙏 (+8 Công Đức)',
          6500
        );
        void earnMeritPoints(zone.meritReward);
      } else if (zone.id === 'seven_story_stupa') {
        setForcedActionState('walking');
        showMonkBubble(
          'Thành tâm đi nhiễu Bảo Tháp Xá Lợi 7 Tầng hồi hướng phúc đức 🌸 (+6 Công Đức)',
          6500
        );
        void earnMeritPoints(zone.meritReward);
      } else if (zone.id === 'zen_tea_garden') {
        setForcedActionState('idle');
        showMonkBubble(
          'Ngồi thiền bên vườn đá Karesansui, lắng nghe suối reo tĩnh tâm 🍵 (+4 Công Đức)',
          6500
        );
        void earnMeritPoints(zone.meritReward);
      }
    },
    [earnMeritPoints, resetInput, showMonkBubble]
  );

  // Dịch chuyển nhanh tới khu vực trong chùa
  const handleTeleportToZone = useCallback(
    (zone: InteractionZoneConfig) => {
      resetInput();
      const targetPoint = zone.approachPoint ?? {
        x: zone.position.x,
        y: zone.position.y,
        z: zone.position.z + 1.2,
      };
      playerTransformRef.current.position = {
        ...targetPoint,
        y: getGroundHeight(targetPoint.x, targetPoint.z),
      };
      playerTransformRef.current.rotationY = zone.approachRotationY ?? Math.PI;
      playerTransformRef.current.actionState = 'idle';
      cameraControlRef.current.resetVersion = (cameraControlRef.current.resetVersion ?? 0) + 1;
      setForcedActionState(null);
      setHudPosition({ ...playerTransformRef.current.position });
      setActiveZone(zone);
      showMonkBubble(`Đã di chuyển tới ${zone.name} ✨`, 3500);
    },
    [resetInput, showMonkBubble]
  );

  // Chọn nhanh động tác của Monk
  const handleQuickActionState = useCallback(
    (state: MonkActionState) => {
      if (state === 'idle') {
        setForcedActionState(null);
        setActiveActivityModal(null);
        showMonkBubble('Tâm bất biến giữa dòng đời vạn biến 🪷', 3500);
        return;
      }

      setForcedActionState(state);
      if (state === 'wooden_fish') {
        setActiveActivityModal('wooden_fish');
        showMonkBubble('Cốc... Cốc... Tâm thanh tịnh 🙏', 4000);
      } else if (state === 'bell') {
        setActiveActivityModal('temple_bell');
        showMonkBubble('Chuông chùa ngân vang thức tỉnh chánh niệm 🔔', 4000);
      } else if (state === 'praying') {
        showMonkBubble('Nam Mô A Di Đà Phật 🙏', 4000);
      } else if (state === 'fortune') {
        setActiveActivityModal('fortune_stall');
        showMonkBubble('Thành tâm xin quẻ lành đầu năm 🌸', 4000);
      }
    },
    [showMonkBubble]
  );

  // Gửi tin nhắn Chat cộng đồng (hiện cả trong khung chat lẫn bong bóng 3D trên đầu)
  const handleSendChatMessage = useCallback(
    async (text: string) => {
      const origin = currentProfileRef.current;
      if (!origin || !text.trim()) return;
      await completeSessionOperation(
        origin.uid,
        () => currentProfileRef.current?.uid,
        () => sendTempleChatMessage(origin, text.trim(), 'chat'),
        () => showMonkBubble(text.trim(), 6000)
      );
    },
    [showMonkBubble]
  );

  // Dâng hương / Treo thẻ nguyện ước tại Chánh Điện hoặc Cội Bồ Đề
  const handleSubmitIncenseWish = useCallback(
    async (wishText: string) => {
      const origin = currentProfileRef.current;
      if (!origin || !wishText.trim()) return;
      const mode =
        activeActivityModal === 'bodhi_tree' ? 'bodhi_tree' : 'incense_altar';
      const reward = INTERACTION_ZONES[mode].meritReward;

      setForcedActionState('praying');
      await completeSessionOperation(
        origin.uid,
        () => currentProfileRef.current?.uid,
        async () => {
          await submitTempleIncenseWish(origin, wishText.trim());
          if (currentProfileRef.current?.uid === origin.uid) await earnMeritPoints(reward);
        },
        () => showMonkBubble(`🙏 Nguyện cầu: "${wishText.trim()}" (+${reward} Công Đức)`, 6500)
      );
    },
    [activeActivityModal, earnMeritPoints, showMonkBubble]
  );

  // Gõ mõ hoặc Thỉnh chuông
  const handleWoodenFishOrBellStrike = useCallback(
    (
      mode: 'wooden_fish' | 'temple_bell',
      meritEarned: number,
      chantText: string
    ) => {
      if (mode === 'wooden_fish') {
        setForcedActionState('wooden_fish');
        setWoodenFishPulse((prev) => prev + 1);
      } else {
        setForcedActionState('bell');
        setBellStrikePulse((prev) => prev + 1);
      }
      showMonkBubble(`${chantText} (+${meritEarned} Công Đức)`, 3500);
      void earnMeritPoints(meritEarned);
    },
    [earnMeritPoints, showMonkBubble]
  );

  // Rút được quẻ xăm đầu năm
  const handleFortuneDrawn = useCallback(
    (slip: FortuneSlip) => {
      setForcedActionState('fortune');
      const reward = INTERACTION_ZONES.fortune_stall.meritReward;
      showMonkBubble(
        `🎋 Xin được Quẻ số ${slip.id} (${slip.rank}): ${slip.title} (+${reward} Công Đức)`,
        6000
      );
      void earnMeritPoints(reward);
    },
    [earnMeritPoints, showMonkBubble]
  );

  // Chia sẻ quẻ xăm lên kênh Chat chùa
  const handleShareFortuneToChat = useCallback(
    async (slip: FortuneSlip) => {
      const origin = currentProfileRef.current;
      if (!origin) return;
      const shareText = `🎋 Hoan hỷ rút được Quẻ số ${slip.id} [${slip.rank} - ${slip.title}]: "${slip.poem[0]} / ${slip.poem[1]}"`;
      await completeSessionOperation(
        origin.uid,
        () => currentProfileRef.current?.uid,
        () => sendTempleChatMessage(origin, shareText, 'wish'),
        () => showMonkBubble(shareText, 6500)
      );
    },
    [showMonkBubble]
  );

  if (isInitializingSession) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-amber-200 gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <p className="text-sm font-medium text-amber-200/80">
          Đang mở cổng Tam Quan Chùa Thanh Tịnh 3D...
        </p>
      </div>
    );
  }

  if (isFigureLabOpen) {
    return (
      <FigureLab
        onBackToGame={() => {
          setIsFigureLabOpen(false);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('figure-lab');
            url.searchParams.delete('lab');
            window.history.replaceState({}, '', url.toString());
          }
        }}
      />
    );
  }

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-stone-950 text-amber-50 select-none">
      {/* 1. Màn hình Đăng nhập / Đăng ký Tài khoản & Mật khẩu */}
      {!currentProfile && <AuthModal onAuthSuccess={handleAuthSuccess} />}

      {/* 2. Màn hình Đặt Pháp danh Monk & Chọn Màu Áo Cà Sa */}
      {currentProfile && needsMonkSetup && (
        <MonkSetupModal
          profile={currentProfile}
          isInitialSetup={currentProfile.monkName.trim() === ''}
          onSave={handleMonkSetupSave}
          onCancel={
            currentProfile.monkName.trim() !== ''
              ? () => setIsEditingMonk(false)
              : undefined
          }
        />
      )}

      {/* 3. Không gian 3D Ngôi Chùa Cổ Kính, Monk Góc Nhìn Thứ 3 & Đạo Hữu Online */}
      {currentProfile ? (
        <div className="absolute inset-0 z-0">
          <TempleScene
            profile={currentProfile}
            timeOfDay={timeOfDay}
            graphicsQuality={graphicsQuality}
            inputVectorRef={inputVectorRef}
            cameraControlRef={cameraControlRef}
            playerTransformRef={playerTransformRef}
            forcedActionState={forcedActionState}
            chatBubble={chatBubble}
            activeZone={activeZone}
            remoteMonks={remoteMonks}
            recentWishes={recentWishes}
            bellStrikePulse={bellStrikePulse}
            woodenFishPulse={woodenFishPulse}
            onZoneChange={handleZoneChange}
            onPositionSync={handlePositionSync}
          />
        </div>
      ) : (
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center bg-gradient-to-b from-stone-950 via-amber-950/80 to-stone-950 p-6 text-center">
          <p className="text-sm text-amber-200/75">
            Vui lòng đăng nhập để bước vào không gian Chùa Thanh Tịnh 3D.
          </p>
        </div>
      )}

      {/* 4. Giao diện HUD, Virtual Joystick (PC & Mobile), Khung Chat & Các Nghi Thức Lễ Chùa */}
      {currentProfile && (
        <>
          {/* Thanh trạng thái trên cùng & Thẻ tương tác khu vực bên dưới */}
          <HUD
            profile={currentProfile}
            position={hudPosition}
            activeZone={activeActivityModal ? null : activeZone}
            onlineCount={countHumanPlayers(remoteMonks, currentProfile.uid)}
            connectionStatus={connectionStatus}
            onRetryConnection={() => setConnectionAttempt((attempt) => attempt + 1)}
            timeOfDay={timeOfDay}
            graphicsQuality={graphicsQuality}
            soundEnabled={soundEnabled}
            ambientMusicEnabled={ambientMusicEnabled}
            currentActionState={forcedActionState ?? hudActionState}
            onChangeTimeOfDay={setTimeOfDay}
            onChangeGraphicsQuality={handleChangeGraphicsQuality}
            onToggleSound={handleToggleSound}
            onToggleAmbientMusic={handleToggleAmbientMusic}
            onResetCamera={handleResetCamera}
            onOpenEditMonk={() => setIsEditingMonk(true)}
            onOpenFigureLab={() => setIsFigureLabOpen(true)}
            onLogout={handleLogout}
            onTriggerZoneActivity={handleTriggerZoneActivity}
            onTeleportToZone={handleTeleportToZone}
            onQuickActionState={handleQuickActionState}
            onMobilePanelChange={setIsHudPanelBlocking}
          />

          {/* Cần gạt ảo (Virtual Joystick) ở góc dưới bên trái cho cả PC (Mouse Drag) & Mobile (Touch) */}
          <VirtualJoystick
            vector={joystickVector}
            onChange={setJoystickInput}
            disabled={isModalBlockingMovement}
          />

          {/* Khung Chat Thời Gian Thực & Danh Sách Đạo Hữu Đang Ở Chùa ở góc dưới bên phải */}
          <ChatPanel
            profile={currentProfile}
            messages={chatMessages}
            onlineMonks={remoteMonks}
            onSendMessage={handleSendChatMessage}
            connectionStatus={connectionStatus}
            aiMonksEnabled={aiMonksEnabled}
            onToggleAiMonks={handleToggleAiMonks}
            onMobilePanelChange={setIsChatPanelBlocking}
          />

          {/* Hoạt động 1: Dâng Hương Lễ Phật tại Chánh Điện hoặc Treo Thẻ Ước Nguyện Cây Bồ Đề */}
          {(activeActivityModal === 'incense_altar' ||
            activeActivityModal === 'bodhi_tree') && (
            <IncensePrayerModal
              profile={currentProfile}
              mode={activeActivityModal}
              recentWishes={recentWishes}
              onSubmitWish={handleSubmitIncenseWish}
              onClose={() => {
                setActiveActivityModal(null);
                setForcedActionState(null);
              }}
            />
          )}

          {/* Hoạt động 2: Gõ Mõ Tụng Kinh hoặc Thỉnh Đại Hồng Chung */}
          {(activeActivityModal === 'wooden_fish' ||
            activeActivityModal === 'temple_bell') && (
            <WoodenFishAndBellOverlay
              profile={currentProfile}
              mode={activeActivityModal}
              onStrike={handleWoodenFishOrBellStrike}
              onClose={() => {
                setActiveActivityModal(null);
                setForcedActionState(null);
              }}
            />
          )}

          {/* Hoạt động 3: Gieo Quẻ Xin Xăm Đầu Năm */}
          {activeActivityModal === 'fortune_stall' && (
            <FortuneDrawModal
              profile={currentProfile}
              onFortuneDrawn={handleFortuneDrawn}
              onShareFortune={handleShareFortuneToChat}
              onClose={() => {
                setActiveActivityModal(null);
                setForcedActionState(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
