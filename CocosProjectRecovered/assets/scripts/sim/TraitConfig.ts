export type GeneralTraitEffectKey =
  | 'AllUnitAtk'
  | 'AllUnitHp'
  | 'EnemySpeedDown'
  | 'AllUnitAtkSpd'
  | 'ExpUp'
  | 'CoinsUp'
  | 'Coins'
  | 'RangedUnitAtkRange'
  | 'ShopQ2RateUp'
  | 'ShopFreeItem'
  | 'ShopConsume'
  | 'DmgUpWithCnt'
  | 'WinRewardUp'
  | 'BossDmgUp'
  | 'Interest'
  | 'RandLvUp';

export interface GeneralTraitDefinition {
  id: number;
  qualities: ReadonlyArray<number>;
  params: ReadonlyArray<number>;
  refreshWeights: ReadonlyArray<number>;
  stackType: 1 | 2 | 3 | 4;
  stackLimit: number;
  effectKey: GeneralTraitEffectKey;
}

export interface GeneralTraitChoice {
  type: 'general';
  id: number;
  quality: number;
  value: number;
  effectKey: GeneralTraitEffectKey;
}

// Recovered fn/fight/Params values.
export const BATTLE_CHOICE_REFRESH_COUNT = 10;
export const MAX_ALL_TRAIT_COUNT = 3;
export const STUDY_TRAIT_QUALITY_WEIGHTS: ReadonlyArray<number> = [80, 40, 20];

// Recovered fight_level table. Index zero is the threshold from fight level 0 to 1.
export const FIGHT_LEVEL_EXPERIENCE: ReadonlyArray<number> = [
  20, 24, 29, 35, 42, 50, 60, 72, 86, 104,
  124, 149, 179, 220, 260, 300, 340, 380, 420, 460,
  500, 540, 580, 620, 660, 700, 740, 780, 820, 860,
];

// Normalized from the shipped trait_general table.
export const GENERAL_TRAITS: ReadonlyArray<GeneralTraitDefinition> = [
  { id: 1, qualities: [1, 2, 3], params: [0.05, 0.1, 0.15], refreshWeights: [72, 21, 14], stackType: 1, stackLimit: 0, effectKey: 'AllUnitAtk' },
  { id: 2, qualities: [1, 2, 3], params: [0.05, 0.1, 0.15], refreshWeights: [72, 21, 14], stackType: 1, stackLimit: 0, effectKey: 'AllUnitHp' },
  { id: 3, qualities: [1, 2, 3], params: [0.05, 0.1, 0.15], refreshWeights: [72, 21, 14], stackType: 2, stackLimit: 0.5, effectKey: 'EnemySpeedDown' },
  { id: 4, qualities: [1, 2, 3], params: [0.05, 0.1, 0.15], refreshWeights: [72, 21, 14], stackType: 2, stackLimit: 1, effectKey: 'AllUnitAtkSpd' },
  { id: 5, qualities: [2, 3], params: [0.3, 0.5], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'ExpUp' },
  { id: 6, qualities: [2, 3], params: [2, 5], refreshWeights: [72, 21], stackType: 3, stackLimit: 0, effectKey: 'CoinsUp' },
  { id: 7, qualities: [1, 2, 3], params: [10, 20, 30], refreshWeights: [72, 21, 14], stackType: 4, stackLimit: 0, effectKey: 'Coins' },
  { id: 8, qualities: [1, 2, 3], params: [0.1, 0.15, 0.2], refreshWeights: [72, 21, 14], stackType: 1, stackLimit: 0, effectKey: 'RangedUnitAtkRange' },
  { id: 9, qualities: [2, 3], params: [0.05, 0.1], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'ShopQ2RateUp' },
  { id: 10, qualities: [2], params: [1], refreshWeights: [21], stackType: 3, stackLimit: 0, effectKey: 'ShopFreeItem' },
  { id: 11, qualities: [3], params: [0.2], refreshWeights: [14], stackType: 3, stackLimit: 0, effectKey: 'ShopConsume' },
  { id: 12, qualities: [2, 3], params: [0.01, 0.02], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'DmgUpWithCnt' },
  { id: 13, qualities: [2, 3], params: [0.1, 0.25], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'WinRewardUp' },
  { id: 14, qualities: [2, 3], params: [0.5, 1], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'BossDmgUp' },
  { id: 15, qualities: [2, 3], params: [0.1, 0.2], refreshWeights: [21, 14], stackType: 3, stackLimit: 0, effectKey: 'Interest' },
  { id: 16, qualities: [3], params: [1], refreshWeights: [14], stackType: 4, stackLimit: 0, effectKey: 'RandLvUp' },
];

function weightedIndex(weights: ReadonlyArray<number>, random: () => number): number {
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

export function availableGeneralTraits(active: ReadonlyArray<GeneralTraitChoice>): GeneralTraitChoice[] {
  const result: GeneralTraitChoice[] = [];
  for (const definition of GENERAL_TRAITS) {
    const sameId = active.filter((trait) => trait.id === definition.id);
    const stacked = sameId.reduce((sum, trait) => sum + trait.value, 0);
    if (definition.stackType === 2 && stacked >= definition.stackLimit) continue;
    if (definition.stackType === 4 && sameId.length > 0) continue;
    for (let index = 0; index < definition.qualities.length; index += 1) {
      const quality = definition.qualities[index];
      const value = definition.params[index];
      if (definition.stackType === 2 && stacked + value > definition.stackLimit) continue;
      if (definition.stackType === 3 && sameId.some((trait) => trait.quality === quality)) continue;
      result.push({ type: 'general', id: definition.id, quality, value, effectKey: definition.effectKey });
    }
  }
  return result;
}

export function rollGeneralTraitChoices(
  active: ReadonlyArray<GeneralTraitChoice>,
  random: () => number,
): GeneralTraitChoice[] {
  const available = availableGeneralTraits(active);
  const qualityValues = [1, 2, 3];
  const qualityWeights = [...STUDY_TRAIT_QUALITY_WEIGHTS];
  const rolledQualities: number[] = [];
  for (let count = 0; count < 3; count += 1) {
    const eligibleWeights = qualityWeights.map((weight, index) =>
      available.some((trait) => trait.quality === qualityValues[index]) ? weight : 0);
    const index = weightedIndex(eligibleWeights, random);
    if (index < 0) break;
    rolledQualities.push(qualityValues[index]);
    // The original removes quality 3 after it is rolled, so at most one legendary option appears.
    if (qualityValues[index] === 3) {
      qualityValues.splice(index, 1);
      qualityWeights.splice(index, 1);
    }
  }

  const choices: GeneralTraitChoice[] = [];
  for (const quality of rolledQualities) {
    const pool = available.filter((trait) => trait.quality === quality
      && !choices.some((choice) => choice.id === trait.id && choice.quality === trait.quality));
    const weights = pool.map((trait) => {
      const definition = GENERAL_TRAITS.find((entry) => entry.id === trait.id)!;
      const qualityIndex = definition.qualities.indexOf(trait.quality);
      return definition.refreshWeights[qualityIndex] ?? 0;
    });
    const index = weightedIndex(weights, random);
    if (index >= 0) choices.push(pool[index]);
  }
  return choices;
}

export function traitMultiplier(
  active: ReadonlyArray<GeneralTraitChoice>,
  effectKey: GeneralTraitEffectKey,
): number {
  return active.reduce(
    (multiplier, trait) => trait.effectKey === effectKey ? multiplier * (1 + trait.value) : multiplier,
    1,
  );
}

export function traitSum(
  active: ReadonlyArray<GeneralTraitChoice>,
  effectKey: GeneralTraitEffectKey,
): number {
  return active.reduce((sum, trait) => trait.effectKey === effectKey ? sum + trait.value : sum, 0);
}
