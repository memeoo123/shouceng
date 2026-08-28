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
| Golden cases | Pass | 8/8 damage, wave, base-HP and creation-interval cases |
| Asset import | Pass | 189 source assets, 0 missing `.meta`; 169 critical image/frame hashes compared, 0 mismatches |
| TypeScript | Pass | Creator-generated `temp/tsconfig.cocos.json`; project checker exit 0 |
| Preview/build | Pass | Creator web-mobile build completed; localhost preparation, drag, tree-clear and combat-transition smoke; browser console errors 0 |

## Fidelity matrix

| Area | Confirmed | Approximate | Missing | Next verification |
|---|---|---|---|---|
| Scene | 750×1286, 1623px Forest art, 337px phase shift, 7×9 Map2 grid, castle footprint | Cell stroke rendering and Cocos sprite sorting | Other stages | Pixel-diff Stage 2 prep at t=2 and t=7 |
| UI | Exact recovered HUD, shop, button, tree badge and HP art; opening item identities | System font and label metrics | Result/trait/air-support overlays | Import OPPOSansH and compare text bounds |
| Units | 160 exact Stage 2 blue/red frames, 102ms playback, 0.9 global scale | First-wave static spawn probe | Route, attack, hit and death node integration | Implement route and match t=12/t=18 |
| Combat | Dodge-before-critical, critical multiplier, base HP clamp, coin split and terminal predicates tested | None in the pure kernel | Cocos-node targeting, projectile/contact, damage/death lifecycle | Port one swordsman and one shooter end-to-end |
| Rounds | Stage 2 counts 3/4/7/9/12 and 83.333–166.667ms delay bounds | First wave currently displays three actors at once | Five-wave runtime and inter-wave preparation | Add scheduler and validate the production timing probe |
| Audio/effects | Source boundary retained | None | Audio, projectiles, damage text and effects | Import only after combat lifecycle passes |

## Visual evidence

- `evidence/cocos-stage2-preparation.png`
- `evidence/cocos-stage2-combat.png`
- `evidence/visual-golden-cases.json`

## Unresolved differences

| Severity | Difference | Evidence needed | Owner | Next action |
|---|---|---|---|---|
| High | Enemies do not yet route, attack or resolve wave completion | Stage 2 t=12/t=18 plus recovered route audits | Cocos port | Wire simulation events to actor nodes |
| High | Only the first combat presentation exists; waves 2–5 and result flow are absent | Representative five-wave lifecycle | Cocos port | Implement scheduler, cleanup and phase return |
| Medium | Font metrics differ from the Laya baseline | OPPOSansH import and t=2/t=7 captures | Cocos port | Import recovered TTF and assign labels |
| Medium | UI/grid pixel alignment has not been measured by image diff | Matched 574×1036 captures | Cocos port | Add deterministic capture times and compare |
| Low | Cocos build warns that the default main-bundle compression value is selected | Explicit web-mobile build profile | Build config | Persist the platform compression option |
