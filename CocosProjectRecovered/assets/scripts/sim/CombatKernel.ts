export interface AttackInput {
  attack: number;
  criticalChance?: number;
  criticalDamage?: number;
  targetDodge?: number;
}

export interface AttackRolls {
  dodge: number;
  critical: number;
}

export interface AttackResult {
  damage: number;
  dodged: boolean;
  critical: boolean;
}

/** Recovered order: target dodge is resolved before the attacker critical roll. */
export function resolveAttack(input: AttackInput, rolls: AttackRolls): AttackResult {
  if (rolls.dodge < (input.targetDodge ?? 0)) {
    return { damage: 0, dodged: true, critical: false };
  }
  const critical = rolls.critical < (input.criticalChance ?? 0);
  const raw = input.attack * (critical ? (input.criticalDamage ?? 1) : 1);
  return { damage: Math.max(1, Math.floor(raw)), dodged: false, critical };
}

export function applyDamage(hitPoints: number, damage: number): number {
  return Math.max(0, hitPoints - Math.max(0, damage));
}

export function allocateWaveCoins(enemyCount: number, coinsPerWave = 10): number[] {
  if (enemyCount <= 0) return [];
  const floor = Math.floor(coinsPerWave / enemyCount);
  let remainder = coinsPerWave - floor * enemyCount;
  return Array.from({ length: enemyCount }, () => floor + (remainder-- > 0 ? 1 : 0));
}

/** Recovered MoneyMaterial payout: active, surviving mines add their configured value at non-final wave end. */
export function waveEndMineIncome(incomes: ReadonlyArray<number>): number {
  return incomes.reduce((sum, income) => sum + (Number.isFinite(income) ? Math.max(0, income) : 0), 0);
}

export function buildSpawnDelays(randomValues: ReadonlyArray<number>, count: number): number[] {
  if (randomValues.length === 0) throw new Error('At least one random value is required.');
  return Array.from({ length: count }, (_, index) => {
    const random = Math.min(0.999999, Math.max(0, randomValues[index % randomValues.length]));
    const inclusiveMilliseconds = 100 + Math.floor(random * 101);
    return inclusiveMilliseconds / 1000 / 1.2;
  });
}

export function isVictory(currentWave: number, maxWave: number, livingEnemies: number, castleHp: number): boolean {
  return castleHp > 0 && currentWave === maxWave && livingEnemies === 0;
}

export function isDefeat(castleHp: number): boolean {
  return castleHp <= 0;
}

export interface Point {
  x: number;
  y: number;
}

export interface LiveCandidate<T> {
  value: T;
  point: Point;
  hitPoints: number;
}

export function distanceBetween(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

export function nearestLiveCandidate<T>(
  source: Point,
  candidates: ReadonlyArray<LiveCandidate<T>>,
  maximumDistance = Number.POSITIVE_INFINITY,
): LiveCandidate<T> | null {
  let selected: LiveCandidate<T> | null = null;
  let bestDistance = maximumDistance;
  for (const candidate of candidates) {
    if (candidate.hitPoints <= 0) continue;
    const gap = distanceBetween(source, candidate.point);
    if (gap > bestDistance) continue;
    bestDistance = gap;
    selected = candidate;
  }
  return selected;
}

export function moveTowards(source: Point, target: Point, speed: number, deltaSeconds: number, stopRange = 0): Point {
  const gap = distanceBetween(source, target);
  if (gap <= stopRange || gap <= 1e-9) return { ...source };
  const distanceToMove = Math.min(Math.max(0, speed * deltaSeconds), Math.max(0, gap - stopRange));
  return {
    x: source.x + (target.x - source.x) / gap * distanceToMove,
    y: source.y + (target.y - source.y) / gap * distanceToMove,
  };
}

/** Recovered `SpeedDownTrait`: every active source divides enemy speed by `1 + amount`. */
export function enemySpeedMultiplier(slowAmounts: ReadonlyArray<number>): number {
  const multiplier = slowAmounts.reduce((value, amount) => {
    const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
    return value / (1 + safeAmount);
  }, 1);
  return Math.max(0.05, Math.min(1, multiplier));
}

/** Recovered global `CritTrait`: active observation decks add to base critical chance. */
export function criticalChanceWithAura(baseChance: number, bonuses: ReadonlyArray<number>): number {
  const total = bonuses.reduce((value, bonus) => {
    const safeBonus = Number.isFinite(bonus) ? Math.max(0, bonus) : 0;
    return value + safeBonus;
  }, Math.max(0, baseChance));
  return Math.min(0.95, total);
}

/** Recovered `SpeedUpTrait`: adjacent bonuses add to attack speed, so cooldown is divided by `1 + sum`. */
export function buildingCooldownWithAdjacentSpeed(baseCooldown: number, bonuses: ReadonlyArray<number>): number {
  const speedMultiplier = bonuses.reduce((value, bonus) => {
    const safeBonus = Number.isFinite(bonus) ? Math.max(0, bonus) : 0;
    return value + safeBonus;
  }, 1);
  return Math.max(0, baseCooldown) / speedMultiplier;
}

/** Recovered `AtkUpTrait`: adjacent attack bonuses add before multiplying the base attack. */
export function attackWithAdjacentBonus(baseAttack: number, bonuses: ReadonlyArray<number>): number {
  const attackMultiplier = bonuses.reduce((value, bonus) => {
    const safeBonus = Number.isFinite(bonus) ? Math.max(0, bonus) : 0;
    return value + safeBonus;
  }, 1);
  return Math.max(0, baseAttack) * attackMultiplier;
}

/** Two irregular grid footprints are adjacent when any cells touch orthogonally or diagonally. */
export function areGridFootprintsAdjacent(
  leftColumn: number,
  leftRow: number,
  leftShape: ReadonlyArray<readonly [number, number]>,
  rightColumn: number,
  rightRow: number,
  rightShape: ReadonlyArray<readonly [number, number]>,
): boolean {
  for (const [leftX, leftY] of leftShape) {
    for (const [rightX, rightY] of rightShape) {
      const columnGap = Math.abs(leftColumn + leftX - rightColumn - rightX);
      const rowGap = Math.abs(leftRow + leftY - rightRow - rightY);
      if (Math.max(columnGap, rowGap) === 1) return true;
    }
  }
  return false;
}

export function seededRandom(seedValue: number): () => number {
  let seed = Math.trunc(seedValue);
  return () => {
    seed = (9301 * seed + 49297) % 233280;
    return seed / 233280;
  };
}

export function shuffled<T>(values: ReadonlyArray<T>, random: () => number): T[] {
  const result = values.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

/** Mirrors the recovered Stage roster builder before elite/boss substitution. */
export function buildWaveRoster<T>(stageId: number, waveNumber: number, count: number, pool: ReadonlyArray<T>): T[] {
  if (count <= 0 || pool.length === 0) return [];
  const random = seededRandom(stageId * 1000 + waveNumber - 1);
  const poolOrder = shuffled(pool, random);
  const roster: T[] = [];
  while (roster.length < count) roster.push(...poolOrder);
  roster.length = count;
  return shuffled(roster, random);
}

/** Applies the recovered fractional elite conversion, then the deterministic final-boss replacement. */
export function applyWaveVariants<T>(
  stageId: number,
  waveNumber: number,
  maxWave: number,
  baseRoster: ReadonlyArray<T>,
  basePool: ReadonlyArray<T>,
  eliteProbability: number,
  outcomeRandom: () => number,
  toElite: (base: T) => T,
  hasFinalBoss: boolean,
  toBoss: (base: T) => T,
): T[] {
  const roster = baseRoster.slice();
  const eliteCount = Math.floor(eliteProbability)
    + (outcomeRandom() < eliteProbability % 1 ? 1 : 0);
  const eliteIndices = shuffled(
    Array.from({ length: roster.length }, (_, index) => index),
    outcomeRandom,
  ).slice(0, eliteCount);
  for (const index of eliteIndices) roster[index] = toElite(roster[index]);
  if (waveNumber === maxWave && hasFinalBoss && roster.length > 0 && basePool.length > 0) {
    const bossRandom = seededRandom(stageId * 1000);
    const selectedBase = basePool[Math.floor(bossRandom() * basePool.length)];
    roster[Math.floor(roster.length / 3)] = toBoss(selectedBase);
  }
  return roster;
}

export function nextWaveNumber(currentWave: number, maxWave: number, spawned: number, expected: number, livingEnemies: number): number | null {
  if (spawned < expected || livingEnemies > 0) return null;
  return currentWave >= maxWave ? currentWave : currentWave + 1;
}

export interface AxisAlignedBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface WeightedContact<T> {
  value: T;
  box: AxisAlignedBox;
}

export function normalizeVector(vector: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length < 1e-9) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

export function routeRandomAngle(desired: number, amount: number, side: -1 | 1): number {
  if (desired < 0) return side < 0
    ? Math.max(-Math.PI, desired - amount)
    : Math.min(0, desired + amount);
  if (desired > 0) return side < 0
    ? Math.min(Math.PI, desired + amount)
    : Math.max(0, desired - amount);
  return 0;
}

export function projectileLifeTime(
  kind: 'unit' | 'building',
  speedPixelsPerSecond: number,
  attackRangePixels: number,
  initialDistancePixels: number,
): number {
  const speed = Math.max(1, speedPixelsPerSecond);
  const rangeDuration = Math.max(0, attackRangePixels) / speed;
  if (kind === 'unit') return Math.max(0.27, rangeDuration + 0.1);
  return Math.max(Math.max(0, initialDistancePixels) / speed, rangeDuration);
}

/** Attack actions stay locked for their recovered frame count at the 102ms sequence interval. */
export function attackActionDuration(frameCount: number, frameIntervalSeconds = 0.102): number {
  return Math.max(0, Math.trunc(frameCount)) * Math.max(0, frameIntervalSeconds);
}

/** Advance an attack lock through the same deterministic combat delta used by movement and cooldowns. */
export function advanceAttackActionLock(remainingSeconds: number, deltaSeconds: number): number {
  return Math.max(0, remainingSeconds - Math.max(0, deltaSeconds));
}

/** Recovered one-sided wrap and ten-degree steering cap used by building auto-flow bullets. */
export function projectileTurnDelta(currentDegrees: number, wantedDegrees: number): number {
  let difference = wantedDegrees - currentDegrees % 360;
  if (difference > 180) difference -= 360;
  return Math.max(-10, Math.min(10, difference));
}

export interface RepelState {
  velocityX: number;
  velocityY: number;
  duration: number;
  remaining: number;
}

export function createRepelState(
  source: Point,
  target: Point,
  physicsUnitsPerSecond: number,
  durationSeconds: number,
  physicsPixelRatio = 50,
): RepelState {
  const angle = Math.atan2(target.y - source.y, target.x - source.x);
  const speed = Math.max(0, physicsUnitsPerSecond) * physicsPixelRatio;
  const duration = Math.max(0.001, durationSeconds);
  return {
    velocityX: Math.cos(angle) * speed,
    velocityY: Math.sin(angle) * speed,
    duration,
    remaining: duration,
  };
}

export function stepRepel(
  point: Point,
  state: RepelState,
  deltaSeconds: number,
  bounds: AxisAlignedBox,
): { point: Point; state: RepelState | null } {
  const factor = Math.max(0, state.remaining / Math.max(0.001, state.duration));
  const delta = Math.max(0, deltaSeconds);
  const nextPoint = {
    x: Math.max(bounds.left, Math.min(bounds.right, point.x + state.velocityX * factor * delta)),
    y: Math.max(bounds.top, Math.min(bounds.bottom, point.y + state.velocityY * factor * delta)),
  };
  const remaining = state.remaining - delta;
  return {
    point: nextPoint,
    state: remaining > 0 ? { ...state, remaining } : null,
  };
}

export interface DeadTargetLatch {
  point: Point;
  consumeImmediately: boolean;
}

export function latchDeadTargetPoint(
  enabled: boolean,
  alreadyLatched: boolean,
  targetAlive: boolean,
  lastTargetPoint: Point | null,
  projectilePoint: Point,
): DeadTargetLatch | null {
  if (!enabled || alreadyLatched || targetAlive) return null;
  const point = lastTargetPoint ? { ...lastTargetPoint } : { ...projectilePoint };
  return { point, consumeImmediately: distanceBetween(projectilePoint, point) <= 50 };
}

/** Liang-Barsky segment test against a box expanded by projectile half extents. */
export function segmentExpandedBoxHitTime(
  start: Point,
  end: Point,
  box: AxisAlignedBox,
  halfWidth: number,
  halfHeight: number,
): number | null {
  const expanded = {
    left: box.left - halfWidth,
    right: box.right + halfWidth,
    top: box.top - halfHeight,
    bottom: box.bottom + halfHeight,
  };
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  let minimum = 0;
  let maximum = 1;
  const clipAxis = (origin: number, delta: number, lower: number, upper: number): boolean => {
    if (Math.abs(delta) < 0.000001) return origin >= lower && origin <= upper;
    let first = (lower - origin) / delta;
    let second = (upper - origin) / delta;
    if (first > second) [first, second] = [second, first];
    minimum = Math.max(minimum, first);
    maximum = Math.min(maximum, second);
    return minimum <= maximum;
  };
  if (!clipAxis(start.x, deltaX, expanded.left, expanded.right)) return null;
  if (!clipAxis(start.y, deltaY, expanded.top, expanded.bottom)) return null;
  return maximum < 0 || minimum > 1 ? null : Math.max(0, minimum);
}

export function firstSweptContact<T>(
  start: Point,
  end: Point,
  candidates: ReadonlyArray<WeightedContact<T>>,
  halfWidth: number,
  halfHeight: number,
): { value: T; time: number } | null {
  let selected: { value: T; time: number } | null = null;
  for (const candidate of candidates) {
    const time = segmentExpandedBoxHitTime(start, end, candidate.box, halfWidth, halfHeight);
    if (time === null || (selected && time >= selected.time)) continue;
    selected = { value: candidate.value, time };
  }
  return selected;
}

/** Recovered result-screen experience uses the unfixed enemy value and rounds after bonuses. */
export function battleExperienceGain(baseExperience: number, buildingBonus: number): number {
  return Math.round(baseExperience * (1 + buildingBonus));
}

/** Fight-level experience floors the global fix first, then applies the active building bonus. */
export function fightLevelExperienceGain(baseExperience: number, globalFix: number, buildingBonus: number): number {
  return Math.floor(baseExperience * globalFix) * (1 + buildingBonus);
}
