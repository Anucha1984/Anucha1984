// Procedural ambience bed, synthesised by ffmpeg (lavfi) — no asset files.
// One character per genre: ghost = eerie low drone, folktale = warm soft pad, cdrama = tense pulse.
import { num } from './util.js';

const TAU = '2*PI*t';
const sine = (hz, amp, extra = '') => `${amp}*sin(${hz}*${TAU}${extra})`;
/** slow 0..1 "breathing" envelope */
const lfo = (hz, phase = 0, lo = 0) => `(${lo}+${num(1 - lo)}*(0.5+0.5*sin(${hz}*${TAU}+${phase})))`;

const BEDS = {
  ghost: {
    // detuned minor drone on A with a wandering high whistle + filtered "wind"
    left: [
      `${sine(110, 0.3)}*${lfo(0.07, 0, 0.6)}`,
      sine(110.7, 0.2),
      `${sine(164.8, 0.14)}*${lfo(0.11, 1, 0.3)}`,
      `${sine(220.9, 0.07)}*${lfo(0.05, 2)}`,
      `${sine(1244, 0.012, '+5*sin(0.21*2*PI*t)')}*${lfo(0.04, 4)}`,
    ],
    right: [
      `${sine(110.4, 0.3)}*${lfo(0.07, 0.6, 0.6)}`,
      sine(109.6, 0.2),
      `${sine(155.6, 0.12)}*${lfo(0.09, 2.2, 0.3)}`,
      `${sine(220.3, 0.07)}*${lfo(0.05, 3.1)}`,
      `${sine(1318, 0.01, '+5*sin(0.17*2*PI*t)')}*${lfo(0.03, 1)}`,
    ],
    noise: { color: 'brown', amp: 0.5, low: 520, trem: 0.13 },
    post: 'lowpass=f=2400,aecho=0.8:0.7:420|730:0.35|0.22',
  },
  folktale: {
    // C major ↔ A minor pad (C3 G3 C4 E4 + G4/A4 swapping), every partial breathing at its own pace
    left: [
      `${sine(130.81, 0.2)}*${lfo(0.05, 0, 0.6)}`,
      `${sine(196.0, 0.15)}*${lfo(0.08, 1, 0.3)}`,
      `${sine(261.63, 0.14)}*${lfo(0.11, 2, 0.3)}`,
      `${sine(329.63, 0.1)}*${lfo(0.07, 3, 0.2)}`,
      `${sine(392.0, 0.07)}*${lfo(0.0625, 0)}`,
      `${sine(440.0, 0.07)}*${lfo(0.0625, 3.1416)}`,
      `${sine(523.25, 0.03)}*${lfo(0.13, 5)}`,
    ],
    right: [
      `${sine(131.2, 0.2)}*${lfo(0.05, 0.8, 0.6)}`,
      `${sine(196.5, 0.15)}*${lfo(0.08, 1.9, 0.3)}`,
      `${sine(262.1, 0.14)}*${lfo(0.1, 2.5, 0.3)}`,
      `${sine(330.2, 0.1)}*${lfo(0.075, 4, 0.2)}`,
      `${sine(392.6, 0.07)}*${lfo(0.0625, 0)}`,
      `${sine(440.7, 0.07)}*${lfo(0.0625, 3.1416)}`,
      `${sine(659.3, 0.02)}*${lfo(0.09, 1)}`,
    ],
    post: 'lowpass=f=3200,aecho=0.8:0.6:300|520:0.3|0.2',
  },
  cdrama: {
    // heartbeat-like low pulse (100 bpm) under a sustained minor-second "strings" cluster
    left: [
      `${sine(98, 0.42)}*exp(-9*mod(t\\,0.6))`,
      `${sine(196, 0.14)}*exp(-14*mod(t\\,0.6))`,
      `${sine(73.42, 0.16)}*${lfo(0.06, 0, 0.6)}`,
      `${sine(146.83, 0.1)}*${lfo(0.09, 2, 0.4)}`,
      `${sine(466.16, 0.035)}*${lfo(5.5, 0, 0.7)}*${lfo(0.05, 1, 0.2)}`,
      `${sine(493.88, 0.03)}*${lfo(6.1, 1, 0.7)}*${lfo(0.04, 3, 0.2)}`,
    ],
    right: [
      `${sine(98.3, 0.42)}*exp(-9*mod(t\\,0.6))`,
      `${sine(196.4, 0.14)}*exp(-14*mod(t\\,0.6))`,
      `${sine(73.6, 0.16)}*${lfo(0.06, 0.7, 0.6)}`,
      `${sine(147.2, 0.1)}*${lfo(0.09, 2.8, 0.4)}`,
      `${sine(466.9, 0.035)}*${lfo(5.8, 2, 0.7)}*${lfo(0.05, 2, 0.2)}`,
      `${sine(494.5, 0.03)}*${lfo(5.9, 0, 0.7)}*${lfo(0.04, 4, 0.2)}`,
    ],
    post: 'lowpass=f=2800,aecho=0.8:0.5:180|340:0.25|0.15',
  },
};

export const musicCharacter = (genre) => (BEDS[genre] ? genre : 'folktale');

/**
 * Filtergraph fragment producing a stereo 44.1 kHz bed of `duration` seconds on pad [out].
 * (Not yet level-adjusted or ducked — compose.js does that.)
 */
export function musicGraph(genre, duration, out = 'bed') {
  const bed = BEDS[musicCharacter(genre)];
  const d = num(duration + 0.5, 3);
  const parts = [];
  const tone = `aevalsrc=exprs='${bed.left.join('+')}|${bed.right.join('+')}':s=44100:d=${d}`;
  if (bed.noise) {
    parts.push(`${tone}[bed_t]`);
    parts.push(
      `anoisesrc=color=${bed.noise.color}:amplitude=${bed.noise.amp}:r=44100:d=${d}:seed=7,` +
        `lowpass=f=${bed.noise.low},highpass=f=120,tremolo=f=${bed.noise.trem}:d=0.8,aformat=channel_layouts=stereo[bed_n]`,
    );
    parts.push(`[bed_t][bed_n]amix=inputs=2:normalize=0,${bed.post}[${out}]`);
  } else parts.push(`${tone},${bed.post}[${out}]`);
  return parts.join(';');
}
