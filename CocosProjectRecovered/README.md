# 这座城我守定了 — Cocos reconstruction

This is an independent Cocos Creator 3.8.8 port. The existing Laya project remains the behavioral and visual reference.

## Open

Open this directory with Cocos Creator 3.8.8. After the first asset import, open `assets/scenes/Main.scene` and run the web-mobile preview.

## Validate without Creator

```powershell
npm test
python "C:\Users\jiachengwei\.codex\skills\cocos-minigame-restorer\scripts\validate_restore_spec.py" RESTORE_SPEC.json --require-ready
python "C:\Users\jiachengwei\.codex\skills\cocos-minigame-restorer\scripts\run_golden_cases.py" golden-cases.json
```

See `RESTORE_PROGRESS.md` for the exact confirmed, approximate and missing boundaries.
