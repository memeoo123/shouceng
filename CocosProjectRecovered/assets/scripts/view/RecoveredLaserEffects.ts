import type { FairyMovieClipFrameLayout } from './FairyMovieClipSequence.ts';

export type RecoveredLaserLevel = 1 | 2 | 3 | 4;

export interface RecoveredLaserEffect {
  width: number;
  height: number;
  intervalSeconds: number;
  referenceBeamWidth: number;
  framePaths: string[];
  layouts: FairyMovieClipFrameLayout[];
}

const frame = (offsetX: number, offsetY: number, width: number, height: number): FairyMovieClipFrameLayout => ({
  offsetX,
  offsetY,
  width,
  height,
  addDelayMilliseconds: 0,
});

const layouts: FairyMovieClipFrameLayout[] = [
  frame(78, 69, 402, 97),
  frame(78, 70, 401, 95),
  frame(42, 70, 426, 95),
  frame(40, 70, 441, 95),
  frame(0, 69, 475, 97),
  frame(62, 69, 408, 97),
  frame(78, 69, 388, 97),
  frame(51, 69, 421, 97),
  frame(78, 69, 400, 97),
  frame(78, 69, 388, 97),
  frame(5, 69, 473, 97),
  frame(78, 69, 401, 97),
  frame(0, 69, 479, 97),
  frame(78, 70, 394, 95),
  frame(22, 70, 450, 95),
];

const config = (level: RecoveredLaserLevel): RecoveredLaserEffect => ({
  width: 556,
  height: 232,
  intervalSeconds: 0.083,
  referenceBeamWidth: 402,
  framePaths: Array.from(
    { length: 15 },
    (_, index) => `original/effects/laser${level}/Laser${level}-${index < 10 ? `0${index}` : index}`,
  ),
  layouts,
});

export const RECOVERED_LASER_EFFECTS: Record<RecoveredLaserLevel, RecoveredLaserEffect> = {
  1: config(1),
  2: config(2),
  3: config(3),
  4: config(4),
};
