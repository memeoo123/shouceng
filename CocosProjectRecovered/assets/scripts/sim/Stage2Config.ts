export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1286;
export const PREPARATION_SHIFT = 337;
export const GRID_X = 44;
export const GRID_Y = 97;
export const CELL_SIZE = 92;
export const CELL_GAP = 3;
export const CELL_STEP = CELL_SIZE + CELL_GAP;

export type CellValue = 'o' | '1' | '2';

export interface ShopDefinition {
  id: 'e02' | 'e07' | 'e16';
  level: number;
  sprite: string;
  shape: ReadonlyArray<readonly [number, number]>;
}

export const STAGE2_MAP: ReadonlyArray<string> = [
  'ooooooo',
  'ooooooo',
  'ooooooo',
  'o22222o',
  'o21111o',
  '2111112',
  '1111112',
  '1111112',
  '1111112',
];

export const STAGE2_WAVE_COUNTS = [3, 4, 7, 9, 12] as const;

export const OPENING_SHOP: ReadonlyArray<ShopDefinition> = [
  {
    id: 'e02',
    level: 2,
    sprite: 'original/buildings/Building_Shooter2',
    shape: [[0, 0], [0, 1], [0, 2]],
  },
  {
    id: 'e07',
    level: 1,
    sprite: 'original/buildings/Building_ArrowTower1',
    shape: [[0, 0]],
  },
  {
    id: 'e16',
    level: 1,
    sprite: 'original/buildings/Building_Fence11',
    shape: [[0, 0]],
  },
];

export const CASTLE = {
  column: 2,
  row: 7,
  width: 3,
  height: 2,
  hp: 975,
} as const;

export function cellKey(column: number, row: number): string {
  return `${column}_${row}`;
}

export function isInsideGrid(column: number, row: number): boolean {
  return column >= 0 && column < 7 && row >= 0 && row < 9;
}

export function isCastleCell(column: number, row: number): boolean {
  return column >= CASTLE.column && column < CASTLE.column + CASTLE.width
    && row >= CASTLE.row && row < CASTLE.row + CASTLE.height;
}

export function isBuildable(map: ReadonlyArray<string>, column: number, row: number): boolean {
  return isInsideGrid(column, row) && map[row][column] === '1' && !isCastleCell(column, row);
}
