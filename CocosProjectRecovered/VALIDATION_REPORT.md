# VALIDATION_REPORT

## Baseline

- Target: `wx4f4f3709865004a2`, source package version 3
- Representative level: Stage 2 — 翠绿草原 / Forest / Map2
- Original reference: `../targets/wx4f4f3709865004a2/3/evidence/original-reference/QQ20260819-171433.mp4`
- Cocos version: Cocos Creator 3.8.8
- Resolution: 750×1286 fixed width; browser comparison viewport 574×1036

## Automated checks

| Check | Result | Evidence |
|---|---|---|
| Restore spec | Pass | `validate_restore_spec.py --require-ready`; no errors or warnings |
| Golden cases | Pass | 29/29 damage, wave, base-HP and creation/attack-interval cases; project suite has 1,715 assertions including campaign progression/profile rewards, the 220-stage catalog and byte equality for all 1,016 red enemy frames |
| Asset import | Pass | 1,500 source assets, 0 missing `.meta`; the byte-identical 220-stage/enemy/variant/map JSON catalog, exact Forest/Desert/Snowfield map images and all six red enemy families at visual levels 1–4 are imported |
| TypeScript | Pass | Creator-generated configuration; project TypeScript exits 0 with no project or declaration errors |
| Preview/build | Pass | Creator web-mobile release output refreshed at 2026-09-04 19:31:17. Multi-stage battle smoke remains green; browser lifecycle additionally verified Stage 1 victory `[1,0]→[2,0]`, Stage 220 lock-bounding, Stage 2 wave-2 defeat `[2,1]`, Stage 1/2 campaign selection, explicit 3/5-wave claims, locked 10-wave rejection and campaign-to-battle transition |

## Fidelity matrix

| Area | Confirmed | Approximate | Missing | Next verification |
|---|---|---|---|---|
| Scene | 750×1286, exact 1623px Forest/Desert/Snowfield art, runtime-bound 220-stage map grids/backgrounds, recovered bottom-up castle placement, 337px phase shift, 7×9 representative Map2 grid and castle footprint; normalized t02/t07/t12/t18 Stage 2 frame metrics captured | Cell stroke rendering and Cocos sprite sorting; ten adjacent Stage 2 frames average RGB MAE 0.067078 and edge IoU 0.181037 | Matched non-Stage-2 visual baselines | Capture representative Forest/Desert/Snowfield preparation and battle states |
| UI | Exact recovered HUD, shop, button, tree badge, HP and three air-support icons; original 610×22 `fightLvPrgs`, 604×16 experience fill and byte-identical 70×42 level badge; opening item identities, 1–4 field/shop synthesis visuals, source-slot consumption, bottom-docked support order and byte-identical OPPOSansH font; battle trait panel hides HUD and presents three choices; result states use the recovered dimmer, retry/unlock/next actions and campaign-entry `主界面`; campaign page selects unlocked stages and exposes three explicit reward milestones | Trait/result geometry lacks a same-state original screenshot; campaign page uses a Cocos-native functional arrangement around recovered map/button/font assets | Ad-backed trait refresh/get-all controls and the remaining four-tab meta shell | Compare result and campaign-page pixels when matched original references become available |
| Units | 1,016 exact red-team frames for six families and levels 1–4 plus the existing blue-team set, 102ms playback, recovered per-body action counts/fire frames and wave-power visual-level selection; Stage 220 runtime preloaded all 18 visual bodies it requires. Stage 2 t12/t18 stills match eight actor phases/facings; `Crossbowman1` ranged chain, optional `Knight1` charge and `Mage1` allied AOE are runtime-confirmed | Cocos node interpolation and facing snap; exact reference phase is ambiguous where candidate margins are low | Non-Stage-2 same-timestamp motion comparison | Capture normal higher-level enemy movement and attack against an original reference |
| Combat | Dodge-before-critical, critical multiplier, base HP clamp, target selection, swept arrows, ordinary dead-target continuation, projectile lifetimes/auto-flow, attack-state unlock at the recovered action-frame duration even if a one-shot animation callback is dropped, opposing-team 100-pixel Mage AOE, recovered Trebuchet locked-target throw with 60 primary/30 secondary/0 outside runtime result, recovered Electricity Tower locked-target light projectile with 40 primary/40 first-jump/0 outside runtime result, recovered Mirror Tower laser with 20 immediate/160 total damage over eight hits and exact weapon-to-target connection, active-only multiplicatively stacked `Building_Well` enemy movement divisors with measured level-1 ratio 0.952381, active-only global `Building_ObservationDeck` critical bonuses applied to defense weapons and allied units with controlled tower 30/20 and unit 60/30 critical/normal damage, active-only adjacent `Building_Statue` speed bonuses dividing tower/barracks cooldowns from 2/9 to 1.904762/8.571429, active-only adjacent `Building_MartialArtsField` attack bonuses changing tower damage 20→21 and allied unit damage 30→31 while retaining 5% at levels 1–4 because of the shipped synthesis-key mismatch, targetable horizontal three-cell `Building_Fence2` with recovered 507 base HP and ordinary 30-damage enemy hit reducing it to 477, boss collider exemption/AOE, damage labels, elite/boss repel state, Boss resist, optional cavalry charge consumption/repel/dizziness, generic `deadInLast`/force-target kernel, meteorite/healing/freeze entry and exact locally available FairyGUI per-target effect sequences | Melee contact resolves at the fire frame; swept contact substitutes native Box2D callback order; electricity projectile uses a close Cocos tint instead of the exact Laya additive color matrix | Normal-timing feedback capture and unavailable full-screen `Effects_*` overlays | Defer lazy/network-only overlays; do not invent missing resources |
| Rounds/economy | Stage 2 counts 3/4/7/9/12, elite probabilities, deterministic final boss, 83.333–166.667ms delays, five-wave scheduler, projectile-drained wave completion, surviving-ally preservation, ordinary inter-wave shop reroll, reusable preparation drag handler, exact 10-coin-per-wave allocation, 0–5 obstacle price progression, five-wave 50-coin economy smoke, recovered 2/4/6/8 barracks summon caps, active-only `Building_ShuiJing` experience bonuses of 5%/10%/20%/40% with separate result/fight-level rounding paths, active-surviving `Building_Mine` non-final-wave payouts of 1/2/4/8 coins with runtime progression 10→11→11→19→19, shop refresh with exact `887/100/13` type weights, and the 30-threshold/16-definition general-trait selection path. Normal-value runtime now confirms the complete 1→5 lifecycle: input-only automation uses recovered tree prices, production placement/synthesis and visible trait choices; final wave spawned/resolved 12/12, castle HP remained 975 and victory completed with zero runtime errors. | The deterministic automated preparation strategy is not a guarantee that every arbitrary player layout wins; network/ad requests for special shop and trait auxiliary actions use local gates or remain deferred | Manual matched-timing five-wave capture | Record a matched manual play capture when presentation comparison resumes |
| Audio/effects | Exact air-support projectile, artillery hit, healing and freeze MovieClips with source offsets/pivots/scales; exact level-specific 15-frame Mirror Tower Laser1–Laser4 MovieClips at 83ms with recovered canvas offsets | None | Audio and locally absent full-screen `Effects_*` overlays | Defer network-only resources per scope |

## Visual evidence

- `evidence/cocos-stage2-drag.png`
- `evidence/cocos-stage2-preparation.png`
- `evidence/cocos-stage2-combat.png`
- `evidence/cocos-stage2-wave-start.png`
- `evidence/COCOS_VISUAL_CAPTURE_ROUTES.json`
- `evidence/COCOS_VISUAL_DIFF.json`
- `evidence/COCOS_ORIGINAL_MOTION_WINDOWS.json`
- `evidence/original-motion-windows/t12-m204.png` through `t18-p204.png`
- `evidence/COCOS_MOTION_WINDOW_CAPTURES.json`
- `evidence/COCOS_MOTION_WINDOW_DIFF.json`
- `evidence/COCOS_MOTION_WINDOW_BUILD.json`
- `evidence/cocos-motion-windows/cocos-motion-t12-m204.png` through `cocos-motion-t18-p204.png`
- `evidence/visual-golden-cases.json`
- `evidence/COCOS_NORMAL_TRANSITION_SMOKE.json`
- `evidence/COCOS_REPEL_MOTION_SMOKE.json`
- `evidence/cocos-repel-before.png`
- `evidence/cocos-repel-after.png`
- `evidence/COCOS_ATTACK_MOTION_SMOKE.json`
- `evidence/cocos-attack-windup.png`
- `evidence/cocos-attack-fire.png`
- `evidence/cocos-attack-recovery.png`
- `evidence/COCOS_RESULT_OVERLAY_SMOKE.json`
- `evidence/COCOS_RESULT_BUILD.json`
- `evidence/cocos-result-victory-574x1036.png`
- `evidence/cocos-result-defeat-574x1036.png`
- `evidence/cocos-result-retry-574x1036.png`
- `evidence/COCOS_STAGE_CATALOG_SMOKE.json`
- `evidence/COCOS_STAGE_CATALOG_BUILD.json`
- `evidence/COCOS_CAMPAIGN_META_SMOKE.json`

## Unresolved differences

| Severity | Difference | Evidence needed | Owner | Next action |
|---|---|---|---|---|
| Low | Exact local per-target FairyGUI effects are restored, but code-referenced full-screen `Effects_MeteorSwarm`/`Effects_Frozen`/`Effects_Rebleeding` are not present in recovered binaries/atlases | Newly cached lazy/network package containing those item URLs | Cocos port | Keep deferred until local evidence exists; do not synthesize substitutes |
| Medium | The reference-matched t12/t18 anchors and all ten adjacent evidence-replay frames now render at the measured states. Thirty-four reliable adjacent-frame actor pairs have 0px maximum per-axis center delta, with average RGB MAE `0.067078` and edge IoU `0.181037`. The replay is intentionally not the production simulation, and several overlapped/occluded phase candidates remain ambiguous | Same-timestamp production-path Cocos capture; higher-margin evidence for ambiguous phase samples | Cocos port | Compare a normal-simulation window without modifying production timing from evidence-replay states |
| Low | Cocos build warns that the default main-bundle compression value is selected | Explicit web-mobile build profile | Build config | Persist the platform compression option |
| Low | Electricity projectile color uses Cocos tint `[125,230,255,255]` rather than the recovered Laya additive color-filter matrix | A small custom material/shader reproducing the matrix | Cocos port | Restore only from the recovered matrix; validate against a matched projectile frame |
| Low | Result overlay geometry/colors and local retry match the recovered Laya baseline, but no original victory/defeat screenshot is available | Matched original result capture | Cocos port | Retain the recovered local retry while adding separately validated campaign navigation |
| Medium | The functional Cocos campaign page and exact offline reward rules are connected, but the original five-tab FairyGUI shell and matched Cocos meta-page geometry are not yet ported | Matched original meta-page screenshot plus the remaining locally recovered package layouts | Cocos port | Port the remaining offline tabs without enabling network/ad/payment branches, then compare the campaign page |
