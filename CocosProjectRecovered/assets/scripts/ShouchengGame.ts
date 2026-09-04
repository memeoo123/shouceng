import {
  _decorator,
  Color,
  Component,
  director,
  EventTouch,
  Font,
  Graphics,
  JsonAsset,
  Label,
  Node,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  UIOpacity,
  UITransform,
  Vec3,
  view,
} from 'cc';
import {
  CASTLE,
  ATTACK_SPEED_STATUE,
  canSynthesizeBuildings,
  CROSSBOWMAN_BARRACKS,
  ELECTRICITY_TOWER,
  EXPERIENCE_CRYSTAL,
  SLOWING_WELL,
  CELL_GAP,
  CELL_SIZE,
  CELL_STEP,
  createSeededRandom,
  createShopSlotDefinition,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  GRID_X,
  GRID_Y,
  ENEMY_ROUTE_SEARCH_RANGE,
  fitBuildingVisualSize,
  FUNCTIONAL_SHOP_POOL,
  GOLD_MINE,
  isBuildable,
  KNIGHT_BARRACKS,
  KNIGHT_CHARGE_TRAIT,
  KNIGHT_CHARGE_DIZZINESS_TRAIT,
  LONG_FENCE,
  MAULER_BARRACKS,
  MARTIAL_ARTS_FIELD,
  MAGE_BARRACKS,
  MIRROR_TOWER,
  OBSERVATION_DECK,
  TREBUCHET,
  upgradeShopDefinition,
  OPENING_SHOP,
  PHYSICS_PIXEL_RATIO,
  PREPARATION_SHIFT,
  ShopDefinition,
  EnemyDefinition,
  SHOP_GUARANTEED_SLOT_INTERVAL,
  SHOP_SLOT_SHAPES,
  shopLevelWeights,
  shopRefreshCost,
  SWORDSMAN_BARRACKS,
  Stage2EnemyId,
  STAGE2_BASE_ENEMIES,
  STAGE2_BOSS_BY_BASE,
  STAGE2_ELITE_BY_BASE,
  STAGE2_ELITE_PROBABILITIES,
  STAGE2_ENEMIES,
  STAGE2_EXPERIENCE,
  STAGE2_HAS_FINAL_BOSS,
  STAGE2_MAP,
  STAGE2_STORE_ITEM_TYPE_WEIGHTS,
  STAGE2_UNITS,
  STAGE2_WAVE_COUNTS,
  STAGE2_WAVE_POWERS,
  UNIT_GLOBAL_SCALE,
  UNIT_GLOBAL_SPEED_RATIO,
  UnitChargePolicy,
  UnitBody,
  weightedShopIndex,
  STORE_REFRESH_PRICE,
} from './sim/Stage2Config.ts';
import {
  allocateWaveCoins,
  advanceAttackActionLock,
  applyDamage,
  attackWithAdjacentBonus,
  attackActionDuration,
  battleExperienceGain,
  areGridFootprintsAdjacent,
  applyWaveVariants,
  buildSpawnDelays,
  buildWaveRoster,
  buildingCooldownWithAdjacentSpeed,
  distanceBetween,
  enemySpeedMultiplier,
  createRepelState,
  criticalChanceWithAura,
  firstSweptContact,
  fightLevelExperienceGain,
  latchDeadTargetPoint,
  nearestLiveCandidate,
  normalizeVector,
  projectileLifeTime,
  projectileTurnDelta,
  RepelState,
  resolveAttack,
  routeRandomAngle,
  stepRepel,
  waveEndMineIncome,
} from './sim/CombatKernel.ts';
import {
  FIGHT_LEVEL_EXPERIENCE,
  GeneralTraitChoice,
  GeneralTraitEffectKey,
  rollGeneralTraitChoices,
  traitMultiplier,
  traitSum,
} from './sim/TraitConfig.ts';
import { SpriteSequence } from './view/SpriteSequence.ts';
import { FairyMovieClipSequence } from './view/FairyMovieClipSequence.ts';
import {
  RECOVERED_AIR_SUPPORT_EFFECTS,
  RecoveredAirSupportEffectId,
} from './view/RecoveredAirSupportEffects.ts';
import {
  RECOVERED_LASER_EFFECTS,
  RecoveredLaserLevel,
} from './view/RecoveredLaserEffects.ts';
import {
  applyCampaignBattleResult,
  CampaignRewardStage,
  CampaignBattleResult,
  CampaignProgress,
  campaignUnlockedStage,
  claimWaveChest,
  LocalProfile,
  normalizeLocalProfile,
  normalizeCampaignProgress,
  RewardEntry,
  waveChestState,
} from './sim/CampaignProgress.ts';

const { ccclass } = _decorator;

interface DragState {
  node: Node;
  definition: ShopDefinition;
  home: Vec3;
  existing: PlacedBuilding | null;
  shopItem: ShopItemState | null;
}

interface ShopItemState {
  node: Node;
  definition: ShopDefinition;
  home: Vec3;
  available: boolean;
}

interface ShopRollRecord {
  refresh: number;
  special: boolean;
  items: Array<{ id: string; kind: ShopDefinition['kind']; level: number }>;
}

interface RecoveredStageCatalogEntry {
  id: number;
  mapId: string;
  mapType: string;
  name: string;
  declaredWave: number;
  mapData: string[];
  enemies: string[];
  waveEnemyCountsEffective: number[];
  wavePower: number[];
  eliteProbability: number[];
  hasFinalBoss: boolean;
  storeItemTypeWeight: number[];
  rewardWave: number[];
  chestRewards: unknown[][];
}

interface RecoveredEnemyCatalogEntry {
  id: string;
  bodies: string[];
  hitPoints?: number;
  hp: number;
  attack: number;
  attackSpeed: number;
  speed: number;
  range: number;
  crit: number;
  critDamage: number;
  dodge: number;
  bulletSpeed: number;
  traits: Record<string, unknown>;
  changeToElite: string | null;
  changeToBoss: string | null;
  zoom: number;
}

interface RuntimeEnemyDefinition extends EnemyDefinition {
  bodies: string[];
  changeToElite: string | null;
  changeToBoss: string | null;
}

type ActorTeam = 'enemy' | 'ally';
type ActorAction = 'idle' | 'move' | 'attack' | 'victory' | 'charge';
type AirSupportId = 'meteorite' | 'healing' | 'freeze';

const AIR_SUPPORT_SKILLS: ReadonlyArray<{ id: AirSupportId; icon: string }> = [
  { id: 'meteorite', icon: 'original/ui/airsupport_meteorite' },
  { id: 'healing', icon: 'original/ui/airsupport_healing' },
  { id: 'freeze', icon: 'original/ui/airsupport_freeze' },
];
const LIFECYCLE_ADAPTER_COOLDOWN_SECONDS = 0.1;
const CAMPAIGN_STORAGE_KEY = 'shoucheng.wx4f4f3709865004a2.v3.MaxStageRecord';
const LOCAL_PROFILE_STORAGE_KEY = 'shoucheng.wx4f4f3709865004a2.v3.LocalProfile';

interface VisualMotionSample {
  offsetMs: -204 | -102 | 0 | 102 | 204;
  x: number;
  y: number;
  action: ActorAction;
  frame: number;
  flipped: boolean;
  centerReliable: boolean;
  phaseReliable: boolean;
}

interface VisualMotionActorTrack {
  id: string;
  team: ActorTeam;
  body: UnitBody;
  enemyId?: Stage2EnemyId;
  hpRatio?: number;
  samples: ReadonlyArray<VisualMotionSample>;
}

/** Evidence-only tracks measured from the original MP4 at 102 ms intervals. */
const VISUAL_MOTION_WINDOWS: Readonly<Record<'t12' | 't18', ReadonlyArray<VisualMotionActorTrack>>> = {
  t12: [
    {
      id: 'enemy-shooter', team: 'enemy', body: 'Shooter1', enemyId: 'gb_E916AA75',
      samples: [
        { offsetMs: -204, x: 233.885, y: 48.345, action: 'move', frame: 3, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: -102, x: 224.739, y: 53.571, action: 'move', frame: 6, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: 0, x: 219.512, y: 61.411, action: 'move', frame: 7, flipped: true, centerReliable: true, phaseReliable: false },
        { offsetMs: 102, x: 212.979, y: 73.171, action: 'move', frame: 8, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: 204, x: 212.979, y: 83.624, action: 'move', frame: 8, flipped: true, centerReliable: true, phaseReliable: true },
      ],
    },
    {
      id: 'enemy-swordsman-a', team: 'enemy', body: 'Swordsman1', enemyId: 'js_9F2D53C8',
      samples: [
        { offsetMs: -204, x: 346.254, y: 48.345, action: 'move', frame: 6, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: -102, x: 351.481, y: 53.571, action: 'move', frame: 1, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 0, x: 359.321, y: 67.944, action: 'move', frame: 9, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 102, x: 360.627, y: 77.091, action: 'move', frame: 9, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 204, x: 346.254, y: 71.864, action: 'move', frame: 2, flipped: false, centerReliable: true, phaseReliable: true },
      ],
    },
    {
      id: 'enemy-swordsman-b', team: 'enemy', body: 'Swordsman1', enemyId: 'js_9F2D53C8',
      samples: [
        { offsetMs: -204, x: 388.066, y: 43.118, action: 'move', frame: 8, flipped: true, centerReliable: false, phaseReliable: false },
        { offsetMs: -102, x: 390.679, y: 52.265, action: 'move', frame: 1, flipped: true, centerReliable: false, phaseReliable: false },
        { offsetMs: 0, x: 401.132, y: 47.038, action: 'move', frame: 4, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 102, x: 415.505, y: 44.425, action: 'move', frame: 1, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 204, x: 419.425, y: 52.265, action: 'move', frame: 1, flipped: false, centerReliable: true, phaseReliable: false },
      ],
    },
  ],
  t18: [
    {
      id: 'enemy-swordsman-a', team: 'enemy', body: 'Swordsman1', enemyId: 'js_9F2D53C8',
      samples: [
        { offsetMs: -204, x: 508.275, y: 313.589, action: 'move', frame: 1, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: -102, x: 510.889, y: 322.735, action: 'move', frame: 7, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 0, x: 514.808, y: 337.108, action: 'move', frame: 9, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 102, x: 509.582, y: 333.188, action: 'attack', frame: 1, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 204, x: 516.115, y: 352.787, action: 'attack', frame: 6, flipped: true, centerReliable: false, phaseReliable: false },
      ],
    },
    {
      id: 'enemy-shooter', team: 'enemy', body: 'Shooter1', enemyId: 'gb_E916AA75',
      samples: [
        { offsetMs: -204, x: 544.861, y: 384.146, action: 'move', frame: 2, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: -102, x: 544.861, y: 399.826, action: 'move', frame: 2, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: 0, x: 537.021, y: 397.213, action: 'attack', frame: 0, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: 102, x: 531.794, y: 403.746, action: 'move', frame: 8, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: 204, x: 530.488, y: 411.585, action: 'move', frame: 8, flipped: true, centerReliable: true, phaseReliable: false },
      ],
    },
    {
      id: 'enemy-swordsman-low-hp', team: 'enemy', body: 'Swordsman1', enemyId: 'js_9F2D53C8', hpRatio: 0.12,
      samples: [
        { offsetMs: -204, x: 261.324, y: 508.275, action: 'move', frame: 5, flipped: false, centerReliable: false, phaseReliable: false },
        { offsetMs: -102, x: 273.084, y: 508.275, action: 'attack', frame: 2, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 0, x: 279.617, y: 517.422, action: 'move', frame: 6, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 102, x: 286.15, y: 527.875, action: 'move', frame: 7, flipped: false, centerReliable: true, phaseReliable: false },
        { offsetMs: 204, x: 279.617, y: 533.101, action: 'attack', frame: 2, flipped: false, centerReliable: true, phaseReliable: true },
      ],
    },
    {
      id: 'ally-shooter-a', team: 'ally', body: 'Shooter1',
      samples: [
        { offsetMs: -204, x: 205.139, y: 825.784, action: 'attack', frame: 0, flipped: false, centerReliable: false, phaseReliable: false },
        { offsetMs: -102, x: 209.059, y: 821.864, action: 'idle', frame: 0, flipped: false, centerReliable: false, phaseReliable: false },
        { offsetMs: 0, x: 203.833, y: 810.105, action: 'attack', frame: 0, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 102, x: 201.22, y: 800.958, action: 'attack', frame: 2, flipped: false, centerReliable: true, phaseReliable: true },
        { offsetMs: 204, x: 197.3, y: 795.732, action: 'attack', frame: 1, flipped: false, centerReliable: true, phaseReliable: false },
      ],
    },
    {
      id: 'ally-shooter-b', team: 'ally', body: 'Shooter1',
      samples: [
        { offsetMs: -204, x: 492.596, y: 850.61, action: 'attack', frame: 1, flipped: true, centerReliable: true, phaseReliable: true },
        { offsetMs: -102, x: 484.756, y: 841.463, action: 'idle', frame: 5, flipped: true, centerReliable: true, phaseReliable: false },
        { offsetMs: 0, x: 475.61, y: 838.85, action: 'idle', frame: 5, flipped: true, centerReliable: true, phaseReliable: false },
        { offsetMs: 102, x: 472.997, y: 836.237, action: 'idle', frame: 4, flipped: true, centerReliable: true, phaseReliable: false },
        { offsetMs: 204, x: 476.916, y: 821.864, action: 'attack', frame: 2, flipped: true, centerReliable: true, phaseReliable: true },
      ],
    },
  ],
};

interface PlacedBuilding {
  id: number;
  node: Node;
  definition: ShopDefinition;
  column: number;
  row: number;
  hitPoints: number;
  maxHitPoints: number;
  cooldown: number;
  hpBack: Node | null;
  hpFill: Node | null;
  shopHome: Vec3;
  unitCharge?: Readonly<UnitChargePolicy>;
}

interface CombatActor {
  id: number;
  team: ActorTeam;
  body: UnitBody;
  visualBody: string;
  node: Node;
  visual: Node;
  animator: SpriteSequence;
  hitPoints: number;
  maxHitPoints: number;
  attack: number;
  attackSpeed: number;
  attackFireFrame: number;
  attackCooldown: number;
  range: number;
  speed: number;
  baseSpeed: number;
  bulletSpeed: number;
  criticalChance: number;
  criticalDamage: number;
  dodge: number;
  deadCoins: number;
  sourceBuildingId?: number;
  action: ActorAction;
  attacking: boolean;
  attackLockRemaining: number;
  hpBack: Node;
  hpFill: Node;
  aliveMilliseconds: number;
  routeTarget: CombatTarget | null;
  routeRandom: { angle: number; untilMilliseconds: number } | null;
  routeForceContacts: Map<CombatActor, number>;
  boss: boolean;
  elite: boolean;
  routeColliderScale: number;
  aoeRadius: number;
  repelPhysicsUnitsPerSecond: number;
  repelSeconds: number;
  repelResist: boolean;
  repel: RepelState | null;
  freezeRemaining: number;
  freezeEffect: Node | null;
  chargePolicy: Readonly<UnitChargePolicy> | null;
  charging: boolean;
  dizzinessRemaining: number;
}

interface CombatTarget {
  kind: 'actor' | 'building' | 'castle';
  actor?: CombatActor;
  building?: PlacedBuilding;
}

interface CombatProjectile {
  node: Node;
  target: CombatTarget;
  team: ActorTeam;
  damage: number;
  speed: number;
  criticalChance: number;
  criticalDamage: number;
  velocity: { x: number; y: number };
  clock: number;
  lifeTime: number;
  resetLifeTime: number;
  attackRange: number;
  autoFlow: boolean;
  flowTimeMilliseconds: number;
  aoeRadius: number;
  splashDamageRatio: number;
  jumpRemaining: number;
  hitActors: CombatActor[];
  repelPhysicsUnitsPerSecond: number;
  repelSeconds: number;
  sourcePoint: { x: number; y: number };
  deadInLast: boolean;
  forceTargetOnly: boolean;
  lastTargetPoint: { x: number; y: number } | null;
  deadTargetPoint: { x: number; y: number } | null;
  deadInLastLatched: boolean;
  visualEffect?: RecoveredAirSupportEffectId;
  impactEffect?: RecoveredAirSupportEffectId;
}

interface LaserEffectState {
  node: Node;
  opacity: UIOpacity;
  target: CombatTarget;
  team: ActorTeam;
  start: { x: number; y: number };
  damage: number;
  criticalChance: number;
  criticalDamage: number;
  clock: number;
  duration: number;
  tickInterval: number;
  nextTick: number;
  config: (typeof RECOVERED_LASER_EFFECTS)[RecoveredLaserLevel];
}

interface DamageTextState {
  node: Node;
  opacity: UIOpacity;
  origin: Vec3;
  clock: number;
}

interface AirSupportEvent {
  targets: CombatActor[];
  elapsed: number;
  nextIndex: number;
  interval: number;
}

interface AirSupportButtonState {
  node: Node;
  usedShade: Node;
  usedLabel: Node;
  opacity: UIOpacity;
}

interface AirSupportAudit {
  uses: AirSupportId[];
  meteoriteTargets: number;
  meteoriteImpacts: number;
  frozenTargets: number;
  healedUnits: number;
  healedHp: number;
  freezeEffects: number;
  healingEffects: number;
  artilleryEffects: number;
  meteorProjectileAnimations: number;
}

interface LifecycleSmokeState {
  active: boolean;
  completedWaves: number[];
  currentWave: number;
  victory: boolean;
  castleHp: number;
  spawned: number;
  resolved: number;
  projectiles: number;
  projectileLifetimes: Array<{ clock: number; lifeTime: number }>;
  errors: string[];
  damageTextsSpawned: number;
  maximumDamageTextsActive: number;
  repelsApplied: number;
  repelsResisted: number;
}

interface RepelMotionSmokeState {
  phase: 'before' | 'after';
  ready: boolean;
  passed: boolean;
  errors: string[];
  elite: {
    id: Stage2EnemyId;
    repelPhysicsUnitsPerSecond: number;
    repelSeconds: number;
    targetTrace: Array<{ timeSeconds: number; x: number; y: number; remainingSeconds: number }>;
    applied: boolean;
    displacementPixels: number;
  };
  boss: {
    id: Stage2EnemyId;
    repelResist: boolean;
    start: { x: number; y: number };
    after: { x: number; y: number };
    rejected: boolean;
  };
}

interface AttackMotionSmokeState {
  phase: 'windup' | 'fire' | 'recovery';
  ready: boolean;
  passed: boolean;
  errors: string[];
  attacker: {
    body: 'Crossbowman1';
    frameCount: number;
    fireFrame: number;
    intervalSeconds: number;
    captureClockSeconds: number;
    currentFrameIndex: number;
    currentFrameName: string | null;
    attacking: boolean;
    attackLockRemaining: number;
  };
  target: {
    hitPointsBefore: number;
    hitPointsAfter: number;
    damageApplied: number;
  };
  projectileCount: number;
  trace: Array<{
    timeSeconds: number;
    frameIndex: number;
    frameName: string | null;
    projectileCount: number;
    targetHitPoints: number;
  }>;
}

interface NormalTransitionSmokeState {
  mode: 'wave-one-transition' | 'full-lifecycle';
  active: boolean;
  placedBuildingIds: string[];
  completedWaves: number[];
  wave: number;
  fighting: boolean;
  finished: boolean;
  victory: boolean;
  shopVisible: boolean;
  shopRefreshCount: number;
  shopRollHistoryLength: number;
  shopOfferIds: string[];
  fightLevel: number;
  fightLevelExperience: number;
  fightLevelThreshold: number;
  progressWidth: number;
  levelText: string;
  traitPanelVisible: boolean;
  selectedTraitCount: number;
  reachedWaveTwoPreparation: boolean;
  castleHp: number;
  survivingAllies: number;
  spawnedThisWave: number;
  resolvedThisWave: number;
  activeBuildings: Array<{
    id: string;
    level: number;
    kind: ShopDefinition['kind'];
    hp: number;
  }>;
  allyDiagnostics: Array<{
    id: number;
    body: UnitBody;
    hp: number;
    action: ActorAction;
    attacking: boolean;
    attackLockRemaining: number;
    attackCooldown: number;
    targetId: number | null;
    x: number;
    y: number;
  }>;
  enemyDiagnostics: Array<{
    id: number;
    body: UnitBody;
    hp: number;
    action: ActorAction;
    attacking: boolean;
    attackLockRemaining: number;
    attackCooldown: number;
    targetKind: CombatTarget['kind'] | null;
    x: number;
    y: number;
  }>;
  projectileDiagnostics: Array<{
    team: ActorTeam;
    clock: number;
    lifeTime: number;
    targetAlive: boolean;
    x: number;
    y: number;
  }>;
  passed: boolean;
  errors: string[];
}

@ccclass('ShouchengGame')
export class ShouchengGame extends Component {
  private combatDelays: Array<{ remaining: number; callback: () => void }> = [];
  private gridLayer!: Node;
  private shopLayer!: Node;
  private actorLayer!: Node;
  private projectileLayer!: Node;
  private overlayLayer!: Node;
  private hudLayer!: Node;
  private mapData = STAGE2_MAP.slice();
  private stageId = 2;
  private stageName = '翠绿草原';
  private stageMapId = 'Forest';
  private campaignStageCount = 220;
  private campaignProgress: CampaignProgress = [1, 0];
  private localProfile: LocalProfile = normalizeLocalProfile(null);
  private stageCatalog: RecoveredStageCatalogEntry[] = [];
  private stageConfig!: RecoveredStageCatalogEntry;
  private campaignMetaMode = false;
  private campaignResult: CampaignBattleResult | null = null;
  private waveCounts: number[] = Array.from(STAGE2_WAVE_COUNTS);
  private wavePowers: number[] = Array.from(STAGE2_WAVE_POWERS);
  private eliteProbabilities: number[] = Array.from(STAGE2_ELITE_PROBABILITIES);
  private hasFinalBoss = STAGE2_HAS_FINAL_BOSS;
  private baseEnemyIds: string[] = Array.from(STAGE2_BASE_ENEMIES);
  private eliteByBase: Record<string, string> = { ...STAGE2_ELITE_BY_BASE };
  private bossByBase: Record<string, string> = { ...STAGE2_BOSS_BY_BASE };
  private storeItemTypeWeights: number[] = Array.from(STAGE2_STORE_ITEM_TYPE_WEIGHTS);
  private enemyDefinitions = new Map<string, RuntimeEnemyDefinition>();
  private castleColumn: number = CASTLE.column;
  private castleRow: number = CASTLE.row;
  private occupied = new Set<string>();
  private treeNodes = new Map<string, Node>();
  private treePriceLabels = new Map<string, Label>();
  private treeClearCount = 0;
  private money = 0;
  private kills = 0;
  private battleExperience = 0;
  private fightLevelExperience = 0;
  private fightLevel = 0;
  private activeTraits: GeneralTraitChoice[] = [];
  private traitSelecting = false;
  private pendingTraitSelections = 0;
  private traitPanel: Node | null = null;
  private currentTraitChoices: GeneralTraitChoice[] = [];
  private traitRandom = createSeededRandom(413);
  private moneyLabel!: Label;
  private drag: DragState | null = null;
  private fighting = false;
  private wave = 1;
  private waveLabel!: Label;
  private fightLevelProgressFill!: Node;
  private fightLevelLabel!: Label;
  private castleHp: number = CASTLE.hp;
  private castleHpFill!: Node;
  private castleHpLabel!: Label;
  private placedBuildings: PlacedBuilding[] = [];
  private shopItems: ShopItemState[] = [];
  private refreshButton!: Node;
  private refreshCostLabel!: Label;
  private refreshCostIcon!: Node;
  private specialRefreshButton!: Node;
  private firstFreeRefresh = true;
  private specialRefreshUsed = false;
  private shopRefreshCount = 1;
  private lastSlotRefresh = 0;
  private shopRandom = createSeededRandom(677);
  private shopRollHistory: ShopRollRecord[] = [];
  private enemies: CombatActor[] = [];
  private allies: CombatActor[] = [];
  private projectiles: CombatProjectile[] = [];
  private laserEffects: LaserEffectState[] = [];
  private damageTexts: DamageTextState[] = [];
  private airSupportLayer!: Node;
  private airSupportButtons = new Map<AirSupportId, AirSupportButtonState>();
  private airSupportUsed = new Set<AirSupportId>();
  private airSupportEvents: AirSupportEvent[] = [];
  private airSupportAudit: AirSupportAudit = this.emptyAirSupportAudit();
  private frameCache = new Map<string, SpriteFrame>();
  private actionFrames = new Map<string, SpriteFrame[]>();
  private gameFont: Font | null = null;
  private fontAppliedLabels = 0;
  private nextRuntimeId = 1;
  private waveRoster: string[] = [];
  private waveCoinRoster: number[] = [];
  private waveSpawnDelays: number[] = [];
  private spawnedThisWave = 0;
  private resolvedThisWave = 0;
  private spawnClock = 0;
  private finished = false;
  private lifecycleSmoke = false;
  private lifecycleSmokeState: LifecycleSmokeState | null = null;
  private airSupportSmoke = false;
  private synthesisSmoke = false;
  private shopSynthesisSmoke = false;
  private maulerBarracksSmoke = false;
  private swordsmanBarracksSmoke = false;
  private crossbowmanBarracksSmoke = false;
  private knightBarracksSmoke = false;
  private mageBarracksSmoke = false;
  private trebuchetSmoke = false;
  private electricityTowerSmoke = false;
  private mirrorTowerSmoke = false;
  private experienceCrystalSmoke = false;
  private slowingWellSmoke = false;
  private observationDeckSmoke = false;
  private attackSpeedStatueSmoke = false;
  private martialArtsFieldSmoke = false;
  private longFenceSmoke = false;
  private goldMineSmoke = false;
  private shopRefreshSmoke = false;
  private traitSelectionSmoke = false;
  private normalTransitionSmoke = false;
  private normalLifecycleSmoke = false;
  private repelMotionPhase: 'before' | 'after' | null = null;
  private repelMotionFrozen = false;
  private attackMotionPhase: 'windup' | 'fire' | 'recovery' | null = null;
  private attackMotionFrozen = false;
  private resultSmokeOutcome: 'victory' | 'defeat' | null = null;
  private stageCatalogSmoke = false;
  private campaignStageBattleSmoke = false;
  private visualBaselinePhase: 'drag' | 'prep' | 'wave-start' | 'combat' | null = null;
  private visualMotionWindow: 't12' | 't18' | null = null;
  private visualMotionOffsetMs: -204 | -102 | 0 | 102 | 204 = 0;
  private visualBaselineClock = 0;
  private visualBaselineFrozen = false;
  private visualBaselinePlacedBuildingIds: string[] = [];
  private runtimeRandom: () => number = () => Math.random();
  private normalTransitionSmokeState: NormalTransitionSmokeState | null = null;
  private airSupportSmokeAssertions = {
    healingUsed: false,
    allyFullyHealed: false,
    freezeUsed: false,
    frozenForFourSeconds: false,
    meteoriteUsed: false,
    repeatRejected: false,
  };

  public async onLoad(): Promise<void> {
    view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.FIXED_WIDTH);
    this.node.name = 'ShouchengCanvas';
    this.lifecycleSmoke = this.readRuntimeTestName() === 'cocos-lifecycle';
    this.airSupportSmoke = this.readRuntimeTestName() === 'cocos-air-support';
    this.synthesisSmoke = this.readRuntimeTestName() === 'cocos-synthesis';
    this.shopSynthesisSmoke = this.readRuntimeTestName() === 'cocos-shop-synthesis';
    this.maulerBarracksSmoke = this.readRuntimeTestName() === 'cocos-mauler-barracks';
    this.swordsmanBarracksSmoke = this.readRuntimeTestName() === 'cocos-swordsman-barracks';
    this.crossbowmanBarracksSmoke = this.readRuntimeTestName() === 'cocos-crossbowman-barracks';
    this.knightBarracksSmoke = this.readRuntimeTestName() === 'cocos-knight-barracks';
    this.mageBarracksSmoke = this.readRuntimeTestName() === 'cocos-mage-barracks';
    this.trebuchetSmoke = this.readRuntimeTestName() === 'cocos-trebuchet';
    this.electricityTowerSmoke = this.readRuntimeTestName() === 'cocos-electricity-tower';
    this.mirrorTowerSmoke = this.readRuntimeTestName() === 'cocos-mirror-tower';
    this.experienceCrystalSmoke = this.readRuntimeTestName() === 'cocos-experience-crystal';
    this.slowingWellSmoke = this.readRuntimeTestName() === 'cocos-slowing-well';
    this.observationDeckSmoke = this.readRuntimeTestName() === 'cocos-observation-deck';
    this.attackSpeedStatueSmoke = this.readRuntimeTestName() === 'cocos-attack-speed-statue';
    this.martialArtsFieldSmoke = this.readRuntimeTestName() === 'cocos-martial-arts-field';
    this.longFenceSmoke = this.readRuntimeTestName() === 'cocos-long-fence';
    this.goldMineSmoke = this.readRuntimeTestName() === 'cocos-gold-mine';
    this.shopRefreshSmoke = this.readRuntimeTestName() === 'cocos-shop-refresh';
    this.traitSelectionSmoke = this.readRuntimeTestName() === 'cocos-trait-selection';
    this.normalTransitionSmoke = this.readRuntimeTestName() === 'cocos-normal-transition';
    this.normalLifecycleSmoke = this.readRuntimeTestName() === 'cocos-normal-lifecycle';
    this.resultSmokeOutcome = this.readRuntimeTestName() === 'cocos-result-victory'
      || this.readRuntimeTestName() === 'cocos-campaign-persist-victory'
      ? 'victory'
      : this.readRuntimeTestName() === 'cocos-result-defeat'
        ? 'defeat'
        : null;
    this.stageCatalogSmoke = this.readRuntimeTestName() === 'cocos-stage-catalog';
    this.campaignStageBattleSmoke = this.readRuntimeTestName() === 'cocos-campaign-stage-battle';
    this.repelMotionPhase = this.readRuntimeTestName() === 'cocos-repel-before'
      ? 'before'
      : this.readRuntimeTestName() === 'cocos-repel-after'
        ? 'after'
        : null;
    this.attackMotionPhase = this.readRuntimeTestName() === 'cocos-attack-windup'
      ? 'windup'
      : this.readRuntimeTestName() === 'cocos-attack-fire'
        ? 'fire'
        : this.readRuntimeTestName() === 'cocos-attack-recovery'
          ? 'recovery'
          : null;
    const visualBaselineTest = this.readRuntimeTestName();
    this.visualMotionWindow = visualBaselineTest === 'cocos-visual-motion-t12'
      ? 't12'
      : visualBaselineTest === 'cocos-visual-motion-t18'
        ? 't18'
        : null;
    if (this.visualMotionWindow) this.visualMotionOffsetMs = this.readVisualMotionOffsetMs();
    this.visualBaselinePhase = visualBaselineTest === 'cocos-visual-drag'
      ? 'drag'
      : visualBaselineTest === 'cocos-visual-prep'
        ? 'prep'
      : visualBaselineTest === 'cocos-visual-wave-start'
        ? 'wave-start'
        : visualBaselineTest === 'cocos-visual-combat'
          ? 'combat'
          : this.visualMotionWindow === 't12'
            ? 'wave-start'
            : this.visualMotionWindow === 't18'
              ? 'combat'
              : null;
    if (this.visualBaselinePhase) this.runtimeRandom = createSeededRandom(20260824);
    this.campaignMetaMode = this.isCampaignMetaRoute();
    await this.loadCampaignStage();
    await this.preloadGameFont();
    if (this.campaignMetaMode) {
      if (this.readRuntimeTestName() === 'cocos-campaign-meta') {
        this.localProfile = normalizeLocalProfile({ maxStageRecord: [2, 5] });
        this.campaignProgress = [...this.localProfile.maxStageRecord];
      }
      await this.buildCampaignMetaScene();
      return;
    }
    await this.buildPreparationScene();
    this.publishCampaignStageState();
    this.publishFontState();
    if (this.lifecycleSmoke) await this.startLifecycleSmoke();
    else if (this.airSupportSmoke) await this.startAirSupportSmoke();
    else if (this.synthesisSmoke) await this.startSynthesisSmoke();
    else if (this.shopSynthesisSmoke) await this.startShopSynthesisSmoke();
    else if (this.maulerBarracksSmoke) await this.startMaulerBarracksSmoke();
    else if (this.swordsmanBarracksSmoke) await this.startSwordsmanBarracksSmoke();
    else if (this.crossbowmanBarracksSmoke) await this.startCrossbowmanBarracksSmoke();
    else if (this.knightBarracksSmoke) await this.startKnightBarracksSmoke();
    else if (this.mageBarracksSmoke) await this.startMageBarracksSmoke();
    else if (this.trebuchetSmoke) await this.startTrebuchetSmoke();
    else if (this.electricityTowerSmoke) await this.startElectricityTowerSmoke();
    else if (this.mirrorTowerSmoke) await this.startMirrorTowerSmoke();
    else if (this.experienceCrystalSmoke) await this.startExperienceCrystalSmoke();
    else if (this.slowingWellSmoke) await this.startSlowingWellSmoke();
    else if (this.observationDeckSmoke) await this.startObservationDeckSmoke();
    else if (this.attackSpeedStatueSmoke) await this.startAttackSpeedStatueSmoke();
    else if (this.martialArtsFieldSmoke) await this.startMartialArtsFieldSmoke();
    else if (this.longFenceSmoke) await this.startLongFenceSmoke();
    else if (this.goldMineSmoke) await this.startGoldMineSmoke();
    else if (this.shopRefreshSmoke) await this.startShopRefreshSmoke();
    else if (this.traitSelectionSmoke) await this.startTraitSelectionSmoke();
    else if (this.repelMotionPhase) await this.startRepelMotionSmoke();
    else if (this.attackMotionPhase) await this.startAttackMotionSmoke();
    else if (this.stageCatalogSmoke) await this.startStageCatalogSmoke();
    else if (this.campaignStageBattleSmoke) await this.startFight();
    else if (this.resultSmokeOutcome) await this.startResultOverlaySmoke(this.resultSmokeOutcome);
    else if (this.visualBaselinePhase) await this.startVisualBaselineCapture();
    else if (this.normalTransitionSmoke || this.normalLifecycleSmoke) await this.startNormalTransitionSmoke();
  }

  private isCampaignMetaRoute(): boolean {
    if (typeof window === 'undefined') return false;
    const test = this.readRuntimeTestName();
    if (test === 'cocos-campaign-meta') return true;
    if (test) return false;
    const query = new URLSearchParams(window.location.search);
    if (query.get('battle') === '1') return false;
    return query.get('screen') === 'campaign' || !query.has('stage');
  }

  private async buildCampaignMetaScene(): Promise<void> {
    const background = this.makeLayer('CampaignBackground');
    const interfaceLayer = this.makeLayer('CampaignMeta');
    await this.addSprite(background, `original/maps/Map_${this.stageMapId}`, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
    this.addRect(interfaceLayer, 'CampaignTint', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, new Color(12, 24, 38, 112), new Color(12, 24, 38, 112));
    this.addRect(interfaceLayer, 'CampaignTopAssets', 22, 24, 706, 88, new Color(25, 37, 59, 238), new Color(151, 112, 55, 255));
    const assets = `银币 ${this.localProfile.props.Money || 0}    体力 ${this.localProfile.props.Stamina || 0}    钻石 ${this.localProfile.props.Diamond || 0}`;
    this.addLabel(interfaceLayer, assets, 45, 39, 660, 54, 24, new Color(255, 228, 163, 255));

    this.addRect(interfaceLayer, 'CampaignStageCard', 70, 145, 610, 970, new Color(24, 34, 56, 246), new Color(181, 138, 69, 255));
    this.addLabel(interfaceLayer, `章节 ${this.stageId}`, 180, 177, 390, 70, 44, Color.WHITE);
    this.addLabel(interfaceLayer, this.stageName, 150, 247, 450, 52, 28, new Color(255, 228, 163, 255));
    const completedWave = this.completedWaveForMetaStage(this.stageConfig);
    this.addLabel(
      interfaceLayer,
      completedWave ? `最高记录：第 ${completedWave} 波` : '最高记录：无',
      175,
      304,
      400,
      44,
      21,
      new Color(217, 230, 255, 255),
    );

    const unlockedStage = campaignUnlockedStage(this.localProfile.maxStageRecord, this.campaignStageCount);
    const left = await this.addButton(interfaceLayer, '‹', 'original/ui/button_gray', 94, 205, 72, 72, () => this.selectCampaignMetaStage(-1), 46);
    const right = await this.addButton(interfaceLayer, '›', 'original/ui/button_gray', 584, 205, 72, 72, () => this.selectCampaignMetaStage(1), 46);
    if (this.stageId <= 1) left.active = false;
    if (this.stageId >= unlockedStage) right.active = false;

    this.addLabel(interfaceLayer, '波次宝箱', 225, 375, 300, 52, 31, Color.WHITE);
    const chestStates = this.stageConfig.rewardWave.slice(0, 3).map((milestone, index) => {
      const state = waveChestState(this.stageConfig as CampaignRewardStage, index, this.localProfile);
      const y = 442 + index * 151;
      const fill = state.eligible ? new Color(54, 92, 63, 248) : new Color(21, 29, 43, 248);
      this.addRect(interfaceLayer, `CampaignChest_${index}`, 102, y, 546, 125, fill, new Color(115, 76, 36, 255));
      this.addLabel(interfaceLayer, `第 ${milestone} 波`, 122, y + 12, 180, 38, 23, Color.WHITE);
      this.addLabel(interfaceLayer, this.rewardBundleText(state.rewards), 122, y + 53, 335, 54, 18, new Color(217, 230, 255, 255));
      const buttonText = state.claimed ? '已领取' : state.eligible ? '领取' : '未达成';
      void this.addButton(
        interfaceLayer,
        buttonText,
        state.eligible ? 'original/ui/button_orange' : 'original/ui/button_gray',
        482,
        y + 31,
        138,
        62,
        () => this.claimCampaignChest(index),
        21,
      ).then((button) => { if (!state.eligible) button.active = true; });
      return { index, ...state };
    });

    await this.addButton(interfaceLayer, '进入作战', 'original/ui/button_orange', 215, 942, 320, 100, () => this.enterBattleFromCampaign(), 36);
    this.addLabel(interfaceLayer, '奖励按原版规则手动领取；战斗胜利不会自动代领。', 115, 1050, 520, 45, 18, new Color(217, 230, 255, 255));
    this.publishCampaignMetaState(chestStates);
  }

  private completedWaveForMetaStage(stage: RecoveredStageCatalogEntry): number {
    const [frontier, completedWave] = this.localProfile.maxStageRecord;
    if (stage.id < frontier) return stage.declaredWave;
    return stage.id === frontier ? completedWave : 0;
  }

  private selectCampaignMetaStage(direction: -1 | 1): void {
    if (typeof window === 'undefined') return;
    const unlocked = campaignUnlockedStage(this.localProfile.maxStageRecord, this.campaignStageCount);
    const selected = Math.max(1, Math.min(unlocked, this.stageId + direction));
    if (selected === this.stageId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('screen', 'campaign');
    url.searchParams.set('stage', String(selected));
    url.searchParams.delete('battle');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    director.loadScene('Main');
  }

  private enterBattleFromCampaign(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('stage', String(this.stageId));
    url.searchParams.set('battle', '1');
    url.searchParams.delete('screen');
    url.searchParams.delete('test');
    url.searchParams.delete('build');
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  }

  private claimCampaignChest(bundleIndex: number): void {
    const claim = claimWaveChest(this.stageConfig as CampaignRewardStage, bundleIndex, this.localProfile);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-campaign-claim', JSON.stringify({
        stage: this.stageId,
        bundleIndex,
        ok: claim.ok,
        error: claim.error,
        rewards: claim.rewards,
        profile: claim.profile,
      }));
    }
    if (!claim.ok) return;
    this.saveLocalProfile(claim.profile);
    if (this.readRuntimeTestName() === 'cocos-campaign-meta') return;
    director.loadScene('Main');
  }

  private rewardDisplayName(id: string): string {
    const names: Record<string, string> = {
      Money: '银币', Stamina: '体力', Diamond: '钻石',
      NormalRandomChip: '普通随机碎片', HighRandomChip: '高级随机碎片',
    };
    return names[id] || id;
  }

  private rewardBundleText(rewards: ReadonlyArray<RewardEntry>): string {
    return rewards.map((entry) => `${this.rewardDisplayName(entry[1])} ×${entry[2]}`).join('  ');
  }

  private publishCampaignMetaState(chests: ReadonlyArray<{ index: number; eligible: boolean; unlocked: boolean; claimed: boolean; milestone: number; key: string; rewards: RewardEntry[] }>): void {
    if (typeof document === 'undefined') return;
    const state = {
      ready: true,
      stage: this.stageId,
      name: this.stageName,
      mapId: this.stageMapId,
      maxStageRecord: this.localProfile.maxStageRecord,
      unlockedStage: campaignUnlockedStage(this.localProfile.maxStageRecord, this.campaignStageCount),
      completedWave: this.completedWaveForMetaStage(this.stageConfig),
      assets: { ...this.localProfile.props },
      chests: chests.map((state) => ({ ...state, rewards: state.rewards.map((entry) => [...entry]) })),
      storageKey: LOCAL_PROFILE_STORAGE_KEY,
      networkEnabled: false,
      layout: { stageCard: [70, 145, 610, 970], enterBattle: [215, 942, 320, 100] },
    };
    document.documentElement.setAttribute('data-cocos-campaign-meta', JSON.stringify(state));
    (window as unknown as { __cocosCampaignMeta?: typeof state }).__cocosCampaignMeta = state;
  }

  private async buildPreparationScene(): Promise<void> {
    const backgroundLayer = this.makeLayer('Background');
    this.gridLayer = this.makeLayer('StageGrid');
    this.actorLayer = this.makeLayer('Actors');
    this.projectileLayer = this.makeLayer('Projectiles');
    this.shopLayer = this.makeLayer('BattleShop');
    this.overlayLayer = this.makeLayer('Overlays');
    await this.addSprite(backgroundLayer, `original/maps/Map_${this.stageMapId}`, 0, -PREPARATION_SHIFT, 750, 1623);
    this.buildGrid();
    await this.buildTrees();
    await this.buildCastle();
    await this.buildHud();
    await this.buildShop();
    await this.buildAirSupport();
    this.overlayLayer.setSiblingIndex(this.node.children.length - 1);
  }

  private makeLayer(name: string): Node {
    const layer = new Node(name);
    layer.layer = this.node.layer;
    layer.addComponent(UITransform).setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
    this.node.addChild(layer);
    return layer;
  }

  private topLeftPosition(x: number, y: number, width: number, height: number): Vec3 {
    return new Vec3(x + width / 2 - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - y - height / 2, 0);
  }

  private localToTopLeft(position: Vec3): { x: number; y: number } {
    return { x: position.x + DESIGN_WIDTH / 2, y: DESIGN_HEIGHT / 2 - position.y };
  }

  private buildGrid(): void {
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        if (this.mapData[row][column] === 'o') continue;
        const x = GRID_X + column * CELL_STEP;
        const y = GRID_Y + row * CELL_STEP;
        this.addRect(this.gridLayer, `Floor_${column}_${row}`, x, y, CELL_SIZE, CELL_SIZE, new Color(130, 210, 85, 62), new Color(201, 242, 161, 150));
      }
    }
  }

  private async buildTrees(): Promise<void> {
    const tasks: Promise<void>[] = [];
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        if (this.mapData[row][column] !== '2') continue;
        tasks.push(this.addTree(column, row));
      }
    }
    await Promise.all(tasks);
  }

  private async addTree(column: number, row: number): Promise<void> {
    const x = GRID_X + column * CELL_STEP + 10;
    const y = GRID_Y + row * CELL_STEP + 3;
    const node = await this.addSprite(this.gridLayer, 'original/ui/tree', x, y, 72, 86);
    node.name = `Tree_${column}_${row}`;
    await this.addChildSprite(node, 'original/ui/money', -20, 17, 38, 38);
    const key = `${column}_${row}`;
    const priceLabel = this.addChildLabel(node, '0', 12, 16.5, 34, 43, 22, Color.WHITE);
    priceLabel.node.name = 'TreePrice';
    this.treePriceLabels.set(key, priceLabel);
    this.treeNodes.set(key, node);
    node.on(Node.EventType.TOUCH_END, () => this.tryClearTree(column, row));
  }

  private tryClearTree(column: number, row: number): void {
    if (this.fighting) return;
    const key = `${column}_${row}`;
    const node = this.treeNodes.get(key);
    if (!node) return;
    const prices = [0, 1, 2, 3, 4, 5];
    const price = prices[Math.min(this.treeClearCount, prices.length - 1)];
    if (this.money < price) return;
    this.money -= price;
    this.treeClearCount += 1;
    this.mapData[row] = this.replaceCell(this.mapData[row], column, '1');
    node.destroy();
    this.treeNodes.delete(key);
    this.treePriceLabels.delete(key);
    this.refreshEconomyHud();
  }

  private replaceCell(row: string, column: number, value: string): string {
    return `${row.slice(0, column)}${value}${row.slice(column + 1)}`;
  }

  private async buildCastle(): Promise<void> {
    const x = GRID_X + this.castleColumn * CELL_STEP - 18;
    const y = GRID_Y + this.castleRow * CELL_STEP - 12;
    const width = CASTLE.width * CELL_STEP - CELL_GAP + 35;
    const height = CASTLE.height * CELL_STEP - CELL_GAP + 23;
    const castle = await this.addSprite(this.gridLayer, 'original/buildings/Building_MainBase1', x, y, width, height);
    castle.name = 'Building_MainBase';
    const hpY = Math.min(1005, Math.max(820, GRID_Y + (this.castleRow + 2) * CELL_STEP - 31));
    await this.addSprite(this.gridLayer, 'original/ui/home_hp_bar_bg', 304, hpY, 143, 23);
    this.castleHpFill = await this.addSprite(this.gridLayer, 'original/ui/home_hp_bar', 308, hpY + 4, 135, 15);
    this.castleHpLabel = this.addLabel(this.gridLayer, `${this.castleHp}`, 304, hpY - 2, 143, 25, 15, Color.WHITE);
    this.castleHpLabel.node.active = false;
  }

  private async buildHud(): Promise<void> {
    const hud = this.makeLayer('HUD');
    this.hudLayer = hud;
    await this.addSprite(hud, 'original/ui/hud_pause', 39, 57, 62, 59);
    this.waveLabel = this.addLabel(hud, `波次 1/${this.waveCounts.length}`, 294, 58, 160, 58, 43, Color.WHITE);
    await this.addSprite(hud, 'original/ui/hud_progress_bg', 39, 126, 610, 22);
    this.fightLevelProgressFill = await this.addSprite(hud, 'original/ui/hud_progress_fill', 42, 129, 0, 16);
    await this.addSprite(hud, 'original/ui/hud_level_badge', 641, 115, 70, 42);
    this.fightLevelLabel = this.addLabel(hud, '0', 641, 114, 70, 43, 31, Color.WHITE);
    await this.addSprite(hud, 'original/ui/hud_counter_bg', 574, 199, 139, 40);
    await this.addSprite(hud, 'original/ui/money', 556, 195, 50, 49);
    this.moneyLabel = this.addLabel(hud, '0', 587, 198, 126, 42, 30, Color.WHITE);
    this.updateFightLevelHud();
    this.refreshEconomyHud();
  }

  private refreshEconomyHud(): void {
    if (this.moneyLabel) this.moneyLabel.string = String(this.money);
    const prices = [0, 1, 2, 3, 4, 5];
    const nextPrice = prices[Math.min(this.treeClearCount, prices.length - 1)];
    for (const label of this.treePriceLabels.values()) label.string = String(nextPrice);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-economy', JSON.stringify({
        money: this.money,
        treeClearCount: this.treeClearCount,
        nextTreePrice: nextPrice,
        wave: this.wave,
        resolvedThisWave: this.resolvedThisWave,
        waveCoinRoster: this.waveCoinRoster,
      }));
    }
  }

  private async buildShop(): Promise<void> {
    await this.addSprite(this.shopLayer, 'original/ui/shop_panel', 0, 957, 750, 347);
    this.shopRollHistory = [{
      refresh: 1,
      special: false,
      items: OPENING_SHOP.map((definition) => ({ id: definition.id, kind: definition.kind, level: definition.level })),
    }];
    await this.replaceShopOffers(OPENING_SHOP);
    this.specialRefreshButton = await this.addButton(
      this.shopLayer,
      '刷新\n必出2级装备',
      'original/ui/button_blue',
      35,
      1177,
      215,
      89,
      () => void this.specialRefresh(),
      23,
    );
    this.refreshButton = await this.addButton(this.shopLayer, '刷新', 'original/ui/button_green', 267, 1177, 215, 89, () => void this.normalRefresh(), 31);
    const refreshTitle = this.refreshButton.children[0]?.getComponent(Label);
    if (refreshTitle) refreshTitle.node.setPosition(0, 15);
    this.refreshCostIcon = await this.addChildSprite(this.refreshButton, 'original/ui/money', -20, -20, 28, 28);
    this.refreshCostLabel = this.addChildLabel(this.refreshButton, '免费', 20, -20, 70, 30, 22, Color.WHITE);
    this.refreshRefreshButtons();
    await this.addButton(this.shopLayer, '开战', 'original/ui/button_orange', 499, 1177, 215, 89, () => void this.startFight(), 34);
  }

  private async replaceShopOffers(definitions: ReadonlyArray<ShopDefinition>): Promise<void> {
    const retained: ShopItemState[] = [];
    for (const item of this.shopItems) {
      const deployed = this.placedBuildings.some((building) => building.node === item.node);
      if (deployed) retained.push(item);
      else if (item.node.isValid) item.node.destroy();
    }
    this.shopItems = retained;
    const slotX = [150, 285, 438];
    for (let index = 0; index < definitions.length; index += 1) {
      const definition = definitions[index];
      const initialX = slotX[index] ?? 150;
      const node = definition.kind === 'slot'
        ? this.createSlotOfferNode(definition, initialX, 954, 180, 160)
        : await this.addSprite(this.shopLayer, definition.sprite, initialX, 954, 180, 160, true);
      node.name = this.shopRefreshCount === 1 && definition.kind !== 'slot'
        ? `Shop_${definition.id}`
        : `Shop_${definition.id}_${this.shopRefreshCount}_${index}`;
      if (definition.kind !== 'slot') await this.attachWeaponMount(node, definition);
      const item: ShopItemState = { node, definition, home: node.position.clone(), available: true };
      this.shopItems.push(item);
      this.enableDrag(node, definition);
    }
    this.layoutVisibleShopItems();
  }

  private createSlotOfferNode(definition: ShopDefinition, x: number, y: number, width: number, height: number): Node {
    const node = new Node(`SlotOffer_${definition.slotShapeId ?? 'unknown'}`);
    node.layer = this.node.layer;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(this.topLeftPosition(x, y, width, height));
    this.shopLayer.addChild(node);
    this.drawSlotOffer(node, definition, width, height);
    return node;
  }

  private drawSlotOffer(node: Node, definition: ShopDefinition, width: number, height: number): void {
    const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
    graphics.clear();
    const columns = definition.shape.reduce((maximum, cell) => Math.max(maximum, cell[0] + 1), 1);
    const rows = definition.shape.reduce((maximum, cell) => Math.max(maximum, cell[1] + 1), 1);
    const cell = Math.min(58, (width - 20) / columns, (height - 20) / rows);
    const left = -columns * cell / 2;
    const top = rows * cell / 2;
    for (const [column, row] of definition.shape) {
      graphics.fillColor = new Color(91, 202, 98, 225);
      graphics.rect(left + column * cell + 2, top - (row + 1) * cell + 2, cell - 4, cell - 4);
      graphics.fill();
      graphics.strokeColor = new Color(221, 255, 204, 255);
      graphics.lineWidth = 3;
      graphics.rect(left + column * cell + 3, top - (row + 1) * cell + 3, cell - 6, cell - 6);
      graphics.stroke();
    }
  }

  private layoutVisibleShopItems(): void {
    const visible = this.shopItems.filter((item) => item.available && item.node.active && item.node.parent === this.shopLayer);
    const count = visible.length;
    const threeSlotX = [150, 285, 438];
    visible.forEach((item, index) => {
      const boxWidth = count >= 4 ? Math.floor(660 / count) : 180;
      const x = count >= 4 ? 45 + index * boxWidth : threeSlotX[index] ?? 150 + index * 135;
      if (item.definition.kind === 'slot') {
        item.node.getComponent(UITransform)?.setContentSize(boxWidth, 160);
        this.drawSlotOffer(item.node, item.definition, boxWidth, 160);
      } else {
        this.resizeBuildingVisual(item.node, item.definition, boxWidth, 160);
      }
      const transform = item.node.getComponent(UITransform);
      const width = transform?.contentSize.width ?? boxWidth;
      const height = transform?.contentSize.height ?? 160;
      item.node.setPosition(this.topLeftPosition(x + (boxWidth - width) / 2, 954 + 160 - height, width, height));
      item.home = item.node.position.clone();
    });
  }

  private definitionAtLevel(definition: ShopDefinition, level: number): ShopDefinition {
    let result = definition;
    while (result.level < level) {
      const upgraded = upgradeShopDefinition(result);
      if (!upgraded) break;
      result = upgraded;
    }
    return result;
  }

  private randomShopItem<T>(values: ReadonlyArray<T>): T | null {
    if (values.length === 0) return null;
    return values[Math.min(values.length - 1, Math.floor(this.shopRandom() * values.length))];
  }

  private randomBuildingOffer(rows: ReadonlyArray<ShopDefinition>, uniformLevels = false, forcedLevel?: number): ShopDefinition | null {
    const base = this.randomShopItem(rows);
    if (!base) return null;
    const level = forcedLevel ?? (uniformLevels
      ? 1 + Math.floor(this.shopRandom() * 3)
      : 1 + weightedShopIndex(shopLevelWeights(this.wave, traitSum(this.activeTraits, 'ShopQ2RateUp')), this.shopRandom));
    return this.definitionAtLevel(base, Math.max(1, level));
  }

  private randomSlotOffer(): ShopDefinition | null {
    const index = weightedShopIndex(SHOP_SLOT_SHAPES.map((slot) => slot.shopWeight), this.shopRandom);
    return index < 0 ? null : createShopSlotDefinition(SHOP_SLOT_SHAPES[index]);
  }

  private weightedShopOffer(forcedLevel?: number, allowSlot = true): ShopDefinition | null {
    let type = weightedShopIndex(
      allowSlot ? this.storeItemTypeWeights : this.storeItemTypeWeights.slice(0, 2),
      this.shopRandom,
    );
    const gold = FUNCTIONAL_SHOP_POOL.filter((definition) => definition.id === 'e18');
    const normal = FUNCTIONAL_SHOP_POOL.filter((definition) => definition.id !== 'e18');
    if (type === 2) {
      const slot = this.randomSlotOffer();
      if (slot) {
        this.lastSlotRefresh = this.shopRefreshCount;
        return slot;
      }
      type = 0;
    }
    return this.randomBuildingOffer(type === 1 ? gold : normal, false, forcedLevel);
  }

  private async rollShop(special: boolean): Promise<ShopRollRecord> {
    const definitions: ShopDefinition[] = [];
    const visibleCount = Math.max(3, Math.min(6, Math.trunc(3 + traitSum(this.activeTraits, 'ShopFreeItem'))));
    if (special) {
      const guaranteedLevel2 = this.weightedShopOffer(2, false);
      if (guaranteedLevel2) definitions.push(guaranteedLevel2);
    } else {
      this.shopRefreshCount += 1;
      const sinceSlot = this.shopRefreshCount - this.lastSlotRefresh;
      if (sinceSlot >= SHOP_GUARANTEED_SLOT_INTERVAL && sinceSlot % SHOP_GUARANTEED_SLOT_INTERVAL === 0) {
        const slot = this.randomSlotOffer();
        if (slot) {
          definitions.push(slot);
          this.lastSlotRefresh = this.shopRefreshCount;
        }
      }
    }
    while (definitions.length < visibleCount) {
      const offer = this.weightedShopOffer();
      if (offer) definitions.push(offer);
    }
    await this.replaceShopOffers(definitions.slice(0, visibleCount));
    const record: ShopRollRecord = {
      refresh: this.shopRefreshCount,
      special,
      items: definitions.slice(0, visibleCount).map((definition) => ({ id: definition.id, kind: definition.kind, level: definition.level })),
    };
    this.shopRollHistory.push(record);
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-cocos-shop-refresh', JSON.stringify(record));
    return record;
  }

  private async normalRefresh(): Promise<boolean> {
    if (this.fighting || this.finished) return false;
    if (this.firstFreeRefresh) this.firstFreeRefresh = false;
    else {
      const cost = shopRefreshCost(
        STORE_REFRESH_PRICE,
        this.activeTraits.filter((trait) => trait.effectKey === 'ShopConsume').map((trait) => trait.value),
      );
      if (this.money < cost) return false;
      this.money -= cost;
    }
    await this.rollShop(false);
    this.refreshRefreshButtons();
    this.refreshEconomyHud();
    return true;
  }

  private async specialRefresh(): Promise<boolean> {
    if (this.fighting || this.finished || this.specialRefreshUsed) return false;
    this.specialRefreshUsed = true;
    await this.rollShop(true);
    this.refreshRefreshButtons();
    return true;
  }

  private refreshRefreshButtons(): void {
    const cost = shopRefreshCost(
      STORE_REFRESH_PRICE,
      this.activeTraits.filter((trait) => trait.effectKey === 'ShopConsume').map((trait) => trait.value),
    );
    if (this.refreshCostLabel) this.refreshCostLabel.string = this.firstFreeRefresh ? '免费' : String(cost);
    if (this.refreshCostIcon) this.refreshCostIcon.active = !this.firstFreeRefresh;
    if (this.specialRefreshButton) {
      const opacity = this.specialRefreshButton.getComponent(UIOpacity) ?? this.specialRefreshButton.addComponent(UIOpacity);
      opacity.opacity = this.specialRefreshUsed ? 120 : 255;
    }
  }

  private emptyAirSupportAudit(): AirSupportAudit {
    return {
      uses: [],
      meteoriteTargets: 0,
      meteoriteImpacts: 0,
      frozenTargets: 0,
      healedUnits: 0,
      healedHp: 0,
      freezeEffects: 0,
      healingEffects: 0,
      artilleryEffects: 0,
      meteorProjectileAnimations: 0,
    };
  }

  private async buildAirSupport(): Promise<void> {
    const layer = new Node('AirSupportSkills');
    layer.layer = this.node.layer;
    layer.addComponent(UITransform).setContentSize(DESIGN_WIDTH, 120);
    this.node.addChild(layer);
    this.airSupportLayer = layer;
    const positions = [105, 326, 547];
    for (let index = 0; index < AIR_SUPPORT_SKILLS.length; index += 1) {
      const skill = AIR_SUPPORT_SKILLS[index];
      const buttonX = positions[index] + 163 / 2 - DESIGN_WIDTH / 2;
      const button = await this.addChildSprite(layer, 'original/ui/button_gray', buttonX, 0, 163, 107);
      button.name = `AirSupport_${skill.id}`;
      const icon = await this.addChildSprite(button, skill.icon, 0.5, -0.5, 196, 128);
      icon.name = `${skill.id}_icon`;
      const usedShade = this.addCenteredRect(button, 'UsedShade', 0, 0, 163, 107, new Color(17, 24, 39, 184));
      const usedLabel = this.addChildLabel(button, '已使用', 0, 0, 163, 107, 24, Color.WHITE).node;
      const opacity = button.addComponent(UIOpacity);
      opacity.opacity = 255;
      usedShade.active = false;
      usedLabel.active = false;
      button.on(Node.EventType.TOUCH_END, () => this.useAirSupport(skill.id));
      this.airSupportButtons.set(skill.id, { node: button, usedShade, usedLabel, opacity });
    }
    this.resetAirSupport();
    this.layoutAirSupport();
  }

  private addCenteredRect(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
  ): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    parent.addChild(node);
    return node;
  }

  private layoutAirSupport(): void {
    if (!this.airSupportLayer?.isValid) return;
    const visibleHeight = Math.max(DESIGN_HEIGHT, view.getVisibleSize().height);
    this.airSupportLayer.setPosition(0, -visibleHeight / 2 + 60);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-air-support-layout', JSON.stringify({
        stageHeight: visibleHeight,
        y: visibleHeight - 120,
        height: 120,
        bottom: visibleHeight,
      }));
    }
  }

  private resetAirSupport(): void {
    this.airSupportUsed.clear();
    this.airSupportEvents.length = 0;
    this.airSupportAudit = this.emptyAirSupportAudit();
    this.refreshAirSupportButtons();
    if (this.airSupportLayer) this.airSupportLayer.active = false;
    this.publishAirSupportState();
  }

  private refreshAirSupportButtons(): void {
    for (const skill of AIR_SUPPORT_SKILLS) {
      const entry = this.airSupportButtons.get(skill.id);
      if (!entry) continue;
      const used = this.airSupportUsed.has(skill.id);
      entry.opacity.opacity = used ? 145 : 255;
      entry.usedShade.active = used;
      entry.usedLabel.active = used;
    }
  }

  private publishAirSupportState(): void {
    if (typeof document === 'undefined') return;
    const layout = {
      stageHeight: Math.max(DESIGN_HEIGHT, view.getVisibleSize().height),
      y: Math.max(DESIGN_HEIGHT, view.getVisibleSize().height) - 120,
      height: 120,
      bottom: Math.max(DESIGN_HEIGHT, view.getVisibleSize().height),
    };
    const state = {
      used: Array.from(this.airSupportUsed),
      available: AIR_SUPPORT_SKILLS.filter((skill) => !this.airSupportUsed.has(skill.id)).map((skill) => skill.id),
      pendingEvents: this.airSupportEvents.length,
      audit: this.airSupportAudit,
    };
    document.documentElement.setAttribute('data-cocos-air-support', JSON.stringify(state));
    if (!this.airSupportSmoke) return;
    const assertions = {
      threeRecoveredButtons: this.airSupportButtons.size === 3,
      originalOrder: AIR_SUPPORT_SKILLS.map((skill) => skill.id).join(',') === 'meteorite,healing,freeze',
      dockedToActualStageBottom: Math.abs(layout.y + layout.height - layout.stageHeight) < 0.001,
      ...this.airSupportSmokeAssertions,
      meteoriteSnapshotCount: this.airSupportAudit.meteoriteTargets === 3,
      meteoriteClearedSnapshot: this.airSupportAudit.meteoriteImpacts === 3 && this.enemies.length === 0,
      recoveredPerTargetEffects:
        this.airSupportAudit.freezeEffects === 3
        && this.airSupportAudit.healingEffects === 1
        && this.airSupportAudit.artilleryEffects === 3,
      recoveredMeteorProjectile: this.airSupportAudit.meteorProjectileAnimations === 3,
      singleUsePerBattle: this.airSupportSmokeAssertions.repeatRejected && this.airSupportUsed.size === 3,
    };
    document.documentElement.setAttribute('data-cocos-air-support-smoke', JSON.stringify({
      ok: Object.keys(assertions).every((key) => assertions[key as keyof typeof assertions]),
      complete: this.airSupportEvents.length === 0 && this.projectiles.length === 0,
      originalFallbacks: {
        meteoriteDamage: 9999,
        freezeSeconds: 4,
        healingMaxHpRatio: 1,
        meteoriteWindowSeconds: 3,
      },
      layout,
      state,
      assertions,
    }));
  }

  private readRuntimeTestName(): string {
    const location = (globalThis as unknown as { location?: { search?: string } }).location;
    if (!location?.search) return '';
    return new URLSearchParams(location.search).get('test') ?? '';
  }

  private readVisualMotionOffsetMs(): -204 | -102 | 0 | 102 | 204 {
    const location = (globalThis as unknown as { location?: { search?: string } }).location;
    if (!location?.search) return 0;
    const value = Number(new URLSearchParams(location.search).get('motionOffsetMs') ?? '0');
    return value === -204 || value === -102 || value === 102 || value === 204 ? value : 0;
  }

  private async startAirSupportSmoke(): Promise<void> {
    await this.startFight();
    this.spawnClock = 999;
    const smokeEnemies = [
      this.createActor('enemy', STAGE2_ENEMIES[STAGE2_BASE_ENEMIES[0]].body, 255, 360, 1, undefined, STAGE2_BASE_ENEMIES[0]),
      this.createActor('enemy', STAGE2_ENEMIES[STAGE2_BASE_ENEMIES[1]].body, 375, 385, 1, undefined, STAGE2_BASE_ENEMIES[1]),
      this.createActor('enemy', STAGE2_ENEMIES[STAGE2_BASE_ENEMIES[0]].body, 495, 410, 1, undefined, STAGE2_BASE_ENEMIES[0]),
    ];
    for (const enemy of smokeEnemies) enemy.dodge = 0;
    const ally = this.createActor('ally', 'Shooter1', 375, 810);
    ally.hitPoints = ally.maxHitPoints * 0.25;
    this.updateActorHealthBar(ally, true);
    this.airSupportSmokeAssertions.healingUsed = this.useAirSupport('healing');
    this.airSupportSmokeAssertions.allyFullyHealed = Math.abs(ally.hitPoints - ally.maxHitPoints) < 0.000001;
    this.airSupportSmokeAssertions.freezeUsed = this.useAirSupport('freeze');
    this.airSupportSmokeAssertions.frozenForFourSeconds = smokeEnemies.every((enemy) => enemy.freezeRemaining === 4);
    this.airSupportSmokeAssertions.meteoriteUsed = this.useAirSupport('meteorite');
    this.airSupportSmokeAssertions.repeatRejected = !this.useAirSupport('meteorite');
    this.publishAirSupportState();
  }

  private async startSynthesisSmoke(): Promise<void> {
    const definition = OPENING_SHOP.find((item) => item.id === 'e07');
    const targetNode = this.shopLayer.getChildByName('Shop_e07');
    if (!definition || !targetNode) return;
    const column = 1;
    const row = 6;
    const shopHome = targetNode.position.clone();
    targetNode.removeFromParent();
    this.gridLayer.addChild(targetNode);
    definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const target = await this.registerPlacedBuilding(targetNode, definition, column, row, shopHome);
    this.positionPlacedBuilding(target);

    const sourceNode = await this.addSprite(this.gridLayer, definition.sprite, 0, 0, 180, 160, true);
    await this.attachWeaponMount(sourceNode, definition);
    const detected = this.findSynthesisTarget(definition, column, row, null);
    const merged = detected ? await this.mergeBuildingInto(detected, sourceNode, null, definition) : false;
    const state = {
      detected: detected === target,
      merged,
      buildingCount: this.placedBuildings.length,
      level: target.definition.level,
      attack: target.definition.attack ?? 0,
      sprite: target.definition.sprite,
      weaponMount: target.definition.weaponMount?.sprite ?? null,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-synthesis-smoke', JSON.stringify(state));
    }
  }

  private async startShopSynthesisSmoke(): Promise<void> {
    const sourceItem = this.shopItems.find((item) => item.definition.id === 'e07');
    if (!sourceItem) return;
    const definition = sourceItem.definition;
    const targetNode = await this.addSprite(this.shopLayer, definition.sprite, 520, 954, 180, 160, true);
    targetNode.name = 'Shop_e07_SynthesisTarget';
    await this.attachWeaponMount(targetNode, definition);
    const targetItem: ShopItemState = {
      node: targetNode,
      definition,
      home: targetNode.position.clone(),
      available: true,
    };
    this.shopItems.push(targetItem);
    this.enableDrag(targetNode, definition);

    sourceItem.node.setPosition(targetItem.node.position);
    const point = this.localToTopLeft(sourceItem.node.position);
    const detected = this.findShopSynthesisTarget(definition, point, sourceItem);
    const merged = detected ? await this.mergeShopItemInto(detected, sourceItem, null) : false;
    const state = {
      detected: detected === targetItem,
      merged,
      sourceAvailable: sourceItem.available,
      sourceActive: sourceItem.node.active,
      targetAvailable: targetItem.available,
      targetLevel: targetItem.definition.level,
      targetAttack: targetItem.definition.attack ?? 0,
      targetSprite: targetItem.definition.sprite,
      targetWeaponMount: targetItem.definition.weaponMount?.sprite ?? null,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-shop-synthesis-smoke', JSON.stringify(state));
    }
  }

  private async startMaulerBarracksSmoke(): Promise<void> {
    const state = {
      id: MAULER_BARRACKS.id,
      level: MAULER_BARRACKS.level,
      sprite: MAULER_BARRACKS.sprite,
      cooldownSeconds: MAULER_BARRACKS.summonCooldownSeconds ?? 0,
      summonBody: MAULER_BARRACKS.summonBody ?? null,
      summonUnitMax: MAULER_BARRACKS.summonUnitMax ?? 0,
      spawned: 0,
      spawnedBodies: [] as UnitBody[],
      cappedAtRecoveredMaximum: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    const node = await this.addSprite(this.gridLayer, MAULER_BARRACKS.sprite, 0, 0, 180, 180, true);
    node.name = 'Smoke_MaulerBarracks';
    const column = 1;
    const row = 5;
    MAULER_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, MAULER_BARRACKS, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      building.cooldown = 0;
      this.updateBuildings(0);
    }
    const spawned = this.allies.filter((ally) => ally.sourceBuildingId === building.id);
    state.spawned = spawned.length;
    state.spawnedBodies = spawned.map((ally) => ally.body);
    state.cappedAtRecoveredMaximum = spawned.length === MAULER_BARRACKS.summonUnitMax;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-mauler-barracks-smoke', JSON.stringify(state));
    }
  }

  private async startSwordsmanBarracksSmoke(): Promise<void> {
    const unit = STAGE2_UNITS.Mauler1;
    const state = {
      id: SWORDSMAN_BARRACKS.id,
      level: SWORDSMAN_BARRACKS.level,
      sprite: SWORDSMAN_BARRACKS.sprite,
      cooldownSeconds: SWORDSMAN_BARRACKS.summonCooldownSeconds ?? 0,
      summonBody: SWORDSMAN_BARRACKS.summonBody ?? null,
      summonUnitMax: SWORDSMAN_BARRACKS.summonUnitMax ?? 0,
      summonedUnit: {
        hitPoints: unit.hitPoints,
        attack: unit.attack,
        attackSpeed: unit.attackSpeed,
        speed: unit.speed,
        range: unit.attackRange,
        bulletSpeed: unit.bulletSpeed,
        attackFireFrame: unit.attackFireFrame,
      },
      actionFrameCounts: { idle: 0, move: 0, attack: 0, victory: 0 },
      spawned: 0,
      spawnedBodies: [] as UnitBody[],
      cappedAtRecoveredMaximum: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    for (const action of ['idle', 'move', 'attack', 'victory'] as const) {
      state.actionFrameCounts[action] = this.framesFor('ally', 'Mauler1', action).length;
    }
    const node = await this.addSprite(this.gridLayer, SWORDSMAN_BARRACKS.sprite, 0, 0, 276, 120, true);
    node.name = 'Smoke_SwordsmanBarracks';
    const column = 1;
    const row = 6;
    SWORDSMAN_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, SWORDSMAN_BARRACKS, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      building.cooldown = 0;
      this.updateBuildings(0);
    }
    const spawned = this.allies.filter((ally) => ally.sourceBuildingId === building.id);
    state.spawned = spawned.length;
    state.spawnedBodies = spawned.map((ally) => ally.body);
    state.cappedAtRecoveredMaximum = spawned.length === SWORDSMAN_BARRACKS.summonUnitMax;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-swordsman-barracks-smoke', JSON.stringify(state));
    }
  }

  private async startCrossbowmanBarracksSmoke(): Promise<void> {
    const unit = STAGE2_UNITS.Crossbowman1;
    const state = {
      id: CROSSBOWMAN_BARRACKS.id,
      level: CROSSBOWMAN_BARRACKS.level,
      sprite: CROSSBOWMAN_BARRACKS.sprite,
      cooldownSeconds: CROSSBOWMAN_BARRACKS.summonCooldownSeconds ?? 0,
      summonBody: CROSSBOWMAN_BARRACKS.summonBody ?? null,
      summonUnitMax: CROSSBOWMAN_BARRACKS.summonUnitMax ?? 0,
      summonedUnit: {
        hitPoints: unit.hitPoints,
        attack: unit.attack,
        attackSpeed: unit.attackSpeed,
        speed: unit.speed,
        range: unit.attackRange,
        bulletSpeed: unit.bulletSpeed,
        attackFireFrame: unit.attackFireFrame,
      },
      actionFrameCounts: { idle: 0, move: 0, attack: 0, victory: 0 },
      spawned: 0,
      spawnedBodies: [] as UnitBody[],
      cappedAtRecoveredMaximum: false,
      projectileCreatedAfterFireFrame: false,
      targetHpBefore: 0,
      targetHpAfter: 0,
      damageApplied: 0,
      rangedImpactPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    for (const action of ['idle', 'move', 'attack', 'victory'] as const) {
      state.actionFrameCounts[action] = this.framesFor('ally', 'Crossbowman1', action).length;
    }
    const node = await this.addSprite(this.gridLayer, CROSSBOWMAN_BARRACKS.sprite, 0, 0, 276, 180, true);
    node.name = 'Smoke_CrossbowmanBarracks';
    const column = 1;
    const row = 5;
    CROSSBOWMAN_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, CROSSBOWMAN_BARRACKS, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      building.cooldown = 0;
      this.updateBuildings(0);
    }
    const spawned = this.allies.filter((ally) => ally.sourceBuildingId === building.id);
    state.spawned = spawned.length;
    state.spawnedBodies = spawned.map((ally) => ally.body);
    state.cappedAtRecoveredMaximum = spawned.length === CROSSBOWMAN_BARRACKS.summonUnitMax;
    const attacker = spawned[0];
    if (attacker) {
      const point = this.actorPoint(attacker);
      const target = this.createActor('enemy', 'Swordsman1', point.x + 200, point.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
      target.dodge = 0;
      attacker.criticalChance = 0;
      attacker.attackCooldown = 0;
      state.targetHpBefore = target.hitPoints;
      this.tryActorAttack(attacker, { kind: 'actor', actor: target });
      await new Promise<void>((resolve) => setTimeout(resolve, 700));
      state.projectileCreatedAfterFireFrame = this.projectiles.length === 1;
      for (let step = 0; step < 10 && target.hitPoints === state.targetHpBefore; step += 1) this.updateProjectiles(0.04);
      state.targetHpAfter = target.hitPoints;
      state.damageApplied = state.targetHpBefore - state.targetHpAfter;
      state.rangedImpactPassed = state.damageApplied === unit.attack;
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-crossbowman-barracks-smoke', JSON.stringify(state));
    }
  }

  private async startKnightBarracksSmoke(): Promise<void> {
    const unit = STAGE2_UNITS.Knight1;
    const charge = KNIGHT_CHARGE_DIZZINESS_TRAIT;
    const state = {
      id: KNIGHT_BARRACKS.id,
      level: KNIGHT_BARRACKS.level,
      sprite: KNIGHT_BARRACKS.sprite,
      cooldownSeconds: KNIGHT_BARRACKS.summonCooldownSeconds ?? 0,
      summonBody: KNIGHT_BARRACKS.summonBody ?? null,
      summonUnitMax: KNIGHT_BARRACKS.summonUnitMax ?? 0,
      summonedUnit: {
        hitPoints: unit.hitPoints,
        attack: unit.attack,
        attackSpeed: unit.attackSpeed,
        speed: unit.speed,
        range: unit.attackRange,
        bulletSpeed: unit.bulletSpeed,
        attackFireFrame: unit.attackFireFrame,
      },
      selectedTraits: ['UnitCharge', 'UnitChargeDizziness'],
      chargePolicy: { ...charge },
      actionFrameCounts: { idle: 0, move: 0, attack: 0, victory: 0, charge: 0 },
      spawned: 0,
      spawnedBodies: [] as UnitBody[],
      cappedAtRecoveredMaximum: false,
      chargeActionSelected: false,
      chargedSpeed: 0,
      baseSpeed: 0,
      chargeConsumed: false,
      speedRestored: false,
      targetHpBefore: 0,
      targetHpAfter: 0,
      damageApplied: 0,
      chargeDamagePassed: false,
      repelApplied: false,
      dizzinessSeconds: 0,
      dizzinessPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    for (const action of ['idle', 'move', 'attack', 'victory', 'charge'] as ActorAction[]) {
      state.actionFrameCounts[action] = this.framesFor('ally', 'Knight1', action).length;
    }
    const node = await this.addSprite(this.gridLayer, KNIGHT_BARRACKS.sprite, 0, 0, 276, 180, true);
    node.name = 'Smoke_KnightBarracks';
    const column = 1;
    const row = 5;
    KNIGHT_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, KNIGHT_BARRACKS, column, row, node.position.clone());
    building.unitCharge = charge;
    this.positionPlacedBuilding(building);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      building.cooldown = 0;
      this.updateBuildings(0);
    }
    const spawned = this.allies.filter((ally) => ally.sourceBuildingId === building.id);
    state.spawned = spawned.length;
    state.spawnedBodies = spawned.map((ally) => ally.body);
    state.cappedAtRecoveredMaximum = spawned.length === KNIGHT_BARRACKS.summonUnitMax;
    const attacker = spawned[0];
    if (attacker) {
      state.chargeActionSelected = attacker.action === 'charge';
      state.chargedSpeed = attacker.speed;
      state.baseSpeed = attacker.baseSpeed;
      const point = this.actorPoint(attacker);
      const target = this.createActor('enemy', 'Swordsman1', point.x + 20, point.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
      target.dodge = 0;
      attacker.criticalChance = 0;
      attacker.attackCooldown = 0;
      state.targetHpBefore = target.hitPoints;
      this.tryActorAttack(attacker, { kind: 'actor', actor: target });
      await new Promise<void>((resolve) => setTimeout(resolve, 1050));
      state.targetHpAfter = target.hitPoints;
      state.damageApplied = state.targetHpBefore - state.targetHpAfter;
      state.chargeDamagePassed = state.damageApplied === unit.attack * charge.damageRatio;
      state.chargeConsumed = !attacker.charging;
      state.speedRestored = Math.abs(attacker.speed - attacker.baseSpeed) < 0.000001;
      state.repelApplied = target.repel !== null;
      state.dizzinessSeconds = target.dizzinessRemaining;
      state.dizzinessPassed = Math.abs(target.dizzinessRemaining - charge.dizzinessSeconds) < 0.000001;
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-knight-barracks-smoke', JSON.stringify(state));
    }
  }

  private async startMageBarracksSmoke(): Promise<void> {
    const unit = STAGE2_UNITS.Mage1;
    const state = {
      id: MAGE_BARRACKS.id,
      level: MAGE_BARRACKS.level,
      sprite: MAGE_BARRACKS.sprite,
      cooldownSeconds: MAGE_BARRACKS.summonCooldownSeconds ?? 0,
      summonBody: MAGE_BARRACKS.summonBody ?? null,
      summonUnitMax: MAGE_BARRACKS.summonUnitMax ?? 0,
      summonedUnit: {
        hitPoints: unit.hitPoints,
        attack: unit.attack,
        attackSpeed: unit.attackSpeed,
        speed: unit.speed,
        range: unit.attackRange,
        bulletSpeed: unit.bulletSpeed,
        attackFireFrame: unit.attackFireFrame,
        aoeRadiusPixels: unit.aoeRadiusPixels,
      },
      actionFrameCounts: { idle: 0, move: 0, attack: 0, victory: 0 },
      spawned: 0,
      spawnedBodies: [] as UnitBody[],
      cappedAtRecoveredMaximum: false,
      projectileCreatedAfterFireFrame: false,
      primaryDamage: 0,
      nearbyDamage: 0,
      outsideDamage: 0,
      alliedAoePassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    for (const action of ['idle', 'move', 'attack', 'victory'] as const) {
      state.actionFrameCounts[action] = this.framesFor('ally', 'Mage1', action).length;
    }
    const node = await this.addSprite(this.gridLayer, MAGE_BARRACKS.sprite, 0, 0, 180, 276, true);
    node.name = 'Smoke_MageBarracks';
    const column = 1;
    const row = 5;
    MAGE_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, MAGE_BARRACKS, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      building.cooldown = 0;
      this.updateBuildings(0);
    }
    const spawned = this.allies.filter((ally) => ally.sourceBuildingId === building.id);
    state.spawned = spawned.length;
    state.spawnedBodies = spawned.map((ally) => ally.body);
    state.cappedAtRecoveredMaximum = spawned.length === MAGE_BARRACKS.summonUnitMax;
    const attacker = spawned[0];
    if (attacker) {
      const point = this.actorPoint(attacker);
      const primary = this.createActor('enemy', 'Swordsman1', point.x + 200, point.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
      const nearby = this.createActor('enemy', 'Swordsman1', point.x + 200, point.y + 70, 1, undefined, STAGE2_BASE_ENEMIES[0]);
      const outside = this.createActor('enemy', 'Swordsman1', point.x + 200, point.y + 140, 1, undefined, STAGE2_BASE_ENEMIES[0]);
      for (const target of [primary, nearby, outside]) target.dodge = 0;
      attacker.criticalChance = 0;
      attacker.attackCooldown = 0;
      const primaryBefore = primary.hitPoints;
      const nearbyBefore = nearby.hitPoints;
      const outsideBefore = outside.hitPoints;
      this.tryActorAttack(attacker, { kind: 'actor', actor: primary });
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      state.projectileCreatedAfterFireFrame = this.projectiles.length === 1;
      for (let step = 0; step < 10 && primary.hitPoints === primaryBefore; step += 1) this.updateProjectiles(0.04);
      state.primaryDamage = primaryBefore - primary.hitPoints;
      state.nearbyDamage = nearbyBefore - nearby.hitPoints;
      state.outsideDamage = outsideBefore - outside.hitPoints;
      state.alliedAoePassed = state.primaryDamage === unit.attack
        && state.nearbyDamage === unit.attack && state.outsideDamage === 0;
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-mage-barracks-smoke', JSON.stringify(state));
    }
  }

  private async startTrebuchetSmoke(): Promise<void> {
    const state = {
      id: TREBUCHET.id,
      shape: TREBUCHET.shape,
      levelAttacks: [TREBUCHET.attack],
      hitPoints: TREBUCHET.hitPoints,
      cooldownSeconds: TREBUCHET.cooldownSeconds,
      rangePixels: TREBUCHET.rangePixels,
      projectileSpeedPixels: TREBUCHET.projectileSpeedPixels,
      projectileSize: [TREBUCHET.projectileWidth, TREBUCHET.projectileHeight],
      splashRadiusPixels: TREBUCHET.splashRadiusPixels,
      splashDamageRatio: TREBUCHET.splashDamageRatio,
      weaponMountAttached: false,
      projectileCreated: false,
      projectileForceTargetOnly: false,
      primaryDamage: 0,
      nearbyDamage: 0,
      outsideDamage: 0,
      recoveredSplashPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = TREBUCHET;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelAttacks.push(upgraded?.attack);
    }
    const deterministicDefinition: ShopDefinition = { ...TREBUCHET, criticalChance: 0 };
    const node = await this.addSprite(this.gridLayer, deterministicDefinition.sprite, 0, 0, 180, 180, true);
    node.name = 'Smoke_Trebuchet';
    await this.attachWeaponMount(node, deterministicDefinition);
    state.weaponMountAttached = !!node.getChildByName('WeaponMount');
    const column = 1;
    const row = 5;
    deterministicDefinition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, deterministicDefinition, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    const point = this.buildingPoint(building);
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const primary = this.createActor('enemy', 'Swordsman1', point.x + 300, point.y, 1, undefined, enemyDefinition);
    const nearby = this.createActor('enemy', 'Swordsman1', point.x + 300, point.y, 1, undefined, enemyDefinition);
    const outside = this.createActor('enemy', 'Swordsman1', point.x + 390, point.y, 1, undefined, enemyDefinition);
    for (const target of [primary, nearby, outside]) target.dodge = 0;
    const primaryBefore = primary.hitPoints;
    const nearbyBefore = nearby.hitPoints;
    const outsideBefore = outside.hitPoints;
    building.cooldown = 0;
    this.updateBuildings(0);
    state.projectileCreated = this.projectiles.length === 1;
    state.projectileForceTargetOnly = this.projectiles[0]?.forceTargetOnly === true;
    const lockedActor = this.projectiles[0]?.target.actor;
    for (let step = 0; step < 20 && primary.hitPoints === primaryBefore; step += 1) this.updateProjectiles(0.04);
    const firstDamage = primaryBefore - primary.hitPoints;
    const secondDamage = nearbyBefore - nearby.hitPoints;
    state.primaryDamage = lockedActor === primary ? firstDamage : secondDamage;
    state.nearbyDamage = lockedActor === primary ? secondDamage : firstDamage;
    state.outsideDamage = outsideBefore - outside.hitPoints;
    state.recoveredSplashPassed = state.primaryDamage === TREBUCHET.attack
      && state.nearbyDamage === (TREBUCHET.attack ?? 0) * (TREBUCHET.splashDamageRatio ?? 0)
      && state.outsideDamage === 0;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-trebuchet-smoke', JSON.stringify(state));
    }
  }

  private async startElectricityTowerSmoke(): Promise<void> {
    const state = {
      id: ELECTRICITY_TOWER.id,
      shape: ELECTRICITY_TOWER.shape,
      levelAttacks: [ELECTRICITY_TOWER.attack],
      hitPoints: ELECTRICITY_TOWER.hitPoints,
      cooldownSeconds: ELECTRICITY_TOWER.cooldownSeconds,
      rangePixels: ELECTRICITY_TOWER.rangePixels,
      projectileSpeedPixels: ELECTRICITY_TOWER.projectileSpeedPixels,
      projectileLifeTimeSeconds: ELECTRICITY_TOWER.projectileLifeTimeSeconds,
      jumpCount: ELECTRICITY_TOWER.jumpCount,
      weaponMountAttached: false,
      projectileCreated: false,
      projectileForceTargetOnly: false,
      projectileTint: [] as number[],
      primaryDamage: 0,
      jumpedTargetDamage: 0,
      outsideDamage: 0,
      recoveredChainPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = ELECTRICITY_TOWER;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelAttacks.push(upgraded?.attack);
    }
    const deterministicDefinition: ShopDefinition = { ...ELECTRICITY_TOWER, criticalChance: 0 };
    const node = await this.addSprite(this.gridLayer, deterministicDefinition.sprite, 0, 0, 187, 92, true);
    node.name = 'Smoke_ElectricityTower';
    await this.attachWeaponMount(node, deterministicDefinition);
    state.weaponMountAttached = !!node.getChildByName('WeaponMount');
    const column = 1;
    const row = 5;
    deterministicDefinition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, deterministicDefinition, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    const point = this.buildingPoint(building);
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const primary = this.createActor('enemy', 'Swordsman1', point.x + 300, point.y, 1, undefined, enemyDefinition);
    const jumpedTarget = this.createActor('enemy', 'Swordsman1', point.x + 380, point.y, 1, undefined, enemyDefinition);
    const outside = this.createActor('enemy', 'Swordsman1', point.x + 1050, point.y, 1, undefined, enemyDefinition);
    for (const target of [primary, jumpedTarget, outside]) target.dodge = 0;
    const primaryBefore = primary.hitPoints;
    const jumpedBefore = jumpedTarget.hitPoints;
    const outsideBefore = outside.hitPoints;
    building.cooldown = 0;
    this.updateBuildings(0);
    const projectile = this.projectiles[0];
    state.projectileCreated = this.projectiles.length === 1;
    state.projectileForceTargetOnly = projectile?.forceTargetOnly === true;
    const tint = projectile?.node.getComponent(Sprite)?.color;
    if (tint) state.projectileTint = [tint.r, tint.g, tint.b, tint.a];
    for (let step = 0; step < 20 && jumpedTarget.hitPoints === jumpedBefore; step += 1) this.updateProjectiles(0.04);
    state.primaryDamage = primaryBefore - primary.hitPoints;
    state.jumpedTargetDamage = jumpedBefore - jumpedTarget.hitPoints;
    state.outsideDamage = outsideBefore - outside.hitPoints;
    state.recoveredChainPassed = state.primaryDamage === ELECTRICITY_TOWER.attack
      && state.jumpedTargetDamage === ELECTRICITY_TOWER.attack
      && state.outsideDamage === 0 && this.projectiles.length === 0;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-electricity-tower-smoke', JSON.stringify(state));
    }
  }

  private async startMirrorTowerSmoke(): Promise<void> {
    const state = {
      id: MIRROR_TOWER.id,
      shape: MIRROR_TOWER.shape,
      levelAttacks: [MIRROR_TOWER.attack],
      hitPoints: MIRROR_TOWER.hitPoints,
      cooldownSeconds: MIRROR_TOWER.cooldownSeconds,
      rangePixels: MIRROR_TOWER.rangePixels,
      laserDurationSeconds: MIRROR_TOWER.laserDurationSeconds,
      laserTickIntervalSeconds: MIRROR_TOWER.laserTickIntervalSeconds,
      weaponMountAttached: false,
      laserCreated: false,
      immediateDamage: 0,
      totalDamage: 0,
      hitCount: 0,
      laserRemovedAfterDuration: false,
      recoveredLaserPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = MIRROR_TOWER;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelAttacks.push(upgraded?.attack);
    }
    const deterministicDefinition: ShopDefinition = { ...MIRROR_TOWER, criticalChance: 0 };
    const node = await this.addSprite(this.gridLayer, deterministicDefinition.sprite, 0, 0, 92, 187, true);
    node.name = 'Smoke_MirrorTower';
    await this.attachWeaponMount(node, deterministicDefinition);
    state.weaponMountAttached = !!node.getChildByName('WeaponMount');
    const column = 1;
    const row = 3;
    deterministicDefinition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, deterministicDefinition, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    const point = this.buildingPoint(building);
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const target = this.createActor('enemy', 'Swordsman1', point.x + 320, point.y, 1, undefined, enemyDefinition);
    target.dodge = 0;
    const before = target.hitPoints;
    building.cooldown = 0;
    this.updateBuildings(0);
    state.laserCreated = this.laserEffects.length === 1;
    state.immediateDamage = before - target.hitPoints;
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-cocos-mirror-tower-phase', 'beam');
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    for (let tick = 0; tick < 8; tick += 1) this.updateLaserEffects(0.25);
    state.totalDamage = before - target.hitPoints;
    state.hitCount = state.totalDamage / Math.max(1, deterministicDefinition.attack ?? 1);
    state.laserRemovedAfterDuration = this.laserEffects.length === 0;
    state.recoveredLaserPassed = state.immediateDamage === MIRROR_TOWER.attack
      && state.totalDamage === (MIRROR_TOWER.attack ?? 0) * 8
      && state.hitCount === 8 && state.laserRemovedAfterDuration;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-mirror-tower-phase', 'complete');
      document.documentElement.setAttribute('data-cocos-mirror-tower-smoke', JSON.stringify(state));
    }
  }

  private async startExperienceCrystalSmoke(): Promise<void> {
    const state = {
      id: EXPERIENCE_CRYSTAL.id,
      shape: EXPERIENCE_CRYSTAL.shape,
      hitPoints: EXPERIENCE_CRYSTAL.hitPoints,
      levelBonuses: [EXPERIENCE_CRYSTAL.experienceBonus],
      normalEnemyBaseExperience: STAGE2_EXPERIENCE.normal,
      fightLevelExperienceFix: STAGE2_EXPERIENCE.fightLevelFix,
      activeBonus: 0,
      withBuildingBattleGain: 0,
      withBuildingFightLevelGain: 0,
      inactiveBonus: -1,
      withoutBuildingBattleGain: 0,
      withoutBuildingFightLevelGain: 0,
      bonusRemovedWhenInactive: false,
      recoveredExperiencePassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = EXPERIENCE_CRYSTAL;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelBonuses.push(upgraded?.experienceBonus);
    }
    const node = await this.addSprite(this.gridLayer, EXPERIENCE_CRYSTAL.sprite, 0, 0, 78, 87, true);
    node.name = 'Smoke_ExperienceCrystal';
    const column = 1;
    const row = 5;
    EXPERIENCE_CRYSTAL.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, EXPERIENCE_CRYSTAL, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    state.activeBonus = this.activeBuildingExperienceBonus();
    const point = this.buildingPoint(building);
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const first = this.createActor('enemy', 'Swordsman1', point.x + 230, point.y, 1, undefined, enemyDefinition);
    first.dodge = 0;
    first.hitPoints = 1;
    const battleBefore = this.battleExperience;
    const fightBefore = this.fightLevelExperience;
    this.applyCombatImpact({ kind: 'actor', actor: first }, 1, 0, 1, 'ally', 0, point, 0, 0, point);
    state.withBuildingBattleGain = this.battleExperience - battleBefore;
    state.withBuildingFightLevelGain = Number((this.fightLevelExperience - fightBefore).toFixed(6));
    building.node.active = false;
    state.inactiveBonus = this.activeBuildingExperienceBonus();
    const second = this.createActor('enemy', 'Swordsman1', point.x + 230, point.y + 110, 1, undefined, enemyDefinition);
    second.dodge = 0;
    second.hitPoints = 1;
    const battleWithoutBefore = this.battleExperience;
    const fightWithoutBefore = this.fightLevelExperience;
    this.applyCombatImpact({ kind: 'actor', actor: second }, 1, 0, 1, 'ally', 0, point, 0, 0, point);
    state.withoutBuildingBattleGain = this.battleExperience - battleWithoutBefore;
    state.withoutBuildingFightLevelGain = Number((this.fightLevelExperience - fightWithoutBefore).toFixed(6));
    building.node.active = true;
    state.bonusRemovedWhenInactive = state.inactiveBonus === 0;
    state.recoveredExperiencePassed = state.activeBonus === 0.05
      && state.withBuildingBattleGain === 11
      && Math.abs(state.withBuildingFightLevelGain - 8.4) < 0.000001
      && state.withoutBuildingBattleGain === 10
      && Math.abs(state.withoutBuildingFightLevelGain - 8) < 0.000001
      && state.bonusRemovedWhenInactive;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-experience-crystal-smoke', JSON.stringify(state));
    }
  }

  private async startSlowingWellSmoke(): Promise<void> {
    const state = {
      id: SLOWING_WELL.id,
      shape: SLOWING_WELL.shape,
      hitPoints: SLOWING_WELL.hitPoints,
      levelSlowAmounts: [SLOWING_WELL.enemySlowAmount],
      activeMultiplier: 0,
      inactiveMultiplier: 0,
      activeDistance: 0,
      inactiveDistance: 0,
      measuredDistanceRatio: 0,
      bonusRemovedWhenInactive: false,
      recoveredSlowPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = SLOWING_WELL;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelSlowAmounts.push(upgraded?.enemySlowAmount);
    }
    const node = await this.addSprite(this.gridLayer, SLOWING_WELL.sprite, 0, 0, 72, 167, true);
    node.name = 'Smoke_SlowingWell';
    const column = 1;
    const row = 4;
    SLOWING_WELL.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, SLOWING_WELL, column, row, node.position.clone());
    this.positionPlacedBuilding(building);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    state.activeMultiplier = this.activeEnemySpeedMultiplier();
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const enemy = this.createActor('enemy', 'Swordsman1', 500, 330, 1, undefined, enemyDefinition);
    const destination = { x: 500, y: 900 };
    const start = this.actorPoint(enemy);
    enemy.routeRandom = null;
    this.moveActor(enemy, destination, 0.2);
    state.activeDistance = Number(distanceBetween(start, this.actorPoint(enemy)).toFixed(6));
    enemy.node.setPosition(this.centerPosition(start.x, start.y));
    enemy.routeRandom = null;
    building.node.active = false;
    state.inactiveMultiplier = this.activeEnemySpeedMultiplier();
    this.moveActor(enemy, destination, 0.2);
    state.inactiveDistance = Number(distanceBetween(start, this.actorPoint(enemy)).toFixed(6));
    state.measuredDistanceRatio = Number((state.activeDistance / state.inactiveDistance).toFixed(6));
    building.node.active = true;
    state.bonusRemovedWhenInactive = state.inactiveMultiplier === 1;
    state.recoveredSlowPassed = state.levelSlowAmounts.every((amount, index) => Math.abs((amount ?? 0) - [0.05, 0.075, 0.115, 0.175][index]) < 0.000001)
      && Math.abs(state.activeMultiplier - 1 / 1.05) < 0.000001
      && Math.abs(state.measuredDistanceRatio - state.activeMultiplier) < 0.000001
      && state.bonusRemovedWhenInactive;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-slowing-well-smoke', JSON.stringify(state));
    }
  }

  private async startObservationDeckSmoke(): Promise<void> {
    const state = {
      id: OBSERVATION_DECK.id,
      shape: OBSERVATION_DECK.shape,
      hitPoints: OBSERVATION_DECK.hitPoints,
      levelCriticalBonuses: [OBSERVATION_DECK.globalCriticalChanceBonus],
      activeBonus: 0,
      towerCriticalChanceWithAura: 0,
      towerDamageWithAura: 0,
      alliedDamageWithAura: 0,
      inactiveBonus: -1,
      towerDamageWithoutAura: 0,
      alliedDamageWithoutAura: 0,
      bonusRemovedWhenInactive: false,
      recoveredCriticalAuraPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = OBSERVATION_DECK;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelCriticalBonuses.push(upgraded?.globalCriticalChanceBonus);
    }
    const auraNode = await this.addSprite(this.gridLayer, OBSERVATION_DECK.sprite, 0, 0, 82, 142, true);
    auraNode.name = 'Smoke_ObservationDeck';
    const auraColumn = 3;
    const auraRow = 4;
    OBSERVATION_DECK.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${auraColumn + offsetX}_${auraRow + offsetY}`));
    const aura = await this.registerPlacedBuilding(auraNode, OBSERVATION_DECK, auraColumn, auraRow, auraNode.position.clone());
    this.positionPlacedBuilding(aura);
    const towerNode = await this.addSprite(this.gridLayer, MIRROR_TOWER.sprite, 0, 0, 92, 187, true);
    towerNode.name = 'Smoke_ObservationDeckTower';
    await this.attachWeaponMount(towerNode, MIRROR_TOWER);
    const towerColumn = 1;
    const towerRow = 3;
    MIRROR_TOWER.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${towerColumn + offsetX}_${towerRow + offsetY}`));
    const tower = await this.registerPlacedBuilding(towerNode, MIRROR_TOWER, towerColumn, towerRow, towerNode.position.clone());
    this.positionPlacedBuilding(tower);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    state.activeBonus = this.activeGlobalCriticalChanceBonus();
    state.towerCriticalChanceWithAura = criticalChanceWithAura(MIRROR_TOWER.criticalChance ?? 0, [state.activeBonus]);
    const towerPoint = this.buildingPoint(tower);
    const enemyDefinition = STAGE2_BASE_ENEMIES[0];
    const previousRandom = Math.random;
    Math.random = () => 0.08;
    try {
      const towerTarget = this.createActor('enemy', 'Swordsman1', towerPoint.x + 320, towerPoint.y, 1, undefined, enemyDefinition);
      towerTarget.dodge = 0;
      towerTarget.hitPoints = 30;
      const towerBefore = towerTarget.hitPoints;
      tower.cooldown = 0;
      this.updateBuildings(0);
      state.towerDamageWithAura = towerBefore - towerTarget.hitPoints;

      const ally = this.createActor('ally', 'Swordsman1', 500, 500);
      const alliedTarget = this.createActor('enemy', 'Swordsman1', 520, 500, 1, undefined, enemyDefinition);
      alliedTarget.dodge = 0;
      alliedTarget.hitPoints = 60;
      const alliedBefore = alliedTarget.hitPoints;
      this.tryActorAttack(ally, { kind: 'actor', actor: alliedTarget });
      await new Promise<void>((resolve) => setTimeout(resolve, 950));
      state.alliedDamageWithAura = alliedBefore - alliedTarget.hitPoints;

      aura.node.active = false;
      state.inactiveBonus = this.activeGlobalCriticalChanceBonus();
      const normalTowerTarget = this.createActor('enemy', 'Swordsman1', towerPoint.x + 320, towerPoint.y, 1, undefined, enemyDefinition);
      normalTowerTarget.dodge = 0;
      normalTowerTarget.hitPoints = 20;
      const normalTowerBefore = normalTowerTarget.hitPoints;
      tower.cooldown = 0;
      this.updateBuildings(0);
      state.towerDamageWithoutAura = normalTowerBefore - normalTowerTarget.hitPoints;

      const normalAlliedTarget = this.createActor('enemy', 'Swordsman1', 520, 500, 1, undefined, enemyDefinition);
      normalAlliedTarget.dodge = 0;
      normalAlliedTarget.hitPoints = 30;
      const normalAlliedBefore = normalAlliedTarget.hitPoints;
      ally.attackCooldown = 0;
      this.tryActorAttack(ally, { kind: 'actor', actor: normalAlliedTarget });
      await new Promise<void>((resolve) => setTimeout(resolve, 950));
      state.alliedDamageWithoutAura = normalAlliedBefore - normalAlliedTarget.hitPoints;
    } finally {
      Math.random = previousRandom;
      aura.node.active = true;
    }
    state.bonusRemovedWhenInactive = state.inactiveBonus === 0;
    state.recoveredCriticalAuraPassed = state.levelCriticalBonuses.every((bonus, index) => Math.abs((bonus ?? 0) - [0.05, 0.075, 0.115, 0.175][index]) < 0.000001)
      && state.activeBonus === 0.05 && state.towerCriticalChanceWithAura === 0.1
      && state.towerDamageWithAura === 30 && state.towerDamageWithoutAura === 20
      && state.alliedDamageWithAura === 60 && state.alliedDamageWithoutAura === 30
      && state.bonusRemovedWhenInactive;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-observation-deck-smoke', JSON.stringify(state));
    }
  }

  private async startAttackSpeedStatueSmoke(): Promise<void> {
    const state = {
      id: ATTACK_SPEED_STATUE.id,
      shape: ATTACK_SPEED_STATUE.shape,
      hitPoints: ATTACK_SPEED_STATUE.hitPoints,
      levelSpeedBonuses: [ATTACK_SPEED_STATUE.adjacentAttackSpeedBonus],
      towerAdjacent: false,
      barracksAdjacent: false,
      towerCooldownWithAura: 0,
      barracksCooldownWithAura: 0,
      towerCooldownWithoutAura: 0,
      barracksCooldownWithoutAura: 0,
      inactiveBonus: -1,
      recoveredAdjacentSpeedAuraPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = ATTACK_SPEED_STATUE;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelSpeedBonuses.push(upgraded?.adjacentAttackSpeedBonus);
    }

    const auraColumn = 3;
    const auraRow = 4;
    const auraNode = await this.addSprite(this.gridLayer, ATTACK_SPEED_STATUE.sprite, 0, 0, 101, 196, true);
    auraNode.name = 'Smoke_AttackSpeedStatue';
    ATTACK_SPEED_STATUE.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${auraColumn + offsetX}_${auraRow + offsetY}`));
    const aura = await this.registerPlacedBuilding(auraNode, ATTACK_SPEED_STATUE, auraColumn, auraRow, auraNode.position.clone());
    this.positionPlacedBuilding(aura);

    const towerDefinition = OPENING_SHOP.find((definition) => definition.id === 'e07')!;
    const towerColumn = 2;
    const towerRow = 4;
    const towerNode = await this.addSprite(this.gridLayer, towerDefinition.sprite, 0, 0, 92, 92, true);
    towerNode.name = 'Smoke_AttackSpeedTower';
    await this.attachWeaponMount(towerNode, towerDefinition);
    towerDefinition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${towerColumn + offsetX}_${towerRow + offsetY}`));
    const tower = await this.registerPlacedBuilding(towerNode, towerDefinition, towerColumn, towerRow, towerNode.position.clone());
    this.positionPlacedBuilding(tower);

    const barracksColumn = 1;
    const barracksRow = 6;
    const barracksNode = await this.addSprite(this.gridLayer, SWORDSMAN_BARRACKS.sprite, 0, 0, 276, 120, true);
    barracksNode.name = 'Smoke_AttackSpeedBarracks';
    SWORDSMAN_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${barracksColumn + offsetX}_${barracksRow + offsetY}`));
    const barracks = await this.registerPlacedBuilding(barracksNode, SWORDSMAN_BARRACKS, barracksColumn, barracksRow, barracksNode.position.clone());
    this.positionPlacedBuilding(barracks);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);

    state.towerAdjacent = areGridFootprintsAdjacent(
      aura.column, aura.row, aura.definition.shape,
      tower.column, tower.row, tower.definition.shape,
    );
    state.barracksAdjacent = areGridFootprintsAdjacent(
      aura.column, aura.row, aura.definition.shape,
      barracks.column, barracks.row, barracks.definition.shape,
    );
    const towerPoint = this.buildingPoint(tower);
    const enemy = this.createActor('enemy', 'Swordsman1', towerPoint.x + 240, towerPoint.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    enemy.dodge = 0;
    tower.cooldown = 0;
    barracks.cooldown = 0;
    this.updateBuildings(0);
    state.towerCooldownWithAura = tower.cooldown;
    state.barracksCooldownWithAura = barracks.cooldown;

    aura.node.active = false;
    tower.cooldown = 0;
    barracks.cooldown = 0;
    this.updateBuildings(0);
    state.towerCooldownWithoutAura = tower.cooldown;
    state.barracksCooldownWithoutAura = barracks.cooldown;
    state.inactiveBonus = this.adjacentAttackSpeedBonuses(tower).reduce((sum, bonus) => sum + bonus, 0);
    aura.node.active = true;

    state.recoveredAdjacentSpeedAuraPassed = state.levelSpeedBonuses.every((bonus, index) => Math.abs((bonus ?? 0) - [0.05, 0.075, 0.115, 0.175][index]) < 0.000001)
      && state.towerAdjacent && state.barracksAdjacent
      && Math.abs(state.towerCooldownWithAura - 2 / 1.05) < 0.000001
      && Math.abs(state.barracksCooldownWithAura - 9 / 1.05) < 0.000001
      && state.towerCooldownWithoutAura === 2
      && state.barracksCooldownWithoutAura === 9
      && state.inactiveBonus === 0;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-attack-speed-statue-smoke', JSON.stringify(state));
    }
  }

  private async startMartialArtsFieldSmoke(): Promise<void> {
    const state = {
      id: MARTIAL_ARTS_FIELD.id,
      shape: MARTIAL_ARTS_FIELD.shape,
      hitPoints: MARTIAL_ARTS_FIELD.hitPoints,
      levelAttackBonuses: [MARTIAL_ARTS_FIELD.adjacentAttackBonus],
      shippedUpgradeKeyMismatchPreserved: false,
      towerAdjacent: false,
      barracksAdjacent: false,
      towerDamageWithAura: 0,
      towerDamageWithoutAura: 0,
      alliedDamageWithAura: 0,
      alliedDamageWithoutAura: 0,
      inactiveBonus: -1,
      recoveredAdjacentAttackAuraPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = MARTIAL_ARTS_FIELD;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelAttackBonuses.push(upgraded?.adjacentAttackBonus);
    }
    state.shippedUpgradeKeyMismatchPreserved = state.levelAttackBonuses.every((bonus) => bonus === 0.05);

    const auraColumn = 3;
    const auraRow = 4;
    const auraNode = await this.addSprite(this.gridLayer, MARTIAL_ARTS_FIELD.sprite, 0, 0, 151, 82, true);
    auraNode.name = 'Smoke_MartialArtsField';
    MARTIAL_ARTS_FIELD.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${auraColumn + offsetX}_${auraRow + offsetY}`));
    const aura = await this.registerPlacedBuilding(auraNode, MARTIAL_ARTS_FIELD, auraColumn, auraRow, auraNode.position.clone());
    this.positionPlacedBuilding(aura);

    const baseTowerDefinition = OPENING_SHOP.find((definition) => definition.id === 'e07')!;
    const towerDefinition: ShopDefinition = { ...baseTowerDefinition, criticalChance: 0 };
    const towerColumn = 2;
    const towerRow = 4;
    const towerNode = await this.addSprite(this.gridLayer, towerDefinition.sprite, 0, 0, 92, 92, true);
    towerNode.name = 'Smoke_MartialArtsFieldTower';
    await this.attachWeaponMount(towerNode, towerDefinition);
    towerDefinition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${towerColumn + offsetX}_${towerRow + offsetY}`));
    const tower = await this.registerPlacedBuilding(towerNode, towerDefinition, towerColumn, towerRow, towerNode.position.clone());
    this.positionPlacedBuilding(tower);

    const barracksColumn = 1;
    const barracksRow = 5;
    const barracksNode = await this.addSprite(this.gridLayer, MAULER_BARRACKS.sprite, 0, 0, 180, 180, true);
    barracksNode.name = 'Smoke_MartialArtsFieldBarracks';
    MAULER_BARRACKS.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${barracksColumn + offsetX}_${barracksRow + offsetY}`));
    const barracks = await this.registerPlacedBuilding(barracksNode, MAULER_BARRACKS, barracksColumn, barracksRow, barracksNode.position.clone());
    this.positionPlacedBuilding(barracks);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);

    state.towerAdjacent = areGridFootprintsAdjacent(
      aura.column, aura.row, aura.definition.shape,
      tower.column, tower.row, tower.definition.shape,
    );
    state.barracksAdjacent = areGridFootprintsAdjacent(
      aura.column, aura.row, aura.definition.shape,
      barracks.column, barracks.row, barracks.definition.shape,
    );
    const towerPoint = this.buildingPoint(tower);
    const towerTarget = this.createActor('enemy', 'Swordsman1', towerPoint.x + 240, towerPoint.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    towerTarget.dodge = 0;
    const towerAuraBefore = towerTarget.hitPoints;
    tower.cooldown = 0;
    barracks.cooldown = 0;
    this.updateBuildings(0);
    for (let step = 0; step < 10 && towerTarget.hitPoints === towerAuraBefore; step += 1) this.updateProjectiles(0.04);
    state.towerDamageWithAura = towerAuraBefore - towerTarget.hitPoints;
    const ally = this.allies.find((actor) => actor.sourceBuildingId === barracks.id)!;
    ally.criticalChance = 0;

    aura.node.active = false;
    const towerNormalBefore = towerTarget.hitPoints;
    tower.cooldown = 0;
    this.updateBuildings(0);
    for (let step = 0; step < 10 && towerTarget.hitPoints === towerNormalBefore; step += 1) this.updateProjectiles(0.04);
    state.towerDamageWithoutAura = towerNormalBefore - towerTarget.hitPoints;
    state.inactiveBonus = this.adjacentAttackBonuses(tower).reduce((sum, bonus) => sum + bonus, 0);

    aura.node.active = true;
    const allyPoint = this.actorPoint(ally);
    const alliedTarget = this.createActor('enemy', 'Swordsman1', allyPoint.x + 20, allyPoint.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    alliedTarget.dodge = 0;
    const alliedAuraBefore = alliedTarget.hitPoints;
    ally.attackCooldown = 0;
    this.tryActorAttack(ally, { kind: 'actor', actor: alliedTarget });
    await new Promise<void>((resolve) => setTimeout(resolve, 950));
    state.alliedDamageWithAura = alliedAuraBefore - alliedTarget.hitPoints;

    aura.node.active = false;
    const normalAlliedTarget = this.createActor('enemy', 'Swordsman1', allyPoint.x + 20, allyPoint.y, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    normalAlliedTarget.dodge = 0;
    const alliedNormalBefore = normalAlliedTarget.hitPoints;
    ally.attackCooldown = 0;
    this.tryActorAttack(ally, { kind: 'actor', actor: normalAlliedTarget });
    await new Promise<void>((resolve) => setTimeout(resolve, 950));
    state.alliedDamageWithoutAura = alliedNormalBefore - normalAlliedTarget.hitPoints;
    aura.node.active = true;

    state.recoveredAdjacentAttackAuraPassed = state.shippedUpgradeKeyMismatchPreserved
      && state.towerAdjacent && state.barracksAdjacent
      && state.towerDamageWithAura === 21 && state.towerDamageWithoutAura === 20
      && state.alliedDamageWithAura === 31 && state.alliedDamageWithoutAura === 30
      && state.inactiveBonus === 0;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-martial-arts-field-smoke', JSON.stringify(state));
    }
  }

  private async startLongFenceSmoke(): Promise<void> {
    const state = {
      id: LONG_FENCE.id,
      shape: LONG_FENCE.shape,
      levelHitPoints: [LONG_FENCE.hitPoints],
      selectedAsNearestBuilding: false,
      damageTaken: 0,
      hitPointsAfterAttack: LONG_FENCE.hitPoints,
      remainsActiveAfterAttack: false,
      recoveredLongFencePassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    let upgraded: ShopDefinition | null = LONG_FENCE;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelHitPoints.push(upgraded?.hitPoints ?? 0);
    }

    const column = 2;
    const row = 4;
    const node = await this.addSprite(this.gridLayer, LONG_FENCE.sprite, 0, 0, 222, 67, true);
    node.name = 'Smoke_LongFence';
    LONG_FENCE.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const wall = await this.registerPlacedBuilding(node, LONG_FENCE, column, row, node.position.clone());
    this.positionPlacedBuilding(wall);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);

    const wallPoint = this.buildingPoint(wall);
    const enemy = this.createActor('enemy', 'Swordsman1', wallPoint.x, wallPoint.y - 30, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    enemy.criticalChance = 0;
    enemy.attackCooldown = 0;
    const selectedTarget = this.findEnemyTarget(enemy);
    state.selectedAsNearestBuilding = selectedTarget?.kind === 'building' && selectedTarget.building === wall;
    const hitPointsBeforeAttack = wall.hitPoints;
    if (selectedTarget) this.tryActorAttack(enemy, selectedTarget);
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    state.damageTaken = hitPointsBeforeAttack - wall.hitPoints;
    state.hitPointsAfterAttack = wall.hitPoints;
    state.remainsActiveAfterAttack = wall.node.active;
    state.recoveredLongFencePassed = state.levelHitPoints.every((hitPoints, index) => Math.abs(hitPoints - [507, 760.5, 1166.1, 1774.5][index]) < 0.000001)
      && state.selectedAsNearestBuilding
      && state.damageTaken === 30
      && state.hitPointsAfterAttack === 477
      && state.remainsActiveAfterAttack;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-long-fence-smoke', JSON.stringify(state));
    }
  }

  private async startGoldMineSmoke(): Promise<void> {
    const state = {
      id: GOLD_MINE.id,
      shape: GOLD_MINE.shape,
      hitPoints: GOLD_MINE.hitPoints,
      levelMoney: [GOLD_MINE.moneyPerWave],
      startMoney: 10,
      afterLevel1Wave: 0,
      afterDestroyedWave: 0,
      afterLevel4Wave: 0,
      afterFinalWave: 0,
      finalWavePaid: false,
      recoveredGoldMinePassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    let upgraded: ShopDefinition | null = GOLD_MINE;
    while (upgraded && upgraded.level < 4) {
      upgraded = upgradeShopDefinition(upgraded);
      state.levelMoney.push(upgraded?.moneyPerWave ?? 0);
    }

    const column = 3;
    const row = 5;
    const node = await this.addSprite(this.gridLayer, GOLD_MINE.sprite, 0, 0, 76, 73, true);
    node.name = 'Smoke_GoldMine';
    this.occupied.add(`${column}_${row}`);
    const mine = await this.registerPlacedBuilding(node, GOLD_MINE, column, row, node.position.clone());
    this.positionPlacedBuilding(mine);
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);

    this.money = state.startMoney;
    this.wave = 1;
    this.spawnedThisWave = STAGE2_WAVE_COUNTS[0];
    this.enemies.length = 0;
    this.fighting = true;
    this.checkWaveComplete();
    state.afterLevel1Wave = this.money;

    mine.hitPoints = 0;
    mine.node.active = false;
    this.spawnedThisWave = STAGE2_WAVE_COUNTS[1];
    this.enemies.length = 0;
    this.fighting = true;
    this.checkWaveComplete();
    state.afterDestroyedWave = this.money;

    const level4 = upgraded!;
    mine.definition = level4;
    mine.hitPoints = level4.hitPoints;
    mine.maxHitPoints = level4.hitPoints;
    mine.node.active = true;
    this.spawnedThisWave = STAGE2_WAVE_COUNTS[2];
    this.enemies.length = 0;
    this.fighting = true;
    this.checkWaveComplete();
    state.afterLevel4Wave = this.money;

    this.wave = STAGE2_WAVE_COUNTS.length;
    this.spawnedThisWave = STAGE2_WAVE_COUNTS[STAGE2_WAVE_COUNTS.length - 1];
    this.enemies.length = 0;
    this.fighting = true;
    const beforeFinalWave = this.money;
    this.checkWaveComplete();
    state.afterFinalWave = this.money;
    state.finalWavePaid = state.afterFinalWave !== beforeFinalWave;
    state.recoveredGoldMinePassed = state.levelMoney.every((money, index) => money === [1, 2, 4, 8][index])
      && state.afterLevel1Wave === 11
      && state.afterDestroyedWave === 11
      && state.afterLevel4Wave === 19
      && state.afterFinalWave === 19
      && !state.finalWavePaid;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-gold-mine-smoke', JSON.stringify(state));
    }
  }

  private async startShopRefreshSmoke(): Promise<void> {
    const state = {
      typeWeights: [...this.storeItemTypeWeights],
      wave1LevelWeights: [...shopLevelWeights(1)],
      wave5LevelWeights: [...shopLevelWeights(5)],
      refreshPrice: shopRefreshCost(STORE_REFRESH_PRICE),
      initialRefreshCount: this.shopRefreshCount,
      firstRefreshFree: false,
      moneyAfterFreeRefresh: 0,
      moneyAfterPaidRefresh: 0,
      guaranteedSlotWithinThree: false,
      slotExpandedCells: 0,
      moneyAfterSecondPaidRefresh: 0,
      insufficientMoneyBlocked: false,
      specialFirstItemLevel: 0,
      specialDidNotAdvanceRegularCount: false,
      specialSecondUseBlocked: false,
      normalHistory: [] as ShopRollRecord[],
      specialHistory: [] as ShopRollRecord[],
      recoveredShopRefreshPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }

    this.money = 30;
    const beforeFree = this.money;
    const freeResult = await this.normalRefresh();
    const firstNormal = this.shopRollHistory[this.shopRollHistory.length - 1];
    state.firstRefreshFree = freeResult && this.money === beforeFree;
    state.moneyAfterFreeRefresh = this.money;
    state.normalHistory.push(firstNormal);

    const paidResult = await this.normalRefresh();
    const secondNormal = this.shopRollHistory[this.shopRollHistory.length - 1];
    state.moneyAfterPaidRefresh = this.money;
    state.normalHistory.push(secondNormal);
    state.guaranteedSlotWithinThree = state.normalHistory.some((record) => record.items.some((item) => item.kind === 'slot'));

    const guaranteedSlotItem = this.shopItems.find((item) => item.definition.kind === 'slot') ?? null;
    const beforeSlot = this.mapData[0][0];
    if (guaranteedSlotItem) {
      const targetX = GRID_X + CELL_STEP / 2;
      const targetY = GRID_Y + CELL_STEP / 2;
      guaranteedSlotItem.node.setPosition(targetX - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - targetY);
      this.drag = {
        node: guaranteedSlotItem.node,
        definition: guaranteedSlotItem.definition,
        home: guaranteedSlotItem.home.clone(),
        existing: null,
        shopItem: guaranteedSlotItem,
      };
      this.finishDrag();
    }
    state.slotExpandedCells = beforeSlot === 'o' && this.mapData[0][0] === '1' ? 1 : 0;
    const slotExpanded = state.slotExpandedCells === 1 && !!guaranteedSlotItem && !guaranteedSlotItem.available && !guaranteedSlotItem.node.active;

    const secondPaidResult = await this.normalRefresh();
    state.moneyAfterSecondPaidRefresh = this.money;
    const countBeforeBlocked = this.shopRefreshCount;
    const historyBeforeBlocked = this.shopRollHistory.length;
    const blockedResult = await this.normalRefresh();
    state.insufficientMoneyBlocked = !blockedResult
      && this.shopRefreshCount === countBeforeBlocked
      && this.shopRollHistory.length === historyBeforeBlocked
      && this.money === 0;

    const regularCountBeforeSpecial = this.shopRefreshCount;
    const specialResult = await this.specialRefresh();
    const specialRecord = this.shopRollHistory[this.shopRollHistory.length - 1];
    state.specialHistory.push(specialRecord);
    state.specialFirstItemLevel = specialRecord.items[0]?.level ?? 0;
    state.specialDidNotAdvanceRegularCount = specialResult && this.shopRefreshCount === regularCountBeforeSpecial;
    const secondSpecialResult = await this.specialRefresh();
    state.specialSecondUseBlocked = !secondSpecialResult && this.shopRollHistory.length === historyBeforeBlocked + 1;

    state.recoveredShopRefreshPassed = state.typeWeights.join(',') === '887,100,13'
      && state.wave1LevelWeights.every((weight, index) => Math.abs(weight - [0.88, 0.06, 0.06][index]) < 0.000001)
      && state.wave5LevelWeights.every((weight, index) => Math.abs(weight - [0.844, 0.084, 0.072][index]) < 0.000001)
      && state.refreshPrice === 15
      && state.initialRefreshCount === 1
      && state.firstRefreshFree && state.moneyAfterFreeRefresh === 30
      && paidResult && state.moneyAfterPaidRefresh === 15
      && state.guaranteedSlotWithinThree && slotExpanded
      && secondPaidResult && state.moneyAfterSecondPaidRefresh === 0
      && state.insufficientMoneyBlocked
      && state.specialFirstItemLevel === 2
      && state.specialDidNotAdvanceRegularCount
      && state.specialSecondUseBlocked;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-shop-refresh-smoke', JSON.stringify(state));
    }
  }

  private async startTraitSelectionSmoke(): Promise<void> {
    const state = {
      threshold: FIGHT_LEVEL_EXPERIENCE[0],
      levelBefore: this.fightLevel,
      levelAfter: 0,
      experienceAfter: 0,
      choiceCount: 0,
      uniqueChoices: false,
      legendaryChoiceCount: 0,
      battleRetained: false,
      panelVisible: false,
      attackBefore: 0,
      attackAfter: 0,
      attackTraitApplied: false,
      recoveredTraitSelectionPassed: false,
      errors: [] as string[],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    this.shopLayer.active = false;
    this.airSupportLayer.active = false;
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    this.fighting = true;
    const ally = this.createActor('ally', 'Shooter1', 375, 850);
    state.attackBefore = ally.attack;
    this.fightLevelExperience = 19;
    this.grantFightLevelExperience(STAGE2_EXPERIENCE.normal, 0);
    state.levelAfter = this.fightLevel;
    state.experienceAfter = this.fightLevelExperience;
    state.choiceCount = this.currentTraitChoices.length;
    state.uniqueChoices = new Set(this.currentTraitChoices.map((trait) => `${trait.id}:${trait.quality}`)).size
      === this.currentTraitChoices.length;
    state.legendaryChoiceCount = this.currentTraitChoices.filter((trait) => trait.quality === 3).length;
    state.battleRetained = this.fighting && this.traitSelecting;
    state.panelVisible = !!this.traitPanel?.active;
    this.applyGeneralTrait({ type: 'general', id: 1, quality: 1, value: 0.05, effectKey: 'AllUnitAtk' });
    state.attackAfter = ally.attack;
    state.attackTraitApplied = Math.abs(state.attackAfter - state.attackBefore * 1.05) < 0.000001;
    state.recoveredTraitSelectionPassed = state.threshold === 20
      && state.levelBefore === 0
      && state.levelAfter === 1
      && state.experienceAfter === 0
      && state.choiceCount === 3
      && state.uniqueChoices
      && state.legendaryChoiceCount <= 1
      && state.battleRetained
      && state.panelVisible
      && state.attackTraitApplied;
    this.publishTraitSelectionState();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-trait-selection-smoke', JSON.stringify(state));
    }
  }

  /** Runs the first transition with shipped stage values; only the initial drag gestures are automated. */
  private async startNormalTransitionSmoke(): Promise<void> {
    this.normalTransitionSmokeState = {
      mode: this.normalLifecycleSmoke ? 'full-lifecycle' : 'wave-one-transition',
      active: true,
      placedBuildingIds: [],
      completedWaves: [],
      wave: this.wave,
      fighting: false,
      finished: false,
      victory: false,
      shopVisible: this.shopLayer.active,
      shopRefreshCount: this.shopRefreshCount,
      shopRollHistoryLength: this.shopRollHistory.length,
      shopOfferIds: this.shopItems.filter((item) => item.available).map((item) => item.definition.id),
      fightLevel: this.fightLevel,
      fightLevelExperience: this.fightLevelExperience,
      fightLevelThreshold: FIGHT_LEVEL_EXPERIENCE[this.fightLevel] ?? 0,
      progressWidth: 0,
      levelText: this.fightLevelLabel.string,
      traitPanelVisible: false,
      selectedTraitCount: 0,
      reachedWaveTwoPreparation: false,
      castleHp: this.castleHp,
      survivingAllies: 0,
      spawnedThisWave: this.spawnedThisWave,
      resolvedThisWave: this.resolvedThisWave,
      activeBuildings: [],
      allyDiagnostics: [],
      enemyDiagnostics: [],
      projectileDiagnostics: [],
      passed: false,
      errors: [],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => this.normalTransitionSmokeState?.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => this.normalTransitionSmokeState?.errors.push(String(event.reason)));
    }
    const placements = [
      { id: 'e02', column: 1, row: 5 },
      { id: 'e07', column: 3, row: 5 },
      { id: 'e16', column: 3, row: 4 },
    ];
    for (const placement of placements) {
      if (await this.placeOpeningShopItem(placement.id, placement.column, placement.row)) {
        this.normalTransitionSmokeState.placedBuildingIds.push(placement.id);
      }
    }
    this.publishNormalTransitionSmokeState();
    await this.startFight();
    this.publishNormalTransitionSmokeState();
  }

  /** Deterministic presentation-only routes for matched Cocos/reference captures. */
  private async startStageCatalogSmoke(): Promise<void> {
    const [stages, enemies, variants, desert, snowfield] = await Promise.all([
      this.loadJsonAsset<RecoveredStageCatalogEntry[]>('original/data/stages'),
      this.loadJsonAsset<RecoveredEnemyCatalogEntry[]>('original/data/enemies'),
      this.loadJsonAsset<RecoveredEnemyCatalogEntry[]>('original/data/enemy-variants'),
      this.loadSpriteFrame('original/maps/Map_Desert'),
      this.loadSpriteFrame('original/maps/Map_Snowfield'),
    ]);
    const errors: string[] = [];
    const stageIds = stages.map((stage) => stage.id);
    const totalWaves = stages.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.length, 0);
    const totalRosterEntries = stages.reduce(
      (sum, stage) => sum + stage.waveEnemyCountsEffective.reduce((waveSum, count) => waveSum + count, 0),
      0,
    );
    const rewardBundles = stages.reduce((sum, stage) => sum + stage.chestRewards.length, 0);
    const referencedEnemyIds = Array.from(new Set(stages.reduce<string[]>((ids, stage) => ids.concat(stage.enemies), []))).sort();
    const baseEnemyIds = enemies.map((enemy) => enemy.id).sort();
    if (stages.length !== 220) errors.push(`stage-count:${stages.length}`);
    if (stageIds.some((id, index) => id !== index + 1)) errors.push('stage-ids-not-contiguous');
    if (totalWaves !== 2620) errors.push(`wave-count:${totalWaves}`);
    if (totalRosterEntries !== 60588) errors.push(`roster-count:${totalRosterEntries}`);
    if (rewardBundles !== 660) errors.push(`reward-bundles:${rewardBundles}`);
    if (stages.some((stage) => stage.mapData.length !== 9 || stage.mapData.some((row) => row.length !== 7))) {
      errors.push('invalid-map-grid');
    }
    if (JSON.stringify(referencedEnemyIds) !== JSON.stringify(baseEnemyIds)) errors.push('enemy-reference-mismatch');
    const state = {
      ready: true,
      passed: errors.length === 0,
      stageCount: stages.length,
      totalWaves,
      totalRosterEntries,
      rewardBundles,
      mapIds: Array.from(new Set(stages.map((stage) => stage.mapId))).sort(),
      referencedEnemyIds,
      baseEnemyCount: enemies.length,
      enemyVariantCount: variants.length,
      extraMapFrames: {
        desert: [desert.rect.width, desert.rect.height],
        snowfield: [snowfield.rect.width, snowfield.rect.height],
      },
      errors,
    };
    if (typeof window !== 'undefined') {
      (window as unknown as { __cocosStageCatalog?: typeof state }).__cocosStageCatalog = state;
      document.documentElement.setAttribute('data-cocos-stage-catalog', JSON.stringify(state));
    }
  }

  private async startResultOverlaySmoke(outcome: 'victory' | 'defeat'): Promise<void> {
    const victory = outcome === 'victory';
    this.wave = victory ? this.waveCounts.length : Math.min(2, this.waveCounts.length);
    this.spawnedThisWave = victory ? this.waveCounts[this.waveCounts.length - 1] : Math.min(4, this.waveCounts[this.wave - 1]);
    this.resolvedThisWave = this.spawnedThisWave;
    this.kills = victory ? this.waveCounts.reduce((sum, count) => sum + count, 0) : this.spawnedThisWave;
    this.battleExperience = victory ? 390 : 88;
    this.money = victory ? 103 : 47;
    if (!victory) this.castleHp = 0;
    this.refreshEconomyHud();
    this.refreshCastleHp();
    this.finishRun(victory);
  }

  private async startVisualBaselineCapture(): Promise<void> {
    const phase = this.visualBaselinePhase;
    if (!phase) return;
    const shooterLevelTwo = OPENING_SHOP.find((definition) => definition.id === 'e02');
    const arrowLevelOne = OPENING_SHOP.find((definition) => definition.id === 'e07');
    const fenceLevelOne = OPENING_SHOP.find((definition) => definition.id === 'e16');
    const arrowLevelTwo = arrowLevelOne ? upgradeShopDefinition(arrowLevelOne) : null;
    const fenceLevelTwo = fenceLevelOne ? upgradeShopDefinition(fenceLevelOne) : null;
    const shooterLevelOne: ShopDefinition | null = shooterLevelTwo ? {
      ...shooterLevelTwo,
      level: 1,
      sprite: 'original/buildings/Building_Shooter1',
      summonCooldownSeconds: 9,
      summonUnitMax: 2,
    } : null;
    if (phase === 'drag') {
      const placed = !!shooterLevelTwo && await this.placeVisualBaselineBuilding(shooterLevelTwo, 5, 6);
      this.visualBaselinePlacedBuildingIds = placed ? [`${shooterLevelTwo!.id}:${shooterLevelTwo!.level}`] : [];
      const first = this.shopItems[0];
      if (first && arrowLevelOne) {
        first.definition = arrowLevelOne;
        first.available = true;
        first.node.active = true;
        const sprite = first.node.getComponent(Sprite);
        if (sprite) sprite.spriteFrame = await this.loadSpriteFrame(arrowLevelOne.sprite);
        first.node.getChildByName('WeaponMount')?.destroy();
        await this.attachWeaponMount(first.node, arrowLevelOne);
      }
      for (const item of this.shopItems.slice(1)) this.consumeShopItem(item, null);
      this.layoutVisibleShopItems();
      if (fenceLevelOne) {
        const column = 3;
        const row = 4;
        const x = GRID_X + column * CELL_STEP;
        const y = GRID_Y + row * CELL_STEP;
        this.addRect(
          this.gridLayer,
          'VisualDragHighlight',
          x,
          y,
          CELL_SIZE,
          CELL_SIZE,
          new Color(34, 243, 63, 184),
          new Color(86, 255, 99, 255),
        );
        const ghost = await this.addSprite(this.gridLayer, fenceLevelOne.sprite, x, y, CELL_SIZE, CELL_SIZE, true);
        ghost.name = 'VisualDragGhost';
        const ghostSprite = ghost.getComponent(Sprite);
        if (ghostSprite) ghostSprite.color = new Color(255, 255, 255, 245);
      }
      this.visualBaselineFrozen = placed && !!first && !!arrowLevelOne && !!fenceLevelOne;
      this.publishVisualBaselineCaptureState();
      return;
    }
    const placements = [
      { definition: shooterLevelOne, column: 1, row: 5 },
      { definition: fenceLevelTwo, column: 3, row: 4 },
      { definition: arrowLevelTwo, column: 3, row: 5 },
      { definition: shooterLevelTwo ?? null, column: 5, row: 5 },
    ];
    const placedBuildingIds: string[] = [];
    for (const placement of placements) {
      if (placement.definition && await this.placeVisualBaselineBuilding(placement.definition, placement.column, placement.row)) {
        placedBuildingIds.push(`${placement.definition.id}:${placement.definition.level}`);
      }
    }
    this.visualBaselinePlacedBuildingIds = placedBuildingIds;
    for (const item of this.shopItems) {
      if (item.definition.id === 'e02' || item.definition.id === 'e07') this.consumeShopItem(item, null);
    }
    this.firstFreeRefresh = false;
    this.refreshRefreshButtons();
    if (phase !== 'prep') {
      await this.startFight();
      // The supplied t12/t18 frames predate the active-skill strip becoming visible.
      this.airSupportLayer.active = false;
      if (this.visualMotionWindow) this.installVisualMotionWindowActors(this.visualMotionWindow, this.visualMotionOffsetMs);
      else this.installVisualBaselineActors(phase);
      this.visualBaselineFrozen = true;
    } else this.visualBaselineFrozen = true;
    this.publishVisualBaselineCaptureState();
  }

  /** Port the evidence-fixed t12/t18 actor arrangement from the validated Laya baseline. */
  private installVisualBaselineActors(phase: 'wave-start' | 'combat'): void {
    const enemySpecs: Array<{
      id: Stage2EnemyId;
      x: number;
      y: number;
      action: ActorAction;
      frame: number;
      flipped: boolean;
      hpRatio?: number;
    }> = phase === 'wave-start'
      ? [
          { id: 'gb_E916AA75', x: 216.899, y: 65.331, action: 'move', frame: 8, flipped: true },
          { id: 'js_9F2D53C8', x: 359.321, y: 69.251, action: 'move', frame: 9, flipped: false },
          { id: 'js_9F2D53C8', x: 410.279, y: 43.118, action: 'move', frame: 6, flipped: false },
        ]
      : [
          { id: 'js_9F2D53C8', x: 514.808, y: 339.721, action: 'move', frame: 9, flipped: false },
          { id: 'gb_E916AA75', x: 533.101, y: 398.519, action: 'move', frame: 7, flipped: true },
          { id: 'js_9F2D53C8', x: 283.537, y: 522.648, action: 'move', frame: 1, flipped: false, hpRatio: 0.12 },
        ];
    for (const spec of enemySpecs) {
      const definition = STAGE2_ENEMIES[spec.id];
      const actor = this.createActor('enemy', definition.body, spec.x, spec.y, 1, undefined, spec.id);
      if (spec.hpRatio !== undefined) actor.hitPoints = Math.max(1, Math.round(actor.maxHitPoints * spec.hpRatio));
      this.freezeVisualActorFrame(actor, spec.action, spec.frame, spec.flipped);
      this.updateActorHealthBar(actor);
    }
    if (phase === 'combat') {
      const allySpecs = [
        { x: 205.139, y: 806.185, frame: 2, flipped: false },
        { x: 474.303, y: 836.237, frame: 4, flipped: true },
      ] as const;
      for (const spec of allySpecs) {
        const ally = this.createActor('ally', 'Shooter1', spec.x, spec.y);
        this.freezeVisualActorFrame(ally, 'idle', spec.frame, spec.flipped);
      }
      this.spawnDamageText(260, 354, 30, Color.WHITE);
    }
  }

  /** Freeze one evidence-only actor at the matched source action frame and facing. */
  private freezeVisualActorFrame(actor: CombatActor, action: ActorAction, frameIndex: number, flipped: boolean): void {
    const frames = this.framesFor(actor.team, actor.body, action);
    actor.action = action;
    actor.animator.play(frames, 0.102, true);
    actor.animator.seek(frameIndex);
    actor.animator.pause();
    actor.visual.setScale(flipped ? -1 : 1, 1, 1);
  }

  /** Render one timestamp-addressable original-video sample without mutating production timing. */
  private installVisualMotionWindowActors(windowId: 't12' | 't18', offsetMs: -204 | -102 | 0 | 102 | 204): void {
    for (const track of VISUAL_MOTION_WINDOWS[windowId]) {
      const sample = track.samples.find((candidate) => candidate.offsetMs === offsetMs) ?? track.samples[2];
      const actor = track.team === 'enemy'
        ? this.createActor('enemy', track.body, sample.x, sample.y, 1, undefined, track.enemyId)
        : this.createActor('ally', track.body, sample.x, sample.y);
      actor.node.name = `VisualMotion_${windowId}_${track.id}_${offsetMs}`;
      if (track.hpRatio !== undefined) {
        actor.hitPoints = Math.max(1, Math.round(actor.maxHitPoints * track.hpRatio));
        this.updateActorHealthBar(actor);
      }
      this.freezeVisualActorFrame(actor, sample.action, sample.frame, sample.flipped);
    }
    if (windowId === 't18') this.spawnDamageText(260, 354, 30, Color.WHITE);
  }

  /** Controlled production-path proof for elite outgoing repel and Stage 2 Boss repel resistance. */
  private async startRepelMotionSmoke(): Promise<void> {
    const phase = this.repelMotionPhase;
    if (!phase) return;
    const eliteId: Stage2EnemyId = 'jrjs_D1DC19C8';
    const bossId: Stage2EnemyId = 'gbtl_27AAAA80';
    const eliteDefinition = STAGE2_ENEMIES[eliteId];
    const bossDefinition = STAGE2_ENEMIES[bossId];
    const state: RepelMotionSmokeState = {
      phase,
      ready: false,
      passed: false,
      errors: [],
      elite: {
        id: eliteId,
        repelPhysicsUnitsPerSecond: eliteDefinition.repelPhysicsUnitsPerSecond,
        repelSeconds: eliteDefinition.repelSeconds,
        targetTrace: [],
        applied: false,
        displacementPixels: 0,
      },
      boss: {
        id: bossId,
        repelResist: bossDefinition.repelResist,
        start: { x: 0, y: 0 },
        after: { x: 0, y: 0 },
        rejected: false,
      },
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    this.shopLayer.active = false;
    this.airSupportLayer.active = false;
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    this.actorLayer.active = true;

    const elite = this.createActor('enemy', eliteDefinition.body, 250, 350, 1, undefined, eliteId);
    const target = this.createActor('ally', 'Knight1', 250, 500);
    const boss = this.createActor('enemy', bossDefinition.body, 500, 350, 1, undefined, bossId);
    target.dodge = 1;
    const targetStart = this.actorPoint(target);
    state.boss.start = this.actorPoint(boss);
    const recordTarget = (timeSeconds: number): void => {
      const point = this.actorPoint(target);
      state.elite.targetTrace.push({
        timeSeconds,
        x: point.x,
        y: point.y,
        remainingSeconds: target.repel?.remaining ?? 0,
      });
    };
    recordTarget(0);
    this.applyCombatHit(
      { kind: 'actor', actor: target },
      0,
      0,
      1,
      'enemy',
      elite.repelPhysicsUnitsPerSecond,
      elite.repelSeconds,
      this.actorPoint(elite),
    );
    state.elite.applied = !!target.repel;
    for (let step = 1; step <= 3; step += 1) {
      this.updateRepelledActor(target, 0.1);
      recordTarget(step * 0.1);
    }
    const targetAfter = this.actorPoint(target);
    state.elite.displacementPixels = distanceBetween(targetStart, targetAfter);

    const bossApplied = this.applyRepel(
      boss,
      { x: 500, y: 500 },
      KNIGHT_CHARGE_TRAIT.repelPhysicsUnitsPerSecond,
      KNIGHT_CHARGE_TRAIT.repelSeconds,
    );
    this.updateRepelledActor(boss, 0.1);
    state.boss.after = this.actorPoint(boss);
    state.boss.rejected = !bossApplied && boss.repel === null
      && distanceBetween(state.boss.start, state.boss.after) < 0.000001;

    if (phase === 'before') target.node.setPosition(this.centerPosition(targetStart.x, targetStart.y));
    const trace = state.elite.targetTrace;
    state.passed = state.elite.applied
      && Math.abs(state.elite.displacementPixels - 120) < 0.000001
      && trace.length === 4
      && trace.every((point, index) => index === 0 || point.y > trace[index - 1].y)
      && state.boss.repelResist
      && state.boss.rejected
      && state.errors.length === 0;
    state.ready = true;
    this.repelMotionFrozen = true;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-repel-motion-smoke', JSON.stringify(state));
    }
  }

  /** Stable production-path captures for the recovered Crossbowman attack animation and fire frame. */
  private async startAttackMotionSmoke(): Promise<void> {
    const phase = this.attackMotionPhase;
    if (!phase) return;
    const unit = STAGE2_UNITS.Crossbowman1;
    const captureSteps = phase === 'windup' ? 5 : phase === 'fire' ? unit.attackFireFrame : 8;
    const intervalSeconds = 0.102;
    const state: AttackMotionSmokeState = {
      phase,
      ready: false,
      passed: false,
      errors: [],
      attacker: {
        body: 'Crossbowman1',
        frameCount: 0,
        fireFrame: unit.attackFireFrame,
        intervalSeconds,
        captureClockSeconds: captureSteps * intervalSeconds,
        currentFrameIndex: 0,
        currentFrameName: null,
        attacking: false,
        attackLockRemaining: 0,
      },
      target: { hitPointsBefore: 0, hitPointsAfter: 0, damageApplied: 0 },
      projectileCount: 0,
      trace: [],
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => state.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => state.errors.push(String(event.reason)));
    }
    await this.preloadBattleFrames();
    this.shopLayer.active = false;
    this.airSupportLayer.active = false;
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    this.actorLayer.active = true;

    const attacker = this.createActor('ally', 'Crossbowman1', 250, 550);
    const target = this.createActor('enemy', 'Swordsman1', 500, 550, 1, undefined, STAGE2_BASE_ENEMIES[0]);
    target.dodge = 0;
    attacker.criticalChance = 0;
    attacker.attackCooldown = 0;
    state.attacker.frameCount = this.framesFor('ally', 'Crossbowman1', 'attack').length;
    state.target.hitPointsBefore = target.hitPoints;
    this.tryActorAttack(attacker, { kind: 'actor', actor: target });
    const record = (step: number): void => {
      state.trace.push({
        timeSeconds: step * intervalSeconds,
        frameIndex: attacker.animator.getCurrentFrameIndex(),
        frameName: attacker.animator.getCurrentFrameName(),
        projectileCount: this.projectiles.length,
        targetHitPoints: target.hitPoints,
      });
    };
    record(0);
    for (let step = 1; step <= captureSteps; step += 1) {
      attacker.animator.update(intervalSeconds);
      target.animator.update(intervalSeconds);
      this.updateCombatDelays(intervalSeconds);
      this.updateActorAttackLock(attacker, intervalSeconds);
      this.updateProjectiles(intervalSeconds);
      record(step);
    }
    attacker.animator.pause();
    target.animator.pause();
    state.attacker.currentFrameIndex = attacker.animator.getCurrentFrameIndex();
    state.attacker.currentFrameName = attacker.animator.getCurrentFrameName();
    state.attacker.attacking = attacker.attacking;
    state.attacker.attackLockRemaining = attacker.attackLockRemaining;
    state.target.hitPointsAfter = target.hitPoints;
    state.target.damageApplied = state.target.hitPointsBefore - state.target.hitPointsAfter;
    state.projectileCount = this.projectiles.length;
    const expectedProjectileCount = phase === 'fire' ? 1 : 0;
    const expectedDamage = phase === 'recovery' ? unit.attack : 0;
    state.passed = state.attacker.frameCount === 9
      && state.attacker.fireFrame === 6
      && state.attacker.currentFrameIndex === captureSteps
      && state.attacker.currentFrameName?.endsWith(`attack_${captureSteps}`) === true
      && state.trace.slice(0, 6).every((point) => point.projectileCount === 0)
      && state.projectileCount === expectedProjectileCount
      && state.target.damageApplied === expectedDamage
      && state.errors.length === 0;
    state.ready = true;
    this.attackMotionFrozen = true;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-attack-motion-smoke', JSON.stringify(state));
    }
  }

  private publishVisualBaselineCaptureState(): void {
    const phase = this.visualBaselinePhase;
    if (!phase || typeof document === 'undefined') return;
    const anchorTimeSeconds = phase === 'drag' ? 2 : phase === 'prep' ? 7 : phase === 'wave-start' ? 12 : 18;
    const referenceTimeSeconds = anchorTimeSeconds + (this.visualMotionWindow ? this.visualMotionOffsetMs / 1000 : 0);
    const targetClock = 0;
    const readyCount = phase === 'drag' ? 1 : 4;
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-visual-baseline', JSON.stringify({
        phase,
        deterministicSeed: 20260824,
        designResolution: [DESIGN_WIDTH, DESIGN_HEIGHT],
        placedBuildingIds: this.visualBaselinePlacedBuildingIds,
        wave: this.wave,
        fighting: this.fighting,
        shopVisible: this.shopLayer.active,
        airSupportVisible: this.airSupportLayer.active,
        dragCandidate: phase === 'drag' ? { id: 'e16', level: 1, column: 3, row: 4, valid: true } : null,
        referenceTimeSeconds,
        visualMotionWindow: this.visualMotionWindow,
        visualMotionOffsetMs: this.visualMotionWindow ? this.visualMotionOffsetMs : null,
        evidenceReplayOnly: !!this.visualMotionWindow,
        motionEvidence: this.visualMotionWindow
          ? VISUAL_MOTION_WINDOWS[this.visualMotionWindow].map((track) => {
              const sample = track.samples.find((candidate) => candidate.offsetMs === this.visualMotionOffsetMs) ?? track.samples[2];
              return {
                id: track.id,
                centerReliable: sample.centerReliable,
                phaseReliable: sample.phaseReliable,
              };
            })
          : null,
        evidenceFixedActorLayout: phase === 'wave-start' || phase === 'combat',
        actors: [...this.enemies, ...this.allies].map((actor) => ({
          team: actor.team,
          body: actor.body,
          x: this.actorPoint(actor).x,
          y: this.actorPoint(actor).y,
          hitPoints: actor.hitPoints,
          maxHitPoints: actor.maxHitPoints,
          action: actor.action,
          frameIndex: actor.animator.getCurrentFrameIndex(),
          frameName: actor.animator.getCurrentFrameName(),
          flippedHorizontally: actor.visual.scale.x < 0,
        })),
        simulationCaptureTimeSeconds: targetClock,
        simulationClockSeconds: this.visualBaselineClock,
        frozen: this.visualBaselineFrozen,
        ready: this.visualBaselinePlacedBuildingIds.length === readyCount && this.visualBaselineFrozen,
      }));
    }
  }

  private updateVisualBaselineCaptureClock(delta: number): void {
    const phase = this.visualBaselinePhase;
    if (!phase || phase === 'drag' || phase === 'prep' || this.visualBaselineFrozen) return;
    const targetClock = 0;
    this.visualBaselineClock = Math.min(targetClock, this.visualBaselineClock + delta);
    if (this.visualBaselineClock + 0.000001 < targetClock) return;
    this.visualBaselineFrozen = true;
    this.publishVisualBaselineCaptureState();
  }

  private async placeVisualBaselineBuilding(definition: ShopDefinition, column: number, row: number): Promise<boolean> {
    if (!definition.shape.every(([offsetX, offsetY]) => isBuildable(this.mapData, column + offsetX, row + offsetY)
      && !this.occupied.has(`${column + offsetX}_${row + offsetY}`)
      && !this.isCastleCellAt(column + offsetX, row + offsetY))) return false;
    const node = await this.addSprite(this.gridLayer, definition.sprite, 0, 0, 180, 160, true);
    await this.attachWeaponMount(node, definition);
    definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(node, definition, column, row, new Vec3());
    this.positionPlacedBuilding(building);
    return true;
  }

  private async placeOpeningShopItem(id: string, column: number, row: number): Promise<boolean> {
    const item = this.shopItems.find((candidate) => candidate.available && candidate.definition.id === id);
    if (!item) return false;
    return this.placeShopItemAt(item, column, row);
  }

  private canPlaceShopItemAt(item: ShopItemState, column: number, row: number): boolean {
    return item.definition.shape.every(([offsetX, offsetY]) => {
      const cellColumn = column + offsetX;
      const cellRow = row + offsetY;
      return isBuildable(this.mapData, cellColumn, cellRow)
        && !this.occupied.has(`${cellColumn}_${cellRow}`)
        && !this.isCastleCellAt(cellColumn, cellRow);
    });
  }

  private async placeShopItemAt(item: ShopItemState, column: number, row: number): Promise<boolean> {
    if (!item.available || item.definition.kind === 'slot' || !this.canPlaceShopItemAt(item, column, row)) return false;
    item.available = false;
    item.node.removeFromParent();
    this.gridLayer.addChild(item.node);
    item.definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const building = await this.registerPlacedBuilding(item.node, item.definition, column, row, item.home);
    this.positionPlacedBuilding(building);
    return true;
  }

  /** Test input adapter: drag every ordinary wave offer to the first evidenced bottom-up valid footprint. */
  private async deployLifecycleShopOffers(): Promise<void> {
    while (this.treeNodes.size > 0) {
      const treeKey = this.treeNodes.keys().next().value;
      if (typeof treeKey !== 'string') break;
      const prices = [0, 1, 2, 3, 4, 5];
      const price = prices[Math.min(this.treeClearCount, prices.length - 1)];
      if (this.money < price) break;
      const [column, row] = treeKey.split('_').map(Number);
      this.tryClearTree(column, row);
    }
    for (const item of [...this.shopItems]) {
      if (!item.available || item.definition.kind === 'slot' || item.node.parent !== this.shopLayer) continue;
      const maxColumnOffset = item.definition.shape.reduce((maximum, [column]) => Math.max(maximum, column), 0);
      const maxRowOffset = item.definition.shape.reduce((maximum, [, row]) => Math.max(maximum, row), 0);
      let placed = false;
      for (let row = 8 - maxRowOffset; row >= 0 && !placed; row -= 1) {
        for (let column = 0; column <= 6 - maxColumnOffset; column += 1) {
          if (!this.canPlaceShopItemAt(item, column, row)) continue;
          placed = await this.placeShopItemAt(item, column, row);
          if (placed) break;
        }
      }
      if (placed) continue;
      const synthesisTarget = this.placedBuildings.find((building) => building.node.active
        && canSynthesizeBuildings(item.definition, building.definition));
      if (synthesisTarget) await this.mergeBuildingInto(synthesisTarget, item.node, null, item.definition);
    }
  }

  private publishNormalTransitionSmokeState(): void {
    const state = this.normalTransitionSmokeState;
    if (!state) return;
    state.wave = this.wave;
    state.fighting = this.fighting;
    state.finished = this.finished;
    state.shopVisible = this.shopLayer.active;
    state.shopRefreshCount = this.shopRefreshCount;
    state.shopRollHistoryLength = this.shopRollHistory.length;
    state.shopOfferIds = this.shopItems.filter((item) => item.available && item.node.active).map((item) => item.definition.id);
    state.fightLevel = this.fightLevel;
    state.fightLevelExperience = this.fightLevelExperience;
    state.fightLevelThreshold = FIGHT_LEVEL_EXPERIENCE[this.fightLevel] ?? 0;
    state.progressWidth = this.fightLevelProgressFill.getComponent(UITransform)?.contentSize.width ?? 0;
    state.levelText = this.fightLevelLabel.string;
    state.traitPanelVisible = this.traitSelecting && !!this.traitPanel?.active;
    state.selectedTraitCount = this.activeTraits.length;
    state.reachedWaveTwoPreparation = this.wave === 2 && !this.fighting && this.shopLayer.active;
    state.castleHp = this.castleHp;
    state.survivingAllies = this.allies.filter((ally) => ally.node.active && ally.hitPoints > 0).length;
    state.spawnedThisWave = this.spawnedThisWave;
    state.resolvedThisWave = this.resolvedThisWave;
    state.activeBuildings = this.placedBuildings.filter((building) => building.node.active && building.hitPoints > 0).map((building) => ({
      id: building.definition.id,
      level: building.definition.level,
      kind: building.definition.kind,
      hp: building.hitPoints,
    }));
    state.allyDiagnostics = this.allies.filter((ally) => ally.hitPoints > 0 && ally.node.isValid).map((ally) => {
      const point = this.actorPoint(ally);
      return {
        id: ally.id,
        body: ally.body,
        hp: ally.hitPoints,
        action: ally.action,
        attacking: ally.attacking,
        attackLockRemaining: ally.attackLockRemaining,
        attackCooldown: ally.attackCooldown,
        targetId: ally.routeTarget?.kind === 'actor' ? ally.routeTarget.actor?.id ?? null : null,
        x: point.x,
        y: point.y,
      };
    });
    state.enemyDiagnostics = this.enemies.filter((enemy) => enemy.hitPoints > 0 && enemy.node.isValid).map((enemy) => {
      const point = this.actorPoint(enemy);
      return {
        id: enemy.id,
        body: enemy.body,
        hp: enemy.hitPoints,
        action: enemy.action,
        attacking: enemy.attacking,
        attackLockRemaining: enemy.attackLockRemaining,
        attackCooldown: enemy.attackCooldown,
        targetKind: enemy.routeTarget?.kind ?? null,
        x: point.x,
        y: point.y,
      };
    });
    state.projectileDiagnostics = this.projectiles.filter((projectile) => projectile.node.isValid).map((projectile) => {
      const point = this.nodePoint(projectile.node);
      return {
        team: projectile.team,
        clock: projectile.clock,
        lifeTime: projectile.lifeTime,
        targetAlive: this.targetIsAlive(projectile.target),
        x: point.x,
        y: point.y,
      };
    });
    state.active = this.normalLifecycleSmoke ? !this.finished : !state.reachedWaveTwoPreparation && !this.finished;
    const transitionPassed = state.placedBuildingIds.length === 3
      && state.reachedWaveTwoPreparation
      && state.shopRefreshCount >= 2
      && state.shopRollHistoryLength >= 2
      && state.fightLevel === 1
      && state.fightLevelExperience === 0
      && state.levelText === '1'
      && state.selectedTraitCount === 1
      && state.castleHp > 0
      && state.errors.length === 0;
    state.passed = this.normalLifecycleSmoke
      ? state.finished
        && state.victory
        && state.completedWaves.join(',') === '1,2,3,4,5'
        && state.errors.length === 0
      : transitionPassed;
    if (typeof window !== 'undefined') {
      (window as unknown as { __cocosNormalTransitionSmoke?: NormalTransitionSmokeState }).__cocosNormalTransitionSmoke = state;
      document.documentElement.setAttribute('data-cocos-normal-transition-smoke', JSON.stringify(state));
    }
  }

  /** Explicit test-only adapter: production rosters/timing/lifecycle stay intact while combat balance is boosted. */
  private async startLifecycleSmoke(): Promise<void> {
    const definition = OPENING_SHOP.find((item) => item.id === 'e07');
    const tower = this.shopLayer.getChildByName('Shop_e07');
    if (!definition || !tower) return;
    const column = 1;
    const row = 6;
    definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    const shopHome = tower.position.clone();
    tower.removeFromParent();
    this.gridLayer.addChild(tower);
    const transform = tower.getComponent(UITransform)!;
    const x = GRID_X + column * CELL_STEP;
    const y = GRID_Y + row * CELL_STEP;
    tower.setPosition(this.topLeftPosition(x, y + (definition.visualOffsetY ?? 0), transform.contentSize.width, transform.contentSize.height));
    await this.registerPlacedBuilding(tower, definition, column, row, shopHome);
    this.lifecycleSmokeState = {
      active: true,
      completedWaves: [],
      currentWave: 1,
      victory: false,
      castleHp: this.castleHp,
      spawned: 0,
      resolved: 0,
      projectiles: 0,
      projectileLifetimes: [],
      errors: [],
      damageTextsSpawned: 0,
      maximumDamageTextsActive: 0,
      repelsApplied: 0,
      repelsResisted: 0,
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => this.lifecycleSmokeState?.errors.push(event.message));
      window.addEventListener('unhandledrejection', (event) => this.lifecycleSmokeState?.errors.push(String(event.reason)));
    }
    this.updateLifecycleSmokeState();
    await this.startFight();
  }

  private updateLifecycleSmokeState(): void {
    if (!this.lifecycleSmokeState) return;
    this.lifecycleSmokeState.currentWave = this.wave;
    this.lifecycleSmokeState.castleHp = this.castleHp;
    this.lifecycleSmokeState.spawned = this.spawnedThisWave;
    this.lifecycleSmokeState.resolved = this.resolvedThisWave;
    this.lifecycleSmokeState.projectiles = this.projectiles.length;
    this.lifecycleSmokeState.projectileLifetimes = this.projectiles.map((projectile) => ({
      clock: projectile.clock,
      lifeTime: projectile.lifeTime,
    }));
    if (typeof window !== 'undefined') {
      (window as unknown as { __cocosLifecycleSmoke?: LifecycleSmokeState }).__cocosLifecycleSmoke = this.lifecycleSmokeState;
      document.documentElement.setAttribute('data-cocos-lifecycle-smoke', JSON.stringify(this.lifecycleSmokeState));
    }
  }

  private enableDrag(node: Node, definition: ShopDefinition): void {
    node.on(Node.EventType.TOUCH_START, () => {
      if (this.fighting || this.finished || this.drag) return;
      const existing = this.placedBuildings.find((building) => building.node === node) ?? null;
      const shopItem = this.shopItems.find((item) => item.node === node) ?? null;
      if (existing) this.setBuildingOccupied(existing, false);
      this.drag = {
        node,
        definition: existing?.definition ?? shopItem?.definition ?? definition,
        home: node.position.clone(),
        existing,
        shopItem,
      };
      node.setSiblingIndex(node.parent?.children.length ?? 0);
    });
    node.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      if (!this.drag || this.drag.node !== node) return;
      const ui = event.getUILocation();
      const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(ui.x, ui.y));
      node.setPosition(local);
    });
    node.on(Node.EventType.TOUCH_END, () => this.finishDrag());
    node.on(Node.EventType.TOUCH_CANCEL, () => this.finishDrag());
  }

  private finishDrag(): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const point = this.localToTopLeft(drag.node.position);
    if (drag.definition.kind === 'slot') {
      const columns = drag.definition.shape.reduce((maximum, cell) => Math.max(maximum, cell[0] + 1), 1);
      const rows = drag.definition.shape.reduce((maximum, cell) => Math.max(maximum, cell[1] + 1), 1);
      const column = Math.round((point.x - GRID_X - columns * CELL_STEP / 2) / CELL_STEP);
      const row = Math.round((point.y - GRID_Y - rows * CELL_STEP / 2) / CELL_STEP);
      const inside = drag.definition.shape.every(([offsetX, offsetY]) => {
        const cellColumn = column + offsetX;
        const cellRow = row + offsetY;
        return cellColumn >= 0 && cellColumn < 7 && cellRow >= 0 && cellRow < 9;
      });
      if (!inside) {
        drag.node.setPosition(drag.home);
        return;
      }
      this.placeSlotExpansion(drag.definition, column, row);
      if (drag.shopItem) this.consumeShopItem(drag.shopItem, null);
      return;
    }
    const shopSynthesisTarget = this.findShopSynthesisTarget(drag.definition, point, drag.shopItem);
    if (shopSynthesisTarget) {
      void this.mergeShopItemInto(shopSynthesisTarget, drag.shopItem, drag.existing);
      return;
    }
    if (drag.existing && this.isShopBenchPoint(point)) {
      this.returnBuildingToShop(drag.existing);
      return;
    }
    const column = Math.round((point.x - GRID_X - CELL_SIZE / 2) / CELL_STEP);
    const row = Math.round((point.y - GRID_Y - CELL_SIZE / 2) / CELL_STEP);
    const synthesisTarget = this.findSynthesisTarget(drag.definition, column, row, drag.existing);
    if (synthesisTarget) {
      void this.mergeBuildingInto(synthesisTarget, drag.node, drag.existing, drag.definition);
      return;
    }
    const valid = drag.definition.shape.every(([offsetX, offsetY]) => {
      const cellColumn = column + offsetX;
      const cellRow = row + offsetY;
      return isBuildable(this.mapData, cellColumn, cellRow)
        && !this.occupied.has(`${cellColumn}_${cellRow}`)
        && !this.isCastleCellAt(cellColumn, cellRow);
    });
    if (!valid) {
      drag.node.setPosition(drag.home);
      if (drag.existing) this.setBuildingOccupied(drag.existing, true);
      return;
    }
    drag.definition.shape.forEach(([offsetX, offsetY]) => this.occupied.add(`${column + offsetX}_${row + offsetY}`));
    drag.node.removeFromParent();
    this.gridLayer.addChild(drag.node);
    const footprintWidth = Math.max(CELL_SIZE, drag.definition.shape.reduce((max, cell) => Math.max(max, cell[0] + 1), 1) * CELL_STEP - CELL_GAP);
    const footprintHeight = Math.max(CELL_SIZE, drag.definition.shape.reduce((max, cell) => Math.max(max, cell[1] + 1), 1) * CELL_STEP - CELL_GAP);
    this.resizeBuildingVisual(drag.node, drag.definition, footprintWidth, footprintHeight);
    const naturalWidth = drag.node.getComponent(UITransform)?.contentSize.width ?? CELL_SIZE;
    const naturalHeight = drag.node.getComponent(UITransform)?.contentSize.height ?? CELL_SIZE;
    const x = GRID_X + column * CELL_STEP + (footprintWidth - naturalWidth) / 2;
    const y = GRID_Y + row * CELL_STEP + footprintHeight - naturalHeight + (drag.definition.visualOffsetY ?? 0);
    drag.node.setPosition(this.topLeftPosition(x, y, naturalWidth, naturalHeight));
    if (drag.existing) {
      drag.existing.column = column;
      drag.existing.row = row;
      drag.existing.node.active = true;
    } else {
      if (drag.shopItem) {
        drag.shopItem.available = false;
        drag.shopItem.definition = drag.definition;
      }
      void this.registerPlacedBuilding(drag.node, drag.definition, column, row, drag.home);
    }
  }

  private findShopSynthesisTarget(
    definition: ShopDefinition,
    point: { x: number; y: number },
    sourceItem: ShopItemState | null,
  ): ShopItemState | null {
    if (!this.shopLayer.active) return null;
    const sourceTransform = sourceItem?.node.getComponent(UITransform);
    const sourceWidth = sourceTransform?.contentSize.width ?? 180;
    const sourceHeight = sourceTransform?.contentSize.height ?? 160;
    return this.shopItems.find((item) => {
      if (item === sourceItem || !item.available || !item.node.active || item.node.parent !== this.shopLayer) return false;
      if (!canSynthesizeBuildings(definition, item.definition)) return false;
      const targetPoint = this.localToTopLeft(item.node.position);
      const targetTransform = item.node.getComponent(UITransform);
      const targetWidth = targetTransform?.contentSize.width ?? 180;
      const targetHeight = targetTransform?.contentSize.height ?? 160;
      return Math.abs(point.x - targetPoint.x) < (sourceWidth + targetWidth) / 2
        && Math.abs(point.y - targetPoint.y) < (sourceHeight + targetHeight) / 2;
    }) ?? null;
  }

  private async mergeShopItemInto(
    targetItem: ShopItemState,
    sourceItem: ShopItemState | null,
    sourceBuilding: PlacedBuilding | null,
  ): Promise<boolean> {
    const sourceDefinition = sourceBuilding?.definition ?? sourceItem?.definition;
    if (!sourceDefinition || targetItem === sourceItem || !canSynthesizeBuildings(sourceDefinition, targetItem.definition)) return false;
    const nextDefinition = upgradeShopDefinition(targetItem.definition);
    if (!nextDefinition) return false;
    targetItem.definition = nextDefinition;
    targetItem.available = true;
    targetItem.node.active = true;
    const sprite = targetItem.node.getComponent(Sprite);
    if (sprite) sprite.spriteFrame = await this.loadSpriteFrame(nextDefinition.sprite);
    targetItem.node.getChildByName('WeaponMount')?.destroy();
    await this.attachWeaponMount(targetItem.node, nextDefinition);
    this.resizeBuildingVisual(targetItem.node, nextDefinition, 180, 160);
    targetItem.node.setPosition(targetItem.home);
    if (sourceItem) this.consumeShopItem(sourceItem, sourceBuilding);
    else if (sourceBuilding) {
      this.setBuildingOccupied(sourceBuilding, false);
      const sourceIndex = this.placedBuildings.indexOf(sourceBuilding);
      if (sourceIndex >= 0) this.placedBuildings.splice(sourceIndex, 1);
      sourceBuilding.hpBack?.destroy();
      sourceBuilding.node.destroy();
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-shop-synthesis', JSON.stringify({
        id: nextDefinition.id,
        level: nextDefinition.level,
        sprite: nextDefinition.sprite,
        sourceConsumed: sourceItem ? !sourceItem.available : true,
      }));
    }
    return true;
  }

  private findSynthesisTarget(definition: ShopDefinition, column: number, row: number, source: PlacedBuilding | null): PlacedBuilding | null {
    return this.placedBuildings.find((building) => building !== source
      && building.column === column
      && building.row === row
      && building.node.active
      && canSynthesizeBuildings(definition, building.definition)) ?? null;
  }

  private async mergeBuildingInto(target: PlacedBuilding, sourceNode: Node, sourceBuilding: PlacedBuilding | null, sourceDefinition: ShopDefinition): Promise<boolean> {
    if (!canSynthesizeBuildings(sourceDefinition, target.definition)) return false;
    const nextDefinition = upgradeShopDefinition(target.definition);
    if (!nextDefinition) return false;
    if (sourceBuilding) {
      const sourceIndex = this.placedBuildings.indexOf(sourceBuilding);
      if (sourceIndex >= 0) this.placedBuildings.splice(sourceIndex, 1);
    }
    const sourceShopItem = this.shopItems.find((item) => item.node === sourceNode) ?? null;
    if (sourceNode !== target.node && sourceNode.isValid) {
      if (sourceShopItem) this.consumeShopItem(sourceShopItem, sourceBuilding);
      else sourceNode.destroy();
    }
    target.definition = nextDefinition;
    const targetShopItem = this.shopItems.find((item) => item.node === target.node);
    if (targetShopItem) targetShopItem.definition = nextDefinition;
    target.maxHitPoints = nextDefinition.hitPoints;
    target.hitPoints = nextDefinition.hitPoints;
    target.cooldown = nextDefinition.kind === 'defense' ? 0.35 : nextDefinition.summonCooldownSeconds ?? 0;
    const sprite = target.node.getComponent(Sprite);
    if (sprite) sprite.spriteFrame = await this.loadSpriteFrame(nextDefinition.sprite);
    target.node.getChildByName('WeaponMount')?.destroy();
    await this.attachWeaponMount(target.node, nextDefinition);
    this.positionPlacedBuilding(target);
    this.updateBuildingHealthBar(target);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-synthesis', JSON.stringify({
        id: nextDefinition.id,
        level: nextDefinition.level,
        hitPoints: nextDefinition.hitPoints,
        attack: nextDefinition.attack ?? 0,
        sprite: nextDefinition.sprite,
        weaponMount: nextDefinition.weaponMount?.sprite ?? null,
      }));
    }
    return true;
  }

  private positionPlacedBuilding(building: PlacedBuilding): void {
    const footprintWidth = Math.max(CELL_SIZE, building.definition.shape.reduce((max, cell) => Math.max(max, cell[0] + 1), 1) * CELL_STEP - CELL_GAP);
    const footprintHeight = Math.max(CELL_SIZE, building.definition.shape.reduce((max, cell) => Math.max(max, cell[1] + 1), 1) * CELL_STEP - CELL_GAP);
    this.resizeBuildingVisual(building.node, building.definition, footprintWidth, footprintHeight);
    const transform = building.node.getComponent(UITransform);
    const width = transform?.contentSize.width ?? CELL_SIZE;
    const height = transform?.contentSize.height ?? CELL_SIZE;
    const x = GRID_X + building.column * CELL_STEP + (footprintWidth - width) / 2;
    const y = GRID_Y + building.row * CELL_STEP + footprintHeight - height + (building.definition.visualOffsetY ?? 0);
    building.node.setPosition(this.topLeftPosition(x, y, width, height));
    if (building.hpBack) building.hpBack.setPosition(0, height / 2 + 13);
  }

  private isShopBenchPoint(point: { x: number; y: number }): boolean {
    return this.shopLayer.active && point.x >= 0 && point.x <= DESIGN_WIDTH && point.y >= 940 && point.y <= 1165;
  }

  private placeSlotExpansion(definition: ShopDefinition, column: number, row: number): number {
    let expanded = 0;
    for (const [offsetX, offsetY] of definition.shape) {
      const cellColumn = column + offsetX;
      const cellRow = row + offsetY;
      if (this.mapData[cellRow][cellColumn] === '1') continue;
      const previous = this.mapData[cellRow][cellColumn];
      const key = `${cellColumn}_${cellRow}`;
      this.treeNodes.get(key)?.destroy();
      this.treeNodes.delete(key);
      this.treePriceLabels.delete(key);
      this.mapData[cellRow] = this.replaceCell(this.mapData[cellRow], cellColumn, '1');
      if (previous === 'o') {
        const x = GRID_X + cellColumn * CELL_STEP;
        const y = GRID_Y + cellRow * CELL_STEP;
        this.addRect(this.gridLayer, `Floor_${cellColumn}_${cellRow}`, x, y, CELL_SIZE, CELL_SIZE, new Color(130, 210, 85, 62), new Color(201, 242, 161, 150));
      }
      this.occupied.delete(key);
      expanded += 1;
    }
    return expanded;
  }

  private setBuildingOccupied(building: PlacedBuilding, occupied: boolean): void {
    for (const [offsetX, offsetY] of building.definition.shape) {
      const key = `${building.column + offsetX}_${building.row + offsetY}`;
      if (occupied) this.occupied.add(key);
      else this.occupied.delete(key);
    }
  }

  private returnBuildingToShop(building: PlacedBuilding): void {
    this.setBuildingOccupied(building, false);
    const index = this.placedBuildings.indexOf(building);
    if (index >= 0) this.placedBuildings.splice(index, 1);
    building.hpBack?.destroy();
    building.hpBack = null;
    building.hpFill = null;
    building.node.removeFromParent();
    this.shopLayer.addChild(building.node);
    this.resizeBuildingVisual(building.node, building.definition, 180, 160);
    const shopItem = this.shopItems.find((item) => item.node === building.node);
    if (shopItem) {
      shopItem.definition = building.definition;
      shopItem.available = true;
      building.node.active = true;
      this.layoutVisibleShopItems();
      building.node.setPosition(shopItem.home);
    } else {
      building.node.setPosition(building.shopHome);
    }
    building.node.active = true;
  }

  private consumeShopItem(item: ShopItemState, sourceBuilding: PlacedBuilding | null): void {
    if (sourceBuilding) {
      this.setBuildingOccupied(sourceBuilding, false);
      const index = this.placedBuildings.indexOf(sourceBuilding);
      if (index >= 0) this.placedBuildings.splice(index, 1);
      sourceBuilding.hpBack?.destroy();
      sourceBuilding.hpBack = null;
      sourceBuilding.hpFill = null;
    }
    item.available = false;
    item.node.removeFromParent();
    this.shopLayer.addChild(item.node);
    this.resizeBuildingVisual(item.node, item.definition, 180, 160);
    item.node.setPosition(item.home);
    item.node.active = false;
  }

  private async registerPlacedBuilding(node: Node, definition: ShopDefinition, column: number, row: number, shopHome: Vec3): Promise<PlacedBuilding> {
    const building: PlacedBuilding = {
      id: this.nextRuntimeId++,
      node,
      definition,
      column,
      row,
      hitPoints: definition.hitPoints,
      maxHitPoints: definition.hitPoints,
      cooldown: definition.kind === 'defense' ? 0.35 : definition.summonCooldownSeconds ?? 0,
      hpBack: null,
      hpFill: null,
      shopHome: shopHome.clone(),
    };
    this.placedBuildings.push(building);
    const transform = node.getComponent(UITransform);
    const top = (transform?.contentSize.height ?? 80) / 2 + 13;
    building.hpBack = await this.addChildSprite(node, 'original/ui/build_hp_bar_bg', 0, top, 82, 14);
    building.hpFill = await this.addChildSprite(building.hpBack, 'original/ui/build_hp_bar', -38, 0, 76, 8);
    building.hpFill.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
    building.hpBack.active = false;
    return building;
  }

  public update(deltaTime: number): void {
    if (this.visualBaselineFrozen || this.repelMotionFrozen || this.attackMotionFrozen) return;
    const delta = Math.min(deltaTime, 0.04);
    this.layoutAirSupport();
    const steps = this.normalLifecycleSmoke ? 30 : 1;
    for (let step = 0; step < steps; step += 1) this.updateCombatStep(delta);
    this.publishNormalTransitionSmokeState();
  }

  private updateCombatStep(delta: number): void {
    this.updateDamageTexts(delta);
    this.updateCombatDelays(delta);
    if (!this.fighting || this.finished || this.traitSelecting) return;
    this.updateSpawning(delta);
    this.updateBuildings(delta);
    this.updateEnemies(delta);
    this.updateAllies(delta);
    this.updateAirSupports(delta);
    this.updateProjectiles(delta);
    this.updateLaserEffects(delta);
    this.updateFightLevelHud();
    this.checkWaveComplete();
    this.updateVisualBaselineCaptureClock(delta);
    this.updateLifecycleSmokeState();
  }

  private scheduleCombatDelay(callback: () => void, seconds: number): void {
    this.combatDelays.push({ remaining: Math.max(0, seconds), callback });
  }

  private updateCombatDelays(delta: number): void {
    for (let index = this.combatDelays.length - 1; index >= 0; index -= 1) {
      const delayed = this.combatDelays[index];
      delayed.remaining -= delta;
      if (delayed.remaining > 0.000001) continue;
      this.combatDelays.splice(index, 1);
      delayed.callback();
    }
  }

  private async startFight(): Promise<void> {
    if (this.fighting || this.finished) return;
    await this.preloadBattleFrames();
    if (this.fighting || this.finished) return;
    this.fighting = true;
    this.spawnedThisWave = 0;
    this.resolvedThisWave = 0;
    const count = this.waveCounts[this.wave - 1];
    const baseRoster = buildWaveRoster<string>(this.stageId, this.wave, count, this.baseEnemyIds);
    this.waveRoster = applyWaveVariants(
      this.stageId,
      this.wave,
      this.waveCounts.length,
      baseRoster,
      this.baseEnemyIds,
      this.eliteProbabilities[this.wave - 1] ?? 0,
      this.runtimeRandom,
      (base) => this.eliteByBase[base] ?? base,
      this.hasFinalBoss,
      (base) => this.bossByBase[base] ?? base,
    );
    this.waveCoinRoster = allocateWaveCoins(count, 10);
    this.refreshEconomyHud();
    this.waveSpawnDelays = buildSpawnDelays(Array.from({ length: count }, () => this.runtimeRandom()), count);
    this.spawnClock = this.waveSpawnDelays[0] ?? 0;
    this.shopLayer.active = false;
    this.actorLayer.active = true;
    this.airSupportLayer.active = true;
    this.layoutAirSupport();
    this.gridLayer.setPosition(0, -PREPARATION_SHIFT);
    this.actorLayer.setPosition(0, 0);
    this.projectileLayer.setPosition(0, 0);
    this.castleHp = this.lifecycleSmoke ? 1_000_000_000 : CASTLE.hp;
    this.refreshCastleHp();
    for (const node of this.treeNodes.values()) {
      for (const child of node.children) child.active = false;
    }
    for (const building of this.placedBuildings) {
      if (this.lifecycleSmoke) building.maxHitPoints = 1_000_000_000;
      building.hitPoints = building.maxHitPoints;
      building.node.active = true;
      building.hpBack && (building.hpBack.active = false);
      this.updateBuildingHealthBar(building);
    }
    this.waveLabel.string = `波次 ${this.wave}/${this.waveCounts.length}`;
    this.updateFightLevelHud();
    this.updateLifecycleSmokeState();
    this.publishAirSupportState();
    if (this.normalLifecycleSmoke && this.wave === 1) {
      this.scheduleCombatDelay(() => {
        if (this.fighting && !this.finished) this.useAirSupport('meteorite');
      }, 1);
    }
    this.publishCampaignBattleState();
  }

  private useAirSupport(skillId: AirSupportId): boolean {
    if (!this.fighting || this.finished || this.airSupportUsed.has(skillId)) return false;
    this.airSupportUsed.add(skillId);
    this.airSupportAudit.uses.push(skillId);
    const targets = this.shuffledLiveEnemies();
    if (skillId === 'meteorite') {
      this.airSupportAudit.meteoriteTargets += targets.length;
      if (targets.length > 0) {
        this.airSupportEvents.push({
          targets,
          elapsed: 0,
          nextIndex: 0,
          interval: 3 / targets.length,
        });
      }
    } else if (skillId === 'freeze') {
      for (const enemy of targets) {
        enemy.freezeRemaining = Math.max(enemy.freezeRemaining, 4);
        const sprite = enemy.visual.getComponent(Sprite);
        if (sprite) sprite.color = new Color(174, 235, 255, 184);
        if (!enemy.freezeEffect?.isValid) {
          enemy.freezeEffect = this.spawnRecoveredEffect('freeze', enemy.node, 0, 0);
          this.airSupportAudit.freezeEffects += 1;
        }
      }
      this.airSupportAudit.frozenTargets += targets.length;
    } else {
      for (const ally of this.allies) {
        if (ally.hitPoints <= 0 || !ally.node.isValid) continue;
        const before = ally.hitPoints;
        ally.hitPoints = Math.min(ally.maxHitPoints, ally.hitPoints + ally.maxHitPoints);
        const healed = ally.hitPoints - before;
        this.updateActorHealthBar(ally, true);
        this.airSupportAudit.healedUnits += 1;
        this.airSupportAudit.healedHp += healed;
        const point = this.actorPoint(ally);
        this.spawnDamageText(point.x, point.y - 70, `+${Math.round(healed)}`, new Color(116, 255, 157, 255));
        this.spawnRecoveredEffect('healing', ally.node, 0, 0);
        this.airSupportAudit.healingEffects += 1;
      }
    }
    this.refreshAirSupportButtons();
    this.publishAirSupportState();
    return true;
  }

  private shuffledLiveEnemies(): CombatActor[] {
    const result = this.enemies.filter((enemy) => enemy.hitPoints > 0 && enemy.node.isValid);
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.runtimeRandom() * (index + 1));
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }

  private updateAirSupports(delta: number): void {
    for (let index = this.airSupportEvents.length - 1; index >= 0; index -= 1) {
      const event = this.airSupportEvents[index];
      event.elapsed += delta;
      while (event.nextIndex < event.targets.length && event.elapsed >= event.nextIndex * event.interval) {
        const target = event.targets[event.nextIndex];
        event.nextIndex += 1;
        if (!target || target.hitPoints <= 0 || !target.node.isValid) continue;
        const point = this.actorPoint(target);
        this.fireProjectile(
          { x: point.x, y: -120 },
          { kind: 'actor', actor: target },
          'ally',
          9999,
          65 * PHYSICS_PIXEL_RATIO,
          0,
          1,
          'building',
          2000,
          0,
          0,
          0,
          true,
          true,
          'original/effects/meteor-projectile/meteor-projectile-00',
          RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].width * RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].scale,
          RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].height * RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].scale,
          'meteor-projectile',
          'artillery-fire',
        );
        this.airSupportAudit.meteorProjectileAnimations += 1;
      }
      if (event.nextIndex >= event.targets.length) this.airSupportEvents.splice(index, 1);
    }
    this.publishAirSupportState();
  }

  private spawnRecoveredEffect(
    effectId: RecoveredAirSupportEffectId,
    parent: Node,
    x: number,
    y: number,
  ): Node {
    const config = RECOVERED_AIR_SUPPORT_EFFECTS[effectId];
    const node = new Node(`Recovered_${effectId}`);
    node.layer = this.node.layer;
    node.addComponent(UITransform).setContentSize(config.width * config.scale, config.height * config.scale);
    node.setPosition(
      x + (0.5 - config.pivotX) * config.width * config.scale,
      y + (config.pivotY - 0.5) * config.height * config.scale,
    );
    parent.addChild(node);
    this.playRecoveredMovieClip(node, effectId, config.loop ? undefined : () => node.isValid && node.destroy());
    return node;
  }

  private spawnProjectileImpactEffect(
    effectId: RecoveredAirSupportEffectId,
    point: { x: number; y: number },
  ): void {
    const local = this.centerPosition(point.x, point.y);
    this.spawnRecoveredEffect(effectId, this.actorLayer, local.x, local.y);
    if (effectId === 'artillery-fire') {
      this.airSupportAudit.meteoriteImpacts += 1;
      this.airSupportAudit.artilleryEffects += 1;
    }
  }

  private playRecoveredMovieClip(
    node: Node,
    effectId: RecoveredAirSupportEffectId,
    onComplete?: () => void,
  ): void {
    const config = RECOVERED_AIR_SUPPORT_EFFECTS[effectId];
    const rootSprite = node.getComponent(Sprite);
    if (rootSprite) rootSprite.enabled = false;
    const frames = config.framePaths.map((path) => path ? this.frameCache.get(path) ?? null : null);
    node.addComponent(FairyMovieClipSequence).play(
      frames,
      config.layouts,
      config.width,
      config.height,
      config.intervalSeconds,
      config.loop,
      config.scale,
      onComplete,
    );
  }

  private async preloadBattleFrames(): Promise<void> {
    if (this.actionFrames.size > 0) return;
    const counts: Record<UnitBody, Partial<Record<ActorAction, number>>> = {
      Swordsman1: { idle: 8, move: 10, attack: 9, victory: 13 },
      Shooter1: { idle: 8, move: 10, attack: 9, victory: 13 },
      Mauler1: { idle: 8, move: 10, attack: 7, victory: 13 },
      Crossbowman1: { idle: 8, move: 10, attack: 9, victory: 13 },
      Knight1: { idle: 8, move: 10, attack: 14, victory: 13, charge: 5 },
      Mage1: { idle: 8, move: 10, attack: 15, victory: 13 },
    };
    const bodiesByTeam: Record<ActorTeam, string[]> = {
      enemy: this.enemyVisualBodiesForStage(),
      ally: ['Swordsman1', 'Shooter1', 'Mauler1', 'Crossbowman1', 'Knight1', 'Mage1'],
    };
    const tasks: Promise<void>[] = [];
    for (const team of ['enemy', 'ally'] as const) {
      const folder = team === 'enemy' ? 'units-red' : 'units';
      for (const body of bodiesByTeam[team]) {
        const baseBody = body.replace(/[2-4]$/, '1') as UnitBody;
        const actionCounts = counts[baseBody] as Partial<Record<ActorAction, number>>;
        for (const action of Object.keys(actionCounts) as ActorAction[]) {
          const frameCount = actionCounts[action] ?? 0;
          tasks.push((async () => {
            const frames = await Promise.all(Array.from(
              { length: frameCount },
              (_, frame) => this.loadSpriteFrame(`original/units/${folder}/${body}_${action}_${frame}`),
            ));
            this.actionFrames.set(`${team}:${body}:${action}`, frames);
          })());
        }
      }
    }
    tasks.push(this.loadSpriteFrame('original/ui/enemy_hp_bar_bg').then(() => undefined));
    tasks.push(this.loadSpriteFrame('original/ui/enemy_hp_bar').then(() => undefined));
    tasks.push(this.loadSpriteFrame('original/ui/bullet_arrow').then(() => undefined));
    for (const effectId of ['freeze', 'healing', 'artillery-fire', 'meteor-projectile'] as const) {
      const config = RECOVERED_AIR_SUPPORT_EFFECTS[effectId];
      for (const path of config.framePaths) {
        if (path) tasks.push(this.loadSpriteFrame(path).then(() => undefined));
      }
    }
    for (const level of [1, 2, 3, 4] as const) {
      for (const path of RECOVERED_LASER_EFFECTS[level].framePaths) {
        tasks.push(this.loadSpriteFrame(path).then(() => undefined));
      }
    }
    await Promise.all(tasks);
  }

  private updateSpawning(delta: number): void {
    if (this.spawnedThisWave >= this.waveRoster.length) return;
    this.spawnClock -= delta;
    if (this.spawnClock > 0) return;
    const enemyId = this.waveRoster[this.spawnedThisWave];
    this.spawnEnemy(enemyId, this.waveCoinRoster[this.spawnedThisWave] ?? 0);
    this.spawnedThisWave += 1;
    this.spawnClock += this.waveSpawnDelays[this.spawnedThisWave] ?? 0;
  }

  private spawnEnemy(enemyId: string, deadCoins: number): CombatActor {
    const x = 10 + Math.floor(this.runtimeRandom() * 741);
    const y = 50 + Math.floor(this.runtimeRandom() * 31);
    const power = this.wavePowers[this.wave - 1] ?? 1;
    const campaignEnemy = this.enemyDefinitions.get(enemyId);
    const enemy = campaignEnemy ?? STAGE2_ENEMIES[enemyId];
    if (!enemy) throw new Error(`Unknown campaign enemy: ${enemyId}`);
    const visualBody = campaignEnemy ? this.visualBodyForPower(campaignEnemy.bodies, power) : enemy.body;
    return this.createActor('enemy', enemy.body, x, y, power, undefined, enemyId, deadCoins, null, visualBody);
  }

  private createActor(
    team: ActorTeam,
    body: UnitBody,
    x: number,
    y: number,
    power = 1,
    sourceBuildingId?: number,
    enemyId?: string,
    deadCoins = 0,
    chargePolicy: Readonly<UnitChargePolicy> | null = null,
    visualBody = body,
  ): CombatActor {
    const enemyDefinition = team === 'enemy' && enemyId
      ? this.enemyDefinitions.get(enemyId) ?? STAGE2_ENEMIES[enemyId] ?? null
      : null;
    const definition = enemyDefinition ?? STAGE2_UNITS[body];
    const root = new Node(`${team === 'enemy' ? 'Enemy' : 'Ally'}_${enemyId ?? body}_${this.nextRuntimeId}`);
    root.layer = this.node.layer;
    root.addComponent(UITransform).setContentSize(1, 1);
    root.setPosition(this.centerPosition(x, y));
    this.actorLayer.addChild(root);

    const visual = new Node('Visual');
    visual.layer = this.node.layer;
    const idleFrames = this.framesFor(team, visualBody, 'idle');
    const visualTransform = visual.addComponent(UITransform);
    const routeColliderScale = enemyDefinition?.zoom ?? 1;
    visualTransform.setContentSize(
      idleFrames[0].rect.width * UNIT_GLOBAL_SCALE * routeColliderScale,
      idleFrames[0].rect.height * UNIT_GLOBAL_SCALE * routeColliderScale,
    );
    const sprite = visual.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = idleFrames[0];
    root.addChild(visual);
    const animator = visual.addComponent(SpriteSequence);

    const hpBack = this.createCachedSprite(root, 'original/ui/enemy_hp_bar_bg', 70, 14);
    hpBack.name = `${team}_hp_back`;
    hpBack.setPosition(0, visualTransform.contentSize.height / 2 + 13);
    const hpFill = this.createCachedSprite(hpBack, 'original/ui/enemy_hp_bar', 64, 8);
    hpFill.getComponent(UITransform)?.setAnchorPoint(0, 0.5);
    hpFill.setPosition(-32, 0);

    const allyHpMultiplier = team === 'ally' ? traitMultiplier(this.activeTraits, 'AllUnitHp') : 1;
    const allyAttackMultiplier = team === 'ally' ? traitMultiplier(this.activeTraits, 'AllUnitAtk') : 1;
    const allyAttackSpeedMultiplier = team === 'ally' ? traitMultiplier(this.activeTraits, 'AllUnitAtkSpd') : 1;
    const rangedMultiplier = team === 'ally' && definition.attackRange > 1.5
      ? traitMultiplier(this.activeTraits, 'RangedUnitAtkRange')
      : 1;
    const hitPoints = Math.max(1, Math.round(definition.hitPoints * power * allyHpMultiplier));
    const baseSpeed = definition.speed * PHYSICS_PIXEL_RATIO * UNIT_GLOBAL_SPEED_RATIO;
    const charging = team === 'ally' && chargePolicy !== null;
    const actor: CombatActor = {
      id: this.nextRuntimeId++,
      team,
      body,
      visualBody,
      node: root,
      visual,
      animator,
      hitPoints,
      maxHitPoints: hitPoints,
      attack: Math.max(1, definition.attack * power * allyAttackMultiplier),
      attackSpeed: definition.attackSpeed * allyAttackSpeedMultiplier,
      attackFireFrame: definition.attackFireFrame,
      attackCooldown: 0,
      range: Math.max(42, definition.attackRange * PHYSICS_PIXEL_RATIO * rangedMultiplier),
      speed: baseSpeed * (charging ? chargePolicy?.speedMultiplier ?? 1 : 1),
      baseSpeed,
      bulletSpeed: definition.bulletSpeed * PHYSICS_PIXEL_RATIO,
      criticalChance: definition.criticalChance,
      criticalDamage: definition.criticalDamage,
      dodge: definition.dodge,
      deadCoins,
      sourceBuildingId,
      action: 'idle',
      attacking: false,
      attackLockRemaining: 0,
      hpBack,
      hpFill,
      aliveMilliseconds: 0,
      routeTarget: null,
      routeRandom: null,
      routeForceContacts: new Map<CombatActor, number>(),
      boss: enemyDefinition?.boss ?? false,
      elite: enemyDefinition?.elite ?? false,
      routeColliderScale,
      aoeRadius: enemyDefinition?.aoeRadiusPixels ?? definition.aoeRadiusPixels,
      repelPhysicsUnitsPerSecond: enemyDefinition?.repelPhysicsUnitsPerSecond ?? 0,
      repelSeconds: enemyDefinition?.repelSeconds ?? 0,
      repelResist: enemyDefinition?.repelResist ?? false,
      repel: null,
      freezeRemaining: 0,
      freezeEffect: null,
      chargePolicy,
      charging,
      dizzinessRemaining: 0,
    };
    (team === 'enemy' ? this.enemies : this.allies).push(actor);
    this.setActorAction(actor, team === 'enemy' ? 'move' : charging ? 'charge' : 'idle');
    this.updateActorHealthBar(actor);
    return actor;
  }

  private updateBuildings(delta: number): void {
    for (const building of this.placedBuildings) {
      if (building.hitPoints <= 0 || !building.node.active) continue;
      building.cooldown -= delta;
      if (building.definition.kind === 'barracks') {
        const alive = this.allies.filter((ally) => ally.sourceBuildingId === building.id && ally.hitPoints > 0).length;
        if (building.cooldown <= 0 && alive < (building.definition.summonUnitMax ?? 2)) {
          const point = this.buildingPoint(building);
          this.createActor('ally', building.definition.summonBody ?? 'Shooter1', point.x, point.y - 18, 1, building.id, undefined, 0, building.unitCharge ?? null);
          building.cooldown += buildingCooldownWithAdjacentSpeed(
            building.definition.summonCooldownSeconds ?? 7.2,
            this.adjacentAttackSpeedBonuses(building),
          );
        }
        continue;
      }
      if (building.definition.kind !== 'defense' || building.cooldown > 0) continue;
      const point = this.buildingPoint(building);
      const target = nearestLiveCandidate(
        point,
        this.enemies.map((enemy) => ({ value: enemy, point: this.actorPoint(enemy), hitPoints: enemy.hitPoints })),
        this.lifecycleSmoke ? 2000 : building.definition.rangePixels ?? 0,
      );
      if (!target) continue;
      const firePoint = this.buildingFirePoint(building);
      if (building.definition.laserDurationSeconds !== undefined) {
        this.fireLaser(
          firePoint,
          { kind: 'actor', actor: target.value },
          'ally',
          attackWithAdjacentBonus(
            this.lifecycleSmoke ? 1_000_000 : building.definition.attack ?? 0,
            this.adjacentAttackBonuses(building),
          ),
          criticalChanceWithAura(building.definition.criticalChance ?? 0.05, [this.activeGlobalCriticalChanceBonus()]),
          building.definition.criticalDamage ?? 1.5,
          building.definition.laserDurationSeconds,
          building.definition.laserTickIntervalSeconds ?? 0.25,
          Math.min(4, Math.max(1, building.definition.level)) as RecoveredLaserLevel,
        );
        building.cooldown += buildingCooldownWithAdjacentSpeed(
          this.lifecycleSmoke ? LIFECYCLE_ADAPTER_COOLDOWN_SECONDS : building.definition.cooldownSeconds ?? 2,
          this.adjacentAttackSpeedBonuses(building),
        );
        continue;
      }
      const projectileCount = this.projectiles.length;
      this.fireProjectile(
        firePoint,
        { kind: 'actor', actor: target.value },
        'ally',
        attackWithAdjacentBonus(
          this.lifecycleSmoke ? 1_000_000 : building.definition.attack ?? 0,
          this.adjacentAttackBonuses(building),
        ),
        building.definition.projectileSpeedPixels ?? 1000,
        criticalChanceWithAura(building.definition.criticalChance ?? 0.05, [this.activeGlobalCriticalChanceBonus()]),
        building.definition.criticalDamage ?? 1.5,
        'building',
        building.definition.rangePixels ?? 0,
        building.definition.splashRadiusPixels ?? 0,
        0,
        0,
        false,
        building.definition.forceTargetOnly ?? false,
        'original/ui/bullet_arrow',
        building.definition.projectileWidth ?? 38,
        building.definition.projectileHeight ?? 20,
        undefined,
        undefined,
        building.definition.splashDamageRatio ?? 1,
      );
      if (this.projectiles.length > projectileCount) {
        const projectile = this.projectiles[this.projectiles.length - 1];
        projectile.jumpRemaining = building.definition.jumpCount ?? 0;
        if (building.definition.projectileLifeTimeSeconds !== undefined) {
          projectile.lifeTime = building.definition.projectileLifeTimeSeconds;
          projectile.resetLifeTime = building.definition.projectileLifeTimeSeconds;
        }
        const color = building.definition.projectileColor;
        const sprite = projectile.node.getComponent(Sprite);
        if (color && sprite) sprite.color = new Color(color[0], color[1], color[2], color[3]);
      }
      building.cooldown += buildingCooldownWithAdjacentSpeed(
        this.lifecycleSmoke ? LIFECYCLE_ADAPTER_COOLDOWN_SECONDS : building.definition.cooldownSeconds ?? 2,
        this.adjacentAttackSpeedBonuses(building),
      );
    }
  }

  private updateEnemies(delta: number): void {
    for (const enemy of [...this.enemies]) this.updateEnemy(enemy, delta);
  }

  private updateEnemy(enemy: CombatActor, delta: number): void {
    if (enemy.hitPoints <= 0 || !enemy.node.isValid) return;
    this.updateActorAttackLock(enemy, delta);
    if (enemy.freezeRemaining > 0) {
      enemy.freezeRemaining = Math.max(0, enemy.freezeRemaining - delta);
      this.setActorAction(enemy, 'idle');
      if (enemy.freezeRemaining <= 0) {
        const sprite = enemy.visual.getComponent(Sprite);
        if (sprite) sprite.color = Color.WHITE;
        if (enemy.freezeEffect?.isValid) enemy.freezeEffect.destroy();
        enemy.freezeEffect = null;
      }
      return;
    }
    if (this.updateRepelledActor(enemy, delta)) {
      this.setActorAction(enemy, 'move');
      return;
    }
    if (enemy.dizzinessRemaining > 0) {
      enemy.dizzinessRemaining = Math.max(0, enemy.dizzinessRemaining - delta);
      this.setActorAction(enemy, 'idle');
      return;
    }
    enemy.aliveMilliseconds += delta * 1000;
    enemy.attackCooldown -= delta;
    if (!enemy.routeTarget || !this.targetIsAlive(enemy.routeTarget)) {
      enemy.routeTarget = this.findEnemyTarget(enemy);
      enemy.routeRandom = null;
    }
    const target = enemy.routeTarget;
    const source = this.actorPoint(enemy);
    const targetPoint = target ? this.targetPoint(target, source.x) : { x: source.x, y: DESIGN_HEIGHT };
    if (target && distanceBetween(source, targetPoint) <= enemy.range) {
      this.setActorFacing(enemy, targetPoint.x - source.x);
      this.tryActorAttack(enemy, target);
      return;
    }
    this.moveActor(enemy, targetPoint, delta);
  }

  private updateAllies(delta: number): void {
    for (const ally of [...this.allies]) {
      if (ally.hitPoints <= 0 || !ally.node.isValid) continue;
      this.updateActorAttackLock(ally, delta);
      if (this.updateRepelledActor(ally, delta)) {
        this.setActorAction(ally, 'move');
        continue;
      }
      if (ally.dizzinessRemaining > 0) {
        ally.dizzinessRemaining = Math.max(0, ally.dizzinessRemaining - delta);
        this.setActorAction(ally, 'idle');
        continue;
      }
      ally.aliveMilliseconds += delta * 1000;
      ally.attackCooldown -= delta;
      if (!ally.routeTarget || !this.targetIsAlive(ally.routeTarget)) {
        const candidate = nearestLiveCandidate(
          this.actorPoint(ally),
          this.enemies.map((enemy) => ({ value: enemy, point: this.actorPoint(enemy), hitPoints: enemy.hitPoints })),
        );
        ally.routeTarget = candidate ? { kind: 'actor', actor: candidate.value } : null;
        ally.routeRandom = null;
      }
      const target = ally.routeTarget;
      const source = this.actorPoint(ally);
      const targetPoint = target ? this.targetPoint(target) : { x: source.x, y: 0 };
      if (target && distanceBetween(source, targetPoint) <= ally.range) {
        this.setActorFacing(ally, targetPoint.x - source.x);
        this.tryActorAttack(ally, target);
        continue;
      }
      this.moveActor(ally, targetPoint, delta);
    }
  }

  private applyRepel(
    target: CombatActor,
    sourcePoint: { x: number; y: number },
    physicsUnitsPerSecond: number,
    durationSeconds: number,
  ): boolean {
    if (physicsUnitsPerSecond <= 0 || durationSeconds <= 0) return false;
    if (target.repelResist) {
      if (this.lifecycleSmokeState) this.lifecycleSmokeState.repelsResisted += 1;
      return false;
    }
    target.repel = createRepelState(
      sourcePoint,
      this.actorPoint(target),
      physicsUnitsPerSecond,
      durationSeconds,
      PHYSICS_PIXEL_RATIO,
    );
    if (this.lifecycleSmokeState) this.lifecycleSmokeState.repelsApplied += 1;
    return true;
  }

  private updateRepelledActor(actor: CombatActor, delta: number): boolean {
    if (!actor.repel) return false;
    const result = stepRepel(this.actorPoint(actor), actor.repel, delta, {
      left: 50,
      right: 700,
      top: 0,
      bottom: DESIGN_HEIGHT,
    });
    actor.node.setPosition(this.centerPosition(result.point.x, result.point.y));
    actor.repel = result.state;
    this.updateActorHealthBar(actor);
    return true;
  }

  private findEnemyTarget(enemy: CombatActor): CombatTarget | null {
    const source = this.actorPoint(enemy);
    const candidates: Array<{ value: CombatTarget; point: { x: number; y: number }; hitPoints: number }> = [];
    for (const ally of this.allies) {
      candidates.push({ value: { kind: 'actor', actor: ally }, point: this.actorPoint(ally), hitPoints: ally.hitPoints });
    }
    for (const building of this.placedBuildings) {
      candidates.push({ value: { kind: 'building', building }, point: this.buildingPoint(building), hitPoints: building.hitPoints });
    }
    candidates.push({ value: { kind: 'castle' }, point: this.castleRoutePoint(), hitPoints: this.castleHp });
    return nearestLiveCandidate(source, candidates, ENEMY_ROUTE_SEARCH_RANGE)?.value ?? null;
  }

  private moveActor(actor: CombatActor, destination: { x: number; y: number }, delta: number): void {
    if (actor.attacking) return;
    const source = this.actorPoint(actor);
    const gap = distanceBetween(source, destination);
    if (gap <= 1) {
      this.setActorAction(actor, 'idle');
      return;
    }
    const forward = this.unitRouteForward(actor, destination);
    const speedMultiplier = actor.team === 'enemy' ? this.activeEnemySpeedMultiplier() : 1;
    const distance = Math.min(gap, actor.speed * speedMultiplier * delta);
    const x = Math.max(50, Math.min(700, source.x + forward.x * distance));
    const y = Math.max(0, Math.min(DESIGN_HEIGHT, source.y + forward.y * distance));
    actor.node.setPosition(this.centerPosition(x, y));
    this.setActorFacing(actor, forward.x);
    this.setActorAction(actor, actor.charging ? 'charge' : 'move');
    this.updateActorHealthBar(actor);
  }

  private unitRouteForward(actor: CombatActor, destination: { x: number; y: number }): { x: number; y: number } {
    const source = this.actorPoint(actor);
    const desired = Math.atan2(destination.y - source.y, destination.x - source.x);
    const inForwardArc = (desired >= Math.PI / 4 && desired <= Math.PI * 3 / 4)
      || (desired <= -Math.PI / 4 && desired >= -Math.PI * 3 / 4);
    if (!inForwardArc) actor.routeRandom = null;
    if (inForwardArc && (!actor.routeRandom || actor.routeRandom.untilMilliseconds < actor.aliveMilliseconds)) {
      const untilMilliseconds = actor.aliveMilliseconds + this.routeRandomFloat(1500, 2400);
      const targetDistance = Math.max(1e-9, distanceBetween(source, destination));
      const attenuation = Math.max(0, 1 - actor.range * 2 / targetDistance);
      const amount = attenuation * this.routeRandomFloat(0.2, 0.6);
      const side = this.runtimeRandom() >= 0.5 ? 1 : -1;
      actor.routeRandom = {
        angle: routeRandomAngle(desired, amount, side),
        untilMilliseconds,
      };
    }
    let angle = actor.routeRandom?.angle ?? desired;
    let forward = { x: Math.cos(angle), y: Math.sin(angle) };
    const nextX = source.x + forward.x * 5;
    const nextY = source.y + forward.y * 5;
    if (nextX < 50 || nextX > 700 || nextY < 0 || nextY > DESIGN_HEIGHT) {
      const untilMilliseconds = actor.aliveMilliseconds + this.routeRandomFloat(1500, 2400);
      if (angle < 0) angle = angle < -Math.PI / 2 ? angle + Math.PI / 2 : angle - Math.PI / 2;
      else angle = angle > Math.PI / 2 ? angle - Math.PI / 2 : angle + Math.PI / 2;
      actor.routeRandom = { angle, untilMilliseconds };
      forward = { x: Math.cos(angle), y: Math.sin(angle) };
    }
    forward = this.applySameTeamCollision(actor, forward);
    if (actor.team === 'enemy' && forward.y < -0.5) {
      forward = normalizeVector({ x: forward.x, y: forward.y + 0.5 });
    } else if (actor.team === 'ally' && forward.y > 0.5) {
      forward = normalizeVector({ x: forward.x, y: forward.y - 0.5 });
    }
    return forward;
  }

  private applySameTeamCollision(actor: CombatActor, initialForward: { x: number; y: number }): { x: number; y: number } {
    const forward = { ...initialForward };
    if (actor.boss) {
      actor.routeForceContacts.clear();
      return normalizeVector(forward);
    }
    const source = this.actorPoint(actor);
    const radius = 50 * actor.routeColliderScale;
    const stayContacts = new Set<CombatActor>();
    const peers = actor.team === 'enemy' ? this.enemies : this.allies;
    for (const other of peers) {
      if (other === actor || other.hitPoints <= 0 || !other.node.isValid) continue;
      const otherPoint = this.actorPoint(other);
      const otherRadius = 50 * other.routeColliderScale;
      const gap = distanceBetween(source, otherPoint);
      if (gap >= radius + otherRadius) continue;
      stayContacts.add(other);
      if (gap <= 0) continue;
      const overlap = Math.min(1 - gap / ((radius + otherRadius) / 2), 1);
      if (overlap <= 0.0001) continue;
      const previous = actor.routeForceContacts.get(other);
      if (previous === undefined || overlap > previous) actor.routeForceContacts.set(other, overlap);
    }
    if (stayContacts.size === 0) {
      actor.routeForceContacts.clear();
      return normalizeVector(forward);
    }
    let forceWeight = 1;
    for (const [other, overlap] of actor.routeForceContacts) {
      if (!stayContacts.has(other) || !other.node.isValid) {
        actor.routeForceContacts.delete(other);
        continue;
      }
      const otherPoint = this.actorPoint(other);
      const away = Math.atan2(source.y - otherPoint.y, source.x - otherPoint.x);
      forward.x += Math.cos(away) * overlap * forceWeight;
      forward.y += Math.sin(away) * overlap * forceWeight;
      forceWeight *= 1.1;
    }
    return normalizeVector(forward);
  }

  private routeRandomFloat(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.runtimeRandom();
  }

  private tryActorAttack(actor: CombatActor, target: CombatTarget): void {
    if (actor.attacking || actor.attackCooldown > 0 || !this.targetIsAlive(target)) {
      if (!actor.attacking) this.setActorAction(actor, 'idle');
      return;
    }
    const interval = 1 / Math.max(0.1, actor.attackSpeed);
    actor.attackCooldown += interval;
    actor.attacking = true;
    const charge = actor.charging ? actor.chargePolicy : null;
    const attackFrames = this.framesFor(actor.team, actor.visualBody, 'attack');
    actor.attackLockRemaining = attackActionDuration(attackFrames.length);
    this.setActorAction(actor, 'attack', true, () => this.finishActorAttack(actor));
    const fireDelay = Math.min(actor.attackFireFrame * 0.102, interval);
    this.scheduleCombatDelay(() => {
      if (actor.hitPoints <= 0 || !actor.node.isValid || !this.targetIsAlive(target)) return;
      const sourceBuilding = actor.team === 'ally' && actor.sourceBuildingId !== undefined
        ? this.placedBuildings.find((building) => building.id === actor.sourceBuildingId)
        : undefined;
      const attack = attackWithAdjacentBonus(
        actor.attack,
        sourceBuilding ? this.adjacentAttackBonuses(sourceBuilding) : [],
      ) * (charge?.damageRatio ?? 1);
      if (charge && target.kind === 'actor' && target.actor
        && this.runtimeRandom() < charge.dizzinessChance) {
        target.actor.dizzinessRemaining = Math.max(target.actor.dizzinessRemaining, charge.dizzinessSeconds);
      }
      if (actor.bulletSpeed <= 0) {
        this.applyCombatImpact(
          target,
          attack,
          actor.team === 'ally' ? criticalChanceWithAura(actor.criticalChance, [this.activeGlobalCriticalChanceBonus()]) : actor.criticalChance,
          actor.criticalDamage,
          actor.team,
          actor.aoeRadius,
          this.targetPoint(target),
          charge?.repelPhysicsUnitsPerSecond ?? actor.repelPhysicsUnitsPerSecond,
          charge?.repelSeconds ?? actor.repelSeconds,
          this.actorPoint(actor),
        );
      } else {
        this.fireProjectile(
          this.actorPoint(actor),
          target,
          actor.team,
          attack,
          actor.bulletSpeed,
          actor.team === 'ally' ? criticalChanceWithAura(actor.criticalChance, [this.activeGlobalCriticalChanceBonus()]) : actor.criticalChance,
          actor.criticalDamage,
          'unit',
          actor.range,
          actor.aoeRadius,
          actor.repelPhysicsUnitsPerSecond,
          actor.repelSeconds,
        );
      }
      if (charge) {
        actor.charging = false;
        actor.speed = actor.baseSpeed;
      }
    }, fireDelay);
  }

  private updateActorAttackLock(actor: CombatActor, delta: number): void {
    if (!actor.attacking) return;
    actor.attackLockRemaining = advanceAttackActionLock(actor.attackLockRemaining, delta);
    if (actor.attackLockRemaining <= 0) this.finishActorAttack(actor);
  }

  private finishActorAttack(actor: CombatActor): void {
    if (!actor.attacking) return;
    actor.attacking = false;
    actor.attackLockRemaining = 0;
    if (actor.hitPoints > 0 && actor.node.isValid) this.setActorAction(actor, 'idle');
  }

  private fireProjectile(
    start: { x: number; y: number },
    target: CombatTarget,
    team: ActorTeam,
    damage: number,
    speed: number,
    criticalChance: number,
    criticalDamage: number,
    kind: 'unit' | 'building',
    attackRange: number,
    aoeRadius: number,
    repelPhysicsUnitsPerSecond = 0,
    repelSeconds = 0,
    deadInLast = false,
    forceTargetOnly = false,
    spritePath = 'original/ui/bullet_arrow',
    projectileWidth = 38,
    projectileHeight = 20,
    visualEffect?: RecoveredAirSupportEffectId,
    impactEffect?: RecoveredAirSupportEffectId,
    splashDamageRatio = 1,
  ): void {
    if (!this.targetIsAlive(target)) return;
    const node = this.createCachedSprite(this.projectileLayer, spritePath, projectileWidth, projectileHeight);
    node.name = `${team}_projectile`;
    if (visualEffect) this.playRecoveredMovieClip(node, visualEffect);
    node.setPosition(this.centerPosition(start.x, start.y));
    const destination = this.targetPoint(target);
    const direction = normalizeVector({ x: destination.x - start.x, y: destination.y - start.y });
    const lifeTime = projectileLifeTime(kind, speed, attackRange, distanceBetween(start, destination));
    this.projectiles.push({
      node,
      target,
      team,
      damage,
      speed,
      criticalChance,
      criticalDamage,
      velocity: { x: direction.x * speed, y: direction.y * speed },
      clock: 0,
      lifeTime,
      resetLifeTime: lifeTime,
      attackRange,
      autoFlow: kind === 'building',
      flowTimeMilliseconds: 0,
      aoeRadius,
      splashDamageRatio,
      jumpRemaining: 0,
      hitActors: [],
      repelPhysicsUnitsPerSecond,
      repelSeconds,
      sourcePoint: { ...start },
      deadInLast,
      forceTargetOnly,
      lastTargetPoint: { ...destination },
      deadTargetPoint: null,
      deadInLastLatched: false,
      visualEffect,
      impactEffect,
    });
  }

  private fireLaser(
    start: { x: number; y: number },
    target: CombatTarget,
    team: ActorTeam,
    damage: number,
    criticalChance: number,
    criticalDamage: number,
    duration: number,
    tickInterval: number,
    level: RecoveredLaserLevel,
  ): void {
    if (!this.targetIsAlive(target)) return;
    this.applyCombatImpact(target, damage, criticalChance, criticalDamage, team, 0, start, 0, 0, start);
    const node = new Node(`${team}_laser`);
    node.layer = this.node.layer;
    const config = RECOVERED_LASER_EFFECTS[level];
    node.addComponent(UITransform).setContentSize(config.width, config.height);
    const opacity = node.addComponent(UIOpacity);
    this.projectileLayer.addChild(node);
    const frames = config.framePaths.map((path) => this.frameCache.get(path) ?? null);
    node.addComponent(FairyMovieClipSequence).play(
      frames,
      config.layouts,
      config.width,
      config.height,
      config.intervalSeconds,
      true,
      1,
    );
    const safeInterval = Math.max(0.001, tickInterval);
    const effect: LaserEffectState = {
      node,
      opacity,
      target,
      team,
      start: { ...start },
      damage,
      criticalChance,
      criticalDamage,
      clock: 0,
      duration: Math.max(0.001, duration),
      tickInterval: safeInterval,
      nextTick: safeInterval,
      config,
    };
    this.redrawLaser(effect);
    this.laserEffects.push(effect);
  }

  private updateLaserEffects(delta: number): void {
    for (let index = this.laserEffects.length - 1; index >= 0; index -= 1) {
      const effect = this.laserEffects[index];
      if (!effect.node.isValid) {
        this.laserEffects.splice(index, 1);
        continue;
      }
      effect.clock += delta;
      if (this.targetIsAlive(effect.target)) {
        this.redrawLaser(effect);
        while (effect.clock >= effect.nextTick && effect.nextTick < effect.duration) {
          this.applyCombatImpact(
            effect.target,
            effect.damage,
            effect.criticalChance,
            effect.criticalDamage,
            effect.team,
            0,
            effect.start,
            0,
            0,
            effect.start,
          );
          effect.nextTick += effect.tickInterval;
          if (!this.targetIsAlive(effect.target)) break;
        }
      } else {
        effect.clock = effect.duration;
      }
      effect.opacity.opacity = effect.clock > effect.duration - 0.18
        ? 255 * Math.max(0, (effect.duration - effect.clock) / 0.18)
        : 255;
      if (effect.clock >= effect.duration) {
        effect.node.destroy();
        this.laserEffects.splice(index, 1);
      }
    }
  }

  private redrawLaser(effect: LaserEffectState): void {
    const start = this.centerPosition(effect.start.x, effect.start.y);
    const targetPoint = this.targetPoint(effect.target);
    const end = this.centerPosition(targetPoint.x, targetPoint.y);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distance = Math.hypot(deltaX, deltaY);
    effect.node.setPosition((start.x + end.x) / 2, (start.y + end.y) / 2);
    effect.node.setScale(distance / effect.config.referenceBeamWidth, 1, 1);
    effect.node.setRotationFromEuler(0, 0, Math.atan2(deltaY, deltaX) * 180 / Math.PI);
  }

  private updateProjectiles(delta: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      if (!projectile.node.isValid) {
        projectile.node.destroy();
        this.projectiles.splice(index, 1);
        continue;
      }
      projectile.clock += delta;
      const source = this.nodePoint(projectile.node);
      const targetAlive = this.targetIsAlive(projectile.target);
      if (targetAlive) projectile.lastTargetPoint = this.targetPoint(projectile.target);
      const deadLatch = latchDeadTargetPoint(
        projectile.deadInLast,
        projectile.deadInLastLatched,
        targetAlive,
        projectile.lastTargetPoint,
        source,
      );
      if (deadLatch) {
        projectile.deadInLastLatched = true;
        projectile.deadTargetPoint = deadLatch.point;
        projectile.autoFlow = false;
        if (deadLatch.consumeImmediately) {
          projectile.node.destroy();
          this.projectiles.splice(index, 1);
          continue;
        }
      }
      if (projectile.autoFlow && targetAlive) {
        projectile.flowTimeMilliseconds += delta * 1000;
        if (projectile.flowTimeMilliseconds >= 30) {
          projectile.flowTimeMilliseconds = 0;
          const destination = this.targetPoint(projectile.target);
          const currentDegrees = Math.atan2(projectile.velocity.y, projectile.velocity.x) * 180 / Math.PI;
          const wantedDegrees = Math.atan2(destination.y - source.y, destination.x - source.x) * 180 / Math.PI;
          const nextDegrees = currentDegrees + projectileTurnDelta(currentDegrees, wantedDegrees);
          const radians = nextDegrees * Math.PI / 180;
          projectile.velocity = { x: Math.cos(radians) * projectile.speed, y: Math.sin(radians) * projectile.speed };
        }
      }
      const end = {
        x: source.x + projectile.velocity.x * delta,
        y: source.y + projectile.velocity.y * delta,
      };
      const transform = projectile.node.getComponent(UITransform);
      if (projectile.deadInLastLatched && projectile.deadTargetPoint) {
        const point = projectile.deadTargetPoint;
        const deadContact = firstSweptContact(source, end, [{
          value: true,
          box: { left: point.x - 25, right: point.x + 25, top: point.y - 25, bottom: point.y + 25 },
        }], (transform?.contentSize.width ?? 38) / 2, (transform?.contentSize.height ?? 20) / 2);
        if (deadContact) {
          if (projectile.impactEffect) this.spawnProjectileImpactEffect(projectile.impactEffect, point);
          projectile.node.destroy();
          this.projectiles.splice(index, 1);
          continue;
        }
      }
      const contact = this.findProjectileContact(
        projectile,
        source,
        end,
        (transform?.contentSize.width ?? 38) / 2,
        (transform?.contentSize.height ?? 20) / 2,
      );
      if (contact) {
        const hitPoint = {
          x: source.x + (end.x - source.x) * contact.time,
          y: source.y + (end.y - source.y) * contact.time,
        };
        projectile.node.setPosition(this.centerPosition(hitPoint.x, hitPoint.y));
        if (projectile.impactEffect) this.spawnProjectileImpactEffect(projectile.impactEffect, hitPoint);
        this.applyCombatImpact(
          contact.value,
          projectile.damage,
          projectile.criticalChance,
          projectile.criticalDamage,
          projectile.team,
          projectile.aoeRadius,
          hitPoint,
          projectile.repelPhysicsUnitsPerSecond,
          projectile.repelSeconds,
          projectile.sourcePoint,
          projectile.splashDamageRatio,
        );
        const hitActor = contact.value.kind === 'actor' ? contact.value.actor : undefined;
        if (hitActor && projectile.hitActors.indexOf(hitActor) < 0) projectile.hitActors.push(hitActor);
        if (hitActor && projectile.jumpRemaining > 0) {
          projectile.jumpRemaining -= 1;
          const nextActor = this.findProjectileJumpTarget(projectile, hitPoint);
          if (nextActor) {
            const destination = this.actorPoint(nextActor);
            const direction = normalizeVector({ x: destination.x - hitPoint.x, y: destination.y - hitPoint.y });
            projectile.target = { kind: 'actor', actor: nextActor };
            projectile.velocity = { x: direction.x * projectile.speed, y: direction.y * projectile.speed };
            projectile.clock = 0;
            projectile.lifeTime = projectile.resetLifeTime;
            projectile.flowTimeMilliseconds = 0;
            projectile.lastTargetPoint = { ...destination };
            projectile.deadTargetPoint = null;
            projectile.deadInLastLatched = false;
            continue;
          }
        }
        projectile.node.destroy();
        this.projectiles.splice(index, 1);
        continue;
      }
      if (projectile.clock >= projectile.lifeTime) {
        projectile.node.destroy();
        this.projectiles.splice(index, 1);
        continue;
      }
      projectile.node.setPosition(this.centerPosition(end.x, end.y));
      projectile.node.setRotationFromEuler(0, 0, -Math.atan2(projectile.velocity.y, projectile.velocity.x) * 180 / Math.PI);
    }
  }

  private findProjectileJumpTarget(projectile: CombatProjectile, point: { x: number; y: number }): CombatActor | null {
    if (projectile.team !== 'ally') return null;
    const candidates = this.enemies.filter((enemy) => enemy.hitPoints > 0 && enemy.node.isValid
      && projectile.hitActors.indexOf(enemy) < 0
      && distanceBetween(this.actorPoint(enemy), point) <= projectile.attackRange);
    if (candidates.length === 0) return null;
    return candidates[Math.floor(this.runtimeRandom() * candidates.length)] ?? candidates[0];
  }

  private findProjectileContact(
    projectile: CombatProjectile,
    start: { x: number; y: number },
    end: { x: number; y: number },
    halfWidth: number,
    halfHeight: number,
  ): { value: CombatTarget; time: number } | null {
    const candidates: Array<{ value: CombatTarget; box: { left: number; right: number; top: number; bottom: number } }> = [];
    if (projectile.deadInLastLatched) return null;
    if (projectile.forceTargetOnly && this.targetIsAlive(projectile.target)) {
      if (projectile.target.kind === 'actor' && projectile.target.actor) {
        candidates.push({ value: projectile.target, box: this.actorHitBox(projectile.target.actor) });
      } else if (projectile.target.kind === 'building' && projectile.target.building) {
        const box = this.buildingHitBox(projectile.target.building);
        if (box) candidates.push({ value: projectile.target, box });
      } else if (projectile.target.kind === 'castle') {
        candidates.push({ value: projectile.target, box: this.castleHitBox() });
      }
      return firstSweptContact(start, end, candidates, halfWidth, halfHeight);
    }
    if (projectile.team === 'ally') {
      for (const enemy of this.enemies) {
        if (enemy.hitPoints > 0 && enemy.node.isValid) {
          candidates.push({ value: { kind: 'actor', actor: enemy }, box: this.actorHitBox(enemy) });
        }
      }
    } else {
      for (const ally of this.allies) {
        if (ally.hitPoints > 0 && ally.node.isValid) {
          candidates.push({ value: { kind: 'actor', actor: ally }, box: this.actorHitBox(ally) });
        }
      }
      for (const building of this.placedBuildings) {
        const box = this.buildingHitBox(building);
        if (box) candidates.push({ value: { kind: 'building', building }, box });
      }
      if (this.castleHp > 0) candidates.push({ value: { kind: 'castle' }, box: this.castleHitBox() });
    }
    return firstSweptContact(start, end, candidates, halfWidth, halfHeight);
  }

  private actorHitBox(actor: CombatActor): { left: number; right: number; top: number; bottom: number } {
    const point = this.actorPoint(actor);
    const visualHeight = actor.visual.getComponent(UITransform)?.contentSize.height ?? 80;
    const bottom = point.y + visualHeight / 2;
    return { left: point.x - 25, right: point.x + 25, top: bottom - 80, bottom };
  }

  private buildingHitBox(building: PlacedBuilding): { left: number; right: number; top: number; bottom: number } | null {
    if (building.hitPoints <= 0 || !building.node.active) return null;
    const width = Math.max(1, ...building.definition.shape.map(([x]) => x + 1)) * CELL_STEP - CELL_GAP;
    const height = Math.max(1, ...building.definition.shape.map(([, y]) => y + 1)) * CELL_STEP - CELL_GAP;
    const left = GRID_X + building.column * CELL_STEP;
    const top = GRID_Y + building.row * CELL_STEP + PREPARATION_SHIFT;
    return { left, right: left + width, top, bottom: top + height };
  }

  private castleHitBox(): { left: number; right: number; top: number; bottom: number } {
    const left = GRID_X + this.castleColumn * CELL_STEP;
    const top = GRID_Y + this.castleRow * CELL_STEP + PREPARATION_SHIFT;
    return {
      left,
      right: left + CASTLE.width * CELL_STEP - CELL_GAP,
      top,
      bottom: top + CASTLE.height * CELL_STEP - CELL_GAP,
    };
  }

  private applyCombatImpact(
    primary: CombatTarget,
    attack: number,
    criticalChance: number,
    criticalDamage: number,
    team: ActorTeam,
    aoeRadius: number,
    impactPoint: { x: number; y: number },
    repelPhysicsUnitsPerSecond = 0,
    repelSeconds = 0,
    sourcePoint = impactPoint,
    splashDamageRatio = 1,
  ): void {
    if (aoeRadius <= 0) {
      this.applyCombatHit(
        primary,
        attack,
        criticalChance,
        criticalDamage,
        team,
        repelPhysicsUnitsPerSecond,
        repelSeconds,
        sourcePoint,
      );
      return;
    }
    const targets: CombatTarget[] = [];
    if (team === 'ally') {
      for (const enemy of [...this.enemies]) {
        if (enemy.hitPoints > 0 && enemy.node.isValid && distanceBetween(this.actorPoint(enemy), impactPoint) <= aoeRadius) {
          targets.push({ kind: 'actor', actor: enemy });
        }
      }
    } else {
      for (const ally of [...this.allies]) {
        if (ally.hitPoints > 0 && ally.node.isValid && distanceBetween(this.actorPoint(ally), impactPoint) <= aoeRadius) {
          targets.push({ kind: 'actor', actor: ally });
        }
      }
      for (const building of [...this.placedBuildings]) {
        if (building.hitPoints > 0 && building.node.active && distanceBetween(this.buildingPoint(building), impactPoint) <= aoeRadius) {
          targets.push({ kind: 'building', building });
        }
      }
      if (primary.kind === 'castle' || (this.castleHp > 0 && distanceBetween(this.castleRoutePoint(), impactPoint) <= aoeRadius)) {
        targets.push({ kind: 'castle' });
      }
    }
    const includesPrimary = targets.some((target) => target.kind === primary.kind
      && target.actor === primary.actor && target.building === primary.building);
    if (!includesPrimary && this.targetIsAlive(primary)) targets.push(primary);
    for (const target of targets) {
      if (this.finished || !this.targetIsAlive(target)) continue;
      const isPrimary = target.kind === primary.kind
        && target.actor === primary.actor && target.building === primary.building;
      this.applyCombatHit(
        target,
        isPrimary ? attack : attack * splashDamageRatio,
        criticalChance,
        criticalDamage,
        team,
        repelPhysicsUnitsPerSecond,
        repelSeconds,
        sourcePoint,
      );
    }
  }

  private applyCombatHit(
    target: CombatTarget,
    attack: number,
    criticalChance: number,
    criticalDamage: number,
    team: ActorTeam,
    repelPhysicsUnitsPerSecond = 0,
    repelSeconds = 0,
    sourcePoint = this.targetPoint(target),
  ): void {
    const dodge = target.kind === 'actor' ? target.actor?.dodge ?? 0 : 0;
    const traitAdjustedAttack = team === 'ally' ? attack * this.playerTraitDamageMultiplier(target) : attack;
    const hit = resolveAttack(
      { attack: traitAdjustedAttack, criticalChance, criticalDamage, targetDodge: dodge },
      { dodge: this.runtimeRandom(), critical: this.runtimeRandom() },
    );
    if (target.kind === 'actor' && target.actor) {
      this.applyRepel(target.actor, sourcePoint, repelPhysicsUnitsPerSecond, repelSeconds);
      if (hit.dodged) {
        if (team === 'ally' && target.actor.team === 'enemy') {
          const point = this.actorPoint(target.actor);
          this.spawnDamageText(point.x, point.y - 145, 0, new Color(159, 216, 255));
        }
        return;
      }
      target.actor.hitPoints = applyDamage(target.actor.hitPoints, hit.damage);
      this.updateActorHealthBar(target.actor, true);
      if (team === 'ally' && target.actor.team === 'enemy') {
        const point = this.actorPoint(target.actor);
        this.spawnDamageText(point.x, point.y - 145, hit.damage, hit.critical ? new Color(255, 213, 77) : Color.WHITE);
      }
      if (target.actor.hitPoints <= 0) this.removeActor(target.actor);
      return;
    }
    if (hit.dodged) return;
    if (target.kind === 'building' && target.building) {
      target.building.hitPoints = applyDamage(target.building.hitPoints, hit.damage);
      this.updateBuildingHealthBar(target.building, true);
      const point = this.buildingPoint(target.building);
      this.spawnDamageText(point.x, point.y, hit.damage, hit.critical ? new Color(255, 213, 77) : new Color(255, 118, 91));
      if (target.building.hitPoints <= 0) target.building.node.active = false;
      return;
    }
    this.castleHp = applyDamage(this.castleHp, hit.damage);
    this.refreshCastleHp();
    if (this.castleHp <= 0) this.finishRun(false);
  }

  private removeActor(actor: CombatActor): void {
    const collection = actor.team === 'enemy' ? this.enemies : this.allies;
    const index = collection.indexOf(actor);
    if (index >= 0) collection.splice(index, 1);
    if (actor.team === 'enemy') {
      this.resolvedThisWave += 1;
      this.kills += 1;
      this.money += actor.deadCoins;
      const resultBaseExperience = actor.elite ? STAGE2_EXPERIENCE.elite : STAGE2_EXPERIENCE.normal;
      const fightLevelBaseExperience = actor.boss
        ? STAGE2_EXPERIENCE.boss
        : actor.elite
          ? STAGE2_EXPERIENCE.elite
          : STAGE2_EXPERIENCE.normal;
      const buildingBonus = this.activeBuildingExperienceBonus();
      this.battleExperience += battleExperienceGain(resultBaseExperience, buildingBonus);
      this.grantFightLevelExperience(fightLevelBaseExperience, buildingBonus);
      this.refreshEconomyHud();
    }
    actor.node.destroy();
  }

  private grantFightLevelExperience(baseExperience: number, buildingBonus: number): void {
    const gained = fightLevelExperienceGain(
      baseExperience,
      STAGE2_EXPERIENCE.fightLevelFix,
      buildingBonus + traitSum(this.activeTraits, 'ExpUp'),
    );
    const threshold = FIGHT_LEVEL_EXPERIENCE[this.fightLevel];
    const afterNext = FIGHT_LEVEL_EXPERIENCE[this.fightLevel + 1];
    if (threshold === undefined || gained <= 0) return;
    if (this.fightLevelExperience + gained >= threshold) {
      // Shipped logic discards overflow and does not advance beyond the final selectable level.
      if (afterNext === undefined) return;
      this.fightLevel += 1;
      this.fightLevelExperience = 0;
      this.openTraitSelection();
    } else {
      this.fightLevelExperience += gained;
    }
    this.updateFightLevelHud();
    this.publishNormalTransitionSmokeState();
  }

  private openTraitSelection(forceChoices?: ReadonlyArray<GeneralTraitChoice>): void {
    if (this.traitSelecting) {
      this.pendingTraitSelections += 1;
      return;
    }
    const choices = forceChoices ? [...forceChoices] : rollGeneralTraitChoices(this.activeTraits, this.traitRandom);
    if (choices.length === 0) return;
    this.currentTraitChoices = choices;
    this.traitSelecting = true;
    this.hudLayer.active = false;
    this.airSupportLayer.active = false;
    this.traitPanel?.destroy();

    const panel = this.addRect(
      this.overlayLayer,
      'TraitSelectPanel',
      30,
      15,
      630,
      500,
      new Color(23, 35, 63, 252),
      new Color(20, 29, 49, 255),
    );
    this.traitPanel = panel;
    this.addChildLabel(panel, `战斗等级 ${this.fightLevel} · 选择强化`, 0, 205, 570, 65, 31, Color.WHITE);
    choices.forEach((trait, index) => {
      const y = 94 - index * 110;
      const qualityColors = [
        new Color(74, 190, 244, 255),
        new Color(170, 112, 255, 255),
        new Color(255, 176, 73, 255),
      ];
      const button = this.addLocalRect(
        panel,
        `TraitChoice_${index}_${trait.id}`,
        0,
        y,
        520,
        86,
        new Color(32, 190, 239, 255),
        new Color(8, 23, 37, 255),
      );
      this.addLocalRect(
        button,
        `TraitQuality_${trait.quality}`,
        -251,
        0,
        12,
        86,
        qualityColors[trait.quality - 1] ?? Color.WHITE,
        qualityColors[trait.quality - 1] ?? Color.WHITE,
      );
      this.addChildLabel(button, this.traitDescription(trait), 0, 0, 490, 82, 24, Color.WHITE);
      button.on(Node.EventType.TOUCH_END, () => this.selectTraitChoices([trait]));
    });
    this.publishTraitSelectionState();
    this.publishNormalTransitionSmokeState();
    if (this.normalLifecycleSmoke) {
      this.scheduleCombatDelay(() => {
        if (this.traitSelecting && this.currentTraitChoices.length > 0) {
          const combatPriority: ReadonlyArray<GeneralTraitEffectKey> = [
            'AllUnitAtk', 'AllUnitHp', 'AllUnitAtkSpd', 'EnemySpeedDown',
            'DmgUpWithCnt', 'RangedUnitAtkRange', 'BossDmgUp',
          ];
          const selected = combatPriority
            .map((effectKey) => this.currentTraitChoices.find((choice) => choice.effectKey === effectKey))
            .find((choice): choice is GeneralTraitChoice => !!choice)
            ?? this.currentTraitChoices[0];
          this.selectTraitChoices([selected]);
        }
      }, 0.25);
    }
  }

  private selectTraitChoices(choices: ReadonlyArray<GeneralTraitChoice>): void {
    for (const trait of choices) this.applyGeneralTrait(trait);
    this.traitPanel?.destroy();
    this.traitPanel = null;
    this.currentTraitChoices = [];
    this.traitSelecting = false;
    this.hudLayer.active = true;
    this.airSupportLayer.active = this.fighting && !this.finished;
    if (this.pendingTraitSelections > 0) {
      this.pendingTraitSelections -= 1;
      this.openTraitSelection();
    } else {
      this.publishTraitSelectionState();
    }
    this.publishNormalTransitionSmokeState();
  }

  private applyGeneralTrait(trait: GeneralTraitChoice): void {
    this.activeTraits.push({ ...trait });
    if (trait.effectKey === 'Coins') this.money += trait.value;
    if (trait.effectKey === 'RandLvUp') void this.upgradeRandomPlacedBuildings(Math.max(0, Math.trunc(trait.value)));
    for (const ally of this.allies) {
      if (trait.effectKey === 'AllUnitAtk') ally.attack *= 1 + trait.value;
      else if (trait.effectKey === 'AllUnitHp') {
        ally.hitPoints *= 1 + trait.value;
        ally.maxHitPoints *= 1 + trait.value;
        this.updateActorHealthBar(ally);
      } else if (trait.effectKey === 'AllUnitAtkSpd') ally.attackSpeed *= 1 + trait.value;
      else if (trait.effectKey === 'RangedUnitAtkRange' && ally.range > 1.5 * PHYSICS_PIXEL_RATIO) {
        ally.range *= 1 + trait.value;
      }
    }
    this.refreshRefreshButtons();
    this.refreshEconomyHud();
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-cocos-trait-applied', JSON.stringify({
        id: trait.id,
        quality: trait.quality,
        value: trait.value,
        effectKey: trait.effectKey,
        activeCount: this.activeTraits.length,
      }));
    }
  }

  private async upgradeRandomPlacedBuildings(count: number): Promise<void> {
    for (let iteration = 0; iteration < count; iteration += 1) {
      const candidates = this.placedBuildings.filter((building) => upgradeShopDefinition(building.definition) !== null);
      if (candidates.length === 0) return;
      const target = candidates[Math.min(candidates.length - 1, Math.floor(this.traitRandom() * candidates.length))];
      const upgraded = upgradeShopDefinition(target.definition);
      if (!upgraded) continue;
      target.definition = upgraded;
      target.maxHitPoints = upgraded.hitPoints;
      target.hitPoints = upgraded.hitPoints;
      const sprite = target.node.getComponent(Sprite);
      if (sprite) sprite.spriteFrame = await this.loadSpriteFrame(upgraded.sprite);
      target.node.getChildByName('WeaponMount')?.destroy();
      await this.attachWeaponMount(target.node, upgraded);
      this.positionPlacedBuilding(target);
      this.updateBuildingHealthBar(target);
    }
  }

  private playerTraitDamageMultiplier(target: CombatTarget): number {
    let multiplier = 1;
    for (const trait of this.activeTraits) {
      if (trait.effectKey === 'DmgUpWithCnt') multiplier *= 1 + this.placedBuildings.length * trait.value;
      if (trait.effectKey === 'BossDmgUp' && target.kind === 'actor' && target.actor?.boss) {
        multiplier *= 1 + trait.value;
      }
    }
    return multiplier;
  }

  private traitDescription(trait: GeneralTraitChoice): string {
    const percent = `${Math.round(trait.value * 100)}%`;
    const descriptions: Record<GeneralTraitEffectKey, string> = {
      AllUnitAtk: `所有士兵的攻击+${percent}`,
      AllUnitHp: `所有士兵的生命+${percent}`,
      EnemySpeedDown: `所有敌人移动速度-${percent}`,
      AllUnitAtkSpd: `所有士兵攻速+${percent}`,
      ExpUp: `经验获取+${percent}`,
      CoinsUp: `每波获取银币+${trait.value}`,
      Coins: `立刻获得${trait.value}银币`,
      RangedUnitAtkRange: `所有远程士兵的射程+${percent}`,
      ShopQ2RateUp: `商店出现2级建筑概率+${percent}`,
      ShopFreeItem: `商店刷新时多${trait.value}个建筑`,
      ShopConsume: `商店刷新价格-${percent}`,
      DmgUpWithCnt: `基地里每有一个建筑，伤害+${percent}`,
      WinRewardUp: `胜利后结算奖励增加${percent}`,
      BossDmgUp: `对Boss伤害增加${percent}`,
      Interest: `每波战斗结束获得${percent}利息（上限30）`,
      RandLvUp: `随机${trait.value}个建筑合成等级提升一级`,
    };
    return descriptions[trait.effectKey];
  }

  private publishTraitSelectionState(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-cocos-trait-selection', JSON.stringify({
      fightLevel: this.fightLevel,
      fightLevelExperience: this.fightLevelExperience,
      selecting: this.traitSelecting,
      pendingSelections: this.pendingTraitSelections,
      activeCount: this.activeTraits.length,
      choices: this.currentTraitChoices.map((trait) => ({
        id: trait.id,
        quality: trait.quality,
        value: trait.value,
        effectKey: trait.effectKey,
      })),
    }));
  }

  private activeBuildingExperienceBonus(): number {
    return this.placedBuildings.reduce((sum, building) => {
      if (!building.node.active || building.hitPoints <= 0 || building.definition.kind !== 'economy') return sum;
      return sum + (building.definition.experienceBonus ?? 0);
    }, 0);
  }

  private activeMineIncome(): number {
    return waveEndMineIncome(this.placedBuildings
      .filter((building) => building.node.active && building.hitPoints > 0)
      .map((building) => building.definition.moneyPerWave ?? 0));
  }

  private activeEnemySpeedMultiplier(): number {
    const buildingMultiplier = enemySpeedMultiplier(this.placedBuildings
      .filter((building) => building.node.active && building.hitPoints > 0 && building.definition.kind === 'support')
      .map((building) => building.definition.enemySlowAmount ?? 0));
    return buildingMultiplier / traitMultiplier(this.activeTraits, 'EnemySpeedDown');
  }

  private activeGlobalCriticalChanceBonus(): number {
    return this.placedBuildings.reduce((sum, building) => {
      if (!building.node.active || building.hitPoints <= 0) return sum;
      return sum + (building.definition.globalCriticalChanceBonus ?? 0);
    }, 0);
  }

  private adjacentAttackSpeedBonuses(target: PlacedBuilding): number[] {
    return this.placedBuildings
      .filter((source) => source !== target
        && source.node.active
        && source.hitPoints > 0
        && (source.definition.adjacentAttackSpeedBonus ?? 0) > 0
        && areGridFootprintsAdjacent(
          source.column, source.row, source.definition.shape,
          target.column, target.row, target.definition.shape,
        ))
      .map((source) => source.definition.adjacentAttackSpeedBonus ?? 0);
  }

  private adjacentAttackBonuses(target: PlacedBuilding): number[] {
    return this.placedBuildings
      .filter((source) => source !== target
        && source.node.active
        && source.hitPoints > 0
        && (source.definition.adjacentAttackBonus ?? 0) > 0
        && areGridFootprintsAdjacent(
          source.column, source.row, source.definition.shape,
          target.column, target.row, target.definition.shape,
        ))
      .map((source) => source.definition.adjacentAttackBonus ?? 0);
  }

  private checkWaveComplete(): void {
    const expected = this.waveCounts[this.wave - 1];
    if (this.spawnedThisWave < expected || this.enemies.length > 0 || this.projectiles.length > 0 || this.finished) return;
    if (this.normalTransitionSmokeState && this.normalTransitionSmokeState.completedWaves.indexOf(this.wave) < 0) {
      this.normalTransitionSmokeState.completedWaves.push(this.wave);
    }
    if (this.wave >= this.waveCounts.length) {
      if (this.lifecycleSmokeState && this.lifecycleSmokeState.completedWaves.indexOf(this.wave) < 0) {
        this.lifecycleSmokeState.completedWaves.push(this.wave);
      }
      this.finishRun(true);
      return;
    }
    if (this.lifecycleSmokeState && this.lifecycleSmokeState.completedWaves.indexOf(this.wave) < 0) {
      this.lifecycleSmokeState.completedWaves.push(this.wave);
    }
    this.money += this.activeMineIncome() + traitSum(this.activeTraits, 'CoinsUp');
    for (const trait of this.activeTraits) {
      if (trait.effectKey === 'Interest') this.money += Math.min(30, this.money * trait.value);
    }
    this.refreshEconomyHud();
    this.fighting = false;
    this.airSupportLayer.active = false;
    this.wave += 1;
    for (const ally of this.allies) this.setActorAction(ally, 'idle');
    this.actorLayer.active = false;
    this.shopLayer.active = true;
    this.gridLayer.setPosition(0, 0);
    for (const node of this.treeNodes.values()) {
      for (const child of node.children) child.active = true;
    }
    this.waveLabel.string = `波次 ${this.wave}/${this.waveCounts.length}`;
    this.updateFightLevelHud();
    this.updateLifecycleSmokeState();
    this.publishNormalTransitionSmokeState();
    void this.rollShop(false).then(async () => {
      if (this.normalLifecycleSmoke) await this.deployLifecycleShopOffers();
      this.refreshRefreshButtons();
      this.publishNormalTransitionSmokeState();
      if (this.lifecycleSmoke) this.scheduleOnce(() => void this.startFight(), 0.001);
      else if (this.normalLifecycleSmoke) this.scheduleCombatDelay(() => void this.startFight(), 0.5);
    }).catch((error: unknown) => {
      this.normalTransitionSmokeState?.errors.push(String(error));
      this.publishNormalTransitionSmokeState();
    });
  }

  private finishRun(victory: boolean): void {
    if (this.finished) return;
    this.finished = true;
    this.fighting = false;
    this.shopLayer.active = false;
    this.airSupportLayer.active = false;
    this.hudLayer.active = false;
    this.clearProjectiles();
    for (const ally of this.allies) this.setActorAction(ally, victory ? 'victory' : 'idle');
    if (this.lifecycleSmokeState) {
      this.lifecycleSmokeState.victory = victory;
      this.lifecycleSmokeState.active = false;
      this.updateLifecycleSmokeState();
    }
    if (this.normalTransitionSmokeState) {
      this.normalTransitionSmokeState.victory = victory;
      this.publishNormalTransitionSmokeState();
    }
    this.showResult(victory);
  }

  private showResult(victory: boolean): void {
    const maxWave = this.waveCounts.length;
    const campaign = this.applyCurrentCampaignResult(victory);
    const hasNextStage = victory && this.stageId < this.campaignStageCount;
    const title = victory ? '守城成功' : '城堡失守';
    const subtitle = victory ? `${maxWave} 波敌军已全部击退` : '调整建筑布局后重新挑战';
    const statistics = `关卡 ${this.stageId} · 击退 ${this.kills} · 经验 ${this.battleExperience}`;
    this.addRect(this.overlayLayer, 'ResultShade', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, new Color(0, 0, 0, 158), new Color(0, 0, 0, 158));
    this.addRect(
      this.overlayLayer,
      'ResultPanel',
      105,
      400,
      540,
      390,
      victory ? new Color(54, 143, 61, 250) : new Color(156, 48, 40, 250),
      victory ? new Color(35, 93, 40, 255) : new Color(98, 30, 25, 255),
    );
    this.addLabel(this.overlayLayer, title, 145, 430, 460, 80, 52, Color.WHITE);
    this.addLabel(this.overlayLayer, subtitle, 150, 515, 450, 80, 28, Color.WHITE);
    this.addLabel(this.overlayLayer, statistics, 145, 590, 460, 50, 20, Color.WHITE);
    if (campaign.stageAdvanced) {
      this.addLabel(this.overlayLayer, `已解锁关卡 ${campaign.unlockedStage}`, 145, 625, 460, 34, 18, Color.WHITE);
    }
    this.publishResultState(victory, campaign, hasNextStage, false);
    const campaignEntry = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('battle') === '1';
    const buttons: Array<Promise<Node>> = [];
    if (campaignEntry) {
      buttons.push(this.addButton(this.overlayLayer, '再战', 'original/ui/button_orange', hasNextStage ? 117 : 177, 670, 160, 88, () => this.retryRun(), 27));
      buttons.push(this.addButton(this.overlayLayer, '主界面', 'original/ui/button_blue', hasNextStage ? 295 : 413, 670, 160, 88, () => this.returnToCampaign(), 27));
      if (hasNextStage) buttons.push(this.addButton(this.overlayLayer, '下一关', 'original/ui/button_green', 473, 670, 160, 88, () => this.nextStage(), 27));
    } else {
      buttons.push(this.addButton(
        this.overlayLayer,
        '重新挑战',
        'original/ui/button_orange',
        hasNextStage ? 130 : 255,
        670,
        hasNextStage ? 220 : 240,
        88,
        () => this.retryRun(),
        30,
      ));
      if (hasNextStage) {
        buttons.push(this.addButton(
          this.overlayLayer,
          '下一关',
          'original/ui/button_green',
          400,
          670,
          220,
          88,
          () => this.nextStage(),
          30,
        ));
      }
    }
    void Promise.all(buttons).then(() => this.publishResultState(victory, campaign, hasNextStage, true));
  }

  private publishResultState(
    victory: boolean,
    campaign: CampaignBattleResult,
    hasNextStage: boolean,
    ready: boolean,
  ): void {
    const result = {
      ready,
      victory,
      stage: this.stageId,
      wave: this.wave,
      kills: this.kills,
      exp: this.battleExperience,
      battleMoney: this.money,
      maxWave: this.waveCounts.length,
      maxStageRecord: campaign.after,
      stageAdvanced: campaign.stageAdvanced,
      unlockedStage: campaign.unlockedStage,
      title: victory ? '守城成功' : '城堡失守',
      subtitle: victory ? `${this.waveCounts.length} 波敌军已全部击退` : '调整建筑布局后重新挑战',
      retryOnly: !hasNextStage,
      nextStageAvailable: hasNextStage,
      nextStageDeferred: false,
      alliesInVictory: this.allies.filter((ally) => ally.action === 'victory').length,
      alliesInIdle: this.allies.filter((ally) => ally.action === 'idle').length,
      layout: {
        shade: [0, 0, DESIGN_WIDTH, DESIGN_HEIGHT],
        panel: [105, 400, 540, 390],
        retry: [hasNextStage ? 130 : 255, 670, hasNextStage ? 220 : 240, 88],
        nextStage: hasNextStage ? [400, 670, 220, 88] : null,
      },
      testAdapter: this.resultSmokeOutcome,
    };
    if (typeof window !== 'undefined') {
      (window as unknown as { __cocosResult?: typeof result }).__cocosResult = result;
      document.documentElement.setAttribute('data-cocos-result', JSON.stringify(result));
    }
  }

  private retryRun(): void {
    if (typeof window !== 'undefined' && this.resultSmokeOutcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete('test');
      url.searchParams.delete('motionOffsetMs');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
      document.documentElement.removeAttribute('data-cocos-result');
      delete (window as unknown as { __cocosResult?: unknown }).__cocosResult;
    }
    director.loadScene('Main');
  }

  private nextStage(): void {
    if (typeof window === 'undefined' || this.stageId >= this.campaignStageCount) return;
    const url = new URL(window.location.href);
    url.searchParams.set('stage', String(this.stageId + 1));
    url.searchParams.delete('test');
    url.searchParams.delete('motionOffsetMs');
    url.searchParams.delete('build');
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  }

  private returnToCampaign(): void {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('screen', 'campaign');
    url.searchParams.set('stage', String(this.stageId));
    url.searchParams.delete('battle');
    url.searchParams.delete('test');
    url.searchParams.delete('motionOffsetMs');
    url.searchParams.delete('build');
    window.location.href = `${url.pathname}${url.search}${url.hash}`;
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectiles) projectile.node.destroy();
    this.projectiles.length = 0;
  }

  private updateFightLevelHud(): void {
    const threshold = FIGHT_LEVEL_EXPERIENCE[this.fightLevel];
    const ratio = threshold === undefined || threshold <= 0
      ? 1
      : Math.max(0, Math.min(1, this.fightLevelExperience / threshold));
    const width = 604 * ratio;
    this.fightLevelProgressFill.getComponent(UITransform)?.setContentSize(width, 16);
    this.fightLevelProgressFill.setPosition(this.topLeftPosition(42, 129, width, 16));
    this.fightLevelLabel.string = String(this.fightLevel);
  }

  private refreshCastleHp(): void {
    const width = 135 * Math.max(0, this.castleHp / CASTLE.hp);
    this.castleHpFill.getComponent(UITransform)?.setContentSize(width, 15);
    this.castleHpFill.setPosition(this.topLeftPosition(308, 4 + Math.min(1005, Math.max(820, GRID_Y + (this.castleRow + 2) * CELL_STEP - 31)), width, 15));
    this.castleHpLabel.string = `${Math.ceil(this.castleHp)}`;
    this.castleHpLabel.node.active = this.fighting;
  }

  private updateActorHealthBar(actor: CombatActor, reveal = false): void {
    const width = 64 * Math.max(0, actor.hitPoints / Math.max(1, actor.maxHitPoints));
    actor.hpFill.getComponent(UITransform)?.setContentSize(width, 8);
    const y = this.actorPoint(actor).y;
    actor.hpBack.active = actor.team === 'enemy' ? y > 180 : reveal || actor.hitPoints < actor.maxHitPoints;
  }

  private updateBuildingHealthBar(building: PlacedBuilding, reveal = false): void {
    if (!building.hpFill || !building.hpBack) return;
    const width = 76 * Math.max(0, building.hitPoints / Math.max(1, building.maxHitPoints));
    building.hpFill.getComponent(UITransform)?.setContentSize(width, 8);
    building.hpBack.active = reveal || building.hitPoints < building.maxHitPoints;
  }

  private setActorAction(actor: CombatActor, action: ActorAction, oneShot = false, onComplete?: () => void): void {
    if (!oneShot && actor.attacking) return;
    if (!oneShot && actor.action === action) return;
    actor.action = action;
    actor.animator.play(this.framesFor(actor.team, actor.visualBody, action), 0.102, !oneShot, onComplete);
  }

  private setActorFacing(actor: CombatActor, directionX: number): void {
    if (Math.abs(directionX) < 0.05) return;
    actor.visual.setScale(directionX < 0 ? -1 : 1, 1, 1);
  }

  private framesFor(team: ActorTeam, body: string, action: ActorAction): SpriteFrame[] {
    const frames = this.actionFrames.get(`${team}:${body}:${action}`);
    if (!frames || frames.length === 0) throw new Error(`Battle frames not loaded: ${team}/${body}/${action}`);
    return frames;
  }

  private targetIsAlive(target: CombatTarget): boolean {
    if (target.kind === 'actor') return !!target.actor && target.actor.hitPoints > 0 && target.actor.node.isValid;
    if (target.kind === 'building') return !!target.building && target.building.hitPoints > 0 && target.building.node.active;
    return this.castleHp > 0;
  }

  private targetPoint(target: CombatTarget, routeSourceX?: number): { x: number; y: number } {
    if (target.kind === 'actor' && target.actor) return this.actorPoint(target.actor);
    if (target.kind === 'building' && target.building) {
      const point = this.buildingPoint(target.building);
      if (routeSourceX === undefined) return point;
      const width = Math.max(1, ...target.building.definition.shape.map(([x]) => x + 1)) * CELL_STEP - CELL_GAP;
      return { x: Math.max(point.x - width / 2, Math.min(point.x + width / 2, routeSourceX)), y: point.y };
    }
    const point = this.castleRoutePoint();
    if (routeSourceX === undefined) return point;
    const width = CASTLE.width * CELL_STEP - CELL_GAP;
    return { x: Math.max(point.x - width / 2, Math.min(point.x + width / 2, routeSourceX)), y: point.y };
  }

  private actorPoint(actor: CombatActor): { x: number; y: number } {
    return this.nodePoint(actor.node);
  }

  private nodePoint(node: Node): { x: number; y: number } {
    return this.localToTopLeft(node.position);
  }

  private buildingPoint(building: PlacedBuilding): { x: number; y: number } {
    const width = Math.max(1, ...building.definition.shape.map(([x]) => x + 1)) * CELL_STEP - CELL_GAP;
    return {
      x: GRID_X + building.column * CELL_STEP + width / 2,
      y: GRID_Y + building.row * CELL_STEP + PREPARATION_SHIFT,
    };
  }

  private buildingFirePoint(building: PlacedBuilding): { x: number; y: number } {
    const mount = building.node.getChildByName('WeaponMount');
    const canvasTransform = this.node.getComponent(UITransform);
    if (!mount || !canvasTransform) return this.buildingPoint(building);
    return this.localToTopLeft(canvasTransform.convertToNodeSpaceAR(mount.worldPosition));
  }

  private castleRoutePoint(): { x: number; y: number } {
    return {
      x: GRID_X + this.castleColumn * CELL_STEP + (CASTLE.width * CELL_STEP - CELL_GAP) / 2,
      y: GRID_Y + this.castleRow * CELL_STEP + PREPARATION_SHIFT,
    };
  }

  private centerPosition(x: number, y: number): Vec3 {
    return new Vec3(x - DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - y, 0);
  }

  private spawnDamageText(x: number, y: number, damage: number | string, color: Color): void {
    const text = typeof damage === 'number' ? `${Math.round(damage)}` : damage;
    const label = this.addLabel(this.actorLayer, text, x - 68, y - 36, 136, 74, 58, color);
    label.node.name = 'CombatDamageText';
    label.outlineColor = new Color(32, 32, 32, 255);
    label.outlineWidth = 5;
    const opacity = label.node.addComponent(UIOpacity);
    opacity.opacity = 255;
    this.damageTexts.push({
      node: label.node,
      opacity,
      origin: label.node.position.clone(),
      clock: 0,
    });
    if (this.lifecycleSmokeState) {
      this.lifecycleSmokeState.damageTextsSpawned += 1;
      this.lifecycleSmokeState.maximumDamageTextsActive = Math.max(
        this.lifecycleSmokeState.maximumDamageTextsActive,
        this.damageTexts.length,
      );
    }
  }

  private updateDamageTexts(delta: number): void {
    for (let index = this.damageTexts.length - 1; index >= 0; index -= 1) {
      const item = this.damageTexts[index];
      if (!item.node.isValid) {
        this.damageTexts.splice(index, 1);
        continue;
      }
      item.clock += delta;
      item.node.setPosition(item.origin.x, item.origin.y + item.clock * 42, item.origin.z);
      item.opacity.opacity = 255 * (1 - Math.min(1, item.clock / 0.85));
      if (item.clock >= 0.85) {
        item.node.destroy();
        this.damageTexts.splice(index, 1);
      }
    }
  }

  private addRect(parent: Node, name: string, x: number, y: number, width: number, height: number, fill: Color, stroke: Color): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(this.topLeftPosition(x, y, width, height));
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    graphics.strokeColor = stroke;
    graphics.lineWidth = 2;
    graphics.rect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
    graphics.stroke();
    parent.addChild(node);
    return node;
  }

  private addLocalRect(parent: Node, name: string, x: number, y: number, width: number, height: number, fill: Color, stroke: Color): Node {
    const node = new Node(name);
    node.layer = this.node.layer;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.rect(-width / 2, -height / 2, width, height);
    graphics.fill();
    graphics.strokeColor = stroke;
    graphics.lineWidth = 3;
    graphics.rect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);
    graphics.stroke();
    parent.addChild(node);
    return node;
  }

  private addLabel(parent: Node, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
    const node = new Node(`Label_${text}`);
    node.layer = this.node.layer;
    node.setPosition(this.topLeftPosition(x, y, width, height));
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    this.applyGameFont(label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = Math.max(fontSize + 4, Math.floor(height / Math.max(1, text.split('\n').length)));
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = new Color(36, 26, 12, 255);
    label.outlineWidth = Math.max(1, Math.round(fontSize * 0.075));
    parent.addChild(node);
    return label;
  }

  private addChildLabel(parent: Node, text: string, x: number, y: number, width: number, height: number, fontSize: number, color: Color): Label {
    const node = new Node(`Label_${text}`);
    node.layer = this.node.layer;
    node.setPosition(x, y);
    node.addComponent(UITransform).setContentSize(width, height);
    const label = node.addComponent(Label);
    this.applyGameFont(label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = height;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableOutline = true;
    label.outlineColor = new Color(36, 26, 12, 255);
    label.outlineWidth = 2;
    parent.addChild(node);
    return label;
  }

  private async addChildSprite(parent: Node, path: string, x: number, y: number, width: number, height: number): Promise<Node> {
    const frame = await this.loadSpriteFrame(path);
    const node = new Node(path.split('/').pop() ?? 'Sprite');
    node.layer = this.node.layer;
    node.setPosition(x, y);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    node.addComponent(UITransform).setContentSize(width, height);
    parent.addChild(node);
    return node;
  }

  private createCachedSprite(parent: Node, path: string, width: number, height: number): Node {
    const frame = this.frameCache.get(path);
    if (!frame) throw new Error(`SpriteFrame was not preloaded: ${path}`);
    const node = new Node(path.split('/').pop() ?? 'Sprite');
    node.layer = this.node.layer;
    node.addComponent(UITransform).setContentSize(width, height);
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    parent.addChild(node);
    return node;
  }

  private async addButton(parent: Node, text: string, spritePath: string, x: number, y: number, width: number, height: number, handler: () => void, fontSize: number): Promise<Node> {
    const button = await this.addSprite(parent, spritePath, x, y, width, height);
    this.addLabel(button, text, 0, 0, width, height, fontSize, Color.WHITE).node.setPosition(0, 0);
    button.on(Node.EventType.TOUCH_END, handler);
    return button;
  }

  private async addSprite(parent: Node, path: string, x: number, y: number, width: number, height: number, keepAspect = false): Promise<Node> {
    const frame = await this.loadSpriteFrame(path);
    const node = new Node(path.split('/').pop() ?? 'Sprite');
    node.layer = this.node.layer;
    const sprite = node.addComponent(Sprite);
    sprite.spriteFrame = frame;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const transform = node.addComponent(UITransform);
    let outputWidth = width;
    let outputHeight = height;
    if (keepAspect) {
      const rect = frame.rect;
      const scale = Math.min(1, width / rect.width, height / rect.height);
      outputWidth = rect.width * scale;
      outputHeight = rect.height * scale;
    }
    transform.setContentSize(outputWidth, outputHeight);
    node.setPosition(this.topLeftPosition(x + (width - outputWidth) / 2, y + (height - outputHeight), outputWidth, outputHeight));
    parent.addChild(node);
    return node;
  }

  private async attachWeaponMount(body: Node, definition: ShopDefinition): Promise<void> {
    if (!definition.weaponMount) return;
    const bodyTransform = body.getComponent(UITransform);
    const bodySprite = body.getComponent(Sprite);
    if (!bodyTransform || !bodySprite?.spriteFrame) return;
    const mountFrame = await this.loadSpriteFrame(definition.weaponMount.sprite);
    const mountNatural = mountFrame.rect;
    const mount = new Node('WeaponMount');
    mount.layer = body.layer;
    const mountSprite = mount.addComponent(Sprite);
    mountSprite.spriteFrame = mountFrame;
    mountSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    mount.addComponent(UITransform).setContentSize(mountNatural.width, mountNatural.height);
    body.addChild(mount);
    this.resizeBuildingVisual(body, definition, bodyTransform.contentSize.width, bodyTransform.contentSize.height);
  }

  private resizeBuildingVisual(body: Node, definition: ShopDefinition, boxWidth: number, boxHeight: number): void {
    const bodyTransform = body.getComponent(UITransform);
    const bodySprite = body.getComponent(Sprite);
    if (!bodyTransform || !bodySprite?.spriteFrame) return;
    const bodyNatural = bodySprite.spriteFrame.rect;
    const fitted = fitBuildingVisualSize(bodyNatural.width, bodyNatural.height, boxWidth, boxHeight);
    bodyTransform.setContentSize(fitted.width, fitted.height);
    const mount = body.getChildByName('WeaponMount');
    const mountTransform = mount?.getComponent(UITransform);
    const mountFrame = mount?.getComponent(Sprite)?.spriteFrame;
    if (!definition.weaponMount || !mount || !mountTransform || !mountFrame) return;
    mountTransform.setContentSize(mountFrame.rect.width * fitted.scale, mountFrame.rect.height * fitted.scale);
    this.positionWeaponMount(body, mount, definition);
  }

  private positionWeaponMount(body: Node, mount: Node, definition: ShopDefinition): void {
    if (!definition.weaponMount) return;
    const bodyTransform = body.getComponent(UITransform);
    const mountTransform = mount.getComponent(UITransform);
    if (!bodyTransform || !mountTransform) return;
    const mountWidth = mountTransform.contentSize.width;
    const mountHeight = mountTransform.contentSize.height;

    const pointX = -bodyTransform.contentSize.width / 2 + bodyTransform.contentSize.width * definition.weaponMount.x;
    const pointY = bodyTransform.contentSize.height / 2 - bodyTransform.contentSize.height * definition.weaponMount.y;
    // Laya's screen-space -90 degrees is Cocos UI-space +90 degrees. The
    // original mount pivots around its left-middle point and points upward.
    const cocosAngle = -definition.weaponMount.rotationDegrees;
    const pivotX = mountWidth * definition.weaponMount.pivot[0];
    const pivotY = mountHeight * (1 - definition.weaponMount.pivot[1]);
    const centerFromPivotX = mountWidth / 2 - pivotX;
    const centerFromPivotY = mountHeight / 2 - pivotY;
    const radians = cocosAngle * Math.PI / 180;
    mount.setPosition(
      pointX + centerFromPivotX * Math.cos(radians) - centerFromPivotY * Math.sin(radians),
      pointY + centerFromPivotX * Math.sin(radians) + centerFromPivotY * Math.cos(radians),
    );
    mount.angle = cocosAngle;
  }

  private async loadCampaignStage(): Promise<void> {
    const [stages, enemies] = await Promise.all([
      this.loadJsonAsset<RecoveredStageCatalogEntry[]>('original/data/stages'),
      this.loadJsonAsset<RecoveredEnemyCatalogEntry[]>('original/data/enemy-variants'),
    ]);
    if (!stages.length || !enemies.length) throw new Error('Recovered campaign catalog is empty');
    this.campaignStageCount = stages.length;
    this.stageCatalog = stages;
    this.localProfile = this.loadLocalProfile();
    this.campaignProgress = [...this.localProfile.maxStageRecord];
    const unlockedStage = campaignUnlockedStage(this.campaignProgress, this.campaignStageCount);
    const runtimeTest = this.readRuntimeTestName();
    const query = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search);
    const defaultStage = runtimeTest ? 2 : unlockedStage;
    const requested = Number(query?.get('stage') ?? defaultStage);
    const requestedStage = Number.isFinite(requested) ? Math.trunc(requested) : defaultStage;
    const boundedStage = Math.max(1, Math.min(stages.length, requestedStage));
    this.stageId = runtimeTest ? boundedStage : Math.min(boundedStage, unlockedStage);
    const stage = stages[this.stageId - 1];
    if (!stage || stage.id !== this.stageId) throw new Error(`Recovered stage is missing: ${this.stageId}`);
    this.stageConfig = stage;
    this.stageName = stage.name || stage.mapId;
    this.stageMapId = stage.mapId;
    this.mapData = stage.mapData.slice();
    this.waveCounts = stage.waveEnemyCountsEffective.slice();
    this.wavePowers = stage.wavePower.slice();
    this.eliteProbabilities = stage.eliteProbability.slice();
    this.hasFinalBoss = stage.hasFinalBoss;
    this.baseEnemyIds = stage.enemies.slice();
    this.storeItemTypeWeights = stage.storeItemTypeWeight.slice();
    this.enemyDefinitions.clear();
    for (const entry of enemies) {
      const baseBody = entry.bodies[0] as UnitBody;
      const base = STAGE2_UNITS[baseBody];
      if (!base) throw new Error(`Unsupported recovered enemy body: ${entry.id}/${entry.bodies[0]}`);
      const repel = Array.isArray(entry.traits?.Repel) ? entry.traits.Repel as number[] : [];
      this.enemyDefinitions.set(entry.id, {
        id: entry.id,
        body: baseBody,
        bodies: entry.bodies.slice(),
        hitPoints: entry.hp,
        attack: entry.attack,
        attackRange: entry.range,
        attackSpeed: entry.attackSpeed,
        speed: entry.speed,
        bulletSpeed: entry.bulletSpeed,
        criticalChance: entry.crit,
        criticalDamage: entry.critDamage,
        dodge: entry.dodge,
        attackFireFrame: base.attackFireFrame,
        elite: entry.id.startsWith('jr'),
        boss: entry.id.indexOf('tl_') >= 0,
        zoom: entry.zoom,
        aoeRadiusPixels: entry.traits?.AoeAtk ? 2 * PHYSICS_PIXEL_RATIO : 0,
        repelPhysicsUnitsPerSecond: repel[0] ?? 0,
        repelSeconds: repel[1] ?? 0,
        repelResist: !!entry.traits?.RepelResist,
        changeToElite: entry.changeToElite,
        changeToBoss: entry.changeToBoss,
      });
    }
    this.eliteByBase = {};
    this.bossByBase = {};
    for (const id of this.baseEnemyIds) {
      const definition = this.enemyDefinitions.get(id);
      if (!definition) throw new Error(`Stage ${this.stageId} references unknown enemy: ${id}`);
      if (definition.changeToElite) this.eliteByBase[id] = definition.changeToElite;
      if (definition.changeToBoss) this.bossByBase[id] = definition.changeToBoss;
    }
    if (!this.waveCounts.length
      || this.waveCounts.length !== this.wavePowers.length
      || this.waveCounts.length !== this.eliteProbabilities.length) {
      throw new Error(`Stage ${this.stageId} has inconsistent wave vectors`);
    }
    const castle = this.findCastlePosition();
    this.castleColumn = castle.column;
    this.castleRow = castle.row;
  }

  private loadCampaignProgress(): CampaignProgress {
    return [...this.loadLocalProfile().maxStageRecord];
  }

  private saveCampaignProgress(progress: CampaignProgress): void {
    this.campaignProgress = normalizeCampaignProgress(progress);
    const profile = normalizeLocalProfile(this.localProfile);
    profile.maxStageRecord = [...this.campaignProgress];
    this.saveLocalProfile(profile);
  }

  private loadLocalProfile(): LocalProfile {
    if (typeof window === 'undefined') return normalizeLocalProfile(null);
    let legacyProgress: CampaignProgress = [1, 0];
    try {
      const legacyRaw = window.localStorage.getItem(CAMPAIGN_STORAGE_KEY);
      legacyProgress = normalizeCampaignProgress(legacyRaw ? JSON.parse(legacyRaw) : null);
    } catch (error) {
      console.warn('[Shoucheng legacy progress load failed]', error);
    }
    try {
      const raw = window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
      return normalizeLocalProfile(raw ? JSON.parse(raw) : null, legacyProgress);
    } catch (error) {
      console.warn('[Shoucheng local profile load failed]', error);
      return normalizeLocalProfile(null, legacyProgress);
    }
  }

  private saveLocalProfile(profileValue: unknown): LocalProfile {
    const profile = normalizeLocalProfile(profileValue);
    this.localProfile = profile;
    this.campaignProgress = [...profile.maxStageRecord];
    if (typeof window === 'undefined') return profile;
    const runtimeTest = this.readRuntimeTestName();
    if (runtimeTest && runtimeTest !== 'cocos-campaign-persist-victory') return profile;
    try {
      window.localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      window.localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(profile.maxStageRecord));
    } catch (error) {
      console.warn('[Shoucheng local profile save failed]', error);
    }
    return profile;
  }

  private applyCurrentCampaignResult(victory: boolean): CampaignBattleResult {
    const result = applyCampaignBattleResult(
      this.campaignProgress,
      this.stageId,
      this.wave,
      this.waveCounts.length,
      victory,
      this.campaignStageCount,
    );
    this.campaignResult = result;
    this.saveCampaignProgress(result.after);
    return result;
  }

  private findCastlePosition(): { column: number; row: number } {
    const columns = [2, 1, 3, 0, 4];
    for (let row = this.mapData.length - CASTLE.height; row >= 0; row -= 1) {
      for (const column of columns) {
        if (column + CASTLE.width > 7) continue;
        let valid = true;
        for (let y = 0; y < CASTLE.height; y += 1) {
          for (let x = 0; x < CASTLE.width; x += 1) {
            if (this.mapData[row + y]?.[column + x] !== '1') valid = false;
          }
        }
        if (valid) return { column, row };
      }
    }
    return { column: CASTLE.column, row: CASTLE.row };
  }

  private isCastleCellAt(column: number, row: number): boolean {
    return column >= this.castleColumn
      && column < this.castleColumn + CASTLE.width
      && row >= this.castleRow
      && row < this.castleRow + CASTLE.height;
  }

  private visualBodyForPower(bodies: ReadonlyArray<string>, power: number): UnitBody {
    if (!bodies.length) return 'Swordsman1';
    const visualLevel = Math.floor(power % 10);
    if (visualLevel >= 1 && bodies[visualLevel - 1]) return bodies[visualLevel - 1] as UnitBody;
    if (visualLevel > bodies.length) return bodies[bodies.length - 1] as UnitBody;
    return bodies[0] as UnitBody;
  }

  private enemyVisualBodiesForStage(): string[] {
    const bodies = new Set<string>();
    for (const enemyId of this.baseEnemyIds) {
      const definition = this.enemyDefinitions.get(enemyId);
      if (!definition) continue;
      for (const power of this.wavePowers) bodies.add(this.visualBodyForPower(definition.bodies, power));
    }
    return Array.from(bodies);
  }

  private publishCampaignStageState(): void {
    if (typeof document === 'undefined') return;
    const state = {
      ready: true,
      stage: this.stageId,
      name: this.stageName,
      maxStageRecord: this.campaignProgress,
      unlockedStage: campaignUnlockedStage(this.campaignProgress, this.campaignStageCount),
      mapId: this.stageMapId,
      waves: this.waveCounts.length,
      waveCounts: this.waveCounts,
      wavePowers: this.wavePowers,
      enemyPool: this.baseEnemyIds,
      enemyVisualBodies: this.enemyVisualBodiesForStage(),
      castle: { column: this.castleColumn, row: this.castleRow },
      storeItemTypeWeights: this.storeItemTypeWeights,
    };
    document.documentElement.setAttribute('data-cocos-campaign-stage', JSON.stringify(state));
    (window as unknown as { __cocosCampaignStage?: typeof state }).__cocosCampaignStage = state;
  }

  private publishCampaignBattleState(): void {
    if (typeof document === 'undefined') return;
    const loadedEnemyBodies = Array.from(this.actionFrames.keys())
      .filter((key) => key.startsWith('enemy:') && key.endsWith(':move'))
      .map((key) => key.split(':')[1])
      .sort();
    const state = {
      ready: this.fighting,
      stage: this.stageId,
      wave: this.wave,
      rosterCount: this.waveRoster.length,
      roster: this.waveRoster,
      loadedEnemyBodies,
      expectedEnemyBodies: this.enemyVisualBodiesForStage().slice().sort(),
      allRequiredEnemyBodiesLoaded: this.enemyVisualBodiesForStage().every((body) => loadedEnemyBodies.indexOf(body) >= 0),
    };
    document.documentElement.setAttribute('data-cocos-campaign-battle', JSON.stringify(state));
    (window as unknown as { __cocosCampaignBattle?: typeof state }).__cocosCampaignBattle = state;
  }

  private loadJsonAsset<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      resources.load(path, JsonAsset, (error, asset) => {
        if (error || !asset) reject(error ?? new Error(`Missing JsonAsset: ${path}`));
        else resolve(asset.json as T);
      });
    });
  }

  private loadSpriteFrame(path: string): Promise<SpriteFrame> {
    const cached = this.frameCache.get(path);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error || !frame) reject(error ?? new Error(`Missing SpriteFrame: ${path}`));
        else {
          this.frameCache.set(path, frame);
          resolve(frame);
        }
      });
    });
  }

  private preloadGameFont(): Promise<void> {
    if (this.gameFont) return Promise.resolve();
    return new Promise((resolve, reject) => {
      resources.load('original/fonts/OPPOSansH', Font, (error, font) => {
        if (error || !font) reject(error ?? new Error('Missing recovered font: OPPOSansH'));
        else {
          this.gameFont = font;
          resolve();
        }
      });
    });
  }

  private applyGameFont(label: Label): void {
    if (!this.gameFont) return;
    label.font = this.gameFont;
    this.fontAppliedLabels += 1;
    this.publishFontState();
  }

  private publishFontState(): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-cocos-font', JSON.stringify({
      loaded: this.gameFont !== null,
      resource: 'original/fonts/OPPOSansH',
      appliedLabels: this.fontAppliedLabels,
    }));
  }
}
