const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const source = path.join(__dirname, "src", "Main.js");
const destination = path.join(__dirname, "bin", "js", "main.js");
const sourceData = path.join(__dirname, "src", "data");
const destinationData = path.join(__dirname, "bin", "data");
const recoveredUiSource = path.resolve(
  __dirname,
  "..",
  "targets",
  "wx4f4f3709865004a2",
  "3",
  "work",
  "unpacked-ui",
  "ui"
);
const recoveredUiDestination = path.join(__dirname, "bin", "ui");
const recoveredUnitFramesSource = path.resolve(
  __dirname,
  "..",
  "targets",
  "wx4f4f3709865004a2",
  "3",
  "generated",
  "jta-unit-pngs"
);
const recoveredUnitJtaSource = path.resolve(
  __dirname,
  "..",
  "targets",
  "wx4f4f3709865004a2",
  "3",
  "generated",
  "fairygui-units",
  "assets",
  "BattleUnits",
  "units"
);
const recoveredModelTable = JSON.parse(fs.readFileSync(path.resolve(
  __dirname,
  "..",
  "targets",
  "wx4f4f3709865004a2",
  "3",
  "generated",
  "tables",
  "model.json"
), "utf8"));
const metaUiPackages = new Set([
  "BattleEquiptIocn",
  "BuyStamina",
  "Collection",
  "DailyAdRewards",
  "Effects",
  "EquiptLayer",
  "FuncUnlock",
  "GoodNews",
  "HeroLayer",
  "Institute",
  "ItemDetail",
  "LibraryLayer",
  "MainPage",
  "MainTabPage",
  "Party",
  "Preset",
  "PrivilegeCard",
  "RewardShow",
  "RoleLibrary",
  "Settings",
  "ShopLayer",
  "TipsDialog",
  "TopAsset",
  "hero",
  "images",
  "item",
  "sound"
]);

fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
fs.mkdirSync(destinationData, { recursive: true });
for (const entry of fs.readdirSync(sourceData, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".json")) {
    fs.copyFileSync(path.join(sourceData, entry.name), path.join(destinationData, entry.name));
  }
}

const unitFrameDestination = path.join(__dirname, "bin", "res", "units");
fs.mkdirSync(unitFrameDestination, { recursive: true });
const unitAnimationCatalog = {};
if (!fs.existsSync(recoveredUnitFramesSource)) {
  throw new Error(`Recovered unit frame source missing: ${recoveredUnitFramesSource}`);
}
for (const name of fs.readdirSync(recoveredUnitFramesSource).sort()) {
  const match = /^(.*)_(idle|move|attack|victory|charge|dead)_(\d+)\.png$/i.exec(name);
  if (!match) continue;
  const [, body, rawAction, rawFrame] = match;
  const action = rawAction.toLowerCase();
  fs.copyFileSync(path.join(recoveredUnitFramesSource, name), path.join(unitFrameDestination, name));
  if (!unitAnimationCatalog[body]) unitAnimationCatalog[body] = {};
  if (!unitAnimationCatalog[body][action]) {
    let intervalMs = 102;
    const jtaPath = path.join(recoveredUnitJtaSource, `${body}_${action}.jta`);
    if (fs.existsSync(jtaPath)) {
      const header = fs.readFileSync(jtaPath);
      const signatureLength = header.readUInt16BE(0);
      intervalMs = header.readUInt32BE(2 + signatureLength);
    }
    unitAnimationCatalog[body][action] = { intervalMs, frames: [] };
    if (action === "attack" && recoveredModelTable[body]
      && recoveredModelTable[body].Action && recoveredModelTable[body].Action.atk) {
      unitAnimationCatalog[body][action].fireFrame = recoveredModelTable[body].Action.atk[0];
      unitAnimationCatalog[body][action].endFrame = recoveredModelTable[body].Action.atk[1];
    }
  }
  unitAnimationCatalog[body][action].frames.push({ index: Number(rawFrame), url: `res/units/${name}` });
}
for (const actions of Object.values(unitAnimationCatalog)) {
  for (const clip of Object.values(actions)) {
    clip.frames = clip.frames.sort((left, right) => left.index - right.index).map((frame) => frame.url);
  }
}
fs.writeFileSync(
  path.join(destinationData, "unit-animations.json"),
  `${JSON.stringify(unitAnimationCatalog, null, 2)}\n`,
  "utf8"
);

const teamFrameResult = spawnSync(
  "python",
  [path.join(__dirname, "tools", "generate_enemy_team_frames.py")],
  { cwd: __dirname, stdio: "inherit" }
);
if (teamFrameResult.status !== 0) throw new Error(`Enemy team-frame generation failed with status ${teamFrameResult.status}`);

const assetDirectories = ["maps", "buildings", "units", "units-red"];
const assets = [];
for (const directory of assetDirectories) {
  const absolute = path.join(__dirname, "bin", "res", directory);
  if (!fs.existsSync(absolute)) continue;
  for (const name of fs.readdirSync(absolute).sort()) {
    if (name.toLowerCase().endsWith(".png")) assets.push(`res/${directory}/${name}`);
  }
}
fs.writeFileSync(path.join(destinationData, "asset-manifest.json"), `${JSON.stringify(assets, null, 2)}\n`, "utf8");

fs.mkdirSync(recoveredUiDestination, { recursive: true });
const metaUiAssets = [];
if (fs.existsSync(recoveredUiSource)) {
  for (const name of fs.readdirSync(recoveredUiSource).sort()) {
    const extension = path.extname(name).toLowerCase();
    const packageName = name.split("_")[0].replace(/\.(bin|png|wav|ogg|mp3)$/i, "");
    if (!metaUiPackages.has(packageName)) continue;
    if (![".bin", ".png", ".wav", ".ogg", ".mp3"].includes(extension)) continue;
    fs.copyFileSync(path.join(recoveredUiSource, name), path.join(recoveredUiDestination, name));
    metaUiAssets.push({
      url: `ui/${name}`,
      type: extension === ".bin" ? "buffer" : extension === ".png" ? "image" : "sound"
    });
  }
}
fs.writeFileSync(
  path.join(destinationData, "meta-ui-manifest.json"),
  `${JSON.stringify({ packages: [...metaUiPackages], assets: metaUiAssets }, null, 2)}\n`,
  "utf8"
);
const derivedCount = assets.filter((asset) => asset.startsWith("res/units-red/")).length;
const recoveredActionFrameCount = Object.values(unitAnimationCatalog)
  .flatMap((actions) => Object.values(actions))
  .reduce((sum, clip) => sum + clip.frames.length, 0);
console.log(`Built runtime: main.js, ${fs.readdirSync(sourceData).filter((name) => name.endsWith(".json")).length + 1} catalogs, ${assets.length - derivedCount} recovered images, ${derivedCount} derived team-color frames, ${recoveredActionFrameCount} recovered unit-action frames, ${metaUiAssets.length} offline-meta UI assets`);
