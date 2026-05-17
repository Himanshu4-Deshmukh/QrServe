"use client";

let audioContext: AudioContext | null = null;
let unlocked = false;
const activeAlerts = new Map<string, number>();

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioContext) {
    const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
  }
  return audioContext;
}

export async function unlockNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx || unlocked) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }
  unlocked = true;
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }

  return ctx;
}

function playAlertBurst(ctx: AudioContext) {
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.9, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.7, now + 0.12);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
  gain.connect(ctx.destination);

  const createOsc = (frequency: number, start: number, stop: number, type: OscillatorType = "sine", detune = 0) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    osc.detune.setValueAtTime(detune, start);
    osc.connect(gain);
    osc.start(start);
    osc.stop(stop);
  };

  createOsc(988, now, now + 0.14, "square");
  createOsc(1318, now + 0.12, now + 0.28, "square");
  createOsc(988, now + 0.28, now + 0.42, "square");
}

export async function playOrderNotificationSound(orderId: string) {
  if (activeAlerts.has(orderId)) return;

  const ctx = await ensureAudioReady();
  if (!ctx) return;

  playAlertBurst(ctx);

  const timer = window.setInterval(() => {
    if (audioContext?.state !== "running") return;
    playAlertBurst(ctx);
  }, 1100);

  activeAlerts.set(orderId, timer);
}

export function stopOrderNotificationSound(orderId: string) {
  const timer = activeAlerts.get(orderId);
  if (timer == null) return;

  window.clearInterval(timer);
  activeAlerts.delete(orderId);
}

export function stopAllOrderNotificationSounds() {
  for (const timer of Array.from(activeAlerts.values())) {
    window.clearInterval(timer);
  }
  activeAlerts.clear();
}
