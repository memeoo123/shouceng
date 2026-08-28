# Cocos restoration progress

## Confirmed

- Cocos Creator 3.8.8 project skeleton based on the installed official `empty-2d` template.
- Stage 2 design resolution is 750×1286 with fixed-width scaling.
- Forest background, tree, castle, opening-shop buildings, HUD/button art and HP bars are copied byte-for-byte from the recovered Laya asset output.
- Blue/red Swordsman1 and Shooter1 idle/move/attack/victory frame sets are present; frame interval is 102 ms.
- Stage 2 map, 3/4/7/9/12 wave counts, 975 castle HP, opening shop, obstacle prices and spawn delay bounds are encoded.
- Pure TypeScript tests cover dodge-before-critical, normal/critical damage, base HP, coin allocation, placement cells and terminal conditions.
- Creator generated 202 `.meta` records, the project checker reports 0 missing metadata and TypeScript passes against the generated Cocos configuration.
- The web-mobile build loads at 574×1036 with no browser console errors; zero-cost tree clearing, opening-shop drag/drop and combat presentation switching were exercised interactively.
- 169 critical source PNG/frame hashes were compared against the Laya reference output with 0 mismatches.

## Approximate

- `ShouchengGame` builds the preparation scene from exact resources and coordinates, supports tree clearing, shop drag/drop and the first combat presentation switch.
- First-wave actors play recovered move frames, but route steering, collision, attacks and wave completion are not wired into Cocos nodes yet.
- Text uses the Cocos system font until the recovered OPPOSansH font is imported and assigned.

## Missing

- Full five-wave runtime, target selection, projectile contacts, building damage/death and victory/retry UI.
- Wave-two shop return and battlefield-to-shop drag behavior.
- Building synthesis, traits, skills, air support and remaining 220-stage expansion.
- Pixel-diff comparison against all five reference timestamps; current evidence is a manual silhouette/geometry comparison.
