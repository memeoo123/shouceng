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
