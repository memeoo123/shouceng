(function () {
  "use strict";

  const DESIGN_WIDTH = 750;
  const DESIGN_HEIGHT = 1286;
  const SHOP_SCENE_SHIFT = 337;
  const SHOP_BENCH_TOP = 940;
  const SHOP_BENCH_BOTTOM = 1165;
  const CAPTURE_MODE = new URLSearchParams(window.location.search).get("capture") === "1";
  const CELL_SIZE = 92;
  const CELL_GAP = 3;
  const CELL_STEP = CELL_SIZE + CELL_GAP;
  const GRID_X = 44;
  const GRID_Y = 97;
  const COLS = 7;
  const ROWS = 9;
  const PHYSICS_PIXEL_RATIO = 50;
  const UNIT_SPEED_RADIO = 1.25;
  // Recovered from BattleGlobalConfig.unitGScale. UnitModel keeps each JTA
  // movie clip's native dimensions and applies this scale to the whole unit.
  const UNIT_GLOBAL_SCALE = 0.9;
  const ROUTE_RANDOM_MIN_MS = 1500;
  const ROUTE_RANDOM_MAX_MS = 2400;
  const ROUTE_RANDOM_MIN_ANGLE = 0.2;
  const ROUTE_RANDOM_MAX_ANGLE = 0.6;
  const ROUTE_MAP_LEFT = 50;
  const ROUTE_MAP_RIGHT = DESIGN_WIDTH - 50;
  const ENEMY_ROUTE_SEARCH_RANGE = 600;
  // Recovered from BaseUnit.unitColliderSize in the authorized runtime.
  const UNIT_HITBOX_WIDTH = 50;
  const UNIT_HITBOX_HEIGHT = 80;
  // Recovered from BaseUnit.unitColliderXYR.radius. UnitRoute uses the scaled
  // circle radius for same-team contact force; this is separate from hitBox.
  const UNIT_ROUTE_COLLIDER_RADIUS = 50;
  const MAX_SYNTH_LEVEL = 4;
  const DATA_URLS = [
    "data/stages.json",
    "data/buildings.json",
    "data/units.json",
    "data/enemies.json",
    "data/enemy-variants.json",
    "data/fight-params.json",
    "data/fight-levels.json",
    "data/general-traits.json",
    "data/equipment-traits.json",
    "data/equipment-upgrades.json",
    "data/tech.json",
    "data/unit-animations.json",
    "data/asset-manifest.json",
    "data/meta-ui-manifest.json",
    "data/slot-shapes.json"
  ];
  const UI = {
    shop: "res/shop_panel.png",
    money: "res/money.png",
    ad: "res/ad.png",
    tree: "res/tree.png",
    arrow: "res/bullet_arrow.png",
    blueButton: "res/button_blue.png",
    grayButton: "res/button_gray.png",
    greenButton: "res/button_green.png",
    orangeButton: "res/button_orange.png",
    pause: "res/hud_pause.png",
    progressBack: "res/hud_progress_bg.png",
    progressFill: "res/hud_progress_fill.png",
    levelBadge: "res/hud_level_badge.png",
    speed: "res/hud_speed.png",
    counterBack: "res/hud_counter_bg.png",
    priceTag: "res/price_tag_bg.png",
    kills: "res/kills.png",
    homeHpBack: "res/home_hp_bar_bg.png",
    homeHpFill: "res/home_hp_bar.png",
    homeHpIcon: "res/home_hp_icon.png",
    buildHpBack: "res/build_hp_bar_bg.png",
    buildHpFill: "res/build_hp_bar.png",
    enemyHpBack: "res/enemy_hp_bar_bg.png",
    enemyHpFill: "res/enemy_hp_bar.png",
    airHealing: "res/airsupport_healing.png",
    airFreeze: "res/airsupport_freeze.png",
    airMeteorite: "res/airsupport_meteorite.png"
  };
  const AIR_SUPPORT_SKILLS = [
    { id: "meteorite", name: "陨石", icon: UI.airMeteorite },
    { id: "healing", name: "治疗", icon: UI.airHealing },
    { id: "freeze", name: "冻结", icon: UI.airFreeze }
  ];
  const SHOP_ORDER = [
    "e02", "e07", "e16",
    "e01", "e03", "e04",
    "e05", "e06", "e08",
    "e09", "e10", "e11",
    "e12", "e13", "e14",
    "e15", "e17", "e18"
  ];
  // Confirmed in the original ModelPoint.getWeaponPos table.
  const WEAPON_MOUNTS = {
    Building_ArrowTower: { x: 0.5, y: 0.7, pivot: [0, 0.5] },
    Building_ElectricityTower: { x: 0.5, y: 0.1, pivot: [0.45, 0.5] },
    Building_MirrorTower: { x: 0.5, y: 0.05, pivot: [0.5, 0.5] },
    Building_Trebuchet: { x: 0.5, y: 0.1, pivot: [0.88, 0.5] }
  };

  function setTopLeft(node, x, y, width, height) {
    node.pos(x, y);
    node.size(width, height);
    return node;
  }

  function addImage(parent, skin, x, y, width, height, name) {
    const image = new Laya.Image(skin);
    image.name = name || "Image";
    setTopLeft(image, x, y, width, height);
    image.mouseEnabled = false;
    parent.addChild(image);
    return image;
  }

  function addLabel(parent, text, x, y, width, height, fontSize, align) {
    const label = new Laya.Label(text);
    setTopLeft(label, x, y, width, height);
    label.font = "OPPOSansH, Microsoft YaHei, sans-serif";
    label.fontSize = fontSize;
    label.color = "#ffffff";
    label.align = align || "center";
    label.valign = "middle";
    label.bold = true;
    label.stroke = Math.max(1, Math.round(fontSize * 0.075));
    label.strokeColor = "#241a0c";
    label.mouseEnabled = false;
    parent.addChild(label);
    return label;
  }

  function addRect(parent, x, y, width, height, color, alpha, name) {
    const sprite = new Laya.Sprite();
    sprite.name = name || "Rect";
    setTopLeft(sprite, x, y, width, height);
    sprite.graphics.drawRect(0, 0, width, height, color);
    sprite.alpha = alpha === undefined ? 1 : alpha;
    sprite.mouseEnabled = false;
    parent.addChild(sprite);
    return sprite;
  }

  function distance(left, right) {
    const dx = left.x - right.x;
    const dy = left.y - right.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function parseShape(value) {
    const rows = String(value || "x").split(/\r?\n|\|/);
    const width = Math.max(...rows.map((row) => row.length));
    const cells = [];
    rows.forEach((row, y) => {
      for (let x = 0; x < width; x += 1) if (row[x] === "x") cells.push([x, y]);
    });
    return { rows, cells, width, height: rows.length };
  }

  function seededRandom(seedValue) {
    let seed = Math.trunc(seedValue);
    return function random() {
      seed = (9301 * seed + 49297) % 233280;
      return seed / 233280;
    };
  }

  function shuffled(values, random) {
    const result = values.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      const temporary = result[index];
      result[index] = result[target];
      result[target] = temporary;
    }
    return result;
  }

  function weightedIndex(weights, random) {
    const positive = weights.map((weight) => Math.max(0, Number(weight) || 0));
    const total = positive.reduce((sum, weight) => sum + weight, 0);
    if (total <= 0) return 0;
    let value = random() * total;
    for (let index = 0; index < positive.length; index += 1) {
      value -= positive[index];
      if (value < 0) return index;
    }
    return positive.length - 1;
  }

  class ShouchengGame {
    constructor(content) {
      this.content = content;
      this.assetSet = new Set(content.assets);
      this.stages = content.stages;
      this.buildingRows = content.buildings;
      this.units = content.units;
      this.fightParams = content.fightParams;
      this.fightLevels = content.fightLevels || [];
      this.generalTraits = content.generalTraits || [];
      this.equipmentTraits = content.equipmentTraits || [];
      this.equipmentUpgrades = content.equipmentUpgrades || {};
      this.techRows = content.techRows || {};
      this.unitAnimations = content.unitAnimations || {};
      this.metaUiManifest = content.metaUiManifest || { packages: [], assets: [] };
      this.slotShapes = content.slotShapes || [];
      const query = new URLSearchParams(window.location.search);
      this.debugUi = query.get("debug") === "1";
      this.testMode = query.get("test") || "";
      this.metaMode = !this.debugUi && (!this.testMode || this.testMode === "meta") && query.get("battle") !== "1";
      this.campaignStorageKey = "shoucheng.wx4f4f3709865004a2.v3.MaxStageRecord";
      this.profileStorageKey = "shoucheng.wx4f4f3709865004a2.v3.LocalProfile";
      this.localProfile = this.loadLocalProfile();
      this.campaignProgress = this.localProfile.maxStageRecord.slice();
      this.techEffects = this.evaluateTechEffects(this.localProfile);
      this.unitById = Object.fromEntries(this.units.map((unit) => [unit.id, unit]));
      this.buildingRowById = Object.fromEntries(this.buildingRows.map((building) => [building.id, building]));
      const testEquipmentLoadout = this.testMode === "equipment-runtime"
        ? "e01:1,2,3,4,5,6,7,8,9,108;e06:46,47,48,49,50,51,52,53,54,108;e07:55,56,57,58,59,60,61,63,100,103;e08:64,65,66,67,69,70,71,72,101,109;e14:104"
        : this.testMode === "equipment-status-runtime"
          ? "e03:21,23,27;e05:39,41,43,45;e07:61,100;e08:66,69,71,101;e09:77;e10:86;e12:96,97"
          : this.testMode === "equipment-secondary-runtime"
            ? "e02:16,18;e03:25;e06:50,52;e07:59"
            : this.testMode === "equipment-projectile-runtime"
              ? "e02:12,14;e04:30,32,34;e06:48;e09:75,79,81;e10:84,88"
            : "";
      this.equipmentLoadoutRejected = [];
      this.equipmentLoadout = this.parseEquipmentLoadout(query.get("equipment") || testEquipmentLoadout);
      this.equipmentScenePolicy = this.evaluateEquipmentTraits(
        Object.values(this.equipmentLoadout).reduce((ids, current) => ids.concat(current), []),
        1
      ).scene;
      const directBattleTest = !!this.testMode && this.testMode !== "meta";
      const defaultStage = directBattleTest ? 2 : Math.min(this.stages.length, this.campaignProgress[0]);
      const requestedStage = Number(query.has("stage") ? query.get("stage") : defaultStage);
      const requestedStageId = clamp(Number.isFinite(requestedStage) ? Math.trunc(requestedStage) : defaultStage, 1, this.stages.length);
      this.stageId = this.debugUi || directBattleTest
        ? requestedStageId
        : Math.min(requestedStageId, this.campaignUnlockedStage());
      this.stageConfig = this.stages[this.stageId - 1];
      this.baseMapData = this.stageConfig.mapData.slice();
      this.mapData = this.baseMapData.slice();
      this.waveCounts = this.stageConfig.waveEnemyCountsEffective;
      this.maxWave = this.waveCounts.length;
      this.mainBase = this.buildingRowById.e19;
      this.buildingDefinitions = {};
      for (const row of this.buildingRows) this.buildingDefinitions[row.id] = this.makeBuildingDefinition(row, 1);

      this.root = new Laya.Sprite();
      this.root.name = "ShouchengFunctionalRoot";
      this.root.size(DESIGN_WIDTH, DESIGN_HEIGHT);
      Laya.stage.addChild(this.root);

      this.occupied = Array.from({ length: COLS }, () => Array(ROWS).fill(0));
      this.buildings = [];
      this.enemies = [];
      this.allies = [];
      this.projectiles = [];
      this.combatEvents = [];
      this.damageTexts = [];
      this.effects = [];
      this.airSupportEvents = [];
      this.airSupportButtons = {};
      this.airSupportUsed = new Set();
      this.airSupportAudit = null;
      this.treeBadges = [];
      this.treesByCell = new Map();
      this.floorCells = new Map();
      this.shopItems = [];
      this.drag = null;
      this.buildNotRecover = false;
      this.nextBuildingId = 1;
      this.nextActorId = 1;
      this.shopPage = 0;
      this.shopLevel = 1;
      this.autoBattle = false;
      this.statePublishClock = 0;
      this.buildScene();
      Laya.stage.on(Laya.Event.CLICK, this, this.handleStageTreeClick);
      this.resetRun();
      const requestedCatalogPage = Number(query.get("catalog") || 1);
      if (this.debugUi && Number.isFinite(requestedCatalogPage)) {
        const pageCount = Math.ceil(SHOP_ORDER.length / 3);
        this.shopPage = clamp(Math.trunc(requestedCatalogPage) - 1, 0, pageCount - 1);
        this.configureShopPage();
      }
      Laya.timer.frameLoop(1, this, this.update);
      window.__SHOUCHENG_GAME__ = this;

      const testMode = this.testMode;
      this.testStageBattleSweep = testMode === "stage-battle-sweep";
      this.testFastBattle = testMode === "battle" || this.testStageBattleSweep;
      if (testMode === "1") this.installTestHarness();
      if (testMode === "layout" || testMode === "battle" || testMode === "visual-battle" || testMode === "visual-wave-start" || testMode === "visual-combat") this.installRepresentativeLayout();
      if (testMode === "visual-drag") this.installVisualDragCase();
      if (testMode === "visual-consumed-shop") this.installConsumedShopVisualCase();
      if (testMode === "visual-wave-start") this.installVisualWaveStartCase();
      if (testMode === "visual-combat") this.installVisualCombatCase();
      if (testMode === "visual-battle") {
        this.startFight();
        this.speed = 8;
      }
      if (testMode === "battle") {
        this.autoBattle = true;
        this.startFight();
        this.speed = 48;
        this.speedButton.getChildAt(0).text = "×48";
      }
      if (this.testStageBattleSweep) {
        this.installStageBattleSweepLayout();
        this.autoBattle = true;
        this.startFight();
        this.speed = 96;
        this.speedButton.getChildAt(0).text = "×96";
      }
      if (testMode === "all-stages" || testMode === "smoke") this.runCatalogSmoke(testMode === "all-stages");
      if (testMode === "all-stage-rosters") this.runAllStageRosterAudit();
      if (testMode === "all-stage-init") this.runAllStageInitializationAudit();
      if (testMode === "all-stage-rewards") this.runAllStageRewardMetadataAudit();
      if (testMode === "wave-timing") this.runWaveTimingSmoke();
      if (testMode === "spawn-positions") this.runEnemySpawnPositionSmoke();
      if (testMode === "unit-route-collider") this.runUnitRouteColliderSmoke();
      if (testMode === "unit-route-targeting") this.runUnitRouteTargetingSmoke();
      if (testMode === "unit-route-target-cache") this.runUnitRouteTargetCacheSmoke();
      if (testMode === "unit-route-player") {
        try {
          this.runPlayerUnitRouteSmoke();
        } catch (error) {
          const result = { ok: false, error: String(error), stack: error && error.stack };
          document.body.dataset.restorePlayerUnitRouteSmoke = JSON.stringify(result);
          console.error("[Shoucheng PlayerUnit route smoke failed]", error);
        }
      }
      if (testMode === "unit-route-search-range") this.runUnitRouteSearchRangeSmoke();
      if (testMode === "projectile-travel-timing") this.runProjectileTravelTimingSmoke();
      if (testMode === "projectile-auto-flow") this.runProjectileAutoFlowSmoke();
      if (testMode === "player-projectile-contact") this.runPlayerProjectileContactSmoke();
      if (testMode === "projectile-dead-in-last") this.runProjectileDeadInLastSmoke();
      if (testMode === "campaign-progression") this.runCampaignProgressionSmoke();
      if (testMode === "local-profile") this.runLocalProfileRewardSmoke();
      if (testMode === "build-weapon-targeting") this.runBuildWeaponTargetingSmoke();
      if (testMode === "enemy-projectile-runtime") this.runEnemyProjectileRuntimeSmoke();
      if (testMode === "all-enemies") this.runEnemyMechanicsSmoke();
      if (testMode === "unit-actions") this.runUnitAnimationSmoke();
      if (testMode === "ally-hp-bar") this.runAllyHealthBarSmoke();
      if (testMode === "defeat-retry") this.runDefeatRetrySmoke();
      if (testMode === "economy-rewards") this.runEconomyRewardSmoke();
      if (testMode === "shop") this.runShopSmoke();
      if (testMode === "wave-two-drag") this.runWaveTwoDragSmoke();
      if (testMode === "shop-return") this.runShopReturnSmoke();
      if (testMode === "placement-rules") this.runPlacementRuleSmoke();
      if (testMode === "all-shop-visuals") this.runAllShopVisualAudit();
      if (testMode === "shop-free-item") this.runShopFreeItemSmoke();
      if (testMode === "all-buildings") this.runBuildingMechanicsSmoke();
      if (testMode === "equipment-traits") this.runEquipmentTraitNumericSmoke();
      if (testMode === "equipment-events") this.runEquipmentTraitEventSmoke();
      if (testMode === "equipment-runtime") this.runEquipmentRuntimeSmoke();
      if (testMode === "air-support") this.runAirSupportSmoke();
      if (testMode === "equipment-status-runtime") this.runEquipmentStatusRuntimeSmoke();
      if (testMode === "equipment-secondary-runtime") this.runEquipmentSecondaryRuntimeSmoke();
      if (testMode === "equipment-projectile-runtime") this.runEquipmentProjectileRuntimeSmoke();
      if (testMode === "trait") {
        this.fighting = true;
        this.fightLevel = 1;
        this.showTraitSelection();
      }
      if (this.metaMode) this.showMetaScene("MainPage");
      if (testMode === "meta") this.runMetaSmoke();
      console.info(`[Shoucheng restore] stage ${this.stageId}/${this.stages.length}; LayaAir ${Laya.version}; buildings ${this.buildingRows.length}; enemy variants ${content.enemyVariants.length}`);
    }

    applySynOperation(target, path, expression) {
      const parts = String(path || "").split(".").filter(Boolean);
      if (!parts.length) return;
      let owner = target;
      for (let index = 0; index < parts.length - 1; index += 1) {
        const part = parts[index];
        if (!owner[part] || typeof owner[part] !== "object") owner[part] = {};
        owner = owner[part];
      }
      const key = parts[parts.length - 1];
      const current = Number(owner[key]) || 0;
      const raw = String(expression === undefined ? "*1" : expression);
      const operator = /^[+\-*/]/.test(raw) ? raw[0] : "=";
      const amount = Number(operator === "=" ? raw : raw.slice(1));
      if (!Number.isFinite(amount)) return;
      if (operator === "+") owner[key] = current + amount;
      else if (operator === "-") owner[key] = current - amount;
      else if (operator === "*") owner[key] = current * amount;
      else if (operator === "/") owner[key] = amount === 0 ? current : current / amount;
      else owner[key] = amount;
    }

    parseEquipmentLoadout(raw) {
      const loadout = {};
      const entries = String(raw || "").split(";").map((entry) => entry.trim()).filter(Boolean);
      for (const entry of entries) {
        const separator = entry.indexOf(":");
        if (separator < 1) {
          this.equipmentLoadoutRejected.push({ entry, reason: "invalid-format" });
          continue;
        }
        const buildingId = entry.slice(0, separator).trim();
        const row = this.buildingRowById[buildingId];
        if (!row) {
          this.equipmentLoadoutRejected.push({ entry, reason: "unknown-building" });
          continue;
        }
        const allowed = new Set((row.traits || []).map(Number).filter(Boolean));
        const accepted = loadout[buildingId] || [];
        for (const token of entry.slice(separator + 1).split(",")) {
          const id = Number(token.trim());
          const trait = this.equipmentTraits[String(id)];
          if (!Number.isInteger(id) || !trait) {
            this.equipmentLoadoutRejected.push({ buildingId, value: token, reason: "unknown-trait" });
          } else if (!allowed.has(id)) {
            this.equipmentLoadoutRejected.push({ buildingId, traitId: id, reason: "trait-not-owned-by-building" });
          } else if (id === 104 || trait.EffectKey === "AllBarracksSpeed") {
            this.equipmentLoadoutRejected.push({ buildingId, traitId: id, reason: "original-config-missing" });
          } else if (!accepted.includes(id)) accepted.push(id);
        }
        if (accepted.length) loadout[buildingId] = accepted;
      }
      return loadout;
    }

    makeBuildingDefinition(row, level) {
      const shape = parseShape(row.shape);
      const safeLevel = clamp(level || 1, 1, MAX_SYNTH_LEVEL);
      const upgraded = Object.assign({}, row, {
        extra: row.extra ? Object.assign({}, row.extra) : null
      });
      const changeKeys = row.synChangeKey || [];
      const changeValues = row.synChangeVal || [];
      for (let index = 0; index < changeKeys.length; index += 1) {
        const values = Array.isArray(changeValues[index]) ? changeValues[index] : [changeValues[index]];
        const expression = values[Math.min(values.length - 1, safeLevel - 1)] || values[0] || "*1";
        this.applySynOperation(upgraded, changeKeys[index], expression);
      }
      const requestedSkin = `res/buildings/${row.body}${safeLevel}.png`;
      const fallbackSkin = `res/buildings/${row.body}1.png`;
      const skin = this.assetSet.has(requestedSkin) ? requestedSkin : fallbackSkin;
      const mountConfig = WEAPON_MOUNTS[row.body] || null;
      const mountSkin = skin.replace(/\.png$/i, "_up.png");
      const definition = Object.assign({}, upgraded, shape, {
        key: row.id,
        level: safeLevel,
        maxLevel: MAX_SYNTH_LEVEL,
        skin,
        weaponMount: mountConfig && this.assetSet.has(mountSkin)
          ? Object.assign({ skin: mountSkin }, mountConfig)
          : null,
        hp: Number(upgraded.hp) || 0,
        attack: Number(upgraded.attack) || 0,
        cooldown: upgraded.cooldown > 0 ? upgraded.cooldown / (this.fightParams.buildSpeedRadio || 1) : 0,
        rangePixels: (upgraded.range || 0) * PHYSICS_PIXEL_RATIO
      });
      const traitIds = (this.equipmentLoadout && this.equipmentLoadout[row.id]) || [];
      const numericPolicy = this.evaluateEquipmentTraits(traitIds, 1);
      const eventPolicy = this.evaluateEquipmentEventTraits(traitIds);
      const scene = this.equipmentScenePolicy || {};
      const tech = this.techEffects || {};
      definition.hp *= numericPolicy.building.hpMultiplier;
      definition.attack *= numericPolicy.building.attackMultiplier;
      definition.cooldown /= numericPolicy.building.cooldownDivisor;
      definition.rangePixels *= numericPolicy.building.rangeMultiplier;
      definition.crit = (Number(definition.crit) || 0) + numericPolicy.building.critAdd;
      definition.critDamage = (Number(definition.critDamage) || 1) * numericPolicy.building.critDamageMultiplier;
      if (definition.class === "defense") {
        definition.hp *= scene.allDefenseHpMultiplier || 1;
        definition.attack *= scene.allDefenseAttackMultiplier || 1;
        definition.cooldown /= scene.allDefenseAttackSpeedMultiplier || 1;
        definition.rangePixels *= scene.allDefenseRangeMultiplier || 1;
        definition.hp *= tech.allDefenseHpMultiplier || 1;
        definition.attack *= tech.allDefenseAttackMultiplier || 1;
      }
      if (definition.class === "wall") {
        definition.hp *= scene.allWallHpMultiplier || 1;
        definition.hp *= tech.allWallHpMultiplier || 1;
      }
      definition.maxLevel = Math.max(definition.maxLevel, scene.unlockSynthesisLevel || 0);
      definition.equipmentTraitIds = traitIds.slice();
      definition.equipmentNumericPolicy = numericPolicy;
      definition.equipmentEventPolicy = eventPolicy;
      return definition;
    }

    buildScene() {
      const backgroundUrl = `res/maps/Map_${this.stageConfig.mapId}.png`;
      this.background = addImage(this.root, backgroundUrl, 0, -SHOP_SCENE_SHIFT, DESIGN_WIDTH, 1623, `Map_${this.stageConfig.mapId}`);
      this.background.zOrder = 0;

      this.gridLayer = this.makeLayer("StageGrid", 10);
      this.dragHighlightLayer = this.makeLayer("DragHighlight", 25);
      this.buildingLayer = this.makeLayer("Buildings", 30);
      this.actorLayer = this.makeLayer("Actors", 40);
      this.projectileLayer = this.makeLayer("Projectiles", 50);
      this.hudLayer = this.makeLayer("HUD", 100);
      this.shopLayer = this.makeLayer("BattleShop", 200);
      this.overlayLayer = this.makeLayer("Overlays", 600);
      // These UI layers cover the whole design stage. Let pointer events pass
      // through their transparent regions so placed buildings remain draggable
      // when the shop returns between waves; child buttons still receive input.
      this.hudLayer.mouseThrough = true;
      this.shopLayer.mouseThrough = true;
      this.overlayLayer.mouseThrough = true;
      this.buildGrid();
      this.buildHud();
      this.buildShop();
    }

    metaRuntime() {
      if (typeof fgui !== "undefined") return fgui;
      if (typeof fairygui !== "undefined") return fairygui;
      return null;
    }

    registerMetaPackages() {
      const runtime = this.metaRuntime();
      const diagnostic = { runtime: !!runtime, requested: (this.metaUiManifest.packages || []).length, buffers: 0, loaded: 0, errors: [] };
      if (!runtime) {
        document.body.dataset.restoreMetaBootstrap = JSON.stringify(diagnostic);
        return false;
      }
      runtime.UIConfig.packageFileExtension = "bin";
      let loaded = 0;
      for (const packageName of this.metaUiManifest.packages || []) {
        const buffer = Laya.loader.getRes(`ui/${packageName}.bin`);
        if (!buffer) continue;
        diagnostic.buffers += 1;
        try {
          if (!Laya.loader.getRes(`ui/${packageName}`)) Laya.loader.cacheRes(`ui/${packageName}`, buffer);
          if (!runtime.UIPackage.getByName(packageName)) runtime.UIPackage.addPackage(`ui/${packageName}`);
          loaded += 1;
        } catch (error) {
          diagnostic.errors.push(`${packageName}:${String(error && error.message || error)}`);
          console.warn(`[Shoucheng meta package skipped] ${packageName}`, error);
        }
      }
      diagnostic.loaded = loaded;
      document.body.dataset.restoreMetaBootstrap = JSON.stringify(diagnostic);
      return loaded > 0;
    }

    metaText(parent, text, x, y, width, height, fontSize, color, align) {
      const runtime = this.metaRuntime();
      const label = new runtime.GTextField();
      label.setXY(x, y);
      label.setSize(width, height);
      label.text = text;
      label.font = "OPPOSansH";
      label.fontSize = fontSize || 24;
      label.color = color || "#ffffff";
      label.align = align || "center";
      label.verticalAlign = "middle";
      label.stroke = Math.max(1, Math.round((fontSize || 24) * 0.06));
      label.strokeColor = "#241a0c";
      parent.addChild(label);
      return label;
    }

    metaCard(parent, x, y, width, height, color, text, handler) {
      const runtime = this.metaRuntime();
      const card = new runtime.GComponent();
      card.setXY(x, y);
      card.setSize(width, height);
      const back = new runtime.GGraph();
      back.setSize(width, height);
      back.drawRect(2, "#734c24", color || "#25334d");
      back.alpha = 0.96;
      card.addChild(back);
      this.metaText(card, text, 12, 6, width - 24, height - 12, 22);
      if (handler) {
        card.opaque = true;
        card.onClick(this, handler);
      }
      parent.addChild(card);
      return card;
    }

    createMetaFunctionalLayer(page, title, subtitle) {
      const runtime = this.metaRuntime();
      const layer = new runtime.GComponent();
      layer.name = "OfflineFunctionalLayer";
      layer.setXY(45, 135);
      layer.setSize(660, 960);
      const background = new runtime.GGraph();
      background.setSize(660, 960);
      background.drawRect(3, "#8c6837", "#182238");
      background.alpha = 0.94;
      layer.addChild(background);
      this.metaText(layer, title, 24, 18, 612, 62, 38, "#ffe4a3");
      this.metaText(layer, subtitle, 30, 80, 600, 70, 20, "#d9e6ff");
      page.addChild(layer);
      return layer;
    }

    setMetaInputEnabled(enabled) {
      const active = !!enabled;
      const runtime = this.metaRuntime();
      const displayObject = runtime && runtime.GRoot && runtime.GRoot.inst
        ? runtime.GRoot.inst.displayObject
        : null;
      if (displayObject) {
        // GRoot spans the full stage. Hiding only OfflineMetaRoot leaves this
        // transparent display object above the battle scene and consumes every
        // pointer event, so visibility and input ownership must move together.
        displayObject.visible = active;
        displayObject.mouseEnabled = active;
      }
      document.body.dataset.restoreMetaInput = active ? "meta" : "battle";
    }

    showMetaScene(initialPage) {
      this.root.visible = false;
      if (this.metaContainer) {
        this.metaContainer.visible = true;
        this.setMetaInputEnabled(true);
        this.refreshMetaUi();
        this.switchMetaTab(initialPage || this.localProfile.metaTab || "MainPage", false);
        return;
      }
      if (!this.registerMetaPackages()) {
        this.buildMetaFallback();
        return;
      }
      const runtime = this.metaRuntime();
      const root = runtime.GRoot.inst;
      if (!root.displayObject.parent) Laya.stage.addChild(root.displayObject);
      root.displayObject.zOrder = 2000;
      this.setMetaInputEnabled(true);
      const container = new runtime.GComponent();
      container.name = "OfflineMetaRoot";
      container.setSize(DESIGN_WIDTH, DESIGN_HEIGHT);
      root.addChild(container);
      this.metaContainer = container;
      this.metaPages = {};
      const definitions = [
        ["ShopLayer", "ShopLayer", "ShopLayer"],
        ["EquiptLayer", "EquiptLayer", "EquiptLayer"],
        ["MainPage", "MainPage", "MainPage"],
        ["Institute", "Institute", "Institute"],
        ["Party", "Party", "DailyChallenge"]
      ];
      for (const [key, packageName, componentName] of definitions) {
        try {
          const page = runtime.UIPackage.createObject(packageName, componentName).asCom;
          page.name = `OfflineMeta_${key}`;
          page.setSize(DESIGN_WIDTH, DESIGN_HEIGHT);
          page.visible = false;
          container.addChild(page);
          this.metaPages[key] = page;
        } catch (error) {
          console.warn(`[Shoucheng meta page skipped] ${key}`, error);
        }
      }
      this.buildShopMetaPage();
      this.buildEquipmentMetaPage();
      this.bindMainMetaPage();
      this.buildInstituteMetaPage();
      this.buildPartyMetaPage();
      try {
        this.metaTopAsset = runtime.UIPackage.createObject("TopAsset", "TopAsset").asCom;
        this.metaTopAsset.setXY(0, 0);
        this.metaTopAsset.setSize(DESIGN_WIDTH, 105);
        container.addChild(this.metaTopAsset);
      } catch (error) {
        console.warn("[Shoucheng meta TopAsset skipped]", error);
      }
      try {
        this.metaBottom = runtime.UIPackage.createObject("MainTabPage", "BottomBtn").asCom;
        this.metaBottom.setXY(0, DESIGN_HEIGHT - 125);
        container.addChild(this.metaBottom);
        const tabNames = ["ShopLayer", "EquiptLayer", "MainPage", "Institute", "Party"];
        const iconNames = ["tongyong_9", "tongyong_12", "tongyong_11", "tongyong_10", "tongyong_13"];
        const titles = ["商店", "建筑", "作战", "天赋", "副本"];
        tabNames.forEach((name, index) => {
          const button = this.metaBottom.getChild(`btn${index}`);
          const icon = this.metaBottom.getChild(`icon${index}`);
          if (button) button.onClick(this, () => this.switchMetaTab(name));
          if (icon) {
            icon.icon = `ui://images/${iconNames[index]}`;
            const title = icon.getChild("n3");
            if (title) title.text = titles[index];
          }
        });
      } catch (error) {
        console.warn("[Shoucheng meta bottom navigation skipped]", error);
      }
      this.refreshMetaUi();
      this.switchMetaTab(initialPage || this.localProfile.metaTab || "MainPage", false);
    }

    buildMetaFallback() {
      if (this.metaFallback && !this.metaFallback.destroyed) {
        this.metaFallback.visible = true;
        return;
      }
      const layer = new Laya.Sprite();
      layer.name = "OfflineMetaFallback";
      layer.size(DESIGN_WIDTH, DESIGN_HEIGHT);
      layer.zOrder = 2000;
      Laya.stage.addChild(layer);
      this.metaFallback = layer;
      addRect(layer, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, "#19253b", 1, "MetaFallbackBack");
      addLabel(layer, "这座城我守定了", 65, 110, 620, 90, 46);
      addLabel(layer, `章节 ${this.stageId} / ${this.stages.length}`, 100, 300, 550, 70, 36);
      addLabel(layer, "局外资源正在离线载入", 120, 400, 510, 60, 25);
      this.makeButton(layer, "进入作战", UI.orangeButton, 210, 780, 330, 110, () => this.enterBattleFromMeta(), 38);
    }

    buildShopMetaPage() {
      const page = this.metaPages && this.metaPages.ShopLayer;
      if (!page) return;
      const layer = this.createMetaFunctionalLayer(page, "商店", "远程商品、支付和广告入口按你的要求暂不连接。战役宝箱获得的本地资产仍会保留。 ");
      layer.name = "ShopOfflineLayer";
      this.metaShopSummary = this.metaText(layer, "", 35, 185, 590, 90, 28, "#ffe4a3");
      this.metaCard(layer, 70, 330, 520, 100, "#2e405e", "联网商品已停用\n不会产生任何网络请求", null);
      this.metaCard(layer, 70, 470, 520, 100, "#304f3c", "波次宝箱与战役进度继续使用本地存档", () => this.switchMetaTab("MainPage"));
    }

    buildEquipmentMetaPage() {
      const page = this.metaPages && this.metaPages.EquiptLayer;
      if (!page) return;
      const layer = this.createMetaFunctionalLayer(page, "建筑与装备", "装备表和升级消耗均来自原包；没有授权账号快照时，不会凭空发放或自动装备。 ");
      layer.name = "EquipmentOfflineLayer";
      this.metaEquipmentLayer = layer;
    }

    bindMainMetaPage() {
      const page = this.metaPages && this.metaPages.MainPage;
      if (!page) return;
      const hideNames = ["btnFastForward", "btnAdReward", "btnAdBuild", "btnBuildGift", "btnDYReward", "btnQuick"];
      hideNames.forEach((name) => {
        const child = page.getChild(name);
        if (child) child.visible = false;
      });
      const type = page.getController("type");
      if (type) type.selectedPage = "NONE";
      const battle = page.getChild("btnBattle");
      const left = page.getChild("btnLeft");
      const right = page.getChild("btnRight");
      const settings = page.getChild("btnSettings");
      const library = page.getChild("btnLibrary");
      if (battle) battle.onClick(this, () => this.enterBattleFromMeta());
      if (left) left.onClick(this, () => this.selectMetaStage(-1));
      if (right) right.onClick(this, () => this.selectMetaStage(1));
      if (settings) settings.onClick(this, () => this.showMetaNotice("设置", "联网账号、云存档和分析 SDK 已停用；本地进度会保存在当前浏览器。"));
      if (library) library.onClick(this, () => this.showMetaNotice("图鉴", "图鉴资源已恢复，完整条目交互将在后续局外阶段接入。"));
      this.metaOfflineTag = this.metaText(page, "离线局外模式", 265, 118, 220, 44, 20, "#ffe4a3");
    }

    buildInstituteMetaPage() {
      const page = this.metaPages && this.metaPages.Institute;
      if (!page) return;
      const layer = this.createMetaFunctionalLayer(page, "天赋研究", "前置节点必须升满；升级按原表消耗本地钻石，结果写入隔离存档。 ");
      layer.name = "InstituteOfflineLayer";
      this.metaInstituteLayer = layer;
    }

    buildPartyMetaPage() {
      const page = this.metaPages && this.metaPages.Party;
      if (!page) return;
      const layer = this.createMetaFunctionalLayer(page, "副本", "原包中的每日挑战依赖日期、账号和远程结算；当前阶段只保留入口与证据，不启动网络逻辑。 ");
      layer.name = "PartyOfflineLayer";
      this.metaCard(layer, 70, 300, 520, 120, "#3c304f", "每日挑战：离线停用\n等待本地结算规格恢复", null);
    }

    showMetaNotice(title, message) {
      if (!this.metaContainer || this.metaNotice) return;
      const runtime = this.metaRuntime();
      const shade = new runtime.GGraph();
      shade.name = "MetaNoticeShade";
      shade.setSize(DESIGN_WIDTH, DESIGN_HEIGHT);
      shade.drawRect(0, "#000000", "#000000");
      shade.alpha = 0.68;
      shade.opaque = true;
      this.metaContainer.addChild(shade);
      const panel = new runtime.GComponent();
      panel.setXY(95, 390);
      panel.setSize(560, 360);
      const back = new runtime.GGraph();
      back.setSize(560, 360);
      back.drawRect(3, "#b58a45", "#24324a");
      panel.addChild(back);
      this.metaText(panel, title, 30, 28, 500, 60, 36, "#ffe4a3");
      this.metaText(panel, message, 45, 105, 470, 120, 23, "#ffffff");
      this.metaCard(panel, 160, 260, 240, 70, "#497a42", "确定", () => {
        if (shade.parent) shade.removeFromParent();
        if (panel.parent) panel.removeFromParent();
        shade.dispose();
        panel.dispose();
        this.metaNotice = null;
      });
      this.metaContainer.addChild(panel);
      this.metaNotice = { shade, panel };
    }

    refreshMetaTopAsset() {
      if (!this.metaTopAsset) return;
      const profile = this.normalizeLocalProfile(this.localProfile);
      const values = {
        compEnergy: `${profile.props.Stamina || 0}/0`,
        compMoney: String(profile.props.Money || 0),
        compDiamond: String(profile.props.Diamond || 0),
        compFreeCoupon: String(profile.props.FreeCoupon || 0)
      };
      for (const [name, value] of Object.entries(values)) {
        const component = this.metaTopAsset.getChild(name);
        const title = component && component.getChild("title");
        if (title) title.text = value;
      }
      const type = this.metaTopAsset.getController("type");
      if (type) type.selectedPage = "NONE";
    }

    refreshMainMetaPage() {
      const page = this.metaPages && this.metaPages.MainPage;
      if (!page) return;
      const stage = this.stages[this.stageId - 1];
      const progress = this.normalizeCampaignProgress(this.localProfile.maxStageRecord);
      const completedWave = stage.id < progress[0] ? stage.declaredWave : stage.id === progress[0] ? progress[1] : 0;
      const name = page.getChild("lblName");
      const maxWave = page.getChild("lblMaxWave");
      if (name) name.text = `章节 ${stage.id}`;
      if (maxWave) maxWave.text = completedWave ? `最高记录：第${completedWave}波` : "最高记录：无";
      const state = page.getController("state");
      if (state) state.selectedIndex = stage.id <= this.campaignUnlockedStage() ? (completedWave ? 1 : 0) : 2;
      const firstStage = page.getController("firstStage");
      if (firstStage) firstStage.selectedIndex = stage.id === this.campaignUnlockedStage() ? 1 : 0;
      const boxStage = page.getChild("boxStage");
      const map = boxStage && boxStage.getController("map");
      if (map) map.selectedPage = stage.mapId;
      const right = page.getChild("btnRight");
      const left = page.getChild("btnLeft");
      if (left) left.grayed = stage.id <= 1;
      if (right) right.grayed = stage.id >= this.campaignUnlockedStage();
      (stage.rewardWave || []).slice(0, 3).forEach((milestone, index) => {
        const box = page.getChild(`box${index}`);
        if (!box) return;
        const title = box.getChild("lblTitle");
        if (title) {
          title.visible = true;
          title.text = `第${milestone}波`;
        }
        const selection = box.getController("select");
        const chestState = this.waveChestState(stage.id, index);
        if (selection) selection.selectedIndex = chestState.eligible ? 1 : 0;
        const button = box.getChild("btnGet");
        if (button && !button.__offlineBound) {
          button.__offlineBound = true;
          button.onClick(this, () => {
            const claimed = this.claimWaveChest(this.stageId, index);
            if (!claimed.ok) {
              this.showMetaNotice("波次宝箱", claimed.error === "BoxHasBeenObtained" ? "该宝箱已经领取。" : "尚未达到领取条件。");
              return;
            }
            this.refreshMetaUi();
            this.showMetaNotice("领取成功", this.rewardBundleText(claimed.rewards));
          });
        }
      });
    }

    refreshEquipmentMetaPage() {
      const layer = this.metaEquipmentLayer;
      if (!layer) return;
      while (layer.numChildren > 3) layer.removeChildAt(layer.numChildren - 1, true);
      const profile = this.normalizeLocalProfile(this.localProfile);
      const formation = profile.formation.length ? profile.formation.join("、") : "未配置（未取得账号快照）";
      this.metaText(layer, `当前编队：${formation}`, 30, 165, 600, 55, 24, "#ffe4a3");
      this.buildingRows.filter((row) => row.id !== "e19").slice(0, 12).forEach((row, index) => {
        const column = index % 2;
        const line = Math.floor(index / 2);
        const owned = profile.items[row.id] || 0;
        const level = profile.equipmentLevels[row.id] || 0;
        this.metaCard(layer, 30 + column * 305, 245 + line * 90, 285, 70, owned ? "#365c3f" : "#2b3446", `${row.name}  Lv.${level}\n持有 ${owned}`, null);
      });
    }

    techParents(id) {
      return Object.values(this.techRows).filter((row) => Array.isArray(row.Nexts) && row.Nexts.includes(id));
    }

    isTechUnlocked(id, profile) {
      const parents = this.techParents(id);
      if (!parents.length) return true;
      const levels = this.normalizeLocalProfile(profile || this.localProfile).techLevels;
      return parents.every((parent) => (levels[parent.Id] || 0) >= (parent.Limit || 1));
    }

    techUpgradeTransition(profileValue, id) {
      const row = this.techRows[id];
      const profile = this.normalizeLocalProfile(profileValue);
      if (!row || !this.isTechUnlocked(id, profile)) return { ok: false, error: "TechLocked" };
      const level = profile.techLevels[id] || 0;
      if (level >= (row.Limit || 1)) return { ok: false, error: "MaxLevel" };
      const consume = Array.isArray(row.Consume) ? row.Consume : [];
      const kind = consume[0];
      const assetId = consume[1];
      const count = Math.max(0, Math.trunc(Number(consume[2]) || 0));
      const target = kind === "Item" ? profile.items : profile.props;
      if (!assetId || (target[assetId] || 0) < count) return { ok: false, error: "ConsumeNotEnough", count, assetId };
      target[assetId] -= count;
      if (target[assetId] <= 0) delete target[assetId];
      profile.techLevels[id] = level + 1;
      return { ok: true, id, level: level + 1, consume: [kind, assetId, count], profile };
    }

    upgradeTech(id) {
      const result = this.techUpgradeTransition(this.localProfile, id);
      if (!result.ok) return result;
      this.saveLocalProfile(result.profile);
      this.refreshMetaUi();
      return result;
    }

    techEffectName(effect) {
      return ({
        AllUnitAtk: "士兵攻击", AllUnitHp: "士兵生命", AllUnitAtkSpd: "士兵攻速", AllUnitMoveSpd: "士兵移速",
        AllUnitDodge: "士兵闪避", AllUnitCrit: "士兵暴击", AllWallHp: "城墙生命", BaseHpMul: "城堡生命",
        AllDefenseAtk: "防御塔攻击", AllDefenseHp: "防御塔生命", Income: "局内收益", FreeRefresh: "免费刷新"
      })[effect] || effect;
    }

    refreshInstituteMetaPage() {
      const layer = this.metaInstituteLayer;
      if (!layer) return;
      while (layer.numChildren > 3) layer.removeChildAt(layer.numChildren - 1, true);
      const profile = this.normalizeLocalProfile(this.localProfile);
      const diamonds = profile.props.Diamond || 0;
      this.metaText(layer, `钻石 ${diamonds} · 已研究 ${Object.values(profile.techLevels).reduce((sum, level) => sum + level, 0)} 级`, 30, 155, 600, 55, 25, "#ffe4a3");
      const rows = Object.values(this.techRows)
        .sort((left, right) => left.Id.localeCompare(right.Id, undefined, { numeric: true }))
        .filter((row) => this.isTechUnlocked(row.Id, profile) && (profile.techLevels[row.Id] || 0) < (row.Limit || 1))
        .slice(0, 8);
      if (!rows.length) {
        this.metaText(layer, "当前可研究节点已全部升满。", 70, 300, 520, 80, 28, "#ffffff");
        return;
      }
      rows.forEach((row, index) => {
        const level = profile.techLevels[row.Id] || 0;
        const cost = Number(row.Consume && row.Consume[2]) || 0;
        const effect = `${this.techEffectName(row.Effect[0])} +${Number(row.Effect[1]) * 100}%`;
        const enabled = diamonds >= cost;
        this.metaCard(layer, 40, 230 + index * 82, 580, 66, enabled ? "#365c3f" : "#2b3446", `${row.Id}  ${effect}  ${level}/${row.Limit}    钻石 ${cost}`, () => {
          const result = this.upgradeTech(row.Id);
          if (!result.ok) this.showMetaNotice("研究失败", result.error === "ConsumeNotEnough" ? "钻石不足。" : "该节点尚未解锁或已经满级。");
        });
      });
    }

    refreshMetaUi() {
      this.localProfile = this.loadLocalProfile();
      this.campaignProgress = this.localProfile.maxStageRecord.slice();
      this.refreshMetaTopAsset();
      this.refreshMainMetaPage();
      this.refreshEquipmentMetaPage();
      this.refreshInstituteMetaPage();
      if (this.metaShopSummary) {
        const props = this.localProfile.props;
        this.metaShopSummary.text = `银币 ${props.Money || 0}   ·   钻石 ${props.Diamond || 0}   ·   体力 ${props.Stamina || 0}`;
      }
    }

    switchMetaTab(name, persist) {
      if (!this.metaPages) return;
      const tabNames = ["ShopLayer", "EquiptLayer", "MainPage", "Institute", "Party"];
      const selected = tabNames.includes(name) && this.metaPages[name] ? name : "MainPage";
      tabNames.forEach((pageName) => {
        if (this.metaPages[pageName]) this.metaPages[pageName].visible = pageName === selected;
      });
      if (this.metaBottom) {
        const index = tabNames.indexOf(selected);
        tabNames.forEach((pageName, pageIndex) => {
          const button = this.metaBottom.getChild(`btn${pageIndex}`);
          const icon = this.metaBottom.getChild(`icon${pageIndex}`);
          const buttonSelect = button && button.getController("select");
          const iconSelect = icon && icon.getController("select");
          if (buttonSelect) buttonSelect.selectedIndex = pageIndex === index ? 1 : 0;
          if (iconSelect) iconSelect.selectedIndex = pageIndex === index ? 1 : 0;
        });
        const bar = this.metaBottom.getChild("imgBar");
        if (bar) bar.x = -22 + index * 152;
      }
      if (persist !== false) {
        const profile = this.normalizeLocalProfile(this.localProfile);
        profile.metaTab = selected;
        this.saveLocalProfile(profile);
      }
      this.refreshMetaUi();
      document.body.dataset.restoreMetaPage = selected;
    }

    selectMetaStage(offset) {
      const next = clamp(this.stageId + offset, 1, this.campaignUnlockedStage());
      if (next === this.stageId) return;
      const params = new URLSearchParams(window.location.search);
      params.set("stage", String(next));
      params.delete("battle");
      window.location.search = params.toString();
    }

    enterBattleFromMeta() {
      if (this.metaContainer) this.metaContainer.visible = false;
      if (this.metaFallback) this.metaFallback.visible = false;
      this.setMetaInputEnabled(false);
      this.refreshCombatMetaPolicies();
      this.root.visible = true;
      this.resetRun();
      document.body.dataset.restoreMetaPage = "BattleScene";
    }

    returnToMeta() {
      if (!this.metaMode) return;
      this.root.visible = false;
      this.showMetaScene("MainPage");
      document.body.dataset.restoreMetaPage = "MainPage";
    }

    runMetaSmoke() {
      const bootstrap = JSON.parse(document.body.dataset.restoreMetaBootstrap || "{}");
      const pageNames = ["ShopLayer", "EquiptLayer", "MainPage", "Institute", "Party"];
      const mainPage = this.metaPages && this.metaPages.MainPage;
      const hiddenNetworkControls = ["btnFastForward", "btnAdReward", "btnAdBuild", "btnBuildGift", "btnDYReward", "btnQuick"]
        .every((name) => !mainPage || !mainPage.getChild(name) || !mainPage.getChild(name).visible);
      const profile = this.normalizeLocalProfile(this.localProfile);
      const upgradeProfile = this.normalizeLocalProfile(profile);
      upgradeProfile.props.Diamond = 20;
      const firstUpgrade = this.techUpgradeTransition(upgradeProfile, "1_1");
      const secondUpgrade = firstUpgrade.ok ? this.techUpgradeTransition(firstUpgrade.profile, "1_1") : { ok: false };
      const upgradedTechEffects = secondUpgrade.ok ? this.evaluateTechEffects(secondUpgrade.profile) : {};
      const runtime = this.metaRuntime();
      const metaDisplay = runtime && runtime.GRoot && runtime.GRoot.inst ? runtime.GRoot.inst.displayObject : null;
      const metaOwnsInputOnMeta = !!metaDisplay && metaDisplay.visible && metaDisplay.mouseEnabled !== false;
      this.enterBattleFromMeta();
      const battleOwnsInputAfterTransition = this.root.visible
        && !this.metaContainer.visible
        && !!metaDisplay
        && !metaDisplay.visible
        && metaDisplay.mouseEnabled === false
        && this.startButton.mouseEnabled;
      this.returnToMeta();
      const assertions = {
        allRequestedFairyPackagesLoaded: bootstrap.requested === 27 && bootstrap.loaded === 27 && !(bootstrap.errors || []).length,
        originalFiveTabShellCreated: pageNames.every((name) => !!(this.metaPages && this.metaPages[name])) && !!this.metaBottom,
        mainPageIsDefault: document.body.dataset.restoreMetaPage === "MainPage" && !!mainPage && mainPage.visible,
        networkAndAdControlsSuppressed: hiddenNetworkControls && window.PAY_AD_ENABLE_ST === "NONE",
        exactTechCatalogLoaded: Object.keys(this.techRows).length === 41,
        originalTechRootsUnlocked: this.isTechUnlocked("1_1", profile) && this.isTechUnlocked("1_2", profile),
        nextTierRequiresMaxedParent: !this.isTechUnlocked("2_1", profile),
        exactTechUpgradeConsumesAndUnlocks: firstUpgrade.ok && secondUpgrade.ok
          && secondUpgrade.profile.props.Diamond === undefined
          && secondUpgrade.profile.techLevels["1_1"] === 2
          && this.isTechUnlocked("2_1", secondUpgrade.profile),
        techEffectUsesOriginalRepeatedMultiplier: secondUpgrade.ok
          && Math.abs(upgradedTechEffects.allUnitAttackMultiplier - 1.0201) < 1e-9,
        offlineProfileSchemaPresent: profile.version === 2 && !!profile.techLevels && !!profile.equipmentLevels && Array.isArray(profile.formation),
        stageSelectionBoundedToUnlock: this.stageId <= this.campaignUnlockedStage(),
        battleRootHiddenOnMeta: !this.root.visible && !!this.metaContainer.visible,
        metaOwnsInputOnMeta,
        battleOwnsInputAfterTransition
      };
      for (const name of pageNames) this.switchMetaTab(name, false);
      const allTabsSwitch = pageNames.every((name) => {
        this.switchMetaTab(name, false);
        return this.metaPages[name].visible && pageNames.filter((other) => other !== name).every((other) => !this.metaPages[other].visible);
      });
      this.switchMetaTab("MainPage", false);
      assertions.allFiveTabsSwitchLocally = allTabsSwitch;
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        packageCount: bootstrap.loaded || 0,
        pageNames,
        techRows: Object.keys(this.techRows).length,
        networkPolicy: "offline-disabled",
        assertions
      };
      window.__SHOUCHENG_META_SMOKE__ = result;
      document.body.dataset.restoreMetaSmoke = JSON.stringify(result);
      console.info("[Shoucheng offline meta smoke]", result);
      return result;
    }

    makeLayer(name, zOrder) {
      const layer = new Laya.Sprite();
      layer.name = name;
      layer.size(DESIGN_WIDTH, DESIGN_HEIGHT);
      layer.zOrder = zOrder;
      this.root.addChild(layer);
      return layer;
    }

    themeColor() {
      if (this.stageConfig.mapId === "Desert") return "#c9a45a";
      if (this.stageConfig.mapId === "Snowfield") return "#b9d8e6";
      return "#73bd4f";
    }

    buildGrid() {
      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLS; column += 1) {
          if (this.mapData[row][column] === "o") continue;
          this.createFloorCell(column, row);
          if (this.mapData[row][column] === "2") this.createTree(column, row);
        }
      }

      this.castlePosition = this.findCastlePosition();
      const castleSkin = "res/buildings/Building_MainBase1.png";
      const footprintWidth = 3 * CELL_STEP - CELL_GAP;
      const footprintHeight = 2 * CELL_STEP - CELL_GAP;
      this.castle = addImage(this.gridLayer, castleSkin, 0, 0, footprintWidth + 35, footprintHeight + 23, "Building_MainBase");
      const castleX = GRID_X + this.castlePosition.column * CELL_STEP - 18;
      const castleY = GRID_Y + this.castlePosition.row * CELL_STEP - 12;
      this.castle.pos(castleX, castleY);
      this.castle.zOrder = castleY + this.castle.height;
      this.castleBaseCenter = { x: castleX + this.castle.width / 2, y: castleY + this.castle.height / 2 };
      this.castleCenter = { x: this.castleBaseCenter.x, y: this.castleBaseCenter.y };

      const hpY = clamp(GRID_Y + (this.castlePosition.row + 2) * CELL_STEP - 31, 820, 1005);
      this.castleHpBack = addImage(this.gridLayer, UI.homeHpBack, 304, hpY, 143, 23, "CastleHp_Back");
      this.castleHpBack.zOrder = 500;
      this.castleHpFill = addImage(this.castleHpBack, UI.homeHpFill, 4, 4, 135, 15, "CastleHp_Fill");
      this.castleHpIcon = addImage(this.gridLayer, UI.homeHpIcon, 270, hpY - 9, 48, 41, "CastleHp_Icon");
      this.castleHpIcon.zOrder = 501;
      this.castleHpText = addLabel(this.castleHpBack, "", 0, 0, 143, 23, 14);
      this.castleHpText.visible = false;
      this.resetOccupied();
    }

    createFloorCell(column, row) {
      const key = `${column}_${row}`;
      if (this.floorCells.has(key)) return this.floorCells.get(key);
      const color = this.themeColor();
      const x = GRID_X + column * CELL_STEP;
      const y = GRID_Y + row * CELL_STEP;
      const cell = addRect(this.gridLayer, x, y, CELL_SIZE, CELL_SIZE, color, 0.24, `Floor_${column}_${row}`);
      cell.graphics.drawRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, null, color, 2);
      cell.zOrder = 0;
      this.floorCells.set(key, cell);
      return cell;
    }

    findCastlePosition() {
      const columns = [2, 1, 3, 0, 4];
      for (let row = ROWS - 2; row >= 0; row -= 1) {
        for (const column of columns) {
          if (column + 3 > COLS) continue;
          let valid = true;
          for (let y = 0; y < 2; y += 1) {
            for (let x = 0; x < 3; x += 1) if (this.mapData[row + y][column + x] !== "1") valid = false;
          }
          if (valid) return { column, row };
        }
      }
      return { column: 2, row: 7 };
    }

    createTree(column, row) {
      const key = `${column}_${row}`;
      if (this.treesByCell.has(key)) return;
      const x = GRID_X + column * CELL_STEP;
      const y = GRID_Y + row * CELL_STEP;
      const tree = addImage(this.gridLayer, UI.tree, x + 10, y + 3, 72, 86, `Tree_${column}_${row}`);
      tree.zOrder = 6;
      tree.mouseEnabled = true;
      tree.on(Laya.Event.CLICK, this, () => this.tryClearTree(column, row));
      const badge = new Laya.Sprite();
      setTopLeft(badge, x + 7, y + 8, 68, 43);
      badge.name = `TreeCost_${column}_${row}`;
      badge.zOrder = 8;
      badge.mouseEnabled = true;
      badge.on(Laya.Event.CLICK, this, () => this.tryClearTree(column, row));
      this.gridLayer.addChild(badge);
      addImage(badge, UI.money, 0, 2, 38, 38, "Money");
      const priceText = addLabel(badge, String(this.currentObstacleClearPrice()), 34, 0, 34, 43, 25);
      this.treeBadges.push(badge);
      this.treesByCell.set(key, { tree, badge, priceText, column, row });
    }

    currentObstacleClearPrice() {
      const prices = Array.isArray(this.fightParams.ObstacleClearPriceList)
        && this.fightParams.ObstacleClearPriceList.length
        ? this.fightParams.ObstacleClearPriceList : [0];
      const index = clamp(Math.trunc(Number(this.obstacleClearCount) || 0), 0, prices.length - 1);
      return Math.max(0, Math.trunc(Number(prices[index]) || 0));
    }

    refreshTreeBadges() {
      const price = this.currentObstacleClearPrice();
      for (const entry of this.treesByCell.values()) {
        if (!entry.priceText || entry.priceText.destroyed) continue;
        entry.priceText.text = String(price);
        entry.priceText.color = this.money >= price ? "#ffffff" : "#ff5555";
      }
    }

    tryClearTree(column, row) {
      if (this.fighting || this.finished) return false;
      const key = `${column}_${row}`;
      if (!this.treesByCell.has(key)) return false;
      const price = this.currentObstacleClearPrice();
      if (this.money < price) {
        this.refreshTreeBadges();
        return false;
      }
      this.money -= price;
      this.obstacleClearCount = (this.obstacleClearCount || 0) + 1;
      this.clearTree(column, row);
      this.setMapCell(column, row, "1");
      this.createFloorCell(column, row);
      this.occupied[column][row] = 0;
      this.refreshTreeBadges();
      this.refreshHud();
      this.publishState();
      return true;
    }

    handleStageTreeClick(event) {
      if (this.fighting || this.finished || this.drag) return false;
      const eventX = Number(event && event.stageX);
      const eventY = Number(event && event.stageY);
      const pointerX = Number.isFinite(eventX) ? eventX : Number(Laya.stage.mouseX);
      const pointerY = Number.isFinite(eventY) ? eventY : Number(Laya.stage.mouseY);
      if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) return false;
      const localX = pointerX - (this.gridLayer.x || 0);
      const localY = pointerY - (this.gridLayer.y || 0);
      for (const entry of this.treesByCell.values()) {
        const x = GRID_X + entry.column * CELL_STEP;
        const y = GRID_Y + entry.row * CELL_STEP;
        if (localX < x || localX > x + CELL_SIZE || localY < y || localY > y + CELL_SIZE) continue;
        return this.tryClearTree(entry.column, entry.row);
      }
      return false;
    }

    clearTree(column, row) {
      const key = `${column}_${row}`;
      const entry = this.treesByCell.get(key);
      if (!entry) return;
      if (entry.tree && !entry.tree.destroyed) entry.tree.destroy(true);
      if (entry.badge && !entry.badge.destroyed) entry.badge.destroy(true);
      this.treeBadges = this.treeBadges.filter((badge) => badge !== entry.badge);
      this.treesByCell.delete(key);
    }

    setMapCell(column, row, value) {
      const chars = this.mapData[row].split("");
      chars[column] = value;
      this.mapData[row] = chars.join("");
    }

    resetMapExpansion() {
      this.mapData = this.baseMapData.slice();
      for (let row = 0; row < ROWS; row += 1) {
        for (let column = 0; column < COLS; column += 1) {
          const key = `${column}_${row}`;
          const base = this.baseMapData[row][column];
          if (base === "o") {
            const floor = this.floorCells.get(key);
            if (floor && !floor.destroyed) floor.destroy(true);
            this.floorCells.delete(key);
            this.clearTree(column, row);
          } else {
            this.createFloorCell(column, row);
            if (base === "2") this.createTree(column, row);
          }
        }
      }
    }

    buildHud() {
      this.pauseButton = addImage(this.hudLayer, UI.pause, 39, 57, 62, 59, "PauseButton");
      this.pauseButton.mouseEnabled = true;
      this.pauseButton.on(Laya.Event.CLICK, this, this.togglePause);
      this.waveText = addLabel(this.hudLayer, `波次 1/${this.maxWave}`, 294, 58, 160, 58, 43);
      this.waveProgressBack = addImage(this.hudLayer, UI.progressBack, 39, 126, 610, 22, "WaveProgress_Back");
      this.waveProgressBack.sizeGrid = "6,9,6,8";
      this.waveProgressFill = addImage(this.waveProgressBack, UI.progressFill, 3, 3, 0, 16, "WaveProgress_Fill");
      this.levelBadge = addImage(this.hudLayer, UI.levelBadge, 641, 115, 70, 42, "FightLevel_Back");
      this.fightLevelText = addLabel(this.hudLayer, "0", 641, 114, 70, 43, 31);
      this.moneyBack = addImage(this.hudLayer, UI.counterBack, 574, 199, 139, 40, "Money_Back");
      this.moneyBack.sizeGrid = "10,37,10,34";
      addImage(this.hudLayer, UI.money, 556, 195, 50, 49, "Money_Icon");
      this.moneyText = addLabel(this.hudLayer, "0", 587, 198, 126, 42, 30);
      this.killsBack = addImage(this.hudLayer, UI.counterBack, 572, 252, 139, 40, "Kills_Back");
      this.killsBack.sizeGrid = "10,37,10,34";
      this.killsIcon = addImage(this.hudLayer, UI.kills, 555, 248, 47, 47, "Kills_Icon");
      this.killsText = addLabel(this.hudLayer, "0", 585, 252, 126, 40, 28);
      this.killsBack.visible = false;
      this.killsIcon.visible = false;
      this.setCombatCountersVisible(false);
      this.speedButton = addImage(this.hudLayer, UI.speed, 36, 183, 172, 72, "SpeedButton");
      this.speedButton.mouseEnabled = true;
      addLabel(this.speedButton, "×1", 97, 14, 80, 43, 30);
      this.speedButton.on(Laya.Event.CLICK, this, this.toggleSpeed);
      this.speedButton.visible = false;
      this.previousStageButton = this.makeButton(this.hudLayer, "‹", UI.grayButton, 145, 174, 50, 40, () => this.navigateStage(-1), 26);
      this.stageText = addLabel(this.hudLayer, `关卡 ${this.stageId}/${this.stages.length}`, 197, 170, 220, 48, 23);
      this.stageNameText = addLabel(this.hudLayer, this.stageConfig.name || this.stageConfig.mapId, 190, 211, 235, 36, 17);
      this.nextStageButton = this.makeButton(this.hudLayer, "›", UI.grayButton, 420, 174, 50, 40, () => this.navigateStage(1), 26);
      this.waveChestButton = this.makeButton(this.hudLayer, "宝箱", UI.orangeButton, 478, 174, 84, 65, () => this.openWaveChestPanel(), 20);
      this.buildAirSupport();
    }

    buildAirSupport() {
      this.airSupportLayer = new Laya.Sprite();
      this.airSupportLayer.name = "AirSupportSkills";
      this.airSupportLayer.size(DESIGN_WIDTH, 120);
      this.airSupportLayer.zOrder = 900;
      this.airSupportLayer.mouseThrough = true;
      this.hudLayer.addChild(this.airSupportLayer);
      this.layoutAirSupport();
      Laya.stage.on(Laya.Event.RESIZE, this, this.layoutAirSupport);
      const positions = [105, 326, 547];
      AIR_SUPPORT_SKILLS.forEach((skill, index) => {
        const button = new Laya.Image(UI.grayButton);
        button.name = `AirSupport_${skill.id}`;
        button.pos(positions[index], 0);
        button.size(163, 107);
        button.sizeGrid = "18,18,18,18";
        button.mouseEnabled = true;
        this.airSupportLayer.addChild(button);
        addImage(button, skill.icon, -16, -10, 196, 128, `${skill.name}图标`);
        const usedShade = addRect(button, 0, 0, 163, 107, "#111827", 0.72, "UsedShade");
        const usedLabel = addLabel(button, "已使用", 0, 0, 163, 107, 24);
        usedShade.visible = false;
        usedLabel.visible = false;
        button.on(Laya.Event.CLICK, this, () => this.useAirSupport(skill.id));
        this.airSupportButtons[skill.id] = { button, usedShade, usedLabel };
      });
      this.setAirSupportVisible(false);
    }

    layoutAirSupport() {
      if (!this.airSupportLayer) return;
      const stageHeight = Math.max(DESIGN_HEIGHT, Number(Laya.stage.height) || DESIGN_HEIGHT);
      // The original skill strip is bottom-aligned. A fixed y=1135 places it
      // over the final building rows on tall fixed-width phone viewports.
      // Dock against the actual stage bottom so extra portrait space is used.
      const y = stageHeight - 120;
      this.airSupportLayer.pos(0, y);
      document.body.dataset.restoreAirSupportLayout = JSON.stringify({ stageHeight, y, height: 120, bottom: y + 120 });
    }

    setAirSupportVisible(visible) {
      if (this.airSupportLayer) this.airSupportLayer.visible = !!visible;
    }

    refreshAirSupportButtons() {
      for (const skill of AIR_SUPPORT_SKILLS) {
        const entry = this.airSupportButtons[skill.id];
        if (!entry) continue;
        const used = this.airSupportUsed.has(skill.id);
        entry.button.mouseEnabled = !used;
        entry.button.gray = used;
        entry.usedShade.visible = used;
        entry.usedLabel.visible = used;
      }
    }

    resetAirSupport() {
      this.airSupportUsed.clear();
      this.airSupportEvents.length = 0;
      this.airSupportAudit = {
        uses: [], meteoriteTargets: 0, meteoriteImpacts: 0,
        frozenTargets: 0, healedUnits: 0, healedHp: 0
      };
      this.refreshAirSupportButtons();
      this.setAirSupportVisible(false);
      this.publishAirSupportState();
    }

    publishAirSupportState() {
      const state = {
        used: [...this.airSupportUsed],
        available: AIR_SUPPORT_SKILLS.filter((skill) => !this.airSupportUsed.has(skill.id)).map((skill) => skill.id),
        pendingEvents: this.airSupportEvents.length,
        audit: this.airSupportAudit
      };
      document.body.dataset.restoreAirSupport = JSON.stringify(state);
      return state;
    }

    useAirSupport(skillId) {
      if (!this.fighting || this.paused || this.finished || this.airSupportUsed.has(skillId)) return false;
      if (!AIR_SUPPORT_SKILLS.some((skill) => skill.id === skillId)) return false;
      this.airSupportUsed.add(skillId);
      this.airSupportAudit.uses.push(skillId);
      const targets = shuffled(
        this.enemies.filter((enemy) => enemy.hp > 0 && enemy.image && !enemy.image.destroyed),
        this.combatRandom || Math.random
      );
      if (skillId === "meteorite") {
        this.airSupportAudit.meteoriteTargets += targets.length;
        if (targets.length) {
          this.airSupportEvents.push({
            kind: "meteorite", targets, elapsed: 0, nextIndex: 0,
            interval: 3 / targets.length
          });
        }
      } else if (skillId === "freeze") {
        for (const enemy of targets) {
          enemy.freezeRemaining = Math.max(enemy.freezeRemaining || 0, 4);
          enemy.image.alpha = 0.72;
          this.spawnAirSupportPulse(enemy.image.x, enemy.image.y, "#83e8ff", 56);
        }
        this.airSupportAudit.frozenTargets += targets.length;
      } else if (skillId === "healing") {
        for (const ally of this.allies) {
          if (ally.hp <= 0 || !ally.image || ally.image.destroyed) continue;
          const before = ally.hp;
          ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp);
          const healed = ally.hp - before;
          this.updateAllyHealthBar(ally);
          this.airSupportAudit.healedUnits += 1;
          this.airSupportAudit.healedHp += healed;
          this.spawnDamageText(ally.image.x, ally.image.y - 70, `+${Math.round(healed)}`, "#74ff9d");
          this.spawnAirSupportPulse(ally.image.x, ally.image.y, "#74ff9d", 48);
        }
      }
      this.refreshAirSupportButtons();
      this.publishAirSupportState();
      return true;
    }

    spawnAirSupportPulse(x, y, color, radius) {
      const node = new Laya.Sprite();
      node.name = "AirSupportPulse";
      node.pos(x, y);
      node.zOrder = 850;
      node.graphics.drawCircle(0, 0, radius, null, color, 8);
      node.graphics.drawCircle(0, 0, Math.max(8, radius * 0.45), color);
      node.alpha = 0.75;
      this.actorLayer.addChild(node);
      this.effects.push({ kind: "air-support-pulse", node, clock: 0, duration: 0.55 });
    }

    updateAirSupports(delta) {
      for (let index = this.airSupportEvents.length - 1; index >= 0; index -= 1) {
        const event = this.airSupportEvents[index];
        event.elapsed += delta;
        while (event.nextIndex < event.targets.length && event.elapsed >= event.nextIndex * event.interval) {
          const target = event.targets[event.nextIndex];
          event.nextIndex += 1;
          if (!target || target.hp <= 0 || !target.image || target.image.destroyed) continue;
          this.fire(
            { x: target.image.x, y: -120 }, target, 9999,
            {
              kind: "air-support", skin: UI.airMeteorite, width: 58, height: 58,
              playerAttack: true, crit: 0, critDamage: 1, source: { x: target.image.x, y: -120 },
              projectileSpeed: 65 * PHYSICS_PIXEL_RATIO, autoFlow: true,
              deadInLast: true, forceTargetOnly: true
            }
          );
          this.spawnAirSupportPulse(target.image.x, target.image.y, "#ff8c32", 64);
          this.airSupportAudit.meteoriteImpacts += 1;
        }
        if (event.nextIndex >= event.targets.length) this.airSupportEvents.splice(index, 1);
      }
      this.publishAirSupportState();
    }

    navigateStage(offset) {
      if (this.fighting) return;
      const next = clamp(this.stageId + offset, 1, this.stages.length);
      if (next === this.stageId) return;
      if (!this.debugUi && next > this.campaignUnlockedStage()) return;
      const params = new URLSearchParams(window.location.search);
      params.set("stage", String(next));
      params.delete("test");
      window.location.search = params.toString();
    }

    normalizeCampaignProgress(value) {
      const candidate = Array.isArray(value) ? value : value && value.maxStageRecord;
      const stage = Math.max(1, Math.trunc(Number(candidate && candidate[0]) || 1));
      const wave = Math.max(0, Math.trunc(Number(candidate && candidate[1]) || 0));
      return [stage, wave];
    }

    evaluateTechEffects(profileValue) {
      const profile = this.normalizeLocalProfile(profileValue);
      const effects = {
        allUnitAttackMultiplier: 1,
        allUnitHpMultiplier: 1,
        allUnitAttackSpeedMultiplier: 1,
        allUnitSpeedMultiplier: 1,
        allUnitCritAdd: 0,
        allUnitDodgeAdd: 0,
        allDefenseAttackMultiplier: 1,
        allDefenseHpMultiplier: 1,
        allWallHpMultiplier: 1,
        baseHpAddRatio: 0,
        winRewardAddRatio: 0,
        freeRefreshCount: 0
      };
      const multiplicative = {
        AllUnitAtk: "allUnitAttackMultiplier",
        AllUnitHp: "allUnitHpMultiplier",
        AllUnitAtkSpd: "allUnitAttackSpeedMultiplier",
        AllUnitMoveSpd: "allUnitSpeedMultiplier",
        AllDefenseAtk: "allDefenseAttackMultiplier",
        AllDefenseHp: "allDefenseHpMultiplier",
        AllWallHp: "allWallHpMultiplier"
      };
      for (const row of Object.values(this.techRows || {})) {
        const level = clamp(Math.trunc(Number(profile.techLevels[row.Id]) || 0), 0, Number(row.Limit) || 1);
        if (!level || !Array.isArray(row.Effect)) continue;
        const key = row.Effect[0];
        const value = Number(row.Effect[1]) || 0;
        if (multiplicative[key]) effects[multiplicative[key]] *= Math.pow(1 + value, level);
        else if (key === "AllUnitCrit") effects.allUnitCritAdd += value * level;
        else if (key === "AllUnitDodge") effects.allUnitDodgeAdd += value * level;
        else if (key === "BaseHpMul") effects.baseHpAddRatio += value * level;
        else if (key === "Income") effects.winRewardAddRatio += value * level;
        else if (key === "FreeRefresh") effects.freeRefreshCount += value * level;
      }
      return effects;
    }

    refreshCombatMetaPolicies() {
      this.localProfile = this.loadLocalProfile();
      this.campaignProgress = this.localProfile.maxStageRecord.slice();
      this.techEffects = this.evaluateTechEffects(this.localProfile);
      this.buildingDefinitions = {};
      for (const row of this.buildingRows) this.buildingDefinitions[row.id] = this.makeBuildingDefinition(row, 1);
      this.mainBase = this.buildingRowById.e19;
    }

    normalizeLocalProfile(value, legacyProgress) {
      const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const normalizeCounts = (counts) => {
        const result = {};
        if (!counts || typeof counts !== "object" || Array.isArray(counts)) return result;
        for (const [key, value] of Object.entries(counts)) {
          const count = Math.max(0, Math.trunc(Number(value) || 0));
          if (key && count > 0) result[key] = count;
        }
        return result;
      };
      const waveChests = {};
      if (source.waveChests && typeof source.waveChests === "object" && !Array.isArray(source.waveChests)) {
        for (const [key, claimed] of Object.entries(source.waveChests)) {
          if (/^WaveChest_\d+_\d+$/.test(key) && claimed) waveChests[key] = 1;
        }
      }
      const formation = Array.isArray(source.formation)
        ? source.formation.filter((id) => /^e\d{2}$/.test(String(id))).slice(0, 4)
        : [];
      const metaTab = ["ShopLayer", "EquiptLayer", "MainPage", "Institute", "Party"].includes(source.metaTab)
        ? source.metaTab
        : "MainPage";
      return {
        version: 2,
        maxStageRecord: this.normalizeCampaignProgress(source.maxStageRecord || legacyProgress),
        waveChests,
        props: normalizeCounts(source.props),
        items: normalizeCounts(source.items),
        equipmentLevels: normalizeCounts(source.equipmentLevels),
        techLevels: normalizeCounts(source.techLevels),
        formation,
        metaTab
      };
    }

    loadLocalProfile(storage) {
      const source = storage || window.localStorage;
      let legacyProgress = [1, 0];
      try {
        const legacyRaw = source && source.getItem(this.campaignStorageKey);
        legacyProgress = this.normalizeCampaignProgress(legacyRaw ? JSON.parse(legacyRaw) : null);
      } catch (error) {
        legacyProgress = [1, 0];
      }
      try {
        const raw = source && source.getItem(this.profileStorageKey);
        return this.normalizeLocalProfile(raw ? JSON.parse(raw) : null, legacyProgress);
      } catch (error) {
        return this.normalizeLocalProfile(null, legacyProgress);
      }
    }

    saveLocalProfile(profile, storage, force) {
      const normalized = this.normalizeLocalProfile(profile);
      this.localProfile = normalized;
      this.campaignProgress = normalized.maxStageRecord.slice();
      if (!force && (this.testMode || CAPTURE_MODE)) return normalized;
      try {
        const target = storage || window.localStorage;
        if (target) {
          target.setItem(this.profileStorageKey, JSON.stringify(normalized));
          target.setItem(this.campaignStorageKey, JSON.stringify(normalized.maxStageRecord));
        }
      } catch (error) {
        console.warn("[Shoucheng local profile save failed]", error);
      }
      this.refreshWaveChestButton();
      return normalized;
    }

    loadCampaignProgress(storage) {
      return this.loadLocalProfile(storage).maxStageRecord.slice();
    }

    saveCampaignProgress(record, storage, force) {
      const normalized = this.normalizeCampaignProgress(record);
      const profile = this.normalizeLocalProfile(this.localProfile);
      profile.maxStageRecord = normalized;
      return this.saveLocalProfile(profile, storage, force).maxStageRecord.slice();
    }

    campaignUnlockedStage(record) {
      const progress = this.normalizeCampaignProgress(record || this.campaignProgress);
      return clamp(progress[0], 1, this.stages.length);
    }

    campaignProgressAfterBattle(record, stage, wave, maximumWave, victory) {
      const progress = this.normalizeCampaignProgress(record);
      const stageId = Math.max(1, Math.trunc(Number(stage) || 1));
      const maxWave = Math.max(1, Math.trunc(Number(maximumWave) || 1));
      const completedWave = victory ? maxWave : clamp(Math.trunc(Number(wave) || 0) - 1, 0, maxWave);
      if (stageId < progress[0]) return progress;
      if (stageId >= progress[0] && completedWave >= maxWave) return [progress[0] + 1, 0];
      if (stageId === progress[0] && completedWave > progress[1]) return [progress[0], completedWave];
      return progress;
    }

    applyCampaignBattleResult(victory) {
      const before = this.normalizeCampaignProgress(this.campaignProgress);
      const after = this.campaignProgressAfterBattle(
        before, this.stageId, this.currentWave, this.maxWave, victory
      );
      this.saveCampaignProgress(after);
      return {
        before,
        after,
        stageAdvanced: after[0] > before[0],
        unlockedStage: this.campaignUnlockedStage(after)
      };
    }

    waveChestRecordKey(stageId, bundleIndex) {
      return `WaveChest_${Math.trunc(Number(stageId) || 0)}_${Math.trunc(Number(bundleIndex) || 0)}`;
    }

    effectiveWaveChestRewards(stageId, bundleIndex) {
      const stage = this.stages[Math.trunc(Number(stageId) || 0) - 1];
      const bundles = stage && Array.isArray(stage.chestRewards) ? stage.chestRewards : [];
      const source = bundles[Math.trunc(Number(bundleIndex) || 0)];
      if (!Array.isArray(source)) return [];
      const additions = this.fightParams.ChestRewardAdd || {};
      const staminaEnabled = window.PAY_AD_ENABLE_ST !== "NONE";
      return source.reduce((rewards, entry) => {
        if (!Array.isArray(entry) || entry.length < 3) return rewards;
        const kind = entry[0];
        const id = entry[1];
        let count = Math.max(0, Math.trunc(Number(entry[2]) || 0));
        if (kind === "Prop" && id === "Stamina") {
          if (!staminaEnabled) return rewards;
          count = Math.max(1, count + (Number(additions.Stamina) || 0));
        } else if (kind === "Prop" && id === "Diamond") {
          count = Math.max(1, count + (Number(additions.Diamond) || 0));
        }
        if ((kind === "Prop" || kind === "Item") && id && count > 0) rewards.push([kind, id, count]);
        return rewards;
      }, []);
    }

    waveChestState(stageId, bundleIndex, profile) {
      const stage = this.stages[Math.trunc(Number(stageId) || 0) - 1];
      const milestones = stage && Array.isArray(stage.rewardWave) ? stage.rewardWave : [];
      const index = Math.trunc(Number(bundleIndex));
      if (!stage || index < 0 || index >= milestones.length) return { eligible: false, claimed: false, error: "ParamsError" };
      const current = this.normalizeLocalProfile(profile || this.localProfile);
      const progress = current.maxStageRecord;
      const milestone = Number(milestones[index]) || 0;
      const unlocked = stage.id < progress[0] || (stage.id === progress[0] && milestone <= progress[1]);
      const key = this.waveChestRecordKey(stage.id, index);
      const claimed = !!current.waveChests[key];
      return {
        eligible: unlocked && !claimed,
        unlocked,
        claimed,
        milestone,
        key,
        rewards: this.effectiveWaveChestRewards(stage.id, index),
        error: claimed ? "BoxHasBeenObtained" : unlocked ? null : stage.id > progress[0] ? "StageUnlock" : "WaveNotEnough"
      };
    }

    claimWaveChest(stageId, bundleIndex, storage, force) {
      const profile = this.loadLocalProfile(storage);
      const state = this.waveChestState(stageId, bundleIndex, profile);
      if (!state.eligible) return { ok: false, error: state.error, state, profile };
      const next = this.normalizeLocalProfile(profile);
      for (const [kind, id, count] of state.rewards) {
        const target = kind === "Prop" ? next.props : next.items;
        target[id] = (target[id] || 0) + count;
      }
      next.waveChests[state.key] = 1;
      const saved = this.saveLocalProfile(next, storage, force);
      return { ok: true, rewards: state.rewards.map((entry) => entry.slice()), profile: saved };
    }

    countClaimableWaveChests(stageId, profile) {
      const stage = this.stages[Math.trunc(Number(stageId) || 0) - 1];
      if (!stage || !Array.isArray(stage.rewardWave)) return 0;
      return stage.rewardWave.reduce((count, milestone, index) => count + (this.waveChestState(stage.id, index, profile).eligible ? 1 : 0), 0);
    }

    refreshWaveChestButton() {
      if (!this.waveChestButton || this.waveChestButton.destroyed) return;
      const claimable = this.countClaimableWaveChests(this.stageId);
      const label = this.waveChestButton.getChildAt(0);
      if (label) label.text = claimable ? `宝箱 ${claimable}` : "宝箱";
      this.waveChestButton.gray = claimable === 0;
    }

    rewardDisplayName(id) {
      return ({ Money: "银币", Stamina: "体力", Diamond: "钻石", NormalRandomChip: "普通随机碎片", HighRandomChip: "高级随机碎片" })[id] || id;
    }

    rewardBundleText(rewards) {
      return rewards.map((entry) => `${this.rewardDisplayName(entry[1])} ×${entry[2]}`).join("  ");
    }

    openWaveChestPanel() {
      if (this.fighting || this.finished || this.overlayLayer.getChildByName("WaveChestShade")) return;
      const shade = addRect(this.overlayLayer, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, "#000000", 0.66, "WaveChestShade");
      shade.mouseEnabled = true;
      const panel = addRect(this.overlayLayer, 55, 285, 640, 720, "#24324a", 0.98, "WaveChestPanel");
      panel.mouseEnabled = true;
      const closePanel = () => {
        if (!shade.destroyed) shade.destroy(true);
        if (!panel.destroyed) panel.destroy(true);
        this.refreshWaveChestButton();
      };
      addLabel(panel, `关卡 ${this.stageId} · 波次宝箱`, 35, 24, 500, 56, 32);
      this.makeButton(panel, "×", UI.grayButton, 555, 18, 58, 52, closePanel, 27);
      const profile = this.normalizeLocalProfile(this.localProfile);
      const assets = [`银币 ${profile.props.Money || 0}`, `体力 ${profile.props.Stamina || 0}`, `钻石 ${profile.props.Diamond || 0}`];
      addLabel(panel, assets.join("  ·  "), 34, 82, 570, 42, 19);
      const stage = this.stageConfig;
      stage.rewardWave.forEach((milestone, index) => {
        const state = this.waveChestState(stage.id, index);
        const y = 140 + index * 160;
        const row = addRect(panel, 28, y, 584, 136, state.eligible ? "#365c3f" : "#151d2b", 0.96, `WaveChestRow_${index}`);
        addLabel(row, `里程碑 ${milestone} 波`, 22, 14, 250, 36, 23);
        addLabel(row, this.rewardBundleText(state.rewards), 22, 55, 535, 54, 18);
        const buttonText = state.claimed ? "已领取" : state.eligible ? "领取" : "未达成";
        const button = this.makeButton(row, buttonText, state.eligible ? UI.orangeButton : UI.grayButton, 430, 11, 132, 46, () => {
          if (!this.waveChestState(stage.id, index).eligible) return;
          const claimed = this.claimWaveChest(stage.id, index);
          if (!claimed.ok) return;
          closePanel();
          this.openWaveChestPanel();
        }, 19);
        button.gray = !state.eligible;
        button.mouseEnabled = state.eligible;
      });
      addLabel(panel, "宝箱按原版规则手动领取；战斗胜利不会代领。", 32, 638, 575, 45, 18);
    }

    buildShop() {
      addImage(this.shopLayer, UI.shop, 0, 957, DESIGN_WIDTH, 347, "ShopPanel");
      this.pageBackButton = this.makeButton(this.shopLayer, "‹", UI.grayButton, 14, 1000, 46, 40, () => this.changeShopPage(-1), 25);
      this.pageText = addLabel(this.shopLayer, "建筑 1/6", 275, 990, 200, 38, 18);
      this.pageNextButton = this.makeButton(this.shopLayer, "›", UI.grayButton, 690, 1000, 46, 40, () => this.changeShopPage(1), 25);
      this.pageBackButton.visible = this.debugUi;
      this.pageText.visible = this.debugUi;
      this.pageNextButton.visible = this.debugUi;
      this.ensureShopSlotCount(3);
      const buttonY = 1177;
      this.adRefreshButton = this.makeButton(this.shopLayer, "刷新\n必出2级装备", UI.blueButton, 35, buttonY, 215, 89, () => this.specialRefresh(), 24);
      addImage(this.adRefreshButton, UI.ad, 47, 5, 42, 37, "AdIcon");
      this.refreshButton = this.makeButton(this.shopLayer, "刷新", UI.greenButton, 267, buttonY, 215, 89, () => this.normalRefresh(), 31);
      this.refreshCostBack = addRect(this.refreshButton, 56, 47, 102, 29, "#050908", 1, "RefreshCost_Back");
      this.refreshCostIcon = addImage(this.refreshButton, UI.money, 69, 48, 27, 26, "RefreshCost_Icon");
      this.refreshCostText = addLabel(this.refreshButton, "15", 100, 45, 51, 33, 22);
      this.setRefreshCostDisplay(false);
      this.startButton = this.makeButton(this.shopLayer, "开战", UI.orangeButton, 499, buttonY, 215, 89, () => this.requestStartFight(), 34);
      this.configureShopPage();
    }

    makeButton(parent, text, skin, x, y, width, height, handler, fontSize) {
      const button = new Laya.Image(skin);
      setTopLeft(button, x, y, width, height);
      button.mouseEnabled = true;
      parent.addChild(button);
      addLabel(button, text, 0, 0, width, height, fontSize || 30);
      button.on(Laya.Event.CLICK, this, handler);
      button.on(Laya.Event.MOUSE_DOWN, this, () => { button.alpha = 0.82; });
      button.on(Laya.Event.MOUSE_UP, this, () => { button.alpha = 1; });
      button.on(Laya.Event.MOUSE_OUT, this, () => { button.alpha = 1; });
      return button;
    }

    setRefreshCostDisplay(visible) {
      this.refreshCostBack.visible = visible;
      this.refreshCostIcon.visible = visible;
      this.refreshCostText.visible = visible;
      const title = this.refreshButton.getChildAt(0);
      title.size(215, visible ? 48 : 89);
    }

    createShopSlot(slotIndex, x, y, width, height) {
      const back = addRect(this.shopLayer, x, y, width, height, "#131523", 0.52, `CatalogSlot_${slotIndex}`);
      back.visible = false;
      const usedBack = addImage(this.shopLayer, UI.grayButton, x + (width - 70) / 2, y + height - 102, 70, 70, `CatalogUsed_${slotIndex}`);
      usedBack.visible = false;
      const image = addImage(this.shopLayer, "", x, y, 1, 1, `CatalogItem_${slotIndex}`);
      image.mouseEnabled = true;
      image.on(Laya.Event.MOUSE_DOWN, this, () => this.beginShopDrag(slotIndex));
      const name = addLabel(this.shopLayer, "", x - 8, y + height - 30, width + 16, 30, 16);
      name.visible = false;
      this.shopItems.push({ slotIndex, back, usedBack, image, name, x, y, width, height, definition: null, available: true, returnedState: null });
    }

    shopVisibleItemCount() {
      return clamp(Math.trunc(3 + (this.traitEffects.ShopFreeItem || 0)), 1, 6);
    }

    ensureShopSlotCount(requestedCount) {
      // Normal rolls remain capped by shopVisibleItemCount() at six. Returned
      // deployed pieces may temporarily extend the unused bench until refresh.
      const count = clamp(Math.trunc(requestedCount || 3), 1, 24);
      while (this.shopItems.length < count) this.createShopSlot(this.shopItems.length, 0, 954, 150, 185);
      while (this.shopItems.length > count) {
        const item = this.shopItems.pop();
        for (const node of [item.back, item.usedBack, item.image, item.name]) if (node && !node.destroyed) node.destroy(true);
      }
      const threeSlotX = [150, 285, 438];
      this.shopItems.forEach((item, index) => {
        const fourOrMore = count >= 4;
        const width = fourOrMore ? Math.floor(660 / count) : 180;
        const x = fourOrMore ? 45 + index * width : threeSlotX[index];
        const y = 954;
        const height = 185;
        Object.assign(item, { x, y, width, height });
        item.back.pos(x, y);
        item.back.size(width, height);
        item.back.graphics.clear();
        item.back.graphics.drawRect(0, 0, width, height, "#131523");
        item.back.alpha = 0.52;
        item.usedBack.pos(x + (width - 70) / 2, y + height - 102);
        item.name.pos(x - 8, y + height - 30);
        item.name.size(width + 16, 30);
        if (item.definition) {
          this.applyDefinitionImage(item.image, item.definition, width, height - 24, false);
          item.image.pos(x + (width - item.image.width) / 2, y + height - 25 - item.image.height);
        }
      });
    }

    changeShopPage(offset) {
      if (this.fighting || this.drag) return;
      const pageCount = Math.ceil(SHOP_ORDER.length / 3);
      this.shopPage = (this.shopPage + offset + pageCount) % pageCount;
      this.configureShopPage();
    }

    configureShopPage() {
      const pageCount = Math.ceil(SHOP_ORDER.length / 3);
      this.pageText.text = `建筑图鉴 ${this.shopPage + 1}/${pageCount}`;
      const definitions = this.shopItems.map((item, index) => {
        const id = SHOP_ORDER[this.shopPage * 3 + index];
        const row = this.buildingRowById[id];
        return row ? this.makeBuildingDefinition(row, this.shopLevel) : null;
      });
      this.renderShopDefinitions(definitions);
    }

    renderShopDefinitions(definitions) {
      this.shopItems.forEach((item, index) => {
        item.definition = definitions[index] || null;
        item.returnedState = null;
        item.available = !!item.definition;
        item.usedBack.visible = false;
        item.image.visible = !!item.definition;
        item.name.visible = this.debugUi && !!item.definition;
        if (!item.definition) return;
        this.applyDefinitionImage(item.image, item.definition, item.width, item.height - 24, false);
        item.image.pos(item.x + (item.width - item.image.width) / 2, item.y + item.height - 25 - item.image.height);
        item.image.alpha = 1;
        item.name.text = `${item.definition.id.toUpperCase()} · ${this.className(item.definition.class)}${item.definition.level > 1 ? ` Lv.${item.definition.level}` : ""}`;
      });
    }

    randomItem(values) {
      if (!values.length) return null;
      return values[Math.floor(this.shopRandom() * values.length)];
    }

    shopSeed() {
      // Stage 2 seed is chosen to reproduce the supplied recording's e02-Lv2/e07-Lv1/e16-Lv1 opening roll.
      return this.stageId === 2 ? 677 : this.stageId * 100003 + 2131;
    }

    shopLevelWeights() {
      const wave = Math.max(1, this.currentWave || 1);
      const level3 = clamp(0.06 + (wave - 1) / 5 * 0.015, 0, 1);
      const level2 = clamp(0.06 + (wave - 1) / 5 * 0.03 + (this.traitEffects.ShopQ2RateUp || 0), 0, 1 - level3);
      return [Math.max(0, 1 - level2 - level3), level2, level3];
    }

    randomBuildingDefinition(rows, uniformLevels, forcedLevel) {
      const row = this.randomItem(rows);
      if (!row) return null;
      const level = forcedLevel || (uniformLevels
        ? 1 + Math.floor(this.shopRandom() * 3)
        : 1 + weightedIndex(this.shopLevelWeights(), this.shopRandom));
      return this.makeBuildingDefinition(row, level);
    }

    makeSlotDefinition(shapeRow) {
      const parsed = parseShape(shapeRow.shape);
      return Object.assign({}, parsed, {
        id: `slot-${shapeRow.id}`,
        key: `slot-${shapeRow.id}`,
        class: "slot",
        level: 0,
        skin: "",
        slotShapeId: String(shapeRow.id),
        shopWeight: shapeRow.shopWeight,
        needAd: !!shapeRow.needAd
      });
    }

    randomSlotDefinition() {
      const candidates = this.slotShapes.filter((shape) => Number(shape.shopWeight) > 0);
      if (!candidates.length) return null;
      const index = weightedIndex(candidates.map((shape) => shape.shopWeight), this.shopRandom);
      return this.makeSlotDefinition(candidates[index]);
    }

    weightedShopDefinition(forcedLevel) {
      const typeWeights = this.stageConfig.storeItemTypeWeight || [900, 0, 100];
      let type = weightedIndex(typeWeights, this.shopRandom);
      const normalRows = this.buildingRows.filter((row) => !["main", "gold"].includes(row.class));
      const goldRows = this.buildingRows.filter((row) => row.class === "gold");
      if (type === 2) {
        const slot = this.randomSlotDefinition();
        if (slot) {
          this.lastSlotRefresh = this.shopRefreshCount;
          return slot;
        }
        type = 0;
      }
      return this.randomBuildingDefinition(type === 1 && goldRows.length ? goldRows : normalRows, false, forcedLevel);
    }

    rollShop(special) {
      this.shopRefreshCount += 1;
      const visibleCount = this.shopVisibleItemCount();
      this.ensureShopSlotCount(visibleCount);
      let definitions = [];
      if (special) {
        definitions.push(this.weightedShopDefinition(2));
      } else if (this.shopRefreshCount === 1) {
        definitions.push(this.randomBuildingDefinition(this.buildingRows.filter((row) => row.class === "barracks"), true));
        definitions.push(this.randomBuildingDefinition(this.buildingRows.filter((row) => row.class === "defense"), true));
      } else {
        const guaranteedEvery = this.fightParams.BugGuaranteedRefreshCount || 4;
        const sinceSlot = this.shopRefreshCount - this.lastSlotRefresh;
        if (sinceSlot >= guaranteedEvery && sinceSlot % guaranteedEvery === 0) {
          const slot = this.randomSlotDefinition();
          if (slot) {
            definitions.push(slot);
            this.lastSlotRefresh = this.shopRefreshCount;
          }
        }
      }
      while (definitions.length < visibleCount) definitions.push(this.weightedShopDefinition());
      definitions = definitions.slice(0, visibleCount);
      this.renderShopDefinitions(definitions);
      const record = {
        refresh: this.shopRefreshCount,
        special: !!special,
        items: definitions.map((definition) => ({ id: definition.id, class: definition.class, level: definition.level || 0 }))
      };
      this.shopRollHistory.push(record);
      document.body.dataset.restoreShop = JSON.stringify(record);
    }

    className(className) {
      return {
        barracks: "兵营", defense: "防御塔", exp: "水晶", move: "减速", crit: "暴击",
        roundSpeed: "攻速", roundAtk: "攻击", wall: "城防", gold: "矿场", main: "城堡", slot: "扩建格"
      }[className] || className;
    }

    textureSize(skin) {
      const texture = Laya.loader.getRes(skin);
      return {
        width: texture ? (texture.sourceWidth || texture.width || 100) : 100,
        height: texture ? (texture.sourceHeight || texture.height || 100) : 100
      };
    }

    applyDefinitionImage(image, definition, boxWidth, boxHeight, allowUpscale) {
      image.graphics.clear();
      if (definition.class === "slot") {
        image.skin = "";
        const cell = Math.min(CELL_SIZE, boxWidth / Math.max(1, definition.width), boxHeight / Math.max(1, definition.height));
        image.size(definition.width * cell, definition.height * cell);
        const color = this.themeColor();
        for (const [offsetX, offsetY] of definition.cells) {
          const x = offsetX * cell;
          const y = offsetY * cell;
          image.graphics.drawRect(x + 1, y + 1, cell - 2, cell - 2, color);
          image.graphics.drawRect(x + 4, y + 4, cell - 8, cell - 8, null, "#d8f6b8", Math.max(2, cell * 0.055));
        }
        return cell / CELL_SIZE;
      }
      const natural = this.textureSize(definition.skin);
      const maximumScale = allowUpscale ? Number.POSITIVE_INFINITY : 1;
      const scale = Math.min(maximumScale, boxWidth / natural.width, boxHeight / natural.height);
      image.skin = definition.skin;
      image.size(natural.width * scale, natural.height * scale);
      for (const childName of ["LevelOverlay", "WeaponMount"]) {
        const previousChild = image.getChildByName(childName);
        if (previousChild) previousChild.destroy(true);
      }
      if (definition.weaponMount) {
        const mountNatural = this.textureSize(definition.weaponMount.skin);
        const mount = addImage(
          image,
          definition.weaponMount.skin,
          image.width * definition.weaponMount.x,
          image.height * definition.weaponMount.y,
          mountNatural.width * scale,
          mountNatural.height * scale,
          "WeaponMount"
        );
        mount.pivot(
          mount.width * definition.weaponMount.pivot[0],
          mount.height * definition.weaponMount.pivot[1]
        );
        mount.rotation = -90;
        mount.zOrder = 3;
      }
      return scale;
    }

    resetOccupied() {
      for (let column = 0; column < COLS; column += 1) {
        for (let row = 0; row < ROWS; row += 1) {
          const value = this.mapData[row][column];
          this.occupied[column][row] = value === "2" ? -2 : value === "o" ? -3 : 0;
        }
      }
      for (let x = 0; x < 3; x += 1) {
        for (let y = 0; y < 2; y += 1) this.occupied[this.castlePosition.column + x][this.castlePosition.row + y] = -1;
      }
      for (const building of this.buildings) this.markOccupied(building, building.id);
    }

    resetRun() {
      this.clearCombatObjects();
      for (const building of this.buildings) {
        if (building.image && !building.image.destroyed) building.image.destroy(true);
        if (building.hpBack && !building.hpBack.destroyed) building.hpBack.destroy(true);
      }
      this.buildings.length = 0;
      this.obstacleClearCount = 0;
      this.resetMapExpansion();
      this.nextBuildingId = 1;
      this.currentWave = 1;
      this.money = 0;
      this.battleExp = 0;
      this.fightLevel = 0;
      this.fightLevelExp = 0;
      this.activeTraits = [];
      this.traitSelecting = false;
      this.traitPanel = null;
      this.traitEffects = {
        AllUnitAtk: 0, AllUnitHp: 0, EnemySpeedDown: 0, AllUnitAtkSpd: 0,
        ExpUp: 0, CoinsUp: 0, RangedUnitAtkRange: 0, ShopQ2RateUp: 0,
        ShopFreeItem: 0, ShopConsume: 0, DmgUpWithCnt: 0, WinRewardUp: 0,
        BossDmgUp: 0, Interest: 0
      };
      this.ensureShopSlotCount(3);
      this.kills = 0;
      this.castleMaxHp = (this.mainBase ? this.mainBase.hp : 975) * (1 + ((this.techEffects && this.techEffects.baseHpAddRatio) || 0));
      this.castleHp = this.castleMaxHp;
      this.spawnedThisWave = 0;
      this.killedThisWave = 0;
      this.resolvedThisWave = 0;
      this.waveRoster = [];
      this.waveCoinRoster = [];
      this.waveSpawnDelays = [];
      this.spawnClock = 0;
      this.speed = 1;
      this.fighting = false;
      this.paused = false;
      this.pauseButton.alpha = 1;
      this.speedButton.getChildAt(0).text = "×1";
      this.firstFreeRefresh = true;
      this.techFreeRefreshRemaining = Math.max(0, Math.trunc((this.techEffects && this.techEffects.freeRefreshCount) || 0));
      this.adRefreshUsed = false;
      this.finished = false;
      this.shopPage = 0;
      this.shopLevel = 1;
      this.shopRefreshCount = 0;
      this.lastSlotRefresh = 0;
      this.shopRollHistory = [];
      this.shopRandom = (CAPTURE_MODE || this.testMode) ? seededRandom(this.shopSeed()) : Math.random;
      this.combatRandom = (CAPTURE_MODE || this.testMode)
        ? seededRandom(this.stageId * 100003 + 4099)
        : Math.random;
      this.routeRandomSource = (CAPTURE_MODE || this.testMode)
        ? seededRandom(this.stageId * 23003 + 97)
        : Math.random;
      this.outcomeRandom = (CAPTURE_MODE || this.testMode) ? seededRandom(1) : Math.random;
      this.spawnRandom = (CAPTURE_MODE || this.testMode)
        ? seededRandom(this.stageId * 17011 + 51)
        : this.outcomeRandom;
      this.spawnPositionRandom = (CAPTURE_MODE || this.testMode)
        ? seededRandom(this.stageId * 19001 + 83)
        : this.outcomeRandom;
      this.traitRandom = (CAPTURE_MODE || this.testMode) ? seededRandom(this.stageId * 13007 + 73) : Math.random;
      this.resetAirSupport();
      while (this.overlayLayer.numChildren) this.overlayLayer.removeChildAt(0).destroy(true);
      this.shopLayer.visible = true;
      this.setBattlePresentation(false);
      this.setCombatCountersVisible(false);
      this.speedButton.visible = false;
      this.setAirSupportVisible(false);
      this.pauseButton.visible = true;
      // Keep the local campaign navigation available during normal play, but omit it
      // from matched capture routes because the original battle recording has no
      // reconstruction-only stage controls in the HUD.
      this.setStageNavigationVisible(!CAPTURE_MODE);
      for (const badge of this.treeBadges) badge.visible = true;
      this.setRefreshCostDisplay(false);
      this.adRefreshButton.gray = false;
      if (this.testMode || this.debugUi) this.configureShopPage();
      else this.rollShop(false);
      this.resetOccupied();
      this.refreshTreeBadges();
      this.refreshHud();
      delete document.body.dataset.restoreResult;
      this.publishState();
    }

    setStageNavigationVisible(visible) {
      const show = !!visible;
      this.previousStageButton.visible = show;
      this.nextStageButton.visible = show;
      this.stageText.visible = show;
      this.stageNameText.visible = show;
      this.waveChestButton.visible = show;
      if (show) {
        this.previousStageButton.gray = this.stageId <= 1;
        this.nextStageButton.gray = !this.debugUi && this.stageId >= this.campaignUnlockedStage();
        this.refreshWaveChestButton();
      }
    }

    setCombatCountersVisible(visible) {
      this.killsBack.visible = visible;
      this.killsIcon.visible = visible;
      this.killsText.visible = visible;
    }

    setBattlePresentation(fighting) {
      this.stageContentOffset = fighting ? SHOP_SCENE_SHIFT : 0;
      this.background.y = fighting ? 0 : -SHOP_SCENE_SHIFT;
      this.gridLayer.y = this.stageContentOffset;
      this.buildingLayer.y = this.stageContentOffset;
      this.actorLayer.visible = fighting;
      this.projectileLayer.visible = fighting;
      this.castleHpBack.visible = fighting;
      this.castleHpIcon.visible = fighting;
      for (const building of this.buildings) if (building.hpBack) building.hpBack.visible = fighting;
      this.castleCenter.x = this.castleBaseCenter.x;
      this.castleCenter.y = this.castleBaseCenter.y + this.stageContentOffset;
    }

    refreshCost() {
      let cost = this.fightParams.StoreRefreshPrice || 15;
      for (const trait of this.activeTraits) if (trait.effectKey === "ShopConsume") cost = Math.round(cost / (1 + trait.value));
      return cost;
    }

    normalRefresh() {
      if (this.fighting || this.finished) return;
      if (this.firstFreeRefresh) this.firstFreeRefresh = false;
      else if (this.techFreeRefreshRemaining > 0) this.techFreeRefreshRemaining -= 1;
      else {
        const cost = this.refreshCost();
        if (this.money < cost) return;
        this.money -= cost;
      }
      this.shopLevel = 1;
      this.rollShop(false);
      this.refreshCostText.text = String(this.refreshCost());
      this.setRefreshCostDisplay(this.techFreeRefreshRemaining <= 0);
      this.refreshHud();
    }

    specialRefresh() {
      if (this.fighting || this.finished || this.adRefreshUsed) return;
      this.adRefreshUsed = true;
      this.adRefreshButton.gray = true;
      this.shopLevel = 2;
      this.rollShop(true);
    }

    beginShopDrag(slotIndex) {
      if (this.fighting || this.finished || this.drag) return;
      const item = this.shopItems[slotIndex];
      if (!item || !item.available || !item.definition) return;
      this.beginDrag(item.definition, item, null);
    }

    beginBuildingDrag(building) {
      if (this.fighting || this.finished || this.drag) return;
      this.markOccupied(building, 0);
      building.image.visible = false;
      this.beginDrag(building.definition, null, building);
    }

    beginDrag(definition, shopItem, existing) {
      const ghost = new Laya.Image(definition.skin);
      this.applyDefinitionImage(ghost, definition, definition.width * CELL_STEP - CELL_GAP, definition.height * CELL_STEP - CELL_GAP, false);
      ghost.pivot(ghost.width / 2, ghost.height / 2);
      ghost.alpha = 0.78;
      ghost.zOrder = 500;
      ghost.mouseEnabled = false;
      this.root.addChild(ghost);
      this.drag = {
        definition,
        shopItem,
        existing,
        ghost,
        original: existing ? { column: existing.column, row: existing.row } : null
      };
      this.updateDrag();
      Laya.stage.on(Laya.Event.MOUSE_MOVE, this, this.updateDrag);
      Laya.stage.once(Laya.Event.MOUSE_UP, this, this.endDrag);
      Laya.stage.once(Laya.Event.MOUSE_OUT, this, this.endDrag);
    }

    updateDrag() {
      this.updateDragAt(Laya.stage.mouseX, Laya.stage.mouseY);
    }

    updateDragAt(stageX, stageY) {
      if (!this.drag) return;
      const definition = this.drag.definition;
      const topLeftX = stageX - definition.width * CELL_STEP * 0.5;
      const topLeftY = stageY - definition.height * CELL_STEP * 0.5;
      const column = Math.round((topLeftX - GRID_X) / CELL_STEP);
      const row = Math.round((topLeftY - GRID_Y) / CELL_STEP);
      const shopMergeTarget = this.findShopMergeTarget(definition, stageX, stageY, this.drag.shopItem, this.drag.ghost);
      const mergeTarget = shopMergeTarget ? null : this.findMergeTarget(definition, column, row, this.drag.existing);
      const replacementTargets = shopMergeTarget || mergeTarget
        ? null : this.findReplacementBuildings(definition, column, row, this.drag.existing);
      const valid = !!mergeTarget || this.canPlace(definition, column, row)
        || !!(replacementTargets && replacementTargets.length);
      const returnToShop = !!this.drag.existing && !shopMergeTarget && !valid;
      this.drag.ghost.pos(stageX, stageY);
      this.drag.ghost.alpha = valid || returnToShop || shopMergeTarget ? 0.96 : 0.68;
      this.drag.candidate = { column, row, valid, mergeTarget, shopMergeTarget, replacementTargets, returnToShop };
      if (shopMergeTarget || returnToShop) this.clearDragHighlight();
      else this.drawDragHighlight(definition, column, row, valid);
    }

    drawDragHighlight(definition, column, row, valid) {
      this.dragHighlightLayer.graphics.clear();
      const fill = valid ? "#22f33f" : "#ef3b35";
      const edge = valid ? "#56ff63" : "#ff746f";
      for (const [offsetX, offsetY] of definition.cells) {
        const x = GRID_X + (column + offsetX) * CELL_STEP;
        const y = GRID_Y + (row + offsetY) * CELL_STEP;
        this.dragHighlightLayer.graphics.drawRect(x, y, CELL_SIZE, CELL_SIZE, fill);
        this.dragHighlightLayer.graphics.drawRect(x + 3, y + 3, CELL_SIZE - 6, CELL_SIZE - 6, null, edge, 4);
      }
      this.dragHighlightLayer.alpha = valid ? 0.72 : 0.58;
      this.dragHighlightLayer.visible = true;
    }

    clearDragHighlight() {
      this.dragHighlightLayer.graphics.clear();
      this.dragHighlightLayer.visible = false;
    }

    endDrag() {
      this.finishDragAt(Laya.stage.mouseX, Laya.stage.mouseY);
    }

    isShopBenchPoint(stageX, stageY) {
      return !!this.shopLayer.visible
        && stageX >= 0 && stageX <= DESIGN_WIDTH
        && stageY >= SHOP_BENCH_TOP && stageY <= SHOP_BENCH_BOTTOM;
    }

    findShopMergeTarget(definition, stageX, stageY, sourceShopItem, ghost) {
      if (!definition || !this.shopLayer.visible) return null;
      const width = ghost && ghost.width ? ghost.width : definition.width * CELL_STEP - CELL_GAP;
      const height = ghost && ghost.height ? ghost.height : definition.height * CELL_STEP - CELL_GAP;
      const left = stageX - width / 2;
      const top = stageY - height / 2;
      return this.shopItems.find((item) => {
        if (!item || item === sourceShopItem || !item.available || !item.definition || !item.image.visible) return false;
        if (!this.canMergeDefinitions(definition, item.definition)) return false;
        const itemLeft = item.image.x;
        const itemTop = item.image.y;
        const itemRight = itemLeft + item.image.width;
        const itemBottom = itemTop + item.image.height;
        return left < itemRight && left + width > itemLeft && top < itemBottom && top + height > itemTop;
      }) || null;
    }

    finishDragAt(stageX, stageY) {
      if (!this.drag) return;
      Laya.stage.off(Laya.Event.MOUSE_MOVE, this, this.updateDrag);
      Laya.stage.off(Laya.Event.MOUSE_UP, this, this.endDrag);
      Laya.stage.off(Laya.Event.MOUSE_OUT, this, this.endDrag);
      const drag = this.drag;
      this.drag = null;
      this.clearDragHighlight();
      const definition = drag.definition;
      const topLeftX = stageX - definition.width * CELL_STEP * 0.5;
      const topLeftY = stageY - definition.height * CELL_STEP * 0.5;
      const column = Math.round((topLeftX - GRID_X) / CELL_STEP);
      const row = Math.round((topLeftY - GRID_Y) / CELL_STEP);
      const shopMergeTarget = this.findShopMergeTarget(definition, stageX, stageY, drag.shopItem, drag.ghost);
      const mergeTarget = shopMergeTarget ? null : this.findMergeTarget(definition, column, row, drag.existing);
      const replacementTargets = shopMergeTarget || mergeTarget
        ? null : this.findReplacementBuildings(definition, column, row, drag.existing);
      const valid = !!mergeTarget || this.canPlace(definition, column, row)
        || !!(replacementTargets && replacementTargets.length);
      drag.ghost.destroy(true);
      if (shopMergeTarget) {
        this.mergeShopItemInto(shopMergeTarget, drag.existing, drag.shopItem);
      } else if (mergeTarget) {
        this.mergeBuildingInto(mergeTarget, drag.existing);
        this.consumeShopItem(drag.shopItem);
      } else if (replacementTargets && replacementTargets.length) {
        if (!this.replaceBuildingsAt(definition, column, row, drag, replacementTargets) && drag.existing) {
          drag.existing.image.visible = true;
          this.markOccupied(drag.existing, drag.existing.id);
        }
      } else if (valid) {
        if (definition.class === "slot") {
          this.placeSlotExpansion(definition, column, row);
        } else if (drag.existing) {
          drag.existing.column = column;
          drag.existing.row = row;
          this.positionBuilding(drag.existing);
          drag.existing.image.visible = true;
          this.markOccupied(drag.existing, drag.existing.id);
        } else {
          const building = this.placeBuilding(definition, column, row, drag.shopItem && drag.shopItem.returnedState);
          this.markOccupied(building, building.id);
        }
        this.consumeShopItem(drag.shopItem);
      } else if (drag.existing) {
        // BuildItem.allow2Shop=true in the original: an unlocked deployed item
        // returns to the unused shop list whenever the drop has no valid floor.
        if (!this.returnBuildingToShop(drag.existing)) {
          drag.existing.image.visible = true;
          this.markOccupied(drag.existing, drag.existing.id);
        }
      }
    }

    consumeShopItem(shopItem) {
      if (!shopItem) return;
      shopItem.available = false;
      shopItem.image.visible = false;
      shopItem.returnedState = null;
      for (const childName of ["LevelOverlay", "WeaponMount"]) {
        const child = shopItem.image.getChildByName(childName);
        if (child) child.destroy(true);
      }
      // The original shop leaves a consumed slot empty.  The gray button skin
      // was a reconstruction placeholder and must never remain after placement.
      shopItem.usedBack.visible = false;
    }

    mergeShopItemInto(targetItem, sourceBuilding, sourceShopItem) {
      if (!targetItem || !targetItem.definition) return false;
      const sourceDefinition = sourceBuilding ? sourceBuilding.definition : sourceShopItem && sourceShopItem.definition;
      if (!this.canMergeDefinitions(sourceDefinition, targetItem.definition)) return false;
      const nextDefinition = this.makeBuildingDefinition(
        this.buildingRowById[targetItem.definition.id],
        targetItem.definition.level + 1
      );
      targetItem.definition = nextDefinition;
      targetItem.returnedState = null;
      targetItem.available = true;
      targetItem.image.visible = true;
      targetItem.image.alpha = 1;
      this.applyDefinitionImage(targetItem.image, nextDefinition, targetItem.width, targetItem.height - 24, false);
      targetItem.image.pos(
        targetItem.x + (targetItem.width - targetItem.image.width) / 2,
        targetItem.y + targetItem.height - 25 - targetItem.image.height
      );
      targetItem.name.text = `${nextDefinition.id.toUpperCase()} · ${this.className(nextDefinition.class)} Lv.${nextDefinition.level}`;
      targetItem.name.visible = this.debugUi;
      if (sourceBuilding) this.removeBuilding(sourceBuilding, false);
      if (sourceShopItem) this.consumeShopItem(sourceShopItem);
      return true;
    }

    returnBuildingToShop(building, clearOccupied) {
      if (!building || !this.buildings.includes(building)) return null;
      let shopItem = this.shopItems.find((item) => !item.available);
      if (!shopItem) {
        const previousCount = this.shopItems.length;
        this.ensureShopSlotCount(previousCount + 1);
        shopItem = this.shopItems[previousCount];
      }
      if (!shopItem) return null;
      const state = {
        hp: Math.max(0, building.hp),
        maxHp: Math.max(1, building.maxHp),
        cooldown: Math.max(0, building.cooldown || 0)
      };
      shopItem.definition = building.definition;
      shopItem.returnedState = state;
      shopItem.available = true;
      shopItem.usedBack.visible = false;
      shopItem.image.visible = true;
      shopItem.image.alpha = 1;
      shopItem.name.visible = this.debugUi;
      shopItem.name.text = `${building.definition.id.toUpperCase()} · ${this.className(building.definition.class)}${building.definition.level > 1 ? ` Lv.${building.definition.level}` : ""}`;
      this.applyDefinitionImage(shopItem.image, building.definition, shopItem.width, shopItem.height - 24, false);
      shopItem.image.pos(
        shopItem.x + (shopItem.width - shopItem.image.width) / 2,
        shopItem.y + shopItem.height - 25 - shopItem.image.height
      );
      this.removeBuilding(building, clearOccupied !== false);
      return shopItem;
    }

    findReplacementBuildings(definition, column, row, sourceBuilding) {
      if (!definition || definition.class === "slot") return null;
      if (column < 0 || row < 0 || column + definition.width > COLS || row + definition.height > ROWS) return null;
      const occupiedIds = new Set;
      for (const [offsetX, offsetY] of definition.cells) {
        const x = column + offsetX;
        const y = row + offsetY;
        if (this.mapData[y][x] !== "1") return null;
        const occupiedId = this.occupied[x][y];
        if (occupiedId > 0 && (!sourceBuilding || occupiedId !== sourceBuilding.id)) occupiedIds.add(occupiedId);
      }
      const replacements = [...occupiedIds]
        .map((id) => this.buildings.find((building) => building.id === id))
        .filter(Boolean);
      return replacements.length === occupiedIds.size ? replacements : null;
    }

    replaceBuildingsAt(definition, column, row, drag, replacementTargets) {
      if (!drag || !replacementTargets || !replacementTargets.length) return false;
      const sourceBuilding = drag.existing;
      const original = drag.original;
      for (const target of replacementTargets) this.markOccupied(target, 0);

      let placed;
      if (sourceBuilding) {
        sourceBuilding.column = column;
        sourceBuilding.row = row;
        sourceBuilding.image.visible = true;
        this.positionBuilding(sourceBuilding);
        this.markOccupied(sourceBuilding, sourceBuilding.id);
        placed = sourceBuilding;
      } else {
        const restoredState = drag.shopItem && drag.shopItem.returnedState;
        this.consumeShopItem(drag.shopItem);
        placed = this.placeBuilding(definition, column, row, restoredState);
        this.markOccupied(placed, placed.id);
      }

      let sourceFootprintUsed = false;
      for (const target of replacementTargets) {
        const canSwap = !!sourceBuilding && !!original && !sourceFootprintUsed
          && this.canPlace(target.definition, original.column, original.row);
        if (canSwap) {
          target.column = original.column;
          target.row = original.row;
          target.image.visible = true;
          this.positionBuilding(target);
          this.markOccupied(target, target.id);
          sourceFootprintUsed = true;
        } else {
          this.returnBuildingToShop(target, false);
        }
      }
      return !!placed;
    }

    canMergeDefinitions(source, target) {
      if (!source || !target || source.class === "slot" || target.class === "slot") return false;
      return source.id === target.id && source.level === target.level && target.level < MAX_SYNTH_LEVEL;
    }

    findMergeTarget(definition, column, row, sourceBuilding) {
      if (!definition || definition.class === "slot" || definition.level >= MAX_SYNTH_LEVEL) return null;
      if (column < 0 || row < 0 || column + definition.width > COLS || row + definition.height > ROWS) return null;
      const occupiedIds = new Set;
      for (const [offsetX, offsetY] of definition.cells) {
        const x = column + offsetX;
        const y = row + offsetY;
        if (this.mapData[y][x] !== "1") return null;
        const occupiedId = this.occupied[x][y];
        if (occupiedId > 0 && (!sourceBuilding || occupiedId !== sourceBuilding.id)) occupiedIds.add(occupiedId);
      }
      if (occupiedIds.size !== 1) return null;
      const targetId = [...occupiedIds][0];
      const target = this.buildings.find((building) => building.id === targetId) || null;
      return target && this.canMergeDefinitions(definition, target.definition) ? target : null;
    }

    mergeBuildingInto(target, sourceBuilding) {
      if (!target || !this.canMergeDefinitions(sourceBuilding ? sourceBuilding.definition : target.definition, target.definition)) return false;
      if (sourceBuilding) this.removeBuilding(sourceBuilding, false);
      const nextDefinition = this.makeBuildingDefinition(this.buildingRowById[target.definition.id], target.definition.level + 1);
      target.definition = nextDefinition;
      target.hp = nextDefinition.hp;
      target.maxHp = nextDefinition.hp;
      target.cooldown = nextDefinition.class === "defense" ? 0.35 : 0.8;
      this.applyDefinitionImage(target.image, nextDefinition, nextDefinition.width * CELL_STEP - CELL_GAP, nextDefinition.height * CELL_STEP - CELL_GAP, false);
      target.image.visible = true;
      if (target.hpFill) target.hpFill.width = 76;
      this.positionBuilding(target);
      this.markOccupied(target, target.id);
      return true;
    }

    canPlace(definition, column, row) {
      if (column < 0 || row < 0 || column + definition.width > COLS || row + definition.height > ROWS) return false;
      if (definition.class === "slot") {
        // BuildSlotItem.allowConflictFloor=3: overlap with existing floor is
        // legal; those cells are trimmed and only the remaining cells expand.
        return definition.cells.length > 0;
      }
      return definition.cells.every(([offsetX, offsetY]) => {
        const x = column + offsetX;
        const y = row + offsetY;
        return this.mapData[y][x] === "1" && this.occupied[x][y] === 0;
      });
    }

    placeSlotExpansion(definition, column, row) {
      let expanded = 0;
      for (const [offsetX, offsetY] of definition.cells) {
        const x = column + offsetX;
        const y = row + offsetY;
        if (this.mapData[y][x] === "1") continue;
        this.clearTree(x, y);
        this.setMapCell(x, y, "1");
        this.createFloorCell(x, y);
        this.occupied[x][y] = 0;
        expanded += 1;
      }
      return expanded;
    }

    placeBuilding(definition, column, row, restoredState) {
      const image = new Laya.Image(definition.skin);
      image.name = `Building_${definition.id}_${this.nextBuildingId}`;
      image.mouseEnabled = true;
      this.buildingLayer.addChild(image);
      const building = {
        id: this.nextBuildingId++, definition, column, row, image,
        hp: restoredState ? Math.min(restoredState.hp, restoredState.maxHp) : definition.hp,
        maxHp: restoredState ? restoredState.maxHp : definition.hp,
        cooldown: restoredState ? restoredState.cooldown : definition.class === "defense" ? 0.35 : 0.8,
        eventRuntime: { meteoriteCooldown: 0, trapCooldown: 0, arrowBarrageCooldown: 0 }
      };
      building.hpBack = addImage(this.buildingLayer, UI.buildHpBack, 0, 0, 82, 14, `BuildingHp_${building.id}`);
      building.hpFill = addImage(building.hpBack, UI.buildHpFill, 3, 3, 76, 8, "Fill");
      building.hpBack.visible = !!this.fighting;
      image.on(Laya.Event.MOUSE_DOWN, this, () => this.beginBuildingDrag(building));
      this.positionBuilding(building);
      building.hpFill.width = 76 * clamp(building.hp / Math.max(1, building.maxHp), 0, 1);
      this.buildings.push(building);
      return building;
    }

    positionBuilding(building) {
      const footprintWidth = building.definition.width * CELL_STEP - CELL_GAP;
      const footprintHeight = building.definition.height * CELL_STEP - CELL_GAP;
      this.applyDefinitionImage(building.image, building.definition, footprintWidth, footprintHeight, false);
      const x = GRID_X + building.column * CELL_STEP + (footprintWidth - building.image.width) / 2;
      const visualOffsetY = building.definition.id === "e02" ? -30 : building.definition.id === "e07" ? -16 : building.definition.id === "e16" ? -8 : 0;
      const y = GRID_Y + building.row * CELL_STEP + footprintHeight - building.image.height + visualOffsetY;
      building.image.pos(x, y);
      building.image.zOrder = y + building.image.height;
      if (building.hpBack) {
        building.hpBack.pos(x + (building.image.width - 82) / 2, y + building.image.height - 5);
        building.hpBack.zOrder = building.image.zOrder + 2;
      }
    }

    markOccupied(building, value) {
      for (const [offsetX, offsetY] of building.definition.cells) {
        const x = building.column + offsetX;
        const y = building.row + offsetY;
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) this.occupied[x][y] = value;
      }
    }

    buildingCenter(building) {
      return {
        x: GRID_X + (building.column + building.definition.width / 2) * CELL_STEP,
        y: GRID_Y + (building.row + building.definition.height / 2) * CELL_STEP + (this.stageContentOffset || 0)
      };
    }

    addBuildingById(id, column, row, level) {
      const rowData = this.buildingRowById[id];
      if (!rowData) return null;
      const definition = this.makeBuildingDefinition(rowData, level || 1);
      if (!this.canPlace(definition, column, row)) return null;
      const building = this.placeBuilding(definition, column, row);
      this.markOccupied(building, building.id);
      return building;
    }

    findFirstPlacement(definition) {
      for (let row = ROWS - definition.height; row >= 0; row -= 1) {
        for (let column = 0; column <= COLS - definition.width; column += 1) if (this.canPlace(definition, column, row)) return { column, row };
      }
      return null;
    }

    installRepresentativeLayout() {
      if (this.buildings.length) return;
      if (this.stageId === 2) {
        this.addBuildingById("e02", 1, 5, 1);
        this.addBuildingById("e16", 3, 4, 2);
        this.addBuildingById("e07", 3, 5, 2);
        this.addBuildingById("e02", 5, 5, 2);
        if (this.shopItems[0]) {
          this.shopItems[0].available = false;
          this.shopItems[0].image.visible = false;
          this.shopItems[0].usedBack.visible = false;
        }
        if (this.shopItems[1]) {
          this.shopItems[1].available = false;
          this.shopItems[1].image.visible = false;
          this.shopItems[1].usedBack.visible = false;
        }
        this.firstFreeRefresh = false;
        this.setRefreshCostDisplay(true);
        return;
      }
      for (const id of ["e07", "e02", "e08", "e16", "e18"]) {
        const definition = this.makeBuildingDefinition(this.buildingRowById[id], id === "e07" ? 2 : 1);
        const position = this.findFirstPlacement(definition);
        if (position) this.addBuildingById(id, position.column, position.row, definition.level);
      }
    }

    installStageBattleSweepLayout() {
      this.installRepresentativeLayout();
      const auditHp = 1000000000;
      const auditAttack = 1000000;
      for (const building of this.buildings) {
        building.definition = Object.assign({}, building.definition, {
          hp: auditHp,
          attack: Math.max(auditAttack, Number(building.definition.attack) || 0),
          cooldown: Math.min(0.02, Number(building.definition.cooldown) || 0.02),
          rangePixels: Math.max(2000, Number(building.definition.rangePixels) || 0)
        });
        building.hp = auditHp;
        building.maxHp = auditHp;
      }
      this.castleMaxHp = auditHp;
      this.castleHp = auditHp;
      this.stageBattleSweepAdapter = {
        testOnly: true,
        purpose: "exercise every production wave through victory; not a balance claim",
        buildingHp: auditHp,
        minimumBuildingAttack: auditAttack,
        minimumRangePixels: 2000,
        simulationSpeed: 96
      };
      this.refreshCastleHp();
    }

    installVisualDragCase() {
      this.addBuildingById("e02", 5, 6, 2);
      const shopDefinition = this.makeBuildingDefinition(this.buildingRowById.e07, 1);
      const first = this.shopItems[0];
      if (first) {
        first.definition = shopDefinition;
        first.available = true;
        first.usedBack.visible = false;
        this.applyDefinitionImage(first.image, shopDefinition, first.width, first.height - 24, false);
        first.image.pos(first.x + (first.width - first.image.width) / 2, first.y + first.height - 25 - first.image.height);
        first.image.visible = true;
      }
      for (const item of this.shopItems.slice(1)) {
        item.available = false;
        item.image.visible = false;
        item.usedBack.visible = false;
      }
      const fence = this.makeBuildingDefinition(this.buildingRowById.e16, 1);
      this.beginDrag(fence, null, null);
      this.updateDragAt(GRID_X + 3 * CELL_STEP + CELL_SIZE / 2, GRID_Y + 4 * CELL_STEP + CELL_SIZE / 2);
    }

    installConsumedShopVisualCase() {
      if (this.buildings.length) return;
      this.addBuildingById("e07", 1, 5, 1);
      this.addBuildingById("e16", 2, 4, 1);
      const arrowItem = this.shopItems[1];
      const wallItem = this.shopItems[2];
      this.consumeShopItem(arrowItem);
      this.consumeShopItem(wallItem);
      const result = {
        ok: !!arrowItem && !!wallItem
          && !arrowItem.image.visible && !wallItem.image.visible
          && !arrowItem.image.getChildByName("WeaponMount")
          && !arrowItem.usedBack.visible && !wallItem.usedBack.visible,
        remainingItems: this.shopItems.filter((item) => item.available && item.image.visible).map((item) => item.definition && item.definition.id),
        arrowMountRemoved: !!arrowItem && !arrowItem.image.getChildByName("WeaponMount"),
        consumedSlotsEmpty: !!arrowItem && !!wallItem && !arrowItem.usedBack.visible && !wallItem.usedBack.visible
      };
      window.__SHOUCHENG_CONSUMED_SHOP_VISUAL__ = result;
      document.body.dataset.restoreConsumedShopVisual = JSON.stringify(result);
    }

    installVisualCombatCase() {
      this.startFight();
      this.paused = true;
      this.pauseButton.alpha = 1;
      const enemyIds = ["js_9F2D53C8", "gb_E916AA75", "js_9F2D53C8"];
      const enemyPositions = [[500, 350], [540, 390], [275, 535]];
      enemyIds.forEach((unitId, index) => {
        this.spawnEnemy(index, unitId);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.image.pos(enemyPositions[index][0], enemyPositions[index][1]);
        enemy.image.zOrder = enemy.image.y;
        if (index === 2) enemy.hp = Math.max(1, Math.round(enemy.maxHp * 0.12));
        this.updateEnemyHealthBar(enemy);
      });
      const barracks = this.buildings.filter((building) => building.definition.id === "e02");
      if (barracks[0]) this.spawnAlly(barracks[0]);
      if (barracks[1]) this.spawnAlly(barracks[1]);
      if (this.allies[0]) this.allies[0].image.pos(205, 795);
      if (this.allies[1]) this.allies[1].image.pos(475, 840);
      this.spawnDamageText(260, 354, 30, "#ffffff");
      this.publishState();
    }

    installVisualWaveStartCase() {
      this.startFight();
      this.paused = true;
      this.pauseButton.alpha = 1;
      const enemyIds = ["gb_E916AA75", "js_9F2D53C8", "js_9F2D53C8"];
      const enemyPositions = [[200, 78], [355, 70], [410, 58]];
      enemyIds.forEach((unitId, index) => {
        this.spawnEnemy(index, unitId);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.image.pos(enemyPositions[index][0], enemyPositions[index][1]);
        enemy.image.zOrder = enemy.image.y;
        this.updateEnemyHealthBar(enemy);
      });
      this.publishState();
    }

    installTestHarness() {
      const host = document.createElement("div");
      host.id = "restore-test-harness";
      host.style.cssText = "position:fixed;left:4px;top:4px;z-index:99999;display:flex;gap:4px;padding:4px;background:rgba(0,0,0,.65)";
      const addButton = (id, text, action) => {
        const button = document.createElement("button");
        button.id = id;
        button.textContent = text;
        button.style.cssText = "font:14px sans-serif;padding:5px 8px";
        button.addEventListener("click", action);
        host.appendChild(button);
      };
      addButton("test-layout", "验证布局", () => this.installRepresentativeLayout());
      addButton("test-start", "开战", () => this.startFight());
      addButton("test-smoke", "全关烟测", () => this.runCatalogSmoke(true));
      addButton("test-hide", "隐藏", () => { host.style.display = "none"; });
      document.body.appendChild(host);
    }

    hasOffensiveBuilding() {
      return this.buildings.some((building) => building && building.definition
        && ["defense", "barracks"].includes(building.definition.class));
    }

    closeNoAttackWarning() {
      for (const name of ["NoAttackWarningShade", "NoAttackWarningPanel"]) {
        const node = this.overlayLayer.getChildByName(name);
        if (node && !node.destroyed) node.destroy(true);
      }
    }

    showNoAttackWarning() {
      if (this.overlayLayer.getChildByName("NoAttackWarningShade")) return;
      const shade = addRect(this.overlayLayer, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, "#000000", 0.66, "NoAttackWarningShade");
      shade.mouseEnabled = true;
      const panel = addRect(this.overlayLayer, 95, 420, 560, 340, "#26334d", 0.99, "NoAttackWarningPanel");
      panel.mouseEnabled = true;
      panel.zOrder = 2001;
      addLabel(panel, "尚未部署攻击建筑", 35, 35, 490, 62, 36);
      addLabel(panel, "当前没有兵营或防御塔，仍要开始本波战斗吗？", 45, 115, 470, 78, 23);
      this.makeButton(panel, "取消", UI.grayButton, 48, 225, 205, 78, () => this.closeNoAttackWarning(), 28);
      this.makeButton(panel, "继续开战", UI.orangeButton, 307, 225, 205, 78, () => {
        this.closeNoAttackWarning();
        this.startFight();
      }, 28);
    }

    requestStartFight() {
      if (this.fighting || this.finished) return false;
      if (!this.hasOffensiveBuilding()) {
        this.showNoAttackWarning();
        return false;
      }
      this.startFight();
      return true;
    }

    recoverPlayerBuildsForWave() {
      if (this.castleHp > 0) this.castleHp = this.castleMaxHp;
      for (const building of this.buildings) {
        building.hp = building.maxHp;
        building.defeated = false;
        if (building.image && !building.image.destroyed) building.image.visible = true;
        if (building.hpFill && !building.hpFill.destroyed) building.hpFill.width = 76;
      }
    }

    startFight() {
      if (this.fighting || this.finished) return;
      this.recoverPlayerBuildsForWave();
      this.fighting = true;
      this.paused = false;
      this.spawnedThisWave = 0;
      this.killedThisWave = 0;
      this.resolvedThisWave = 0;
      this.waveRoster = this.buildWaveRoster(this.currentWave);
      this.waveCoinRoster = this.buildWaveCoinRewards(this.currentWave);
      this.waveSpawnDelays = this.buildWaveSpawnDelays(this.currentWave);
      this.spawnClock = this.testFastBattle ? 0.05 : (this.waveSpawnDelays[0] || 0);
      this.shopLayer.visible = false;
      this.setBattlePresentation(true);
      this.setCombatCountersVisible(this.debugUi);
      this.speedButton.visible = this.debugUi;
      this.setAirSupportVisible(true);
      this.setStageNavigationVisible(false);
      for (const building of this.buildings) building.image.mouseEnabled = false;
      for (const badge of this.treeBadges) badge.visible = false;
      this.refreshHud();
    }

    buildWaveRoster(waveNumber) {
      const total = this.waveCounts[waveNumber - 1];
      const rosterRandom = seededRandom(this.stageId * 1000 + waveNumber - 1);
      const resultRandom = this.outcomeRandom || Math.random;
      let pool = shuffled(this.stageConfig.enemies, rosterRandom);
      const roster = [];
      while (roster.length < total) roster.push(...pool);
      roster.length = total;
      const shuffledRoster = shuffled(roster, rosterRandom);
      const eliteProbability = this.stageConfig.eliteProbability[waveNumber - 1] || 0;
      const eliteCount = Math.floor(eliteProbability) + (resultRandom() < eliteProbability % 1 ? 1 : 0);
      const eliteIndices = shuffled(Array.from({ length: total }, (_, index) => index), resultRandom).slice(0, eliteCount);
      for (const index of eliteIndices) {
        const base = this.unitById[shuffledRoster[index]];
        if (base && base.changeToElite) shuffledRoster[index] = base.changeToElite;
      }
      if (waveNumber === this.maxWave && this.stageConfig.hasFinalBoss && total > 0) {
        const bossRandom = seededRandom(this.stageId * 1000);
        const baseId = this.stageConfig.enemies[Math.floor(bossRandom() * this.stageConfig.enemies.length)];
        const base = this.unitById[baseId];
        shuffledRoster[Math.floor(total / 3)] = base && base.changeToBoss ? base.changeToBoss : baseId;
      }
      return shuffledRoster;
    }

    buildWaveCoinRewards(waveNumber) {
      const total = Math.max(0, Math.trunc(this.waveCounts[waveNumber - 1] || 0));
      if (!total) return [];
      const coins = Math.max(0, Math.trunc(this.fightParams.CoinsPerWave || 10));
      const each = Math.floor(coins / total);
      const remainder = coins % total;
      return Array.from({ length: total }, (_, index) => each + (index < remainder ? 1 : 0));
    }

    buildWaveSpawnDelays(waveNumber, randomSource, totalOverride, waveCountOverride) {
      const total = Math.max(0, Math.trunc(totalOverride === undefined
        ? (this.waveCounts[waveNumber - 1] || 0) : totalOverride));
      if (!total) return [];
      const random = randomSource || this.spawnRandom || this.outcomeRandom || Math.random;
      const firstRange = this.fightParams.FirstEnemyDelayTime || [0.1, 0.2];
      const troopRange = this.fightParams.TroopInterval || [0.1, 0.2];
      const troopChance = this.fightParams.TroopCountChance || [100, 0, 0];
      const troopSpeedUp = this.fightParams.TroopSpeedUp === undefined ? 1 : this.fightParams.TroopSpeedUp;
      const waveCount = Math.max(1, Math.trunc(waveCountOverride || this.maxWave || 1));
      const countRatio = Array.isArray(this.fightParams.waveGCntRadios)
        ? Number(this.fightParams.waveGCntRadios[0]) || 1
        : Number(this.fightParams.waveGCntRadios) || 1;
      const randomInteger = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
      const chooseTroopCount = () => {
        const weights = troopChance.map((weight) => Math.max(0, Number(weight) || 0));
        const sum = weights.reduce((value, weight) => value + weight, 0) || 1;
        let cursor = random() * sum;
        for (let index = 0; index < weights.length; index += 1) {
          if (cursor <= weights[index]) return index;
          cursor -= weights[index];
        }
        return weights.length - 1;
      };
      const delays = [];
      let delayNextIndex = 0;
      for (let index = 0; index < total; index += 1) {
        let delayMs = 0;
        if (index === 0) {
          delayMs = randomInteger(firstRange[0] * 1000, firstRange[1] * 1000);
          delayNextIndex = 0;
        } else {
          const waveSpeedRatio = 1 + waveNumber / waveCount * (troopSpeedUp - 1);
          delayMs = randomInteger(troopRange[0] * 1000, troopRange[1] * 1000) / waveSpeedRatio;
        }
        if (!delayNextIndex || delayNextIndex < index) {
          const troopIndex = chooseTroopCount();
          delayNextIndex = troopIndex === 0 ? 0 : troopIndex === 1 ? 2 : 4;
        } else delayMs = 0;
        delays.push(delayMs / 1000 / countRatio);
      }
      return delays;
    }

    togglePause() {
      if (!this.fighting || this.finished || this.traitSelecting) return;
      this.paused = !this.paused;
      this.pauseButton.alpha = this.paused ? 0.62 : 1;
    }

    toggleSpeed() {
      this.speed = this.speed === 1 ? 2 : 1;
      this.speedButton.getChildAt(0).text = `×${this.speed}`;
    }

    update() {
      const frameDelta = this.testFastBattle ? 1 / 60 : Math.min(Laya.timer.delta / 1000, 0.04);
      if (this.paused) return;
      if (!this.fighting || this.finished) {
        for (const ally of this.allies) this.advanceActorAnimation(ally, frameDelta);
        for (const enemy of this.enemies) this.advanceActorAnimation(enemy, frameDelta);
        return;
      }
      const delta = frameDelta * this.speed;
      this.updateCombatEvents(delta);
      this.updateSpawning(delta);
      this.updateAirSupports(delta);
      this.updateEnemies(delta);
      this.updateBuildings(delta);
      this.updateAllies(delta);
      this.updateProjectiles(delta);
      this.updateDamageTexts(delta);
      this.updateEffects(delta);
      this.checkWaveComplete();
      this.statePublishClock -= delta;
      if (this.statePublishClock <= 0) {
        this.statePublishClock = 1;
        this.publishState();
      }
    }

    scheduleCombatEvent(delaySeconds, kind, callback) {
      if (!(callback instanceof Function)) return null;
      const event = { remaining: Math.max(0, Number(delaySeconds) || 0), kind: kind || "combat", callback };
      this.combatEvents.push(event);
      return event;
    }

    updateCombatEvents(delta) {
      for (let index = this.combatEvents.length - 1; index >= 0; index -= 1) {
        const event = this.combatEvents[index];
        event.remaining -= delta;
        if (event.remaining > 0) continue;
        this.combatEvents.splice(index, 1);
        event.callback();
      }
    }

    publishState() {
      document.body.dataset.restoreState = JSON.stringify({
        stage: this.stageId,
        maxStageRecord: this.normalizeCampaignProgress(this.campaignProgress),
        unlockedStage: this.campaignUnlockedStage(),
        wave: this.currentWave,
        maxWave: this.maxWave,
        fighting: this.fighting,
        finished: this.finished,
        spawned: this.spawnedThisWave,
        killed: this.killedThisWave,
        resolved: this.resolvedThisWave,
        totalKills: this.kills,
        battleExp: this.battleExp,
        fightLevel: this.fightLevel,
        fightLevelExp: Number(this.fightLevelExp.toFixed(2)),
        traits: this.activeTraits.map((trait) => [trait.effectKey, trait.quality, trait.value]),
        castleHp: Math.round(this.castleHp),
        victory: this.finished ? this.castleHp > 0 : null,
        enemyHp: this.enemies.slice(0, 12).map((enemy) => [enemy.unitId, Math.round(enemy.hp), Number((enemy.image.y / DESIGN_HEIGHT).toFixed(2))]),
        allies: this.allies.length,
        buildings: this.buildings.map((building) => [building.definition.id, Math.round(building.hp), Number(building.cooldown.toFixed(2))])
        ,airSupportUsed: [...this.airSupportUsed]
        ,testAdapter: this.stageBattleSweepAdapter || null
      });
    }

    updateSpawning(delta) {
      const total = this.waveCounts[this.currentWave - 1];
      if (this.spawnedThisWave >= total) return;
      this.spawnClock -= delta;
      let budget = this.testFastBattle ? 8 : 1;
      while (this.spawnClock <= 0 && this.spawnedThisWave < total && budget > 0) {
        this.spawnEnemy(this.spawnedThisWave, this.waveRoster[this.spawnedThisWave]);
        this.spawnedThisWave += 1;
        const nextDelay = this.testFastBattle ? 0.05 : (this.waveSpawnDelays[this.spawnedThisWave] || 0);
        this.spawnClock += nextDelay;
        budget -= 1;
      }
    }

    unitBody(unit, waveIndex) {
      const power = this.stageConfig.wavePower[waveIndex] || 1;
      const visualLevel = Math.floor(power % 10);
      if (!unit.bodies || !unit.bodies.length) return "Swordsman1";
      if (visualLevel >= 1 && unit.bodies[visualLevel - 1]) return unit.bodies[visualLevel - 1];
      if (visualLevel > unit.bodies.length) return unit.bodies[unit.bodies.length - 1];
      return unit.bodies[0];
    }

    animationClipForBody(body, requestedAction) {
      const actions = this.unitAnimations[body] || {};
      const action = actions[requestedAction]
        ? requestedAction
        : actions.move ? "move" : actions.idle ? "idle" : Object.keys(actions)[0];
      return action ? { action, clip: actions[action] } : null;
    }

    framesForBody(body, action) {
      const resolved = this.animationClipForBody(body, action || "move");
      return resolved && resolved.clip && Array.isArray(resolved.clip.frames)
        ? resolved.clip.frames.slice()
        : Array.from({ length: 10 }, (_, index) => `res/units/${body}_move_${index}.png`);
    }

    enemyFramesForBody(body, action) {
      return this.framesForBody(body, action).map((frame) => frame.replace("res/units/", "res/units-red/"));
    }

    configureActorAnimation(actor, body, enemyTeam, action) {
      actor.body = body;
      actor.enemyTeam = !!enemyTeam;
      actor.animationAction = null;
      actor.animationOneShot = false;
      actor.animationInterval = 0.102;
      actor.animationCompletedActions = [];
      this.setActorAction(actor, action || "move", { force: true, restart: true });
      return actor;
    }

    setActorAction(actor, requestedAction, options) {
      if (!actor || !actor.image || actor.image.destroyed) return false;
      const settings = options || {};
      if (actor.animationOneShot && !settings.force && requestedAction !== actor.animationAction) return false;
      const resolved = this.animationClipForBody(actor.body, requestedAction);
      if (!resolved || !resolved.clip || !resolved.clip.frames || !resolved.clip.frames.length) return false;
      if (actor.animationAction === resolved.action && !settings.restart) return true;
      actor.animationAction = resolved.action;
      actor.animationOneShot = !!settings.oneShot;
      actor.animationInterval = Math.max(
        0.001,
        (Number(resolved.clip.intervalMs) || 102) / 1000 * (Number(settings.intervalScale) || 1)
      );
      actor.frames = (actor.enemyTeam
        ? resolved.clip.frames.map((frame) => frame.replace("res/units/", "res/units-red/"))
        : resolved.clip.frames.slice());
      actor.frame = clamp(Math.trunc(Number(settings.startFrame) || 0), 0, actor.frames.length - 1);
      actor.frameClock = 0;
      actor.image.skin = actor.frames[actor.frame];
      return true;
    }

    beginActorAttack(actor, cooldownSeconds, callback) {
      const resolved = this.animationClipForBody(actor && actor.body, "attack");
      if (!resolved || !resolved.clip) {
        callback();
        return 0;
      }
      const baseInterval = Math.max(0.001, (Number(resolved.clip.intervalMs) || 102) / 1000);
      const fireFrame = Math.max(0, Number(resolved.clip.fireFrame) || 0);
      const naturalDelay = fireFrame * baseInterval;
      const cooldown = Math.max(0, Number(cooldownSeconds) || 0);
      const fireDelay = naturalDelay > 0 ? Math.min(naturalDelay, cooldown) : 0;
      const intervalScale = naturalDelay > 0 && fireDelay < naturalDelay ? fireDelay / naturalDelay : 1;
      this.setActorAction(actor, "attack", {
        restart: true,
        oneShot: true,
        intervalScale: Math.max(0.001, intervalScale)
      });
      actor.lastAttackFireDelay = fireDelay;
      if (fireDelay <= 0) callback();
      else this.scheduleCombatEvent(fireDelay, "unit-attack-fire-frame", callback);
      return fireDelay;
    }

    advanceActorAnimation(actor, delta) {
      if (!actor || !actor.frames || !actor.frames.length || !actor.image || actor.image.destroyed) return;
      actor.frameClock += delta;
      while (actor.frameClock >= actor.animationInterval) {
        actor.frameClock -= actor.animationInterval;
        const next = actor.frame + 1;
        if (next >= actor.frames.length) {
          if (actor.animationOneShot) {
            const completed = actor.animationAction;
            actor.animationOneShot = false;
            actor.animationCompletedActions.push(completed);
            this.setActorAction(actor, "idle", { force: true, restart: true });
            return;
          }
          actor.frame = 0;
        } else actor.frame = next;
        actor.image.skin = actor.frames[actor.frame];
      }
    }

    setActorFacing(actor, directionX) {
      if (!actor || !actor.image || actor.image.destroyed || Math.abs(directionX) <= 0.05) return;
      const facing = directionX < 0 ? -1 : 1;
      if (actor.facing === facing) return;
      actor.facing = facing;
      Laya.Tween.clearAll(actor.image);
      Laya.Tween.to(actor.image, { scaleX: facing }, 200, Laya.Ease.expoOut);
    }

    buildEnemySpawnPosition(randomSource) {
      const random = randomSource || this.spawnPositionRandom || this.outcomeRandom || Math.random;
      const randomInteger = (minimum, maximum) => minimum + Math.floor(random() * (maximum - minimum + 1));
      return {
        x: 10 + randomInteger(0, 740),
        y: randomInteger(50, 80)
      };
    }

    setActorSize(image, skin, scale) {
      const natural = this.textureSize(skin);
      const modelScale = UNIT_GLOBAL_SCALE * (Number(scale) || 1);
      image.size(natural.width * modelScale, natural.height * modelScale);
      image.pivot(image.width / 2, image.height / 2);
    }

    spawnEnemy(index, unitId) {
      const unit = this.unitById[unitId] || this.unitById[this.stageConfig.enemies[0]];
      const waveIndex = this.currentWave - 1;
      const body = this.unitBody(unit, waveIndex);
      const frames = this.enemyFramesForBody(body);
      const spawnPosition = this.buildEnemySpawnPosition();
      const scale = unit.zoom || 1;
      const image = new Laya.Image(frames[0]);
      const idleSkin = this.framesForBody(body, "idle")[0] || frames[0];
      this.setActorSize(image, idleSkin, scale);
      image.pos(spawnPosition.x, spawnPosition.y);
      image.mouseEnabled = false;
      const isBoss = unitId.includes("tl_") || unitId.includes("tl_") || /tl_/.test(unitId);
      const isElite = unitId.startsWith("jr");
      this.actorLayer.addChild(image);
      const power = this.stageConfig.wavePower[waveIndex] || 1;
      const hp = Math.max(1, Math.round(unit.hp * power));
      const hpBack = addImage(this.actorLayer, UI.enemyHpBack, 0, 0, 70, 14, `EnemyHp_${this.nextActorId}`);
      const hpFill = addImage(hpBack, UI.enemyHpFill, 3, 3, 64, 8, "Fill");
      const enemy = {
        id: this.nextActorId++, unitId, unit, image, frames, frame: 0, frameClock: 0, body,
        team: "enemy",
        deadCoins: this.waveCoinRoster && Number(this.waveCoinRoster[index]) || 0,
        hp, maxHp: hp, attack: Math.max(1, unit.attack * power), attackSpeed: unit.attackSpeed || 1,
        crit: unit.crit || 0, critDamage: unit.critDamage || 1, dodge: unit.dodge || 0,
        speed: (unit.speed || 1) * PHYSICS_PIXEL_RATIO * UNIT_SPEED_RADIO,
        range: Math.max(42, (unit.range || 1) * PHYSICS_PIXEL_RATIO),
        bulletSpeed: this.unitProjectileSpeed(unit), spawnPosition, attackCooldown: 0,
        boss: isBoss, elite: isElite, hpBack, hpFill,
        aliveMs: 0, routeOrder: 1, routeSearchRange: ENEMY_ROUTE_SEARCH_RANGE,
        routeTarget: null, routeTargetKey: null, routeRandom: null,
        routeColliderScale: scale, routeForceColliders: new Map(), repel: null
      };
      this.configureActorAnimation(enemy, body, true, "move");
      this.enemies.push(enemy);
      this.updateEnemyHealthBar(enemy);
    }

    updateEnemyHealthBar(enemy) {
      if (!enemy.hpBack || enemy.hpBack.destroyed || !enemy.image || enemy.image.destroyed) return;
      enemy.hpBack.pos(enemy.image.x - 35, enemy.image.y - enemy.image.height / 2 - 17);
      enemy.hpBack.zOrder = enemy.image.zOrder + 2;
      enemy.hpBack.visible = enemy.image.y > 180;
      enemy.hpFill.width = 64 * Math.max(0, enemy.hp / enemy.maxHp);
    }

    updateAllyHealthBar(ally, reveal) {
      if (!ally || !ally.hpBack || ally.hpBack.destroyed || !ally.image || ally.image.destroyed) return;
      if (reveal) ally.hpBarRevealed = true;
      ally.hpBack.pos(ally.image.x - 35, ally.image.y - ally.image.height / 2 - 17);
      ally.hpBack.zOrder = ally.image.zOrder + 2;
      ally.hpBack.visible = !!ally.hpBarRevealed;
      ally.hpFill.width = 64 * clamp(ally.hp / Math.max(1, ally.maxHp), 0, 1);
    }

    enemyRouteTargetValid(target) {
      if (!target) return false;
      if (target.kind === "castle") return this.castleHp > 0;
      const actor = target.value;
      return !!(actor && actor.hp > 0 && actor.image && !actor.image.destroyed);
    }

    refreshEnemyRouteTargetPoint(enemy, target) {
      if (!target) return null;
      if (target.kind === "ally") {
        target.anchor = target.value.image;
        target.point = { x: target.anchor.x, y: target.anchor.y };
      } else if (target.kind === "building") {
        target.anchor = this.buildingRouteAnchor(target.value);
        target.width = target.value.definition.width * CELL_STEP - CELL_GAP;
        target.point = this.clampRouteTargetPoint(enemy, target.anchor, target.width);
      } else {
        target.anchor = this.castleRouteAnchor();
        target.width = 3 * CELL_STEP - CELL_GAP;
        target.point = this.clampRouteTargetPoint(enemy, target.anchor, target.width);
      }
      return target;
    }

    enemyRouteCandidateInRange(enemy, anchor) {
      const searchRange = Number.isFinite(enemy.routeSearchRange)
        ? enemy.routeSearchRange
        : ENEMY_ROUTE_SEARCH_RANGE;
      return searchRange < 0 || distance(enemy.image, anchor) <= searchRange;
    }

    enemyRouteTarget(enemy) {
      if (this.enemyRouteTargetValid(enemy.routeTarget)) {
        return this.refreshEnemyRouteTargetPoint(enemy, enemy.routeTarget);
      }
      enemy.routeTarget = null;
      enemy.routeTargetKey = null;
      enemy.routeRandom = null;
      const candidates = [];
      for (const ally of this.allies) {
        if (ally.hp > 0 && ally.image && !ally.image.destroyed
          && this.enemyRouteCandidateInRange(enemy, ally.image)) {
          candidates.push({ kind: "ally", value: ally, anchor: ally.image, key: `ally-${ally.id}` });
        }
      }
      for (const building of this.buildings) {
        const anchor = this.buildingRouteAnchor(building);
        if (building.hp > 0 && building.image && !building.image.destroyed
          && this.enemyRouteCandidateInRange(enemy, anchor)) {
          candidates.push({
            kind: "building", value: building, anchor,
            width: building.definition.width * CELL_STEP - CELL_GAP, key: `building-${building.id}`
          });
        }
      }
      const castleWidth = 3 * CELL_STEP - CELL_GAP;
      const castleAnchor = this.castleRouteAnchor();
      if (this.castleHp > 0 && this.enemyRouteCandidateInRange(enemy, castleAnchor)) {
        candidates.push({ kind: "castle", value: null, anchor: castleAnchor, width: castleWidth, key: "castle" });
      }
      candidates.sort((left, right) => distance(enemy.image, left.anchor) - distance(enemy.image, right.anchor));
      const selected = candidates[0];
      if (selected) enemy.routeTargetKey = selected.key;
      enemy.routeTarget = selected || null;
      return this.refreshEnemyRouteTargetPoint(enemy, enemy.routeTarget);
    }

    buildingRouteAnchor(building) {
      const width = building.definition.width * CELL_STEP - CELL_GAP;
      return {
        x: GRID_X + building.column * CELL_STEP + width / 2,
        y: GRID_Y + building.row * CELL_STEP + (this.stageContentOffset || 0)
      };
    }

    castleRouteAnchor() {
      const width = 3 * CELL_STEP - CELL_GAP;
      return {
        x: GRID_X + this.castlePosition.column * CELL_STEP + width / 2,
        y: GRID_Y + this.castlePosition.row * CELL_STEP + (this.stageContentOffset || 0)
      };
    }

    clampRouteTargetPoint(enemy, anchor, width) {
      if (!(width > 0)) return { x: anchor.x, y: anchor.y };
      return { x: clamp(enemy.image.x, anchor.x - width / 2, anchor.x + width / 2), y: anchor.y };
    }

    routeRandomFloat(minimum, maximum) {
      return minimum + (maximum - minimum) * (this.routeRandomSource || this.combatRandom || Math.random)();
    }

    normalizeRouteVector(vector) {
      const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
      if (length < 1e-9) return { x: 0, y: 0 };
      return { x: vector.x / length, y: vector.y / length };
    }

    unitRouteColliderRadius(actor) {
      return UNIT_ROUTE_COLLIDER_RADIUS * (Number(actor && actor.routeColliderScale) || 1);
    }

    applyUnitRouteColliderForce(actor, initialForward) {
      const forward = { x: initialForward.x, y: initialForward.y };
      const forceColliders = actor.routeForceColliders instanceof Map
        ? actor.routeForceColliders
        : (actor.routeForceColliders = new Map());
      if (actor.boss) {
        forceColliders.clear();
        return this.normalizeRouteVector(forward);
      }

      const sourceX = actor.image.x;
      const sourceY = actor.image.y;
      const radius = this.unitRouteColliderRadius(actor);
      const stayEqualCollider = new Set();
      const peers = actor.routeOrder === -1 ? this.allies : this.enemies;
      for (const other of peers) {
        if (other === actor || other.hp <= 0 || !other.image || other.image.destroyed) continue;
        const otherRadius = this.unitRouteColliderRadius(other);
        const gap = distance(actor.image, other.image);
        if (gap >= radius + otherRadius) continue;
        stayEqualCollider.add(other);
        if (gap <= 0) continue;
        const forceDistance = (radius + otherRadius) / 2;
        const overlap = Math.min(1 - gap / forceDistance, 1);
        if (overlap <= 1e-4) continue;
        const previous = forceColliders.get(other);
        if (previous === undefined || overlap > previous) forceColliders.set(other, overlap);
      }

      if (!stayEqualCollider.size) {
        forceColliders.clear();
        return this.normalizeRouteVector(forward);
      }
      let forceWeight = 1;
      for (const [other, overlap] of forceColliders) {
        if (!stayEqualCollider.has(other)) {
          forceColliders.delete(other);
          continue;
        }
        const away = Math.atan2(sourceY - other.image.y, sourceX - other.image.x);
        forward.x += Math.cos(away) * overlap * forceWeight;
        forward.y += Math.sin(away) * overlap * forceWeight;
        forceWeight *= 1.1;
      }
      return this.normalizeRouteVector(forward);
    }

    unitRouteRandomAngle(desired, amount, side) {
      if (desired < 0) return side < 0
        ? Math.max(-Math.PI, desired - amount)
        : Math.min(0, desired + amount);
      if (desired > 0) return side < 0
        ? Math.min(Math.PI, desired + amount)
        : Math.max(0, desired - amount);
      return 0;
    }

    unitRouteForward(actor, targetPoint) {
      const sourceX = actor.image.x;
      const sourceY = actor.image.y;
      const desired = Math.atan2(targetPoint.y - sourceY, targetPoint.x - sourceX);
      const inForwardArc = (desired >= Math.PI / 4 && desired <= Math.PI * 3 / 4)
        || (desired <= -Math.PI / 4 && desired >= -Math.PI * 3 / 4);
      if (!inForwardArc) actor.routeRandom = null;
      if (inForwardArc && (!actor.routeRandom || actor.routeRandom.untilMs < actor.aliveMs)) {
        const untilMs = actor.aliveMs + this.routeRandomFloat(ROUTE_RANDOM_MIN_MS, ROUTE_RANDOM_MAX_MS);
        const targetDistance = Math.max(1e-9, distance(actor.image, targetPoint));
        const attenuation = Math.max(0, 1 - actor.range * 2 / targetDistance);
        const amount = attenuation * this.routeRandomFloat(ROUTE_RANDOM_MIN_ANGLE, ROUTE_RANDOM_MAX_ANGLE);
        const side = (this.routeRandomSource || this.combatRandom || Math.random)() >= 0.5 ? 1 : -1;
        const angle = this.unitRouteRandomAngle(desired, amount, side);
        actor.routeRandom = {
          angle,
          untilMs,
          attenuation
        };
      }
      let angle = actor.routeRandom ? actor.routeRandom.angle : desired;
      let forward = { x: Math.cos(angle), y: Math.sin(angle) };
      const nextX = sourceX + forward.x * 5;
      const nextY = sourceY + forward.y * 5;
      if (nextX < ROUTE_MAP_LEFT || nextX > ROUTE_MAP_RIGHT || nextY < 0 || nextY > DESIGN_HEIGHT) {
        actor.routeRandom = actor.routeRandom || { angle, untilMs: actor.aliveMs };
        actor.routeRandom.untilMs = actor.aliveMs + this.routeRandomFloat(ROUTE_RANDOM_MIN_MS, ROUTE_RANDOM_MAX_MS);
        if (angle < 0) angle = angle < -Math.PI / 2 ? angle + Math.PI / 2 : angle - Math.PI / 2;
        else angle = angle > Math.PI / 2 ? angle - Math.PI / 2 : angle + Math.PI / 2;
        actor.routeRandom.angle = angle;
        forward = { x: Math.cos(angle), y: Math.sin(angle) };
      }

      forward = this.applyUnitRouteColliderForce(actor, forward);
      if (actor.routeOrder === 1 && forward.y < -0.5) {
        forward.y += 0.5;
        forward = this.normalizeRouteVector(forward);
      } else if (actor.routeOrder === -1 && forward.y > 0.5) {
        forward.y -= 0.5;
        forward = this.normalizeRouteVector(forward);
      }
      return forward;
    }

    enemyRouteForward(enemy, targetPoint) {
      return this.unitRouteForward(enemy, targetPoint);
    }

    rollCombatDamage(baseDamage, crit, critDamage, dodge) {
      const random = this.combatRandom || Math.random;
      if ((dodge || 0) > 0 && random() < dodge) return { damage: 0, dodged: true, critical: false };
      const critical = (crit || 0) > 0 && random() < crit;
      return {
        damage: baseDamage * (critical ? (critDamage || 1) : 1),
        dodged: false,
        critical
      };
    }

    applyRepel(target, sourcePoint, repelParams) {
      if (!target || !target.image || !Array.isArray(repelParams)) return false;
      if (target.unit && target.unit.traits && target.unit.traits.RepelResist) return false;
      const force = Number(repelParams[0]) || 12;
      const duration = Number(repelParams[1]) || 0.35;
      const source = sourcePoint || target.image;
      const angle = Math.atan2(target.image.y - source.y, target.image.x - source.x);
      target.repel = {
        velocityX: force * PHYSICS_PIXEL_RATIO * Math.cos(angle),
        velocityY: force * PHYSICS_PIXEL_RATIO * Math.sin(angle),
        duration,
        remaining: duration
      };
      return true;
    }

    updateRepelledActor(actor, delta) {
      const repel = actor && actor.repel;
      if (!repel || !actor.image || actor.image.destroyed) return false;
      const factor = Math.max(0, repel.remaining / Math.max(0.001, repel.duration));
      actor.image.pos(
        clamp(actor.image.x + repel.velocityX * factor * delta, ROUTE_MAP_LEFT, ROUTE_MAP_RIGHT),
        clamp(actor.image.y + repel.velocityY * factor * delta, 0, DESIGN_HEIGHT)
      );
      actor.image.zOrder = actor.image.y;
      repel.remaining -= delta;
      if (repel.remaining <= 0) actor.repel = null;
      if (actor.hpBack) {
        if (actor.team === "ally") this.updateAllyHealthBar(actor);
        else this.updateEnemyHealthBar(actor);
      }
      return true;
    }

    updateEnemies(delta) {
      for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
        const enemy = this.enemies[index];
        if (!enemy.image || enemy.image.destroyed) continue;
        const controlled = this.updateEnemyEquipmentStatuses(enemy, delta);
        if (enemy.hp <= 0 || !enemy.image || enemy.image.destroyed) continue;
        this.advanceActorAnimation(enemy, delta);

        if (controlled) {
          this.setActorAction(enemy, "idle");
          this.updateEnemyHealthBar(enemy);
          continue;
        }

        if (this.updateRepelledActor(enemy, delta)) {
          this.setActorAction(enemy, "move");
          continue;
        }

        enemy.aliveMs += delta * 1000;
        const routeTarget = this.enemyRouteTarget(enemy);
        const routeGap = routeTarget ? distance(enemy.image, routeTarget.point) : Infinity;
        if (routeTarget && routeGap <= enemy.range) {
          this.setActorFacing(enemy, routeTarget.point.x - enemy.image.x);
          enemy.attackCooldown -= delta;
          if (enemy.attackCooldown <= 0) {
            const interval = this.enemyEquipmentAttackInterval(enemy);
            const targetAtReady = routeTarget;
            this.beginActorAttack(enemy, interval, () => this.fireEnemyProjectile(enemy, targetAtReady));
            enemy.attackCooldown += interval;
          } else this.setActorAction(enemy, "idle");
          continue;
        }
        const equipmentSlow = (enemy.equipmentSlowRemaining || 0) > 0 ? 1 / (1 + (enemy.equipmentSlowRatio || 0)) : 1;
        const slow = this.enemySlowAt(enemy.image) * equipmentSlow;
        const forward = this.enemyRouteForward(enemy, routeTarget ? routeTarget.point : { x: enemy.image.x, y: DESIGN_HEIGHT });
        this.setActorAction(enemy, "move");
        this.setActorFacing(enemy, forward.x);
        const movement = enemy.speed * slow * delta;
        enemy.image.pos(
          clamp(enemy.image.x + forward.x * movement, ROUTE_MAP_LEFT, ROUTE_MAP_RIGHT),
          clamp(enemy.image.y + forward.y * movement, 0, DESIGN_HEIGHT)
        );
        enemy.image.zOrder = enemy.image.y;
        this.updateEnemyHealthBar(enemy);
      }
    }

    updateEnemyEquipmentStatuses(enemy, delta) {
      enemy.seriousInjuryRemaining = Math.max(0, (enemy.seriousInjuryRemaining || 0) - delta);
      enemy.equipmentSlowRemaining = Math.max(0, (enemy.equipmentSlowRemaining || 0) - delta);
      enemy.paralysisRemaining = Math.max(0, (enemy.paralysisRemaining || 0) - delta);
      enemy.dizzinessRemaining = Math.max(0, (enemy.dizzinessRemaining || 0) - delta);
      enemy.freezeRemaining = Math.max(0, (enemy.freezeRemaining || 0) - delta);
      if (Array.isArray(enemy.burns)) {
        for (let index = enemy.burns.length - 1; index >= 0; index -= 1) {
          const burn = enemy.burns[index];
          burn.remaining -= delta;
          burn.nextTick -= delta;
          while (burn.nextTick <= 0 && burn.remaining >= 0 && enemy.hp > 0) {
            burn.nextTick += burn.interval;
            this.damageEnemy(enemy, burn.damage, {
              playerAttack: true, crit: 0, critDamage: 1,
              source: burn.source, noEquipmentEvents: true, statusDamage: true
            });
          }
          if (burn.remaining <= 0 || enemy.hp <= 0) enemy.burns.splice(index, 1);
        }
      }
      if (!enemy.image || enemy.image.destroyed) return false;
      const frozen = enemy.freezeRemaining > 0;
      const controlled = frozen || enemy.paralysisRemaining > 0 || enemy.dizzinessRemaining > 0;
      enemy.image.alpha = frozen ? 0.72 : controlled ? 0.82 : 1;
      return controlled;
    }

    enemyEquipmentAttackInterval(enemy) {
      const slowRatio = (enemy && enemy.equipmentSlowRemaining || 0) > 0
        ? Math.max(0, enemy.equipmentSlowRatio || 0) : 0;
      return (1 + slowRatio) / Math.max(0.1, enemy && enemy.attackSpeed || 1);
    }

    unitAoeRadius(unit) {
      return unit && unit.traits && unit.traits.AoeAtk ? 2 * PHYSICS_PIXEL_RATIO : 0;
    }

    unitProjectileSpeed(unit) {
      const explicit = Number(unit && unit.bulletSpeed);
      if (explicit > 0) return explicit;
      return Number(unit && unit.range) > 1 ? 15 : 5;
    }

    unitUsesVisibleProjectile(unit) {
      const zoom = Math.max(0.001, Number(unit && unit.zoom) || 1);
      return (Number(unit && unit.range) || 1) / zoom * PHYSICS_PIXEL_RATIO >= 100;
    }

    hostileBuildingHitBox(building) {
      if (!building || building.hp <= 0 || !building.image || building.image.destroyed) return null;
      const width = building.definition.width * CELL_STEP - CELL_GAP;
      const height = building.definition.height * CELL_STEP - CELL_GAP;
      const left = GRID_X + building.column * CELL_STEP;
      const top = GRID_Y + building.row * CELL_STEP + (this.stageContentOffset || 0);
      return { left, right: left + width, top, bottom: top + height };
    }

    hostileCastleHitBox() {
      if (this.castleHp <= 0) return null;
      const left = GRID_X + this.castlePosition.column * CELL_STEP;
      const top = GRID_Y + this.castlePosition.row * CELL_STEP + (this.stageContentOffset || 0);
      return {
        left,
        right: left + 3 * CELL_STEP - CELL_GAP,
        top,
        bottom: top + 2 * CELL_STEP - CELL_GAP
      };
    }

    findFirstHostileProjectileContact(start, end, projectileWidth, projectileHeight) {
      const halfWidth = Math.max(0, Number(projectileWidth) || 0) / 2;
      const halfHeight = Math.max(0, Number(projectileHeight) || 0) / 2;
      const candidates = [];
      for (const ally of this.allies) {
        if (ally.hp <= 0 || !ally.image || ally.image.destroyed) continue;
        candidates.push({ kind: "ally", value: ally, box: this.actorHitBox(ally) });
      }
      for (const building of this.buildings) {
        const box = this.hostileBuildingHitBox(building);
        if (box) candidates.push({ kind: "building", value: building, box });
      }
      const castleBox = this.hostileCastleHitBox();
      if (castleBox) candidates.push({ kind: "castle", value: null, box: castleBox });
      let best = null;
      let bestTime = Infinity;
      for (const candidate of candidates) {
        const hitTime = candidate.box && this.segmentExpandedBoxHitTime(
          start, end, candidate.box, halfWidth, halfHeight
        );
        if (hitTime === null || hitTime >= bestTime) continue;
        best = candidate;
        bestTime = hitTime;
      }
      return best ? Object.assign({ time: bestTime }, best) : null;
    }

    fireEnemyProjectile(enemy, routeTarget) {
      if (!enemy || !enemy.image || enemy.image.destroyed || !routeTarget || !routeTarget.point) return null;
      const start = { x: enemy.image.x, y: enemy.image.y };
      const point = routeTarget.point;
      const angle = Math.atan2(point.y - start.y, point.x - start.x);
      const visible = this.unitUsesVisibleProjectile(enemy.unit);
      const speed = Math.max(1, Number(enemy.bulletSpeed) || this.unitProjectileSpeed(enemy.unit)) * PHYSICS_PIXEL_RATIO;
      const range = Math.max(1, Number(enemy.range) || PHYSICS_PIXEL_RATIO);
      const image = new Laya.Image(UI.arrow);
      image.name = visible ? "EnemyUnitBullet" : "EnemyUnitMeleeSensor";
      image.size(visible ? 38 : range * 2, visible ? 20 : range);
      image.pivot(image.width / 2, image.height / 2);
      image.pos(start.x, start.y);
      image.rotation = angle * 180 / Math.PI;
      image.visible = visible;
      image.zOrder = 500;
      this.projectileLayer.addChild(image);
      const lifeTime = Math.max(0.27, range / speed + 0.1);
      const projectile = {
        image,
        target: routeTarget.value || null,
        destination: null,
        start,
        clock: 0,
        duration: lifeTime,
        lifeTime,
        damage: enemy.attack,
        sourceEnemy: enemy,
        hostileTargetKind: routeTarget.kind,
        settings: { kind: "unit", hostileUnit: true, source: start, autoFlow: false },
        speedPixelsPerSecond: speed,
        rotationDegrees: angle * 180 / Math.PI,
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        autoFlow: false,
        autoFlowIntervalMs: 30,
        flowTimeMs: 0
      };
      this.projectiles.push(projectile);
      return projectile;
    }

    updateHostileProjectile(projectile, delta) {
      projectile.clock += delta;
      const motion = this.stepProjectileMotion(projectile, null, delta);
      const contact = this.findFirstHostileProjectileContact(
        motion.start, motion.end, projectile.image.width, projectile.image.height
      );
      if (contact) {
        const point = {
          x: motion.start.x + (motion.end.x - motion.start.x) * contact.time,
          y: motion.start.y + (motion.end.y - motion.start.y) * contact.time
        };
        projectile.image.pos(point.x, point.y);
        const source = projectile.sourceEnemy;
        const attacker = {
          attack: projectile.damage,
          crit: source.crit || 0,
          critDamage: source.critDamage || 1,
          unit: source.unit,
          image: source.image,
          sourceEnemy: source,
          attackSource: projectile.start
        };
        this.enemyAttack(attacker, contact.value, point, contact.kind === "castle");
        return true;
      }
      return projectile.clock >= projectile.lifeTime;
    }

    enemyAttack(enemy, target, targetPoint, directCastleHit) {
      const point = targetPoint || (target && target.definition ? this.buildingCenter(target) : target && target.image);
      if (!point) return;
      const aoeRadius = this.unitAoeRadius(enemy.unit);
      const buildings = aoeRadius
        ? this.buildings.filter((building) => building.hp > 0 && distance(this.buildingCenter(building), point) <= aoeRadius)
        : target && target.definition ? [target] : [];
      const allies = aoeRadius
        ? this.allies.filter((ally) => ally.hp > 0 && ally.image && !ally.image.destroyed && distance(ally.image, point) <= aoeRadius)
        : target && !target.definition ? [target] : [];
      for (const building of [...buildings]) {
        const hit = this.rollCombatDamage(enemy.attack, enemy.crit, enemy.critDamage, 0);
        building.hp -= hit.damage;
        if (building.hpFill) building.hpFill.width = 76 * Math.max(0, building.hp / building.maxHp);
        this.spawnDamageText(building.image.x + building.image.width / 2, building.image.y + (this.stageContentOffset || 0), Math.round(hit.damage), hit.critical ? "#ffd54d" : "#ff765b");
        if (building.hp <= 0) this.destroyBuilding(building);
      }
      for (const ally of [...allies]) {
        const hit = this.rollCombatDamage(enemy.attack, enemy.crit, enemy.critDamage, ally.dodge || 0);
        if (hit.dodged) {
          const dodgeBonus = ally.equipmentEventPolicy && ally.equipmentEventPolicy.unit
            ? ally.equipmentEventPolicy.unit.dodgeNextAttackDamageAdd || 0 : 0;
          if (dodgeBonus > 0) ally.dodgeNextAttackBonus = (ally.dodgeNextAttackBonus || 0) + dodgeBonus;
        }
        const shieldBefore = ally.shield || 0;
        const absorbed = Math.min(ally.shield || 0, hit.damage);
        ally.shield = Math.max(0, (ally.shield || 0) - absorbed);
        ally.hp -= Math.max(0, hit.damage - absorbed);
        this.updateAllyHealthBar(ally, true);
        const reflectionRatio = ally.equipmentEventPolicy && ally.equipmentEventPolicy.unit
          ? ally.equipmentEventPolicy.unit.reflectionDamageRatio || 0 : 0;
        if (reflectionRatio > 0 && hit.damage > 0) {
          const reflectionDamage = hit.damage * reflectionRatio;
          const reflectionSource = ally.image && !ally.image.destroyed
            ? { x: ally.image.x, y: ally.image.y } : point;
          this.scheduleCombatEvent(1 / 60, "equipment-reflection", () => {
            this.damageEnemy(enemy.sourceEnemy || enemy, reflectionDamage, {
              fixedDamage: true, playerAttack: false, crit: 0, critDamage: 1,
              source: reflectionSource, noEquipmentEvents: true, reflectionDamage: true
            });
          });
        }
        if (shieldBefore > 0 && ally.shield <= 0) this.triggerShieldExplosion(ally);
        this.applyRepel(
          ally,
          enemy.image && !enemy.image.destroyed ? enemy.image : enemy.attackSource || point,
          enemy.unit.traits && enemy.unit.traits.Repel
        );
        if (ally.hp <= 0) this.removeAlly(ally);
      }
      const castlePoint = { x: this.castleCenter.x, y: this.castleCenter.y - 55 };
      if (directCastleHit || (aoeRadius && distance(castlePoint, point) <= aoeRadius)) {
        const hit = this.rollCombatDamage(enemy.attack, enemy.crit, enemy.critDamage, 0);
        this.castleHp = Math.max(0, this.castleHp - hit.damage);
        this.refreshCastleHp();
        if (this.castleHp <= 0) this.finishRun(false);
      }
    }

    triggerShieldExplosion(ally) {
      const policy = ally && ally.equipmentEventPolicy && ally.equipmentEventPolicy.unit;
      const explosion = policy && policy.shieldExplosion;
      if (!explosion || !ally.image || ally.image.destroyed) return false;
      const point = { x: ally.image.x, y: ally.image.y };
      const damage = ally.attack * explosion.damageRatio;
      const node = new Laya.Sprite();
      node.pos(point.x, point.y);
      node.zOrder = 650;
      node.graphics.drawCircle(0, 0, explosion.radiusPixels, "#79d8ff", "#d9f6ff", 5);
      this.actorLayer.addChild(node);
      this.effects.push({ kind: "equipment-shield-explosion", node, clock: 0, duration: 0.35 });
      for (const target of [...this.enemies]) {
        if (!target.image || target.image.destroyed || distance(target.image, point) > explosion.radiusPixels) continue;
        this.damageEnemy(target, damage, {
          playerAttack: true, crit: 0, critDamage: 1,
          source: point, noEquipmentEvents: true
        });
      }
      return true;
    }

    findNearestWall(sourceImage, maxDistance) {
      let result = null;
      let best = maxDistance;
      for (const building of this.buildings) {
        if (building.definition.class !== "wall" || building.hp <= 0) continue;
        const gap = distance(sourceImage, this.buildingCenter(building));
        if (gap < best) { best = gap; result = building; }
      }
      return result;
    }

    enemySlowAt(sourceImage) {
      let multiplier = 1 / this.traitMultiplier("EnemySpeedDown");
      for (const building of this.buildings) {
        if (building.definition.class !== "move") continue;
        const amount = (building.definition.extra && building.definition.extra.MoveSpeedDownRadio) || 0;
        multiplier /= 1 + amount;
      }
      return clamp(multiplier, 0.05, 1);
    }

    removeBuilding(building, clearOccupied) {
      if (clearOccupied !== false) this.markOccupied(building, 0);
      if (building.image && !building.image.destroyed) building.image.destroy(true);
      if (building.hpBack && !building.hpBack.destroyed) building.hpBack.destroy(true);
      const index = this.buildings.indexOf(building);
      if (index >= 0) this.buildings.splice(index, 1);
      for (const ally of this.allies.filter((item) => item.sourceBuildingId === building.id)) this.removeAlly(ally);
    }

    destroyBuilding(building) {
      if (this.fighting && !this.buildNotRecover) {
        building.hp = 0;
        building.defeated = true;
        if (building.image && !building.image.destroyed) building.image.visible = false;
        if (building.hpBack && !building.hpBack.destroyed) building.hpBack.visible = false;
        for (const ally of this.allies.filter((item) => item.sourceBuildingId === building.id)) this.removeAlly(ally);
        return;
      }
      this.removeBuilding(building, true);
    }

    buildingBuffs(building) {
      let attackMultiplier = 1;
      let speedMultiplier = 1;
      let critAdd = 0;
      for (const source of this.buildings) {
        if (source === building) continue;
        const extra = source.definition.extra || {};
        const adjacent = this.buildingsAdjacent(source, building);
        if (source.definition.class === "roundAtk" && adjacent) attackMultiplier += extra.RoundAtkAdd || 0;
        if (source.definition.class === "roundSpeed" && adjacent) speedMultiplier += extra.RoundSpeedAdd || 0;
        if (source.definition.class === "crit") critAdd += extra.CritAdd || 0;
      }
      return { attackMultiplier, speedMultiplier, critAdd };
    }

    buildingsAdjacent(left, right) {
      for (const [leftX, leftY] of left.definition.cells) {
        const sourceX = left.column + leftX;
        const sourceY = left.row + leftY;
        for (const [rightX, rightY] of right.definition.cells) {
          const targetX = right.column + rightX;
          const targetY = right.row + rightY;
          if (Math.max(Math.abs(sourceX - targetX), Math.abs(sourceY - targetY)) === 1) return true;
        }
      }
      return false;
    }

    aimWeaponMount(building, target, delta) {
      const mount = building.image.getChildByName("WeaponMount");
      if (!mount || !target || !target.image || target.image.destroyed) return;
      const mountX = building.image.x + mount.x;
      const mountY = building.image.y + mount.y;
      const wanted = Math.atan2(target.image.y - mountY, target.image.x - mountX) * 180 / Math.PI;
      let difference = ((wanted - mount.rotation + 540) % 360) - 180;
      const maximumStep = 600 * delta;
      difference = clamp(difference, -maximumStep, maximumStep);
      mount.rotation += difference;
    }

    equipmentScatterAngles(count) {
      const total = Math.max(1, Math.trunc(Number(count) || 1));
      const angles = [0];
      let spread = 10;
      for (let index = 1; index < total; index += 1) {
        angles.push(index % 2 ? -spread : spread);
        if (index % 2 === 0) spread += 10;
      }
      return angles;
    }

    actorHitBox(actor) {
      if (!actor || !actor.image || actor.image.destroyed) return null;
      const bottom = actor.image.y + actor.image.height / 2;
      return {
        left: actor.image.x - UNIT_HITBOX_WIDTH / 2,
        right: actor.image.x + UNIT_HITBOX_WIDTH / 2,
        top: bottom - UNIT_HITBOX_HEIGHT,
        bottom
      };
    }

    segmentExpandedBoxHitTime(start, end, box, halfWidth, halfHeight) {
      const expanded = {
        left: box.left - halfWidth,
        right: box.right + halfWidth,
        top: box.top - halfHeight,
        bottom: box.bottom + halfHeight
      };
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      let minimum = 0;
      let maximum = 1;
      const clipAxis = (origin, delta, lower, upper) => {
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

    findFirstProjectileContact(start, end, ignored, projectileWidth, projectileHeight) {
      const omitted = ignored || [];
      const halfWidth = Math.max(0, Number(projectileWidth) || 0) / 2;
      const halfHeight = Math.max(0, Number(projectileHeight) || 0) / 2;
      let best = null;
      let bestTime = Infinity;
      for (const enemy of this.enemies) {
        if (omitted.includes(enemy) || enemy.hp <= 0 || !enemy.image || enemy.image.destroyed) continue;
        const box = this.actorHitBox(enemy);
        const hitTime = box && this.segmentExpandedBoxHitTime(start, end, box, halfWidth, halfHeight);
        if (hitTime === null || hitTime >= bestTime) continue;
        best = enemy;
        bestTime = hitTime;
      }
      return best ? { target: best, time: bestTime } : null;
    }

    findScatterTarget(start, primary, angleOffset, travelDistance, projectileWidth, projectileHeight) {
      if (!angleOffset) return primary;
      const baseAngle = Math.atan2(primary.image.y - start.y, primary.image.x - start.x) * 180 / Math.PI;
      const wanted = baseAngle + angleOffset;
      const radians = wanted * Math.PI / 180;
      const end = {
        x: start.x + Math.cos(radians) * travelDistance,
        y: start.y + Math.sin(radians) * travelDistance
      };
      const contact = this.findFirstProjectileContact(start, end, [], projectileWidth, projectileHeight);
      return contact ? contact.target : null;
    }

    fireEquipmentSalvo(start, primary, damage, options) {
      if (!primary || primary.hp <= 0 || !primary.image || primary.image.destroyed) return 0;
      const settings = options || {};
      const policy = settings.equipmentEventPolicy && settings.equipmentEventPolicy.weapon;
      const angles = this.equipmentScatterAngles(policy ? policy.scatteringShotCount : 1);
      const baseAngle = Math.atan2(primary.image.y - start.y, primary.image.x - start.x);
      const travelDistance = Math.max(distance(start, primary.image), Number(settings.attackRange) || 0, 120);
      const projectileWidth = Number(settings.width) || (settings.kind === "throw" ? 48 : 38);
      const projectileHeight = Number(settings.height) || (settings.kind === "throw" ? 26 : 20);
      let emitted = 0;
      for (const angleOffset of angles) {
        const target = this.findScatterTarget(
          start, primary, angleOffset, travelDistance, projectileWidth, projectileHeight
        );
        const radians = baseAngle + angleOffset * Math.PI / 180;
        const destination = target ? null : {
          x: start.x + Math.cos(radians) * travelDistance,
          y: start.y + Math.sin(radians) * travelDistance
        };
        this.fire(start, target, damage, Object.assign({}, settings, {
          scatterAngle: angleOffset,
          destination,
          throughRemaining: policy ? policy.throughExtraHits || 0 : 0,
          jumpRemaining: (settings.baseJumpCount || 0) + (policy ? policy.jumpExtraTargets || 0 : 0),
          hitTargets: []
        }));
        emitted += 1;
      }
      return emitted;
    }

    defaultProjectileSpeedPixels(kind) {
      const physicsSpeed = {
        throw: 25,
        laser: 500,
        light: 120,
        defalt: 20,
        unit: 15
      }[kind || "defalt"] || 20;
      return physicsSpeed * PHYSICS_PIXEL_RATIO;
    }

    projectileSpeedPixels(settings) {
      const explicit = Number(settings && settings.projectileSpeed);
      return explicit > 0 ? explicit : this.defaultProjectileSpeedPixels(settings && settings.kind);
    }

    projectileTravelDuration(start, end, settings) {
      return Math.max(0.001, distance(start, end) / this.projectileSpeedPixels(settings));
    }

    projectileLifeTime(settings, initialDuration) {
      const speed = this.projectileSpeedPixels(settings);
      const attackRange = Math.max(0, Number(settings && settings.attackRange) || 0);
      if (settings && settings.kind === "light") return 0.3;
      if (settings && settings.kind === "unit") return Math.max(0.27, attackRange / speed + 0.1);
      return Math.max(initialDuration, attackRange > 0 ? attackRange / speed : 0);
    }

    projectileTurnDelta(currentDegrees, wantedDegrees) {
      let difference = wantedDegrees - currentDegrees % 360;
      if (difference > 180) difference -= 360;
      return clamp(difference, -10, 10);
    }

    stepProjectileMotion(projectile, targetPoint, delta) {
      const start = { x: projectile.image.x, y: projectile.image.y };
      let turn = 0;
      if (projectile.autoFlow && targetPoint) {
        if (projectile.flowTimeMs < projectile.autoFlowIntervalMs) {
          projectile.flowTimeMs += delta * 1000;
        } else {
          projectile.flowTimeMs = 0;
          const wanted = Math.atan2(targetPoint.y - start.y, targetPoint.x - start.x) * 180 / Math.PI;
          turn = this.projectileTurnDelta(projectile.rotationDegrees, wanted);
          projectile.rotationDegrees += turn;
          const radians = projectile.rotationDegrees * Math.PI / 180;
          projectile.velocity = {
            x: Math.cos(radians) * projectile.speedPixelsPerSecond,
            y: Math.sin(radians) * projectile.speedPixelsPerSecond
          };
          projectile.settings.travelDirection = this.normalizeRouteVector(projectile.velocity);
        }
      }
      const end = {
        x: start.x + projectile.velocity.x * delta,
        y: start.y + projectile.velocity.y * delta
      };
      projectile.image.pos(end.x, end.y);
      projectile.image.rotation = projectile.rotationDegrees;
      return { start, end, turn };
    }

    updateBuildings(delta) {
      for (const building of [...this.buildings]) {
        if (!building.image || building.image.destroyed) continue;
        if (building.eventRuntime) {
          building.eventRuntime.meteoriteCooldown = Math.max(0, building.eventRuntime.meteoriteCooldown - delta);
          building.eventRuntime.trapCooldown = Math.max(0, building.eventRuntime.trapCooldown - delta);
          building.eventRuntime.arrowBarrageCooldown = Math.max(0, building.eventRuntime.arrowBarrageCooldown - delta);
        }
        const definition = building.definition;
        if (!["defense", "barracks"].includes(definition.class)) continue;
        const target = definition.class === "defense" ? this.findTarget(building, definition.rangePixels) : null;
        if (target) this.aimWeaponMount(building, target, delta);
        building.cooldown -= delta;
        if (building.cooldown > 0) continue;
        const buffs = this.buildingBuffs(building);
        if (definition.class === "barracks") {
          const alive = this.allies.filter((ally) => ally.sourceBuildingId === building.id).length;
          const maximum = (definition.extra && definition.extra.SummonUnitMax) || 2;
          if (alive < maximum) this.spawnAlly(building);
          building.cooldown = definition.cooldown / buffs.speedMultiplier;
          continue;
        }
        if (!target) continue;
        const damage = definition.attack * buffs.attackMultiplier;
        const crit = Math.min(0.95, (definition.crit || 0) + buffs.critAdd);
        const start = this.buildingCenter(building);
        const eventPolicy = definition.equipmentEventPolicy || this.evaluateEquipmentEventTraits([]);
        const attackContext = {
          crit, critDamage: definition.critDamage || 1.5, source: start, playerAttack: true,
          equipmentEventPolicy: eventPolicy, ownerMaxHp: building.maxHp || definition.hp,
          owner: building,
          projectileElementPolicy: definition.fireType === "throw" ? eventPolicy.weapon.stoneElement : eventPolicy.weapon.arrowElement
        };
        if (definition.fireType === "laser") {
          const laserExtra = Object.assign({}, definition.extra || {});
          laserExtra.LaserTime = (laserExtra.LaserTime || 2) * (eventPolicy.weapon.projectileLifetimeMultiplier || 1);
          this.laser(start, target, damage, laserExtra, attackContext);
        } else {
          const salvo = () => {
            if (!building.image || building.image.destroyed || !target || target.hp <= 0) return;
            this.fireEquipmentSalvo(this.buildingCenter(building), target, damage, Object.assign({
              kind: definition.fireType || "defalt",
              splash: definition.fireType === "throw" ? (((definition.extra && definition.extra.ThrowAoeRange) || 0) * PHYSICS_PIXEL_RATIO) : 0,
              splashRatio: definition.extra && definition.extra.ThrowAoeDmgRadio,
              baseJumpCount: definition.fireType === "light" ? ((definition.extra && definition.extra.LightJumpCnt) || 0) : 0,
              attackRange: definition.rangePixels,
              projectileSpeed: this.defaultProjectileSpeedPixels(definition.fireType || "defalt")
            }, attackContext));
          };
          salvo();
          for (let shot = 1; shot < eventPolicy.weapon.totalSequentialShots; shot += 1) {
            this.scheduleCombatEvent(shot * 0.1, "equipment-consecutive-shot", salvo);
          }
        }
        building.cooldown = definition.cooldown / buffs.speedMultiplier;
      }
    }

    spawnAlly(building) {
      const unit = this.unitById[building.definition.summonUnitId];
      if (!unit) return;
      const body = unit.bodies[Math.min(unit.bodies.length - 1, building.definition.level - 1)] || unit.bodies[0];
      const frames = this.framesForBody(body);
      const image = new Laya.Image(frames[0]);
      const idleSkin = this.framesForBody(body, "idle")[0] || frames[0];
      this.setActorSize(image, idleSkin, unit.zoom || 1);
      const center = this.buildingCenter(building);
      image.pos(center.x, center.y - 18);
      image.zOrder = image.y;
      this.actorLayer.addChild(image);
      const hpBack = addImage(this.actorLayer, UI.enemyHpBack, 0, 0, 70, 14, `AllyHp_${this.nextActorId}`);
      const hpFill = addImage(hpBack, UI.enemyHpFill, 3, 3, 64, 8, "Fill");
      hpBack.visible = false;
      const hpRatio = (this.fightParams.SynHpRadio || [1])[building.definition.level - 1] || 1;
      const attackRatio = (this.fightParams.SynAtkRadio || [1])[building.definition.level - 1] || 1;
      const localPolicy = (building.definition.equipmentNumericPolicy && building.definition.equipmentNumericPolicy.unit) || {};
      const scenePolicy = this.equipmentScenePolicy || {};
      const tech = this.techEffects || {};
      const hp = unit.hp * hpRatio * this.traitMultiplier("AllUnitHp")
        * (localPolicy.hpMultiplier || 1) * (scenePolicy.allUnitHpMultiplier || 1) * (tech.allUnitHpMultiplier || 1);
      const attack = unit.attack * attackRatio * this.traitMultiplier("AllUnitAtk")
        * (localPolicy.attackMultiplier || 1) * (scenePolicy.allUnitAttackMultiplier || 1) * (tech.allUnitAttackMultiplier || 1);
      const ranged = (unit.range || 1) > 1.5;
      const rangeMultiplier = ranged ? this.traitMultiplier("RangedUnitAtkRange") : 1;
      const eventPolicy = building.definition.equipmentEventPolicy || this.evaluateEquipmentEventTraits([]);
      const ally = {
        id: this.nextActorId++, sourceBuildingId: building.id, unit, image, frames, frame: 0, frameClock: 0, body,
        team: "ally", hp, maxHp: hp, hpBack, hpFill, hpBarRevealed: false, attack, attackCooldown: 0,
        crit: (unit.crit || 0) + (localPolicy.critAdd || 0) + (tech.allUnitCritAdd || 0),
        critDamage: (unit.critDamage || 1) * (localPolicy.critDamageMultiplier || 1),
        dodge: (unit.dodge || 0) + (localPolicy.dodgeAdd || 0) + (tech.allUnitDodgeAdd || 0),
        attackSpeed: (unit.attackSpeed || 1) * this.traitMultiplier("AllUnitAtkSpd")
          * (localPolicy.attackSpeedMultiplier || 1) * (scenePolicy.allUnitAttackSpeedMultiplier || 1) * (tech.allUnitAttackSpeedMultiplier || 1),
        speed: (unit.speed || 1) * PHYSICS_PIXEL_RATIO * UNIT_SPEED_RADIO
          * (localPolicy.speedMultiplier || 1) * (scenePolicy.allUnitSpeedMultiplier || 1) * (tech.allUnitSpeedMultiplier || 1),
        range: Math.max(42, (unit.range || 1) * PHYSICS_PIXEL_RATIO * rangeMultiplier * (localPolicy.rangeMultiplier || 1)),
        bulletSpeed: this.unitProjectileSpeed(unit), target: null, repel: null,
        aliveMs: 0, routeOrder: -1, routeSearchRange: -1, routeRandom: null,
        routeColliderScale: 1, routeForceColliders: new Map(),
        equipmentEventPolicy: eventPolicy,
        equipmentCriticalCounter: 0,
        eventRuntime: { meteoriteCooldown: 0, trapCooldown: 0, arrowBarrageCooldown: 0 },
        charging: !!eventPolicy.weapon.charge,
        shield: hp * ((eventPolicy.unit && eventPolicy.unit.totalShieldHpRatio) || 0)
      };
      this.configureActorAnimation(ally, body, false, ally.charging ? "charge" : "idle");
      if (ally.charging) ally.speed *= eventPolicy.weapon.charge.speedMultiplier || 1.5;
      this.allies.push(ally);
      this.updateAllyHealthBar(ally);
      return ally;
    }

    updateAllies(delta) {
      for (const ally of [...this.allies]) {
        if (!ally.image || ally.image.destroyed) continue;
        if (ally.eventRuntime) {
          ally.eventRuntime.meteoriteCooldown = Math.max(0, ally.eventRuntime.meteoriteCooldown - delta);
          ally.eventRuntime.trapCooldown = Math.max(0, ally.eventRuntime.trapCooldown - delta);
          ally.eventRuntime.arrowBarrageCooldown = Math.max(0, ally.eventRuntime.arrowBarrageCooldown - delta);
        }
        this.advanceActorAnimation(ally, delta);
        if (this.updateRepelledActor(ally, delta)) {
          this.setActorAction(ally, "move");
          continue;
        }
        ally.aliveMs += delta * 1000;
        if (!ally.target || ally.target.hp <= 0 || !ally.target.image || ally.target.image.destroyed) {
          const previousTarget = ally.target;
          ally.target = this.findNearestEnemy(ally.image);
          if (ally.target !== previousTarget) ally.routeRandom = null;
        }
        const targetPoint = ally.target
          ? { x: ally.target.image.x, y: ally.target.image.y }
          : { x: ally.image.x, y: 0 };
        const sourcePoint = { x: ally.image.x, y: ally.image.y };
        const gap = distance(sourcePoint, targetPoint);
        if (gap > ally.range) {
          this.setActorAction(ally, ally.charging ? "charge" : "move");
          this.setActorFacing(ally, targetPoint.x - sourcePoint.x);
          const forward = this.unitRouteForward(ally, targetPoint);
          const movement = ally.speed * delta;
          ally.image.pos(
            clamp(sourcePoint.x + forward.x * movement, ROUTE_MAP_LEFT, ROUTE_MAP_RIGHT),
            clamp(sourcePoint.y + forward.y * movement, 0, DESIGN_HEIGHT)
          );
          ally.image.zOrder = ally.image.y;
          this.updateAllyHealthBar(ally);
          continue;
        }
        if (!ally.target) {
          this.setActorAction(ally, "idle");
          continue;
        }
        this.setActorFacing(ally, ally.target.image.x - ally.image.x);
        ally.attackCooldown -= delta;
        if (ally.attackCooldown <= 0) {
          const interval = 1 / Math.max(0.1, ally.attackSpeed);
          const targetAtReady = ally.target;
          this.beginActorAttack(ally, interval, () => this.performAllyAttack(ally, targetAtReady));
          ally.attackCooldown += interval;
        } else this.setActorAction(ally, "idle");
      }
    }

    performAllyAttack(ally, targetAtReady) {
      if (!ally || !ally.image || ally.image.destroyed || !targetAtReady || targetAtReady.hp <= 0
        || !targetAtReady.image || targetAtReady.image.destroyed) return false;
      const eventPolicy = ally.equipmentEventPolicy || this.evaluateEquipmentEventTraits([]);
      let crit = ally.crit;
      const threshold = eventPolicy.weapon.criticalCounterThreshold;
      if (threshold !== null) {
        ally.equipmentCriticalCounter += 1;
        if (ally.equipmentCriticalCounter > threshold) {
          ally.equipmentCriticalCounter = 0;
          crit = 1;
        }
      }
      const sourcePoint = { x: ally.image.x, y: ally.image.y };
      const attackContext = {
        crit,
        critDamage: ally.critDamage,
        repel: ally.unit.traits && ally.unit.traits.Repel,
        source: sourcePoint,
        playerAttack: true,
        equipmentEventPolicy: eventPolicy,
        ownerMaxHp: ally.maxHp,
        owner: ally,
        projectileElementPolicy: eventPolicy.weapon.arrowElement,
        charge: ally.charging ? eventPolicy.weapon.charge : null
      };
      const attackDamage = ally.attack * (attackContext.charge ? attackContext.charge.damageRatio : 1);
      const dodgeNextAttackBonus = ally.dodgeNextAttackBonus || 0;
      const attackOnce = (damageMultiplier) => {
        if (!ally.image || ally.image.destroyed || targetAtReady.hp <= 0
          || !targetAtReady.image || targetAtReady.image.destroyed) return;
        const currentSource = { x: ally.image.x, y: ally.image.y };
        const shotDamage = attackDamage * damageMultiplier;
        if ((ally.unit.range || 1) <= 1.5) {
          this.damageEnemy(targetAtReady, shotDamage, Object.assign({}, attackContext, { source: currentSource }));
        } else {
          this.fireEquipmentSalvo(currentSource, targetAtReady, shotDamage, Object.assign({
            kind: "unit", splash: this.unitAoeRadius(ally.unit), splashRatio: 1,
            attackRange: ally.range,
            projectileSpeed: Math.max(1, ally.bulletSpeed) * PHYSICS_PIXEL_RATIO
          }, attackContext, { source: currentSource }));
        }
      };
      attackOnce(1 + dodgeNextAttackBonus);
      for (let shot = 1; shot < eventPolicy.weapon.totalSequentialShots; shot += 1) {
        this.scheduleCombatEvent(shot * 0.1, "equipment-consecutive-shot", () => attackOnce(1));
      }
      if (dodgeNextAttackBonus > 0) ally.dodgeNextAttackBonus = 0;
      if (ally.charging) {
        ally.charging = false;
        ally.speed /= (eventPolicy.weapon.charge && eventPolicy.weapon.charge.speedMultiplier) || 1.5;
      }
      return true;
    }

    fire(start, target, damage, options) {
      const requestedDestination = options && options.destination;
      if ((!target || !target.image || target.image.destroyed) && !requestedDestination) return;
      const settings = Object.assign({ source: { x: start.x, y: start.y } }, options || {});
      const image = new Laya.Image(settings.skin || UI.arrow);
      image.size(settings.width || (settings.kind === "throw" ? 48 : 38), settings.height || (settings.kind === "throw" ? 26 : 20));
      image.pivot(image.width / 2, image.height / 2);
      image.pos(start.x, start.y);
      image.zOrder = 500;
      if (settings.kind === "light") image.filters = [new Laya.ColorFilter([0.5, 0, 0, 0, 50, 0, 0.9, 0, 0, 70, 0, 0, 1.4, 0, 120, 0, 0, 0, 1, 0])];
      this.projectileLayer.addChild(image);
      const end = target && target.image ? target.image : requestedDestination;
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      settings.travelDirection = settings.travelDirection || { x: Math.cos(angle), y: Math.sin(angle) };
      const speedPixelsPerSecond = this.projectileSpeedPixels(settings);
      const rotationDegrees = Math.atan2(settings.travelDirection.y, settings.travelDirection.x) * 180 / Math.PI;
      const duration = this.projectileTravelDuration(start, end, settings);
      this.projectiles.push({
        image, target: target || null, destination: requestedDestination || null,
        start: { x: start.x, y: start.y }, clock: 0,
        duration, lifeTime: this.projectileLifeTime(settings, duration), damage, settings,
        lastTargetPoint: target && target.image ? { x: target.image.x, y: target.image.y } : null,
        deadTargetPoint: null, deadInLastLatched: false,
        speedPixelsPerSecond, rotationDegrees,
        velocity: {
          x: settings.travelDirection.x * speedPixelsPerSecond,
          y: settings.travelDirection.y * speedPixelsPerSecond
        },
        autoFlow: !!target && (settings.autoFlow === undefined ? settings.kind !== "unit" : settings.autoFlow !== false),
        autoFlowIntervalMs: Math.max(0, Number(settings.autoFlowIntervalMs) || 30),
        flowTimeMs: 0
      });
    }

    laser(start, target, damage, extra, attackContext) {
      const context = Object.assign({ source: { x: start.x, y: start.y } }, attackContext || {});
      this.damageEnemy(target, damage, context);
      const beam = new Laya.Sprite();
      beam.zOrder = 600;
      beam.graphics.drawLine(start.x, start.y, target.image.x, target.image.y, "#71eaff", 8);
      this.projectileLayer.addChild(beam);
      this.effects.push({
        kind: "laser", node: beam, clock: 0,
        duration: extra.LaserTime || 2,
        tickInterval: extra.LaserTriggerInterval || 0.25,
        nextTick: extra.LaserTriggerInterval || 0.25,
        start: { x: start.x, y: start.y }, target, damage, attackContext: context
      });
    }

    findProjectileJumpTarget(projectile, point, previousTarget) {
      const range = Number(projectile.settings.attackRange) || Infinity;
      const candidates = this.enemies.filter((enemy) => enemy !== previousTarget && enemy.hp > 0
        && enemy.image && !enemy.image.destroyed && distance(point, enemy.image) <= range);
      if (!candidates.length) return null;
      const random = this.combatRandom || Math.random;
      return candidates[Math.floor(random() * candidates.length)] || candidates[0];
    }

    findProjectileThroughTarget(projectile, point) {
      const direction = projectile.settings.travelDirection || { x: 0, y: -1 };
      const ignored = projectile.settings.hitTargets || [];
      const travelDistance = Math.hypot(DESIGN_WIDTH, DESIGN_HEIGHT);
      const start = { x: point.x + direction.x, y: point.y + direction.y };
      const end = {
        x: start.x + direction.x * travelDistance,
        y: start.y + direction.y * travelDistance
      };
      const contact = this.findFirstProjectileContact(
        start, end, ignored, projectile.image.width, projectile.image.height
      );
      return contact ? contact.target : null;
    }

    retargetProjectile(projectile, target, start, resetDirection) {
      projectile.target = target;
      projectile.destination = null;
      projectile.start = { x: start.x, y: start.y };
      projectile.image.pos(start.x, start.y);
      projectile.clock = 0;
      projectile.duration = this.projectileTravelDuration(start, target.image, projectile.settings);
      projectile.lifeTime = this.projectileLifeTime(projectile.settings, projectile.duration);
      projectile.flowTimeMs = 0;
      if (resetDirection) {
        const angle = Math.atan2(target.image.y - start.y, target.image.x - start.x);
        projectile.settings.travelDirection = { x: Math.cos(angle), y: Math.sin(angle) };
        projectile.rotationDegrees = angle * 180 / Math.PI;
        projectile.velocity = {
          x: projectile.settings.travelDirection.x * projectile.speedPixelsPerSecond,
          y: projectile.settings.travelDirection.y * projectile.speedPixelsPerSecond
        };
      }
    }

    projectileUsesSweptEnemyContacts(projectile) {
      const kind = projectile && projectile.settings && projectile.settings.kind;
      return kind !== "throw" && kind !== "light"
        && !(projectile && projectile.settings && projectile.settings.forceTargetOnly);
    }

    latchProjectileDeadInLast(projectile) {
      if (!projectile || !projectile.settings || !projectile.settings.deadInLast
        || projectile.deadInLastLatched || !projectile.target) return false;
      const image = projectile.target.image;
      const imageAvailable = image && !image.destroyed;
      if (imageAvailable) projectile.lastTargetPoint = { x: image.x, y: image.y };
      if (imageAvailable && projectile.target.hp > 0) return false;
      projectile.deadInLastLatched = true;
      projectile.deadTargetPoint = projectile.lastTargetPoint
        ? { x: projectile.lastTargetPoint.x, y: projectile.lastTargetPoint.y }
        : { x: projectile.image.x, y: projectile.image.y };
      projectile.autoFlow = false;
      return distance(projectile.image, projectile.deadTargetPoint) <= 50;
    }

    updateProjectiles(delta) {
      for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = this.projectiles[index];
        if (projectile.settings && projectile.settings.hostileUnit) {
          if (this.updateHostileProjectile(projectile, delta)) {
            projectile.image.destroy(true);
            this.projectiles.splice(index, 1);
          }
          continue;
        }
        if (this.latchProjectileDeadInLast(projectile)) {
          projectile.image.destroy(true);
          this.projectiles.splice(index, 1);
          continue;
        }
        const targetImageAvailable = projectile.target && projectile.target.image && !projectile.target.image.destroyed;
        const liveTarget = targetImageAvailable && projectile.target.hp > 0;
        if (liveTarget) {
          projectile.lastTargetPoint = { x: projectile.target.image.x, y: projectile.target.image.y };
        }
        projectile.clock += delta;
        const flowTargetPoint = targetImageAvailable && !projectile.deadInLastLatched
          ? { x: projectile.target.image.x, y: projectile.target.image.y }
          : null;
        const motion = this.stepProjectileMotion(projectile, flowTargetPoint, delta);
        let hitTarget = null;
        let hitDeadTarget = false;
        let end = motion.end;
        if (projectile.deadInLastLatched && projectile.deadTargetPoint) {
          const point = projectile.deadTargetPoint;
          const fakeBox = {
            left: point.x - 25, right: point.x + 25,
            top: point.y - 25, bottom: point.y + 25
          };
          const hitTime = this.segmentExpandedBoxHitTime(
            motion.start, motion.end, fakeBox, projectile.image.width / 2, projectile.image.height / 2
          );
          if (hitTime !== null) {
            hitDeadTarget = true;
            end = {
              x: motion.start.x + (motion.end.x - motion.start.x) * hitTime,
              y: motion.start.y + (motion.end.y - motion.start.y) * hitTime
            };
            projectile.image.pos(end.x, end.y);
          }
        } else if (this.projectileUsesSweptEnemyContacts(projectile)) {
          const contact = this.findFirstProjectileContact(
            motion.start, motion.end, projectile.settings.hitTargets || [],
            projectile.image.width, projectile.image.height
          );
          if (contact) {
            hitTarget = contact.target;
            end = {
              x: motion.start.x + (motion.end.x - motion.start.x) * contact.time,
              y: motion.start.y + (motion.end.y - motion.start.y) * contact.time
            };
            projectile.image.pos(end.x, end.y);
          }
        } else if (liveTarget) {
          const targetBox = this.actorHitBox(projectile.target);
          const hitTime = targetBox && this.segmentExpandedBoxHitTime(
            motion.start, motion.end, targetBox, projectile.image.width / 2, projectile.image.height / 2
          );
          if (hitTime !== null) {
            hitTarget = projectile.target;
            end = {
              x: motion.start.x + (motion.end.x - motion.start.x) * hitTime,
              y: motion.start.y + (motion.end.y - motion.start.y) * hitTime
            };
            projectile.image.pos(end.x, end.y);
          }
        }
        if (!hitTarget && !hitDeadTarget && projectile.clock < projectile.lifeTime) continue;
        if (hitDeadTarget || !hitTarget) {
          projectile.image.destroy(true);
          this.projectiles.splice(index, 1);
          continue;
        }
        if (hitTarget) this.damageEnemy(hitTarget, projectile.damage, projectile.settings);
        if (hitTarget && projectile.settings.splash) {
          const ratio = projectile.settings.splashRatio === undefined ? 0.5 : projectile.settings.splashRatio;
          for (const enemy of [...this.enemies]) {
            if (enemy !== hitTarget && enemy.image && !enemy.image.destroyed && distance(enemy.image, end) <= projectile.settings.splash) {
              this.damageEnemy(enemy, projectile.damage * ratio, projectile.settings);
            }
          }
        }
        if (hitTarget) {
          if (!Array.isArray(projectile.settings.hitTargets)) projectile.settings.hitTargets = [];
          projectile.settings.hitTargets.push(hitTarget);
          let nextTarget = null;
          let resetDirection = false;
          if ((projectile.settings.jumpRemaining || 0) > 0) {
            projectile.settings.jumpRemaining -= 1;
            nextTarget = this.findProjectileJumpTarget(projectile, end, hitTarget);
            resetDirection = true;
          } else if ((projectile.settings.throughRemaining || 0) > 0) {
            projectile.settings.throughRemaining -= 1;
            nextTarget = this.findProjectileThroughTarget(projectile, end);
          }
          if (nextTarget) {
            this.retargetProjectile(projectile, nextTarget, end, resetDirection);
            continue;
          }
        }
        projectile.image.destroy(true);
        this.projectiles.splice(index, 1);
      }
    }

    updateEffects(delta) {
      for (let index = this.effects.length - 1; index >= 0; index -= 1) {
        const effect = this.effects[index];
        effect.clock += delta;
        if (effect.kind === "equipment-arrow-barrage") {
          if (!effect.applied) {
            effect.applied = true;
            for (const enemy of [...this.enemies]) {
              if (!enemy.image || enemy.image.destroyed || distance(enemy.image, effect.point) > effect.radius) continue;
              this.damageEnemy(enemy, effect.damage, {
                playerAttack: true, crit: 0, critDamage: 1,
                source: effect.source, noEquipmentEvents: true
              });
            }
          }
          effect.node.alpha = 1 - effect.clock / effect.duration;
        } else if (effect.kind === "equipment-meteorite") {
          if (!effect.applied) {
            effect.applied = true;
            for (const enemy of [...this.enemies]) {
              if (!enemy.image || enemy.image.destroyed || distance(enemy.image, effect.point) > effect.radius) continue;
              this.damageEnemy(enemy, effect.damage, {
                playerAttack: true, crit: 0, critDamage: 1,
                source: effect.source, noEquipmentEvents: true
              });
              if (enemy.hp > 0 && effect.burnDamage > 0 && effect.burnDuration > 0) {
                this.applyEquipmentBurn(enemy, effect.burnDamage, effect.burnDuration, 1, effect.source);
              }
            }
          }
          effect.node.alpha = 1 - effect.clock / effect.duration;
        } else if (effect.kind === "equipment-slow-trap") {
          for (const enemy of this.enemies) {
            if (!enemy.image || enemy.image.destroyed || distance(enemy.image, effect.point) > effect.radius) continue;
            enemy.equipmentSlowRatio = Math.max(enemy.equipmentSlowRatio || 0, effect.slowRatio);
            enemy.equipmentSlowRemaining = Math.max(enemy.equipmentSlowRemaining || 0, 0.15);
          }
          effect.node.alpha = 0.28 + 0.12 * Math.sin(effect.clock * 12);
        } else if (effect.kind === "laser") {
          const targetAlive = effect.target && effect.target.hp > 0 && effect.target.image && !effect.target.image.destroyed;
          if (targetAlive) {
            effect.node.graphics.clear();
            effect.node.graphics.drawLine(effect.start.x, effect.start.y, effect.target.image.x, effect.target.image.y, "#71eaff", 8);
            while (effect.clock >= effect.nextTick && effect.nextTick < effect.duration) {
              this.damageEnemy(effect.target, effect.damage, effect.attackContext);
              effect.nextTick += effect.tickInterval;
              if (effect.target.hp <= 0) break;
            }
          } else {
            effect.clock = effect.duration;
          }
          effect.node.alpha = effect.clock > effect.duration - 0.18 ? Math.max(0, (effect.duration - effect.clock) / 0.18) : 1;
        } else {
          effect.node.alpha = 1 - effect.clock / effect.duration;
        }
        if (effect.clock >= effect.duration) {
          effect.node.destroy(true);
          this.effects.splice(index, 1);
        }
      }
    }

    traitChoices() {
      const qualityWeights = [80, 40, 20];
      const qualities = [];
      for (let index = 0; index < 3; index += 1) {
        const qualityIndex = weightedIndex(qualityWeights, this.traitRandom);
        qualities.push(qualityIndex + 1);
        if (qualityIndex === 2) qualityWeights.splice(2, 1);
      }
      const byQuality = {};
      for (const trait of this.generalTraits) {
        for (let index = 0; index < trait.qualities.length; index += 1) {
          const quality = trait.qualities[index];
          const value = trait.params[index];
          const weight = trait.weights[index];
          const sameId = this.activeTraits.filter((active) => active.id === trait.id);
          if (trait.stackType === 2 && sameId.reduce((sum, active) => sum + active.value, 0) + value > trait.stackLimit) continue;
          if (trait.stackType === 3 && sameId.some((active) => active.quality === quality)) continue;
          if (trait.stackType === 4 && sameId.length) continue;
          if (!byQuality[quality]) byQuality[quality] = [];
          byQuality[quality].push({ id: trait.id, quality, value, weight, effectKey: trait.effectKey });
        }
      }
      const choices = [];
      for (const quality of qualities) {
        const pool = byQuality[quality] || [];
        if (!pool.length) continue;
        const selectedIndex = weightedIndex(pool.map((trait) => trait.weight), this.traitRandom);
        choices.push(pool.splice(selectedIndex, 1)[0]);
      }
      return choices;
    }

    traitMultiplier(effectKey) {
      let multiplier = 1;
      for (const trait of this.activeTraits) if (trait.effectKey === effectKey) multiplier *= 1 + (Number(trait.value) || 0);
      return multiplier;
    }

    traitDisplayName(trait) {
      const names = {
        AllUnitAtk: "全体士兵攻击", AllUnitHp: "全体士兵生命", EnemySpeedDown: "敌军减速",
        AllUnitAtkSpd: "全体士兵攻速", ExpUp: "战斗经验", CoinsUp: "每波金币",
        Coins: "立即金币", RangedUnitAtkRange: "远程射程", ShopQ2RateUp: "二级建筑概率",
        ShopFreeItem: "商店额外栏位", ShopConsume: "刷新费用降低", DmgUpWithCnt: "建筑数量增伤",
        WinRewardUp: "胜利奖励", BossDmgUp: "首领增伤", Interest: "波次利息", RandLvUp: "随机建筑升级"
      };
      const value = trait.value < 1 ? `${Math.round(trait.value * 100)}%` : String(trait.value);
      return `${names[trait.effectKey] || trait.effectKey} +${value}`;
    }

    showTraitSelection() {
      if (this.traitSelecting) {
        this.pendingTraitSelections = (this.pendingTraitSelections || 0) + 1;
        return;
      }
      const choices = this.traitChoices();
      if (!choices.length) return;
      document.body.dataset.restoreTraitSelect = JSON.stringify({
        mode: this.testFastBattle ? "auto" : "paused-choice",
        fightLevel: this.fightLevel,
        choices: choices.map((trait) => ({ id: trait.id, effectKey: trait.effectKey, quality: trait.quality, value: trait.value }))
      });
      if (this.testFastBattle) {
        choices.sort((left, right) => right.quality - left.quality);
        this.applyGeneralTrait(choices[0]);
        return;
      }
      this.traitSelecting = true;
      this.paused = true;
      const panel = addRect(this.overlayLayer, 60, 360, 630, 500, "#18233f", 0.98, "TraitSelectPanel");
      panel.zOrder = 2000;
      panel.mouseEnabled = true;
      this.traitPanel = panel;
      addLabel(panel, `战斗等级 ${this.fightLevel} · 选择强化`, 30, 25, 570, 70, 34);
      const qualityColors = ["#70b7ff", "#ad7cff", "#ffb449"];
      choices.forEach((trait, index) => {
        this.makeButton(panel, this.traitDisplayName(trait), UI.blueButton, 55, 115 + index * 110, 520, 82, () => {
          this.applyGeneralTrait(trait);
          if (this.traitPanel && !this.traitPanel.destroyed) this.traitPanel.destroy(true);
          this.traitPanel = null;
          this.traitSelecting = false;
          this.paused = false;
          if (this.pendingTraitSelections > 0) {
            this.pendingTraitSelections -= 1;
            this.showTraitSelection();
          }
        }, 24);
        const choiceLabel = panel.getChildAt(panel.numChildren - 1);
        choiceLabel.alpha = 1;
        const edge = addRect(panel, 55, 115 + index * 110, 12, 82, qualityColors[trait.quality - 1] || "#ffffff", 1, `Quality_${trait.quality}`);
        edge.zOrder = 2;
      });
    }

    applyGeneralTrait(trait) {
      if (!trait) return;
      this.activeTraits.push(Object.assign({}, trait));
      document.body.dataset.restoreTraitApplied = JSON.stringify({ id: trait.id, effectKey: trait.effectKey, quality: trait.quality, value: trait.value });
      const key = trait.effectKey;
      const value = Number(trait.value) || 0;
      if (Object.prototype.hasOwnProperty.call(this.traitEffects, key)) this.traitEffects[key] += value;
      if (key === "Coins") this.money += value;
      if (key === "ShopFreeItem") this.ensureShopSlotCount(this.shopVisibleItemCount());
      if (key === "RandLvUp") {
        for (let count = 0; count < value; count += 1) {
          const candidates = this.buildings.filter((building) => building.definition.level < MAX_SYNTH_LEVEL);
          const target = candidates[Math.floor(this.traitRandom() * candidates.length)];
          if (target) this.mergeBuildingInto(target, null);
        }
      }
      if (this.refreshCostText) this.refreshCostText.text = String(this.refreshCost());
      for (const ally of this.allies) {
        if (key === "AllUnitAtk") ally.attack *= 1 + value;
        else if (key === "AllUnitHp") {
          ally.hp *= 1 + value;
          ally.maxHp *= 1 + value;
          this.updateAllyHealthBar(ally);
        } else if (key === "AllUnitAtkSpd") ally.attackSpeed *= 1 + value;
        else if (key === "RangedUnitAtkRange" && (ally.unit.range || 1) > 1.5) ally.range *= 1 + value;
      }
      this.refreshHud();
    }

    grantFightExperience(enemy, buildingExpBonus) {
      const expIndex = enemy.boss ? 2 : enemy.elite ? 1 : 0;
      const base = (this.fightParams.EnemyExp || [10, 20, 0])[expIndex] || 0;
      const fixed = Math.floor(base * (this.fightParams.EnemyExpFix || 1));
      if (fixed <= 0) return;
      const gained = fixed * (1 + buildingExpBonus + (this.traitEffects.ExpUp || 0));
      const next = this.fightLevels[this.fightLevel];
      const afterNext = this.fightLevels[this.fightLevel + 1];
      if (!next) return;
      if (this.fightLevelExp + gained >= next.exp) {
        if (!afterNext) return;
        this.fightLevel += 1;
        this.fightLevelExp = 0;
        this.showTraitSelection();
      } else this.fightLevelExp += gained;
    }

    playerDamageMultiplier(enemy) {
      let multiplier = 1;
      const buildingCount = this.buildings.length;
      for (const trait of this.activeTraits) {
        if (trait.effectKey === "DmgUpWithCnt") multiplier *= 1 + buildingCount * trait.value;
        if (trait.effectKey === "BossDmgUp" && enemy.boss) multiplier *= 1 + trait.value;
      }
      return multiplier;
    }

    damageEnemy(enemy, damage, attackContext) {
      if (!enemy || enemy.hp <= 0 || !enemy.image || enemy.image.destroyed) return;
      const context = attackContext || {};
      const seriousMultiplier = context.fixedDamage ? 1
        : (enemy.seriousInjuryRemaining || 0) > 0 ? 1 + (enemy.seriousInjuryRatio || 0) : 1;
      const adjustedDamage = damage * (context.playerAttack ? this.playerDamageMultiplier(enemy) : 1) * seriousMultiplier;
      const hit = context.fixedDamage
        ? { damage: adjustedDamage, critical: false, dodged: false }
        : this.rollCombatDamage(adjustedDamage, context.crit || 0, context.critDamage || 1, enemy.dodge || 0);
      let resolvedDamage = hit.damage;
      const eventWeapon = context.equipmentEventPolicy && context.equipmentEventPolicy.weapon;
      const random = this.combatRandom || Math.random;
      if (eventWeapon && hit.critical && eventWeapon.criticalKillRate > 0 && !enemy.boss && random() <= eventWeapon.criticalKillRate) {
        resolvedDamage += enemy.hp;
      }
      const bonus = eventWeapon && eventWeapon.maxHpLimitedBonusDamage;
      if (bonus && random() < bonus.chance) {
        resolvedDamage += Math.min(
          (Number(context.ownerMaxHp) || 0) * bonus.ownerMaxHpRatioCap,
          adjustedDamage * bonus.attackDamageRatioCap
        );
      }
      if (this.testFastBattle) resolvedDamage *= 12;
      enemy.hp -= resolvedDamage;
      const chargeRepel = context.charge
        ? [context.charge.repelPhysicsUnitsPerSecond, context.charge.repelSeconds] : null;
      this.applyRepel(enemy, context.source, chargeRepel || context.repel);
      if (!context.noEquipmentEvents) this.applyEquipmentHitEffects(enemy, resolvedDamage, context);
      this.updateEnemyHealthBar(enemy);
      this.spawnDamageText(enemy.image.x, enemy.image.y - 145, Math.round(resolvedDamage), hit.dodged ? "#9fd8ff" : hit.critical ? "#ffd54d" : "#ffffff");
      if (enemy.hp > 0) return;
      enemy.image.destroy(true);
      if (enemy.hpBack && !enemy.hpBack.destroyed) enemy.hpBack.destroy(true);
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) this.enemies.splice(index, 1);
      this.killedThisWave += 1;
      this.resolvedThisWave += 1;
      this.kills += 1;
      this.money += Number(enemy.deadCoins) || 0;
      const expBonus = this.buildings.filter((building) => building.definition.class === "exp").reduce((sum, building) => sum + ((building.definition.extra && building.definition.extra.ExpRadio) || 0), 0);
      this.battleExp += Math.round(((this.fightParams.EnemyExp || [10])[enemy.elite ? 1 : 0] || 10) * (1 + expBonus));
      this.grantFightExperience(enemy, expBonus);
      this.refreshHud();
    }

    applyEquipmentBurn(enemy, damage, duration, interval, source) {
      if (!enemy || enemy.hp <= 0 || damage <= 0 || duration <= 0) return;
      if (!Array.isArray(enemy.burns)) enemy.burns = [];
      enemy.burns.push({
        damage, remaining: duration, interval: Math.max(0.05, interval || 1),
        nextTick: Math.max(0.05, interval || 1), source: source || enemy.image
      });
    }

    applyEquipmentHitEffects(enemy, hitDamage, context) {
      if (!enemy || !context || !context.equipmentEventPolicy) return;
      const weapon = context.equipmentEventPolicy.weapon || {};
      const random = this.combatRandom || Math.random;
      const source = context.source || (context.owner && context.owner.image) || enemy.image;
      if (weapon.seriousInjury && random() < weapon.seriousInjury.chance) {
        enemy.seriousInjuryRatio = Math.max(enemy.seriousInjuryRatio || 0, weapon.seriousInjury.extraDamageTakenRatio);
        enemy.seriousInjuryRemaining = Math.max(enemy.seriousInjuryRemaining || 0, weapon.seriousInjury.durationSeconds);
      }
      if (weapon.paralysis && random() < weapon.paralysis.chance) {
        enemy.paralysisRemaining = Math.max(enemy.paralysisRemaining || 0, weapon.paralysis.durationSeconds);
      }
      if (weapon.freeze && random() < weapon.freeze.chance) {
        enemy.freezeRemaining = Math.max(enemy.freezeRemaining || 0, weapon.freeze.durationSeconds);
      }
      if (context.charge && random() < (context.charge.dizzinessChance || 0)) {
        enemy.dizzinessRemaining = Math.max(enemy.dizzinessRemaining || 0, context.charge.dizzinessSeconds || 1);
      }
      const element = context.projectileElementPolicy;
      if (element && random() < element.chance) {
        if (element.element === "ice") {
          enemy.equipmentSlowRatio = Math.max(enemy.equipmentSlowRatio || 0, element.slowRatio || 0);
          enemy.equipmentSlowRemaining = Math.max(enemy.equipmentSlowRemaining || 0, element.durationSeconds || 0);
        } else if (element.element === "fire") {
          this.applyEquipmentBurn(
            enemy, hitDamage * (element.burnDamageRatio || 0), element.durationSeconds || 0,
            element.intervalSeconds || 1, source
          );
        }
      }
      const runtime = context.owner && context.owner.eventRuntime;
      if (weapon.repelChance > 0 && random() < weapon.repelChance) {
        this.applyRepel(enemy, source, [10, 0.3]);
      }
      if (weapon.arrowBarrage && (!runtime || runtime.arrowBarrageCooldown <= 0)) {
        const barrage = weapon.arrowBarrage;
        const point = { x: enemy.image.x, y: enemy.image.y };
        const node = new Laya.Sprite();
        node.pos(point.x, point.y);
        node.zOrder = 620;
        node.graphics.drawCircle(0, 0, barrage.radiusPixels, "#8ecbff", "#e4f6ff", 4);
        this.actorLayer.addChild(node);
        this.effects.push({
          kind: "equipment-arrow-barrage", node, point, source,
          radius: barrage.radiusPixels, damage: hitDamage * barrage.damageRatio,
          applied: false, clock: 0, duration: 0.4
        });
        if (runtime) runtime.arrowBarrageCooldown = barrage.cooldownSeconds;
      }
      if (weapon.speedDownTrap && (!runtime || runtime.trapCooldown <= 0)
        && random() < weapon.speedDownTrap.chance) {
        const trap = weapon.speedDownTrap;
        const node = new Laya.Sprite();
        const point = { x: enemy.image.x, y: enemy.image.y };
        node.pos(point.x, point.y);
        node.zOrder = 20;
        node.graphics.drawCircle(0, 0, trap.radiusPixels, "#66c47a", "#b9ffcb", 4);
        this.actorLayer.addChild(node);
        this.effects.push({
          kind: "equipment-slow-trap", node, point, radius: trap.radiusPixels,
          slowRatio: trap.slowRatio, clock: 0, duration: trap.durationSeconds
        });
        if (runtime) runtime.trapCooldown = 0.1;
      }
      if (weapon.meteorite && (!runtime || runtime.meteoriteCooldown <= 0)) {
        const meteorite = weapon.meteorite;
        const point = { x: enemy.image.x, y: enemy.image.y };
        const node = new Laya.Sprite();
        node.pos(point.x, point.y);
        node.zOrder = 700;
        node.graphics.drawCircle(0, 0, Math.max(12, meteorite.radiusPixels), "#ff742d", "#ffd36a", 5);
        this.actorLayer.addChild(node);
        this.effects.push({
          kind: "equipment-meteorite", node, point, source,
          radius: meteorite.radiusPixels, damage: hitDamage * meteorite.damageRatio,
          burnDamage: hitDamage * meteorite.burnDamageRatio,
          burnDuration: meteorite.burnDurationSeconds,
          applied: false, clock: 0, duration: 0.55
        });
        if (runtime) runtime.meteoriteCooldown = meteorite.cooldownSeconds;
      }
    }

    spawnDamageText(x, y, damage, color) {
      const label = addLabel(this.actorLayer, String(damage), x - 68, y - 36, 136, 74, 58);
      label.color = color || "#ffffff";
      label.stroke = 5;
      label.strokeColor = "#202020";
      label.zOrder = 1000;
      this.damageTexts.push({ label, y: y - 36, clock: 0 });
    }

    updateDamageTexts(delta) {
      for (let index = this.damageTexts.length - 1; index >= 0; index -= 1) {
        const item = this.damageTexts[index];
        item.clock += delta;
        item.label.y = item.y - item.clock * 42;
        item.label.alpha = 1 - Math.min(1, item.clock / 0.85);
        if (item.clock >= 0.85) {
          item.label.destroy(true);
          this.damageTexts.splice(index, 1);
        }
      }
    }

    findNearestEnemy(sourceImage) {
      let result = null;
      let best = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || !enemy.image || enemy.image.destroyed) continue;
        const gap = distance(sourceImage, enemy.image);
        if (gap < best) { best = gap; result = enemy; }
      }
      return result;
    }

    findNearestAlly(sourceImage, maxDistance) {
      let result = null;
      let best = maxDistance;
      for (const ally of this.allies) {
        if (ally.hp <= 0 || !ally.image || ally.image.destroyed) continue;
        const gap = distance(sourceImage, ally.image);
        if (gap < best) { best = gap; result = ally; }
      }
      return result;
    }

    findTarget(building, range) {
      const source = this.buildingCenter(building);
      for (const enemy of this.enemies) {
        if (enemy.hp <= 0 || !enemy.image || enemy.image.destroyed) continue;
        if (distance(source, enemy.image) > range) continue;
        return enemy;
      }
      return null;
    }

    runBuildWeaponTargetingSmoke() {
      const previousEnemies = this.enemies;
      const definition = this.makeBuildingDefinition(this.buildingRowById.e07, 1);
      const building = { definition, column: 3, row: 4 };
      const source = this.buildingCenter(building);
      const makeEnemy = (id, offsetX, hp) => ({
        id, hp: hp === undefined ? 100 : hp,
        image: { x: source.x + offsetX, y: source.y, destroyed: false }
      });
      const firstEntered = makeEnemy("first-entered", 120);
      const laterNearer = makeEnemy("later-nearer", 20);
      const laterFarther = makeEnemy("later-farther", 180);
      const outOfRange = makeEnemy("out-of-range", 240);
      try {
        this.enemies = [firstEntered, laterNearer, laterFarther];
        const insertionOrderTarget = this.findTarget(building, 200);
        this.enemies = [outOfRange, laterNearer, laterFarther];
        const skipsOutsideCollider = this.findTarget(building, 200);
        laterNearer.hp = 0;
        const skipsDeadTarget = this.findTarget(building, 200);
        laterFarther.image.destroyed = true;
        const noEligibleTarget = this.findTarget(building, 200);
        const assertions = {
          firstColliderEntryWins: insertionOrderTarget === firstEntered,
          nearerLaterEntryDoesNotPreempt: insertionOrderTarget !== laterNearer,
          outsideRangeNeverEntersTargetSet: skipsOutsideCollider === laterNearer,
          deadEntryIsIgnored: skipsDeadTarget === laterFarther,
          destroyedEntryIsIgnored: noEligibleTarget === null,
          syntheticProgressFieldNotRequired: !Object.prototype.hasOwnProperty.call(firstEntered, "progress")
            && insertionOrderTarget === firstEntered
        };
        const result = {
          ok: Object.values(assertions).every(Boolean),
          evidence: "generated/game.beautified.js:103966-104122; UnitRoute at 93483-94040 has no cur member, so BuildWeapon route.cur.length defaults to zero and strict < preserves Set insertion order",
          selections: {
            insertionOrder: insertionOrderTarget && insertionOrderTarget.id,
            afterOutOfRange: skipsOutsideCollider && skipsOutsideCollider.id,
            afterDead: skipsDeadTarget && skipsDeadTarget.id,
            afterDestroyed: noEligibleTarget && noEligibleTarget.id
          },
          assertions
        };
        window.__SHOUCHENG_BUILD_WEAPON_TARGETING_SMOKE__ = result;
        document.body.dataset.restoreBuildWeaponTargetingSmoke = JSON.stringify(result);
        console.info("[Shoucheng BuildWeapon targeting smoke]", result);
        return result;
      } finally {
        this.enemies = previousEnemies;
      }
    }

    removeAlly(ally) {
      if (!ally) return;
      if (ally.image && !ally.image.destroyed) ally.image.destroy(true);
      if (ally.hpBack && !ally.hpBack.destroyed) ally.hpBack.destroy(true);
      const index = this.allies.indexOf(ally);
      if (index >= 0) this.allies.splice(index, 1);
    }

    checkWaveComplete() {
      const total = this.waveCounts[this.currentWave - 1];
      this.waveProgressFill.width = 604 * Math.min(1, this.resolvedThisWave / Math.max(1, total));
      if (this.spawnedThisWave < total || this.enemies.length > 0 || this.projectiles.length > 0) return;
      this.fighting = false;
      const mineIncome = this.buildings.filter((building) => building.definition.class === "gold").reduce((sum, building) => sum + ((building.definition.extra && building.definition.extra.Money) || 0), 0);
      this.money += mineIncome + (this.traitEffects.CoinsUp || 0);
      for (const trait of this.activeTraits) if (trait.effectKey === "Interest") this.money += Math.min(30, this.money * trait.value);
      if (this.currentWave >= this.maxWave) {
        this.finishRun(true);
        return;
      }
      this.currentWave += 1;
      this.shopLayer.visible = true;
      this.rollShop(false);
      this.setBattlePresentation(false);
      this.setCombatCountersVisible(false);
      this.speedButton.visible = false;
      this.setAirSupportVisible(false);
      for (const ally of this.allies) this.setActorAction(ally, "idle", { force: true });
      for (const building of this.buildings) {
        if (building.image && !building.image.destroyed) {
          building.image.visible = true;
          building.image.mouseEnabled = true;
        }
      }
      for (const badge of this.treeBadges) badge.visible = true;
      this.refreshHud();
      if (this.autoBattle) Laya.timer.once(this.testStageBattleSweep ? 1 : 240, this, this.startFight);
    }

    finishRun(victory) {
      if (this.finished) return;
      this.finished = true;
      this.fighting = false;
      this.shopLayer.visible = false;
      this.speedButton.visible = false;
      this.setAirSupportVisible(false);
      this.setCombatCountersVisible(false);
      this.setStageNavigationVisible(false);
      for (const ally of this.allies) {
        this.setActorAction(ally, victory ? "victory" : "idle", { force: true, restart: true });
      }
      const shade = addRect(this.overlayLayer, 0, 0, DESIGN_WIDTH, DESIGN_HEIGHT, "#000000", 0.62, "ResultShade");
      shade.mouseEnabled = true;
      const panel = addRect(this.overlayLayer, 105, 400, 540, 390, victory ? "#368f3d" : "#9c3028", 0.98, "ResultPanel");
      panel.mouseEnabled = true;
      addLabel(panel, victory ? "守城成功" : "城堡失守", 40, 30, 460, 80, 52);
      addLabel(panel, victory ? `${this.maxWave} 波敌军已全部击退` : "调整建筑布局后重新挑战", 45, 115, 450, 80, 28);
      addLabel(panel, `关卡 ${this.stageId} · 击退 ${this.kills} · 经验 ${this.battleExp}`, 40, 190, 460, 50, 20);
      const campaign = this.applyCampaignBattleResult(victory);
      const hasNextStage = victory && this.stageId < this.stages.length;
      if (this.metaMode) {
        const retryX = hasNextStage ? 12 : 72;
        this.makeButton(panel, "再战", UI.orangeButton, retryX, 270, 160, 88, () => this.resetRun(), 27);
        this.makeButton(panel, "主界面", UI.blueButton, hasNextStage ? 190 : 308, 270, 160, 88, () => this.returnToMeta(), 27);
        if (hasNextStage) this.makeButton(panel, "下一关", UI.greenButton, 368, 270, 160, 88, () => this.navigateStage(1), 27);
      } else {
        this.makeButton(panel, "重新挑战", UI.orangeButton, hasNextStage ? 25 : 150, 270, hasNextStage ? 220 : 240, 88, () => this.resetRun(), 30);
        if (hasNextStage) {
          this.makeButton(panel, "下一关", UI.greenButton, 295, 270, 220, 88, () => this.navigateStage(1), 30);
        }
      }
      if (campaign.stageAdvanced) {
        addLabel(panel, `已解锁关卡 ${campaign.unlockedStage}`, 40, 235, 460, 34, 18);
      }
      const outcome = {
        victory,
        stage: this.stageId,
        wave: this.currentWave,
        kills: this.kills,
        exp: this.battleExp,
        battleMoney: this.money,
        rewardRadio: 1 + (this.traitEffects.WinRewardUp || 0) + ((this.techEffects && this.techEffects.winRewardAddRatio) || 0),
        maxStageRecord: campaign.after,
        stageAdvanced: campaign.stageAdvanced,
        maxWave: this.maxWave,
        testAdapter: this.stageBattleSweepAdapter || null
      };
      document.body.dataset.restoreResult = JSON.stringify(outcome);
      this.publishState();
    }

    refreshHud() {
      this.waveText.text = `波次 ${this.currentWave}/${this.maxWave}`;
      this.moneyText.text = String(this.money);
      this.killsText.text = String(this.kills);
      const total = this.waveCounts[this.currentWave - 1] || 1;
      this.waveProgressFill.width = this.fighting ? 604 * Math.min(1, this.resolvedThisWave / total) : 0;
      this.refreshCastleHp();
    }

    refreshCastleHp() {
      this.castleHpText.text = `${Math.round(this.castleHp)} / ${this.castleMaxHp}`;
      this.castleHpFill.width = 135 * Math.max(0, this.castleHp / this.castleMaxHp);
    }

    clearCombatObjects() {
      this.airSupportEvents.length = 0;
      this.combatEvents.length = 0;
      for (const list of [this.enemies || [], this.allies || [], this.projectiles || [], this.effects || []]) {
        for (const item of list) {
          const node = item.image || item.node;
          if (node && !node.destroyed) node.destroy(true);
          if (item.hpBack && !item.hpBack.destroyed) item.hpBack.destroy(true);
        }
        list.length = 0;
      }
      for (const item of this.damageTexts || []) if (item.label && !item.label.destroyed) item.label.destroy(true);
      if (this.damageTexts) this.damageTexts.length = 0;
    }

    evaluateEquipmentTraits(traitIds, sameIdBuildingCount) {
      const count = Math.max(0, Math.trunc(Number(sameIdBuildingCount) || 0));
      const result = {
        supportedTraitIds: [],
        unsupportedTraitIds: [],
        building: {
          hpMultiplier: 1,
          attackMultiplier: 1,
          cooldownDivisor: 1,
          rangeMultiplier: 1,
          critAdd: 0,
          critDamageMultiplier: 1
        },
        unit: {
          hpMultiplier: 1,
          attackMultiplier: 1,
          attackSpeedMultiplier: 1,
          speedMultiplier: 1,
          rangeMultiplier: 1,
          critAdd: 0,
          critDamageMultiplier: 1,
          dodgeAdd: 0
        },
        scene: {
          expAdd: 0,
          moveSlowAdd: 0,
          critAuraAdd: 0,
          roundSpeedAdd: 0,
          roundAttackAdd: 0,
          allUnitAttackMultiplier: 1,
          allUnitSpeedMultiplier: 1,
          allUnitAttackSpeedMultiplier: 1,
          allUnitHpMultiplier: 1,
          allDefenseAttackMultiplier: 1,
          allDefenseHpMultiplier: 1,
          allDefenseAttackSpeedMultiplier: 1,
          allDefenseRangeMultiplier: 1,
          allWallHpMultiplier: 1,
          unlockSynthesisLevel: 0
        }
      };
      const multiply = (owner, key, value) => { owner[key] *= 1 + value; };
      const handlers = {
        Hp: (value) => { result.building.hpMultiplier += value; },
        Atk: (value) => multiply(result.building, "attackMultiplier", value),
        AtkSpd: (value) => multiply(result.building, "cooldownDivisor", value),
        AtkRange: (value) => multiply(result.building, "rangeMultiplier", value),
        Crit: (value) => { result.building.critAdd += value; },
        CritDmg: (value) => multiply(result.building, "critDamageMultiplier", value),
        CritWithCnt: (value) => { result.building.critAdd += value * count; },
        AtkWithCnt: (value) => multiply(result.building, "attackMultiplier", value * count),
        AtkSpdWithCnt: (value) => multiply(result.building, "cooldownDivisor", value * count),
        UnitHp: (value) => multiply(result.unit, "hpMultiplier", value),
        UnitAtk: (value) => multiply(result.unit, "attackMultiplier", value),
        UnitAtkSpd: (value) => multiply(result.unit, "attackSpeedMultiplier", value),
        UnitSpeed: (value) => multiply(result.unit, "speedMultiplier", value),
        UnitAtkRange: (value) => multiply(result.unit, "rangeMultiplier", value),
        UnitCrit: (value) => { result.unit.critAdd += value; },
        UnitCritDmg: (value) => multiply(result.unit, "critDamageMultiplier", value),
        UnitDodge: (value) => { result.unit.dodgeAdd += value; },
        ExpAdd: (value) => { result.scene.expAdd += value; },
        SpeedDownUp: (value) => { result.scene.moveSlowAdd += value; },
        CritAdd: (value) => { result.scene.critAuraAdd += value; },
        SpeedUp: (value) => { result.scene.roundSpeedAdd += value; },
        AtkUp: (value) => { result.scene.roundAttackAdd += value; },
        AllUnitAtk: (value) => multiply(result.scene, "allUnitAttackMultiplier", value),
        AllUnitSpeed: (value) => multiply(result.scene, "allUnitSpeedMultiplier", value),
        AllUnitAtkSpd: (value) => multiply(result.scene, "allUnitAttackSpeedMultiplier", value),
        AllUnitHp: (value) => multiply(result.scene, "allUnitHpMultiplier", value),
        AllDefenseAtk: (value) => multiply(result.scene, "allDefenseAttackMultiplier", value),
        AllDefenseHp: (value) => multiply(result.scene, "allDefenseHpMultiplier", value),
        AllDefenseAtkSpd: (value) => multiply(result.scene, "allDefenseAttackSpeedMultiplier", value),
        AllDefenseAtkRange: (value) => multiply(result.scene, "allDefenseRangeMultiplier", value),
        AllWallHp: (value) => multiply(result.scene, "allWallHpMultiplier", value),
        UnlockLv5Sync: (value) => { result.scene.unlockSynthesisLevel = Math.max(result.scene.unlockSynthesisLevel, value); }
      };
      for (const rawId of Array.isArray(traitIds) ? traitIds : []) {
        const id = Number(rawId);
        const trait = this.equipmentTraits[String(id)];
        const handler = trait && handlers[trait.EffectKey];
        const value = trait && Number(trait.EffectParams && trait.EffectParams[0]);
        if (!handler || !Number.isFinite(value)) {
          result.unsupportedTraitIds.push(id);
          continue;
        }
        handler(value);
        result.supportedTraitIds.push(id);
      }
      return result;
    }

    runEquipmentTraitNumericSmoke() {
      const building = this.evaluateEquipmentTraits([49, 56, 60, 68, 70, 72, 76, 89], 3);
      const unit = this.evaluateEquipmentTraits([1, 2, 4, 6, 8, 13, 17, 26], 1);
      const scene = this.evaluateEquipmentTraits([91, 94, 95, 98, 99, 102, 103, 105, 106, 107, 108, 109, 110, 111, 112], 1);
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const assertions = {
        buildingHp: close(building.building.hpMultiplier, 1.3),
        buildingAttack: close(building.building.attackMultiplier, 1.364),
        buildingAttackSpeed: close(building.building.cooldownDivisor, 1.4375),
        buildingCrit: close(building.building.critAdd, 0.26),
        buildingCritDamage: close(building.building.critDamageMultiplier, 1.75),
        unitHp: close(unit.unit.hpMultiplier, 1.1),
        unitAttack: close(unit.unit.attackMultiplier, 1.1),
        unitAttackSpeed: close(unit.unit.attackSpeedMultiplier, 1.25),
        unitSpeed: close(unit.unit.speedMultiplier, 1.1),
        unitRange: close(unit.unit.rangeMultiplier, 1.25),
        unitCrit: close(unit.unit.critAdd, 0.2),
        unitCritDamage: close(unit.unit.critDamageMultiplier, 1.75),
        unitDodge: close(unit.unit.dodgeAdd, 0.05),
        sceneAdditions: close(scene.scene.expAdd, 0.2) && close(scene.scene.moveSlowAdd, 0.2)
          && close(scene.scene.critAuraAdd, 0.2) && close(scene.scene.roundSpeedAdd, 0.2)
          && close(scene.scene.roundAttackAdd, 0.2),
        sceneUnitMultipliers: close(scene.scene.allUnitAttackMultiplier, 1.1)
          && close(scene.scene.allUnitSpeedMultiplier, 1.1)
          && close(scene.scene.allUnitAttackSpeedMultiplier, 1.1)
          && close(scene.scene.allUnitHpMultiplier, 1.1),
        sceneDefenseMultipliers: close(scene.scene.allDefenseAttackMultiplier, 1.1)
          && close(scene.scene.allDefenseHpMultiplier, 1.1)
          && close(scene.scene.allDefenseAttackSpeedMultiplier, 1.1)
          && close(scene.scene.allDefenseRangeMultiplier, 1.1)
          && close(scene.scene.allWallHpMultiplier, 1.3),
        unlockLv5: scene.scene.unlockSynthesisLevel === 5,
        allRequestedSupported: building.unsupportedTraitIds.length === 0
          && unit.unsupportedTraitIds.length === 0 && scene.unsupportedTraitIds.length === 0
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        recoveredNumericEffectKeys: 32,
        recoveredNumericTraitRows: 66,
        sameIdBuildingCount: 3,
        building,
        unit,
        scene,
        assertions
      };
      window.__SHOUCHENG_EQUIPMENT_TRAIT_SMOKE__ = result;
      document.body.dataset.restoreEquipmentTraitSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment trait numeric smoke]", result);
      return result;
    }

    evaluateEquipmentEventTraits(traitIds) {
      const result = {
        supportedTraitIds: [],
        unsupportedTraitIds: [],
        weapon: {
          criticalCounterThreshold: null,
          criticalKillRate: 0,
          scatteringShotCount: 1,
          sequentialExtraShots: 0,
          throughExtraHits: 0,
          jumpExtraTargets: 0,
          projectileLifetimeBaseAdds: 0,
          repelChance: 0,
          arrowBarrage: null,
          arrowBarrageDamageAdd: 0,
          charge: null,
          seriousInjury: null,
          meteorite: null,
          maxHpLimitedBonusDamage: null,
          speedDownTrap: null,
          paralysis: null,
          freeze: null,
          spawnSpeedBuff: null,
          spawnAttackBuff: null,
          arrowElement: null,
          stoneElement: null
        },
        unit: {
          dodgeNextAttackDamageAdd: 0,
          reflectionDamageRatio: 0,
          shieldHpRatio: 0,
          shieldExtraHpRatio: 0,
          shieldExplosion: null
        }
      };
      const handlers = {
        UnitCnter100Crit: (params) => {
          const value = Number(params[0]) || 0;
          result.weapon.criticalCounterThreshold = (result.weapon.criticalCounterThreshold || 0) + value;
        },
        UnitCnterCritCntSub: (params) => {
          const value = Number(params[0]) || 0;
          result.weapon.criticalCounterThreshold = Math.max(0, (result.weapon.criticalCounterThreshold || 0) - value);
        },
        UnitCritKill: (params) => { result.weapon.criticalKillRate += Number(params[0]) || 0; },
        UnitCritKillRateUp: (params) => { result.weapon.criticalKillRate += Number(params[0]) || 0; },
        UnitScattering: (params) => { result.weapon.scatteringShotCount += Math.max(0, (Number(params[0]) || 0) - 1); },
        UnitScatteringCnt: (params) => { result.weapon.scatteringShotCount += Number(params[0]) || 0; },
        UnitArrowBarrage: (params) => {
          const radiusUnits = Number(params[0]) || 0;
          result.weapon.arrowBarrage = {
            radiusUnits,
            radiusPixels: radiusUnits * PHYSICS_PIXEL_RATIO,
            damageRatio: Number(params[1]) || 0,
            cooldownSeconds: Number(params[2]) || 0
          };
        },
        UnitArrowBarrageDmgUp: (params) => { result.weapon.arrowBarrageDamageAdd += Number(params[0]) || 0; },
        UnitDodgeNextAtkDmgUp: (params) => { result.unit.dodgeNextAttackDamageAdd += Number(params[0]) || 0; },
        UnitConShoot: (params) => { result.weapon.sequentialExtraShots += Number(params[0]) || 0; },
        UnitConShootCntUp: (params) => { result.weapon.sequentialExtraShots += Number(params[0]) || 0; },
        UnitThrough: (params) => { result.weapon.throughExtraHits += Number(params[0]) || 0; },
        UnitDamageReflectionByDmg: (params) => { result.unit.reflectionDamageRatio = Number(params[0]) || 0; },
        UnitShield: (params) => { result.unit.shieldHpRatio += Number(params[0]) || 0; },
        UnitShieldExplosion: (params) => {
          const radiusUnits = Number(params[0]) || 0;
          result.unit.shieldExplosion = {
            radiusUnits,
            radiusPixels: radiusUnits * PHYSICS_PIXEL_RATIO,
            damageRatio: Number(params[1]) || 0
          };
        },
        UnitShieldValUp: (params) => { result.unit.shieldExtraHpRatio += Number(params[0]) || 0; },
        ConShoot: (params) => { result.weapon.sequentialExtraShots += Number(params[0]) || 0; },
        RateRepel: (params) => { result.weapon.repelChance += Number(params[0]) || 0; },
        Through: (params) => { result.weapon.throughExtraHits += Number(params[0]) || 0; },
        Jump: (params) => { result.weapon.jumpExtraTargets += Number(params[0]) || 0; },
        LaserTime: (params) => { result.weapon.projectileLifetimeBaseAdds += Number(params[0]) || 0; }
        ,UnitCharge: (params) => {
          result.weapon.charge = {
            damageRatio: Number(params[0]) || 1,
            speedMultiplier: 1.5,
            repelPhysicsUnitsPerSecond: 10,
            repelSeconds: 0.2,
            dizzinessChance: 0,
            dizzinessSeconds: 1
          };
        }
        ,UnitChargeDizziness: (params) => {
          if (!result.weapon.charge) result.weapon.charge = { damageRatio: 1, speedMultiplier: 1.5, repelPhysicsUnitsPerSecond: 10, repelSeconds: 0.2 };
          result.weapon.charge.dizzinessChance = 1;
          result.weapon.charge.dizzinessSeconds = Number(params[0]) || 1;
        }
        ,UnitSeriousInjuryBuff: (params) => {
          result.weapon.seriousInjury = {
            chance: Number(params[0]) || 0,
            extraDamageTakenRatio: Number(params[1]) || 0,
            durationSeconds: Number(params[2]) || 0
          };
        }
        ,UnitMeteorite: (params) => {
          const radiusUnits = Number(params[0]) || 0;
          result.weapon.meteorite = {
            radiusUnits,
            radiusPixels: radiusUnits * PHYSICS_PIXEL_RATIO,
            rangeScale: 1,
            damageRatio: Number(params[1]) || 0,
            cooldownSeconds: Number(params[2]) || 0,
            burnDamageRatio: 0,
            burnDurationSeconds: 0
          };
        }
        ,UnitMeteoriteDmgUp: (params) => {
          if (!result.weapon.meteorite) return;
          result.weapon.meteorite.damageRatio += Number(params[0]) || 0;
        }
        ,UnitMeteoriteRangeUp: (params) => {
          if (!result.weapon.meteorite) return;
          result.weapon.meteorite.rangeScale *= Number(params[0]) || 1;
          result.weapon.meteorite.radiusPixels = result.weapon.meteorite.radiusUnits * PHYSICS_PIXEL_RATIO * result.weapon.meteorite.rangeScale;
        }
        ,UnitMeteoriteBurnArea: (params) => {
          if (!result.weapon.meteorite) return;
          result.weapon.meteorite.burnDamageRatio += Number(params[0]) || 0;
          result.weapon.meteorite.burnDurationSeconds += Number(params[1]) || 0;
        }
        ,AdditionDmgByMaxHpLimitWithAtk: (params) => {
          result.weapon.maxHpLimitedBonusDamage = {
            chance: Number(params[0]) || 0,
            ownerMaxHpRatioCap: Number(params[1]) || 0,
            attackDamageRatioCap: Number(params[2]) || 0,
            formula: "min(ownerMaxHp*ownerMaxHpRatioCap, attackDamage*attackDamageRatioCap)"
          };
        }
        ,RateTrap: (params) => {
          const radiusUnits = Number(params[0]) || 0;
          result.weapon.speedDownTrap = {
            radiusUnits,
            radiusPixels: radiusUnits * PHYSICS_PIXEL_RATIO,
            chance: Number(params[1]) || 0,
            slowRatio: Number(params[2]) || 0,
            durationSeconds: Number(params[3]) || 0,
            extraRangeRatio: 0,
            extraDurationRatio: 0,
            extraChance: 0
          };
        }
        ,TrapTimeRangeUp: (params) => {
          if (!result.weapon.speedDownTrap) return;
          result.weapon.speedDownTrap.extraRangeRatio += Number(params[0]) || 0;
          result.weapon.speedDownTrap.extraDurationRatio += Number(params[1]) || 0;
        }
        ,TrapRateUp: (params) => {
          if (!result.weapon.speedDownTrap) return;
          result.weapon.speedDownTrap.extraChance += Number(params[0]) || 0;
        }
        ,ParalysisBuff: (params) => {
          result.weapon.paralysis = { chance: Number(params[0]) || 0, durationSeconds: Number(params[1]) || 0 };
        }
        ,FreezeBuff: (params) => {
          result.weapon.freeze = { chance: Number(params[0]) || 0, durationSeconds: Number(params[1]) || 0 };
        }
        ,UnitRateSpeedBuff: (params) => {
          result.weapon.spawnSpeedBuff = { chance: Number(params[0]) || 0, speedRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0 };
        }
        ,UnitRateAtkBuff: (params) => {
          result.weapon.spawnAttackBuff = { chance: Number(params[0]) || 0, attackRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0 };
        }
        ,IceArrow: (params) => {
          result.weapon.arrowElement = { element: "ice", chance: Number(params[0]) || 0, slowRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0 };
        }
        ,IceStone: (params) => {
          result.weapon.stoneElement = { element: "ice", chance: Number(params[0]) || 0, slowRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0 };
        }
        ,FireArrow: (params) => {
          result.weapon.arrowElement = { element: "fire", chance: Number(params[0]) || 0, burnDamageRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0, intervalSeconds: Number(params[3]) || 1 };
        }
        ,FireStone: (params) => {
          result.weapon.stoneElement = { element: "fire", chance: Number(params[0]) || 0, burnDamageRatio: Number(params[1]) || 0, durationSeconds: Number(params[2]) || 0, intervalSeconds: Number(params[3]) || 1 };
        }
      };
      for (const rawId of Array.isArray(traitIds) ? traitIds : []) {
        const id = Number(rawId);
        const trait = this.equipmentTraits[String(id)];
        const handler = trait && handlers[trait.EffectKey];
        if (!handler) {
          result.unsupportedTraitIds.push(id);
          continue;
        }
        handler(Array.isArray(trait.EffectParams) ? trait.EffectParams : []);
        result.supportedTraitIds.push(id);
      }
      if (result.weapon.arrowBarrage) {
        result.weapon.arrowBarrage.damageRatio += result.weapon.arrowBarrageDamageAdd;
      }
      if (result.weapon.speedDownTrap) {
        const trap = result.weapon.speedDownTrap;
        trap.radiusPixels = trap.radiusUnits * PHYSICS_PIXEL_RATIO * (1 + trap.extraRangeRatio);
        trap.durationSeconds *= 1 + trap.extraDurationRatio;
        trap.chance += trap.extraChance;
      }
      result.weapon.totalSequentialShots = 1 + result.weapon.sequentialExtraShots;
      result.weapon.totalThroughHits = 1 + result.weapon.throughExtraHits;
      result.weapon.totalJumpTargets = 1 + result.weapon.jumpExtraTargets;
      result.weapon.projectileLifetimeMultiplier = 1 + result.weapon.projectileLifetimeBaseAdds;
      result.unit.totalShieldHpRatio = result.unit.shieldHpRatio + result.unit.shieldExtraHpRatio;
      return result;
    }

    equipmentCounterCritSequence(policy, shotCount) {
      const threshold = policy && policy.weapon ? policy.weapon.criticalCounterThreshold : null;
      const result = [];
      let counter = 0;
      for (let index = 0; index < shotCount; index += 1) {
        counter += 1;
        const critical = threshold !== null && counter > threshold;
        if (critical) counter = 0;
        result.push(critical);
      }
      return result;
    }

    equipmentShieldResolution(policy, currentHp, incomingDamage) {
      const ratio = policy && policy.unit ? policy.unit.totalShieldHpRatio : 0;
      const shield = Math.max(0, currentHp * ratio);
      const absorbed = Math.min(shield, Math.max(0, incomingDamage));
      return {
        shield,
        absorbed,
        remainingShield: shield - absorbed,
        hpAfter: currentHp - Math.max(0, incomingDamage - absorbed)
      };
    }

    runEquipmentTraitEventSmoke() {
      const sword = this.evaluateEquipmentEventTraits([3, 5, 7, 9]);
      const archer = this.evaluateEquipmentEventTraits([12, 14, 16, 18]);
      const crossbow = this.evaluateEquipmentEventTraits([25, 30, 32, 34]);
      const shield = this.evaluateEquipmentEventTraits([48, 50, 52, 54]);
      const tower = this.evaluateEquipmentEventTraits([57, 59, 63]);
      const electricity = this.evaluateEquipmentEventTraits([75, 79, 81]);
      const mirror = this.evaluateEquipmentEventTraits([82, 84, 88, 90]);
      const cavalry = this.evaluateEquipmentEventTraits([21, 23, 27]);
      const mage = this.evaluateEquipmentEventTraits([39, 41, 43, 45]);
      const trebuchet = this.evaluateEquipmentEventTraits([61, 66, 69, 71, 101]);
      const statusTowers = this.evaluateEquipmentEventTraits([77, 86]);
      const spawnBuffs = this.evaluateEquipmentEventTraits([92, 93]);
      const elements = this.evaluateEquipmentEventTraits([96, 97, 100]);
      const shieldResolution = this.equipmentShieldResolution(shield, 100, 90);
      const assertions = {
        swordEverySecondCrit: JSON.stringify(this.equipmentCounterCritSequence(sword, 6)) === JSON.stringify([false, true, false, true, false, true]),
        swordCritKillRate: Math.abs(sword.weapon.criticalKillRate - 0.03) < 0.000001,
        archerFiveWayScatter: archer.weapon.scatteringShotCount === 5,
        arrowBarrage: archer.weapon.arrowBarrage.radiusPixels === 100
          && Math.abs(archer.weapon.arrowBarrage.damageRatio - 0.5) < 0.000001
          && archer.weapon.arrowBarrage.cooldownSeconds === 3,
        crossbowFourSequentialShots: crossbow.weapon.totalSequentialShots === 4,
        crossbowTwoThroughHits: crossbow.weapon.totalThroughHits === 2,
        dodgeNextAttack: Math.abs(crossbow.unit.dodgeNextAttackDamageAdd - 0.25) < 0.000001,
        reflection: Math.abs(shield.unit.reflectionDamageRatio - 0.1) < 0.000001,
        shieldEightyPercent: Math.abs(shield.unit.totalShieldHpRatio - 0.8) < 0.000001
          && shieldResolution.shield === 80 && shieldResolution.absorbed === 80 && shieldResolution.hpAfter === 90,
        shieldExplosion: shield.unit.shieldExplosion.radiusPixels === 100
          && Math.abs(shield.unit.shieldExplosion.damageRatio - 0.25) < 0.000001,
        towerDoubleShotAndThrough: tower.weapon.totalSequentialShots === 2 && tower.weapon.totalThroughHits === 2,
        towerRepelChance: Math.abs(tower.weapon.repelChance - 0.15) < 0.000001,
        electricityFiveTargetsAndDoubleShot: electricity.weapon.totalJumpTargets === 5 && electricity.weapon.totalSequentialShots === 2,
        mirrorFourTargets: mirror.weapon.totalJumpTargets === 4,
        mirrorLifetime: Math.abs(mirror.weapon.projectileLifetimeMultiplier - 1.5) < 0.000001,
        cavalryCharge: cavalry.weapon.charge.damageRatio === 0.3 && cavalry.weapon.charge.speedMultiplier === 1.5
          && cavalry.weapon.charge.repelPhysicsUnitsPerSecond === 10 && cavalry.weapon.charge.repelSeconds === 0.2
          && cavalry.weapon.charge.dizzinessChance === 1 && cavalry.weapon.charge.dizzinessSeconds === 3,
        seriousInjury: cavalry.weapon.seriousInjury.chance === 0.2
          && cavalry.weapon.seriousInjury.extraDamageTakenRatio === 0.1 && cavalry.weapon.seriousInjury.durationSeconds === 2,
        meteorite: mage.weapon.meteorite.radiusPixels === 18.75
          && mage.weapon.meteorite.damageRatio === 0.5 && mage.weapon.meteorite.cooldownSeconds === 3
          && mage.weapon.meteorite.burnDamageRatio === 0.15 && mage.weapon.meteorite.burnDurationSeconds === 3,
        maxHpLimitedDamage: trebuchet.weapon.maxHpLimitedBonusDamage.chance === 0.1
          && trebuchet.weapon.maxHpLimitedBonusDamage.ownerMaxHpRatioCap === 0.01
          && trebuchet.weapon.maxHpLimitedBonusDamage.attackDamageRatioCap === 2,
        speedDownTrap: trebuchet.weapon.speedDownTrap.radiusPixels === 90
          && trebuchet.weapon.speedDownTrap.chance === 1.3 && trebuchet.weapon.speedDownTrap.slowRatio === 0.4
          && trebuchet.weapon.speedDownTrap.durationSeconds === 2.6,
        fireStone: trebuchet.weapon.stoneElement.element === "fire" && trebuchet.weapon.stoneElement.chance === 1
          && trebuchet.weapon.stoneElement.burnDamageRatio === 0.2 && trebuchet.weapon.stoneElement.durationSeconds === 3,
        controlStatuses: statusTowers.weapon.paralysis.chance === 0.2 && statusTowers.weapon.paralysis.durationSeconds === 1
          && statusTowers.weapon.freeze.chance === 0.1 && statusTowers.weapon.freeze.durationSeconds === 2,
        probabilisticSpawnBuffs: spawnBuffs.weapon.spawnSpeedBuff.chance === 0.4
          && spawnBuffs.weapon.spawnSpeedBuff.speedRatio === 0.3 && spawnBuffs.weapon.spawnSpeedBuff.durationSeconds === 1.5
          && spawnBuffs.weapon.spawnAttackBuff.chance === 0.4 && spawnBuffs.weapon.spawnAttackBuff.attackRatio === 0.3,
        iceAndFireElements: elements.weapon.arrowElement.element === "fire" && elements.weapon.arrowElement.chance === 1
          && elements.weapon.stoneElement.element === "ice" && elements.weapon.stoneElement.chance === 0.25
          && elements.weapon.stoneElement.slowRatio === 0.6 && elements.weapon.stoneElement.durationSeconds === 3,
        allRequestedSupported: [sword, archer, crossbow, shield, tower, electricity, mirror, cavalry, mage, trebuchet, statusTowers, spawnBuffs, elements]
          .every((policy) => policy.unsupportedTraitIds.length === 0)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        recoveredEventEffectKeys: 40,
        recoveredEventTraitRows: 45,
        policies: { sword, archer, crossbow, shield, tower, electricity, mirror, cavalry, mage, trebuchet, statusTowers, spawnBuffs, elements },
        shieldResolution,
        assertions
      };
      window.__SHOUCHENG_EQUIPMENT_EVENT_SMOKE__ = result;
      document.body.dataset.restoreEquipmentEventSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment trait event smoke]", result);
      return result;
    }

    runEquipmentRuntimeSmoke() {
      const arrowTower = this.buildingDefinitions.e07;
      const swordDefinition = this.buildingDefinitions.e01;
      const shieldDefinition = this.buildingDefinitions.e06;
      const swordPosition = this.findFirstPlacement(swordDefinition);
      const swordBuilding = swordPosition
        ? this.addBuildingById("e01", swordPosition.column, swordPosition.row, 1) : null;
      const swordAlly = swordBuilding ? this.spawnAlly(swordBuilding) : null;
      const shieldPosition = this.findFirstPlacement(shieldDefinition);
      const shieldBuilding = shieldPosition
        ? this.addBuildingById("e06", shieldPosition.column, shieldPosition.row, 1) : null;
      const shieldAlly = shieldBuilding ? this.spawnAlly(shieldBuilding) : null;
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const assertions = {
        explicitFourBuildingLoadout: Object.keys(this.equipmentLoadout).length === 4,
        originalMissingTraitRejected: this.equipmentLoadoutRejected.some((item) => item.traitId === 104 && item.reason === "original-config-missing"),
        arrowTowerHpApplied: close(arrowTower.hp, 185.9),
        arrowTowerAttackApplied: close(arrowTower.attack, 24.2),
        arrowTowerCooldownApplied: close(arrowTower.cooldown, 2 / (this.fightParams.buildSpeedRadio || 1) / 1.25),
        arrowTowerRangeApplied: close(arrowTower.rangePixels, 690),
        arrowTowerEventsAttached: arrowTower.equipmentEventPolicy.weapon.totalSequentialShots === 2
          && arrowTower.equipmentEventPolicy.weapon.totalThroughHits === 2
          && arrowTower.equipmentEventPolicy.weapon.arrowElement.element === "fire",
        swordSpawnedThroughProductionPath: !!swordAlly && this.allies.includes(swordAlly),
        swordNumericTraitsApplied: swordAlly && close(swordAlly.maxHp, 399.3) && close(swordAlly.attack, 33)
          && close(swordAlly.attackSpeed, 1.5) && close(swordAlly.speed, 75.625),
        swordEventsAttached: swordAlly && swordAlly.equipmentEventPolicy.weapon.criticalCounterThreshold === 1
          && close(swordAlly.equipmentEventPolicy.weapon.criticalKillRate, 0.03),
        shieldSpawnedThroughProductionPath: !!shieldAlly && this.allies.includes(shieldAlly),
        shieldRuntimeValueApplied: shieldAlly && close(shieldAlly.shield, shieldAlly.maxHp * 0.8)
          && close(shieldAlly.equipmentEventPolicy.unit.reflectionDamageRatio, 0.1)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        format: "equipment=e01:1,2,3;e07:55,56,57",
        activation: "explicit only; empty normal entry remains an empty loadout",
        acceptedLoadout: this.equipmentLoadout,
        rejected: this.equipmentLoadoutRejected,
        arrowTower: {
          hp: arrowTower.hp, attack: arrowTower.attack, cooldown: arrowTower.cooldown,
          rangePixels: arrowTower.rangePixels, traitIds: arrowTower.equipmentTraitIds,
          totalShots: arrowTower.equipmentEventPolicy.weapon.totalSequentialShots,
          totalHits: arrowTower.equipmentEventPolicy.weapon.totalThroughHits
        },
        swordAlly: swordAlly ? {
          hp: swordAlly.maxHp, attack: swordAlly.attack, attackSpeed: swordAlly.attackSpeed,
          speed: swordAlly.speed, shield: swordAlly.shield
        } : null,
        shieldAlly: shieldAlly ? { hp: shieldAlly.maxHp, shield: shieldAlly.shield } : null,
        assertions
      };
      if (swordAlly && this.allies.includes(swordAlly)) this.removeAlly(swordAlly);
      if (shieldAlly && this.allies.includes(shieldAlly)) this.removeAlly(shieldAlly);
      if (swordBuilding && this.buildings.includes(swordBuilding)) this.removeBuilding(swordBuilding, true);
      if (shieldBuilding && this.buildings.includes(shieldBuilding)) this.removeBuilding(shieldBuilding, true);
      window.__SHOUCHENG_EQUIPMENT_RUNTIME_SMOKE__ = result;
      document.body.dataset.restoreEquipmentRuntimeSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment runtime smoke]", result);
      return result;
    }

    runEquipmentStatusRuntimeSmoke() {
      const close = (actual, expected, tolerance) => Math.abs(actual - expected) <= (tolerance || 0.000001);
      const previousCombatRandom = this.combatRandom;
      this.combatRandom = () => 0;
      this.startFight();
      this.spawnClock = 999;

      const spawnTestEnemy = (x, y) => {
        this.spawnEnemy(this.enemies.length, this.stageConfig.enemies[0]);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.hp = 10000;
        enemy.maxHp = 10000;
        enemy.dodge = 0;
        enemy.attackSpeed = 1;
        enemy.image.pos(x, y);
        enemy.image.zOrder = y;
        this.updateEnemyHealthBar(enemy);
        return enemy;
      };
      const makeRuntimeOwner = (id) => {
        const definition = this.buildingDefinitions[id];
        const position = this.findFirstPlacement(definition);
        const placed = position ? this.addBuildingById(id, position.column, position.row, 1) : null;
        return placed || {
          id: `status-smoke-${id}`,
          definition,
          maxHp: definition.hp,
          eventRuntime: { meteoriteCooldown: 0, trapCooldown: 0 }
        };
      };
      const makeContext = (owner, element, charge) => ({
        playerAttack: true,
        crit: 0,
        critDamage: 1,
        source: owner.image ? this.buildingCenter(owner) : { x: 300, y: 300 },
        owner,
        ownerMaxHp: owner.maxHp || owner.definition.hp,
        equipmentEventPolicy: owner.definition.equipmentEventPolicy,
        projectileElementPolicy: element || null,
        charge: charge || null
      });

      const cavalryDefinition = this.buildingDefinitions.e03;
      const cavalryPosition = this.findFirstPlacement(cavalryDefinition);
      const cavalryBuilding = cavalryPosition
        ? this.addBuildingById("e03", cavalryPosition.column, cavalryPosition.row, 1) : null;
      const cavalry = cavalryBuilding ? this.spawnAlly(cavalryBuilding) : null;
      if (cavalry) cavalry.crit = 0;
      const cavalryEnemy = cavalry ? spawnTestEnemy(cavalry.image.x + 10, cavalry.image.y) : null;
      const cavalryInitialSpeed = cavalry ? cavalry.speed : 0;
      const cavalryBaseSpeed = cavalry && cavalry.equipmentEventPolicy.weapon.charge
        ? cavalryInitialSpeed / cavalry.equipmentEventPolicy.weapon.charge.speedMultiplier : 0;
      const cavalryHpBefore = cavalryEnemy ? cavalryEnemy.hp : 0;
      if (cavalry) this.updateAllies(0.01);
      const cavalryFirstHit = cavalryEnemy ? cavalryHpBefore - cavalryEnemy.hp : 0;
      const cavalryShotCount = cavalry ? Math.max(
        cavalry.equipmentEventPolicy.weapon.scatteringShotCount || 1,
        cavalry.equipmentEventPolicy.weapon.totalSequentialShots || 1
      ) : 0;
      const cavalryStatusAfterHit = cavalryEnemy ? {
        seriousInjuryRatio: cavalryEnemy.seriousInjuryRatio || 0,
        seriousInjuryRemaining: cavalryEnemy.seriousInjuryRemaining || 0,
        dizzinessRemaining: cavalryEnemy.dizzinessRemaining || 0,
        repelForce: cavalryEnemy.repel ? cavalryEnemy.repel.velocityX || cavalryEnemy.repel.velocityY : 0
      } : {};
      const cavalryHpBeforeFollowup = cavalryEnemy ? cavalryEnemy.hp : 0;
      if (cavalryEnemy) this.damageEnemy(cavalryEnemy, 100, {
        playerAttack: true, crit: 0, critDamage: 1,
        source: cavalry ? cavalry.image : { x: 300, y: 300 }, noEquipmentEvents: true
      });
      const seriousInjuryFollowupDamage = cavalryEnemy ? cavalryHpBeforeFollowup - cavalryEnemy.hp : 0;

      const mage = makeRuntimeOwner("e05");
      const meteorTarget = spawnTestEnemy(410, 410);
      const meteorNeighbor = spawnTestEnemy(420, 410);
      const meteorContext = makeContext(mage, null, null);
      const effectsBeforeMeteor = this.effects.length;
      this.damageEnemy(meteorTarget, 100, meteorContext);
      this.damageEnemy(meteorTarget, 100, meteorContext);
      const meteorEffects = this.effects.slice(effectsBeforeMeteor).filter((effect) => effect.kind === "equipment-meteorite");
      const meteorTargetBeforeEffect = meteorTarget.hp;
      const meteorNeighborBeforeEffect = meteorNeighbor.hp;
      this.updateEffects(0.01);
      const meteorAoeDamage = meteorTargetBeforeEffect - meteorTarget.hp;
      const meteorNeighborAoeDamage = meteorNeighborBeforeEffect - meteorNeighbor.hp;
      const meteorBurnCount = Array.isArray(meteorNeighbor.burns) ? meteorNeighbor.burns.length : 0;
      const meteorNeighborBeforeBurn = meteorNeighbor.hp;
      this.updateEnemyEquipmentStatuses(meteorNeighbor, 1.01);
      const meteorBurnTickDamage = meteorNeighborBeforeBurn - meteorNeighbor.hp;

      const trebuchet = makeRuntimeOwner("e08");
      const trapTarget = spawnTestEnemy(520, 480);
      const trapContext = makeContext(trebuchet, trebuchet.definition.equipmentEventPolicy.weapon.stoneElement, null);
      const effectsBeforeTrap = this.effects.length;
      this.damageEnemy(trapTarget, 100, trapContext);
      const trapEffects = this.effects.slice(effectsBeforeTrap).filter((effect) => effect.kind === "equipment-slow-trap");
      this.updateEffects(0.01);
      const trapState = trapEffects[0] ? {
        radius: trapEffects[0].radius,
        duration: trapEffects[0].duration,
        slowRatio: trapTarget.equipmentSlowRatio || 0,
        slowRemaining: trapTarget.equipmentSlowRemaining || 0
      } : {};
      const stoneBurn = Array.isArray(trapTarget.burns) && trapTarget.burns[0]
        ? { damage: trapTarget.burns[0].damage, duration: trapTarget.burns[0].remaining } : null;

      const paralysisTower = makeRuntimeOwner("e09");
      const paralysisTarget = spawnTestEnemy(600, 500);
      this.damageEnemy(paralysisTarget, 50, makeContext(paralysisTower, null, null));
      const paralysisControlled = this.updateEnemyEquipmentStatuses(paralysisTarget, 0.25);

      const freezeTower = makeRuntimeOwner("e10");
      const freezeTarget = spawnTestEnemy(640, 500);
      this.damageEnemy(freezeTarget, 50, makeContext(freezeTower, null, null));
      const freezeControlled = this.updateEnemyEquipmentStatuses(freezeTarget, 0.25);

      const arrowTower = makeRuntimeOwner("e07");
      const fireTarget = spawnTestEnemy(560, 570);
      const fireHpBeforeHit = fireTarget.hp;
      this.damageEnemy(fireTarget, 100, makeContext(
        arrowTower, arrowTower.definition.equipmentEventPolicy.weapon.arrowElement, null
      ));
      const fireResolvedHitDamage = fireHpBeforeHit - fireTarget.hp;
      const fireBurn = Array.isArray(fireTarget.burns) && fireTarget.burns[0]
        ? { damage: fireTarget.burns[0].damage, duration: fireTarget.burns[0].remaining } : null;
      const fireHpBeforeTick = fireTarget.hp;
      this.updateEnemyEquipmentStatuses(fireTarget, 1.01);
      const fireBurnTickDamage = fireHpBeforeTick - fireTarget.hp;

      const iceOwner = makeRuntimeOwner("e12");
      const iceTarget = spawnTestEnemy(600, 600);
      this.damageEnemy(iceTarget, 100, makeContext(
        iceOwner, iceOwner.definition.equipmentEventPolicy.weapon.arrowElement, null
      ));
      const iceAttackInterval = this.enemyEquipmentAttackInterval(iceTarget);

      const charge = cavalry && cavalry.equipmentEventPolicy.weapon.charge;
      const assertions = {
        explicitRecoveredLoadout: Object.keys(this.equipmentLoadout).sort().join(",") === "e03,e05,e07,e08,e09,e10,e12",
        cavalrySpawnedThroughProductionPath: !!cavalry && this.allies.includes(cavalry),
        cavalryChargeSpeedMultiplier: !!charge && close(cavalryInitialSpeed, cavalryBaseSpeed * 1.5),
        cavalryFirstCollisionConsumesCharge: !!cavalry && !cavalry.charging && close(cavalry.speed, cavalryBaseSpeed),
        cavalryChargeDamageRatio: !!cavalry && close(
          cavalryFirstHit, cavalry.attack * charge.damageRatio * cavalryShotCount
        ),
        cavalryRepelAndDizziness: cavalryStatusAfterHit.repelForce !== 0 && close(cavalryStatusAfterHit.dizzinessRemaining, 3),
        seriousInjuryApplied: close(cavalryStatusAfterHit.seriousInjuryRatio, 0.1)
          && close(cavalryStatusAfterHit.seriousInjuryRemaining, 2),
        seriousInjuryAmplifiesFollowingHit: close(seriousInjuryFollowupDamage, 110),
        meteoriteCooldownSuppressesSecondSpawn: meteorEffects.length === 1 && close(mage.eventRuntime.meteoriteCooldown, 3),
        meteoriteAoeDamage: close(meteorAoeDamage, 50) && close(meteorNeighborAoeDamage, 50),
        meteoriteBurnTicks: meteorBurnCount === 1 && close(meteorBurnTickDamage, 15),
        trapAreaRecovered: trapEffects.length === 1 && close(trapState.radius, 90)
          && close(trapState.duration, 2.6) && close(trapState.slowRatio, 0.4),
        fireStoneBurnRecovered: !!stoneBurn && close(stoneBurn.damage, 20) && close(stoneBurn.duration, 3),
        paralysisUsesSharedControlClock: paralysisControlled && close(paralysisTarget.paralysisRemaining, 0.75),
        freezeUsesSharedControlClock: freezeControlled && close(freezeTarget.freezeRemaining, 1.75),
        fireArrowBurnRecovered: !!fireBurn && close(
          fireBurn.damage, fireResolvedHitDamage * arrowTower.definition.equipmentEventPolicy.weapon.arrowElement.burnDamageRatio
        ) && close(fireBurn.duration, 3) && close(fireBurnTickDamage, fireBurn.damage),
        iceSlowsMoveAndAttack: close(iceTarget.equipmentSlowRatio, 0.6)
          && close(iceTarget.equipmentSlowRemaining, 3) && close(iceAttackInterval, 1.6)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "real building definitions + production ally/damage/effect/status clocks",
        cavalry: {
          initialSpeed: cavalryInitialSpeed, baseSpeed: cavalryBaseSpeed,
          attack: cavalry ? cavalry.attack : null,
          shotCount: cavalryShotCount,
          chargeDamageRatio: charge ? charge.damageRatio : null,
          firstHitDamage: cavalryFirstHit, followupDamage: seriousInjuryFollowupDamage,
          statuses: cavalryStatusAfterHit
        },
        meteorite: {
          spawnedEffects: meteorEffects.length,
          cooldownSeconds: mage.eventRuntime.meteoriteCooldown,
          radiusPixels: meteorEffects[0] ? meteorEffects[0].radius : null,
          targetAoeDamage: meteorAoeDamage,
          neighborAoeDamage: meteorNeighborAoeDamage,
          burnTickDamage: meteorBurnTickDamage
        },
        trap: Object.assign({ spawnedEffects: trapEffects.length, fireStoneBurn: stoneBurn }, trapState),
        controls: {
          paralysisRemaining: paralysisTarget.paralysisRemaining || 0,
          freezeRemaining: freezeTarget.freezeRemaining || 0
        },
        elements: {
          fireResolvedHitDamage, fireArrowBurn: fireBurn, fireBurnTickDamage,
          iceSlowRatio: iceTarget.equipmentSlowRatio || 0, iceAttackInterval
        },
        assertions
      };
      this.combatRandom = previousCombatRandom;
      window.__SHOUCHENG_EQUIPMENT_STATUS_RUNTIME_SMOKE__ = result;
      document.body.dataset.restoreEquipmentStatusRuntimeSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment status runtime smoke]", result);
      return result;
    }

    runEquipmentSecondaryRuntimeSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previousCombatRandom = this.combatRandom;
      this.combatRandom = () => 0;
      this.startFight();
      this.spawnClock = 999;
      const place = (id) => {
        const definition = this.buildingDefinitions[id];
        const position = this.findFirstPlacement(definition);
        return position ? this.addBuildingById(id, position.column, position.row, 1) : null;
      };
      const spawnTestEnemy = (x, y) => {
        this.spawnEnemy(this.enemies.length, this.stageConfig.enemies[0]);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.hp = 10000;
        enemy.maxHp = 10000;
        enemy.dodge = 0;
        enemy.crit = 0;
        enemy.image.pos(x, y);
        enemy.image.zOrder = y;
        this.updateEnemyHealthBar(enemy);
        return enemy;
      };
      const clearTestEnemies = () => {
        for (const enemy of this.enemies.splice(0)) {
          if (enemy.image && !enemy.image.destroyed) enemy.image.destroy(true);
          if (enemy.hpBack && !enemy.hpBack.destroyed) enemy.hpBack.destroy(true);
        }
      };
      const attackContext = (owner) => ({
        playerAttack: true, crit: 0, critDamage: 1,
        source: owner.image || { x: 300, y: 300 },
        owner, ownerMaxHp: owner.maxHp,
        equipmentEventPolicy: owner.equipmentEventPolicy || owner.definition.equipmentEventPolicy
      });

      const archerBuilding = place("e02");
      const archer = archerBuilding ? this.spawnAlly(archerBuilding) : null;
      if (archer) archer.crit = 0;
      const barrageTarget = archer ? spawnTestEnemy(archer.image.x + 80, archer.image.y) : null;
      const barrageNeighbor = barrageTarget ? spawnTestEnemy(barrageTarget.image.x + 50, barrageTarget.image.y) : null;
      if (archer) {
        archer.target = barrageTarget;
        archer.attackCooldown = 0;
        this.updateAllies(0.01);
        this.updateProjectiles(1);
      }
      const barrageDirectDamage = barrageTarget ? 10000 - barrageTarget.hp : 0;
      const barrageEffectsAfterFirst = this.effects.filter((effect) => effect.kind === "equipment-arrow-barrage");
      if (barrageTarget && archer) this.damageEnemy(barrageTarget, archer.attack, attackContext(archer));
      const barrageEffectsAfterSecond = this.effects.filter((effect) => effect.kind === "equipment-arrow-barrage");
      const barrageTargetBeforeEffect = barrageTarget ? barrageTarget.hp : 0;
      const barrageNeighborBeforeEffect = barrageNeighbor ? barrageNeighbor.hp : 0;
      this.updateEffects(0.01);
      const barrageTargetAoeDamage = barrageTarget ? barrageTargetBeforeEffect - barrageTarget.hp : 0;
      const barrageNeighborAoeDamage = barrageNeighbor ? barrageNeighborBeforeEffect - barrageNeighbor.hp : 0;
      const barragePolicy = archer && archer.equipmentEventPolicy.weapon.arrowBarrage;
      if (archerBuilding) this.removeBuilding(archerBuilding, true);
      clearTestEnemies();

      const cavalryBuilding = place("e03");
      const cavalry = cavalryBuilding ? this.spawnAlly(cavalryBuilding) : null;
      if (cavalry) {
        cavalry.crit = 0;
        cavalry.dodge = 1;
      }
      const dodgeEnemy = cavalry ? spawnTestEnemy(cavalry.image.x + 10, cavalry.image.y) : null;
      if (dodgeEnemy) {
        dodgeEnemy.attack = 10;
        dodgeEnemy.crit = 0;
        this.enemyAttack(dodgeEnemy, cavalry, cavalry.image, false);
      }
      const dodgeBonusAfterDodge = cavalry ? cavalry.dodgeNextAttackBonus || 0 : 0;
      const dodgeEnemyBeforeCounter = dodgeEnemy ? dodgeEnemy.hp : 0;
      if (cavalry) {
        cavalry.target = dodgeEnemy;
        cavalry.attackCooldown = 0;
        this.updateAllies(0.01);
      }
      const dodgeCounterDamage = dodgeEnemy ? dodgeEnemyBeforeCounter - dodgeEnemy.hp : 0;
      const dodgeBonusAfterAttack = cavalry ? cavalry.dodgeNextAttackBonus || 0 : 0;
      if (cavalryBuilding) this.removeBuilding(cavalryBuilding, true);
      clearTestEnemies();

      const shieldBuilding = place("e06");
      const shieldAlly = shieldBuilding ? this.spawnAlly(shieldBuilding) : null;
      if (shieldAlly) {
        shieldAlly.dodge = 0;
        shieldAlly.shield = 10;
      }
      const shieldAttacker = shieldAlly ? spawnTestEnemy(shieldAlly.image.x + 10, shieldAlly.image.y) : null;
      const shieldNeighbor = shieldAlly ? spawnTestEnemy(shieldAlly.image.x + 60, shieldAlly.image.y) : null;
      if (shieldAttacker) {
        shieldAttacker.attack = 15;
        shieldAttacker.crit = 0;
      }
      const shieldAllyHpBefore = shieldAlly ? shieldAlly.hp : 0;
      const shieldAttackerHpBefore = shieldAttacker ? shieldAttacker.hp : 0;
      const shieldNeighborHpBefore = shieldNeighbor ? shieldNeighbor.hp : 0;
      if (shieldAttacker) this.enemyAttack(shieldAttacker, shieldAlly, shieldAlly.image, false);
      const shieldExplosionDamage = shieldAlly ? shieldAlly.attack * 0.25 : 0;
      const shieldEffects = this.effects.filter((effect) => effect.kind === "equipment-shield-explosion");
      const shieldAttackerDamage = shieldAttacker ? shieldAttackerHpBefore - shieldAttacker.hp : 0;
      const shieldNeighborDamage = shieldNeighbor ? shieldNeighborHpBefore - shieldNeighbor.hp : 0;
      const shieldOverflowDamage = shieldAlly ? shieldAllyHpBefore - shieldAlly.hp : 0;
      if (shieldBuilding) this.removeBuilding(shieldBuilding, true);
      clearTestEnemies();

      const arrowTower = place("e07");
      const repelTarget = arrowTower ? spawnTestEnemy(this.buildingCenter(arrowTower).x + 20, this.buildingCenter(arrowTower).y) : null;
      if (repelTarget) this.damageEnemy(repelTarget, 20, attackContext(arrowTower));
      const repelState = repelTarget && repelTarget.repel ? {
        velocityX: repelTarget.repel.velocityX,
        velocityY: repelTarget.repel.velocityY,
        duration: repelTarget.repel.duration
      } : null;

      const assertions = {
        explicitRecoveredLoadout: Object.keys(this.equipmentLoadout).sort().join(",") === "e02,e03,e06,e07",
        arrowBarrageProductionProjectile: !!archer && close(barrageDirectDamage, archer.attack),
        arrowBarrageCooldownSuppressesSecondSpawn: barrageEffectsAfterFirst.length === 1
          && barrageEffectsAfterSecond.length === 1 && close(archer.eventRuntime.arrowBarrageCooldown, 3),
        arrowBarrageAoe: !!barragePolicy && close(barragePolicy.radiusPixels, 100)
          && close(barragePolicy.damageRatio, 0.5)
          && close(barrageTargetAoeDamage, archer.attack * 0.5)
          && close(barrageNeighborAoeDamage, archer.attack * 0.5),
        dodgeArmsNextAttackBonus: close(dodgeBonusAfterDodge, 0.25),
        dodgeBonusConsumedByNextAttack: !!cavalry && close(dodgeCounterDamage, cavalry.attack * 1.25)
          && close(dodgeBonusAfterAttack, 0),
        shieldExplosionOnDepletion: !!shieldAlly && close(shieldAlly.shield, 0)
          && close(shieldOverflowDamage, 5) && shieldEffects.length === 1,
        shieldExplosionAoeDamage: close(shieldAttackerDamage, shieldExplosionDamage)
          && close(shieldNeighborDamage, shieldExplosionDamage),
        towerRateRepel: !!repelState && close(Math.sqrt(
          repelState.velocityX * repelState.velocityX + repelState.velocityY * repelState.velocityY
        ), 500)
          && close(repelState.duration, 0.3)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "real placed buildings + spawned units + projectile/enemy-attack/damage/effect clocks",
        arrowBarrage: {
          directDamage: barrageDirectDamage,
          spawnedAfterFirstHit: barrageEffectsAfterFirst.length,
          spawnedAfterSecondHit: barrageEffectsAfterSecond.length,
          cooldownSeconds: archer ? archer.eventRuntime.arrowBarrageCooldown : null,
          radiusPixels: barragePolicy ? barragePolicy.radiusPixels : null,
          damageRatio: barragePolicy ? barragePolicy.damageRatio : null,
          targetAoeDamage: barrageTargetAoeDamage,
          neighborAoeDamage: barrageNeighborAoeDamage
        },
        dodgeNextAttack: {
          armedBonus: dodgeBonusAfterDodge,
          counterDamage: dodgeCounterDamage,
          remainingBonus: dodgeBonusAfterAttack
        },
        shieldExplosion: {
          shieldAfterHit: shieldAlly ? shieldAlly.shield : null,
          hpOverflowDamage: shieldOverflowDamage,
          spawnedEffects: shieldEffects.length,
          expectedAoeDamage: shieldExplosionDamage,
          attackerDamage: shieldAttackerDamage,
          neighborDamage: shieldNeighborDamage
        },
        rateRepel: repelState,
        assertions
      };
      if (arrowTower) this.removeBuilding(arrowTower, true);
      clearTestEnemies();
      this.combatRandom = previousCombatRandom;
      window.__SHOUCHENG_EQUIPMENT_SECONDARY_RUNTIME_SMOKE__ = result;
      document.body.dataset.restoreEquipmentSecondaryRuntimeSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment secondary runtime smoke]", result);
      return result;
    }

    runEquipmentProjectileRuntimeSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previousCombatRandom = this.combatRandom;
      this.combatRandom = () => 0;
      this.startFight();
      this.spawnClock = 999;
      const place = (id) => {
        const definition = this.buildingDefinitions[id];
        const position = this.findFirstPlacement(definition);
        return position ? this.addBuildingById(id, position.column, position.row, 1) : null;
      };
      const spawnTestEnemy = (x, y, hp) => {
        this.spawnEnemy(this.enemies.length, this.stageConfig.enemies[0]);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.hp = hp === undefined ? 10000 : hp;
        enemy.maxHp = enemy.hp;
        enemy.dodge = 0;
        enemy.crit = 0;
        enemy.image.pos(x, y);
        enemy.image.zOrder = y;
        this.updateEnemyHealthBar(enemy);
        return enemy;
      };
      const clearProjectilesAndEnemies = () => {
        for (const projectile of this.projectiles.splice(0)) if (projectile.image && !projectile.image.destroyed) projectile.image.destroy(true);
        for (const enemy of this.enemies.splice(0)) {
          if (enemy.image && !enemy.image.destroyed) enemy.image.destroy(true);
          if (enemy.hpBack && !enemy.hpBack.destroyed) enemy.hpBack.destroy(true);
        }
        this.combatEvents.length = 0;
      };

      const colliderProbeEnemy = spawnTestEnemy(360, 360);
      const colliderProbeBox = this.actorHitBox(colliderProbeEnemy);
      const colliderCenterY = (colliderProbeBox.top + colliderProbeBox.bottom) / 2;
      const colliderEdgeHitTime = this.segmentExpandedBoxHitTime(
        { x: 260, y: colliderCenterY + 49 }, { x: 460, y: colliderCenterY + 49 },
        colliderProbeBox, 19, 10
      );
      const colliderEdgeMissTime = this.segmentExpandedBoxHitTime(
        { x: 260, y: colliderCenterY + 51 }, { x: 460, y: colliderCenterY + 51 },
        colliderProbeBox, 19, 10
      );
      const colliderSecondEnemy = spawnTestEnemy(470, 360);
      const colliderFirstContact = this.findFirstProjectileContact(
        { x: 240, y: colliderCenterY }, { x: 600, y: colliderCenterY }, [], 38, 20
      );
      const colliderFirstTargetId = colliderFirstContact && colliderFirstContact.target.id;
      const colliderExpectedFirstTargetId = colliderProbeEnemy.id;
      clearProjectilesAndEnemies();

      const archerBuilding = place("e02");
      const archer = archerBuilding ? this.spawnAlly(archerBuilding) : null;
      if (archer) archer.crit = 0;
      const scatterAngles = [0, -10, 10, -20, 20];
      const scatterEnemies = archer ? scatterAngles.map((angle) => {
        const radians = angle * Math.PI / 180;
        return spawnTestEnemy(archer.image.x + Math.cos(radians) * 240, archer.image.y + Math.sin(radians) * 240);
      }) : [];
      if (archer) {
        archer.target = scatterEnemies[0];
        archer.attackCooldown = 0;
        this.updateAllies(0.01);
      }
      const scatterProjectiles = this.projectiles.slice();
      const scatterEmittedAngles = scatterProjectiles.map((projectile) => projectile.settings.scatterAngle);
      this.updateProjectiles(1);
      const scatterDamages = scatterEnemies.map((enemy) => 10000 - enemy.hp);
      if (archerBuilding) this.removeBuilding(archerBuilding, true);
      clearProjectilesAndEnemies();

      const crossbowBuilding = place("e04");
      const crossbow = crossbowBuilding ? this.spawnAlly(crossbowBuilding) : null;
      if (crossbow) crossbow.crit = 0;
      const crossbowTarget = crossbow ? spawnTestEnemy(crossbow.image.x + 100, crossbow.image.y) : null;
      const throughTarget = crossbow ? spawnTestEnemy(crossbow.image.x + 190, crossbow.image.y) : null;
      if (crossbow) {
        crossbow.target = crossbowTarget;
        crossbow.attackCooldown = 0;
        this.updateAllies(0.01);
      }
      const burstImmediateCount = this.projectiles.length;
      this.updateCombatEvents(0.099);
      const burstBefore100msCount = this.projectiles.length;
      this.updateCombatEvents(0.002);
      const burstAt100msCount = this.projectiles.length;
      this.updateCombatEvents(0.2);
      const burstFinalCount = this.projectiles.length;
      this.updateProjectiles(1);
      const throughPersistedAfterFirstHit = this.projectiles.length;
      this.updateProjectiles(1);
      const throughPrimaryDamage = crossbowTarget ? 10000 - crossbowTarget.hp : 0;
      const throughSecondaryDamage = throughTarget ? 10000 - throughTarget.hp : 0;
      if (crossbowBuilding) this.removeBuilding(crossbowBuilding, true);
      clearProjectilesAndEnemies();

      const electricity = place("e09");
      const electricityCenter = electricity ? this.buildingCenter(electricity) : { x: 300, y: 300 };
      const jumpEnemies = electricity ? [0, 1, 2, 3, 4].map((index) => spawnTestEnemy(
        electricityCenter.x + 90 + index * 18,
        electricityCenter.y + (index % 2 ? 24 : 0)
      )) : [];
      if (electricity) {
        const policy = electricity.definition.equipmentEventPolicy;
        this.fireEquipmentSalvo(electricityCenter, jumpEnemies[0], electricity.definition.attack, {
          kind: "light", playerAttack: true, crit: 0, critDamage: 1,
          source: electricityCenter, owner: electricity, ownerMaxHp: electricity.maxHp,
          equipmentEventPolicy: policy, attackRange: electricity.definition.rangePixels
        });
      }
      const jumpProjectileCounts = [];
      for (let hit = 0; hit < 5; hit += 1) {
        this.updateProjectiles(1);
        jumpProjectileCounts.push(this.projectiles.length);
      }
      const jumpTotalDamage = jumpEnemies.reduce((sum, enemy) => sum + (10000 - enemy.hp), 0);
      const jumpDamage = electricity ? electricity.definition.attack : 0;
      if (electricity) this.removeBuilding(electricity, true);
      clearProjectilesAndEnemies();

      const shieldBuilding = place("e06");
      const shieldAlly = shieldBuilding ? this.spawnAlly(shieldBuilding) : null;
      if (shieldAlly) shieldAlly.dodge = 0;
      const reflectionEnemy = shieldAlly ? spawnTestEnemy(shieldAlly.image.x + 10, shieldAlly.image.y, 1) : null;
      if (reflectionEnemy) { reflectionEnemy.attack = 20; reflectionEnemy.crit = 0; }
      const killsBeforeReflection = this.kills;
      const resolvedBeforeReflection = this.resolvedThisWave;
      const expBeforeReflection = this.battleExp;
      if (reflectionEnemy) this.enemyAttack(reflectionEnemy, shieldAlly, shieldAlly.image, false);
      const reflectionHpImmediately = reflectionEnemy ? reflectionEnemy.hp : null;
      this.updateCombatEvents(0.01);
      const reflectionStillAliveBeforeFrame = !!reflectionEnemy && this.enemies.includes(reflectionEnemy);
      this.updateCombatEvents(0.01);
      const reflectionResolved = !!reflectionEnemy && !this.enemies.includes(reflectionEnemy);
      const reflectionCounters = {
        kills: this.kills - killsBeforeReflection,
        resolved: this.resolvedThisWave - resolvedBeforeReflection,
        exp: this.battleExp - expBeforeReflection
      };
      if (shieldBuilding) this.removeBuilding(shieldBuilding, true);
      clearProjectilesAndEnemies();

      const assertions = {
        explicitRecoveredLoadout: Object.keys(this.equipmentLoadout).sort().join(",") === "e02,e04,e06,e09,e10",
        recoveredColliderGeometry: UNIT_HITBOX_WIDTH === 50 && UNIT_HITBOX_HEIGHT === 80,
        expandedColliderEdgeInclusive: colliderEdgeHitTime !== null && colliderEdgeMissTime === null,
        sweptColliderChoosesFirstContact: colliderFirstTargetId === colliderExpectedFirstTargetId,
        scatterOriginalAngles: JSON.stringify(scatterEmittedAngles) === JSON.stringify(scatterAngles),
        scatterUsesColliderContacts: !!archer && scatterDamages.length === 5
          && close(scatterDamages.reduce((sum, damage) => sum + damage, 0), archer.attack * 5),
        consecutiveShotTiming: burstImmediateCount === 1 && burstBefore100msCount === 1
          && burstAt100msCount === 2 && burstFinalCount === 4,
        throughPersistsAndHitsNext: !!crossbow && throughPersistedAfterFirstHit === 4
          && close(throughPrimaryDamage, crossbow.attack * 4)
          && close(throughSecondaryDamage, crossbow.attack * 4),
        jumpRetargetsSequentially: !!electricity
          && JSON.stringify(jumpProjectileCounts) === JSON.stringify([1, 1, 1, 1, 0])
          && close(jumpTotalDamage, jumpDamage * 5),
        reflectionDelayedOneFrame: close(reflectionHpImmediately, 1) && reflectionStillAliveBeforeFrame,
        lethalReflectionUsesKillResolution: reflectionResolved && reflectionCounters.kills === 1
          && reflectionCounters.resolved === 1 && reflectionCounters.exp > 0
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "original trait handlers + production projectile/event/enemy-death paths",
        colliderGeometry: {
          unitHitBox: [UNIT_HITBOX_WIDTH, UNIT_HITBOX_HEIGHT],
          projectileSensor: [38, 20],
          edgeHitOffset: 49,
          edgeMissOffset: 51,
          firstTargetId: colliderFirstTargetId,
          expectedFirstTargetId: colliderExpectedFirstTargetId,
          evidence: "generated/game.beautified.js:67973-67985,68676-68682,69626-69632"
        },
        scatter: { emittedAngles: scatterEmittedAngles, damages: scatterDamages },
        consecutiveFire: {
          immediate: burstImmediateCount, before100ms: burstBefore100msCount,
          at100ms: burstAt100msCount, final: burstFinalCount
        },
        through: {
          persistedAfterFirstHit: throughPersistedAfterFirstHit,
          primaryDamage: throughPrimaryDamage, secondaryDamage: throughSecondaryDamage
        },
        jump: { projectileCounts: jumpProjectileCounts, totalDamage: jumpTotalDamage, perHitDamage: jumpDamage },
        reflection: {
          hpImmediately: reflectionHpImmediately,
          aliveBeforeOneFrame: reflectionStillAliveBeforeFrame,
          resolved: reflectionResolved,
          counters: reflectionCounters
        },
        assertions
      };
      this.combatRandom = previousCombatRandom;
      window.__SHOUCHENG_EQUIPMENT_PROJECTILE_RUNTIME_SMOKE__ = result;
      document.body.dataset.restoreEquipmentProjectileRuntimeSmoke = JSON.stringify(result);
      console.info("[Shoucheng equipment projectile runtime smoke]", result);
      return result;
    }

    runAirSupportSmoke() {
      this.installRepresentativeLayout();
      this.startFight();
      this.spawnClock = 999;
      ["js_9F2D53C8", "gb_E916AA75", "js_9F2D53C8"].forEach((unitId, index) => {
        this.spawnEnemy(index, unitId);
        const enemy = this.enemies[this.enemies.length - 1];
        enemy.image.pos(255 + index * 120, 360 + index * 25);
        this.updateEnemyHealthBar(enemy);
      });
      const barracks = this.buildings.find((building) => building.definition.class === "barracks");
      const ally = barracks ? this.spawnAlly(barracks) : null;
      if (ally) ally.hp = ally.maxHp * 0.25;
      const healingUsed = this.useAirSupport("healing");
      const allyFullyHealed = !!ally && Math.abs(ally.hp - ally.maxHp) < 0.000001;
      const freezeUsed = this.useAirSupport("freeze");
      const frozenForFourSeconds = this.enemies.length === 3
        && this.enemies.every((enemy) => enemy.freezeRemaining === 4);
      const meteoriteUsed = this.useAirSupport("meteorite");
      const repeatRejected = this.useAirSupport("meteorite") === false;
      for (let tick = 0; tick < 40; tick += 1) {
        this.updateAirSupports(0.1);
        this.updateProjectiles(0.2);
      }
      const assertions = {
        threeRecoveredButtons: Object.keys(this.airSupportButtons).length === 3,
        originalOrder: AIR_SUPPORT_SKILLS.map((skill) => skill.id).join(",") === "meteorite,healing,freeze",
        dockedToActualStageBottom: Math.abs((this.airSupportLayer.y + this.airSupportLayer.height) - Math.max(DESIGN_HEIGHT, Number(Laya.stage.height) || DESIGN_HEIGHT)) < 0.001,
        healingUsed, allyFullyHealed,
        freezeUsed, frozenForFourSeconds,
        meteoriteUsed, meteoriteSnapshotCount: this.airSupportAudit.meteoriteTargets === 3,
        meteoriteClearedSnapshot: this.enemies.length === 0,
        singleUsePerBattle: repeatRejected && this.airSupportUsed.size === 3
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        originalFallbacks: { meteoriteDamage: 9999, freezeSeconds: 4, healingMaxHpRatio: 1, meteoriteWindowSeconds: 3 },
        audit: this.airSupportAudit,
        state: this.publishAirSupportState(),
        assertions
      };
      window.__SHOUCHENG_AIR_SUPPORT_SMOKE__ = result;
      document.body.dataset.restoreAirSupportSmoke = JSON.stringify(result);
      console.info("[Shoucheng air support smoke]", result);
      return result;
    }

    runWaveTwoDragSmoke() {
      this.installRepresentativeLayout();
      const building = this.buildings.find((entry) => entry.definition && entry.definition.id === "e07") || this.buildings[0];
      const original = building ? { column: building.column, row: building.row, id: building.id } : null;
      this.startFight();
      const combatInputDisabled = !!building && building.image.mouseEnabled === false;
      const total = this.waveCounts[0];
      this.spawnedThisWave = total;
      this.killedThisWave = total;
      this.resolvedThisWave = total;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.checkWaveComplete();
      const waveTwoPreparation = this.currentWave === 2 && !this.fighting && this.shopLayer.visible;
      const buildingInputRestored = !!building && building.image.mouseEnabled === true;
      const shopItemsInputAvailable = this.shopItems
        .filter((item) => item.available && item.definition && item.image.visible)
        .every((item) => item.image.mouseEnabled === true);
      if (building) building.image.event(Laya.Event.MOUSE_DOWN);
      const eventStartsPlacedBuildingDrag = !!this.drag && this.drag.existing === building;
      if (building && original) {
        const dropX = GRID_X + (original.column + building.definition.width / 2) * CELL_STEP;
        const dropY = GRID_Y + (original.row + building.definition.height / 2) * CELL_STEP;
        this.finishDragAt(dropX, dropY);
      }
      const sameCellDropRestoresOccupancy = !!building && !!original
        && !this.drag && building.image.visible
        && building.column === original.column && building.row === original.row
        && this.occupied[original.column][original.row] === original.id;
      const assertions = {
        combatInputDisabled,
        waveTwoPreparation,
        shopLayerPassesEmptyPointerAreas: this.shopLayer.mouseThrough === true,
        hudLayerPassesEmptyPointerAreas: this.hudLayer.mouseThrough === true,
        overlayLayerPassesEmptyPointerAreas: this.overlayLayer.mouseThrough === true,
        buildingInputRestored,
        shopItemsInputAvailable,
        eventStartsPlacedBuildingDrag,
        sameCellDropRestoresOccupancy
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        wave: this.currentWave,
        phase: this.fighting ? "combat" : "preparation",
        assertions
      };
      window.__SHOUCHENG_WAVE_TWO_DRAG_SMOKE__ = result;
      document.body.dataset.restoreWaveTwoDragSmoke = JSON.stringify(result);
      console.info("[Shoucheng wave-two drag smoke]", result);
      this.publishState();
      return result;
    }

    runShopReturnSmoke() {
      this.installRepresentativeLayout();
      this.startFight();
      const total = this.waveCounts[0];
      this.spawnedThisWave = total;
      this.killedThisWave = total;
      this.resolvedThisWave = total;
      this.enemies.length = 0;
      this.projectiles.length = 0;
      this.checkWaveComplete();
      const waveTwoPreparation = this.currentWave === 2 && !this.fighting && this.shopLayer.visible;
      const building = this.buildings.find((entry) => entry.definition.id === "e07") || this.buildings[0];
      const original = building ? {
        id: building.id,
        column: building.column,
        row: building.row,
        buildingCount: this.buildings.length
      } : null;
      if (building) {
        building.hp = building.maxHp * 0.6;
        building.hpFill.width = 76 * building.hp / building.maxHp;
        building.image.event(Laya.Event.MOUSE_DOWN);
      }
      const placedBuildingDragStarted = !!this.drag && this.drag.existing === building;
      this.finishDragAt(DESIGN_WIDTH / 2, 1040);
      const returnedItem = this.shopItems.find((item) => item.available
        && item.definition && building && item.definition.id === building.definition.id
        && item.returnedState);
      const fieldBuildingRemoved = !!building && !this.buildings.includes(building)
        && building.image.destroyed && building.hpBack.destroyed;
      const originalFootprintCleared = !!building && building.definition.cells.every(([offsetX, offsetY]) => (
        this.occupied[original.column + offsetX][original.row + offsetY] === 0
      ));
      const currentHpPreservedOnBench = !!returnedItem
        && Math.abs(returnedItem.returnedState.hp - building.maxHp * 0.6) < 0.001
        && returnedItem.returnedState.maxHp === building.maxHp;
      const returnedItemVisibleAndInteractive = !!returnedItem
        && returnedItem.image.visible && returnedItem.image.mouseEnabled;
      if (returnedItem) this.beginShopDrag(returnedItem.slotIndex);
      const returnedItemDragStarted = !!this.drag && this.drag.shopItem === returnedItem;
      if (building && original) {
        this.finishDragAt(
          GRID_X + (original.column + building.definition.width / 2) * CELL_STEP,
          GRID_Y + (original.row + building.definition.height / 2) * CELL_STEP
        );
      }
      const redeployed = building && original ? this.buildings.find((entry) => (
        entry.definition.id === building.definition.id
        && entry.column === original.column && entry.row === original.row
      )) : null;
      const redeployRestoresFieldAndHp = !!redeployed
        && this.buildings.length === original.buildingCount
        && Math.abs(redeployed.hp - redeployed.maxHp * 0.6) < 0.001
        && Math.abs(redeployed.hpFill.width - 76 * 0.6) < 0.001;
      const returnedSlotConsumedAgain = !!returnedItem
        && !returnedItem.available && !returnedItem.image.visible && returnedItem.returnedState === null;
      const redeployedFootprintOccupied = !!redeployed && redeployed.definition.cells.every(([offsetX, offsetY]) => (
        this.occupied[redeployed.column + offsetX][redeployed.row + offsetY] === redeployed.id
      ));
      const assertions = {
        waveTwoPreparation,
        placedBuildingDragStarted,
        shopBenchRecognized: this.isShopBenchPoint(DESIGN_WIDTH / 2, 1040),
        fieldBuildingRemoved,
        originalFootprintCleared,
        returnedItemVisibleAndInteractive,
        currentHpPreservedOnBench,
        returnedItemDragStarted,
        redeployRestoresFieldAndHp,
        returnedSlotConsumedAgain,
        redeployedFootprintOccupied
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        wave: this.currentWave,
        returnedDefinition: returnedItem && returnedItem.definition ? {
          id: returnedItem.definition.id,
          level: returnedItem.definition.level,
          slotIndex: returnedItem.slotIndex
        } : null,
        assertions
      };
      window.__SHOUCHENG_SHOP_RETURN_SMOKE__ = result;
      document.body.dataset.restoreShopReturnSmoke = JSON.stringify(result);
      console.info("[Shoucheng shop return smoke]", result);
      this.publishState();
      return result;
    }

    runPlacementRuleSmoke() {
      for (const building of [...this.buildings]) this.removeBuilding(building, true);

      const oneCell = (id, level) => this.makeBuildingDefinition(this.buildingRowById[id], level || 1);
      const sourceDefinition = oneCell("e07", 1);
      const targetDefinition = oneCell("e16", 1);
      const sourcePosition = this.findFirstPlacement(sourceDefinition);
      const source = sourcePosition
        ? this.addBuildingById("e07", sourcePosition.column, sourcePosition.row, 1) : null;
      const targetPosition = this.findFirstPlacement(targetDefinition);
      const target = targetPosition
        ? this.addBuildingById("e16", targetPosition.column, targetPosition.row, 1) : null;
      const sourceOriginal = source && { column: source.column, row: source.row };
      const targetOriginal = target && { column: target.column, row: target.row };
      if (source && target) {
        this.beginBuildingDrag(source);
        this.finishDragAt(
          GRID_X + (target.column + target.definition.width / 2) * CELL_STEP,
          GRID_Y + (target.row + target.definition.height / 2) * CELL_STEP
        );
      }
      const occupiedReplacementSwaps = !!source && !!target
        && source.column === targetOriginal.column && source.row === targetOriginal.row
        && target.column === sourceOriginal.column && target.row === sourceOriginal.row
        && this.occupied[source.column][source.row] === source.id
        && this.occupied[target.column][target.row] === target.id;

      for (const building of [...this.buildings]) this.removeBuilding(building, true);
      const returnPosition = this.findFirstPlacement(sourceDefinition);
      const returnedBuilding = returnPosition
        ? this.addBuildingById("e07", returnPosition.column, returnPosition.row, 1) : null;
      if (returnedBuilding) {
        this.beginBuildingDrag(returnedBuilding);
        this.finishDragAt(DESIGN_WIDTH / 2, 250);
      }
      const returnedItem = this.shopItems.find((item) => item.available && item.returnedState
        && item.definition && item.definition.id === "e07");
      const invalidNoFloorDropReturnsToShop = !!returnedItem
        && !this.buildings.includes(returnedBuilding)
        && !this.isShopBenchPoint(DESIGN_WIDTH / 2, 250);

      const synthesisTarget = this.shopItems.find((item) => item !== returnedItem);
      if (synthesisTarget) {
        synthesisTarget.definition = oneCell("e07", 1);
        synthesisTarget.returnedState = null;
        synthesisTarget.available = true;
        synthesisTarget.image.visible = true;
        this.applyDefinitionImage(synthesisTarget.image, synthesisTarget.definition, synthesisTarget.width, synthesisTarget.height - 24, false);
        synthesisTarget.image.pos(
          synthesisTarget.x + (synthesisTarget.width - synthesisTarget.image.width) / 2,
          synthesisTarget.y + synthesisTarget.height - 25 - synthesisTarget.image.height
        );
      }
      if (returnedItem && synthesisTarget) {
        this.beginShopDrag(returnedItem.slotIndex);
        this.finishDragAt(
          synthesisTarget.image.x + synthesisTarget.image.width / 2,
          synthesisTarget.image.y + synthesisTarget.image.height / 2
        );
      }
      const shopAreaSynthesis = !!returnedItem && !!synthesisTarget
        && !returnedItem.available && !returnedItem.image.visible
        && synthesisTarget.available && synthesisTarget.definition.level === 2;

      let partialSlot = null;
      for (let row = 0; row < ROWS && !partialSlot; row += 1) {
        for (let column = 0; column < COLS - 1; column += 1) {
          const values = [this.mapData[row][column], this.mapData[row][column + 1]];
          if (values.filter((value) => value === "1").length !== 1) continue;
          if (values.some((value) => value === "2")) continue;
          partialSlot = { column, row, values };
          break;
        }
      }
      let partialSlotOverlapTrimsExistingFloor = false;
      if (partialSlot) {
        const slotDefinition = {
          id: "slot-partial-overlap-smoke", key: "slot-partial-overlap-smoke", class: "slot",
          level: 0, width: 2, height: 1, cells: [[0, 0], [1, 0]], skin: ""
        };
        const beforeFloorCount = partialSlot.values.filter((value) => value === "1").length;
        const valid = this.canPlace(slotDefinition, partialSlot.column, partialSlot.row);
        const expanded = this.placeSlotExpansion(slotDefinition, partialSlot.column, partialSlot.row);
        const afterFloorCount = [this.mapData[partialSlot.row][partialSlot.column], this.mapData[partialSlot.row][partialSlot.column + 1]]
          .filter((value) => value === "1").length;
        partialSlotOverlapTrimsExistingFloor = valid && expanded === 1 && beforeFloorCount === 1 && afterFloorCount === 2;
      }

      for (const building of [...this.buildings]) this.removeBuilding(building, true);
      const warningRequested = this.requestStartFight();
      const noAttackWarningBeforeFight = warningRequested === false
        && !this.fighting
        && !!this.overlayLayer.getChildByName("NoAttackWarningShade")
        && !!this.overlayLayer.getChildByName("NoAttackWarningPanel");
      this.closeNoAttackWarning();

      const recoveryPosition = this.findFirstPlacement(targetDefinition);
      const recoverable = recoveryPosition
        ? this.addBuildingById("e16", recoveryPosition.column, recoveryPosition.row, 1) : null;
      let normalWaveRestoresBuilding = false;
      let buildNotRecoverRemovesBuilding = false;
      if (recoverable) {
        this.fighting = true;
        recoverable.hp = 0;
        this.destroyBuilding(recoverable);
        const retainedWhileDefeated = this.buildings.includes(recoverable)
          && recoverable.defeated && !recoverable.image.visible;
        this.fighting = false;
        this.castleHp = this.castleMaxHp * 0.5;
        this.recoverPlayerBuildsForWave();
        normalWaveRestoresBuilding = retainedWhileDefeated
          && recoverable.hp === recoverable.maxHp && !recoverable.defeated
          && recoverable.image.visible && this.castleHp === this.castleMaxHp;

        this.fighting = true;
        this.buildNotRecover = true;
        recoverable.hp = 0;
        this.destroyBuilding(recoverable);
        buildNotRecoverRemovesBuilding = !this.buildings.includes(recoverable);
        this.buildNotRecover = false;
        this.fighting = false;
      }

      const assertions = {
        invalidNoFloorDropReturnsToShop,
        shopAreaSynthesis,
        occupiedReplacementSwaps,
        partialSlotOverlapTrimsExistingFloor,
        noAttackWarningBeforeFight,
        normalWaveRestoresBuilding,
        buildNotRecoverRemovesBuilding
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        assertions
      };
      window.__SHOUCHENG_PLACEMENT_RULE_SMOKE__ = result;
      document.body.dataset.restorePlacementRuleSmoke = JSON.stringify(result);
      console.info("[Shoucheng placement rule smoke]", result);
      this.publishState();
      return result;
    }

    runBuildingMechanicsSmoke() {
      const definition = (id, level) => this.makeBuildingDefinition(this.buildingRowById[id], level || 1);
      const synthSourceDefinition = definition("e16", 1);
      const synthTargetPosition = this.findFirstPlacement(synthSourceDefinition);
      const synthTarget = synthTargetPosition ? this.addBuildingById("e16", synthTargetPosition.column, synthTargetPosition.row, 1) : null;
      const synthSourcePosition = synthTarget ? this.findFirstPlacement(synthSourceDefinition) : null;
      const synthSource = synthSourcePosition ? this.addBuildingById("e16", synthSourcePosition.column, synthSourcePosition.row, 1) : null;
      let synthesisRuntimePass = false;
      if (synthTarget && synthSource) {
        this.markOccupied(synthSource, 0);
        synthSource.image.visible = false;
        const foundTarget = this.findMergeTarget(synthSource.definition, synthTarget.column, synthTarget.row, synthSource);
        synthesisRuntimePass = foundTarget === synthTarget && this.mergeBuildingInto(synthTarget, synthSource)
          && synthTarget.definition.level === 2 && !this.buildings.includes(synthSource)
          && this.occupied[synthTarget.column][synthTarget.row] === synthTarget.id;
      }
      if (synthTarget && this.buildings.includes(synthTarget)) this.removeBuilding(synthTarget, true);
      if (synthSource && this.buildings.includes(synthSource)) this.removeBuilding(synthSource, true);

      const target = { definition: definition("e07"), column: 3, row: 3 };
      const attackAura = { definition: definition("e15"), column: 2, row: 3 };
      const speedAura = { definition: definition("e14"), column: 3, row: 2 };
      const critAura = { definition: definition("e13"), column: 0, row: 0 };
      const slowAura = { definition: definition("e12"), column: 6, row: 0 };
      const previousBuildings = this.buildings;
      this.buildings = [target, attackAura, speedAura, critAura, slowAura];
      const buffs = this.buildingBuffs(target);
      const slowMultiplier = this.enemySlowAt({ x: 0, y: 0 });

      const testImage = new Laya.Sprite();
      testImage.pos(420, 420);
      testImage.size(40, 40);
      this.actorLayer.addChild(testImage);
      const laserTarget = { hp: 1000, maxHp: 1000, image: testImage, elite: false, hpBack: null, hpFill: null };
      this.enemies.push(laserTarget);
      const mirror = definition("e10");
      this.laser({ x: 300, y: 500 }, laserTarget, mirror.attack, mirror.extra || {});
      for (let tick = 0; tick < 8; tick += 1) this.updateEffects(0.25);
      const laserDamage = 1000 - laserTarget.hp;
      const laserExpectedDamage = mirror.attack * 8;
      if (!testImage.destroyed) testImage.destroy(true);
      const enemyIndex = this.enemies.indexOf(laserTarget);
      if (enemyIndex >= 0) this.enemies.splice(enemyIndex, 1);
      for (const item of this.damageTexts.splice(0)) if (item.label && !item.label.destroyed) item.label.destroy(true);
      for (const effect of this.effects.splice(0)) if (effect.node && !effect.node.destroyed) effect.node.destroy(true);
      this.buildings = previousBuildings;

      const trebuchet = definition("e08");
      const electricity = definition("e09");
      const barracksLv4 = definition("e01", 4);
      const towerLv4 = definition("e07", 4);
      const wallLv4 = definition("e16", 4);
      const expLv4 = definition("e11", 4);
      const goldLv4 = definition("e18", 4);
      const previousCombatRandom = this.combatRandom;
      this.combatRandom = () => 0.01;
      const dodgeCase = this.rollCombatDamage(10, 1, 2, 0.05);
      const critCase = this.rollCombatDamage(10, 0.05, 2, 0);
      this.combatRandom = previousCombatRandom;
      const previousTraitRandom = this.traitRandom;
      this.traitRandom = seededRandom(4231);
      const generatedTraitChoices = this.traitChoices();
      this.traitRandom = previousTraitRandom;
      const previousAllies = this.allies;
      const aoeImages = [new Laya.Sprite(), new Laya.Sprite(), new Laya.Sprite(), new Laya.Sprite()];
      aoeImages[0].pos(300, 300);
      aoeImages[1].pos(360, 300);
      aoeImages[2].pos(450, 300);
      aoeImages[3].pos(260, 300);
      const aoeAllies = aoeImages.slice(0, 3).map((image, index) => ({ id: 9000 + index, hp: 100, image, unit: {}, dodge: 0, repel: null }));
      this.allies = aoeAllies;
      this.enemyAttack({ attack: 10, crit: 0, critDamage: 1, unit: this.unitById.fs_18B222C3, image: aoeImages[3] }, aoeAllies[0], aoeAllies[0].image, false);
      const unitAoeRuntimePass = aoeAllies[0].hp === 90 && aoeAllies[1].hp === 90 && aoeAllies[2].hp === 100;
      this.allies = previousAllies;
      for (const image of aoeImages) image.destroy(true);
      const previousActiveTraits = this.activeTraits;
      this.activeTraits = [
        { effectKey: "AllUnitAtk", value: 0.05 },
        { effectKey: "AllUnitAtk", value: 0.1 },
        { effectKey: "EnemySpeedDown", value: 0.05 },
        { effectKey: "EnemySpeedDown", value: 0.1 }
      ];
      const stackedAttackMultiplier = this.traitMultiplier("AllUnitAtk");
      const stackedEnemySlowMultiplier = this.traitMultiplier("EnemySpeedDown");
      this.activeTraits = previousActiveTraits;
      const assertions = {
        allBuildingDefinitions: this.buildingRows.length === 19,
        sixBarracks: this.buildingRows.filter((row) => row.class === "barracks").length === 6,
        fourDefenseTowers: this.buildingRows.filter((row) => row.class === "defense").length === 4,
        adjacentAttackBuff: Math.abs(buffs.attackMultiplier - 1.05) < 0.0001,
        adjacentSpeedBuff: Math.abs(buffs.speedMultiplier - 1.05) < 0.0001,
        globalCritBuff: Math.abs(buffs.critAdd - 0.05) < 0.0001,
        globalSlowBuff: Math.abs(slowMultiplier - 1 / 1.05) < 0.0001,
        trebuchetAoeRadius: Math.abs(trebuchet.extra.ThrowAoeRange * PHYSICS_PIXEL_RATIO - 75) < 0.0001,
        trebuchetAoeDamageRatio: trebuchet.extra.ThrowAoeDmgRadio === 0.5,
        electricityJumpCount: electricity.extra.LightJumpCnt === 1,
        mirrorLaserTicks: laserDamage === laserExpectedDamage,
        expGoldAndWalls: definition("e11").extra.ExpRadio === 0.05 && definition("e18").extra.Money === 1 && definition("e16").class === "wall" && definition("e17").class === "wall",
        synthesisRuntime: synthesisRuntimePass,
        synthesisRule: this.canMergeDefinitions(definition("e07", 2), definition("e07", 2))
          && !this.canMergeDefinitions(definition("e07", 2), definition("e08", 2))
          && !this.canMergeDefinitions(definition("e07", 4), definition("e07", 4)),
        barracksSynthesis: Math.abs(barracksLv4.cooldown - 4) < 0.0001 && barracksLv4.extra.SummonUnitMax === 8 && barracksLv4.hp === 520,
        defenseSynthesis: towerLv4.attack === 70 && towerLv4.hp === 130,
        wallSynthesis: wallLv4.hp === 591.5,
        economySynthesis: expLv4.extra.ExpRadio === 0.4 && goldLv4.extra.Money === 8,
        dodgeBeforeCrit: dodgeCase.dodged && dodgeCase.damage === 0 && !dodgeCase.critical,
        criticalDamage: !critCase.dodged && critCase.critical && critCase.damage === 20,
        repelCatalog: this.units.some((unit) => unit.traits && Array.isArray(unit.traits.Repel))
          && this.units.some((unit) => unit.traits && unit.traits.RepelResist),
        unitAoeOriginalRadiusAndDamage: this.unitAoeRadius(this.unitById.fs_18B222C3) === 100 && unitAoeRuntimePass,
        fightLevelTable: this.fightLevels.length === 30 && this.fightLevels[0].exp === 20 && this.fightLevels[29].exp === 860,
        generalTraitTable: this.generalTraits.length === 16 && new Set(this.generalTraits.map((trait) => trait.effectKey)).size === 16,
        equipmentTraitTable: Object.keys(this.equipmentTraits).length === 112 && Object.values(this.equipmentTraits).every((trait) => trait.Id && trait.EffectKey),
        threeWeightedTraitChoices: generatedTraitChoices.length === 3 && generatedTraitChoices.every((trait) => trait.quality >= 1 && trait.quality <= 3),
        multiplicativeTraitStacking: Math.abs(stackedAttackMultiplier - 1.155) < 0.0001 && Math.abs(stackedEnemySlowMultiplier - 1.155) < 0.0001,
        enemyExpFix: Math.floor((this.fightParams.EnemyExp || [10])[0] * this.fightParams.EnemyExpFix) === 8
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        physicsPixelRatio: PHYSICS_PIXEL_RATIO,
        unitSpeedRatio: UNIT_SPEED_RADIO,
        laser: { duration: mirror.extra.LaserTime, interval: mirror.extra.LaserTriggerInterval, hitCount: 8, damage: laserDamage },
        synthesis: {
          maxLevel: MAX_SYNTH_LEVEL,
          barracksLv4: { hp: barracksLv4.hp, cooldown: barracksLv4.cooldown, summonMax: barracksLv4.extra.SummonUnitMax },
          towerLv4: { hp: towerLv4.hp, attack: towerLv4.attack },
          wallLv4: { hp: wallLv4.hp },
          expLv4: expLv4.extra.ExpRadio,
          goldLv4: goldLv4.extra.Money
        },
        traitSelection: {
          thresholds: this.fightLevels.length,
          generalTraitTypes: this.generalTraits.length,
          equipmentTraitRows: Object.keys(this.equipmentTraits).length,
          generated: generatedTraitChoices.map((trait) => [trait.effectKey, trait.quality, trait.value]),
          normalEnemyFixedExp: Math.floor((this.fightParams.EnemyExp || [10])[0] * this.fightParams.EnemyExpFix)
        },
        assertions
      };
      document.body.dataset.restoreBuildingSmoke = JSON.stringify(result);
      console.info("[Shoucheng all-building mechanics smoke]", result);
      return result;
    }

    runCampaignProgressionSmoke() {
      const memory = {};
      const storage = {
        getItem: (key) => Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
        setItem: (key, value) => { memory[key] = String(value); }
      };
      const initial = this.normalizeCampaignProgress(null);
      const partial = this.campaignProgressAfterBattle(initial, 1, 4, 5, false);
      const lowerReplay = this.campaignProgressAfterBattle(partial, 1, 2, 5, false);
      const firstVictory = this.campaignProgressAfterBattle(partial, 1, 5, 5, true);
      const clearedReplay = this.campaignProgressAfterBattle(firstVictory, 1, 5, 5, true);
      const secondPartial = this.campaignProgressAfterBattle(firstVictory, 2, 3, 5, false);
      const secondVictory = this.campaignProgressAfterBattle(secondPartial, 2, 5, 5, true);
      const noSkip = this.campaignProgressAfterBattle(secondVictory, 220, 5, 5, true);
      const finalVictory = this.campaignProgressAfterBattle([220, 0], 220, 5, 5, true);
      const saved = this.saveCampaignProgress([12, 4], storage, true);
      const loaded = this.loadCampaignProgress(storage);
      storage.setItem(this.campaignStorageKey, "not-json");
      storage.setItem(this.profileStorageKey, "not-json");
      const corruptFallback = this.loadCampaignProgress(storage);
      const assertions = {
        freshProfileStartsAtStageOne: initial[0] === 1 && initial[1] === 0,
        defeatRecordsOnlyCompletedWaves: partial[0] === 1 && partial[1] === 3,
        lowerDefeatNeverRegressesProgress: lowerReplay[0] === 1 && lowerReplay[1] === 3,
        frontierVictoryUnlocksExactlyNextStage: firstVictory[0] === 2 && firstVictory[1] === 0,
        clearedStageReplayDoesNotAdvanceFrontier: clearedReplay[0] === 2 && clearedReplay[1] === 0,
        nextStagePartialProgressIsRecorded: secondPartial[0] === 2 && secondPartial[1] === 2,
        nextFrontierVictoryAdvancesAgain: secondVictory[0] === 3 && secondVictory[1] === 0,
        debugJumpCannotSkipUnlockChain: noSkip[0] === 4 && noSkip[1] === 0,
        finalStageKeepsOriginalPastEndRecord: finalVictory[0] === 221 && finalVictory[1] === 0,
        finalStageSelectionClampsToCatalog: this.campaignUnlockedStage(finalVictory) === 220,
        targetScopedLocalRecordRoundTrips: saved[0] === 12 && saved[1] === 4 && loaded[0] === 12 && loaded[1] === 4,
        corruptLocalRecordFallsBackSafely: corruptFallback[0] === 1 && corruptFallback[1] === 0
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        storageKey: this.campaignStorageKey,
        profileStorageKey: this.profileStorageKey,
        records: {
          initial, partial, lowerReplay, firstVictory, clearedReplay,
          secondPartial, secondVictory, noSkip, finalVictory, saved, loaded, corruptFallback
        },
        evidence: "generated/game.beautified.js:22314-22342,25880-25890,56554-56585,125637-125770",
        assertions
      };
      window.__SHOUCHENG_CAMPAIGN_PROGRESSION_SMOKE__ = result;
      document.body.dataset.restoreCampaignProgressionSmoke = JSON.stringify(result);
      console.info("[Shoucheng campaign progression smoke]", result);
      return result;
    }

    runLocalProfileRewardSmoke() {
      const memory = {};
      const storage = {
        getItem: (key) => Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null,
        setItem: (key, value) => { memory[key] = String(value); }
      };
      storage.setItem(this.campaignStorageKey, JSON.stringify([2, 5]));
      const migrated = this.loadLocalProfile(storage);
      const first = this.claimWaveChest(2, 0, storage, true);
      const second = this.claimWaveChest(2, 1, storage, true);
      const duplicate = this.claimWaveChest(2, 1, storage, true);
      const locked = this.claimWaveChest(2, 2, storage, true);
      const beforeFinal = this.loadLocalProfile(storage);
      const advanced = this.normalizeLocalProfile(beforeFinal);
      advanced.maxStageRecord = [3, 0];
      this.saveLocalProfile(advanced, storage, true);
      const final = this.claimWaveChest(2, 2, storage, true);
      const roundTrip = this.loadLocalProfile(storage);
      const stage2Rewards = this.stages[1].chestRewards;
      const assertions = {
        legacyProgressMigrates: migrated.maxStageRecord[0] === 2 && migrated.maxStageRecord[1] === 5,
        freshProfileHasNoInventedAssets: Object.keys(migrated.props).length === 0 && Object.keys(migrated.items).length === 0,
        firstEligibleChestClaims: first.ok && first.profile.props.Money === 200,
        secondEligibleChestClaimsWithOriginalModifier: second.ok && second.profile.props.Money === 600 && second.profile.props.Stamina === 10,
        duplicateClaimRejectedWithoutMutation: !duplicate.ok && duplicate.error === "BoxHasBeenObtained" && duplicate.profile.props.Money === 600,
        declaredWaveTenLockedAtFrontierFive: !locked.ok && locked.error === "WaveNotEnough",
        clearedStageUnlocksFinalDeclaredMilestone: final.ok && final.profile.props.Diamond === 100 && final.profile.items.NormalRandomChip === 18,
        exactClaimFlagsPersist: Object.keys(roundTrip.waveChests).sort().join(",") === "WaveChest_2_0,WaveChest_2_1,WaveChest_2_2",
        targetVersionProfileRoundTrips: roundTrip.maxStageRecord[0] === 3 && roundTrip.maxStageRecord[1] === 0
          && !!storage.getItem(this.profileStorageKey) && !storage.getItem("shoucheng.wx4f4f3709865004a2.v4.LocalProfile"),
        sourceBundlesRemainImmutable: stage2Rewards[1][1][2] === 5 && stage2Rewards[2][1][2] === 18
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        profileStorageKey: this.profileStorageKey,
        legacyStorageKey: this.campaignStorageKey,
        migrated,
        claims: { first, second, duplicate, locked, final },
        roundTrip,
        evidence: "generated/game.beautified.js:22277-22342,22347-22414,24347-24412,26542-26570,125840-126031",
        assertions
      };
      window.__SHOUCHENG_LOCAL_PROFILE_REWARD_SMOKE__ = result;
      document.body.dataset.restoreLocalProfileRewardSmoke = JSON.stringify(result);
      console.info("[Shoucheng local profile/reward smoke]", result);
      return result;
    }

    runCatalogSmoke(showOverlay) {
      const errors = [];
      if (this.stages.length !== 220) errors.push(`stage-count:${this.stages.length}`);
      for (let index = 0; index < this.stages.length; index += 1) {
        const stage = this.stages[index];
        if (stage.id !== index + 1) errors.push(`stage-id:${stage.id}`);
        if (!Array.isArray(stage.mapData) || stage.mapData.length !== 9 || stage.mapData.some((row) => row.length !== 7 || /[^o12]/.test(row))) errors.push(`map:${stage.id}`);
        if (!stage.waveEnemyCountsEffective.length || stage.waveEnemyCountsEffective.length !== stage.wavePower.length) errors.push(`waves:${stage.id}`);
        for (const id of stage.enemies) if (!this.unitById[id]) errors.push(`enemy:${stage.id}:${id}`);
      }
      for (const row of this.buildingRows) {
        if (!parseShape(row.shape).cells.length) errors.push(`shape:${row.id}`);
        if (!this.assetSet.has(`res/buildings/${row.body}1.png`)) errors.push(`building-asset:${row.id}`);
      }
      for (const unit of this.units) {
        if (!unit.bodies || !unit.bodies.length) errors.push(`body:${unit.id}`);
        else if (!this.assetSet.has(`res/units/${unit.bodies[0]}_move_0.png`)) errors.push(`unit-asset:${unit.id}`);
      }
      for (const shape of this.slotShapes) {
        if (!parseShape(shape.shape).cells.length) errors.push(`slot-shape:${shape.id}`);
        if (!Number.isFinite(Number(shape.shopWeight))) errors.push(`slot-weight:${shape.id}`);
      }
      const result = {
        ok: errors.length === 0,
        stageCount: this.stages.length,
        buildingCount: this.buildingRows.length,
        enemyVariantCount: this.content.enemyVariants.length,
        mapThemes: [...new Set(this.stages.map((stage) => stage.mapId))],
        errors
      };
      window.__SHOUCHENG_SMOKE__ = result;
      document.body.dataset.restoreSmoke = JSON.stringify(result);
      console.info("[Shoucheng all-stage smoke]", result);
      if (showOverlay) {
        const panel = addRect(this.overlayLayer, 75, 330, 600, 430, result.ok ? "#246f39" : "#8e2f2a", 0.97, "SmokePanel");
        panel.mouseEnabled = true;
        addLabel(panel, result.ok ? "全关卡清单烟测通过" : "全关卡清单烟测失败", 35, 35, 530, 65, 38);
        addLabel(panel, `关卡 ${result.stageCount} · 建筑 ${result.buildingCount} · 敌人变体 ${result.enemyVariantCount}`, 30, 120, 540, 50, 24);
        addLabel(panel, `主题 ${result.mapThemes.join(" / ")}`, 30, 175, 540, 50, 22);
        addLabel(panel, result.ok ? "固定地图与种子地形、波次、资源引用均有效" : errors.slice(0, 6).join("\n"), 35, 225, 530, 100, 20);
        this.makeButton(panel, "关闭", UI.grayButton, 200, 340, 200, 62, () => panel.destroy(true), 24);
      }
      return result;
    }

    runAllStageRosterAudit() {
      const previous = {
        stageId: this.stageId,
        stageConfig: this.stageConfig,
        waveCounts: this.waveCounts,
        maxWave: this.maxWave,
        outcomeRandom: this.outcomeRandom
      };
      const errors = [];
      const samples = [];
      let totalWaves = 0;
      let totalEnemies = 0;
      let totalElites = 0;
      let totalBosses = 0;
      let rosterChecksum = 2166136261;
      const mixChecksum = (value) => {
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
          rosterChecksum ^= text.charCodeAt(index);
          rosterChecksum = Math.imul(rosterChecksum, 16777619) >>> 0;
        }
      };
      try {
        for (const stage of this.stages) {
          this.stageId = stage.id;
          this.stageConfig = stage;
          this.waveCounts = stage.waveEnemyCountsEffective;
          this.maxWave = this.waveCounts.length;
          this.outcomeRandom = seededRandom(stage.id * 110003 + 17);
          let stageEnemies = 0;
          let stageElites = 0;
          let stageBosses = 0;
          if (!stage.enemies.length) errors.push(`empty-enemy-pool:${stage.id}`);
          if (stage.eliteProbability.length !== this.maxWave) errors.push(`elite-waves:${stage.id}`);
          for (let wave = 1; wave <= this.maxWave && stage.enemies.length; wave += 1) {
            const expectedTotal = this.waveCounts[wave - 1];
            const roster = this.buildWaveRoster(wave);
            const eliteCount = roster.filter((unitId) => unitId.startsWith("jr")).length;
            const bossCount = roster.filter((unitId) => /tl_/.test(unitId)).length;
            const finalBossExpected = wave === this.maxWave && stage.hasFinalBoss && expectedTotal > 0;
            const eliteProbability = stage.eliteProbability[wave - 1] || 0;
            const minimumEliteCount = Math.max(0, Math.floor(eliteProbability) - (finalBossExpected ? 1 : 0));
            const maximumEliteCount = Math.ceil(eliteProbability);
            if (roster.length !== expectedTotal) errors.push(`roster-count:${stage.id}:${wave}:${roster.length}/${expectedTotal}`);
            if (roster.some((unitId) => !this.unitById[unitId])) errors.push(`unknown-roster-unit:${stage.id}:${wave}`);
            if (eliteCount < minimumEliteCount || eliteCount > maximumEliteCount) errors.push(`elite-count:${stage.id}:${wave}:${eliteCount}/${eliteProbability}`);
            if (finalBossExpected ? bossCount !== 1 : bossCount !== 0) errors.push(`boss-count:${stage.id}:${wave}:${bossCount}/${finalBossExpected ? 1 : 0}`);
            totalWaves += 1;
            totalEnemies += roster.length;
            totalElites += eliteCount;
            totalBosses += bossCount;
            stageEnemies += roster.length;
            stageElites += eliteCount;
            stageBosses += bossCount;
            mixChecksum(`${stage.id}:${wave}:${roster.join(",")};`);
          }
          if (stage.id === 1 || stage.id === 2 || stage.id === this.stages.length) {
            samples.push({
              stage: stage.id,
              waves: this.maxWave,
              enemies: stageEnemies,
              elites: stageElites,
              bosses: stageBosses,
              waveCounts: this.waveCounts.slice()
            });
          }
        }
      } finally {
        Object.assign(this, previous);
      }
      const assertions = {
        allStagesRostered: this.stages.length === 220 && totalWaves === this.stages.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.length, 0),
        everyRosterCountExact: !errors.some((error) => error.startsWith("roster-count:")),
        everyRosterUnitKnown: !errors.some((error) => error.startsWith("unknown-roster-unit:") || error.startsWith("empty-enemy-pool:")),
        eliteConversionsBounded: !errors.some((error) => error.startsWith("elite-count:") || error.startsWith("elite-waves:")),
        finalBossConversionsExact: !errors.some((error) => error.startsWith("boss-count:"))
      };
      const result = {
        ok: errors.length === 0 && Object.values(assertions).every(Boolean),
        stageCount: this.stages.length,
        totalWaves,
        totalEnemies,
        totalElites,
        totalBosses,
        rosterChecksum: rosterChecksum.toString(16).padStart(8, "0"),
        samples,
        assertions,
        errors
      };
      window.__SHOUCHENG_ALL_STAGE_ROSTERS__ = result;
      document.body.dataset.restoreAllStageRosters = JSON.stringify(result);
      console.info("[Shoucheng all-stage roster audit]", result);
      return result;
    }

    runAllStageInitializationAudit() {
      const previous = {
        stageId: this.stageId,
        stageConfig: this.stageConfig,
        baseMapData: this.baseMapData,
        mapData: this.mapData,
        waveCounts: this.waveCounts,
        maxWave: this.maxWave,
        castlePosition: this.castlePosition,
        occupied: this.occupied.map((column) => column.slice())
      };
      const errors = [];
      const samples = [];
      const themeCounts = {};
      let totalBuildableCells = 0;
      let totalTreeCells = 0;
      let totalVoidCells = 0;
      let totalBuildingPlacements = 0;
      let immediateBuildingPlacements = 0;
      let expansionAssistedBuildingPlacements = 0;
      let totalSlotPlacements = 0;
      let initializationChecksum = 2166136261;
      const mixChecksum = (value) => {
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
          initializationChecksum ^= text.charCodeAt(index);
          initializationChecksum = Math.imul(initializationChecksum, 16777619) >>> 0;
        }
      };

      try {
        for (const stage of this.stages) {
          this.stageId = stage.id;
          this.stageConfig = stage;
          this.baseMapData = stage.mapData.slice();
          this.mapData = stage.mapData.slice();
          this.waveCounts = stage.waveEnemyCountsEffective;
          this.maxWave = this.waveCounts.length;
          this.castlePosition = this.findCastlePosition();
          this.resetOccupied();

          const flattenedMap = this.mapData.join("");
          const buildableCells = (flattenedMap.match(/1/g) || []).length;
          const treeCells = (flattenedMap.match(/2/g) || []).length;
          const voidCells = (flattenedMap.match(/o/g) || []).length;
          const castleCells = [];
          for (let offsetY = 0; offsetY < 2; offsetY += 1) {
            for (let offsetX = 0; offsetX < 3; offsetX += 1) {
              castleCells.push(this.mapData[this.castlePosition.row + offsetY][this.castlePosition.column + offsetX]);
            }
          }
          const castleValid = castleCells.length === 6 && castleCells.every((cell) => cell === "1");
          if (!castleValid) errors.push(`castle-footprint:${stage.id}:${this.castlePosition.column},${this.castlePosition.row}`);

          const background = `res/maps/Map_${stage.mapId}.png`;
          if (!this.assetSet.has(background)) errors.push(`background:${stage.id}:${background}`);
          const buildingPlacements = [];
          for (const id of SHOP_ORDER) {
            const definition = this.makeBuildingDefinition(this.buildingRowById[id], 1);
            let placement = this.findFirstPlacement(definition);
            let expansion = null;
            if (!placement) {
              const originalMap = this.mapData.slice();
              expansionSearch:
              for (const shape of this.slotShapes) {
                const slotDefinition = this.makeSlotDefinition(shape);
                for (let row = 0; row <= ROWS - slotDefinition.height; row += 1) {
                  for (let column = 0; column <= COLS - slotDefinition.width; column += 1) {
                    this.mapData = originalMap.slice();
                    this.resetOccupied();
                    if (!this.canPlace(slotDefinition, column, row)) continue;
                    for (const [offsetX, offsetY] of slotDefinition.cells) this.setMapCell(column + offsetX, row + offsetY, "1");
                    this.resetOccupied();
                    placement = this.findFirstPlacement(definition);
                    if (placement) {
                      expansion = { shapeId: String(shape.id), column, row };
                      break expansionSearch;
                    }
                  }
                }
              }
              this.mapData = originalMap.slice();
              this.resetOccupied();
            }
            if (!placement) errors.push(`building-placement:${stage.id}:${id}`);
            else {
              totalBuildingPlacements += 1;
              if (expansion) expansionAssistedBuildingPlacements += 1;
              else immediateBuildingPlacements += 1;
              buildingPlacements.push(expansion
                ? `${id}@${placement.column},${placement.row}+slot${expansion.shapeId}@${expansion.column},${expansion.row}`
                : `${id}@${placement.column},${placement.row}`);
            }
          }

          const slotPlacements = [];
          for (const shape of this.slotShapes) {
            const definition = this.makeSlotDefinition(shape);
            const placement = this.findFirstPlacement(definition);
            if (placement) {
              totalSlotPlacements += 1;
              slotPlacements.push(`${shape.id}@${placement.column},${placement.row}`);
            }
          }
          if (!slotPlacements.length) errors.push(`slot-placement:${stage.id}`);
          if (!Array.isArray(stage.storeItemTypeWeight) || stage.storeItemTypeWeight.length !== 3 || stage.storeItemTypeWeight.some((weight) => !Number.isFinite(Number(weight)) || Number(weight) < 0)) {
            errors.push(`store-weights:${stage.id}`);
          }
          if (!this.waveCounts.length || this.waveCounts.length !== stage.wavePower.length || this.waveCounts.length !== stage.eliteProbability.length) {
            errors.push(`wave-init:${stage.id}`);
          }
          if (stage.wavePower.some((power) => !Number.isFinite(Number(power)) || Number(power) <= 0)) errors.push(`wave-power:${stage.id}`);
          if (!stage.enemies.length || stage.enemies.some((id) => !this.unitById[id])) errors.push(`enemy-pool:${stage.id}`);

          themeCounts[stage.mapId] = (themeCounts[stage.mapId] || 0) + 1;
          totalBuildableCells += buildableCells;
          totalTreeCells += treeCells;
          totalVoidCells += voidCells;
          mixChecksum(`${stage.id}:${stage.mapId}:${flattenedMap}:${this.castlePosition.column},${this.castlePosition.row}:${buildingPlacements.join("|")}:${slotPlacements.join("|")};`);
          if (stage.id === 1 || stage.id === 2 || stage.id === 5 || stage.id === 100 || stage.id === this.stages.length) {
            samples.push({
              stage: stage.id,
              mapId: stage.mapId,
              castle: Object.assign({}, this.castlePosition),
              buildableCells,
              treeCells,
              voidCells,
              buildingPlacementCount: buildingPlacements.length,
              slotPlacementCount: slotPlacements.length,
              waves: this.maxWave,
              enemyPool: stage.enemies.slice()
            });
          }
        }
      } finally {
        Object.assign(this, previous);
        for (let column = 0; column < COLS; column += 1) this.occupied[column] = previous.occupied[column].slice();
      }

      const assertions = {
        allStagesInitialized: this.stages.length === 220,
        everyMapHasCastleFootprint: !errors.some((error) => error.startsWith("castle-footprint:")),
        everyMapBackgroundPresent: !errors.some((error) => error.startsWith("background:")),
        everyShopBuildingPlaceable: totalBuildingPlacements === this.stages.length * SHOP_ORDER.length,
        everyMapHasExpansionPlacement: !errors.some((error) => error.startsWith("slot-placement:")),
        everyShopWeightVectorValid: !errors.some((error) => error.startsWith("store-weights:")),
        everyWaveRuntimeVectorValid: !errors.some((error) => error.startsWith("wave-init:") || error.startsWith("wave-power:")),
        everyEnemyPoolResolvable: !errors.some((error) => error.startsWith("enemy-pool:"))
      };
      const result = {
        ok: errors.length === 0 && Object.values(assertions).every(Boolean),
        stageCount: this.stages.length,
        themeCounts,
        totalCells: totalBuildableCells + totalTreeCells + totalVoidCells,
        totalBuildableCells,
        totalTreeCells,
        totalVoidCells,
        buildingDefinitionCount: SHOP_ORDER.length,
        totalBuildingPlacements,
        immediateBuildingPlacements,
        expansionAssistedBuildingPlacements,
        slotShapeCount: this.slotShapes.length,
        totalSlotPlacements,
        initializationChecksum: initializationChecksum.toString(16).padStart(8, "0"),
        samples,
        assertions,
        errors
      };
      window.__SHOUCHENG_ALL_STAGE_INIT__ = result;
      document.body.dataset.restoreAllStageInit = JSON.stringify(result);
      console.info("[Shoucheng all-stage initialization audit]", result);
      return result;
    }

    runAllStageRewardMetadataAudit() {
      const errors = [];
      const rewardKinds = {};
      const rewardIds = {};
      const samples = [];
      let totalBundles = 0;
      let totalEntries = 0;
      let milestoneOutsideBattleWaveCount = 0;
      let checksum = 2166136261;
      const mixChecksum = (value) => {
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
          checksum ^= text.charCodeAt(index);
          checksum = Math.imul(checksum, 16777619) >>> 0;
        }
      };

      for (const stage of this.stages) {
        const milestones = Array.isArray(stage.rewardWave) ? stage.rewardWave : [];
        const bundles = Array.isArray(stage.chestRewards) ? stage.chestRewards : [];
        if (milestones.length !== bundles.length) errors.push(`bundle-count:${stage.id}:${milestones.length}:${bundles.length}`);
        if (!milestones.length) errors.push(`empty-milestones:${stage.id}`);
        if (milestones.some((wave, index) => !Number.isInteger(wave) || wave <= 0
          || wave > stage.declaredWave || (index > 0 && wave <= milestones[index - 1]))) {
          errors.push(`milestone-order:${stage.id}:${milestones.join(",")}`);
        }
        if (milestones.some((wave) => wave > stage.waveEnemyCountsEffective.length)) milestoneOutsideBattleWaveCount += 1;

        bundles.forEach((bundle, bundleIndex) => {
          totalBundles += 1;
          if (!Array.isArray(bundle) || !bundle.length) {
            errors.push(`empty-bundle:${stage.id}:${bundleIndex}`);
            return;
          }
          bundle.forEach((entry, entryIndex) => {
            totalEntries += 1;
            const valid = Array.isArray(entry) && entry.length === 3
              && (entry[0] === "Prop" || entry[0] === "Item")
              && typeof entry[1] === "string" && entry[1].length > 0
              && Number.isFinite(Number(entry[2])) && Number(entry[2]) > 0;
            if (!valid) errors.push(`reward-entry:${stage.id}:${bundleIndex}:${entryIndex}`);
            if (valid) {
              rewardKinds[entry[0]] = (rewardKinds[entry[0]] || 0) + 1;
              rewardIds[entry[1]] = (rewardIds[entry[1]] || 0) + 1;
            }
          });
        });
        mixChecksum(`${stage.id}:${stage.declaredWave}:${JSON.stringify(milestones)}:${JSON.stringify(bundles)};`);
        if ([1, 2, 3, 100, 220].includes(stage.id)) samples.push({
          stage: stage.id,
          battleWaveCount: stage.waveEnemyCountsEffective.length,
          declaredWave: stage.declaredWave,
          rewardWave: milestones.slice(),
          chestRewards: bundles.map((bundle) => bundle.map((entry) => entry.slice()))
        });
      }

      const stage2 = this.stages[1];
      const assertions = {
        allStagesPresent: this.stages.length === 220,
        everyMilestoneHasBundle: !errors.some((error) => error.startsWith("bundle-count:") || error.startsWith("empty-milestones:")),
        milestoneVectorsValid: !errors.some((error) => error.startsWith("milestone-order:")),
        everyBundleNonEmpty: !errors.some((error) => error.startsWith("empty-bundle:")),
        everyRewardEntryTyped: !errors.some((error) => error.startsWith("reward-entry:")),
        metaMilestonesNotBattleWaves: !!stage2 && stage2.waveEnemyCountsEffective.length === 5
          && stage2.declaredWave === 10 && stage2.rewardWave.join(",") === "3,5,10"
          && milestoneOutsideBattleWaveCount > 0
      };
      const result = {
        ok: errors.length === 0 && Object.values(assertions).every(Boolean),
        stageCount: this.stages.length,
        totalBundles,
        totalEntries,
        rewardKinds,
        rewardIds,
        milestoneOutsideBattleWaveCount,
        checksum: checksum.toString(16).padStart(8, "0"),
        samples,
        assertions,
        errors
      };
      window.__SHOUCHENG_ALL_STAGE_REWARDS__ = result;
      document.body.dataset.restoreAllStageRewards = JSON.stringify(result);
      console.info("[Shoucheng all-stage reward metadata audit]", result);
      return result;
    }

    runWaveTimingSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const countRatio = Number(this.fightParams.waveGCntRadios) || 1;
      const lowerBound = 0.1 / countRatio;
      const upperBound = 0.2 / countRatio;
      const minimumSchedule = this.buildWaveSpawnDelays(1, () => 0, this.waveCounts[0], this.maxWave);
      const maximumSchedule = this.buildWaveSpawnDelays(1, () => 0.999999, this.waveCounts[0], this.maxWave);
      const errors = [];
      const samples = [];
      let totalEntries = 0;
      let totalSeconds = 0;
      let minimumDelay = Infinity;
      let maximumDelay = 0;
      let checksum = 2166136261;
      const mixChecksum = (value) => {
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
          checksum ^= text.charCodeAt(index);
          checksum = Math.imul(checksum, 16777619) >>> 0;
        }
      };

      for (const stage of this.stages) {
        for (let waveIndex = 0; waveIndex < stage.waveEnemyCountsEffective.length; waveIndex += 1) {
          const expectedCount = stage.waveEnemyCountsEffective[waveIndex];
          const random = seededRandom(stage.id * 100003 + waveIndex * 4099 + 51);
          const delays = this.buildWaveSpawnDelays(
            waveIndex + 1, random, expectedCount, stage.waveEnemyCountsEffective.length
          );
          if (delays.length !== expectedCount) errors.push(`delay-count:${stage.id}:${waveIndex + 1}:${delays.length}:${expectedCount}`);
          if (delays.some((delay) => delay < lowerBound - 0.000001 || delay > upperBound + 0.000001)) {
            errors.push(`delay-range:${stage.id}:${waveIndex + 1}`);
          }
          const duration = delays.reduce((sum, delay) => sum + delay, 0);
          totalEntries += delays.length;
          totalSeconds += duration;
          minimumDelay = Math.min(minimumDelay, ...delays);
          maximumDelay = Math.max(maximumDelay, ...delays);
          mixChecksum(`${stage.id}:${waveIndex + 1}:${delays.map((delay) => Math.round(delay * 1000000)).join(",")};`);
          if ((stage.id === 1 || stage.id === 2 || stage.id === 220) && waveIndex === 0) {
            samples.push({
              stage: stage.id,
              wave: 1,
              count: delays.length,
              delays: delays.map((delay) => Number(delay.toFixed(6))),
              cumulativeSeconds: Number(duration.toFixed(6))
            });
          }
        }
      }

      this.resetRun();
      this.startFight();
      const productionSchedule = this.waveSpawnDelays.slice();
      const initialClock = this.spawnClock;
      this.updateSpawning(initialClock * 0.5);
      const beforeFirstSpawn = this.spawnedThisWave;
      this.updateSpawning(initialClock * 0.5 + 0.000001);
      const afterFirstSpawn = this.spawnedThisWave;
      const nextClock = this.spawnClock;
      this.resetRun();

      const assertions = {
        defaultsRecoveredFromAbsentOverrides: this.fightParams.FirstEnemyDelayTime === undefined
          && this.fightParams.TroopInterval === undefined
          && this.fightParams.TroopCountChance === undefined
          && this.fightParams.TroopSpeedUp === undefined,
        lowerEndpointExact: minimumSchedule.every((delay) => close(delay, lowerBound)),
        upperEndpointExact: maximumSchedule.every((delay) => close(delay, upperBound)),
        allStageWaveCountsExact: totalEntries === 60588 && !errors.some((error) => error.startsWith("delay-count:")),
        allDelaysInRecoveredRange: !errors.some((error) => error.startsWith("delay-range:")),
        productionInitialClockExact: close(initialClock, productionSchedule[0]),
        productionWaitsForFirstDelay: beforeFirstSpawn === 0,
        productionSpawnsAtFirstDelay: afterFirstSpawn === 1 && nextClock > 0,
        finalCleanupExact: !this.fighting && this.enemies.length === 0 && this.waveSpawnDelays.length === 0
      };
      const result = {
        ok: errors.length === 0 && Object.values(assertions).every(Boolean),
        stageCount: this.stages.length,
        totalWaveCount: this.stages.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.length, 0),
        totalEntries,
        lowerBoundSeconds: lowerBound,
        upperBoundSeconds: upperBound,
        observedMinimumSeconds: minimumDelay,
        observedMaximumSeconds: maximumDelay,
        totalScheduledSeconds: Number(totalSeconds.toFixed(6)),
        checksum: checksum.toString(16).padStart(8, "0"),
        production: {
          schedule: productionSchedule.map((delay) => Number(delay.toFixed(6))),
          initialClock: Number(initialClock.toFixed(6)),
          beforeFirstSpawn,
          afterFirstSpawn,
          nextClock: Number(nextClock.toFixed(6))
        },
        samples,
        assertions,
        errors
      };
      window.__SHOUCHENG_WAVE_TIMING_SMOKE__ = result;
      document.body.dataset.restoreWaveTimingSmoke = JSON.stringify(result);
      console.info("[Shoucheng wave timing smoke]", result);
      return result;
    }

    runEnemySpawnPositionSmoke() {
      const minimum = this.buildEnemySpawnPosition(() => 0);
      const maximum = this.buildEnemySpawnPosition(() => 0.999999);
      const errors = [];
      const samples = [];
      let totalEntries = 0;
      let observedMinX = Infinity;
      let observedMaxX = -Infinity;
      let observedMinY = Infinity;
      let observedMaxY = -Infinity;
      let checksum = 2166136261;
      const mixChecksum = (value) => {
        const text = String(value);
        for (let index = 0; index < text.length; index += 1) {
          checksum ^= text.charCodeAt(index);
          checksum = Math.imul(checksum, 16777619) >>> 0;
        }
      };

      for (const stage of this.stages) {
        let stageEntries = 0;
        const firstPositions = [];
        for (let waveIndex = 0; waveIndex < stage.waveEnemyCountsEffective.length; waveIndex += 1) {
          const count = stage.waveEnemyCountsEffective[waveIndex];
          const random = seededRandom(stage.id * 100003 + waveIndex * 4099 + 83);
          for (let index = 0; index < count; index += 1) {
            const position = this.buildEnemySpawnPosition(random);
            if (!Number.isInteger(position.x) || position.x < 10 || position.x > 750) {
              errors.push(`spawn-x:${stage.id}:${waveIndex + 1}:${index}:${position.x}`);
            }
            if (!Number.isInteger(position.y) || position.y < 50 || position.y > 80) {
              errors.push(`spawn-y:${stage.id}:${waveIndex + 1}:${index}:${position.y}`);
            }
            observedMinX = Math.min(observedMinX, position.x);
            observedMaxX = Math.max(observedMaxX, position.x);
            observedMinY = Math.min(observedMinY, position.y);
            observedMaxY = Math.max(observedMaxY, position.y);
            if (waveIndex === 0 && firstPositions.length < 5) firstPositions.push([position.x, position.y]);
            mixChecksum(`${stage.id}:${waveIndex + 1}:${index}:${position.x},${position.y};`);
            stageEntries += 1;
            totalEntries += 1;
          }
        }
        if (stage.id === 1 || stage.id === 2 || stage.id === 220) {
          samples.push({ stage: stage.id, entries: stageEntries, firstWavePositions: firstPositions });
        }
      }

      const sequence = [0, 0.999999];
      let sequenceIndex = 0;
      this.spawnPositionRandom = () => sequence[sequenceIndex++ % sequence.length];
      this.waveCoinRoster = [0];
      this.spawnEnemy(0, this.stageConfig.enemies[0]);
      const probe = this.enemies[this.enemies.length - 1];
      const production = probe ? {
        imagePosition: [probe.image.x, probe.image.y],
        recordedPosition: [probe.spawnPosition.x, probe.spawnPosition.y]
      } : null;
      this.clearCombatObjects();
      this.spawnPositionRandom = seededRandom(this.stageId * 19001 + 83);

      const assertions = {
        recoveredDesignWidthEndpoints: minimum.x === 10 && maximum.x === 750,
        recoveredTopBandEndpoints: minimum.y === 50 && maximum.y === 80,
        allStageEntryCountExact: totalEntries === 60588,
        allPositionsIntegerAndInRange: errors.length === 0,
        bothAxesReachRecoveredEndpoints: observedMinX === 10 && observedMaxX === 750
          && observedMinY === 50 && observedMaxY === 80,
        productionSpawnUsesRecoveredPosition: !!production
          && production.imagePosition[0] === 10 && production.imagePosition[1] === 80
          && production.recordedPosition[0] === 10 && production.recordedPosition[1] === 80,
        productionCleanupExact: this.enemies.length === 0
      };
      const result = {
        ok: errors.length === 0 && Object.values(assertions).every(Boolean),
        stageCount: this.stages.length,
        totalWaveCount: this.stages.reduce((sum, stage) => sum + stage.waveEnemyCountsEffective.length, 0),
        totalEntries,
        recoveredBounds: { x: [10, 750], y: [50, 80] },
        observedBounds: { x: [observedMinX, observedMaxX], y: [observedMinY, observedMaxY] },
        checksum: checksum.toString(16).padStart(8, "0"),
        production,
        samples,
        assertions,
        errors
      };
      window.__SHOUCHENG_SPAWN_POSITION_SMOKE__ = result;
      document.body.dataset.restoreSpawnPositionSmoke = JSON.stringify(result);
      console.info("[Shoucheng enemy spawn position smoke]", result);
      return result;
    }

    runDefeatRetrySmoke() {
      const originalMap = this.baseMapData.slice();
      const definition = this.makeBuildingDefinition(this.buildingRowById.e07, 1);
      const initialPlacement = this.findFirstPlacement(definition);
      if (initialPlacement) this.addBuildingById("e07", initialPlacement.column, initialPlacement.row, 1);
      this.startFight();
      this.toggleSpeed();
      this.togglePause();
      this.money = 47;
      this.battleExp = 88;
      this.fightLevel = 3;
      this.fightLevelExp = 9;
      this.kills = 4;
      this.activeTraits.push({ effectKey: "AllUnitAtk", quality: 2, value: 0.1 });
      this.airSupportUsed.add("freeze");
      this.scheduleCombatEvent(5, "retry-cleanup-probe", () => {});
      this.spawnEnemy(0, this.stageConfig.enemies[0]);
      const attacker = this.enemies[this.enemies.length - 1];
      if (attacker) {
        attacker.attack = this.castleMaxHp + 100;
        attacker.crit = 0;
        attacker.critDamage = 1;
        this.enemyAttack(attacker, null, { x: this.castleCenter.x, y: this.castleCenter.y - 55 }, true);
      }

      const defeatResult = JSON.parse(document.body.dataset.restoreResult || "null");
      const defeatState = {
        finished: this.finished,
        fighting: this.fighting,
        paused: this.paused,
        castleHp: this.castleHp,
        result: defeatResult,
        resultShade: !!this.overlayLayer.getChildByName("ResultShade"),
        resultPanel: !!this.overlayLayer.getChildByName("ResultPanel"),
        shopHidden: !this.shopLayer.visible,
        airSupportHidden: Object.values(this.airSupportButtons).every((button) => !button.visible),
        enemyCount: this.enemies.length,
        combatEventCount: this.combatEvents.length,
        speed: this.speed,
        speedLabel: this.speedButton.getChildAt(0).text,
        pauseAlpha: this.pauseButton.alpha
      };

      this.resetRun();
      const resetState = {
        resultCleared: !document.body.dataset.restoreResult,
        finished: this.finished,
        fighting: this.fighting,
        paused: this.paused,
        castleHp: this.castleHp,
        castleMaxHp: this.castleMaxHp,
        currentWave: this.currentWave,
        money: this.money,
        battleExp: this.battleExp,
        fightLevel: this.fightLevel,
        fightLevelExp: this.fightLevelExp,
        kills: this.kills,
        activeTraitCount: this.activeTraits.length,
        airSupportUsed: [...this.airSupportUsed],
        buildingCount: this.buildings.length,
        enemyCount: this.enemies.length,
        allyCount: this.allies.length,
        projectileCount: this.projectiles.length,
        effectCount: this.effects.length,
        combatEventCount: this.combatEvents.length,
        overlayCount: this.overlayLayer.numChildren,
        shopVisible: this.shopLayer.visible,
        shopSlotCount: this.shopItems.length,
        firstFreeRefresh: this.firstFreeRefresh,
        adRefreshUsed: this.adRefreshUsed,
        speed: this.speed,
        speedLabel: this.speedButton.getChildAt(0).text,
        pauseAlpha: this.pauseButton.alpha,
        mapRestored: this.mapData.join("|") === originalMap.join("|"),
        positiveOccupiedCells: this.occupied.reduce((sum, column) => sum + column.filter((value) => value > 0).length, 0)
      };

      const retryPlacement = this.findFirstPlacement(definition);
      if (retryPlacement) this.addBuildingById("e07", retryPlacement.column, retryPlacement.row, 1);
      this.startFight();
      const retryState = {
        placementFound: !!retryPlacement,
        fighting: this.fighting,
        finished: this.finished,
        paused: this.paused,
        currentWave: this.currentWave,
        rosterCount: this.waveRoster ? this.waveRoster.length : 0,
        expectedRosterCount: this.waveCounts[0],
        buildingCount: this.buildings.length,
        shopHidden: !this.shopLayer.visible,
        battlePresentation: this.stageContentOffset === SHOP_SCENE_SHIFT
      };
      this.resetRun();
      const finalClean = !this.fighting
        && !this.finished
        && this.castleHp === this.castleMaxHp
        && this.buildings.length === 0
        && this.enemies.length === 0
        && this.overlayLayer.numChildren === 0
        && this.shopLayer.visible;

      const assertions = {
        initialPlacementFound: !!initialPlacement,
        defeatReachedThroughCastleAttack: defeatState.finished && !defeatState.fighting && defeatState.castleHp === 0,
        defeatResultExact: !!defeatResult && !defeatResult.victory && defeatResult.stage === this.stageId && defeatResult.wave === 1 && defeatResult.kills === 4 && defeatResult.exp === 88,
        defeatPresentationVisible: defeatState.resultShade && defeatState.resultPanel && defeatState.shopHidden && defeatState.airSupportHidden,
        resetCoreStateExact: resetState.resultCleared && !resetState.finished && !resetState.fighting && !resetState.paused
          && resetState.castleHp === resetState.castleMaxHp && resetState.currentWave === 1
          && resetState.money === 0 && resetState.battleExp === 0 && resetState.fightLevel === 0
          && resetState.fightLevelExp === 0 && resetState.kills === 0 && resetState.activeTraitCount === 0,
        resetClearsRuntimeObjects: resetState.buildingCount === 0 && resetState.enemyCount === 0 && resetState.allyCount === 0
          && resetState.projectileCount === 0 && resetState.effectCount === 0 && resetState.combatEventCount === 0
          && resetState.overlayCount === 0 && resetState.positiveOccupiedCells === 0,
        resetRestoresPreparationUi: resetState.shopVisible && resetState.shopSlotCount === 3 && resetState.firstFreeRefresh
          && !resetState.adRefreshUsed && resetState.speed === 1 && resetState.speedLabel === "×1"
          && resetState.pauseAlpha === 1 && resetState.mapRestored && resetState.airSupportUsed.length === 0,
        retryStartsProductionWave: retryState.placementFound && retryState.fighting && !retryState.finished && !retryState.paused
          && retryState.currentWave === 1 && retryState.rosterCount === retryState.expectedRosterCount
          && retryState.buildingCount === 1 && retryState.shopHidden && retryState.battlePresentation,
        finalCleanupExact: finalClean
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        defeatState,
        resetState,
        retryState,
        finalClean,
        assertions
      };
      window.__SHOUCHENG_DEFEAT_RETRY_SMOKE__ = result;
      document.body.dataset.restoreDefeatRetrySmoke = JSON.stringify(result);
      console.info("[Shoucheng defeat/retry smoke]", result);
      return result;
    }

    runEconomyRewardSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const makeTrait = (effectKey, quality) => {
        const row = this.generalTraits.find((trait) => trait.effectKey === effectKey);
        const index = row ? row.qualities.indexOf(quality) : -1;
        return row && index >= 0 ? {
          id: row.id,
          effectKey: row.effectKey,
          quality,
          value: row.params[index],
          stackType: row.stackType,
          stackLimit: row.stackLimit
        } : null;
      };

      this.resetRun();
      const mineDefinition = this.makeBuildingDefinition(this.buildingRowById.e18, 1);
      const minePlacement = this.findFirstPlacement(mineDefinition);
      if (minePlacement) this.addBuildingById("e18", minePlacement.column, minePlacement.row, 1);
      const coinsUpTrait = makeTrait("CoinsUp", 2);
      const interestTrait = makeTrait("Interest", 2);
      this.applyGeneralTrait(coinsUpTrait);
      this.applyGeneralTrait(interestTrait);
      this.fightLevel = this.fightLevels.length;
      this.startFight();

      const total = this.waveCounts[0];
      const expectedCoinPool = this.fightParams.CoinsPerWave || 10;
      const allocation = this.waveCoinRoster.slice();
      const enemyRewards = [];
      const moneyAfterKills = [];
      this.spawnedThisWave = total;
      for (let index = 0; index < total; index += 1) {
        this.spawnEnemy(index, this.waveRoster[index]);
        const enemy = this.enemies[this.enemies.length - 1];
        enemyRewards.push(enemy.deadCoins);
        this.damageEnemy(enemy, enemy.maxHp + 1, { fixedDamage: true, noEquipmentEvents: true });
        moneyAfterKills.push(this.money);
      }

      const moneyBeforeWaveEnd = this.money;
      const mineIncome = this.buildings
        .filter((building) => building.definition.class === "gold")
        .reduce((sum, building) => sum + ((building.definition.extra && building.definition.extra.Money) || 0), 0);
      const coinsUp = coinsUpTrait ? coinsUpTrait.value : 0;
      const interestRate = interestTrait ? interestTrait.value : 0;
      const expectedBeforeInterest = expectedCoinPool + mineIncome + coinsUp;
      const expectedInterest = Math.min(30, expectedBeforeInterest * interestRate);
      const expectedAfterWave = expectedBeforeInterest + expectedInterest;
      this.checkWaveComplete();
      const waveEnd = {
        money: this.money,
        expectedMoney: expectedAfterWave,
        mineIncome,
        coinsUp,
        interestRate,
        interest: expectedInterest,
        currentWave: this.currentWave,
        fighting: this.fighting,
        shopVisible: this.shopLayer.visible
      };

      this.resetRun();
      const winRewardTrait = makeTrait("WinRewardUp", 3);
      this.applyGeneralTrait(winRewardTrait);
      this.money = 37;
      this.kills = 2;
      this.battleExp = 11;
      this.finishRun(true);
      const victoryOutcome = JSON.parse(document.body.dataset.restoreResult || "null");

      this.resetRun();
      this.applyGeneralTrait(winRewardTrait);
      this.money = 12;
      this.finishRun(false);
      const defeatOutcome = JSON.parse(document.body.dataset.restoreResult || "null");
      this.resetRun();

      const expectedRewardRadio = 1 + (winRewardTrait ? winRewardTrait.value : 0);
      const assertions = {
        evidenceCoinPoolExact: expectedCoinPool === 10,
        allocationCountExact: allocation.length === total && enemyRewards.length === total,
        allocationSumExact: allocation.reduce((sum, value) => sum + value, 0) === expectedCoinPool,
        spawnCarriesAllocation: enemyRewards.every((value, index) => value === allocation[index]),
        killTimeCoinAccrualExact: moneyBeforeWaveEnd === expectedCoinPool
          && moneyAfterKills.every((value, index) => value === allocation.slice(0, index + 1).reduce((sum, item) => sum + item, 0)),
        waveEndEconomyExact: close(waveEnd.money, expectedAfterWave),
        waveLifecycleContinues: waveEnd.currentWave === 2 && !waveEnd.fighting && waveEnd.shopVisible,
        victoryOutcomeExact: !!victoryOutcome && victoryOutcome.victory && victoryOutcome.battleMoney === 37
          && close(victoryOutcome.rewardRadio, expectedRewardRadio),
        defeatOutcomeExact: !!defeatOutcome && !defeatOutcome.victory && defeatOutcome.battleMoney === 12
          && close(defeatOutcome.rewardRadio, expectedRewardRadio),
        finalCleanupExact: !this.fighting && !this.finished && this.money === 0
          && this.activeTraits.length === 0 && this.waveCoinRoster.length === 0
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        waveEnemyCount: total,
        allocation,
        enemyRewards,
        moneyAfterKills,
        moneyBeforeWaveEnd,
        waveEnd,
        victoryOutcome,
        defeatOutcome,
        assertions
      };
      window.__SHOUCHENG_ECONOMY_REWARD_SMOKE__ = result;
      document.body.dataset.restoreEconomyRewardSmoke = JSON.stringify(result);
      console.info("[Shoucheng economy/reward smoke]", result);
      return result;
    }

    runUnitRouteTargetingSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previousRouteRandomSource = this.routeRandomSource;
      const previousBuildings = this.buildings;
      const previousAllies = this.allies;
      const previousEnemies = this.enemies;
      const routeWidth = 3 * CELL_STEP - CELL_GAP;
      const probeBuilding = {
        id: "route-target-probe",
        hp: 100,
        column: 2,
        row: 4,
        definition: { width: 3, height: 2 },
        image: { destroyed: false }
      };
      const anchor = this.buildingRouteAnchor(probeBuilding);
      const probeEnemy = {
        image: { x: anchor.x - routeWidth, y: anchor.y - 20, destroyed: false },
        range: 50,
        aliveMs: 100,
        routeRandom: null,
        routeTarget: null,
        routeTargetKey: null,
        routeForceColliders: new Map(),
        routeColliderScale: 1,
        boss: true,
        hp: 100
      };
      const left = this.clampRouteTargetPoint(probeEnemy, anchor, routeWidth);
      probeEnemy.image.x = anchor.x;
      const inside = this.clampRouteTargetPoint(probeEnemy, anchor, routeWidth);
      probeEnemy.image.x = anchor.x + routeWidth;
      const right = this.clampRouteTargetPoint(probeEnemy, anchor, routeWidth);

      this.buildings = [probeBuilding];
      this.allies = [];
      this.enemies = [probeEnemy];
      probeEnemy.image.x = anchor.x - routeWidth;
      const selected = this.enemyRouteTarget(probeEnemy);

      const drawsNear = [0.25, 0.75, 0.9];
      let drawIndexNear = 0;
      this.routeRandomSource = () => drawsNear[drawIndexNear++];
      probeEnemy.image.x = 300;
      probeEnemy.image.y = 300;
      probeEnemy.routeRandom = null;
      const nearForward = this.enemyRouteForward(probeEnemy, { x: 300, y: 400 });
      const nearRoute = Object.assign({}, probeEnemy.routeRandom);

      const drawsFar = [0, 0.5, 0.9];
      let drawIndexFar = 0;
      this.routeRandomSource = () => drawsFar[drawIndexFar++];
      probeEnemy.routeRandom = null;
      const farForward = this.enemyRouteForward(probeEnemy, { x: 300, y: 500 });
      const farRoute = Object.assign({}, probeEnemy.routeRandom);
      const expectedFarAngle = Math.PI / 2 - 0.2;

      this.routeRandomSource = previousRouteRandomSource;
      this.buildings = previousBuildings;
      this.allies = previousAllies;
      this.enemies = previousEnemies;

      const expectedAnchor = {
        x: GRID_X + probeBuilding.column * CELL_STEP + routeWidth / 2,
        y: GRID_Y + probeBuilding.row * CELL_STEP + (this.stageContentOffset || 0)
      };
      const assertions = {
        recoveredBuildProxyWidth: routeWidth === 282,
        buildAnchorIsTopCenter: close(anchor.x, expectedAnchor.x) && close(anchor.y, expectedAnchor.y),
        targetXClampsToBuildEdges: close(left.x, anchor.x - routeWidth / 2)
          && close(inside.x, anchor.x) && close(right.x, anchor.x + routeWidth / 2),
        productionSelectionUsesClampedPoint: selected && selected.kind === "building"
          && close(selected.point.x, anchor.x - routeWidth / 2) && close(selected.point.y, anchor.y),
        nearRangeSuppressesRandomAngle: close(nearRoute.attenuation, 0)
          && close(nearForward.x, 0) && close(nearForward.y, 1),
        randomLifetimeDrawComesFirst: drawIndexNear === 3 && close(nearRoute.untilMs, 1825),
        farRangeAttenuatesRandomAngle: close(farRoute.attenuation, 0.5)
          && close(farRoute.angle, expectedFarAngle),
        farForwardUsesAttenuatedHeading: close(farForward.x, Math.cos(expectedFarAngle))
          && close(farForward.y, Math.sin(expectedFarAngle))
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "PlayerSpawnBuild battle proxy + UnitRoute.getForwardWithTarget/calcRandRnd production adapter",
        buildingTarget: { routeWidth, anchor, left, inside, right, selectedPoint: selected && selected.point },
        randomHeading: {
          near: { distance: 100, range: 50, route: nearRoute, forward: nearForward, draws: drawsNear },
          far: { distance: 200, range: 50, route: farRoute, forward: farForward, draws: drawsFar }
        },
        evidence: "generated/game.beautified.js:93596-93631,93773-93791,95526-95639",
        assertions
      };
      window.__SHOUCHENG_UNIT_ROUTE_TARGETING_SMOKE__ = result;
      document.body.dataset.restoreUnitRouteTargetingSmoke = JSON.stringify(result);
      console.info("[Shoucheng UnitRoute targeting smoke]", result);
      return result;
    }

    runUnitRouteTargetCacheSmoke() {
      const previousBuildings = this.buildings;
      const previousAllies = this.allies;
      const previousCastleHp = this.castleHp;
      const allyA = { id: "cache-a", hp: 100, image: { x: 340, y: 300, destroyed: false } };
      const allyB = { id: "cache-b", hp: 100, image: { x: 500, y: 300, destroyed: false } };
      const building = {
        id: "cache-building", hp: 100, column: 2, row: 4,
        definition: { width: 2, height: 2 }, image: { destroyed: false }
      };
      const enemy = {
        image: { x: 300, y: 300, destroyed: false },
        routeTarget: null, routeTargetKey: null, routeRandom: null
      };

      this.allies = [allyA, allyB];
      this.buildings = [building];
      this.castleHp = 1000;
      const initial = this.enemyRouteTarget(enemy);
      const initialKey = initial && initial.key;

      allyB.image.x = 301;
      const cachedAfterCloserArrival = this.enemyRouteTarget(enemy);

      allyA.image.x = 365;
      allyA.image.y = 325;
      const refreshed = this.enemyRouteTarget(enemy);

      enemy.routeRandom = { untilMs: 9999 };
      allyA.hp = 0;
      const afterDeath = this.enemyRouteTarget(enemy);
      const randomClearedOnRetarget = enemy.routeRandom === null;

      allyB.hp = 0;
      const buildingFallback = this.enemyRouteTarget(enemy);

      building.image.destroyed = true;
      const castleFallback = this.enemyRouteTarget(enemy);

      this.castleHp = 0;
      const noTarget = this.enemyRouteTarget(enemy);

      this.buildings = previousBuildings;
      this.allies = previousAllies;
      this.castleHp = previousCastleHp;

      const assertions = {
        initialNearestSelected: initialKey === "ally-cache-a",
        closerArrivalDoesNotStealTarget: cachedAfterCloserArrival === initial
          && cachedAfterCloserArrival.key === "ally-cache-a",
        cachedTargetPointRefreshes: refreshed === initial
          && refreshed.point.x === 365 && refreshed.point.y === 325,
        deadCachedTargetInvalidates: afterDeath && afterDeath.key === "ally-cache-b",
        randomHeadingClearsOnRetarget: randomClearedOnRetarget,
        deadUnitsAreSkipped: buildingFallback && buildingFallback.kind === "building",
        destroyedBuildingFallsBackToCastle: castleFallback && castleFallback.kind === "castle",
        deadCastleLeavesNoTarget: noTarget === null && enemy.routeTargetKey === null
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "UnitRoute.cacheTarget/getForward/getForwardWithTarget/calcTarget production adapter",
        transitions: {
          initial: initialKey,
          closerArrival: cachedAfterCloserArrival && cachedAfterCloserArrival.key,
          movedPoint: refreshed && refreshed.point,
          afterDeath: afterDeath && afterDeath.key,
          buildingFallback: buildingFallback && buildingFallback.key,
          castleFallback: castleFallback && castleFallback.key,
          noTarget: noTarget
        },
        evidence: "generated/game.beautified.js:93483-93533,93558-93631,93685-93770",
        assertions
      };
      window.__SHOUCHENG_UNIT_ROUTE_TARGET_CACHE_SMOKE__ = result;
      document.body.dataset.restoreUnitRouteTargetCacheSmoke = JSON.stringify(result);
      console.info("[Shoucheng UnitRoute target-cache smoke]", result);
      return result;
    }

    runPlayerUnitRouteSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previousRouteRandomSource = this.routeRandomSource;
      const previousAllies = this.allies;
      const previousEnemies = this.enemies;
      const makeImage = (x, y) => ({
        x, y, destroyed: false, zOrder: y, skin: "",
        pos(nextX, nextY) { this.x = nextX; this.y = nextY; }
      });
      const target = { id: "player-route-target", hp: 100, image: makeImage(300, 100) };
      const ally = {
        id: "player-route-probe", hp: 100, maxHp: 100, image: makeImage(300, 500),
        frames: ["probe"], frame: 0, frameClock: 0, eventRuntime: null,
        target: null, attackCooldown: 0, attackSpeed: 1, speed: 100, range: 50,
        aliveMs: 0, routeOrder: -1, routeRandom: null,
        routeColliderScale: 1, routeForceColliders: new Map(), repel: null
      };
      const draws = [0, 0.5, 0.9];
      let drawIndex = 0;
      this.routeRandomSource = () => draws[drawIndex++];
      this.allies = [ally];
      this.enemies = [target];
      this.updateAllies(0.1);
      const expectedAngle = -Math.PI / 2 + 0.3;
      const expectedPosition = {
        x: 300 + Math.cos(expectedAngle) * 10,
        y: 500 + Math.sin(expectedAngle) * 10
      };
      const productionPosition = { x: ally.image.x, y: ally.image.y };
      const productionRoute = Object.assign({}, ally.routeRandom);
      const productionTarget = ally.target;

      const peer = {
        id: "player-route-peer", hp: 100, image: makeImage(325, 500),
        routeOrder: -1, routeColliderScale: 1, routeForceColliders: new Map()
      };
      ally.image.pos(300, 500);
      ally.routeForceColliders.clear();
      this.allies = [ally, peer];
      const collisionForward = this.applyUnitRouteColliderForce(ally, { x: 0, y: -1 });
      const collisionWeight = ally.routeForceColliders.get(peer);
      const expectedCollision = this.normalizeRouteVector({ x: -0.5, y: -1 });

      ally.image.pos(300, 500);
      ally.target = null;
      ally.routeRandom = null;
      ally.routeForceColliders.clear();
      this.allies = [ally];
      this.enemies = [];
      drawIndex = 0;
      this.updateAllies(0.1);
      const fallbackY = ally.image.y;

      this.routeRandomSource = previousRouteRandomSource;
      this.allies = previousAllies;
      this.enemies = previousEnemies;

      const positiveAngle = this.unitRouteRandomAngle(Math.PI / 2, 0.2, 1);
      const negativeAngle = this.unitRouteRandomAngle(-Math.PI / 2, 0.2, 1);
      const assertions = {
        playerRouteOrderIsMinusOne: ally.routeOrder === -1,
        productionUpdateCachesNearestEnemy: productionTarget === target && productionRoute.untilMs === 1600,
        negativeArcHeadingExact: close(productionRoute.angle, expectedAngle)
          && close(productionRoute.attenuation, 0.75),
        productionMovementUsesUnitRoute: close(productionPosition.x, expectedPosition.x)
          && close(productionPosition.y, expectedPosition.y),
        sameTeamCollisionWeightExact: close(collisionWeight, 0.5),
        sameTeamCollisionVectorExact: close(collisionForward.x, expectedCollision.x)
          && close(collisionForward.y, expectedCollision.y),
        positiveAndNegativeAnglesMirror: close(positiveAngle, -negativeAngle),
        noTargetFallsBackUpward: fallbackY < 500
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "PlayerUnit.initRoute + shared BaseUnit UnitRoute production adapter",
        playerRoute: {
          order: -1,
          searchRange: -1,
          draws,
          route: productionRoute,
          position: productionPosition,
          expectedPosition,
          fallbackY
        },
        collision: { weight: collisionWeight, forward: collisionForward, expected: expectedCollision },
        evidence: "generated/game.beautified.js:68205-68212,68325-68334,93558-93631,93685-93770,93858-93872,94491-94495",
        assertions
      };
      window.__SHOUCHENG_PLAYER_UNIT_ROUTE_SMOKE__ = result;
      document.body.dataset.restorePlayerUnitRouteSmoke = JSON.stringify(result);
      console.info("[Shoucheng PlayerUnit route smoke]", result);
      return result;
    }

    runUnitRouteSearchRangeSmoke() {
      const previousRouteRandomSource = this.routeRandomSource;
      const previousAllies = this.allies;
      const previousBuildings = this.buildings;
      const previousCastleHp = this.castleHp;
      const enemy = {
        image: { x: 300, y: 100, destroyed: false },
        hp: 100, range: 50, aliveMs: 0, routeOrder: 1,
        routeSearchRange: ENEMY_ROUTE_SEARCH_RANGE,
        routeTarget: null, routeTargetKey: null, routeRandom: null,
        routeColliderScale: 1, routeForceColliders: new Map(), boss: true
      };
      const boundaryAlly = { id: "range-boundary", hp: 100, image: { x: 300, y: 701, destroyed: false } };
      const replacement = { id: "range-replacement", hp: 100, image: { x: 300, y: 701, destroyed: false } };
      this.buildings = [];
      this.castleHp = 0;
      this.allies = [boundaryAlly];

      const outside = this.enemyRouteTarget(enemy);
      boundaryAlly.image.y = 700;
      const atBoundary = this.enemyRouteTarget(enemy);
      const boundaryKey = atBoundary && atBoundary.key;

      boundaryAlly.image.y = 1000;
      const cachedBeyondRange = this.enemyRouteTarget(enemy);

      enemy.routeRandom = { untilMs: 9999 };
      boundaryAlly.hp = 0;
      this.allies = [boundaryAlly, replacement];
      const replacementOutside = this.enemyRouteTarget(enemy);
      const randomClearedAfterDeath = enemy.routeRandom === null;

      replacement.image.y = 700;
      const replacementBoundary = this.enemyRouteTarget(enemy);
      replacement.image.destroyed = true;
      const afterDestroyed = this.enemyRouteTarget(enemy);

      const draws = [0, 0, 0.9];
      let drawIndex = 0;
      this.routeRandomSource = () => draws[drawIndex++];
      const fallbackForward = this.unitRouteForward(enemy, { x: enemy.image.x, y: DESIGN_HEIGHT });

      this.routeRandomSource = previousRouteRandomSource;
      this.allies = previousAllies;
      this.buildings = previousBuildings;
      this.castleHp = previousCastleHp;

      const assertions = {
        recoveredEnemySearchRangeIs600: enemy.routeSearchRange === 600,
        targetAt601PixelsRejected: outside === null,
        targetAt600PixelsIncluded: boundaryKey === "ally-range-boundary",
        cachedTargetMayMoveBeyondRange: cachedBeyondRange === atBoundary
          && cachedBeyondRange.key === "ally-range-boundary",
        deadCachedTargetInvalidates: randomClearedAfterDeath && replacementOutside === null,
        replacementAt601PixelsRejected: replacementOutside === null,
        replacementAt600PixelsIncluded: replacementBoundary
          && replacementBoundary.key === "ally-range-replacement",
        noTargetFallsBackDownward: afterDestroyed === null && fallbackForward.y > 0
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "BaseUnit.routeSerchRange + UnitRoute.calcTarget production adapter",
        search: {
          range: ENEMY_ROUTE_SEARCH_RANGE,
          outsideDistance: 601,
          boundaryDistance: 600,
          boundaryKey,
          cachedBeyondDistance: 900,
          replacementKey: replacementBoundary && replacementBoundary.key
        },
        fallback: { draws, forward: fallbackForward },
        evidence: "generated/game.beautified.js:68253-68261,68707-68720,93685-93770,94491-94495",
        assertions
      };
      window.__SHOUCHENG_UNIT_ROUTE_SEARCH_RANGE_SMOKE__ = result;
      document.body.dataset.restoreUnitRouteSearchRangeSmoke = JSON.stringify(result);
      console.info("[Shoucheng UnitRoute search-range smoke]", result);
      return result;
    }

    runProjectileTravelTimingSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const start = { x: 100, y: 100 };
      const targetImage = new Laya.Sprite();
      targetImage.pos(400, 100);
      const target = { hp: 100, image: targetImage };
      const beforeCount = this.projectiles.length;
      this.fire(start, target, 1, {
        kind: "unit",
        projectileSpeed: 15 * PHYSICS_PIXEL_RATIO,
        attackRange: 300
      });
      const productionProjectile = this.projectiles[this.projectiles.length - 1];
      const productionDuration = productionProjectile.duration;
      productionProjectile.image.destroy(true);
      this.projectiles.splice(beforeCount);
      targetImage.destroy(true);

      const longRangeDuration = this.projectileTravelDuration(
        { x: 0, y: 0 }, { x: 600, y: 0 },
        { kind: "unit", projectileSpeed: 15 * PHYSICS_PIXEL_RATIO }
      );
      const assertions = {
        physicsPixelRatioIs50: PHYSICS_PIXEL_RATIO === 50,
        unitBowSpeed15Becomes750PixelsPerSecond: this.projectileSpeedPixels({ kind: "unit", projectileSpeed: 15 * PHYSICS_PIXEL_RATIO }) === 750,
        unitShamanSpeed195Becomes975PixelsPerSecond: this.projectileSpeedPixels({ kind: "unit", projectileSpeed: 19.5 * PHYSICS_PIXEL_RATIO }) === 975,
        defaultArrowSpeedIs1000PixelsPerSecond: this.defaultProjectileSpeedPixels("defalt") === 1000,
        defaultThrowSpeedIs1250PixelsPerSecond: this.defaultProjectileSpeedPixels("throw") === 1250,
        defaultLightSpeedIs6000PixelsPerSecond: this.defaultProjectileSpeedPixels("light") === 6000,
        productionFireUsesDistanceOverSpeed: close(productionDuration, 0.4),
        longRangeFlightIsNotClampedTo055Seconds: close(longRangeDuration, 0.8) && longRangeDuration > 0.55
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "AmmoManager.parseAmmoConfig + BaseBullet.initVelocity production adapter",
        speedsPixelsPerSecond: {
          unit15: 15 * PHYSICS_PIXEL_RATIO,
          unit18: 18 * PHYSICS_PIXEL_RATIO,
          unit195: 19.5 * PHYSICS_PIXEL_RATIO,
          arrow: this.defaultProjectileSpeedPixels("defalt"),
          throw: this.defaultProjectileSpeedPixels("throw"),
          light: this.defaultProjectileSpeedPixels("light")
        },
        durations: { production300At750: productionDuration, longRange600At750: longRangeDuration },
        evidence: "generated/game.beautified.js:69699-69749,99504-99645; generated/tables/unit.json:BulletSpeed",
        assertions
      };
      window.__SHOUCHENG_PROJECTILE_TRAVEL_TIMING_SMOKE__ = result;
      document.body.dataset.restoreProjectileTravelTimingSmoke = JSON.stringify(result);
      console.info("[Shoucheng projectile travel timing smoke]", result);
      return result;
    }

    runProjectileAutoFlowSmoke() {
      const close = (actual, expected, epsilon) => Math.abs(actual - expected) < (epsilon || 0.000001);
      const targetImage = new Laya.Sprite();
      targetImage.size(50, 80);
      targetImage.pivot(25, 40);
      targetImage.pos(300, 100);
      const target = { hp: 10000, maxHp: 10000, image: targetImage };
      const beforeCount = this.projectiles.length;
      this.fire({ x: 100, y: 100 }, target, 1, {
        kind: "defalt", projectileSpeed: 15 * PHYSICS_PIXEL_RATIO, attackRange: 300
      });
      const projectile = this.projectiles[this.projectiles.length - 1];
      targetImage.pos(100, 500);
      this.updateProjectiles(0.016);
      const first = {
        rotation: projectile.rotationDegrees,
        position: { x: projectile.image.x, y: projectile.image.y },
        flowTimeMs: projectile.flowTimeMs
      };
      this.updateProjectiles(0.016);
      const second = {
        rotation: projectile.rotationDegrees,
        position: { x: projectile.image.x, y: projectile.image.y },
        flowTimeMs: projectile.flowTimeMs
      };
      this.updateProjectiles(0.016);
      const third = {
        rotation: projectile.rotationDegrees,
        position: { x: projectile.image.x, y: projectile.image.y },
        flowTimeMs: projectile.flowTimeMs,
        speed: Math.hypot(projectile.velocity.x, projectile.velocity.y)
      };
      this.fire({ x: 100, y: 100 }, target, 1, {
        kind: "unit", projectileSpeed: 15 * PHYSICS_PIXEL_RATIO, attackRange: 300
      });
      const unitProjectile = this.projectiles[this.projectiles.length - 1];
      projectile.image.destroy(true);
      unitProjectile.image.destroy(true);
      this.projectiles.splice(beforeCount);
      targetImage.destroy(true);

      const assertions = {
        productionBuildingProjectileEnablesAutoFlow: projectile.autoFlow === true,
        recoveredUnitAmmoDefaultsToStraightFlight: unitProjectile.autoFlow === false,
        recoveredDefaultIntervalIs30Ms: projectile.autoFlowIntervalMs === 30,
        firstFrameOnlyAccumulatesFlowTime: close(first.rotation, 0) && close(first.flowTimeMs, 16),
        secondFrameCrossesIntervalWithoutEarlyTurn: close(second.rotation, 0) && close(second.flowTimeMs, 32),
        thirdFrameTurnsAtMostPositive10Degrees: close(third.rotation, 10) && close(third.flowTimeMs, 0),
        recoveredSpeedMagnitudeIsPreserved: close(third.speed, 750),
        projectileUsesVelocityInsteadOfDirectTargetInterpolation: first.position.x > 111
          && first.position.y < 101 && third.position.y < 105,
        originalOneSidedAngleWrapIsPreserved: this.projectileTurnDelta(170, -170) === -10
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "BaseBullet.update autoFlow production adapter",
        intervalMs: 30,
        maximumTurnDegrees: 10,
        frames: { first, second, third },
        evidence: "generated/game.beautified.js:69798-69843,99681-99762",
        assertions
      };
      window.__SHOUCHENG_PROJECTILE_AUTO_FLOW_SMOKE__ = result;
      document.body.dataset.restoreProjectileAutoFlowSmoke = JSON.stringify(result);
      console.info("[Shoucheng projectile autoFlow smoke]", result);
      return result;
    }

    runPlayerProjectileContactSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previous = {
        enemies: this.enemies,
        projectiles: this.projectiles,
        damageTexts: this.damageTexts,
        combatRandom: this.combatRandom
      };
      const createdNodes = [];
      const makeEnemy = (id, x, y) => {
        const image = new Laya.Sprite();
        image.size(50, 80);
        image.pivot(25, 40);
        image.pos(x, y);
        createdNodes.push(image);
        return { id, hp: 1000, maxHp: 1000, image, dodge: 0, boss: false, elite: false };
      };
      const clearCase = () => {
        for (const projectile of this.projectiles.splice(0)) {
          if (projectile.image && !projectile.image.destroyed) projectile.image.destroy(true);
        }
        for (const enemy of this.enemies.splice(0)) {
          if (enemy.image && !enemy.image.destroyed) enemy.image.destroy(true);
        }
        for (const item of this.damageTexts.splice(0)) {
          if (item.label && !item.label.destroyed) item.label.destroy(true);
        }
      };
      const fireOptions = (kind, speed, attackRange) => ({
        kind,
        projectileSpeed: speed,
        attackRange,
        playerAttack: true,
        crit: 0,
        critDamage: 1,
        source: { x: 100, y: 200 }
      });

      let interceptorDamage = 0;
      let originalTargetDamage = 0;
      let deadTargetProjectilePersisted = false;
      let deadTargetStraightPosition = null;
      let bystanderDamageAfterTargetDeath = 0;
      let buildingProjectilePersisted = false;
      let buildingProjectilePosition = null;
      let noContactPersistedBeforeLifetime = false;
      let noContactExpiredAtLifetime = false;
      let destinationBystanderDamage = 0;
      let throwBystanderDamage = 0;
      let throwTargetDamage = 0;

      try {
        this.enemies = [];
        this.projectiles = [];
        this.damageTexts = [];
        this.combatRandom = () => 0.99;

        const intended = makeEnemy("intended", 400, 200);
        const interceptor = makeEnemy("interceptor", 250, 200);
        this.enemies.push(intended, interceptor);
        this.fire({ x: 100, y: 200 }, intended, 10, fireOptions("unit", 1000, 500));
        this.updateProjectiles(0.3);
        interceptorDamage = 1000 - interceptor.hp;
        originalTargetDamage = 1000 - intended.hp;
        clearCase();

        const deadOriginal = makeEnemy("dead-original", 400, 200);
        const pathBystander = makeEnemy("path-bystander", 300, 200);
        this.enemies.push(deadOriginal, pathBystander);
        this.fire({ x: 100, y: 200 }, deadOriginal, 10, fireOptions("unit", 1000, 500));
        deadOriginal.hp = 0;
        deadOriginal.image.destroy(true);
        this.updateProjectiles(0.05);
        deadTargetProjectilePersisted = this.projectiles.length === 1;
        if (this.projectiles[0]) {
          deadTargetStraightPosition = {
            x: this.projectiles[0].image.x,
            y: this.projectiles[0].image.y
          };
        }
        this.updateProjectiles(0.2);
        bystanderDamageAfterTargetDeath = 1000 - pathBystander.hp;
        clearCase();

        const removedBuildingTarget = makeEnemy("removed-building-target", 400, 200);
        this.enemies.push(removedBuildingTarget);
        this.fire({ x: 100, y: 200 }, removedBuildingTarget, 10, fireOptions("defalt", 1000, 500));
        removedBuildingTarget.hp = 0;
        removedBuildingTarget.image.destroy(true);
        this.updateProjectiles(0.05);
        buildingProjectilePersisted = this.projectiles.length === 1;
        if (this.projectiles[0]) {
          buildingProjectilePosition = {
            x: this.projectiles[0].image.x,
            y: this.projectiles[0].image.y
          };
        }
        clearCase();

        const expiredTarget = makeEnemy("expired-target", 200, 200);
        this.enemies.push(expiredTarget);
        this.fire({ x: 100, y: 200 }, expiredTarget, 10, fireOptions("unit", 100, 100));
        expiredTarget.hp = 0;
        expiredTarget.image.destroy(true);
        this.updateProjectiles(0.5);
        noContactPersistedBeforeLifetime = this.projectiles.length === 1;
        this.updateProjectiles(0.61);
        noContactExpiredAtLifetime = this.projectiles.length === 0;
        clearCase();

        const destinationBystander = makeEnemy("destination-bystander", 250, 200);
        this.enemies.push(destinationBystander);
        this.fire({ x: 100, y: 200 }, null, 10, Object.assign(
          fireOptions("unit", 1000, 500),
          { destination: { x: 400, y: 200 } }
        ));
        this.updateProjectiles(0.3);
        destinationBystanderDamage = 1000 - destinationBystander.hp;
        clearCase();

        const throwTarget = makeEnemy("throw-target", 400, 200);
        const throwBystander = makeEnemy("throw-bystander", 250, 200);
        this.enemies.push(throwTarget, throwBystander);
        this.fire({ x: 100, y: 200 }, throwTarget, 10, fireOptions("throw", 1000, 500));
        this.updateProjectiles(0.3);
        throwBystanderDamage = 1000 - throwBystander.hp;
        throwTargetDamage = 1000 - throwTarget.hp;
        clearCase();
      } finally {
        clearCase();
        for (const node of createdNodes) if (node && !node.destroyed) node.destroy(true);
        this.enemies = previous.enemies;
        this.projectiles = previous.projectiles;
        this.damageTexts = previous.damageTexts;
        this.combatRandom = previous.combatRandom;
      }

      const assertions = {
        ordinaryFireBulletUsesEnemyCollisionMask: this.projectileUsesSweptEnemyContacts({ settings: { kind: "defalt" } }),
        unitFireBulletUsesEnemyCollisionMask: this.projectileUsesSweptEnemyContacts({ settings: { kind: "unit" } }),
        nearestPathEnemyInterceptsOriginalTarget: close(interceptorDamage, 10) && close(originalTargetDamage, 0),
        originalTargetRemovalDoesNotDeleteOrdinaryBullet: deadTargetProjectilePersisted,
        removedTargetPreservesLastVelocity: !!deadTargetStraightPosition
          && close(deadTargetStraightPosition.x, 150) && close(deadTargetStraightPosition.y, 200),
        pathEnemyCanInterceptAfterOriginalTargetRemoval: close(bystanderDamageAfterTargetDeath, 10),
        buildingBulletAlsoPersistsAfterTargetRemoval: buildingProjectilePersisted
          && !!buildingProjectilePosition && close(buildingProjectilePosition.x, 150),
        destinationBulletStillUsesPhysicsContacts: close(destinationBystanderDamage, 10),
        noContactBulletLivesUntilRecoveredLifetime: noContactPersistedBeforeLifetime && noContactExpiredAtLifetime,
        throwBulletKeepsTargetOnlySpecialization: close(throwBystanderDamage, 0) && close(throwTargetDamage, 10)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "FireBullet sensor collision + AmmoConfig.deadInLast default production adapter",
        contacts: {
          interceptorDamage,
          originalTargetDamage,
          bystanderDamageAfterTargetDeath,
          destinationBystanderDamage,
          throwBystanderDamage,
          throwTargetDamage
        },
        continuation: {
          deadTargetProjectilePersisted,
          deadTargetStraightPosition,
          buildingProjectilePersisted,
          buildingProjectilePosition,
          noContactPersistedBeforeLifetime,
          noContactExpiredAtLifetime
        },
        evidence: "generated/game.beautified.js:69570-69632,69690-69855,69900-70015,99504-99768",
        assertions
      };
      window.__SHOUCHENG_PLAYER_PROJECTILE_CONTACT_SMOKE__ = result;
      document.body.dataset.restorePlayerProjectileContactSmoke = JSON.stringify(result);
      console.info("[Shoucheng player projectile contact smoke]", result);
      return result;
    }

    runProjectileDeadInLastSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const previous = {
        enemies: this.enemies,
        projectiles: this.projectiles,
        damageTexts: this.damageTexts,
        combatRandom: this.combatRandom
      };
      const createdNodes = [];
      const makeEnemy = (id, x, y) => {
        const image = new Laya.Sprite();
        image.size(50, 80);
        image.pivot(25, 40);
        image.pos(x, y);
        createdNodes.push(image);
        return { id, hp: 1000, maxHp: 1000, image, dodge: 0, boss: false, elite: false };
      };
      const clearCase = () => {
        for (const projectile of this.projectiles.splice(0)) {
          if (projectile.image && !projectile.image.destroyed) projectile.image.destroy(true);
        }
        this.enemies.splice(0);
        for (const item of this.damageTexts.splice(0)) {
          if (item.label && !item.label.destroyed) item.label.destroy(true);
        }
      };
      const options = (extra) => Object.assign({
        kind: "air-support", projectileSpeed: 500, attackRange: 1000,
        playerAttack: true, crit: 0, critDamage: 1,
        source: { x: 100, y: 200 }, autoFlow: true,
        deadInLast: true, forceTargetOnly: true
      }, extra || {});

      let cachedDeathPoint = null;
      let autoFlowDisabled = false;
      let latchedProjectilePersisted = false;
      let bystanderDamageAfterDeath = 0;
      let fakeHitBoxRemovedProjectile = false;
      let deadOriginalHpAfterFakeHit = null;
      let immediateWithin50 = false;
      let forcedLiveTargetDamage = 0;
      let forcedLiveBystanderDamage = 0;

      try {
        this.enemies = [];
        this.projectiles = [];
        this.damageTexts = [];
        this.combatRandom = () => 0.99;

        const movingTarget = makeEnemy("moving-target", 400, 200);
        const bystander = makeEnemy("post-death-bystander", 250, 200);
        this.enemies.push(movingTarget, bystander);
        this.fire({ x: 100, y: 200 }, movingTarget, 10, options());
        movingTarget.image.pos(420, 200);
        this.updateProjectiles(0);
        movingTarget.hp = 0;
        movingTarget.image.destroy(true);
        this.updateProjectiles(0.25);
        const latched = this.projectiles[0];
        cachedDeathPoint = latched && latched.deadTargetPoint;
        autoFlowDisabled = !!latched && latched.autoFlow === false && latched.deadInLastLatched === true;
        latchedProjectilePersisted = this.projectiles.length === 1;
        this.updateProjectiles(0.4);
        bystanderDamageAfterDeath = 1000 - bystander.hp;
        fakeHitBoxRemovedProjectile = this.projectiles.length === 0;
        deadOriginalHpAfterFakeHit = movingTarget.hp;
        clearCase();

        const nearTarget = makeEnemy("near-target", 400, 200);
        this.enemies.push(nearTarget);
        this.fire({ x: 360, y: 200 }, nearTarget, 10, options({ source: { x: 360, y: 200 } }));
        nearTarget.hp = 0;
        this.updateProjectiles(0.001);
        immediateWithin50 = this.projectiles.length === 0;
        clearCase();

        const liveTarget = makeEnemy("forced-live-target", 400, 200);
        const liveBystander = makeEnemy("forced-live-bystander", 250, 200);
        this.enemies.push(liveTarget, liveBystander);
        this.fire({ x: 100, y: 200 }, liveTarget, 10, options({ projectileSpeed: 1000 }));
        this.updateProjectiles(0.4);
        forcedLiveTargetDamage = 1000 - liveTarget.hp;
        forcedLiveBystanderDamage = 1000 - liveBystander.hp;
        clearCase();
      } finally {
        clearCase();
        for (const node of createdNodes) if (node && !node.destroyed) node.destroy(true);
        this.enemies = previous.enemies;
        this.projectiles = previous.projectiles;
        this.damageTexts = previous.damageTexts;
        this.combatRandom = previous.combatRandom;
      }

      const assertions = {
        deadInLastDefaultsOff: !({}).deadInLast,
        targetMovementRefreshesCachedDeathPoint: !!cachedDeathPoint
          && close(cachedDeathPoint.x, 420) && close(cachedDeathPoint.y, 200),
        targetDeathDisablesAutoFlow: autoFlowDisabled,
        deathPointProjectilePersistsUntilFakeContact: latchedProjectilePersisted,
        postDeathBystanderIsIgnored: close(bystanderDamageAfterDeath, 0),
        fake50By50HitBoxConsumesProjectile: fakeHitBoxRemovedProjectile,
        deadOriginalReceivesNoAdditionalDamage: close(deadOriginalHpAfterFakeHit, 0),
        targetDeathWithin50ConsumesImmediately: immediateWithin50,
        forceTargetsRejectsLiveBystander: close(forcedLiveBystanderDamage, 0),
        forceTargetsStillHitsIntendedLiveTarget: close(forcedLiveTargetDamage, 10)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "FireBullet.deadInLast + BMeteoriteSupport.forceTargets production adapter",
        cachedDeathPoint,
        contacts: {
          bystanderDamageAfterDeath, deadOriginalHpAfterFakeHit,
          forcedLiveTargetDamage, forcedLiveBystanderDamage
        },
        evidence: "generated/game.beautified.js:69575-69587,69888-69945,100046-100058,104917-104975",
        assertions
      };
      window.__SHOUCHENG_PROJECTILE_DEAD_IN_LAST_SMOKE__ = result;
      document.body.dataset.restoreProjectileDeadInLastSmoke = JSON.stringify(result);
      console.info("[Shoucheng projectile deadInLast smoke]", result);
      return result;
    }

    runEnemyProjectileRuntimeSmoke() {
      const previous = {
        allies: this.allies,
        buildings: this.buildings,
        projectiles: this.projectiles,
        castleHp: this.castleHp,
        combatRandom: this.combatRandom
      };
      const createdNodes = [];
      const makeActorImage = (x, y) => {
        const image = new Laya.Sprite();
        image.size(50, 80);
        image.pivot(25, 40);
        image.pos(x, y);
        createdNodes.push(image);
        return image;
      };
      const rangedUnit = this.unitById.gb_E916AA75;
      const meleeUnit = this.unitById.db_DF32E2C2;
      const makeEnemy = (unit, x, y, attack) => ({
        hp: 1000,
        unit,
        image: makeActorImage(x, y),
        attack: attack || 10,
        crit: 0,
        critDamage: 1,
        range: Math.max(42, (unit.range || 1) * PHYSICS_PIXEL_RATIO),
        bulletSpeed: this.unitProjectileSpeed(unit)
      });
      const makeAlly = (id, x, y) => ({
        id,
        hp: 1000,
        maxHp: 1000,
        image: makeActorImage(x, y),
        dodge: 0,
        shield: 0,
        equipmentEventPolicy: { unit: {} }
      });
      let emitted = null;
      let hpAtLaunch = 0;
      let hpBeforeContact = 0;
      let hpAfterContact = 0;
      let intercepted = false;
      let targetSurvivedIntercept = false;
      let meleeVisible = true;
      let meleeHpAtLaunch = 0;
      let meleeHpAfterStep = 0;
      let castleHpAtLaunch = 0;
      let castleHpBeforeContact = 0;
      let castleHpAfterContact = 0;

      try {
        this.projectiles = [];
        this.buildings = [];
        this.allies = [];
        this.castleHp = 0;
        this.combatRandom = () => 0.99;

        const rangedEnemy = makeEnemy(rangedUnit, 100, 260, 10);
        const rangedTarget = makeAlly("ranged-target", 400, 260);
        this.allies = [rangedTarget];
        emitted = this.fireEnemyProjectile(rangedEnemy, {
          kind: "ally", value: rangedTarget, point: { x: 400, y: 260 }
        });
        hpAtLaunch = rangedTarget.hp;
        this.updateProjectiles(0.1);
        hpBeforeContact = rangedTarget.hp;
        this.updateProjectiles(0.25);
        hpAfterContact = rangedTarget.hp;

        const interceptEnemy = makeEnemy(rangedUnit, 100, 460, 10);
        const originalTarget = makeAlly("dead-original-target", 430, 460);
        const bystander = makeAlly("path-bystander", 300, 460);
        this.allies = [bystander, originalTarget];
        this.fireEnemyProjectile(interceptEnemy, {
          kind: "ally", value: originalTarget, point: { x: 430, y: 460 }
        });
        originalTarget.hp = 0;
        this.updateProjectiles(0.3);
        intercepted = bystander.hp === 990;
        targetSurvivedIntercept = originalTarget.hp === 0;

        const meleeEnemy = makeEnemy(meleeUnit, 100, 660, 10);
        const meleeTarget = makeAlly("melee-target", 150, 660);
        this.allies = [meleeTarget];
        const meleeProjectile = this.fireEnemyProjectile(meleeEnemy, {
          kind: "ally", value: meleeTarget, point: { x: 150, y: 660 }
        });
        meleeVisible = meleeProjectile.image.visible;
        meleeHpAtLaunch = meleeTarget.hp;
        this.updateProjectiles(0.016);
        meleeHpAfterStep = meleeTarget.hp;

        this.allies = [];
        this.castleHp = 1000;
        const castleBox = this.hostileCastleHitBox();
        const castleX = (castleBox.left + castleBox.right) / 2;
        const castleEnemy = makeEnemy(rangedUnit, castleX, castleBox.top - 300, 10);
        this.fireEnemyProjectile(castleEnemy, {
          kind: "castle", value: null, point: { x: castleX, y: castleBox.top }
        });
        castleHpAtLaunch = this.castleHp;
        this.updateProjectiles(0.1);
        castleHpBeforeContact = this.castleHp;
        this.updateProjectiles(0.25);
        castleHpAfterContact = this.castleHp;
      } finally {
        for (const projectile of this.projectiles) {
          if (projectile.image && !projectile.image.destroyed) projectile.image.destroy(true);
        }
        for (const node of createdNodes) if (node && !node.destroyed) node.destroy(true);
        this.allies = previous.allies;
        this.buildings = previous.buildings;
        this.projectiles = previous.projectiles;
        this.castleHp = previous.castleHp;
        this.combatRandom = previous.combatRandom;
        this.refreshCastleHp();
      }

      const assertions = {
        rangedUnitUsesRecoveredVisibleTrackingAsset: !!emitted && emitted.image.visible === true,
        rangedUnitSpeed18Becomes900PixelsPerSecond: !!emitted && emitted.speedPixelsPerSecond === 900,
        unitBulletDoesNotAutoFlowByDefault: !!emitted && emitted.autoFlow === false,
        rangedDamageWaitsForCollision: hpAtLaunch === 1000 && hpBeforeContact === 1000 && hpAfterContact === 990,
        deadTargetDoesNotDeleteUnitBullet: intercepted && targetSurvivedIntercept,
        pathBystanderCanInterceptUnitBullet: intercepted,
        meleeUsesInvisibleSensorBullet: meleeVisible === false,
        meleeSensorHitsOnFirstPhysicsStep: meleeHpAtLaunch === 1000 && meleeHpAfterStep === 990,
        castleDamageWaitsForProjectileContact: castleHpAtLaunch === 1000
          && castleHpBeforeContact === 1000 && castleHpAfterContact === 990,
        originalUnitBulletLifetimeFormulaPreserved: !!emitted
          && Math.abs(emitted.lifeTime - Math.max(0.27, 250 / 900 + 0.1)) < 0.000001
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "AmmoConfigManager unit branch + UnitBullet/FireBullet production adapter",
        ranged: {
          speedPixelsPerSecond: emitted && emitted.speedPixelsPerSecond,
          lifeTime: emitted && emitted.lifeTime,
          hpAtLaunch,
          hpBeforeContact,
          hpAfterContact,
          autoFlow: emitted && emitted.autoFlow
        },
        interception: { intercepted, targetSurvivedIntercept },
        melee: { visible: meleeVisible, hpAtLaunch: meleeHpAtLaunch, hpAfterStep: meleeHpAfterStep },
        castle: { hpAtLaunch: castleHpAtLaunch, hpBeforeContact: castleHpBeforeContact, hpAfterContact: castleHpAfterContact },
        evidence: "generated/game.beautified.js:69945-70015,70337-70450,72480-72610,73037-73330,99595-99665",
        assertions
      };
      window.__SHOUCHENG_ENEMY_PROJECTILE_RUNTIME_SMOKE__ = result;
      document.body.dataset.restoreEnemyProjectileRuntimeSmoke = JSON.stringify(result);
      console.info("[Shoucheng enemy projectile runtime smoke]", result);
      return result;
    }

    runUnitRouteColliderSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      this.startFight();
      this.spawnClock = 999;
      this.spawnEnemy(0, this.stageConfig.enemies[0]);
      this.spawnEnemy(1, this.stageConfig.enemies[0]);
      const primary = this.enemies[0];
      const other = this.enemies[1];
      primary.image.pos(300, 400);
      other.image.pos(325, 400);
      primary.routeColliderScale = 1;
      other.routeColliderScale = 1;
      primary.routeForceColliders.clear();

      const expectedCompressed = this.normalizeRouteVector({ x: -0.5, y: 1 });
      const compressed = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });
      const rememberedWeight = primary.routeForceColliders.get(other);

      // The physics circles still touch at 75px, while the instantaneous force
      // formula would be non-positive. Original UnitRoute retains the maximum
      // weight until TRIGGER_EXIT, so the same repulsion remains active here.
      other.image.pos(375, 400);
      const retained = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });
      const retainedWeight = primary.routeForceColliders.get(other);

      other.image.pos(400, 400);
      const exited = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });
      const clearedAfterExit = primary.routeForceColliders.size === 0;

      // scaleX participates in both the contact circle and the force denominator.
      other.routeColliderScale = 2;
      other.image.pos(337.5, 400);
      primary.routeForceColliders.clear();
      const scaled = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });
      const scaledWeight = primary.routeForceColliders.get(other);

      // Collider geometry must remain independent from the trimmed texture size.
      primary.routeForceColliders.clear();
      primary.image.size(500, 10);
      other.routeColliderScale = 1;
      other.image.pos(325, 400);
      const textureIndependent = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });

      primary.boss = true;
      primary.routeForceColliders.clear();
      const bossForward = this.applyUnitRouteColliderForce(primary, { x: 0, y: 1 });

      const assertions = {
        recoveredBaseRadius: this.unitRouteColliderRadius(primary) === 50,
        halfRadiusCompressionWeight: close(rememberedWeight, 0.5),
        compressedVectorExact: close(compressed.x, expectedCompressed.x) && close(compressed.y, expectedCompressed.y),
        maximumWeightRetainedUntilExit: close(retainedWeight, 0.5)
          && close(retained.x, expectedCompressed.x) && close(retained.y, expectedCompressed.y),
        triggerExitClearsForce: clearedAfterExit && close(exited.x, 0) && close(exited.y, 1),
        scaleXChangesColliderGeometry: close(scaledWeight, 0.5)
          && close(scaled.x, expectedCompressed.x) && close(scaled.y, expectedCompressed.y),
        textureSizeDoesNotChangeCollider: close(textureIndependent.x, expectedCompressed.x)
          && close(textureIndependent.y, expectedCompressed.y),
        bossDoesNotCollectEqualCollider: primary.routeForceColliders.size === 0
          && close(bossForward.x, 0) && close(bossForward.y, 1)
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        source: "BaseUnit unit_collider + UnitRoute.calcColliderForce production adapter",
        collider: {
          baseRadius: UNIT_ROUTE_COLLIDER_RADIUS,
          unitScales: [1, 2],
          compressedGap: 25,
          retainedContactGap: 75,
          exitGap: 100,
          evidence: "generated/game.beautified.js:67967-67989,68418-68439,68684-68690,93794-93872"
        },
        vectors: { compressed, retained, exited, scaled, textureIndependent, bossForward },
        weights: { rememberedWeight, retainedWeight, scaledWeight },
        assertions
      };
      for (const enemy of this.enemies.splice(0)) {
        if (enemy.image && !enemy.image.destroyed) enemy.image.destroy(true);
        if (enemy.hpBack && !enemy.hpBack.destroyed) enemy.hpBack.destroy(true);
      }
      window.__SHOUCHENG_UNIT_ROUTE_COLLIDER_SMOKE__ = result;
      document.body.dataset.restoreUnitRouteColliderSmoke = JSON.stringify(result);
      console.info("[Shoucheng UnitRoute collider smoke]", result);
      return result;
    }

    runUnitAnimationSmoke() {
      const bodies = Object.keys(this.unitAnimations).sort();
      const actionCounts = {};
      const blueFrames = [];
      for (const body of bodies) {
        for (const [action, clip] of Object.entries(this.unitAnimations[body])) {
          actionCounts[action] = (actionCounts[action] || 0) + clip.frames.length;
          blueFrames.push(...clip.frames);
        }
      }
      const redFrames = blueFrames.map((frame) => frame.replace("res/units/", "res/units-red/"));
      const coreActions = ["idle", "move", "attack", "victory"];
      const probeBody = "Knight1";
      const probeImage = new Laya.Image(this.framesForBody(probeBody, "idle")[0]);
      this.setActorSize(probeImage, this.framesForBody(probeBody, "idle")[0], 1);
      probeImage.pos(DESIGN_WIDTH / 2, 360);
      this.actorLayer.addChild(probeImage);
      const probe = { image: probeImage };
      this.configureActorAnimation(probe, probeBody, false, "idle");
      this.advanceActorAnimation(probe, probe.animationInterval + 0.001);
      const idleAdvances = probe.animationAction === "idle" && probe.frame === 1;
      this.setActorAction(probe, "move", { force: true, restart: true });
      const moveClipSelected = probe.animationAction === "move" && probe.frames.length === 10;
      this.setActorAction(probe, "attack", { force: true, restart: true, oneShot: true });
      const attackClipSelected = probe.animationAction === "attack" && probe.frames.length === 14;
      this.advanceActorAnimation(probe, probe.animationInterval * probe.frames.length + 0.001);
      const attackReturnsToIdle = probe.animationAction === "idle"
        && probe.animationCompletedActions.includes("attack");
      this.setActorAction(probe, "charge", { force: true, restart: true });
      const knightChargeSelected = probe.animationAction === "charge" && probe.frames.length === 5;
      this.setActorAction(probe, "victory", { force: true, restart: true });
      this.advanceActorAnimation(probe, probe.animationInterval * probe.frames.length + 0.001);
      const victoryLoops = probe.animationAction === "victory" && probe.frame === 0;
      this.setActorFacing(probe, -1);
      const facesLeft = probe.facing === -1;
      this.setActorFacing(probe, 1);
      const facesRight = probe.facing === 1;
      this.installRepresentativeLayout();
      this.startFight();
      this.spawnClock = 999;
      this.spawnEnemy(0, "-b_CD2EDAAF");
      const productionEnemy = this.enemies[this.enemies.length - 1];
      const barracks = this.buildings.find((building) => building.definition.id === "e02");
      const productionAlly = barracks ? this.spawnAlly(barracks) : null;
      if (productionEnemy && productionAlly) {
        productionEnemy.hp = productionEnemy.maxHp = 1000000;
        productionEnemy.image.pos(350, 330);
        productionAlly.image.pos(400, 330);
        productionEnemy.attackCooldown = 0;
        productionAlly.attackCooldown = 0;
        productionAlly.target = productionEnemy;
        this.updateEnemies(0.016);
        this.updateAllies(0.016);
      }
      const productionEnemyAttackTransition = !!productionEnemy && productionEnemy.animationAction === "attack";
      const productionAllyAttackTransition = !!productionAlly && productionAlly.animationAction === "attack";
      const allIntervals = bodies.flatMap((body) => Object.values(this.unitAnimations[body]).map((clip) => clip.intervalMs));
      const attackClips = bodies.map((body) => this.unitAnimations[body].attack);
      const productionFireFrameDelays = !!productionEnemy && !!productionAlly
        && productionEnemy.lastAttackFireDelay > 0 && productionAlly.lastAttackFireDelay > 0;
      const allyIdleSkin = productionAlly
        ? this.framesForBody(productionAlly.body, "idle")[0]
        : "";
      const allyNaturalSize = allyIdleSkin ? this.textureSize(allyIdleSkin) : { width: 0, height: 0 };
      const assertions = {
        twentyFourRecoveredBodies: bodies.length === 24,
        allBodiesHaveCoreActions: bodies.every((body) => coreActions.every((action) => !!this.unitAnimations[body][action])),
        fourKnightChargeClips: bodies.filter((body) => !!this.unitAnimations[body].charge).length === 4,
        exactRecoveredActionFrames: blueFrames.length === 1016
          && actionCounts.idle === 192 && actionCounts.move === 240
          && actionCounts.attack === 252 && actionCounts.victory === 312 && actionCounts.charge === 20,
        everyBlueFrameLoaded: blueFrames.every((frame) => this.assetSet.has(frame)),
        everyRedFrameLoaded: redFrames.every((frame) => this.assetSet.has(frame)),
        originalJtaInterval: allIntervals.length === 100 && allIntervals.every((interval) => interval === 102),
        originalAttackFireFrames: attackClips.every((clip) => Number.isFinite(clip.fireFrame)
          && clip.fireFrame > 0 && clip.endFrame === clip.frames.length),
        idleAdvances,
        moveClipSelected,
        attackClipSelected,
        attackReturnsToIdle,
        knightChargeSelected,
        victoryLoops,
        bidirectionalFacing: facesLeft && facesRight,
        productionEnemyAttackTransition,
        productionAllyAttackTransition,
        productionFireFrameDelays,
        productionAllyUsesOriginalJtaScale: !!productionAlly
          && Math.abs(productionAlly.image.width - allyNaturalSize.width * UNIT_GLOBAL_SCALE * (productionAlly.unit.zoom || 1)) < 0.001
          && Math.abs(productionAlly.image.height - allyNaturalSize.height * UNIT_GLOBAL_SCALE * (productionAlly.unit.zoom || 1)) < 0.001
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        bodyCount: bodies.length,
        clipCount: allIntervals.length,
        blueFrameCount: blueFrames.length,
        redFrameCount: redFrames.length,
        actionCounts,
        intervalMs: [...new Set(allIntervals)],
        assertions
      };
      window.__SHOUCHENG_UNIT_ANIMATION_SMOKE__ = result;
      document.body.dataset.restoreUnitAnimationSmoke = JSON.stringify(result);
      console.info("[Shoucheng unit animation smoke]", result);
      return result;
    }

    runAllyHealthBarSmoke() {
      this.installRepresentativeLayout();
      this.startFight();
      const barracks = this.buildings.find((building) => building.definition.class === "barracks");
      const ally = barracks ? this.spawnAlly(barracks) : null;
      const hpBack = ally && ally.hpBack;
      const hpFill = ally && ally.hpFill;
      const backSize = this.textureSize(UI.enemyHpBack);
      const fillSize = this.textureSize(UI.enemyHpFill);
      const startsHidden = !!ally && !!hpBack && hpBack.visible === false && Math.abs(hpFill.width - 64) < 0.001;
      if (ally) ally.dodge = 0;
      const attacker = {
        attack: 10,
        crit: 0,
        critDamage: 1,
        unit: this.unitById["-b_CD2EDAAF"],
        image: { x: ally ? ally.image.x : 0, y: ally ? ally.image.y - 80 : 0 }
      };
      const hpBefore = ally ? ally.hp : 0;
      if (ally) this.enemyAttack(attacker, ally, ally.image, false);
      const hpAfter = ally ? ally.hp : 0;
      const expectedWidth = ally ? 64 * ally.hp / ally.maxHp : 0;
      const revealsOnFirstHit = !!ally && hpAfter === hpBefore - 10 && hpBack.visible === true;
      const fillTracksDamage = !!ally && Math.abs(hpFill.width - expectedWidth) < 0.001;
      if (ally) {
        ally.image.pos(ally.image.x + 31, ally.image.y + 17);
        ally.image.zOrder = ally.image.y;
        this.updateAllyHealthBar(ally);
      }
      const followsMovingUnit = !!ally
        && Math.abs(hpBack.x - (ally.image.x - 35)) < 0.001
        && Math.abs(hpBack.y - (ally.image.y - ally.image.height / 2 - 17)) < 0.001
        && hpBack.zOrder === ally.image.zOrder + 2;
      if (ally) ally.hp = ally.maxHp * 0.25;
      const healingUpdatesBar = !!ally && this.useAirSupport("healing")
        && ally.hp === ally.maxHp && Math.abs(hpFill.width - 64) < 0.001 && hpBack.visible;
      if (ally) {
        attacker.attack = ally.hp + 1;
        this.enemyAttack(attacker, ally, ally.image, false);
      }
      const lethalHitRemovesUnitAndBar = !!ally && !this.allies.includes(ally)
        && ally.image.destroyed && hpBack.destroyed;
      const assertions = {
        recoveredUnitBarDimensions: backSize.width === 70 && backSize.height === 14
          && fillSize.width === 64 && fillSize.height === 8,
        productionAllyOwnsHealthBar: !!ally && !!hpBack && !!hpFill,
        startsHiddenUntilFirstHit: startsHidden,
        firstHitRevealsHealthBar: revealsOnFirstHit,
        fillTracksCurrentHp: fillTracksDamage,
        barFollowsMovingUnit: followsMovingUnit,
        healingRefreshesFill: healingUpdatesBar,
        lethalHitCleansUnitAndBar: lethalHitRemovesUnitAndBar
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        originalAssets: {
          background: UI.enemyHpBack,
          fill: UI.enemyHpFill,
          backgroundSize: [backSize.width, backSize.height],
          fillSize: [fillSize.width, fillSize.height]
        },
        hp: { before: hpBefore, afterFirstHit: hpAfter },
        assertions
      };
      window.__SHOUCHENG_ALLY_HEALTH_BAR_SMOKE__ = result;
      document.body.dataset.restoreAllyHealthBarSmoke = JSON.stringify(result);
      console.info("[Shoucheng ally health bar smoke]", result);
      return result;
    }

    runEnemyMechanicsSmoke() {
      const close = (actual, expected) => Math.abs(actual - expected) < 0.000001;
      const power = this.stageConfig.wavePower[this.currentWave - 1] || 1;
      const rows = [];
      for (let index = 0; index < this.units.length; index += 1) {
        const unit = this.units[index];
        this.spawnEnemy(index, unit.id);
        const enemy = this.enemies[this.enemies.length - 1];
        const kind = unit.id.startsWith("jr") ? "elite" : /tl_/.test(unit.id) ? "boss" : "base";
        const repelResult = this.applyRepel(enemy, { x: enemy.image.x - 20, y: enemy.image.y }, [12, kind === "elite" ? 0.3 : 0.35]);
        const repelSpeed = enemy.repel ? Math.sqrt(
          enemy.repel.velocityX * enemy.repel.velocityX + enemy.repel.velocityY * enemy.repel.velocityY
        ) : 0;
        rows.push({
          id: unit.id,
          kind,
          hp: enemy.hp,
          attack: enemy.attack,
          speed: enemy.speed,
          range: enemy.range,
          boss: enemy.boss,
          elite: enemy.elite,
          aoeRadius: this.unitAoeRadius(unit),
          repelResult,
          repelSpeed,
          repelDuration: enemy.repel ? enemy.repel.duration : 0,
          frameCount: enemy.frames.length,
          framesPresent: enemy.frames.every((frame) => this.assetSet.has(frame)),
          visualHeight: enemy.image.height,
          expectedVisualHeight: this.textureSize(this.framesForBody(enemy.body, "idle")[0]).height
            * UNIT_GLOBAL_SCALE * (unit.zoom || 1)
        });
      }
      const baseRows = rows.filter((row) => row.kind === "base");
      const eliteRows = rows.filter((row) => row.kind === "elite");
      const bossRows = rows.filter((row) => row.kind === "boss");
      const baseUnits = this.units.filter((unit) => !unit.id.startsWith("jr") && !/tl_/.test(unit.id));
      const assertions = {
        sixByThreeVariants: baseRows.length === 6 && eliteRows.length === 6 && bossRows.length === 6,
        baseConversionsComplete: baseUnits.every((unit) => this.unitById[unit.changeToElite]
          && this.unitById[unit.changeToBoss]
          && unit.changeToElite.startsWith("jr") && /tl_/.test(unit.changeToBoss)),
        productionStatsUseWavePower: rows.every((row) => {
          const unit = this.unitById[row.id];
          return row.hp === Math.max(1, Math.round(unit.hp * power))
            && close(row.attack, Math.max(1, unit.attack * power))
            && close(row.speed, (unit.speed || 1) * PHYSICS_PIXEL_RATIO * UNIT_SPEED_RADIO)
            && close(row.range, Math.max(42, (unit.range || 1) * PHYSICS_PIXEL_RATIO));
        }),
        productionClassification: baseRows.every((row) => !row.elite && !row.boss)
          && eliteRows.every((row) => row.elite && !row.boss)
          && bossRows.every((row) => row.boss && !row.elite),
        allAnimationFramesPresent: rows.every((row) => row.frameCount === 10 && row.framesPresent),
        eliteRepelExact: eliteRows.every((row) => row.repelResult && close(row.repelSpeed, 600) && close(row.repelDuration, 0.3)),
        bossRepelResistExact: bossRows.every((row) => !row.repelResult && row.repelSpeed === 0),
        bossAoeExact: bossRows.every((row) => row.aoeRadius === 100),
        baseMageOnlyAoe: baseRows.filter((row) => row.aoeRadius === 100).map((row) => row.id).join(",") === "fs_18B222C3",
        visualZoomApplied: rows.every((row) => close(row.visualHeight, row.expectedVisualHeight))
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        wavePower: power,
        variantCounts: { base: baseRows.length, elite: eliteRows.length, boss: bossRows.length },
        rows,
        assertions
      };
      for (const enemy of this.enemies.splice(0)) {
        if (enemy.image && !enemy.image.destroyed) enemy.image.destroy(true);
        if (enemy.hpBack && !enemy.hpBack.destroyed) enemy.hpBack.destroy(true);
      }
      window.__SHOUCHENG_ENEMY_MECHANICS_SMOKE__ = result;
      document.body.dataset.restoreEnemyMechanicsSmoke = JSON.stringify(result);
      console.info("[Shoucheng all-enemy mechanics smoke]", result);
      return result;
    }

    runShopSmoke() {
      this.shopRefreshCount = 0;
      this.lastSlotRefresh = 0;
      this.shopRollHistory = [];
      this.shopRandom = seededRandom(this.shopSeed());
      this.rollShop(false);
      this.rollShop(false);
      this.rollShop(false);
      const first = this.shopRollHistory[0];
      const third = this.shopRollHistory[2];
      const firstClasses = first.items.map((item) => item.class);
      const guaranteedFirst = firstClasses.includes("barracks") && firstClasses.includes("defense");
      const guaranteedSlot = third.items.some((item) => item.class === "slot");
      const slotDefinition = this.shopItems.map((item) => item.definition).find((definition) => definition && definition.class === "slot");
      let slotPlacement = null;
      if (slotDefinition) {
        for (let row = 0; row <= ROWS - slotDefinition.height && !slotPlacement; row += 1) {
          for (let column = 0; column <= COLS - slotDefinition.width; column += 1) {
            if (this.canPlace(slotDefinition, column, row)) {
              slotPlacement = { column, row };
              break;
            }
          }
        }
      }
      let expansionPass = false;
      if (slotDefinition && slotPlacement) {
        this.placeSlotExpansion(slotDefinition, slotPlacement.column, slotPlacement.row);
        expansionPass = slotDefinition.cells.every(([offsetX, offsetY]) => this.mapData[slotPlacement.row + offsetY][slotPlacement.column + offsetX] === "1");
      }
      this.rollShop(true);
      const special = this.shopRollHistory[3];
      const specialLevel2 = special.items.some((item) => item.level === 2);
      const consumedItem = this.shopItems.find((item) => item.available && item.definition);
      this.consumeShopItem(consumedItem);
      const consumedSlotCleared = !!consumedItem
        && !consumedItem.available
        && !consumedItem.image.visible
        && !consumedItem.usedBack.visible;
      const arrowTowerDefinition = this.makeBuildingDefinition(this.buildingRowById.e07, 1);
      const arrowTowerItem = this.shopItems[0];
      arrowTowerItem.definition = arrowTowerDefinition;
      arrowTowerItem.available = true;
      arrowTowerItem.image.visible = true;
      this.applyDefinitionImage(arrowTowerItem.image, arrowTowerDefinition, arrowTowerItem.width, arrowTowerItem.height - 24, false);
      const arrowMountCreated = !!arrowTowerItem.image.getChildByName("WeaponMount");
      this.consumeShopItem(arrowTowerItem);
      const consumedCompositeCleared = arrowMountCreated
        && !arrowTowerItem.image.visible
        && !arrowTowerItem.image.getChildByName("WeaponMount");
      const availableTrees = [...this.treesByCell.values()];
      const firstTree = availableTrees[0];
      const secondTree = availableTrees[1];
      this.money = 0;
      this.obstacleClearCount = 0;
      this.refreshTreeBadges();
      const firstTreePrice = this.currentObstacleClearPrice();
      const clickTreeCell = (entry) => this.handleStageTreeClick({
        stageX: GRID_X + entry.column * CELL_STEP + CELL_SIZE / 2 + (this.gridLayer.x || 0),
        stageY: GRID_Y + entry.row * CELL_STEP + CELL_SIZE / 2 + (this.gridLayer.y || 0)
      });
      const firstTreeCleared = !!firstTree && clickTreeCell(firstTree);
      const secondTreePrice = this.currentObstacleClearPrice();
      const secondTreeBlockedWithoutMoney = !!secondTree && !clickTreeCell(secondTree)
        && this.treesByCell.has(`${secondTree.column}_${secondTree.row}`);
      this.money = secondTreePrice;
      const secondTreeCleared = !!secondTree && clickTreeCell(secondTree);
      const obstacleClearExact = firstTreePrice === 0 && firstTreeCleared && secondTreePrice === 1
        && secondTreeBlockedWithoutMoney && secondTreeCleared && this.money === 0
        && this.mapData[firstTree.row][firstTree.column] === "1"
        && this.mapData[secondTree.row][secondTree.column] === "1"
        && this.occupied[firstTree.column][firstTree.row] === 0
        && this.occupied[secondTree.column][secondTree.row] === 0;
      const result = {
        ok: guaranteedFirst && guaranteedSlot && expansionPass && specialLevel2 && consumedSlotCleared && consumedCompositeCleared && obstacleClearExact,
        stage: this.stageId,
        typeWeights: this.stageConfig.storeItemTypeWeight,
        levelWeights: this.shopLevelWeights(),
        guaranteedEvery: this.fightParams.BugGuaranteedRefreshCount,
        guaranteedFirst,
        guaranteedSlot,
        expansionPass,
        specialLevel2,
        consumedSlotCleared,
        consumedCompositeCleared,
        obstacleClear: {
          priceList: this.fightParams.ObstacleClearPriceList,
          firstTreePrice,
          firstTreeCleared,
          secondTreePrice,
          secondTreeBlockedWithoutMoney,
          secondTreeCleared,
          obstacleClearExact
        },
        history: this.shopRollHistory
      };
      document.body.dataset.restoreShopSmoke = JSON.stringify(result);
      console.info("[Shoucheng shop smoke]", result);
      return result;
    }

    runAllShopVisualAudit() {
      const rows = [];
      const failures = [];
      const checksumParts = [];
      let baseSkinCount = 0;
      let weaponSkinCount = 0;
      let compositeDefinitionCount = 0;

      for (const id of SHOP_ORDER) {
        const row = this.buildingRowById[id];
        const buildingResult = {
          id,
          body: row ? row.body : "",
          composite: !!(row && WEAPON_MOUNTS[row.body]),
          levels: []
        };
        if (!row) {
          failures.push({ id, reason: "missing-building-row" });
          rows.push(buildingResult);
          continue;
        }

        for (let level = 1; level <= MAX_SYNTH_LEVEL; level += 1) {
          const definition = this.makeBuildingDefinition(row, level);
          const probe = new Laya.Image();
          probe.name = `ShopVisualAudit_${id}_${level}`;
          probe.pos(-10000, -10000);
          probe.visible = true;
          this.shopLayer.addChild(probe);
          this.applyDefinitionImage(probe, definition, 180, 137, false);

          const baseNatural = this.textureSize(definition.skin);
          const mount = probe.getChildByName("WeaponMount");
          const expectsMount = !!definition.weaponMount;
          const mountNatural = expectsMount ? this.textureSize(definition.weaponMount.skin) : null;
          const usedBack = { visible: true };
          const lifecycleItem = { available: true, image: probe, usedBack };
          const rendered = probe.width > 0 && probe.height > 0 && probe.width <= 180.001 && probe.height <= 137.001;
          const mountRendered = !expectsMount || (!!mount && mount.width > 0 && mount.height > 0);
          const basePresent = this.assetSet.has(definition.skin) && baseNatural.width > 0 && baseNatural.height > 0;
          const mountPresent = !expectsMount || (
            this.assetSet.has(definition.weaponMount.skin)
            && mountNatural.width > 0
            && mountNatural.height > 0
          );

          this.consumeShopItem(lifecycleItem);
          const consumedClean = !lifecycleItem.available
            && !probe.visible
            && !usedBack.visible
            && !probe.getChildByName("LevelOverlay")
            && !probe.getChildByName("WeaponMount");
          const levelOk = basePresent
            && rendered
            && mountRendered
            && mountPresent
            && (!!mount === expectsMount)
            && consumedClean;

          baseSkinCount += basePresent ? 1 : 0;
          if (expectsMount) {
            compositeDefinitionCount += 1;
            weaponSkinCount += mountPresent ? 1 : 0;
          }
          checksumParts.push(`${id}:${level}:${definition.skin}:${expectsMount ? definition.weaponMount.skin : "-"}`);
          buildingResult.levels.push({
            level,
            ok: levelOk,
            skin: definition.skin,
            natural: baseNatural,
            rendered: { width: probe.width, height: probe.height },
            weaponSkin: expectsMount ? definition.weaponMount.skin : null,
            weaponNatural: mountNatural,
            consumedClean
          });
          if (!levelOk) {
            failures.push({
              id,
              level,
              basePresent,
              rendered,
              expectsMount,
              mountCreated: !!mount,
              mountRendered,
              mountPresent,
              consumedClean
            });
          }
          probe.destroy(true);
        }
        rows.push(buildingResult);
      }

      let checksum = 2166136261;
      for (const character of checksumParts.join("|")) {
        checksum ^= character.charCodeAt(0);
        checksum = Math.imul(checksum, 16777619) >>> 0;
      }
      const assertions = {
        allShopBuildingsCovered: rows.length === SHOP_ORDER.length && rows.length === 18,
        allSynthesisLevelsCovered: rows.every((row) => row.levels.length === MAX_SYNTH_LEVEL),
        allBaseSkinsPresent: baseSkinCount === SHOP_ORDER.length * MAX_SYNTH_LEVEL,
        allCompositeSkinsPresent: weaponSkinCount === compositeDefinitionCount,
        confirmedCompositeCount: rows.filter((row) => row.composite).length === Object.keys(WEAPON_MOUNTS).length,
        everyRuntimeImageValid: failures.length === 0,
        everyConsumedSlotClean: rows.every((row) => row.levels.every((level) => level.consumedClean))
      };
      const result = {
        ok: Object.values(assertions).every(Boolean),
        stage: this.stageId,
        buildingCount: rows.length,
        synthesisLevels: MAX_SYNTH_LEVEL,
        definitionCount: rows.reduce((sum, row) => sum + row.levels.length, 0),
        baseSkinCount,
        compositeBuildingCount: rows.filter((row) => row.composite).length,
        compositeDefinitionCount,
        weaponSkinCount,
        checksum: checksum.toString(16).padStart(8, "0"),
        failures,
        assertions,
        rows
      };
      window.__SHOUCHENG_ALL_SHOP_VISUALS__ = result;
      document.body.dataset.restoreAllShopVisuals = JSON.stringify(result);
      console.info("[Shoucheng all-shop visual audit]", result);
      return result;
    }

    runShopFreeItemSmoke() {
      const traitRow = this.generalTraits.find((trait) => trait.effectKey === "ShopFreeItem");
      const trait = traitRow ? {
        id: traitRow.id,
        effectKey: traitRow.effectKey,
        quality: traitRow.qualities[0],
        value: traitRow.params[0]
      } : null;
      this.applyGeneralTrait(trait);
      this.shopRefreshCount = 0;
      this.lastSlotRefresh = 0;
      this.shopRollHistory = [];
      this.shopRandom = seededRandom(this.shopSeed());
      this.rollShop(false);
      const fourth = this.shopItems[3];
      const fourVisibleDefinitions = this.shopItems.length === 4
        && this.shopItems.every((item) => item.available && item.definition && item.image.visible);
      const placement = fourth && fourth.definition ? this.findFirstPlacement(fourth.definition) : null;
      const beforeBuildings = this.buildings.length;
      let dragStarted = false;
      let fourthPlaced = false;
      if (fourth && placement) {
        this.beginShopDrag(3);
        dragStarted = !!this.drag && this.drag.shopItem === fourth;
        this.finishDragAt(
          GRID_X + (placement.column + fourth.definition.width / 2) * CELL_STEP,
          GRID_Y + (placement.row + fourth.definition.height / 2) * CELL_STEP
        );
        fourthPlaced = !fourth.available && (fourth.definition.class === "slot" || this.buildings.length === beforeBuildings + 1);
      }
      const historyItemCount = this.shopRollHistory[0] ? this.shopRollHistory[0].items.length : 0;
      const result = {
        ok: !!trait && fourVisibleDefinitions && historyItemCount === 4 && dragStarted && fourthPlaced,
        trait,
        shopShowItemCount: this.shopItems.length,
        historyItemCount,
        fourth: fourth && fourth.definition ? { id: fourth.definition.id, class: fourth.definition.class, level: fourth.definition.level || 0 } : null,
        dragStarted,
        fourthPlaced
      };
      document.body.dataset.restoreShopFreeItemSmoke = JSON.stringify(result);
      console.info("[Shoucheng ShopFreeItem smoke]", result);
      return result;
    }
  }

  function boot() {
    if (typeof window.PAY_AD_ENABLE_ST === "undefined") window.PAY_AD_ENABLE_ST = "NONE";
    Laya.init(DESIGN_WIDTH, DESIGN_HEIGHT, Laya.WebGL);
    Laya.stage.scaleMode = CAPTURE_MODE ? Laya.Stage.SCALE_SHOWALL : Laya.Stage.SCALE_FIXED_WIDTH;
    Laya.stage.alignH = Laya.Stage.ALIGN_CENTER;
    Laya.stage.alignV = Laya.Stage.ALIGN_MIDDLE;
    Laya.stage.screenMode = CAPTURE_MODE ? Laya.Stage.SCREEN_NONE : Laya.Stage.SCREEN_VERTICAL;
    Laya.stage.bgColor = "#10131c";
    const catalogs = DATA_URLS.map((url) => ({ url, type: Laya.Loader.JSON }));
    Laya.loader.load(catalogs, Laya.Handler.create(null, () => {
      const content = {
        stages: Laya.loader.getRes("data/stages.json"),
        buildings: Laya.loader.getRes("data/buildings.json"),
        units: Laya.loader.getRes("data/units.json"),
        enemies: Laya.loader.getRes("data/enemies.json"),
        enemyVariants: Laya.loader.getRes("data/enemy-variants.json"),
        fightParams: Laya.loader.getRes("data/fight-params.json"),
        fightLevels: Laya.loader.getRes("data/fight-levels.json"),
        generalTraits: Laya.loader.getRes("data/general-traits.json"),
        equipmentTraits: Laya.loader.getRes("data/equipment-traits.json"),
        equipmentUpgrades: Laya.loader.getRes("data/equipment-upgrades.json"),
        techRows: Laya.loader.getRes("data/tech.json"),
        unitAnimations: Laya.loader.getRes("data/unit-animations.json"),
        assets: Laya.loader.getRes("data/asset-manifest.json"),
        metaUiManifest: Laya.loader.getRes("data/meta-ui-manifest.json"),
        slotShapes: Laya.loader.getRes("data/slot-shapes.json")
      };
      const enemyFrameUrls = content.assets
        .filter((url) => /^res\/units\/[^/]+_(?:idle|move|attack|victory|charge|dead)_\d+\.png$/.test(url))
        .map((url) => url.replace("res/units/", "res/units-red/"));
      const imageUrls = [...new Set(Object.values(UI).concat(content.assets, enemyFrameUrls))];
      const resources = imageUrls.map((url) => ({ url, type: Laya.Loader.IMAGE }));
      for (const asset of (content.metaUiManifest && content.metaUiManifest.assets) || []) {
        if (asset.type === "sound") continue;
        resources.push({ url: asset.url, type: asset.type === "buffer" ? Laya.Loader.BUFFER : Laya.Loader.IMAGE });
      }
      Laya.loader.load(resources, Laya.Handler.create(null, () => new ShouchengGame(content)));
    }));
  }

  if (document.fonts && document.fonts.load) document.fonts.load("28px OPPOSansH").then(boot, boot);
  else boot();
})();
