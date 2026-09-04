import type { FairyMovieClipFrameLayout } from './FairyMovieClipSequence.ts';

export type RecoveredAirSupportEffectId = 'freeze' | 'healing' | 'artillery-fire' | 'meteor-projectile';

export interface RecoveredAirSupportEffect {
  width: number;
  height: number;
  intervalSeconds: number;
  pivotX: number;
  pivotY: number;
  scale: number;
  loop: boolean;
  framePaths: Array<string | null>;
  layouts: FairyMovieClipFrameLayout[];
}

const frame = (offsetX: number, offsetY: number, width: number, height: number): FairyMovieClipFrameLayout => ({
  offsetX,
  offsetY,
  width,
  height,
  addDelayMilliseconds: 0,
});

const paths = (folder: string, count: number, start = 0): string[] => Array.from(
  { length: count },
  (_, index) => {
    const value = index + start;
    return `original/effects/${folder}/${folder}-${value < 10 ? `0${value}` : value}`;
  },
);

export const RECOVERED_AIR_SUPPORT_EFFECTS: Record<RecoveredAirSupportEffectId, RecoveredAirSupportEffect> = {
  freeze: {
    width: 243,
    height: 243,
    intervalSeconds: 0.083,
    pivotX: 0.5,
    pivotY: 0.5,
    scale: 1,
    loop: true,
    framePaths: paths('freeze', 1),
    layouts: [frame(74, 5, 95, 127)],
  },
  healing: {
    width: 62,
    height: 199,
    intervalSeconds: 0.083,
    pivotX: 0.5,
    pivotY: 0.63,
    scale: 2,
    loop: false,
    framePaths: [null, ...paths('healing', 17, 1)],
    layouts: [
      frame(31, 99, 0, 0),
      frame(0, 95, 38, 87),
      frame(0, 84, 38, 85),
      frame(0, 72, 57, 85),
      frame(0, 60, 58, 84),
      frame(0, 48, 59, 127),
      frame(3, 60, 57, 96),
      frame(3, 47, 57, 103),
      frame(3, 37, 57, 106),
      frame(3, 29, 58, 118),
      frame(8, 46, 53, 81),
      frame(8, 44, 53, 79),
      frame(8, 30, 53, 82),
      frame(8, 19, 50, 81),
      frame(8, 10, 50, 85),
      frame(10, 38, 48, 38),
      frame(10, 26, 48, 50),
      frame(56, 14, 2, 39),
    ],
  },
  'artillery-fire': {
    width: 267,
    height: 240,
    intervalSeconds: 0.083,
    pivotX: 0.5,
    pivotY: 0.8,
    scale: 1.7,
    loop: false,
    framePaths: paths('artillery-fire', 10),
    layouts: [
      frame(44, 102, 173, 115),
      frame(34, 81, 205, 133),
      frame(31, 28, 214, 183),
      frame(31, 28, 214, 183),
      frame(29, 28, 210, 184),
      frame(25, 28, 213, 183),
      frame(25, 22, 211, 189),
      frame(23, 17, 215, 192),
      frame(20, 14, 218, 192),
      frame(104, 10, 65, 135),
    ],
  },
  'meteor-projectile': {
    width: 173,
    height: 65,
    intervalSeconds: 0.083,
    pivotX: 0.5,
    pivotY: 0.5,
    scale: 1.8,
    loop: true,
    framePaths: paths('meteor-projectile', 7),
    layouts: [
      frame(5, 3, 163, 59),
      frame(3, 3, 165, 59),
      frame(32, 4, 137, 58),
      frame(25, 4, 144, 58),
      frame(22, 3, 146, 60),
      frame(20, 3, 149, 60),
      frame(27, 3, 142, 60),
    ],
  },
};
