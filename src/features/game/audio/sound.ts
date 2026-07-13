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
 * The music.
 *
 * The old loop was one sine note every 900ms over a low root that landed every
 * fourth beat and rang for a second and a half. That long low note under a
 * plodding melody is what made it feel like a bass pulse: there was nothing else
 * in it, and it never changed. So it is gone, and there is no drone anywhere in
 * here now.
 *
 * What replaced it is a small band rather than a metronome:
 *
 *  - a **chord progression** that rotates through four different sequences, so
 *    the harmony has somewhere to go instead of sitting on one root
 *  - a **melody** that random-walks a pentatonic scale on a real rhythm, with
 *    rests, and lands on a chord tone on the strong beats so it always resolves
 *  - light **chord stabs** on the off-beat, which is where the lift comes from
 *  - a **shaker** on the eighths instead of a bass drum, which keeps it moving
 *    without putting anything heavy underneath
 *  - a **bassline** that is short, plucked and quiet, up around 130-220Hz rather
 *    than down in the sub, so you feel the root without it thumping
 *
 * Bars are scheduled a bar ahead against the audio clock, not fired off a bare
 * setInterval, because setInterval drifts and a drifting beat is worse than no
 * beat at all.
 */

const BPM = 112;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const BAR = BEAT * 4;

/** MIDI note to Hz. */
function hz(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12);
}

type Chord = { root: number; minor: boolean };

const maj = (root: number): Chord => ({ root, minor: false });
const min = (root: number): Chord => ({ root, minor: true });

/**
 * Four progressions in C, all of them cheerful. The loop walks through them in
 * turn, so you have to listen for sixteen bars before anything repeats.
 */
const PROGRESSIONS: Chord[][] = [
  [maj(60), maj(67), min(69), maj(65)],
  [min(69), maj(65), maj(60), maj(67)],
  [maj(65), maj(67), maj(60), min(69)],
  [maj(60), min(64), maj(65), maj(67)],
];

/** Which eighths of the bar carry a melody note. Rests are as important as notes. */
const RHYTHMS = [
  [1, 0, 1, 1, 0, 1, 0, 1],
  [1, 1, 0, 1, 0, 1, 1, 0],
  [1, 0, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1],
  [0, 1, 1, 0, 1, 1, 0, 1],
];

/** C major pentatonic across two octaves. There is no wrong note in here. */
const PENTATONIC = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93];

function chordTones(chord: Chord) {
  return [chord.root, chord.root + (chord.minor ? 3 : 4), chord.root + 7];
}

/** The pentatonic note nearest a chord tone, so strong beats resolve. */
function snapToChord(index: number, chord: Chord) {
  const tones = chordTones(chord).map((tone) => tone % 12);

  for (let step = 0; step < PENTATONIC.length; step += 1) {
    for (const candidate of [index - step, index + step]) {
      if (
        candidate >= 0 &&
        candidate < PENTATONIC.length &&
        tones.includes(PENTATONIC[candidate] % 12)
      ) {
        return candidate;
      }
    }
  }

  return index;
}

/** A short noise burst through a highpass: a shaker, near enough. */
function shaker(context: AudioContext, at: number, gain: number, to: AudioNode) {
  const length = Math.floor(context.sampleRate * 0.05);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 6000;

  const env = context.createGain();
  env.gain.value = gain;

  source.connect(filter);
  filter.connect(env);
  env.connect(to);
  source.start(at);
  source.stop(at + 0.06);
}

function startMusic() {
  const active = ensureEngine();

  if (!active || active.musicTimer !== null) {
    return;
  }

  const { context, musicGain } = active;

  let bar = 0;
  /** Where the melody currently sits in the pentatonic. It walks; it does not jump. */
  let melodyIndex = 4;
  let nextBarAt = context.currentTime + 0.15;

  const scheduleBar = () => {
    const progression = PROGRESSIONS[Math.floor(bar / 4) % PROGRESSIONS.length];
    const chord = progression[bar % 4];
    const rhythm = RHYTHMS[bar % RHYTHMS.length];
    const tones = chordTones(chord);

    // Bass: short and plucked, an octave up from where a bassline would normally
    // sit. Present, but nothing to lean on.
    for (const eighth of [0, 3, 6]) {
      blip(
        nextBarAt + eighth * EIGHTH,
        hz(chord.root - 12),
        0.16,
        "triangle",
        0.05,
        musicGain,
      );
    }

    for (let eighth = 0; eighth < 8; eighth += 1) {
      const at = nextBarAt + eighth * EIGHTH;

      // Shaker on every eighth, accented on the off-beats. This is the engine of
      // the thing: it is what makes it feel quick rather than heavy.
      shaker(context, at, eighth % 2 === 1 ? 0.05 : 0.025, musicGain);

      // Chord stabs pushed onto the off-beat.
      if (eighth === 1 || eighth === 5) {
        for (const tone of tones) {
          blip(at, hz(tone), 0.22, "triangle", 0.035, musicGain);
        }
      }

      if (!rhythm[eighth]) {
        continue;
      }

      // Wander, mostly by a step, occasionally by a leap.
      const move = Math.random() < 0.18 ? 2 : 1;
      melodyIndex += Math.random() < 0.5 ? -move : move;
      melodyIndex = Math.min(PENTATONIC.length - 1, Math.max(0, melodyIndex));

      // On the strong beats, land somewhere that belongs to the chord.
      if (eighth === 0 || eighth === 4) {
        melodyIndex = snapToChord(melodyIndex, chord);
      }

      blip(
        at,
        hz(PENTATONIC[melodyIndex]),
        eighth === 0 ? 0.42 : 0.26,
        "triangle",
        0.085,
        musicGain,
      );
    }

    nextBarAt += BAR;
    bar += 1;
  };

  // Two bars in hand, then top up. Scheduling against the audio clock rather
  // than firing notes straight off the timer is what keeps the beat steady when
  // the main thread is busy drawing a park.
  scheduleBar();
  scheduleBar();

  active.musicTimer = window.setInterval(() => {
    if (!enabled || !engine) {
      return;
    }

    // A backgrounded tab freezes the timer while the audio clock runs on. Coming
    // back to a schedule that is minutes in the past would fire every missed bar
    // at once, so give up on the past and start again from now.
    if (nextBarAt < engine.context.currentTime) {
      nextBarAt = engine.context.currentTime + 0.1;
    }

    while (nextBarAt < engine.context.currentTime + BAR * 2) {
      scheduleBar();
    }
  }, (BAR * 1000) / 2);
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
