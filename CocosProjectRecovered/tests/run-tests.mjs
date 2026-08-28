import assert from 'node:assert/strict';
import {
  allocateWaveCoins,
  applyDamage,
  buildSpawnDelays,
  isDefeat,
  isVictory,
  resolveAttack,
} from '../assets/scripts/sim/CombatKernel.ts';
import { isBuildable, STAGE2_MAP, STAGE2_WAVE_COUNTS } from '../assets/scripts/sim/Stage2Config.ts';

const normal = resolveAttack({ attack: 20, criticalChance: 0.05, criticalDamage: 1.5, targetDodge: 0.05 }, { dodge: 0.5, critical: 0.5 });
assert.deepEqual(normal, { damage: 20, dodged: false, critical: false });

const critical = resolveAttack({ attack: 20, criticalChance: 0.05, criticalDamage: 1.5, targetDodge: 0.05 }, { dodge: 0.5, critical: 0.01 });
assert.deepEqual(critical, { damage: 30, dodged: false, critical: true });

const dodged = resolveAttack({ attack: 30, criticalChance: 1, criticalDamage: 2, targetDodge: 0.05 }, { dodge: 0.01, critical: 0 });
assert.deepEqual(dodged, { damage: 0, dodged: true, critical: false });

assert.equal(applyDamage(975, 30), 945);
assert.equal(applyDamage(20, 30), 0);
assert.deepEqual(STAGE2_WAVE_COUNTS, [3, 4, 7, 9, 12]);
assert.equal(STAGE2_WAVE_COUNTS.reduce((sum, count) => sum + count, 0), 35);
assert.deepEqual(allocateWaveCoins(3), [4, 3, 3]);
assert.deepEqual(allocateWaveCoins(12), [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0]);
const boundaryDelays = buildSpawnDelays([0, 0.999999], 2);
assert.ok(Math.abs(boundaryDelays[0] - 1 / 12) < 1e-12);
assert.ok(Math.abs(boundaryDelays[1] - 1 / 6) < 1e-12);
assert.equal(isBuildable(STAGE2_MAP, 1, 6), true);
assert.equal(isBuildable(STAGE2_MAP, 1, 3), false);
assert.equal(isBuildable(STAGE2_MAP, 2, 7), false);
assert.equal(isVictory(5, 5, 0, 975), true);
assert.equal(isVictory(4, 5, 0, 975), false);
assert.equal(isDefeat(0), true);

console.log(JSON.stringify({ passed: true, assertions: 16, stage: 2, totalEnemies: 35 }));
