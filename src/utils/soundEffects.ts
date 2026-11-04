/**
 * Bộ tổng hợp âm thanh chùa chiền bằng Web Audio API (Procedural Temple Audio Synthesizer).
 * Hoạt động độc lập 100% không cần file MP3 ngoài, tương thích mọi trình duyệt PC & Mobile.
 */

let audioCtx: AudioContext | null = null;
let soundEffectsEnabled = true;
let ambientZenPlaying = false;
let ambientIntervalId: ReturnType<typeof setInterval> | null = null;
let ambientDroneNodes: {
  oscillators: OscillatorNode[];
  gain: GainNode;
} | null = null;

/** Ngũ cung truyền thống (C4, D4, E4, G4, A4, C5) */
const PENTATONIC_ZEN_FREQUENCIES = [
  261.63, // C4 - Cung
  293.66, // D4 - Thương
  329.63, // E4 - Giốc
  392.0,  // G4 - Chủy
  440.0,  // A4 - Vũ
  523.25, // C5 - Cung (Quãng 8)
] as const;

/**
 * Khởi tạo hoặc lấy AudioContext hiện hành và tự động đánh thức nếu đang bị tạm dừng (suspended).
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {
      // Bỏ qua lỗi tự động phát khi trình duyệt chưa có tương tác người dùng
    });
  }

  return audioCtx;
}

/**
 * Tạo bộ đệm nhiễu trắng (White Noise Buffer) ngắn để mô phỏng tiếng gõ dùi gỗ hoặc tiếng thanh tre va chạm.
 */
function createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i++) {
    channelData[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

/**
 * Kiểm tra trạng thái bật/tắt hiệu ứng âm thanh hiện tại.
 */
export function isSoundEffectsEnabled(): boolean {
  return soundEffectsEnabled;
}

/**
 * Bật hoặc tắt hiệu ứng âm thanh. Nếu tắt khi nhạc thiền đang phát thì tạm dừng nhạc thiền.
 */
export function setSoundEffectsEnabled(enabled: boolean): void {
  soundEffectsEnabled = Boolean(enabled);
  if (!soundEffectsEnabled && ambientZenPlaying) {
    stopAmbientZenNodes();
    ambientZenPlaying = false;
  }
}

/**
 * Kiểm tra xem nhạc nền thiền định có đang phát hay không.
 */
export function isAmbientZenMusicPlaying(): boolean {
  return ambientZenPlaying;
}

/**
 * Phát một nốt đàn tranh / chuông gió ngũ cung êm dịu trong nhạc nền thiền.
 */
function triggerAmbientZenNote(ctx: AudioContext, freq: number, delaySeconds = 0): void {
  if (!soundEffectsEnabled || !ambientZenPlaying) return;

  const now = ctx.currentTime + delaySeconds;

  // Âm chính (Đàn tranh / Chuông gió thanh nhẹ)
  const oscMain = ctx.createOscillator();
  const oscHarmonic = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const noteGain = ctx.createGain();

  oscMain.type = 'triangle';
  oscMain.frequency.setValueAtTime(freq, now);

  oscHarmonic.type = 'sine';
  oscHarmonic.frequency.setValueAtTime(freq * 2, now);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 3.5, now);
  filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + 2.6);

  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.linearRampToValueAtTime(0.045, now + 0.035);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

  const harmonicGain = ctx.createGain();
  harmonicGain.gain.setValueAtTime(0.015, now);
  harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

  oscMain.connect(filter);
  oscHarmonic.connect(harmonicGain);
  harmonicGain.connect(filter);

  filter.connect(noteGain);
  noteGain.connect(ctx.destination);

  oscMain.start(now);
  oscHarmonic.start(now);
  oscMain.stop(now + 2.9);
  oscHarmonic.stop(now + 1.5);
}

/**
 * Dừng toàn bộ bộ hẹn giờ và âm nền của nhạc thiền định.
 */
function stopAmbientZenNodes(): void {
  if (ambientIntervalId !== null) {
    clearInterval(ambientIntervalId);
    ambientIntervalId = null;
  }

  if (ambientDroneNodes && audioCtx) {
    const now = audioCtx.currentTime;
    try {
      ambientDroneNodes.gain.gain.cancelScheduledValues(now);
      ambientDroneNodes.gain.gain.setValueAtTime(
        Math.max(0.0001, ambientDroneNodes.gain.gain.value),
        now
      );
      ambientDroneNodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      const nodesToStop = ambientDroneNodes.oscillators;
      setTimeout(() => {
        nodesToStop.forEach((osc) => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Đã dừng
          }
        });
      }, 450);
    } catch {
      // Bỏ qua nếu context đã đóng
    }
    ambientDroneNodes = null;
  }
}

/**
 * Bật/tắt nhạc nền thiền định nhẹ nhàng bằng các nốt đàn tranh/chuông gió ngũ cung (C4, D4, E4, G4, A4, C5).
 * @param forceState Trạng thái cưỡng bức (true = bật, false = tắt). Nếu bỏ trống sẽ đảo trạng thái hiện tại.
 * @returns Trạng thái phát nhạc mới sau khi chuyển đổi.
 */
export function toggleAmbientZenMusic(forceState?: boolean): boolean {
  const nextState = typeof forceState === 'boolean' ? forceState : !ambientZenPlaying;

  if (!nextState) {
    ambientZenPlaying = false;
    stopAmbientZenNodes();
    return false;
  }

  if (!soundEffectsEnabled) {
    soundEffectsEnabled = true;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    ambientZenPlaying = false;
    return false;
  }

  // Nếu đang phát rồi thì giữ nguyên
  if (ambientZenPlaying && ambientIntervalId !== null) {
    return true;
  }

  stopAmbientZenNodes();
  ambientZenPlaying = true;

  // Tạo lớp âm nền trầm ấm nhẹ nhàng (C3 + G3 hòa âm không gian chùa)
  try {
    const now = ctx.currentTime;
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, now);
    droneGain.gain.linearRampToValueAtTime(0.018, now + 1.5);

    const droneOsc1 = ctx.createOscillator();
    const droneOsc2 = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();

    droneOsc1.type = 'sine';
    droneOsc1.frequency.setValueAtTime(130.81, now); // C3
    droneOsc2.type = 'sine';
    droneOsc2.frequency.setValueAtTime(196.0, now); // G3

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(320, now);

    droneOsc1.connect(droneFilter);
    droneOsc2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);

    droneOsc1.start(now);
    droneOsc2.start(now);

    ambientDroneNodes = {
      oscillators: [droneOsc1, droneOsc2],
      gain: droneGain,
    };
  } catch {
    // Không chặn nếu khởi tạo drone thất bại
  }

  // Khởi tạo nốt mở đầu ngay khi bật
  const firstNote =
    PENTATONIC_ZEN_FREQUENCIES[
      Math.floor(Math.random() * PENTATONIC_ZEN_FREQUENCIES.length)
    ];
  triggerAmbientZenNote(ctx, firstNote, 0.05);
  triggerAmbientZenNote(ctx, 523.25, 0.45);

  // Điểm nhịp ngẫu nhiên êm dịu mỗi 2.1 giây
  ambientIntervalId = setInterval(() => {
    if (!ambientZenPlaying || !soundEffectsEnabled) return;
    const currentCtx = getAudioContext();
    if (!currentCtx) return;

    const primaryFreq =
      PENTATONIC_ZEN_FREQUENCIES[
        Math.floor(Math.random() * PENTATONIC_ZEN_FREQUENCIES.length)
      ];
    triggerAmbientZenNote(currentCtx, primaryFreq, 0);

    // Đôi khi điểm thêm một nốt hòa âm ngũ cung nhẹ phía sau
    if (Math.random() > 0.42) {
      const secondaryFreq =
        PENTATONIC_ZEN_FREQUENCIES[
          Math.floor(Math.random() * PENTATONIC_ZEN_FREQUENCIES.length)
        ];
      triggerAmbientZenNote(currentCtx, secondaryFreq, 0.38 + Math.random() * 0.35);
    }
  }, 2100);

  return true;
}

/**
 * Tiếng Mõ Gỗ trầm ấm, rỗng ("cốc!") bằng sóng triangle/sine tần số ~380Hz -> 290Hz
 * qua bộ lọc bandpass + tiếng click gỗ ngắn ở đầu, ngân ngắn ~0.18s.
 */
export function playWoodenFishSound(): void {
  if (!soundEffectsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Âm bụng mõ gỗ rỗng (Triangle 380Hz -> 290Hz + Sine cộng hưởng qua bộ lọc Bandpass)
    const bodyOsc = ctx.createOscillator();
    const cavityOsc = ctx.createOscillator();
    const bandpass = ctx.createBiquadFilter();
    const bodyGain = ctx.createGain();

    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(380, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(290, now + 0.085);

    cavityOsc.type = 'sine';
    cavityOsc.frequency.setValueAtTime(760, now);
    cavityOsc.frequency.exponentialRampToValueAtTime(580, now + 0.065);

    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(340, now);
    bandpass.Q.setValueAtTime(4.2, now);

    bodyGain.gain.setValueAtTime(0.001, now);
    bodyGain.gain.linearRampToValueAtTime(0.55, now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    const cavityGain = ctx.createGain();
    cavityGain.gain.setValueAtTime(0.18, now);
    cavityGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    bodyOsc.connect(bandpass);
    cavityOsc.connect(cavityGain);
    cavityGain.connect(bandpass);
    bandpass.connect(bodyGain);
    bodyGain.connect(ctx.destination);

    bodyOsc.start(now);
    cavityOsc.start(now);
    bodyOsc.stop(now + 0.19);
    cavityOsc.stop(now + 0.1);

    // 2. Tiếng click dùi gỗ chạm mặt mõ ở đầu (~0.025s)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'sine';
    clickOsc.frequency.setValueAtTime(1250, now);
    clickOsc.frequency.exponentialRampToValueAtTime(420, now + 0.022);

    clickGain.gain.setValueAtTime(0.28, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);

    clickOsc.start(now);
    clickOsc.stop(now + 0.028);
  } catch {
    // Bỏ qua lỗi âm thanh trên thiết bị hạn chế
  }
}

/**
 * Tiếng Đại Hồng Chung uy nghiêm, ngân dài ~3.8s bằng tổ hợp các họa âm đồng
 * (130.8Hz C3, 261.6Hz C4, 392Hz G4, 523.25Hz C5 với biên độ giảm dần và hiệu ứng rung nhẹ vibrato/beating).
 */
export function playTempleBellSound(): void {
  if (!soundEffectsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const duration = 3.8;

    const masterBellGain = ctx.createGain();
    masterBellGain.gain.setValueAtTime(0.65, now);
    masterBellGain.connect(ctx.destination);

    // Tổ hợp các họa âm đồng + tần số lệch nhẹ tạo hiệu ứng ngân rung (beating/vibrato tự nhiên)
    const partials: Array<{
      freq: number;
      amp: number;
      decay: number;
      vibratoDepth: number;
    }> = [
      { freq: 130.8, amp: 0.42, decay: 3.8, vibratoDepth: 0.45 },   // C3 - Âm gốc trầm hùng
      { freq: 131.45, amp: 0.18, decay: 3.6, vibratoDepth: 0.35 },  // C3 lệch pha tạo nhịp ngân (beating)
      { freq: 261.6, amp: 0.26, decay: 3.2, vibratoDepth: 0.6 },    // C4 - Quãng 8 ấm
      { freq: 392.0, amp: 0.15, decay: 2.6, vibratoDepth: 0.8 },    // G4 - Họa âm bậc 5
      { freq: 523.25, amp: 0.09, decay: 2.0, vibratoDepth: 1.1 },   // C5 - Ánh đồng ngân cao
    ];

    partials.forEach(({ freq, amp, decay, vibratoDepth }) => {
      const osc = ctx.createOscillator();
      const partialGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // LFO tạo độ ngân rung (vibrato) uy nghiêm của chuông đồng lớn
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(4.2, now);
      lfoGain.gain.setValueAtTime(vibratoDepth, now);

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      partialGain.gain.setValueAtTime(0.0001, now);
      partialGain.gain.linearRampToValueAtTime(amp, now + 0.018);
      partialGain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(partialGain);
      partialGain.connect(masterBellGain);

      osc.start(now);
      lfo.start(now);
      osc.stop(now + duration + 0.05);
      lfo.stop(now + duration + 0.05);
    });

    // Tiếng chày gỗ lớn thỉnh vào thành chuông đồng ở khoảnh khắc đầu
    const strikeOsc = ctx.createOscillator();
    const strikeGain = ctx.createGain();
    strikeOsc.type = 'triangle';
    strikeOsc.frequency.setValueAtTime(98, now);
    strikeOsc.frequency.exponentialRampToValueAtTime(58, now + 0.14);

    strikeGain.gain.setValueAtTime(0.32, now);
    strikeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    strikeOsc.connect(strikeGain);
    strikeGain.connect(masterBellGain);

    strikeOsc.start(now);
    strikeOsc.stop(now + 0.18);
  } catch {
    // Bỏ qua lỗi âm thanh
  }
}

/**
 * Tiếng chuông khánh / chuông xoay Tây Tạng thanh tao (880Hz + 1320Hz) khi dâng hương lễ Phật.
 */
export function playIncenseChimeSound(): void {
  if (!soundEffectsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const chimeDuration = 2.2;

    const chimePartials = [
      { freq: 880, amp: 0.24, decay: 2.2 },     // A5 - Âm khánh chính
      { freq: 881.8, amp: 0.1, decay: 2.0 },    // Độ ngân xoay nhẹ của chuông Tây Tạng
      { freq: 1320, amp: 0.16, decay: 1.7 },    // E6 - Họa âm thanh khiết
      { freq: 2640, amp: 0.05, decay: 0.9 },    // E7 - Ánh kim lấp lánh đầu nốt
    ];

    chimePartials.forEach(({ freq, amp, decay }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + chimeDuration + 0.05);
    });
  } catch {
    // Bỏ qua lỗi âm thanh
  }
}

/**
 * Tiếng lắc ống xăm tre lách cách (4 nhịp gỗ/tre liên tiếp).
 */
export function playFortuneShakeSound(): void {
  if (!soundEffectsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const baseTime = ctx.currentTime;
    const shakeOffsets = [0, 0.095, 0.185, 0.28];
    const bambooFrequencies = [720, 860, 680, 910];

    shakeOffsets.forEach((offset, idx) => {
      const startTime = baseTime + offset;
      const baseFreq = bambooFrequencies[idx % bambooFrequencies.length];

      // Âm thanh thanh tre rỗng va vào thành ống
      const bambooOsc = ctx.createOscillator();
      const bambooFilter = ctx.createBiquadFilter();
      const bambooGain = ctx.createGain();

      bambooOsc.type = 'triangle';
      bambooOsc.frequency.setValueAtTime(baseFreq, startTime);
      bambooOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.72, startTime + 0.048);

      bambooFilter.type = 'bandpass';
      bambooFilter.frequency.setValueAtTime(baseFreq * 1.1, startTime);
      bambooFilter.Q.setValueAtTime(3.6, startTime);

      bambooGain.gain.setValueAtTime(0.001, startTime);
      bambooGain.gain.linearRampToValueAtTime(0.28, startTime + 0.004);
      bambooGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.055);

      bambooOsc.connect(bambooFilter);
      bambooFilter.connect(bambooGain);
      bambooGain.connect(ctx.destination);

      bambooOsc.start(startTime);
      bambooOsc.stop(startTime + 0.06);

      // Tiếng lách cách tre khô (Noise qua bộ lọc cao)
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = createNoiseBuffer(ctx, 0.045);

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1850 + idx * 180, startTime);
      noiseFilter.Q.setValueAtTime(2.8, startTime);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.18, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.042);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noiseSource.start(startTime);
      noiseSource.stop(startTime + 0.045);
    });
  } catch {
    // Bỏ qua lỗi âm thanh
  }
}

/**
 * Hợp âm ngũ cung thanh tịnh vang lên khi nhận quẻ xăm đầu năm.
 */
export function playFortuneRevealSound(): void {
  if (!soundEffectsEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const baseTime = ctx.currentTime;
    // Chuỗi nốt ngũ cung rải nhẹ từ trầm lên cao (C5 -> D5 -> E5 -> G5 -> A5 -> C6)
    const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

    notes.forEach((freq, index) => {
      const startTime = baseTime + index * 0.065;
      const isFinalNote = index === notes.length - 1;
      const noteDuration = isFinalNote ? 1.85 : 1.15;

      const osc = ctx.createOscillator();
      const overtoneOsc = ctx.createOscillator();
      const gain = ctx.createGain();
      const overtoneGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      overtoneOsc.type = 'triangle';
      overtoneOsc.frequency.setValueAtTime(freq * 2, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(isFinalNote ? 0.22 : 0.15, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

      overtoneGain.gain.setValueAtTime(0.045, startTime);
      overtoneGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration * 0.55);

      osc.connect(gain);
      overtoneOsc.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      overtoneOsc.start(startTime);
      osc.stop(startTime + noteDuration + 0.04);
      overtoneOsc.stop(startTime + noteDuration * 0.6);
    });
  } catch {
    // Bỏ qua lỗi âm thanh
  }
}
