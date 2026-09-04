export type CampaignProgress = [stage: number, completedWave: number];

export type RewardKind = 'Prop' | 'Item';
export type RewardEntry = [kind: RewardKind, id: string, count: number];

export interface CampaignRewardStage {
  id: number;
  declaredWave: number;
  rewardWave: number[];
  chestRewards: unknown[][];
}

export interface LocalProfile {
  version: 2;
  maxStageRecord: CampaignProgress;
  waveChests: Record<string, 1>;
  props: Record<string, number>;
  items: Record<string, number>;
}

export interface WaveChestState {
  eligible: boolean;
  unlocked: boolean;
  claimed: boolean;
  milestone: number;
  key: string;
  rewards: RewardEntry[];
  error: 'ParamsError' | 'BoxHasBeenObtained' | 'StageUnlock' | 'WaveNotEnough' | null;
}

export interface WaveChestClaim {
  ok: boolean;
  error: WaveChestState['error'];
  state: WaveChestState;
  rewards: RewardEntry[];
  profile: LocalProfile;
}

export const CHEST_REWARD_ADDITIONS: Readonly<Record<string, number>> = {
  Diamond: 0,
  Stamina: 5,
};

export interface CampaignBattleResult {
  before: CampaignProgress;
  after: CampaignProgress;
  stageAdvanced: boolean;
  unlockedStage: number;
}

export function normalizeCampaignProgress(value: unknown): CampaignProgress {
  let candidate: unknown = value;
  if (!Array.isArray(candidate) && candidate && typeof candidate === 'object') {
    candidate = (candidate as { maxStageRecord?: unknown }).maxStageRecord;
  }
  const record = Array.isArray(candidate) ? candidate : [];
  const stage = Math.max(1, Math.trunc(Number(record[0]) || 1));
  const completedWave = Math.max(0, Math.trunc(Number(record[1]) || 0));
  return [stage, completedWave];
}

export function campaignUnlockedStage(value: unknown, stageCount: number): number {
  const [stage] = normalizeCampaignProgress(value);
  return Math.max(1, Math.min(Math.max(1, Math.trunc(stageCount)), stage));
}

export function campaignProgressAfterBattle(
  value: unknown,
  stage: number,
  wave: number,
  maximumWave: number,
  victory: boolean,
): CampaignProgress {
  const progress = normalizeCampaignProgress(value);
  const stageId = Math.max(1, Math.trunc(Number(stage) || 1));
  const maxWave = Math.max(1, Math.trunc(Number(maximumWave) || 1));
  const completedWave = victory
    ? maxWave
    : Math.max(0, Math.min(maxWave, Math.trunc(Number(wave) || 0) - 1));
  if (stageId < progress[0]) return progress;
  if (stageId >= progress[0] && completedWave >= maxWave) return [progress[0] + 1, 0];
  if (stageId === progress[0] && completedWave > progress[1]) return [progress[0], completedWave];
  return progress;
}

export function applyCampaignBattleResult(
  value: unknown,
  stage: number,
  wave: number,
  maximumWave: number,
  victory: boolean,
  stageCount: number,
): CampaignBattleResult {
  const before = normalizeCampaignProgress(value);
  const after = campaignProgressAfterBattle(before, stage, wave, maximumWave, victory);
  return {
    before,
    after,
    stageAdvanced: after[0] > before[0],
    unlockedStage: campaignUnlockedStage(after, stageCount),
  };
}

function normalizeCounts(value: unknown): Record<string, number> {
  const result: Record<string, number> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const source = value as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    const raw = source[key];
    const count = Math.max(0, Math.trunc(Number(raw) || 0));
    if (key && count > 0) result[key] = count;
  }
  return result;
}

export function normalizeLocalProfile(value: unknown, legacyProgress?: unknown): LocalProfile {
  const source = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const waveChests: Record<string, 1> = {};
  const sourceChests = source.waveChests;
  if (sourceChests && typeof sourceChests === 'object' && !Array.isArray(sourceChests)) {
    const chestFlags = sourceChests as Record<string, unknown>;
    for (const key of Object.keys(chestFlags)) {
      const claimed = chestFlags[key];
      if (/^WaveChest_\d+_\d+$/.test(key) && claimed) waveChests[key] = 1;
    }
  }
  return {
    version: 2,
    maxStageRecord: normalizeCampaignProgress(source.maxStageRecord ?? legacyProgress),
    waveChests,
    props: normalizeCounts(source.props),
    items: normalizeCounts(source.items),
  };
}

export function waveChestRecordKey(stageId: number, bundleIndex: number): string {
  return `WaveChest_${Math.trunc(Number(stageId) || 0)}_${Math.trunc(Number(bundleIndex) || 0)}`;
}

export function effectiveWaveChestRewards(
  stage: CampaignRewardStage,
  bundleIndex: number,
  additions: Readonly<Record<string, number>> = CHEST_REWARD_ADDITIONS,
  staminaEnabled = true,
): RewardEntry[] {
  const source = stage.chestRewards[Math.trunc(Number(bundleIndex) || 0)];
  if (!Array.isArray(source)) return [];
  return source.reduce<RewardEntry[]>((rewards, entry) => {
    if (!Array.isArray(entry) || entry.length < 3) return rewards;
    const kind = entry[0];
    const id = entry[1];
    if ((kind !== 'Prop' && kind !== 'Item') || typeof id !== 'string' || !id) return rewards;
    let count = Math.max(0, Math.trunc(Number(entry[2]) || 0));
    if (kind === 'Prop' && id === 'Stamina') {
      if (!staminaEnabled) return rewards;
      count = Math.max(1, count + (Number(additions.Stamina) || 0));
    } else if (kind === 'Prop' && id === 'Diamond') {
      count = Math.max(1, count + (Number(additions.Diamond) || 0));
    }
    if (count > 0) rewards.push([kind, id, count]);
    return rewards;
  }, []);
}

export function waveChestState(stage: CampaignRewardStage, bundleIndex: number, profileValue: unknown): WaveChestState {
  const index = Math.trunc(Number(bundleIndex));
  if (index < 0 || index >= stage.rewardWave.length) {
    return {
      eligible: false, unlocked: false, claimed: false, milestone: 0,
      key: waveChestRecordKey(stage.id, index), rewards: [], error: 'ParamsError',
    };
  }
  const profile = normalizeLocalProfile(profileValue);
  const milestone = Number(stage.rewardWave[index]) || 0;
  const unlocked = stage.id < profile.maxStageRecord[0]
    || (stage.id === profile.maxStageRecord[0] && milestone <= profile.maxStageRecord[1]);
  const key = waveChestRecordKey(stage.id, index);
  const claimed = !!profile.waveChests[key];
  return {
    eligible: unlocked && !claimed,
    unlocked,
    claimed,
    milestone,
    key,
    rewards: effectiveWaveChestRewards(stage, index),
    error: claimed ? 'BoxHasBeenObtained' : unlocked ? null : stage.id > profile.maxStageRecord[0] ? 'StageUnlock' : 'WaveNotEnough',
  };
}

export function claimWaveChest(stage: CampaignRewardStage, bundleIndex: number, profileValue: unknown): WaveChestClaim {
  const profile = normalizeLocalProfile(profileValue);
  const state = waveChestState(stage, bundleIndex, profile);
  if (!state.eligible) return { ok: false, error: state.error, state, rewards: [], profile };
  const next = normalizeLocalProfile(profile);
  for (const [kind, id, count] of state.rewards) {
    const target = kind === 'Prop' ? next.props : next.items;
    target[id] = (target[id] || 0) + count;
  }
  next.waveChests[state.key] = 1;
  return {
    ok: true,
    error: null,
    state: { ...state, eligible: false, claimed: true, error: 'BoxHasBeenObtained' },
    rewards: state.rewards.map((entry) => [...entry] as RewardEntry),
    profile: next,
  };
}
