import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import {
  allocateWaveCoins,
  advanceAttackActionLock,
  applyDamage,
  areGridFootprintsAdjacent,
  attackWithAdjacentBonus,
  attackActionDuration,
  battleExperienceGain,
  applyWaveVariants,
  buildSpawnDelays,
  buildWaveRoster,
  buildingCooldownWithAdjacentSpeed,
  createRepelState,
  criticalChanceWithAura,
  enemySpeedMultiplier,
  firstSweptContact,
  fightLevelExperienceGain,
  latchDeadTargetPoint,
  moveTowards,
  nearestLiveCandidate,
  nextWaveNumber,
  normalizeVector,
  projectileLifeTime,
  projectileTurnDelta,
  routeRandomAngle,
  segmentExpandedBoxHitTime,
  stepRepel,
  waveEndMineIncome,
  isDefeat,
  isVictory,
  resolveAttack,
} from '../assets/scripts/sim/CombatKernel.ts';
import {
  ATTACK_SPEED_STATUE,
  isBuildable,
  canSynthesizeBuildings,
  createSeededRandom,
  createShopSlotDefinition,
  CROSSBOWMAN_BARRACKS,
  ELECTRICITY_TOWER,
  EXPERIENCE_CRYSTAL,
  fitBuildingVisualSize,
  FUNCTIONAL_SHOP_POOL,
  GOLD_MINE,
  KNIGHT_BARRACKS,
  KNIGHT_CHARGE_DIZZINESS_TRAIT,
  KNIGHT_CHARGE_TRAIT,
  LONG_FENCE,
  MAULER_BARRACKS,
  MARTIAL_ARTS_FIELD,
  MAGE_BARRACKS,
  MIRROR_TOWER,
  OBSERVATION_DECK,
  OPENING_SHOP,
  SHOP_GUARANTEED_SLOT_INTERVAL,
  SHOP_SLOT_SHAPES,
  shopLevelWeights,
  shopRefreshCost,
  SLOWING_WELL,
  SWORDSMAN_BARRACKS,
  TREBUCHET,
  upgradeShopDefinition,
  STAGE2_BASE_ENEMIES,
  STAGE2_BOSS_BY_BASE,
  STAGE2_ELITE_BY_BASE,
  STAGE2_ENEMIES,
  STAGE2_EXPERIENCE,
  STAGE2_MAP,
  STAGE2_STORE_ITEM_TYPE_WEIGHTS,
  STAGE2_UNITS,
  STAGE2_WAVE_COUNTS,
  STORE_REFRESH_PRICE,
  weightedShopIndex,
} from '../assets/scripts/sim/Stage2Config.ts';
import { RECOVERED_AIR_SUPPORT_EFFECTS } from '../assets/scripts/view/RecoveredAirSupportEffects.ts';
import { RECOVERED_LASER_EFFECTS } from '../assets/scripts/view/RecoveredLaserEffects.ts';
import {
  availableGeneralTraits,
  BATTLE_CHOICE_REFRESH_COUNT,
  FIGHT_LEVEL_EXPERIENCE,
  GENERAL_TRAITS,
  MAX_ALL_TRAIT_COUNT,
  rollGeneralTraitChoices,
  STUDY_TRAIT_QUALITY_WEIGHTS,
  traitMultiplier,
  traitSum,
} from '../assets/scripts/sim/TraitConfig.ts';
import {
  applyCampaignBattleResult,
  campaignProgressAfterBattle,
  campaignUnlockedStage,
  claimWaveChest,
  effectiveWaveChestRewards,
  normalizeLocalProfile,
  normalizeCampaignProgress,
  waveChestRecordKey,
  waveChestState,
} from '../assets/scripts/sim/CampaignProgress.ts';

assert.deepEqual(normalizeCampaignProgress(null), [1, 0]);
assert.deepEqual(normalizeCampaignProgress({ maxStageRecord: [12.9, 4.8] }), [12, 4]);
assert.equal(campaignUnlockedStage([221, 0], 220), 220);
const partialCampaign = campaignProgressAfterBattle([1, 0], 1, 4, 5, false);
assert.deepEqual(partialCampaign, [1, 3]);
assert.deepEqual(campaignProgressAfterBattle(partialCampaign, 1, 2, 5, false), [1, 3]);
const firstCampaignVictory = campaignProgressAfterBattle(partialCampaign, 1, 5, 5, true);
assert.deepEqual(firstCampaignVictory, [2, 0]);
assert.deepEqual(campaignProgressAfterBattle(firstCampaignVictory, 1, 5, 5, true), [2, 0]);
assert.deepEqual(campaignProgressAfterBattle(firstCampaignVictory, 2, 3, 5, false), [2, 2]);
assert.deepEqual(campaignProgressAfterBattle(firstCampaignVictory, 2, 5, 5, true), [3, 0]);
assert.deepEqual(campaignProgressAfterBattle([220, 0], 220, 12, 12, true), [221, 0]);
const campaignResult = applyCampaignBattleResult([2, 0], 2, 5, 5, true, 220);
assert.equal(campaignResult.stageAdvanced, true);
assert.equal(campaignResult.unlockedStage, 3);

const copiedStages = readFileSync(new URL('../assets/resources/original/data/stages.json', import.meta.url));
const copiedEnemies = readFileSync(new URL('../assets/resources/original/data/enemies.json', import.meta.url));
const copiedVariants = readFileSync(new URL('../assets/resources/original/data/enemy-variants.json', import.meta.url));
const copiedMaps = readFileSync(new URL('../assets/resources/original/data/maps.json', import.meta.url));
assert.deepEqual(copiedStages, readFileSync(new URL('../../src/data/stages.json', import.meta.url)));
assert.deepEqual(copiedEnemies, readFileSync(new URL('../../src/data/enemies.json', import.meta.url)));
assert.deepEqual(copiedVariants, readFileSync(new URL('../../src/data/enemy-variants.json', import.meta.url)));
assert.deepEqual(copiedMaps, readFileSync(new URL('../../src/data/maps.json', import.meta.url)));
const stageCatalog = JSON.parse(copiedStages.toString('utf8'));
const baseEnemyCatalog = JSON.parse(copiedEnemies.toString('utf8'));
const enemyVariantCatalog = JSON.parse(copiedVariants.toString('utf8'));
assert.equal(stageCatalog.length, 220);
assert.equal(stageCatalog.every((stage, index) => stage.id === index + 1), true);
assert.equal(stageCatalog.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.length, 0), 2620);
assert.equal(stageCatalog.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.reduce((waveSum, count) => waveSum + count, 0), 0), 60588);
assert.equal(stageCatalog.reduce((sum, stage) => sum + stage.chestRewards.length, 0), 660);
assert.equal(stageCatalog.every((stage) => stage.mapData.length === 9 && stage.mapData.every((row) => row.length === 7)), true);
assert.equal(stageCatalog.every((stage) => stage.waveEnemyCountsEffective.length === stage.wavePower.length), true);
assert.equal(stageCatalog.every((stage) => stage.waveEnemyCountsEffective.length === stage.eliteProbability.length), true);
const recoveredRedUnitRoot = new URL('../../bin/res/units-red/', import.meta.url);
const cocosRedUnitRoot = new URL('../assets/resources/original/units/units-red/', import.meta.url);
const recoveredRedFrames = readdirSync(recoveredRedUnitRoot).filter((name) => name.endsWith('.png')).sort();
const cocosRedFrames = readdirSync(cocosRedUnitRoot).filter((name) => name.endsWith('.png')).sort();
assert.equal(recoveredRedFrames.length, 1016);
assert.deepEqual(cocosRedFrames, recoveredRedFrames);
for (const frame of recoveredRedFrames) {
  assert.deepEqual(readFileSync(new URL(frame, cocosRedUnitRoot)), readFileSync(new URL(frame, recoveredRedUnitRoot)));
}
assert.deepEqual([...new Set(stageCatalog.map((stage) => stage.mapId))].sort(), ['Desert', 'Forest', 'Snowfield']);
assert.deepEqual([...new Set(stageCatalog.flatMap((stage) => stage.enemies))].sort(), baseEnemyCatalog.map((enemy) => enemy.id).sort());
assert.equal(enemyVariantCatalog.length, 18);
assert.deepEqual(stageCatalog[0].waveEnemyCountsEffective, [4, 4, 7]);
assert.deepEqual(stageCatalog[1].waveEnemyCountsEffective, [3, 4, 7, 9, 12]);
assert.equal(stageCatalog[219].waveEnemyCountsEffective.length, 12);

const migratedProfile = normalizeLocalProfile(null, [2, 5]);
assert.deepEqual(migratedProfile.maxStageRecord, [2, 5]);
assert.deepEqual(migratedProfile.props, {});
assert.deepEqual(migratedProfile.items, {});
assert.equal(waveChestRecordKey(2, 1), 'WaveChest_2_1');
assert.deepEqual(effectiveWaveChestRewards(stageCatalog[1], 1), [['Prop', 'Money', 400], ['Prop', 'Stamina', 10]]);
assert.equal(waveChestState(stageCatalog[1], 0, migratedProfile).eligible, true);
assert.equal(waveChestState(stageCatalog[1], 2, migratedProfile).error, 'WaveNotEnough');
const firstChestClaim = claimWaveChest(stageCatalog[1], 0, migratedProfile);
assert.equal(firstChestClaim.ok, true);
assert.equal(firstChestClaim.profile.props.Money, 200);
const secondChestClaim = claimWaveChest(stageCatalog[1], 1, firstChestClaim.profile);
assert.equal(secondChestClaim.ok, true);
assert.equal(secondChestClaim.profile.props.Money, 600);
assert.equal(secondChestClaim.profile.props.Stamina, 10);
const duplicateChestClaim = claimWaveChest(stageCatalog[1], 1, secondChestClaim.profile);
assert.equal(duplicateChestClaim.ok, false);
assert.equal(duplicateChestClaim.error, 'BoxHasBeenObtained');
assert.equal(duplicateChestClaim.profile.props.Money, 600);
const clearedStageProfile = normalizeLocalProfile({ ...secondChestClaim.profile, maxStageRecord: [3, 0] });
const finalChestClaim = claimWaveChest(stageCatalog[1], 2, clearedStageProfile);
assert.equal(finalChestClaim.ok, true);
assert.equal(finalChestClaim.profile.props.Diamond, 100);
assert.equal(finalChestClaim.profile.items.NormalRandomChip, 18);
assert.deepEqual(Object.keys(finalChestClaim.profile.waveChests).sort(), ['WaveChest_2_0', 'WaveChest_2_1', 'WaveChest_2_2']);

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
assert.deepEqual(STAGE2_WAVE_COUNTS.map((count) => allocateWaveCoins(count).reduce((sum, reward) => sum + reward, 0)), [10, 10, 10, 10, 10]);
const boundaryDelays = buildSpawnDelays([0, 0.999999], 2);
assert.ok(Math.abs(boundaryDelays[0] - 1 / 12) < 1e-12);
assert.ok(Math.abs(boundaryDelays[1] - 1 / 6) < 1e-12);
assert.equal(isBuildable(STAGE2_MAP, 1, 6), true);
assert.equal(isBuildable(STAGE2_MAP, 1, 3), false);
assert.equal(isBuildable(STAGE2_MAP, 2, 7), false);
assert.equal(isVictory(5, 5, 0, 975), true);
assert.equal(isVictory(4, 5, 0, 975), false);
assert.equal(isDefeat(0), true);

assert.deepEqual(buildWaveRoster(2, 1, 3, ['Swordsman1', 'Shooter1']), ['Swordsman1', 'Swordsman1', 'Shooter1']);
assert.deepEqual(moveTowards({ x: 0, y: 0 }, { x: 3, y: 4 }, 10, 0.25), { x: 1.5, y: 2 });
assert.deepEqual(
  nearestLiveCandidate(
    { x: 0, y: 0 },
    [
      { value: 'dead', point: { x: 1, y: 0 }, hitPoints: 0 },
      { value: 'near', point: { x: 2, y: 0 }, hitPoints: 1 },
      { value: 'far', point: { x: 4, y: 0 }, hitPoints: 1 },
    ],
    3,
  )?.value,
  'near',
);
assert.equal(nextWaveNumber(1, 5, 3, 3, 0), 2);
assert.equal(nextWaveNumber(1, 5, 2, 3, 0), null);
assert.equal(nextWaveNumber(5, 5, 12, 12, 0), 5);
assert.deepEqual(normalizeVector({ x: 3, y: 4 }), { x: 0.6, y: 0.8 });
assert.ok(Math.abs(routeRandomAngle(Math.PI / 2, 0.2, -1) - (Math.PI / 2 + 0.2)) < 1e-12);
assert.ok(Math.abs(routeRandomAngle(Math.PI / 2, 0.2, 1) - (Math.PI / 2 - 0.2)) < 1e-12);
assert.equal(segmentExpandedBoxHitTime(
  { x: 0, y: 50 }, { x: 100, y: 50 },
  { left: 45, right: 55, top: 45, bottom: 55 }, 5, 5,
), 0.4);
assert.equal(segmentExpandedBoxHitTime(
  { x: 0, y: 20 }, { x: 100, y: 20 },
  { left: 45, right: 55, top: 45, bottom: 55 }, 5, 5,
), null);
assert.equal(firstSweptContact(
  { x: 0, y: 50 }, { x: 100, y: 50 },
  [
    { value: 'far', box: { left: 75, right: 85, top: 45, bottom: 55 } },
    { value: 'near', box: { left: 45, right: 55, top: 45, bottom: 55 } },
  ], 5, 5,
)?.value, 'near');

const finalBaseRoster = buildWaveRoster(2, 5, 12, STAGE2_BASE_ENEMIES);
const finalRoster = applyWaveVariants(
  2, 5, 5, finalBaseRoster, STAGE2_BASE_ENEMIES, 0.5, () => 0.99,
  (base) => STAGE2_ELITE_BY_BASE[base], true, (base) => STAGE2_BOSS_BY_BASE[base],
);
assert.equal(finalRoster.length, 12);
assert.equal(finalRoster[4], 'gbtl_27AAAA80');
assert.equal(finalRoster.filter((id) => STAGE2_ENEMIES[id].boss).length, 1);
assert.equal(STAGE2_ENEMIES.gbtl_27AAAA80.aoeRadiusPixels, 100);
const waveFourRoster = applyWaveVariants(
  2, 4, 5, buildWaveRoster(2, 4, 9, STAGE2_BASE_ENEMIES), STAGE2_BASE_ENEMIES,
  2, () => 0.75, (base) => STAGE2_ELITE_BY_BASE[base], true, (base) => STAGE2_BOSS_BY_BASE[base],
);
assert.equal(waveFourRoster.filter((id) => STAGE2_ENEMIES[id].elite).length, 2);
assert.equal(projectileLifeTime('unit', 900, 250, 100), 250 / 900 + 0.1);
assert.equal(projectileLifeTime('building', 1000, 600, 250), 0.6);
assert.equal(projectileTurnDelta(0, 25), 10);
assert.equal(projectileTurnDelta(350, 5), -10);
assert.equal(projectileTurnDelta(5, -20), -10);
assert.ok(Math.abs(attackActionDuration(9) - 0.918) < 1e-12);
assert.ok(Math.abs(advanceAttackActionLock(0.918, 0.4) - 0.518) < 1e-12);
assert.equal(advanceAttackActionLock(0.2, 0.4), 0);

const repel = createRepelState({ x: 0, y: 0 }, { x: 3, y: 4 }, 12, 0.3, 50);
assert.ok(Math.abs(repel.velocityX - 360) < 1e-9);
assert.ok(Math.abs(repel.velocityY - 480) < 1e-9);
assert.equal(repel.duration, 0.3);
const repelStepOne = stepRepel({ x: 0, y: 0 }, repel, 0.1, { left: -1000, right: 1000, top: -1000, bottom: 1000 });
assert.ok(Math.abs(repelStepOne.point.x - 36) < 1e-9 && Math.abs(repelStepOne.point.y - 48) < 1e-9);
assert.ok(Math.abs(repelStepOne.state.remaining - 0.2) < 1e-9);
const repelStepTwo = stepRepel(repelStepOne.point, repelStepOne.state, 0.1, { left: -1000, right: 1000, top: -1000, bottom: 1000 });
assert.ok(Math.abs(repelStepTwo.point.x - 60) < 1e-9 && Math.abs(repelStepTwo.point.y - 80) < 1e-9);
assert.equal(latchDeadTargetPoint(false, false, false, { x: 100, y: 0 }, { x: 0, y: 0 }), null);
assert.equal(latchDeadTargetPoint(true, false, true, { x: 100, y: 0 }, { x: 0, y: 0 }), null);
const deadLatch = latchDeadTargetPoint(true, false, false, { x: 100, y: 0 }, { x: 0, y: 0 });
assert.deepEqual(deadLatch.point, { x: 100, y: 0 });
assert.equal(deadLatch.consumeImmediately, false);
assert.equal(latchDeadTargetPoint(true, false, false, { x: 100, y: 0 }, { x: 60, y: 0 }).consumeImmediately, true);
assert.equal(STAGE2_ENEMIES.gbtl_27AAAA80.repelResist, true);
const shooterShopSize = fitBuildingVisualSize(74, 239, 180, 160);
const shooterFieldSize = fitBuildingVisualSize(74, 239, 92, 282);
assert.ok(Math.abs(shooterShopSize.width - 74 * 160 / 239) < 1e-9 && shooterShopSize.height === 160);
assert.deepEqual(shooterFieldSize, { width: 74, height: 239, scale: 1 });
const openingArrowTower = OPENING_SHOP.find((definition) => definition.id === 'e07');
assert.equal(openingArrowTower?.weaponMount?.sprite, 'original/buildings/Building_ArrowTower1_up');
assert.deepEqual(openingArrowTower?.weaponMount?.pivot, [0, 0.5]);
assert.equal(openingArrowTower?.weaponMount?.rotationDegrees, -90);
assert.deepEqual(OPENING_SHOP.map((definition) => definition.visualOffsetY), [-30, -16, -8]);
assert.equal(STORE_REFRESH_PRICE, 15);
assert.equal(SHOP_GUARANTEED_SLOT_INTERVAL, 3);
assert.deepEqual(STAGE2_STORE_ITEM_TYPE_WEIGHTS, [887, 100, 13]);
assert.ok(shopLevelWeights(1).every((weight, index) => Math.abs(weight - [0.88, 0.06, 0.06][index]) < 1e-12));
assert.ok(shopLevelWeights(5).every((weight, index) => Math.abs(weight - [0.844, 0.084, 0.072][index]) < 1e-12));
assert.ok(shopLevelWeights(1, 0.1).every((weight, index) => Math.abs(weight - [0.78, 0.16, 0.06][index]) < 1e-12));
assert.equal(shopRefreshCost(15, [0.5]), 10);
assert.equal(weightedShopIndex(STAGE2_STORE_ITEM_TYPE_WEIGHTS, () => 0), 0);
assert.equal(weightedShopIndex(STAGE2_STORE_ITEM_TYPE_WEIGHTS, () => 0.887), 1);
assert.equal(weightedShopIndex(STAGE2_STORE_ITEM_TYPE_WEIGHTS, () => 0.987), 2);
assert.equal(weightedShopIndex([0, 0, 0], () => 0.5), -1);
const seededShopA = createSeededRandom(677);
const seededShopB = createSeededRandom(677);
assert.deepEqual([seededShopA(), seededShopA(), seededShopA()], [seededShopB(), seededShopB(), seededShopB()]);
assert.equal(SHOP_SLOT_SHAPES.length, 9);
assert.equal(SHOP_SLOT_SHAPES.reduce((sum, slot) => sum + slot.shopWeight, 0), 530);
const oneCellSlot = createShopSlotDefinition(SHOP_SLOT_SHAPES[0]);
assert.equal(oneCellSlot.id, 'slot-1');
assert.deepEqual(oneCellSlot.shape, [[0, 0]]);
assert.equal(oneCellSlot.kind, 'slot');
assert.equal(FUNCTIONAL_SHOP_POOL.length, 18);
assert.equal(new Set(FUNCTIONAL_SHOP_POOL.map((definition) => definition.id)).size, 18);
assert.equal(canSynthesizeBuildings(openingArrowTower, openingArrowTower), true);
const arrowTowerLevel2 = upgradeShopDefinition(openingArrowTower);
assert.equal(arrowTowerLevel2?.level, 2);
assert.equal(arrowTowerLevel2?.attack, 30);
assert.equal(arrowTowerLevel2?.sprite, 'original/buildings/Building_ArrowTower2');
assert.equal(arrowTowerLevel2?.weaponMount?.sprite, 'original/buildings/Building_ArrowTower2_up');
const arrowTowerLevel4 = upgradeShopDefinition(upgradeShopDefinition(arrowTowerLevel2));
assert.equal(arrowTowerLevel4?.attack, 70);
assert.equal(upgradeShopDefinition(arrowTowerLevel4), null);
assert.equal(canSynthesizeBuildings(arrowTowerLevel4, arrowTowerLevel4), false);
const shooterLevel2 = OPENING_SHOP.find((definition) => definition.id === 'e02');
assert.equal(shooterLevel2?.summonUnitMax, 4);
assert.equal(upgradeShopDefinition(shooterLevel2)?.summonCooldownSeconds, 6.3);
assert.equal(upgradeShopDefinition(shooterLevel2)?.summonUnitMax, 6);
const fenceLevel1 = OPENING_SHOP.find((definition) => definition.id === 'e16');
assert.equal(upgradeShopDefinition(fenceLevel1)?.hitPoints, 253.5);
assert.equal(waveEndMineIncome([]), 0);
assert.equal(waveEndMineIncome([1, 8]), 9);
assert.equal(waveEndMineIncome([1, -3, Number.NaN]), 1);
assert.equal(LONG_FENCE.id, 'e17');
assert.equal(LONG_FENCE.kind, 'wall');
assert.equal(LONG_FENCE.hitPoints, 507);
assert.deepEqual(LONG_FENCE.shape, [[0, 0], [1, 0], [2, 0]]);
const longFenceLevel2 = upgradeShopDefinition(LONG_FENCE);
assert.equal(longFenceLevel2?.hitPoints, 760.5);
assert.equal(longFenceLevel2?.sprite, 'original/buildings/Building_Fence22');
const longFenceLevel4 = upgradeShopDefinition(upgradeShopDefinition(longFenceLevel2));
assert.ok(Math.abs((longFenceLevel4?.hitPoints ?? 0) - 1774.5) < 1e-9);
assert.equal(longFenceLevel4?.sprite, 'original/buildings/Building_Fence24');
const longFenceHashes = [
  '2dfb0237dd63c8da2687ef9b7e41a84137141793bd92e4b21343229c5dfcab8d',
  '0841a0cb7727bbbfe7c65879a8742e5c4defea1c0df6b6cf252307d1bba68460',
  'f4bbbcb3046d0e69959afaa967c0e310e9c103aca0b7ddef92106da2c1156404',
  '15209ce2d64443e8a79b31623c989e1722e5ece32b661d20356fae3f2c935b4f',
];
for (let level = 1; level <= 4; level += 1) {
  const asset = readFileSync(new URL(`../assets/resources/original/buildings/Building_Fence2${level}.png`, import.meta.url));
  assert.equal(createHash('sha256').update(asset).digest('hex'), longFenceHashes[level - 1]);
}
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e17'), true);
assert.equal(GOLD_MINE.id, 'e18');
assert.equal(GOLD_MINE.kind, 'economy');
assert.equal(GOLD_MINE.hitPoints, 130);
assert.deepEqual(GOLD_MINE.shape, [[0, 0]]);
assert.equal(GOLD_MINE.moneyPerWave, 1);
const goldMineLevel2 = upgradeShopDefinition(GOLD_MINE);
assert.equal(goldMineLevel2?.moneyPerWave, 2);
assert.equal(goldMineLevel2?.sprite, 'original/buildings/Building_Mine2');
const goldMineLevel4 = upgradeShopDefinition(upgradeShopDefinition(goldMineLevel2));
assert.equal(goldMineLevel4?.moneyPerWave, 8);
assert.equal(goldMineLevel4?.sprite, 'original/buildings/Building_Mine4');
const goldMineHashes = [
  '9b13333616a2bb5d93c0a86a1e7b6ae82fa9e512032a49de5593e0d99ddfd5ad',
  '452a62e03682b3a17693fdfdae750a4db2494cacb1ab9ba3d490fb72f7a6318a',
  '40ff732d453f08ff93eb58a9990619456094443f40d5d96e394af62562f54cfd',
  '061f12c56551bf7b552715617de93cbe00dbace44741f95506a26c464d6e5dcd',
];
for (let level = 1; level <= 4; level += 1) {
  const asset = readFileSync(new URL(`../assets/resources/original/buildings/Building_Mine${level}.png`, import.meta.url));
  assert.equal(createHash('sha256').update(asset).digest('hex'), goldMineHashes[level - 1]);
}
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e18'), true);
assert.equal(MAULER_BARRACKS.id, 'e01');
assert.equal(MAULER_BARRACKS.hitPoints, 520);
assert.deepEqual(MAULER_BARRACKS.shape, [[0, 0], [1, 0], [0, 1], [1, 1]]);
assert.equal(MAULER_BARRACKS.summonBody, 'Swordsman1');
assert.equal(MAULER_BARRACKS.summonUnitMax, 2);
assert.equal(MAULER_BARRACKS.summonCooldownSeconds, 10);
assert.deepEqual(FUNCTIONAL_SHOP_POOL.map((definition) => definition.id), ['e01', 'e06', 'e04', 'e03', 'e05', 'e08', 'e09', 'e10', 'e11', 'e12', 'e13', 'e14', 'e15', 'e17', 'e18', 'e02', 'e07', 'e16']);
const maulerLevel2 = upgradeShopDefinition(MAULER_BARRACKS);
assert.equal(maulerLevel2?.summonCooldownSeconds, 8);
assert.equal(maulerLevel2?.summonUnitMax, 4);
const maulerLevel4 = upgradeShopDefinition(upgradeShopDefinition(maulerLevel2));
assert.equal(maulerLevel4?.summonCooldownSeconds, 6);
assert.equal(maulerLevel4?.summonUnitMax, 8);
const maulerHashes = [
  '9d87ce26c520992c801a2d0a30ae6d66bf77edff0a219511b8d1c2f06a11c504',
  '7e035dd307077fce939159c6d4ea3189124061dfcd59f347ed1ce4c7c4f9a169',
  'cdcf7df33a1bde6058013ceb26e8e9be624db95bd7d6e7f97a555594bd05b4a4',
  '2d37d6e807b3436978f8c7893e05db350f07a094c952cfae3398a38ea73d46a7',
];
for (let level = 1; level <= 4; level += 1) {
  const asset = readFileSync(new URL(`../assets/resources/original/buildings/Building_Mauler${level}.png`, import.meta.url));
  assert.equal(createHash('sha256').update(asset).digest('hex'), maulerHashes[level - 1]);
}
assert.equal(SWORDSMAN_BARRACKS.id, 'e06');
assert.equal(SWORDSMAN_BARRACKS.hitPoints, 390);
assert.deepEqual(SWORDSMAN_BARRACKS.shape, [[0, 0], [1, 0], [2, 0]]);
assert.equal(SWORDSMAN_BARRACKS.summonCooldownSeconds, 9);
assert.equal(SWORDSMAN_BARRACKS.summonBody, 'Mauler1');
assert.equal(SWORDSMAN_BARRACKS.summonUnitMax, 2);
const swordsmanBarracksLevel2 = upgradeShopDefinition(SWORDSMAN_BARRACKS);
assert.equal(swordsmanBarracksLevel2?.summonCooldownSeconds, 7.2);
assert.equal(swordsmanBarracksLevel2?.summonUnitMax, 4);
assert.equal(swordsmanBarracksLevel2?.sprite, 'original/buildings/Building_Swordsman2');
const swordsmanBarracksLevel4 = upgradeShopDefinition(upgradeShopDefinition(swordsmanBarracksLevel2));
assert.equal(swordsmanBarracksLevel4?.summonCooldownSeconds, 5.4);
assert.equal(swordsmanBarracksLevel4?.summonUnitMax, 8);
assert.equal(STAGE2_UNITS.Mauler1.id, 'db_DF32E2C2');
assert.equal(STAGE2_UNITS.Mauler1.hitPoints, 400);
assert.equal(STAGE2_UNITS.Mauler1.attack, 10);
assert.equal(STAGE2_UNITS.Mauler1.attackRange, 1);
assert.equal(STAGE2_UNITS.Mauler1.attackSpeed, 2 / 3);
assert.equal(STAGE2_UNITS.Mauler1.speed, 0.9);
assert.equal(STAGE2_UNITS.Mauler1.bulletSpeed, 0);
assert.equal(STAGE2_UNITS.Mauler1.attackFireFrame, 4);
assert.equal(STAGE2_UNITS.Swordsman1.bulletSpeed, 0);
const maulerFrames = readdirSync(new URL('../assets/resources/original/units/units/', import.meta.url))
  .filter((name) => /^Mauler1_(idle|move|attack|victory)_\d+\.png$/.test(name))
  .sort();
assert.equal(maulerFrames.length, 38);
assert.equal(maulerFrames.filter((name) => name.startsWith('Mauler1_attack_')).length, 7);
assert.equal(createHash('sha256').update(readFileSync(new URL(`../assets/resources/original/units/units/${maulerFrames[0]}`, import.meta.url))).digest('hex'), 'f1109ea8385d2bb40f6c5d0e45bad27685a3c84d20a5de2c4883d35e2bc09ba3');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Mauler1_victory_9.png', import.meta.url))).digest('hex'), '1f2405d441be2355ee47e614a450b2ec7b7a029179ad7e8845f15fcdb531b15d');
assert.equal(CROSSBOWMAN_BARRACKS.id, 'e04');
assert.equal(CROSSBOWMAN_BARRACKS.hitPoints, 520);
assert.deepEqual(CROSSBOWMAN_BARRACKS.shape, [[0, 0], [1, 0], [2, 0], [1, 1]]);
assert.equal(CROSSBOWMAN_BARRACKS.summonCooldownSeconds, 11);
assert.equal(CROSSBOWMAN_BARRACKS.summonBody, 'Crossbowman1');
assert.equal(CROSSBOWMAN_BARRACKS.summonUnitMax, 2);
const crossbowmanBarracksLevel2 = upgradeShopDefinition(CROSSBOWMAN_BARRACKS);
assert.equal(crossbowmanBarracksLevel2?.summonCooldownSeconds, 8.8);
assert.equal(crossbowmanBarracksLevel2?.summonUnitMax, 4);
assert.equal(crossbowmanBarracksLevel2?.sprite, 'original/buildings/Building_Crossbowman2');
const crossbowmanBarracksLevel4 = upgradeShopDefinition(upgradeShopDefinition(crossbowmanBarracksLevel2));
assert.equal(crossbowmanBarracksLevel4?.summonCooldownSeconds, 6.6);
assert.equal(crossbowmanBarracksLevel4?.summonUnitMax, 8);
assert.equal(STAGE2_UNITS.Crossbowman1.id, '-b_CD2EDAAF');
assert.equal(STAGE2_UNITS.Crossbowman1.hitPoints, 75);
assert.equal(STAGE2_UNITS.Crossbowman1.attack, 35);
assert.equal(STAGE2_UNITS.Crossbowman1.attackRange, 6);
assert.equal(STAGE2_UNITS.Crossbowman1.attackSpeed, 0.8);
assert.equal(STAGE2_UNITS.Crossbowman1.speed, 1);
assert.equal(STAGE2_UNITS.Crossbowman1.bulletSpeed, 15);
assert.equal(STAGE2_UNITS.Crossbowman1.attackFireFrame, 6);
const crossbowmanFrames = readdirSync(new URL('../assets/resources/original/units/units/', import.meta.url))
  .filter((name) => /^Crossbowman1_(idle|move|attack|victory)_\d+\.png$/.test(name))
  .sort();
assert.equal(crossbowmanFrames.length, 40);
assert.equal(crossbowmanFrames.filter((name) => name.startsWith('Crossbowman1_attack_')).length, 9);
assert.equal(createHash('sha256').update(readFileSync(new URL(`../assets/resources/original/units/units/${crossbowmanFrames[0]}`, import.meta.url))).digest('hex'), '157cd2d1897629dbd39006f174c62642b433611391a5b965e2a290cdb6759573');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Crossbowman1_victory_9.png', import.meta.url))).digest('hex'), 'b9ab29548a29ad03ea034043e83d8d4b762bd87255c5324e0dd6e603213a5e4d');
assert.equal(KNIGHT_BARRACKS.id, 'e03');
assert.equal(KNIGHT_BARRACKS.hitPoints, 650);
assert.deepEqual(KNIGHT_BARRACKS.shape, [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]);
assert.equal(KNIGHT_BARRACKS.summonCooldownSeconds, 13);
assert.equal(KNIGHT_BARRACKS.summonBody, 'Knight1');
assert.equal(KNIGHT_BARRACKS.summonUnitMax, 2);
const knightBarracksLevel2 = upgradeShopDefinition(KNIGHT_BARRACKS);
assert.equal(knightBarracksLevel2?.summonCooldownSeconds, 10.4);
assert.equal(knightBarracksLevel2?.summonUnitMax, 4);
assert.equal(knightBarracksLevel2?.sprite, 'original/buildings/Building_Knight2');
const knightBarracksLevel4 = upgradeShopDefinition(upgradeShopDefinition(knightBarracksLevel2));
assert.equal(knightBarracksLevel4?.summonCooldownSeconds, 7.8);
assert.equal(knightBarracksLevel4?.summonUnitMax, 8);
assert.equal(STAGE2_UNITS.Knight1.id, 'qb_2B5987F2');
assert.equal(STAGE2_UNITS.Knight1.hitPoints, 350);
assert.equal(STAGE2_UNITS.Knight1.attack, 40);
assert.equal(STAGE2_UNITS.Knight1.attackRange, 1);
assert.equal(STAGE2_UNITS.Knight1.attackSpeed, 1);
assert.equal(STAGE2_UNITS.Knight1.speed, 1.7);
assert.equal(STAGE2_UNITS.Knight1.bulletSpeed, 0);
assert.equal(STAGE2_UNITS.Knight1.attackFireFrame, 9);
assert.equal(KNIGHT_CHARGE_TRAIT.damageRatio, 0.3);
assert.equal(KNIGHT_CHARGE_TRAIT.speedMultiplier, 1.5);
assert.equal(KNIGHT_CHARGE_TRAIT.repelPhysicsUnitsPerSecond, 10);
assert.equal(KNIGHT_CHARGE_TRAIT.repelSeconds, 0.2);
assert.equal(KNIGHT_CHARGE_TRAIT.dizzinessChance, 0);
assert.equal(KNIGHT_CHARGE_TRAIT.dizzinessSeconds, 1);
assert.equal(KNIGHT_CHARGE_DIZZINESS_TRAIT.dizzinessChance, 1);
assert.equal(KNIGHT_CHARGE_DIZZINESS_TRAIT.dizzinessSeconds, 3);
const knightFrames = readdirSync(new URL('../assets/resources/original/units/units/', import.meta.url))
  .filter((name) => /^Knight1_(idle|move|attack|victory|charge)_\d+\.png$/.test(name))
  .sort();
assert.equal(knightFrames.length, 50);
assert.equal(knightFrames.filter((name) => name.startsWith('Knight1_attack_')).length, 14);
assert.equal(knightFrames.filter((name) => name.startsWith('Knight1_charge_')).length, 5);
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Knight1_attack_0.png', import.meta.url))).digest('hex'), 'd1d23b36a56caba3e8ea3000e1ca3e1462c2b85d0db86c7b725b85192312b774');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Knight1_charge_0.png', import.meta.url))).digest('hex'), '721bbbdd6315d0e24ee59f1ec45ec6cf1141392d16c7b72a830e6db39aff5d54');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Knight1_victory_9.png', import.meta.url))).digest('hex'), '41098bfaf4e3c2263872cc5733ac3956472ac4f46c9800bafe9e961b190713da');
assert.equal(MAGE_BARRACKS.id, 'e05');
assert.equal(MAGE_BARRACKS.hitPoints, 520);
assert.deepEqual(MAGE_BARRACKS.shape, [[0, 0], [1, 0], [0, 1], [0, 2]]);
assert.equal(MAGE_BARRACKS.summonCooldownSeconds, 11);
assert.equal(MAGE_BARRACKS.summonBody, 'Mage1');
assert.equal(MAGE_BARRACKS.summonUnitMax, 2);
const mageBarracksLevel2 = upgradeShopDefinition(MAGE_BARRACKS);
assert.equal(mageBarracksLevel2?.summonCooldownSeconds, 8.8);
assert.equal(mageBarracksLevel2?.summonUnitMax, 4);
assert.equal(mageBarracksLevel2?.sprite, 'original/buildings/Building_Mage2');
const mageBarracksLevel4 = upgradeShopDefinition(upgradeShopDefinition(mageBarracksLevel2));
assert.equal(mageBarracksLevel4?.summonCooldownSeconds, 6.6);
assert.equal(mageBarracksLevel4?.summonUnitMax, 8);
assert.equal(STAGE2_UNITS.Mage1.id, 'fs_18B222C3');
assert.equal(STAGE2_UNITS.Mage1.hitPoints, 100);
assert.equal(STAGE2_UNITS.Mage1.attack, 60);
assert.equal(STAGE2_UNITS.Mage1.attackRange, 4.5);
assert.equal(STAGE2_UNITS.Mage1.attackSpeed, 7 / 12);
assert.equal(STAGE2_UNITS.Mage1.speed, 1.1);
assert.equal(STAGE2_UNITS.Mage1.bulletSpeed, 19.5);
assert.equal(STAGE2_UNITS.Mage1.attackFireFrame, 9);
assert.equal(STAGE2_UNITS.Mage1.aoeRadiusPixels, 100);
const mageFrames = readdirSync(new URL('../assets/resources/original/units/units/', import.meta.url))
  .filter((name) => /^Mage1_(idle|move|attack|victory)_\d+\.png$/.test(name))
  .sort();
assert.equal(mageFrames.length, 46);
assert.equal(mageFrames.filter((name) => name.startsWith('Mage1_attack_')).length, 15);
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Mage1_attack_0.png', import.meta.url))).digest('hex'), '24a0cd44da1bc333df6fb97a19b4232d05be8100d7d90c5a400d30a2aae65be9');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Mage1_attack_14.png', import.meta.url))).digest('hex'), '8351dd6144e66258af11db60ea4a82235a54fb55ae86d61f76e34884adca5c97');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/units/units/Mage1_victory_9.png', import.meta.url))).digest('hex'), 'f0133699d58c16d6f1f2bbc6db65095524029561057c8a3be625769126132594');
assert.equal(TREBUCHET.id, 'e08');
assert.equal(TREBUCHET.hitPoints, 520);
assert.deepEqual(TREBUCHET.shape, [[0, 0], [1, 0], [0, 1], [1, 1]]);
assert.equal(TREBUCHET.attack, 60);
assert.equal(TREBUCHET.cooldownSeconds, 4);
assert.equal(TREBUCHET.rangePixels, 650);
assert.equal(TREBUCHET.criticalChance, 0.05);
assert.equal(TREBUCHET.criticalDamage, 1.5);
assert.equal(TREBUCHET.projectileSpeedPixels, 1250);
assert.equal(TREBUCHET.projectileWidth, 48);
assert.equal(TREBUCHET.projectileHeight, 26);
assert.equal(TREBUCHET.splashRadiusPixels, 75);
assert.equal(TREBUCHET.splashDamageRatio, 0.5);
assert.equal(TREBUCHET.forceTargetOnly, true);
assert.equal(TREBUCHET.weaponMount?.sprite, 'original/buildings/Building_Trebuchet1_up');
assert.equal(TREBUCHET.weaponMount?.x, 0.5);
assert.equal(TREBUCHET.weaponMount?.y, 0.1);
assert.deepEqual(TREBUCHET.weaponMount?.pivot, [0.88, 0.5]);
assert.equal(TREBUCHET.weaponMount?.rotationDegrees, -90);
const trebuchetLevel2 = upgradeShopDefinition(TREBUCHET);
assert.equal(trebuchetLevel2?.attack, 90);
assert.equal(trebuchetLevel2?.sprite, 'original/buildings/Building_Trebuchet2');
assert.equal(trebuchetLevel2?.weaponMount?.sprite, 'original/buildings/Building_Trebuchet2_up');
const trebuchetLevel4 = upgradeShopDefinition(upgradeShopDefinition(trebuchetLevel2));
assert.equal(trebuchetLevel4?.attack, 210);
assert.equal(trebuchetLevel4?.sprite, 'original/buildings/Building_Trebuchet4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Trebuchet1.png', import.meta.url))).digest('hex'), '09920ed056883a807c49589ea94b6960c869421ee3b10c47a85a1fbbc31d2f7d');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Trebuchet1_up.png', import.meta.url))).digest('hex'), 'bd3793b61bc46e343714f574e061ac87340bec4c4e6641c3639f8a7d7276bb30');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Trebuchet4.png', import.meta.url))).digest('hex'), 'c7c5b41f61b48ea56f1eeb9c4ac3cee663df91c3f0401d61c6f759cea7c7cff4');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e08'), true);
assert.equal(ELECTRICITY_TOWER.id, 'e09');
assert.equal(ELECTRICITY_TOWER.hitPoints, 260);
assert.deepEqual(ELECTRICITY_TOWER.shape, [[0, 0], [1, 0]]);
assert.equal(ELECTRICITY_TOWER.attack, 40);
assert.equal(ELECTRICITY_TOWER.cooldownSeconds, 3);
assert.equal(ELECTRICITY_TOWER.rangePixels, 700);
assert.equal(ELECTRICITY_TOWER.criticalChance, 0.05);
assert.equal(ELECTRICITY_TOWER.criticalDamage, 1.5);
assert.equal(ELECTRICITY_TOWER.projectileSpeedPixels, 6000);
assert.equal(ELECTRICITY_TOWER.projectileWidth, 38);
assert.equal(ELECTRICITY_TOWER.projectileHeight, 20);
assert.equal(ELECTRICITY_TOWER.forceTargetOnly, true);
assert.equal(ELECTRICITY_TOWER.jumpCount, 1);
assert.equal(ELECTRICITY_TOWER.projectileLifeTimeSeconds, 0.3);
assert.deepEqual(ELECTRICITY_TOWER.projectileColor, [125, 230, 255, 255]);
assert.equal(ELECTRICITY_TOWER.weaponMount?.sprite, 'original/buildings/Building_ElectricityTower1_up');
assert.equal(ELECTRICITY_TOWER.weaponMount?.x, 0.5);
assert.equal(ELECTRICITY_TOWER.weaponMount?.y, 0.1);
assert.deepEqual(ELECTRICITY_TOWER.weaponMount?.pivot, [0.45, 0.5]);
assert.equal(ELECTRICITY_TOWER.weaponMount?.rotationDegrees, -90);
const electricityLevel2 = upgradeShopDefinition(ELECTRICITY_TOWER);
assert.equal(electricityLevel2?.attack, 60);
assert.equal(electricityLevel2?.sprite, 'original/buildings/Building_ElectricityTower2');
assert.equal(electricityLevel2?.weaponMount?.sprite, 'original/buildings/Building_ElectricityTower2_up');
const electricityLevel4 = upgradeShopDefinition(upgradeShopDefinition(electricityLevel2));
assert.equal(electricityLevel4?.attack, 140);
assert.equal(electricityLevel4?.sprite, 'original/buildings/Building_ElectricityTower4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ElectricityTower1.png', import.meta.url))).digest('hex'), 'daafe1e35da415918dd67c6b535110ea695043cd441009d2cd7f97132bf9f16b');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ElectricityTower1_up.png', import.meta.url))).digest('hex'), 'eaa8d7991a60d133af1c21389d00d011a4ea3b503da42d136b6d32388581677a');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ElectricityTower4.png', import.meta.url))).digest('hex'), '2984e4df6db7f7d4415cbd4b4537b323b11cfdca3915f0a2afd96647a84e2e55');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e09'), true);
assert.equal(MIRROR_TOWER.id, 'e10');
assert.equal(MIRROR_TOWER.hitPoints, 260);
assert.deepEqual(MIRROR_TOWER.shape, [[0, 0], [0, 1]]);
assert.equal(MIRROR_TOWER.attack, 20);
assert.equal(MIRROR_TOWER.cooldownSeconds, 4);
assert.equal(MIRROR_TOWER.rangePixels, 750);
assert.equal(MIRROR_TOWER.criticalChance, 0.05);
assert.equal(MIRROR_TOWER.criticalDamage, 1.5);
assert.equal(MIRROR_TOWER.laserDurationSeconds, 2);
assert.equal(MIRROR_TOWER.laserTickIntervalSeconds, 0.25);
assert.equal(MIRROR_TOWER.weaponMount?.sprite, 'original/buildings/Building_MirrorTower1_up');
assert.equal(MIRROR_TOWER.weaponMount?.x, 0.5);
assert.equal(MIRROR_TOWER.weaponMount?.y, 0.05);
assert.deepEqual(MIRROR_TOWER.weaponMount?.pivot, [0.5, 0.5]);
assert.equal(MIRROR_TOWER.weaponMount?.rotationDegrees, -90);
const mirrorLevel2 = upgradeShopDefinition(MIRROR_TOWER);
assert.equal(mirrorLevel2?.attack, 30);
assert.equal(mirrorLevel2?.sprite, 'original/buildings/Building_MirrorTower2');
assert.equal(mirrorLevel2?.weaponMount?.sprite, 'original/buildings/Building_MirrorTower2_up');
const mirrorLevel4 = upgradeShopDefinition(upgradeShopDefinition(mirrorLevel2));
assert.equal(mirrorLevel4?.attack, 70);
assert.equal(mirrorLevel4?.sprite, 'original/buildings/Building_MirrorTower4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_MirrorTower1.png', import.meta.url))).digest('hex'), '06ead00d60861c0ffea1fa415918a49eeb2131e4f52ebdd2b28c467b2d4b1fac');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_MirrorTower1_up.png', import.meta.url))).digest('hex'), '51125117e7fb58c08902950d3842746da6c4729c0604b8527a4c4dc7cb7be58b');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_MirrorTower4.png', import.meta.url))).digest('hex'), 'cb4cb8fbc9de1751cb61c13f92e79040d7627b7706bb89fc82edc98d054708b6');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e10'), true);
assert.equal(battleExperienceGain(STAGE2_EXPERIENCE.normal, 0), 10);
assert.equal(battleExperienceGain(STAGE2_EXPERIENCE.normal, 0.05), 11);
assert.equal(fightLevelExperienceGain(STAGE2_EXPERIENCE.normal, STAGE2_EXPERIENCE.fightLevelFix, 0), 8);
assert.ok(Math.abs(fightLevelExperienceGain(STAGE2_EXPERIENCE.normal, STAGE2_EXPERIENCE.fightLevelFix, 0.05) - 8.4) < 1e-12);
assert.equal(EXPERIENCE_CRYSTAL.id, 'e11');
assert.equal(EXPERIENCE_CRYSTAL.kind, 'economy');
assert.equal(EXPERIENCE_CRYSTAL.hitPoints, 130);
assert.deepEqual(EXPERIENCE_CRYSTAL.shape, [[0, 0]]);
assert.equal(EXPERIENCE_CRYSTAL.experienceBonus, 0.05);
const crystalLevel2 = upgradeShopDefinition(EXPERIENCE_CRYSTAL);
assert.equal(crystalLevel2?.experienceBonus, 0.1);
assert.equal(crystalLevel2?.sprite, 'original/buildings/Building_ShuiJing2');
const crystalLevel4 = upgradeShopDefinition(upgradeShopDefinition(crystalLevel2));
assert.equal(crystalLevel4?.experienceBonus, 0.4);
assert.equal(crystalLevel4?.sprite, 'original/buildings/Building_ShuiJing4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ShuiJing1.png', import.meta.url))).digest('hex'), 'd0f86af983f8b0edeecf5024a20680f7585dd5b34a60f308b8bf11a3b609be97');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ShuiJing4.png', import.meta.url))).digest('hex'), '6b06bef25c84a55ff43dc7491940a936c42ab2e5bbd9fa800b322240daacbe9b');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e11'), true);
assert.equal(enemySpeedMultiplier([]), 1);
assert.ok(Math.abs(enemySpeedMultiplier([0.05]) - 1 / 1.05) < 1e-12);
assert.ok(Math.abs(enemySpeedMultiplier([0.05, 0.05]) - 1 / (1.05 * 1.05)) < 1e-12);
assert.equal(enemySpeedMultiplier([1000]), 0.05);
assert.equal(enemySpeedMultiplier([Number.NaN, -1]), 1);
assert.equal(SLOWING_WELL.id, 'e12');
assert.equal(SLOWING_WELL.kind, 'support');
assert.equal(SLOWING_WELL.hitPoints, 260);
assert.deepEqual(SLOWING_WELL.shape, [[0, 0], [0, 1]]);
assert.equal(SLOWING_WELL.enemySlowAmount, 0.05);
const wellLevel2 = upgradeShopDefinition(SLOWING_WELL);
assert.equal(wellLevel2?.enemySlowAmount, 0.075);
assert.equal(wellLevel2?.sprite, 'original/buildings/Building_Well2');
const wellLevel4 = upgradeShopDefinition(upgradeShopDefinition(wellLevel2));
assert.equal(wellLevel4?.enemySlowAmount, 0.175);
assert.equal(wellLevel4?.sprite, 'original/buildings/Building_Well4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Well1.png', import.meta.url))).digest('hex'), '00d19fe31b83be0bcf2f107cf2c03d35771a62e529397d2b9e8b2220e3fb73b0');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Well4.png', import.meta.url))).digest('hex'), 'acc936c6d07d004475d13d2b4484e13ddb2d94aadf80617b405fa9190ead2137');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e12'), true);
assert.equal(criticalChanceWithAura(0.05, []), 0.05);
assert.equal(criticalChanceWithAura(0.05, [0.05]), 0.1);
assert.ok(Math.abs(criticalChanceWithAura(0.05, [0.05, 0.05]) - 0.15) < 1e-12);
assert.equal(criticalChanceWithAura(0.9, [0.1]), 0.95);
assert.equal(OBSERVATION_DECK.id, 'e13');
assert.equal(OBSERVATION_DECK.kind, 'support');
assert.equal(OBSERVATION_DECK.hitPoints, 260);
assert.deepEqual(OBSERVATION_DECK.shape, [[0, 0], [0, 1]]);
assert.equal(OBSERVATION_DECK.globalCriticalChanceBonus, 0.05);
const observationLevel2 = upgradeShopDefinition(OBSERVATION_DECK);
assert.equal(observationLevel2?.globalCriticalChanceBonus, 0.075);
assert.equal(observationLevel2?.sprite, 'original/buildings/Building_ObservationDeck2');
const observationLevel4 = upgradeShopDefinition(upgradeShopDefinition(observationLevel2));
assert.equal(observationLevel4?.globalCriticalChanceBonus, 0.175);
assert.equal(observationLevel4?.sprite, 'original/buildings/Building_ObservationDeck4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ObservationDeck1.png', import.meta.url))).digest('hex'), 'a6050cbc10062dc85d357124288b256a636e80e0dc605976219198f8be8ef0ea');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_ObservationDeck4.png', import.meta.url))).digest('hex'), 'dda231498ea53276e98680c7cbdd2a50714781f816dea1679e414adb65fa5d17');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e13'), true);
assert.equal(buildingCooldownWithAdjacentSpeed(2, []), 2);
assert.equal(buildingCooldownWithAdjacentSpeed(2, [0.05]), 2 / 1.05);
assert.ok(Math.abs(buildingCooldownWithAdjacentSpeed(9, [0.05, 0.05]) - 9 / 1.1) < 1e-12);
assert.equal(buildingCooldownWithAdjacentSpeed(2, [Number.NaN, -1]), 2);
assert.equal(areGridFootprintsAdjacent(3, 4, [[0, 0]], 2, 3, [[0, 0]]), true);
assert.equal(areGridFootprintsAdjacent(3, 4, [[0, 0], [0, 1]], 1, 6, [[0, 0], [1, 0], [2, 0]]), true);
assert.equal(areGridFootprintsAdjacent(3, 4, [[0, 0]], 3, 4, [[0, 0]]), false);
assert.equal(areGridFootprintsAdjacent(3, 4, [[0, 0]], 5, 6, [[0, 0]]), false);
assert.equal(ATTACK_SPEED_STATUE.id, 'e14');
assert.equal(ATTACK_SPEED_STATUE.kind, 'support');
assert.equal(ATTACK_SPEED_STATUE.hitPoints, 260);
assert.deepEqual(ATTACK_SPEED_STATUE.shape, [[0, 0], [0, 1]]);
assert.equal(ATTACK_SPEED_STATUE.adjacentAttackSpeedBonus, 0.05);
const attackSpeedStatueLevel2 = upgradeShopDefinition(ATTACK_SPEED_STATUE);
assert.equal(attackSpeedStatueLevel2?.adjacentAttackSpeedBonus, 0.075);
assert.equal(attackSpeedStatueLevel2?.sprite, 'original/buildings/Building_Statue2');
const attackSpeedStatueLevel4 = upgradeShopDefinition(upgradeShopDefinition(attackSpeedStatueLevel2));
assert.equal(attackSpeedStatueLevel4?.adjacentAttackSpeedBonus, 0.175);
assert.equal(attackSpeedStatueLevel4?.sprite, 'original/buildings/Building_Statue4');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Statue1.png', import.meta.url))).digest('hex'), '7611d7a5df3a0b0e81a31ed29a0d74df43bc0c90f30745a83417041048dbd93b');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_Statue4.png', import.meta.url))).digest('hex'), 'e5a810f8008a7e73cf51d02db7a4edd16b3cf442f564c3a564b417a2a1c19d74');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e14'), true);
assert.equal(attackWithAdjacentBonus(20, []), 20);
assert.equal(attackWithAdjacentBonus(20, [0.05]), 21);
assert.ok(Math.abs(attackWithAdjacentBonus(30, [0.05, 0.05]) - 33) < 1e-12);
assert.equal(attackWithAdjacentBonus(20, [Number.NaN, -1]), 20);
assert.equal(MARTIAL_ARTS_FIELD.id, 'e15');
assert.equal(MARTIAL_ARTS_FIELD.kind, 'support');
assert.equal(MARTIAL_ARTS_FIELD.hitPoints, 260);
assert.deepEqual(MARTIAL_ARTS_FIELD.shape, [[0, 0], [1, 0]]);
assert.equal(MARTIAL_ARTS_FIELD.adjacentAttackBonus, 0.05);
const martialArtsFieldLevel2 = upgradeShopDefinition(MARTIAL_ARTS_FIELD);
assert.equal(martialArtsFieldLevel2?.adjacentAttackBonus, 0.05);
assert.equal(martialArtsFieldLevel2?.sprite, 'original/buildings/Building_MartialArtsField2');
const martialArtsFieldLevel4 = upgradeShopDefinition(upgradeShopDefinition(martialArtsFieldLevel2));
assert.equal(martialArtsFieldLevel4?.adjacentAttackBonus, 0.05);
assert.equal(martialArtsFieldLevel4?.sprite, 'original/buildings/Building_MartialArtsField4');
assert.equal([MARTIAL_ARTS_FIELD, martialArtsFieldLevel2, upgradeShopDefinition(martialArtsFieldLevel2), martialArtsFieldLevel4].every((definition) => definition?.adjacentAttackBonus === 0.05), true);
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_MartialArtsField1.png', import.meta.url))).digest('hex'), '226c080347b33cfaf38a74351c0045417a5fda309e4fb85690e8f1e9833217fb');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/buildings/Building_MartialArtsField4.png', import.meta.url))).digest('hex'), '267ef8453dd002cd3076784338157d8e009782bbbb3d175c6347df2d65422ee3');
assert.equal(FUNCTIONAL_SHOP_POOL.some((definition) => definition.id === 'e15'), true);

assert.equal(FIGHT_LEVEL_EXPERIENCE.length, 30);
assert.equal(FIGHT_LEVEL_EXPERIENCE[0], 20);
assert.equal(FIGHT_LEVEL_EXPERIENCE[29], 860);
assert.equal(BATTLE_CHOICE_REFRESH_COUNT, 10);
assert.equal(MAX_ALL_TRAIT_COUNT, 3);
assert.deepEqual(STUDY_TRAIT_QUALITY_WEIGHTS, [80, 40, 20]);
assert.equal(GENERAL_TRAITS.length, 16);
assert.equal(availableGeneralTraits([]).length, 35);
const nearlyCappedSlow = availableGeneralTraits([
  { type: 'general', id: 3, quality: 3, value: 0.15, effectKey: 'EnemySpeedDown' },
  { type: 'general', id: 3, quality: 3, value: 0.15, effectKey: 'EnemySpeedDown' },
  { type: 'general', id: 3, quality: 3, value: 0.15, effectKey: 'EnemySpeedDown' },
]).filter((trait) => trait.id === 3);
assert.deepEqual(nearlyCappedSlow.map((trait) => trait.quality), [1]);
assert.equal(availableGeneralTraits([
  { type: 'general', id: 3, quality: 3, value: 0.5, effectKey: 'EnemySpeedDown' },
]).some((trait) => trait.id === 3), false);
const oncePerQuality = availableGeneralTraits([
  { type: 'general', id: 5, quality: 2, value: 0.3, effectKey: 'ExpUp' },
]);
assert.equal(oncePerQuality.some((trait) => trait.id === 5 && trait.quality === 2), false);
assert.equal(oncePerQuality.some((trait) => trait.id === 5 && trait.quality === 3), true);
assert.equal(availableGeneralTraits([
  { type: 'general', id: 7, quality: 1, value: 10, effectKey: 'Coins' },
]).some((trait) => trait.id === 7), false);
const traitChoices = rollGeneralTraitChoices([], createSeededRandom(413));
assert.equal(traitChoices.length, 3);
assert.equal(traitChoices.filter((trait) => trait.quality === 3).length <= 1, true);
assert.equal(new Set(traitChoices.map((trait) => `${trait.id}:${trait.quality}`)).size, 3);
assert.ok(Math.abs(traitMultiplier([
  { type: 'general', id: 1, quality: 1, value: 0.05, effectKey: 'AllUnitAtk' },
  { type: 'general', id: 1, quality: 2, value: 0.1, effectKey: 'AllUnitAtk' },
], 'AllUnitAtk') - 1.155) < 1e-12);
assert.equal(traitSum([
  { type: 'general', id: 6, quality: 2, value: 2, effectKey: 'CoinsUp' },
  { type: 'general', id: 6, quality: 3, value: 5, effectKey: 'CoinsUp' },
], 'CoinsUp'), 7);

const gameSource = readFileSync(new URL('../assets/scripts/ShouchengGame.ts', import.meta.url), 'utf8');
const spriteSequenceSource = readFileSync(new URL('../assets/scripts/view/SpriteSequence.ts', import.meta.url), 'utf8');
assert.match(gameSource, /data-cocos-trait-selection-smoke/);
assert.match(gameSource, /private openTraitSelection\(/);
assert.match(gameSource, /if \(!this\.fighting \|\| this\.finished \|\| this\.traitSelecting\) return/);
assert.match(gameSource, /this\.grantFightLevelExperience\(fightLevelBaseExperience, buildingBonus\)/);
assert.match(gameSource, /button\.on\(Node\.EventType\.TOUCH_END, \(\) => this\.selectTraitChoices/);
assert.match(gameSource, /data-cocos-martial-arts-field-smoke/);
assert.match(gameSource, /data-cocos-long-fence-smoke/);
assert.match(gameSource, /data-cocos-gold-mine-smoke/);
assert.match(gameSource, /this\.money \+= this\.activeMineIncome\(\)/);
assert.match(gameSource, /building\.node\.active && building\.hitPoints > 0/);
assert.match(gameSource, /state\.afterFinalWave === 19/);
assert.match(gameSource, /data-cocos-shop-refresh-smoke/);
assert.match(gameSource, /private async normalRefresh\(\): Promise<boolean>/);
assert.match(gameSource, /private async specialRefresh\(\): Promise<boolean>/);
assert.match(gameSource, /this\.placeSlotExpansion\(drag\.definition, column, row\)/);
assert.match(gameSource, /if \(this\.money < cost\) return false/);
assert.match(gameSource, /state\.selectedAsNearestBuilding = selectedTarget\?\.kind === 'building'/);
assert.match(gameSource, /state\.damageTaken === 30/);
assert.match(gameSource, /attackWithAdjacentBonus\(/);
assert.match(gameSource, /this\.adjacentAttackBonuses\(building\)/);
assert.match(gameSource, /sourceBuilding \? this\.adjacentAttackBonuses\(sourceBuilding\) : \[\]/);
assert.match(gameSource, /data-cocos-attack-speed-statue-smoke/);
assert.match(gameSource, /buildingCooldownWithAdjacentSpeed\(/);
assert.match(gameSource, /this\.adjacentAttackSpeedBonuses\(building\)/);
assert.match(gameSource, /areGridFootprintsAdjacent\(/);
assert.match(gameSource, /data-cocos-observation-deck-smoke/);
assert.match(gameSource, /criticalChanceWithAura\(building\.definition\.criticalChance/);
assert.match(gameSource, /actor\.team === 'ally' \? criticalChanceWithAura/);
assert.match(gameSource, /building\.definition\.globalCriticalChanceBonus \?\? 0/);
assert.match(gameSource, /data-cocos-slowing-well-smoke/);
assert.match(gameSource, /actor\.team === 'enemy' \? this\.activeEnemySpeedMultiplier\(\) : 1/);
assert.match(gameSource, /building\.definition\.kind === 'support'/);
assert.match(gameSource, /data-cocos-experience-crystal-smoke/);
assert.match(gameSource, /this\.activeBuildingExperienceBonus\(\)/);
assert.match(gameSource, /this\.battleExperience \+= battleExperienceGain/);
assert.match(gameSource, /const gained = fightLevelExperienceGain/);
assert.match(gameSource, /id: 'meteorite'[\s\S]*id: 'healing'[\s\S]*id: 'freeze'/);
assert.match(gameSource, /interval: 3 \/ targets\.length/);
assert.match(gameSource, /enemy\.freezeRemaining = Math\.max\(enemy\.freezeRemaining, 4\)/);
assert.match(gameSource, /ally\.hitPoints \+ ally\.maxHitPoints/);
assert.match(gameSource, /this\.airSupportUsed\.has\(skillId\)/);
assert.match(gameSource, /65 \* PHYSICS_PIXEL_RATIO/);
assert.match(gameSource, /'original\/effects\/meteor-projectile\/meteor-projectile-00'/);
assert.match(gameSource, /this\.airSupportLayer\.setPosition\(0, -visibleHeight \/ 2 \+ 60\)/);
assert.match(gameSource, /this\.airSupportLayer\.active = false/);
assert.match(gameSource, /data-cocos-air-support-smoke/);
assert.deepEqual(
  [RECOVERED_AIR_SUPPORT_EFFECTS.freeze.width, RECOVERED_AIR_SUPPORT_EFFECTS.freeze.height],
  [243, 243],
);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS.freeze.layouts[0].width, 95);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS.healing.framePaths.length, 18);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS.healing.framePaths[0], null);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS.healing.pivotY, 0.63);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS['artillery-fire'].scale, 1.7);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].framePaths.length, 7);
assert.equal(RECOVERED_AIR_SUPPORT_EFFECTS['meteor-projectile'].scale, 1.8);
assert.equal(RECOVERED_LASER_EFFECTS[1].width, 556);
assert.equal(RECOVERED_LASER_EFFECTS[1].height, 232);
assert.equal(RECOVERED_LASER_EFFECTS[1].intervalSeconds, 0.083);
assert.equal(RECOVERED_LASER_EFFECTS[1].framePaths.length, 15);
assert.equal(RECOVERED_LASER_EFFECTS[4].framePaths[14], 'original/effects/laser4/Laser4-14');
assert.equal(RECOVERED_LASER_EFFECTS[1].layouts[0].width, 402);
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/effects/laser1/Laser1-00.png', import.meta.url))).digest('hex'), 'bd7f465e2cc101dac8075d9bfb71768e10948fd1a2489449092e8757b4350f42');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/effects/laser2/Laser2-00.png', import.meta.url))).digest('hex'), 'aea01b522303628cd3768d34d0f915dff84c45fd4bc61b12b0255dfe591e8af3');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/effects/laser3/Laser3-00.png', import.meta.url))).digest('hex'), '5fec6280701ff5fb955d6ab3a3ef365b59a76f778d2ea6768ac353ab9c389f6d');
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/effects/laser4/Laser4-00.png', import.meta.url))).digest('hex'), '2f52c6cb65ef3db18bd39087830afeb24afd704dd6c84cb3f7b2500279ef12f7');
assert.match(gameSource, /RECOVERED_LASER_EFFECTS\[level\]/);
assert.match(gameSource, /distance \/ effect\.config\.referenceBeamWidth/);
const recoveredFont = readFileSync(new URL('../assets/resources/original/fonts/OPPOSansH.ttf', import.meta.url));
assert.equal(createHash('sha256').update(recoveredFont).digest('hex'), 'ad6bdbd3ac3a600be862a571abb4809d015633232eafee1a511554db61b50a9c');
assert.match(gameSource, /resources\.load\('original\/fonts\/OPPOSansH', Font/);
assert.equal((gameSource.match(/this\.applyGameFont\(label\)/g) ?? []).length, 2);
assert.match(gameSource, /data-cocos-font/);
assert.match(gameSource, /this\.resizeBuildingVisual\(drag\.node, drag\.definition, footprintWidth, footprintHeight\)/);
assert.match(gameSource, /this\.resizeBuildingVisual\(building\.node, building\.definition, 180, 160\)/);
assert.match(gameSource, /this\.waveCoinRoster = allocateWaveCoins\(count, 10\)/);
assert.match(gameSource, /this\.money \+= actor\.deadCoins/);
assert.match(gameSource, /original\/ui\/hud_counter_bg/);
assert.match(gameSource, /this\.refreshEconomyHud\(\)/);
assert.match(gameSource, /data-cocos-economy/);
assert.match(gameSource, /this\.findSynthesisTarget\(drag\.definition, column, row, drag\.existing\)/);
assert.match(gameSource, /data-cocos-synthesis-smoke/);
assert.match(gameSource, /definition: existing\?\.definition \?\? shopItem\?\.definition \?\? definition/);
assert.match(gameSource, /this\.findShopSynthesisTarget\(drag\.definition, point, drag\.shopItem\)/);
assert.match(gameSource, /item === sourceItem \|\| !item\.available \|\| !item\.node\.active/);
assert.match(gameSource, /canSynthesizeBuildings\(definition, item\.definition\)/);
assert.match(gameSource, /this\.mergeShopItemInto\(shopSynthesisTarget, drag\.shopItem, drag\.existing\)/);
assert.match(gameSource, /targetItem\.definition = nextDefinition/);
assert.match(gameSource, /this\.consumeShopItem\(sourceItem, sourceBuilding\)/);
assert.match(gameSource, /data-cocos-shop-synthesis-smoke/);
assert.match(gameSource, /shopItem\.available = true/);
assert.match(gameSource, /alive < \(building\.definition\.summonUnitMax \?\? 2\)/);
assert.match(gameSource, /building\.definition\.summonBody \?\? 'Shooter1'/);
assert.match(gameSource, /data-cocos-mauler-barracks-smoke/);
assert.match(gameSource, /data-cocos-swordsman-barracks-smoke/);
assert.match(gameSource, /data-cocos-crossbowman-barracks-smoke/);
assert.match(gameSource, /data-cocos-knight-barracks-smoke/);
assert.match(gameSource, /data-cocos-mage-barracks-smoke/);
assert.match(gameSource, /data-cocos-trebuchet-smoke/);
assert.match(gameSource, /isPrimary \? attack : attack \* splashDamageRatio/);
assert.match(gameSource, /building\.definition\.forceTargetOnly \?\? false/);
assert.match(gameSource, /building\.definition\.projectileWidth \?\? 38/);
assert.match(gameSource, /data-cocos-electricity-tower-smoke/);
assert.match(gameSource, /findProjectileJumpTarget\(projectile, hitPoint\)/);
assert.match(gameSource, /projectile\.lifeTime = projectile\.resetLifeTime/);
assert.match(gameSource, /sprite\.color = new Color\(color\[0\], color\[1\], color\[2\], color\[3\]\)/);
assert.match(gameSource, /data-cocos-mirror-tower-smoke/);
assert.match(gameSource, /this\.fireLaser\(/);
assert.match(gameSource, /effect\.clock >= effect\.nextTick && effect\.nextTick < effect\.duration/);
assert.match(gameSource, /node\.addComponent\(FairyMovieClipSequence\)\.play\(/);
assert.match(gameSource, /state\.laserRemovedAfterDuration = this\.laserEffects\.length === 0/);
assert.match(gameSource, /canvasTransform\.convertToNodeSpaceAR\(mount\.worldPosition\)/);
assert.match(gameSource, /Mauler1: \{ idle: 8, move: 10, attack: 7, victory: 13 \}/);
assert.match(gameSource, /Crossbowman1: \{ idle: 8, move: 10, attack: 9, victory: 13 \}/);
assert.match(gameSource, /Knight1: \{ idle: 8, move: 10, attack: 14, victory: 13, charge: 5 \}/);
assert.match(gameSource, /Mage1: \{ idle: 8, move: 10, attack: 15, victory: 13 \}/);
assert.match(gameSource, /ally: \['Swordsman1', 'Shooter1', 'Mauler1', 'Crossbowman1', 'Knight1', 'Mage1'\]/);
assert.match(gameSource, /if \(team === 'ally'\)/);
assert.match(gameSource, /targets\.push\(\{ kind: 'actor', actor: enemy \}\)/);
assert.match(gameSource, /state\.alliedAoePassed = state\.primaryDamage === unit\.attack/);
assert.match(gameSource, /building\.unitCharge = charge/);
assert.match(gameSource, /actor\.charging \? 'charge' : 'move'/);
assert.match(gameSource, /attackWithAdjacentBonus\([\s\S]*actor\.attack,[\s\S]*\) \* \(charge\?\.damageRatio \?\? 1\)/);
assert.match(gameSource, /target\.actor\.dizzinessRemaining = Math\.max/);
assert.match(gameSource, /actor\.charging = false/);
assert.match(gameSource, /actor\.speed = actor\.baseSpeed/);
assert.match(gameSource, /state\.rangedImpactPassed = state\.damageApplied === unit\.attack/);
assert.equal(createHash('sha256').update(readFileSync(new URL('../assets/resources/original/ui/hud_level_badge.png', import.meta.url))).digest('hex'), '508989fba0790bfe84d5830bfea7fed3010e3f58b12aef879fe334fc9a377a58');
assert.match(gameSource, /'original\/ui\/hud_level_badge', 641, 115, 70, 42/);
assert.match(gameSource, /'original\/ui\/hud_progress_bg', 39, 126, 610, 22/);
assert.match(gameSource, /'original\/ui\/hud_progress_fill', 42, 129, 0, 16/);
assert.match(gameSource, /private updateFightLevelHud\(\): void/);
assert.match(gameSource, /const width = 604 \* ratio/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-normal-transition'/);
assert.match(gameSource, /await this\.placeOpeningShopItem\(placement\.id, placement\.column, placement\.row\)/);
assert.match(gameSource, /data-cocos-normal-transition-smoke/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-normal-lifecycle'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-result-victory'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-result-defeat'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-stage-catalog'/);
assert.match(gameSource, /data-cocos-stage-catalog/);
assert.match(gameSource, /resources\.load\(path, JsonAsset/);
assert.match(gameSource, /this\.loadSpriteFrame\('original\/maps\/Map_Desert'\)/);
assert.match(gameSource, /this\.loadSpriteFrame\('original\/maps\/Map_Snowfield'\)/);
assert.match(gameSource, /Array\.from\(new Set\(stages\.reduce<string\[]>/);
assert.match(gameSource, /this\.kills \+= 1/);
assert.match(gameSource, /'ResultShade', 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT/);
assert.match(gameSource, /'ResultPanel',[\s\S]*105,[\s\S]*400,[\s\S]*540,[\s\S]*390/);
assert.match(gameSource, /victory \? '守城成功' : '城堡失守'/);
assert.match(gameSource, /victory \? `\$\{maxWave\} 波敌军已全部击退` : '调整建筑布局后重新挑战'/);
assert.match(gameSource, /`关卡 \$\{this\.stageId\} · 击退 \$\{this\.kills\} · 经验 \$\{this\.battleExperience\}`/);
assert.match(gameSource, /await this\.loadCampaignStage\(\)/);
assert.match(gameSource, /`original\/maps\/Map_\$\{this\.stageMapId\}`/);
assert.match(gameSource, /this\.waveCounts = stage\.waveEnemyCountsEffective\.slice\(\)/);
assert.match(gameSource, /this\.wavePowers = stage\.wavePower\.slice\(\)/);
assert.match(gameSource, /this\.eliteProbabilities = stage\.eliteProbability\.slice\(\)/);
assert.match(gameSource, /enemy: this\.enemyVisualBodiesForStage\(\)/);
assert.match(gameSource, /data-cocos-campaign-stage/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-campaign-stage-battle'/);
assert.match(gameSource, /data-cocos-campaign-battle/);
assert.match(gameSource, /const CAMPAIGN_STORAGE_KEY = 'shoucheng\.wx4f4f3709865004a2\.v3\.MaxStageRecord'/);
assert.match(gameSource, /const LOCAL_PROFILE_STORAGE_KEY = 'shoucheng\.wx4f4f3709865004a2\.v3\.LocalProfile'/);
assert.match(gameSource, /this\.localProfile = this\.loadLocalProfile\(\)/);
assert.match(gameSource, /this\.stageId = runtimeTest \? boundedStage : Math\.min\(boundedStage, unlockedStage\)/);
assert.match(gameSource, /applyCampaignBattleResult\([\s\S]*this\.campaignProgress,[\s\S]*this\.stageId,[\s\S]*victory/);
assert.match(gameSource, /window\.localStorage\.setItem\(LOCAL_PROFILE_STORAGE_KEY, JSON\.stringify\(profile\)\)/);
assert.match(gameSource, /window\.localStorage\.setItem\(CAMPAIGN_STORAGE_KEY, JSON\.stringify\(profile\.maxStageRecord\)\)/);
assert.match(gameSource, /runtimeTest !== 'cocos-campaign-persist-victory'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-campaign-meta'/);
assert.match(gameSource, /data-cocos-campaign-meta/);
assert.match(gameSource, /'进入作战'/);
assert.match(gameSource, /'波次宝箱'/);
assert.match(gameSource, /claimWaveChest\(this\.stageConfig as CampaignRewardStage/);
assert.match(gameSource, /data-cocos-campaign-claim/);
assert.match(gameSource, /url\.searchParams\.set\('screen', 'campaign'\)/);
assert.match(gameSource, /'主界面'/);
assert.match(gameSource, /campaign\.stageAdvanced/);
assert.match(gameSource, /'下一关'/);
assert.match(gameSource, /nextStageAvailable: hasNextStage/);
assert.match(gameSource, /nextStageDeferred: false/);
assert.match(gameSource, /url\.searchParams\.set\('stage', String\(this\.stageId \+ 1\)\)/);
assert.match(gameSource, /data-cocos-result/);
assert.match(gameSource, /url\.searchParams\.delete\('test'\)/);
assert.match(gameSource, /document\.documentElement\.removeAttribute\('data-cocos-result'\)/);
assert.match(gameSource, /visualBaselineTest === 'cocos-visual-drag'[\s\S]*'cocos-visual-prep'[\s\S]*'cocos-visual-wave-start'[\s\S]*'cocos-visual-combat'/);
assert.match(gameSource, /visualBaselineTest === 'cocos-visual-motion-t12'[\s\S]*visualBaselineTest === 'cocos-visual-motion-t18'/);
assert.match(gameSource, /const VISUAL_MOTION_WINDOWS:[\s\S]*offsetMs: -204[\s\S]*offsetMs: -102[\s\S]*offsetMs: 0[\s\S]*offsetMs: 102[\s\S]*offsetMs: 204/);
assert.match(gameSource, /private readVisualMotionOffsetMs\(\): -204 \| -102 \| 0 \| 102 \| 204/);
assert.match(gameSource, /evidenceReplayOnly: !!this\.visualMotionWindow/);
assert.match(gameSource, /this\.runtimeRandom = createSeededRandom\(20260824\)/);
assert.match(gameSource, /data-cocos-visual-baseline/);
assert.match(gameSource, /simulationCaptureTimeSeconds: targetClock/);
assert.match(gameSource, /'VisualDragHighlight'/);
assert.match(gameSource, /dragCandidate: phase === 'drag' \? \{ id: 'e16', level: 1, column: 3, row: 4, valid: true \} : null/);
assert.match(gameSource, /placeVisualBaselineBuilding\(shooterLevelTwo, 5, 6\)/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-repel-before'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-repel-after'/);
assert.match(gameSource, /data-cocos-repel-motion-smoke/);
assert.match(gameSource, /state\.elite\.displacementPixels - 120/);
assert.match(gameSource, /boss\.repel === null/);
assert.match(gameSource, /KNIGHT_CHARGE_TRAIT\.repelPhysicsUnitsPerSecond/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-attack-windup'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-attack-fire'/);
assert.match(gameSource, /this\.readRuntimeTestName\(\) === 'cocos-attack-recovery'/);
assert.match(gameSource, /data-cocos-attack-motion-smoke/);
assert.match(gameSource, /const captureSteps = phase === 'windup' \? 5 : phase === 'fire' \? unit\.attackFireFrame : 8/);
assert.match(gameSource, /attacker\.animator\.update\(intervalSeconds\)/);
assert.match(gameSource, /state\.target\.damageApplied === expectedDamage/);
assert.match(gameSource, /this\.visualBaselineFrozen \|\| this\.repelMotionFrozen \|\| this\.attackMotionFrozen/);
assert.match(gameSource, /\{ definition: shooterLevelOne, column: 1, row: 5 \}/);
assert.match(gameSource, /\{ definition: fenceLevelTwo, column: 3, row: 4 \}/);
assert.match(gameSource, /\{ definition: arrowLevelTwo, column: 3, row: 5 \}/);
assert.match(gameSource, /\{ definition: shooterLevelTwo \?\? null, column: 5, row: 5 \}/);
assert.match(gameSource, /this\.airSupportLayer\.active = false/);
assert.match(gameSource, /this\.installVisualBaselineActors\(phase\)/);
assert.match(gameSource, /\{ id: 'gb_E916AA75', x: 216\.899, y: 65\.331, action: 'move', frame: 8, flipped: true \}/);
assert.match(gameSource, /\{ id: 'js_9F2D53C8', x: 283\.537, y: 522\.648, action: 'move', frame: 1, flipped: false, hpRatio: 0\.12 \}/);
assert.match(gameSource, /\{ x: 474\.303, y: 836\.237, frame: 4, flipped: true \}/);
assert.match(gameSource, /this\.spawnDamageText\(260, 354, 30, Color\.WHITE\)/);
assert.match(gameSource, /evidenceFixedActorLayout: phase === 'wave-start' \|\| phase === 'combat'/);
assert.match(gameSource, /const targetClock = 0/);
assert.match(gameSource, /if \(this\.visualBaselineFrozen \|\| this\.repelMotionFrozen \|\| this\.attackMotionFrozen\) return/);
assert.match(gameSource, /this\.projectiles\.length > 0/);
assert.match(gameSource, /for \(const ally of this\.allies\) this\.setActorAction\(ally, 'idle'\)/);
assert.match(gameSource, /this\.actorLayer\.active = false/);
assert.match(gameSource, /void this\.rollShop\(false\)\.then/);
assert.match(gameSource, /else if \(this\.normalLifecycleSmoke\) this\.scheduleCombatDelay/);
assert.match(gameSource, /\{ id: 'e02', column: 1, row: 5 \}/);
assert.match(gameSource, /if \(this\.normalLifecycleSmoke\) await this\.deployLifecycleShopOffers\(\)/);
assert.match(gameSource, /if \(this\.normalLifecycleSmoke && this\.wave === 1\)/);
assert.match(gameSource, /while \(this\.treeNodes\.size > 0\)/);
assert.match(gameSource, /this\.tryClearTree\(column, row\)/);
assert.match(gameSource, /if \(synthesisTarget\) await this\.mergeBuildingInto\(synthesisTarget, item\.node, null, item\.definition\)/);
assert.match(gameSource, /state\.enemyDiagnostics = this\.enemies\.filter/);
assert.match(gameSource, /state\.projectileDiagnostics = this\.projectiles\.filter/);
assert.match(gameSource, /this\.lifecycleSmokeState\.projectiles = this\.projectiles\.length/);
assert.match(gameSource, /'building',\s*building\.definition\.rangePixels \?\? 0/);
assert.match(gameSource, /const LIFECYCLE_ADAPTER_COOLDOWN_SECONDS = 0\.1/);
assert.match(gameSource, /actor\.attackLockRemaining = attackActionDuration\(attackFrames\.length\)/);
assert.match(gameSource, /actor\.attackLockRemaining = advanceAttackActionLock\(actor\.attackLockRemaining, delta\)/);
assert.match(gameSource, /const steps = this\.normalLifecycleSmoke \? 30 : 1/);
assert.match(gameSource, /private scheduleCombatDelay\(callback: \(\) => void, seconds: number\): void/);
assert.match(gameSource, /if \(delayed\.remaining > 0\.000001\) continue/);
assert.match(gameSource, /this\.scheduleCombatDelay\(\(\) => \{[\s\S]*this\.targetIsAlive\(target\)/);
assert.match(gameSource, /this\.useAirSupport\('meteorite'\)/);

assert.match(spriteSequenceSource, /public getCurrentFrameIndex\(\): number/);
assert.match(spriteSequenceSource, /public getCurrentFrameName\(\): string \| null/);
assert.match(spriteSequenceSource, /public seek\(frameIndex: number\): void/);
assert.match(spriteSequenceSource, /public pause\(\): void/);

console.log(JSON.stringify({ passed: true, assertions: 1715, stage: 2, totalEnemies: 35, stageCatalog: 220, redEnemyFrames: 1016 }));
