export const DESIGN_WIDTH = 750;
export const DESIGN_HEIGHT = 1286;
export const PREPARATION_SHIFT = 337;
export const GRID_X = 44;
export const GRID_Y = 97;
export const CELL_SIZE = 92;
export const CELL_GAP = 3;
export const CELL_STEP = CELL_SIZE + CELL_GAP;
export const MAX_SYNTH_LEVEL = 4;

export type CellValue = 'o' | '1' | '2';

export function fitBuildingVisualSize(nativeWidth: number, nativeHeight: number, boxWidth: number, boxHeight: number): { width: number; height: number; scale: number } {
  const scale = Math.min(1, boxWidth / nativeWidth, boxHeight / nativeHeight);
  return { width: nativeWidth * scale, height: nativeHeight * scale, scale };
}

export interface ShopDefinition {
  id: 'e01' | 'e02' | 'e03' | 'e04' | 'e05' | 'e06' | 'e07' | 'e08' | 'e09' | 'e10' | 'e11' | 'e12' | 'e13' | 'e14' | 'e15' | 'e16' | 'e17' | 'e18' | `slot-${string}`;
  level: number;
  sprite: string;
  weaponMount?: {
    sprite: string;
    x: number;
    y: number;
    pivot: readonly [number, number];
    rotationDegrees: number;
  };
  visualOffsetY?: number;
  shape: ReadonlyArray<readonly [number, number]>;
  kind: 'barracks' | 'defense' | 'economy' | 'support' | 'wall' | 'slot';
  hitPoints: number;
  attack?: number;
  cooldownSeconds?: number;
  rangePixels?: number;
  criticalChance?: number;
  criticalDamage?: number;
  projectileSpeedPixels?: number;
  projectileWidth?: number;
  projectileHeight?: number;
  splashRadiusPixels?: number;
  splashDamageRatio?: number;
  forceTargetOnly?: boolean;
  jumpCount?: number;
  projectileLifeTimeSeconds?: number;
  projectileColor?: readonly [number, number, number, number];
  laserDurationSeconds?: number;
  laserTickIntervalSeconds?: number;
  experienceBonus?: number;
  moneyPerWave?: number;
  enemySlowAmount?: number;
  globalCriticalChanceBonus?: number;
  adjacentAttackSpeedBonus?: number;
  adjacentAttackBonus?: number;
  summonCooldownSeconds?: number;
  summonBody?: UnitBody;
  summonUnitMax?: number;
  slotShapeId?: string;
  shopWeight?: number;
  needAd?: boolean;
}

export function canSynthesizeBuildings(source: ShopDefinition | null | undefined, target: ShopDefinition | null | undefined): boolean {
  return !!source && !!target && source.kind !== 'slot' && target.kind !== 'slot'
    && source.id === target.id && source.level === target.level && target.level < MAX_SYNTH_LEVEL;
}

export function upgradeShopDefinition(definition: ShopDefinition): ShopDefinition | null {
  if (definition.kind === 'slot' || definition.level >= MAX_SYNTH_LEVEL) return null;
  const level = definition.level + 1;
  if (definition.id === 'e01' || definition.id === 'e02' || definition.id === 'e03' || definition.id === 'e04' || definition.id === 'e05' || definition.id === 'e06') {
    const cooldowns = definition.id === 'e01'
      ? [0, 10, 8, 7, 6]
      : definition.id === 'e03'
        ? [0, 13, 10.4, 9.1, 7.8]
      : definition.id === 'e04'
        ? [0, 11, 8.8, 7.7, 6.6]
      : definition.id === 'e05'
        ? [0, 11, 8.8, 7.7, 6.6]
      : [0, 9, 7.2, 6.3, 5.4];
    const body = definition.id === 'e01'
      ? 'Mauler'
      : definition.id === 'e02'
        ? 'Shooter'
        : definition.id === 'e03'
          ? 'Knight'
        : definition.id === 'e04'
          ? 'Crossbowman'
        : definition.id === 'e05'
          ? 'Mage'
          : 'Swordsman';
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_${body}${level}`,
      summonCooldownSeconds: cooldowns[level],
      summonUnitMax: level * 2,
    };
  }
  if (definition.id === 'e07') {
    const attacks = [0, 20, 30, 46, 70];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_ArrowTower${level}`,
      attack: attacks[level],
      weaponMount: definition.weaponMount ? {
        ...definition.weaponMount,
        sprite: `original/buildings/Building_ArrowTower${level}_up`,
      } : undefined,
    };
  }
  if (definition.id === 'e08') {
    const attacks = [0, 60, 90, 138, 210];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_Trebuchet${level}`,
      attack: attacks[level],
      weaponMount: definition.weaponMount ? {
        ...definition.weaponMount,
        sprite: `original/buildings/Building_Trebuchet${level}_up`,
      } : undefined,
    };
  }
  if (definition.id === 'e09') {
    const attacks = [0, 40, 60, 92, 140];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_ElectricityTower${level}`,
      attack: attacks[level],
      weaponMount: definition.weaponMount ? {
        ...definition.weaponMount,
        sprite: `original/buildings/Building_ElectricityTower${level}_up`,
      } : undefined,
    };
  }
  if (definition.id === 'e10') {
    const attacks = [0, 20, 30, 46, 70];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_MirrorTower${level}`,
      attack: attacks[level],
      weaponMount: definition.weaponMount ? {
        ...definition.weaponMount,
        sprite: `original/buildings/Building_MirrorTower${level}_up`,
      } : undefined,
    };
  }
  if (definition.id === 'e11') {
    const bonuses = [0, 0.05, 0.1, 0.2, 0.4];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_ShuiJing${level}`,
      experienceBonus: bonuses[level],
    };
  }
  if (definition.id === 'e12') {
    const slowAmounts = [0, 0.05, 0.075, 0.115, 0.175];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_Well${level}`,
      enemySlowAmount: slowAmounts[level],
    };
  }
  if (definition.id === 'e13') {
    const criticalBonuses = [0, 0.05, 0.075, 0.115, 0.175];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_ObservationDeck${level}`,
      globalCriticalChanceBonus: criticalBonuses[level],
    };
  }
  if (definition.id === 'e14') {
    const speedBonuses = [0, 0.05, 0.075, 0.115, 0.175];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_Statue${level}`,
      adjacentAttackSpeedBonus: speedBonuses[level],
    };
  }
  if (definition.id === 'e15') {
    // The original table upgrades `Ex.AtkAdd`, while runtime reads `Ex.RoundAtkAdd`.
    // Preserve that shipped behavior: synthesis changes the sprite but leaves the aura at 5%.
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_MartialArtsField${level}`,
      adjacentAttackBonus: 0.05,
    };
  }
  if (definition.id === 'e17') {
    const hpMultipliers = [0, 1, 1.5, 2.3, 3.5];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_Fence2${level}`,
      hitPoints: 507 * hpMultipliers[level],
    };
  }
  if (definition.id === 'e18') {
    const moneyByLevel = [0, 1, 2, 4, 8];
    return {
      ...definition,
      level,
      sprite: `original/buildings/Building_Mine${level}`,
      moneyPerWave: moneyByLevel[level],
    };
  }
  const hpMultipliers = [0, 1, 1.5, 2.3, 3.5];
  return {
    ...definition,
    level,
    sprite: `original/buildings/Building_Fence1${level}`,
    hitPoints: 169 * hpMultipliers[level],
  };
}

export type UnitBody = 'Swordsman1' | 'Shooter1' | 'Mauler1' | 'Crossbowman1' | 'Knight1' | 'Mage1';
/** Runtime enemy ids come from the recovered 220-stage catalog. */
export type Stage2EnemyId = string;

export interface UnitDefinition {
  id: 'js_9F2D53C8' | 'gb_E916AA75' | 'db_DF32E2C2' | '-b_CD2EDAAF' | 'qb_2B5987F2' | 'fs_18B222C3';
  body: UnitBody;
  hitPoints: number;
  attack: number;
  attackRange: number;
  attackSpeed: number;
  speed: number;
  bulletSpeed: number;
  criticalChance: number;
  criticalDamage: number;
  dodge: number;
  attackFireFrame: number;
  aoeRadiusPixels: number;
}

export interface UnitChargePolicy {
  damageRatio: number;
  speedMultiplier: number;
  repelPhysicsUnitsPerSecond: number;
  repelSeconds: number;
  dizzinessChance: number;
  dizzinessSeconds: number;
}

/** Optional equipment trait 21 (`UnitCharge`); it is not active on a plain Knight. */
export const KNIGHT_CHARGE_TRAIT: Readonly<UnitChargePolicy> = {
  damageRatio: 0.3,
  speedMultiplier: 1.5,
  repelPhysicsUnitsPerSecond: 10,
  repelSeconds: 0.2,
  dizzinessChance: 0,
  dizzinessSeconds: 1,
};

/** Dependent trait 23 (`UnitChargeDizziness`) adds a guaranteed three-second stun. */
export const KNIGHT_CHARGE_DIZZINESS_TRAIT: Readonly<UnitChargePolicy> = {
  ...KNIGHT_CHARGE_TRAIT,
  dizzinessChance: 1,
  dizzinessSeconds: 3,
};

export interface EnemyDefinition extends Omit<UnitDefinition, 'id'> {
  id: Stage2EnemyId;
  elite: boolean;
  boss: boolean;
  zoom: number;
  aoeRadiusPixels: number;
  repelPhysicsUnitsPerSecond: number;
  repelSeconds: number;
  repelResist: boolean;
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
export const STAGE2_WAVE_POWERS = [1, 1.1, 1.1, 1.1, 1.1] as const;
export const STAGE2_ELITE_PROBABILITIES = [0, 0.3, 1.2, 2, 0.5] as const;
export const STAGE2_HAS_FINAL_BOSS = true;
export const PHYSICS_PIXEL_RATIO = 50;
export const UNIT_GLOBAL_SPEED_RATIO = 1.25;
export const UNIT_GLOBAL_SCALE = 0.9;
export const ENEMY_ROUTE_SEARCH_RANGE = 600;

export const STAGE2_UNITS: Readonly<Record<UnitBody, UnitDefinition>> = {
  Swordsman1: {
    id: 'js_9F2D53C8',
    body: 'Swordsman1',
    hitPoints: 300,
    attack: 30,
    attackRange: 1,
    attackSpeed: 1.2,
    speed: 1.1,
    bulletSpeed: 0,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 6,
    aoeRadiusPixels: 0,
  },
  Shooter1: {
    id: 'gb_E916AA75',
    body: 'Shooter1',
    hitPoints: 75,
    attack: 23,
    attackRange: 5,
    attackSpeed: 1,
    speed: 1.3,
    bulletSpeed: 18,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 5,
    aoeRadiusPixels: 0,
  },
  Mauler1: {
    id: 'db_DF32E2C2',
    body: 'Mauler1',
    hitPoints: 400,
    attack: 10,
    attackRange: 1,
    attackSpeed: 2 / 3,
    speed: 0.9,
    bulletSpeed: 0,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 4,
    aoeRadiusPixels: 0,
  },
  Crossbowman1: {
    id: '-b_CD2EDAAF',
    body: 'Crossbowman1',
    hitPoints: 75,
    attack: 35,
    attackRange: 6,
    attackSpeed: 0.8,
    speed: 1,
    bulletSpeed: 15,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 6,
    aoeRadiusPixels: 0,
  },
  Knight1: {
    id: 'qb_2B5987F2',
    body: 'Knight1',
    hitPoints: 350,
    attack: 40,
    attackRange: 1,
    attackSpeed: 1,
    speed: 1.7,
    bulletSpeed: 0,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 9,
    aoeRadiusPixels: 0,
  },
  Mage1: {
    id: 'fs_18B222C3',
    body: 'Mage1',
    hitPoints: 100,
    attack: 60,
    attackRange: 4.5,
    attackSpeed: 7 / 12,
    speed: 1.1,
    bulletSpeed: 19.5,
    criticalChance: 0.05,
    criticalDamage: 2,
    dodge: 0.05,
    attackFireFrame: 9,
    aoeRadiusPixels: 2 * PHYSICS_PIXEL_RATIO,
  },
};

const enemyFromBase = (
  id: Stage2EnemyId,
  body: UnitBody,
  overrides: Partial<Omit<EnemyDefinition, 'id' | 'body'>> = {},
): EnemyDefinition => ({
  ...STAGE2_UNITS[body],
  id,
  body,
  elite: false,
  boss: false,
  zoom: 1,
  aoeRadiusPixels: 0,
  repelPhysicsUnitsPerSecond: 0,
  repelSeconds: 0,
  repelResist: false,
  ...overrides,
});

/** Stage 2's exact base, elite and final-boss variants from the recovered unit table. */
export const STAGE2_ENEMIES: Readonly<Record<Stage2EnemyId, EnemyDefinition>> = {
  js_9F2D53C8: enemyFromBase('js_9F2D53C8', 'Swordsman1'),
  gb_E916AA75: enemyFromBase('gb_E916AA75', 'Shooter1'),
  jrjs_D1DC19C8: enemyFromBase('jrjs_D1DC19C8', 'Swordsman1', {
    hitPoints: 600,
    attack: 60,
    attackRange: 1.5,
    zoom: 1.5,
    elite: true,
    repelPhysicsUnitsPerSecond: 12,
    repelSeconds: 0.3,
  }),
  jrgb_A7E7E075: enemyFromBase('jrgb_A7E7E075', 'Shooter1', {
    hitPoints: 150,
    attack: 46,
    attackRange: 5.5,
    zoom: 1.5,
    elite: true,
    repelPhysicsUnitsPerSecond: 12,
    repelSeconds: 0.3,
  }),
  jstl_B2A046F6: enemyFromBase('jstl_B2A046F6', 'Swordsman1', {
    hitPoints: 7500,
    attack: 180,
    attackSpeed: 0.6,
    speed: 0.55,
    attackRange: 2,
    zoom: 2,
    boss: true,
    aoeRadiusPixels: 100,
    repelPhysicsUnitsPerSecond: 12,
    repelSeconds: 0.35,
    repelResist: true,
  }),
  gbtl_27AAAA80: enemyFromBase('gbtl_27AAAA80', 'Shooter1', {
    hitPoints: 1875,
    attack: 138,
    attackSpeed: 0.5,
    speed: 0.65,
    attackRange: 5.5,
    zoom: 2,
    boss: true,
    aoeRadiusPixels: 100,
    repelPhysicsUnitsPerSecond: 12,
    repelSeconds: 0.35,
    repelResist: true,
  }),
};

export const STAGE2_BASE_ENEMIES = ['js_9F2D53C8', 'gb_E916AA75'] as const;
export const STAGE2_ELITE_BY_BASE: Readonly<Record<(typeof STAGE2_BASE_ENEMIES)[number], Stage2EnemyId>> = {
  js_9F2D53C8: 'jrjs_D1DC19C8',
  gb_E916AA75: 'jrgb_A7E7E075',
};
export const STAGE2_BOSS_BY_BASE: Readonly<Record<(typeof STAGE2_BASE_ENEMIES)[number], Stage2EnemyId>> = {
  js_9F2D53C8: 'jstl_B2A046F6',
  gb_E916AA75: 'gbtl_27AAAA80',
};

export const MAULER_BARRACKS: ShopDefinition = {
  id: 'e01',
  level: 1,
  sprite: 'original/buildings/Building_Mauler1',
  shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
  kind: 'barracks',
  hitPoints: 520,
  summonCooldownSeconds: 10,
  summonBody: 'Swordsman1',
  summonUnitMax: 2,
};

export const SWORDSMAN_BARRACKS: ShopDefinition = {
  id: 'e06',
  level: 1,
  sprite: 'original/buildings/Building_Swordsman1',
  shape: [[0, 0], [1, 0], [2, 0]],
  kind: 'barracks',
  hitPoints: 390,
  summonCooldownSeconds: 9,
  summonBody: 'Mauler1',
  summonUnitMax: 2,
};

export const CROSSBOWMAN_BARRACKS: ShopDefinition = {
  id: 'e04',
  level: 1,
  sprite: 'original/buildings/Building_Crossbowman1',
  shape: [[0, 0], [1, 0], [2, 0], [1, 1]],
  kind: 'barracks',
  hitPoints: 520,
  summonCooldownSeconds: 11,
  summonBody: 'Crossbowman1',
  summonUnitMax: 2,
};

export const KNIGHT_BARRACKS: ShopDefinition = {
  id: 'e03',
  level: 1,
  sprite: 'original/buildings/Building_Knight1',
  shape: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]],
  kind: 'barracks',
  hitPoints: 650,
  summonCooldownSeconds: 13,
  summonBody: 'Knight1',
  summonUnitMax: 2,
};

export const MAGE_BARRACKS: ShopDefinition = {
  id: 'e05',
  level: 1,
  sprite: 'original/buildings/Building_Mage1',
  shape: [[0, 0], [1, 0], [0, 1], [0, 2]],
  kind: 'barracks',
  hitPoints: 520,
  summonCooldownSeconds: 11,
  summonBody: 'Mage1',
  summonUnitMax: 2,
};

export const TREBUCHET: ShopDefinition = {
  id: 'e08',
  level: 1,
  sprite: 'original/buildings/Building_Trebuchet1',
  weaponMount: {
    sprite: 'original/buildings/Building_Trebuchet1_up',
    x: 0.5,
    y: 0.1,
    pivot: [0.88, 0.5],
    rotationDegrees: -90,
  },
  shape: [[0, 0], [1, 0], [0, 1], [1, 1]],
  kind: 'defense',
  hitPoints: 520,
  attack: 60,
  cooldownSeconds: 4,
  rangePixels: 13 * PHYSICS_PIXEL_RATIO,
  criticalChance: 0.05,
  criticalDamage: 1.5,
  projectileSpeedPixels: 25 * PHYSICS_PIXEL_RATIO,
  projectileWidth: 48,
  projectileHeight: 26,
  splashRadiusPixels: 1.5 * PHYSICS_PIXEL_RATIO,
  splashDamageRatio: 0.5,
  forceTargetOnly: true,
};

export const ELECTRICITY_TOWER: ShopDefinition = {
  id: 'e09',
  level: 1,
  sprite: 'original/buildings/Building_ElectricityTower1',
  weaponMount: {
    sprite: 'original/buildings/Building_ElectricityTower1_up',
    x: 0.5,
    y: 0.1,
    pivot: [0.45, 0.5],
    rotationDegrees: -90,
  },
  shape: [[0, 0], [1, 0]],
  kind: 'defense',
  hitPoints: 260,
  attack: 40,
  cooldownSeconds: 3,
  rangePixels: 14 * PHYSICS_PIXEL_RATIO,
  criticalChance: 0.05,
  criticalDamage: 1.5,
  projectileSpeedPixels: 120 * PHYSICS_PIXEL_RATIO,
  projectileWidth: 38,
  projectileHeight: 20,
  forceTargetOnly: true,
  jumpCount: 1,
  projectileLifeTimeSeconds: 0.3,
  projectileColor: [125, 230, 255, 255],
};

export const MIRROR_TOWER: ShopDefinition = {
  id: 'e10',
  level: 1,
  sprite: 'original/buildings/Building_MirrorTower1',
  weaponMount: {
    sprite: 'original/buildings/Building_MirrorTower1_up',
    x: 0.5,
    y: 0.05,
    pivot: [0.5, 0.5],
    rotationDegrees: -90,
  },
  shape: [[0, 0], [0, 1]],
  kind: 'defense',
  hitPoints: 260,
  attack: 20,
  cooldownSeconds: 4,
  rangePixels: 15 * PHYSICS_PIXEL_RATIO,
  criticalChance: 0.05,
  criticalDamage: 1.5,
  laserDurationSeconds: 2,
  laserTickIntervalSeconds: 0.25,
};

export const EXPERIENCE_CRYSTAL: ShopDefinition = {
  id: 'e11',
  level: 1,
  sprite: 'original/buildings/Building_ShuiJing1',
  shape: [[0, 0]],
  kind: 'economy',
  hitPoints: 130,
  experienceBonus: 0.05,
};

export const SLOWING_WELL: ShopDefinition = {
  id: 'e12',
  level: 1,
  sprite: 'original/buildings/Building_Well1',
  shape: [[0, 0], [0, 1]],
  kind: 'support',
  hitPoints: 260,
  enemySlowAmount: 0.05,
};

export const OBSERVATION_DECK: ShopDefinition = {
  id: 'e13',
  level: 1,
  sprite: 'original/buildings/Building_ObservationDeck1',
  shape: [[0, 0], [0, 1]],
  kind: 'support',
  hitPoints: 260,
  globalCriticalChanceBonus: 0.05,
};

export const ATTACK_SPEED_STATUE: ShopDefinition = {
  id: 'e14',
  level: 1,
  sprite: 'original/buildings/Building_Statue1',
  shape: [[0, 0], [0, 1]],
  kind: 'support',
  hitPoints: 260,
  adjacentAttackSpeedBonus: 0.05,
};

export const MARTIAL_ARTS_FIELD: ShopDefinition = {
  id: 'e15',
  level: 1,
  sprite: 'original/buildings/Building_MartialArtsField1',
  shape: [[0, 0], [1, 0]],
  kind: 'support',
  hitPoints: 260,
  adjacentAttackBonus: 0.05,
};

export const LONG_FENCE: ShopDefinition = {
  id: 'e17',
  level: 1,
  sprite: 'original/buildings/Building_Fence21',
  shape: [[0, 0], [1, 0], [2, 0]],
  kind: 'wall',
  hitPoints: 507,
};

export const GOLD_MINE: ShopDefinition = {
  id: 'e18',
  level: 1,
  sprite: 'original/buildings/Building_Mine1',
  shape: [[0, 0]],
  kind: 'economy',
  hitPoints: 130,
  moneyPerWave: 1,
};

export const STAGE2_EXPERIENCE = {
  normal: 10,
  elite: 20,
  boss: 0,
  fightLevelFix: 0.833333333333333,
} as const;

export const OPENING_SHOP: ReadonlyArray<ShopDefinition> = [
  {
    id: 'e02',
    level: 2,
    sprite: 'original/buildings/Building_Shooter2',
    visualOffsetY: -30,
    shape: [[0, 0], [0, 1], [0, 2]],
    kind: 'barracks',
    hitPoints: 390,
    summonCooldownSeconds: 7.2,
    summonBody: 'Shooter1',
    summonUnitMax: 4,
  },
  {
    id: 'e07',
    level: 1,
    sprite: 'original/buildings/Building_ArrowTower1',
    weaponMount: {
      sprite: 'original/buildings/Building_ArrowTower1_up',
      x: 0.5,
      y: 0.7,
      pivot: [0, 0.5],
      rotationDegrees: -90,
    },
    visualOffsetY: -16,
    shape: [[0, 0]],
    kind: 'defense',
    hitPoints: 130,
    attack: 20,
    cooldownSeconds: 2,
    rangePixels: 12 * PHYSICS_PIXEL_RATIO,
  },
  {
    id: 'e16',
    level: 1,
    sprite: 'original/buildings/Building_Fence11',
    visualOffsetY: -8,
    shape: [[0, 0]],
    kind: 'wall',
    hitPoints: 169,
  },
];

export const FUNCTIONAL_SHOP_POOL: ReadonlyArray<ShopDefinition> = [
  MAULER_BARRACKS,
  SWORDSMAN_BARRACKS,
  CROSSBOWMAN_BARRACKS,
  KNIGHT_BARRACKS,
  MAGE_BARRACKS,
  TREBUCHET,
  ELECTRICITY_TOWER,
  MIRROR_TOWER,
  EXPERIENCE_CRYSTAL,
  SLOWING_WELL,
  OBSERVATION_DECK,
  ATTACK_SPEED_STATUE,
  MARTIAL_ARTS_FIELD,
  LONG_FENCE,
  GOLD_MINE,
  ...OPENING_SHOP,
];

export const STORE_REFRESH_PRICE = 15;
export const SHOP_GUARANTEED_SLOT_INTERVAL = 3;
export const STAGE2_STORE_ITEM_TYPE_WEIGHTS = [887, 100, 13] as const;

export interface ShopSlotShape {
  id: string;
  shape: ReadonlyArray<readonly [number, number]>;
  shopWeight: number;
  needAd: boolean;
}

export const SHOP_SLOT_SHAPES: ReadonlyArray<ShopSlotShape> = [
  { id: '1', shape: [[0, 0]], shopWeight: 320, needAd: false },
  { id: '2', shape: [[0, 0], [0, 1]], shopWeight: 30, needAd: false },
  { id: '3', shape: [[0, 0], [1, 0]], shopWeight: 30, needAd: false },
  { id: '4', shape: [[0, 0], [0, 1], [0, 2]], shopWeight: 25, needAd: true },
  { id: '5', shape: [[0, 0], [1, 0], [2, 0]], shopWeight: 25, needAd: true },
  { id: '6', shape: [[0, 0], [1, 0], [0, 1]], shopWeight: 25, needAd: true },
  { id: '7', shape: [[1, 0], [0, 1], [1, 1]], shopWeight: 25, needAd: true },
  { id: '8', shape: [[0, 0], [1, 0], [1, 1]], shopWeight: 25, needAd: true },
  { id: '9', shape: [[0, 0], [0, 1], [1, 1]], shopWeight: 25, needAd: true },
];

export function createShopSlotDefinition(slot: ShopSlotShape): ShopDefinition {
  return {
    id: `slot-${slot.id}`,
    level: 0,
    sprite: '',
    shape: slot.shape,
    kind: 'slot',
    hitPoints: 0,
    slotShapeId: slot.id,
    shopWeight: slot.shopWeight,
    needAd: slot.needAd,
  };
}

export function createSeededRandom(seedValue: number): () => number {
  let seed = Math.trunc(seedValue);
  return () => {
    seed = (9301 * seed + 49297) % 233280;
    return seed / 233280;
  };
}

export function weightedShopIndex(weights: ReadonlyArray<number>, random: () => number): number {
  const safe = weights.map((weight) => Number.isFinite(weight) ? Math.max(0, weight) : 0);
  const total = safe.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return -1;
  let roll = Math.min(0.999999999999, Math.max(0, random())) * total;
  for (let index = 0; index < safe.length; index += 1) {
    roll -= safe[index];
    if (roll < 0) return index;
  }
  return safe.length - 1;
}

export function shopLevelWeights(wave: number, quality2Bonus = 0): readonly [number, number, number] {
  const safeWave = Math.max(1, Math.trunc(wave || 1));
  const level3 = Math.min(1, Math.max(0, 0.06 + (safeWave - 1) / 5 * 0.015));
  const level2 = Math.min(1 - level3, Math.max(0, 0.06 + (safeWave - 1) / 5 * 0.03 + quality2Bonus));
  return [Math.max(0, 1 - level2 - level3), level2, level3];
}

export function shopRefreshCost(basePrice = STORE_REFRESH_PRICE, consumeBonuses: ReadonlyArray<number> = []): number {
  return consumeBonuses.reduce(
    (cost, bonus) => Number.isFinite(bonus) && bonus > 0 ? Math.round(cost / (1 + bonus)) : cost,
    Math.max(0, Math.round(basePrice)),
  );
}

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
