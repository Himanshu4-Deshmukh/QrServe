"use client";

let audioContext: AudioContext | null = null;
let unlocked = false;

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

export async function playOrderNotificationSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return;
    }
  }

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
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

  createOsc(880, now, now + 0.18, "sine");
  createOsc(1320, now + 0.08, now + 0.28, "sine");
  createOsc(1040, now + 0.26, now + 0.48, "triangle");
}
