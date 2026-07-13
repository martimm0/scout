/**
 * Sound, synthesized in the browser.
 *
 * No audio files. Everything here is oscillators and envelopes through the Web
 * Audio API — which means no assets to license, nothing to download, and a
 * chiptune character that matches the voxel art without anybody having to make
 * it match. It also means the whole soundtrack costs a few kilobytes of code.
 *
 * Audio starts OFF. Browsers block sound before a user gesture anyway, and a
 * game that makes noise the instant it loads is a game people mute permanently.
 */

export type SoundName =
  | "tap"
  | "discover"
  | "pollinateSuccess"
  | "pollinateFail"
  | "badge"
  | "ui"
  | "wing";

type Engine = {
  context: AudioContext;
  master: GainNode;
  musicGain: GainNode;
  ambienceGain: GainNode;
  musicTimer: number | null;
  ambience: OscillatorNode[];
};

let engine: Engine | null = null;
let enabled = false;
let volume = 0.6;

function ensureEngine(): Engine | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (engine) {
    return engine;
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;

  if (!Ctor) {
    return null;
  }

  const context = new Ctor();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const musicGain = context.createGain();
  musicGain.gain.value = 0.18;
  musicGain.connect(master);

  const ambienceGain = context.createGain();
  ambienceGain.gain.value = 0.1;
  ambienceGain.connect(master);

  engine = {
    context,
    master,
    musicGain,
    ambienceGain,
    musicTimer: null,
    ambience: [],
  };

  return engine;
}

/** A single plucked note with an exponential decay. The building block. */
function blip(
  at: number,
  frequency: number,
  duration: number,
  type: OscillatorType,
  gain: number,
  destination: AudioNode,
) {
  const context = destination.context as AudioContext;
  const osc = context.createOscillator();
  const env = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);

  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(env);
  env.connect(destination);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

export function setSoundEnabled(on: boolean) {
  enabled = on;

  const active = ensureEngine();

  if (!active) {
    return;
  }

  void active.context.resume();

  const now = active.context.currentTime;
  active.master.gain.cancelScheduledValues(now);
  active.master.gain.setValueAtTime(active.master.gain.value, now);
  active.master.gain.linearRampToValueAtTime(on ? volume : 0, now + 0.35);

  if (on) {
    startMusic();
  } else {
    stopMusic();
  }
}

export function setVolume(next: number) {
  volume = Math.min(1, Math.max(0, next));

  const active = ensureEngine();

  if (!active || !enabled) {
    return;
  }

  const now = active.context.currentTime;
  active.master.gain.linearRampToValueAtTime(volume, now + 0.1);
}

export function playSound(name: SoundName) {
  if (!enabled) {
    return;
  }

  const active = ensureEngine();

  if (!active) {
    return;
  }

  const { context, master } = active;
  const now = context.currentTime;

  switch (name) {
    case "tap":
      blip(now, 660, 0.07, "square", 0.12, master);
      break;

    case "discover":
      // A little rising three-note phrase: "oh, what's that."
      blip(now, 523, 0.1, "triangle", 0.16, master);
      blip(now + 0.09, 659, 0.1, "triangle", 0.16, master);
      blip(now + 0.18, 784, 0.18, "triangle", 0.16, master);
      break;

    case "pollinateSuccess":
      // A major arpeggio, resolving upward. Unambiguously good news.
      blip(now, 523, 0.12, "triangle", 0.2, master);
      blip(now + 0.1, 659, 0.12, "triangle", 0.2, master);
      blip(now + 0.2, 784, 0.12, "triangle", 0.2, master);
      blip(now + 0.3, 1046, 0.3, "triangle", 0.22, master);
      break;

    case "pollinateFail":
      // Soft, low, and short. Disappointed, never harsh — this is not a buzzer,
      // because failing to pollinate a flower is not a mistake.
      blip(now, 330, 0.16, "sine", 0.14, master);
      blip(now + 0.13, 262, 0.26, "sine", 0.12, master);
      break;

    case "badge":
      blip(now, 784, 0.1, "square", 0.14, master);
      blip(now + 0.09, 988, 0.1, "square", 0.14, master);
      blip(now + 0.18, 1319, 0.34, "square", 0.16, master);
      break;

    case "ui":
      blip(now, 440, 0.05, "square", 0.08, master);
      break;

    case "wing":
      blip(now, 180, 0.05, "sawtooth", 0.05, master);
      break;
  }
}

/**
 * The music loop: a slow, wandering pentatonic figure. Pentatonic because it
 * cannot land on a wrong note, so a loop this short never turns grating.
 */
const SCALE = [392, 440, 523, 587, 659, 784, 880];

function startMusic() {
  const active = ensureEngine();

  if (!active || active.musicTimer !== null) {
    return;
  }

  let step = 0;

  const play = () => {
    if (!enabled || !engine) {
      return;
    }

    const now = engine.context.currentTime;
    const note = SCALE[(step * 3) % SCALE.length];

    blip(now, note, 0.9, "sine", 0.1, engine.musicGain);

    // A low root every fourth beat, to hold it down.
    if (step % 4 === 0) {
      blip(now, 196, 1.6, "triangle", 0.08, engine.musicGain);
    }

    step += 1;
  };

  play();
  active.musicTimer = window.setInterval(play, 900);
}

function stopMusic() {
  if (!engine || engine.musicTimer === null) {
    return;
  }

  window.clearInterval(engine.musicTimer);
  engine.musicTimer = null;
}

/**
 * Per-area ambience: a drone whose pitch and texture shift with where you are.
 * Deep and close under the canopy, bright and open on the meadow, with a hint of
 * running water down in the creek.
 */
const AMBIENCE: Record<string, { base: number; type: OscillatorType }> = {
  "environmental-center": { base: 220, type: "sine" },
  "blue-slide": { base: 262, type: "sine" },
  "bowling-green": { base: 247, type: "sine" },
  "nine-mile-run": { base: 165, type: "triangle" },
  "falls-ravine": { base: 147, type: "triangle" },
  "fern-hollow": { base: 131, type: "triangle" },
};

let currentArea: string | null = null;

export function setAreaAmbience(areaId: string) {
  if (areaId === currentArea) {
    return;
  }

  currentArea = areaId;

  const active = ensureEngine();

  if (!active || !enabled) {
    return;
  }

  for (const osc of active.ambience) {
    try {
      osc.stop();
    } catch {
      // Already stopped. Nothing to do.
    }
  }

  active.ambience = [];

  const preset = AMBIENCE[areaId] ?? AMBIENCE["environmental-center"];
  const { context, ambienceGain } = active;
  const now = context.currentTime;

  // Two oscillators, detuned a hair. The beat between them is what makes a
  // drone sound like a place instead of a test tone.
  for (const detune of [-4, 4]) {
    const osc = context.createOscillator();
    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.base, now);
    osc.detune.setValueAtTime(detune, now);
    osc.connect(ambienceGain);
    osc.start(now);
    active.ambience.push(osc);
  }
}

export function stopAllAudio() {
  stopMusic();

  if (!engine) {
    return;
  }

  for (const osc of engine.ambience) {
    try {
      osc.stop();
    } catch {
      // Already stopped.
    }
  }

  engine.ambience = [];
  currentArea = null;
}
