const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const options = Object.fromEntries(process.argv.slice(2).map((argument) => {
  const match = /^--([^=]+)=(.*)$/.exec(argument);
  return match ? [match[1], match[2]] : [argument.replace(/^--/, ""), "1"];
}));
const startStage = Math.max(1, Number(options.start || 1));
const endStage = Math.min(220, Number(options.end || 220));
const concurrency = Math.max(1, Math.min(16, Number(options.concurrency || 8)));
const timeoutMs = Math.max(5000, Number(options.timeout || 60000));
const discoverTimeoutMs = Math.max(10000, Number(options["discover-timeout"] || 30000));
const portBase = Math.max(1024, Number(options["port-base"] || 9400));
const baseUrl = options.url || "http://127.0.0.1:8131/";
const chromePath = options.chrome
  || process.env.SHOUCHENG_CHROME
  || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found: ${chromePath}`);
if (startStage > endStage) throw new Error(`Invalid stage range: ${startStage}-${endStage}`);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function discoverPage(port, stage) {
  const deadline = Date.now() + discoverTimeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const pages = await response.json();
      const page = pages.find((candidate) => candidate.type === "page"
        && candidate.url.includes(`stage=${stage}`)
        && candidate.url.includes("test=stage-battle-sweep"));
      if (page) return page;
    } catch {}
    await sleep(50);
  }
  throw new Error(`No sweep page appeared for Stage ${stage} on CDP port ${port}`);
}

function connect(page) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    const pending = new Map();
    const diagnostics = { errors: [], warnings: [] };
    let nextId = 1;
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      if (message.method === "Runtime.exceptionThrown") {
        diagnostics.errors.push(message.params.exceptionDetails.text || "Runtime.exceptionThrown");
      } else if (message.method === "Log.entryAdded") {
        const entry = message.params.entry;
        const favicon404 = entry.level === "error"
          && /\/favicon\.ico(?:$|\?)/.test(entry.url || "") && /404/.test(entry.text || "");
        if (entry.level === "error" && !favicon404) diagnostics.errors.push(entry.text);
        else if (entry.level === "warning") diagnostics.warnings.push(entry.text);
      } else if (message.method === "Runtime.consoleAPICalled") {
        if (message.params.type === "error") diagnostics.errors.push("console.error");
        else if (message.params.type === "warning") diagnostics.warnings.push("console.warn");
      }
    };
    socket.onopen = () => {
      const call = (method, params = {}) => new Promise((callResolve, callReject) => {
        const id = nextId++;
        pending.set(id, { resolve: callResolve, reject: callReject });
        socket.send(JSON.stringify({ id, method, params }));
      });
      resolve({ socket, call, diagnostics });
    };
    socket.onerror = () => reject(new Error("CDP WebSocket connection failed"));
  });
}

async function removeProfile(profile) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(100 * (attempt + 1));
    }
  }
}

async function runStage(stage) {
  const startedAt = Date.now();
  const port = portBase + stage;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `shoucheng-sweep-${stage}-`));
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}stage=${stage}&test=stage-battle-sweep`;
  const chrome = spawn(chromePath, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, url
  ], { stdio: "ignore", windowsHide: true });
  let connection = null;
  try {
    const page = await discoverPage(port, stage);
    connection = await connect(page);
    await connection.call("Runtime.enable");
    await connection.call("Log.enable");
    const expression = `(() => {
      const parse = (name) => {
        const value = document.body && document.body.dataset[name];
        if (!value) return null;
        try { return JSON.parse(value); } catch { return { parseError: true, value }; }
      };
      const game = window.__SHOUCHENG_GAME__;
      return {
        state: parse("restoreState"),
        result: parse("restoreResult"),
        expectedEnemies: game && game.waveCounts ? game.waveCounts.reduce((sum, count) => sum + count, 0) : null,
        expectedWaves: game ? game.maxWave : null
      };
    })()`;
    const deadline = Date.now() + timeoutMs;
    let snapshot = null;
    while (Date.now() < deadline) {
      const evaluated = await connection.call("Runtime.evaluate", {
        expression, returnByValue: true, awaitPromise: true
      });
      snapshot = evaluated.result && evaluated.result.value;
      if (snapshot && snapshot.result) break;
      await sleep(50);
    }
    const result = snapshot && snapshot.result;
    const state = snapshot && snapshot.state;
    const adapter = result && result.testAdapter;
    const assertions = {
      terminalResultReached: !!result,
      victoryReached: !!result && result.victory === true,
      allWavesReached: !!result && result.wave === snapshot.expectedWaves
        && result.maxWave === snapshot.expectedWaves,
      allRosterEnemiesKilled: !!result && result.kills === snapshot.expectedEnemies,
      explicitTestOnlyAdapter: !!adapter && adapter.testOnly === true
        && /not a balance claim/.test(adapter.purpose || ""),
      noConsoleErrors: connection.diagnostics.errors.length === 0
    };
    return {
      ok: Object.values(assertions).every(Boolean),
      stage,
      waves: result ? result.wave : state && state.wave,
      expectedWaves: snapshot && snapshot.expectedWaves,
      kills: result ? result.kills : state && state.totalKills,
      expectedEnemies: snapshot && snapshot.expectedEnemies,
      exp: result && result.exp,
      battleMoney: result && result.battleMoney,
      castleHp: state && state.castleHp,
      adapter,
      assertions,
      consoleErrors: connection.diagnostics.errors,
      consoleWarnings: connection.diagnostics.warnings,
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      ok: false, stage, error: String(error), stack: error && error.stack,
      durationMs: Date.now() - startedAt
    };
  } finally {
    if (connection) {
      try { await connection.call("Browser.close"); } catch {}
      try { connection.socket.close(); } catch {}
    }
    try { chrome.kill(); } catch {}
    await sleep(50);
    await removeProfile(profile);
  }
}

function checksumRows(rows) {
  let checksum = 2166136261;
  for (const row of rows) {
    const text = `${row.stage}:${row.ok}:${row.waves}:${row.expectedWaves}:${row.kills}:${row.expectedEnemies}:${row.exp}:${row.battleMoney};`;
    for (let index = 0; index < text.length; index += 1) {
      checksum ^= text.charCodeAt(index);
      checksum = Math.imul(checksum, 16777619) >>> 0;
    }
  }
  return checksum.toString(16).padStart(8, "0");
}

(async () => {
  const wallStartedAt = Date.now();
  const stages = Array.from({ length: endStage - startStage + 1 }, (_, index) => startStage + index);
  const results = [];
  let cursor = 0;
  let completed = 0;
  async function worker() {
    while (cursor < stages.length) {
      const stage = stages[cursor++];
      results.push(await runStage(stage));
      completed += 1;
      if (completed % 10 === 0 || completed === stages.length) {
        process.stderr.write(`[all-stage battle sweep] ${completed}/${stages.length}\n`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, stages.length) }, worker));
  results.sort((left, right) => left.stage - right.stage);
  const failures = results.filter((result) => !result.ok);
  const uniqueWarnings = [...new Set(results.flatMap((result) => result.consoleWarnings || []))];
  const sampleIds = new Set([startStage, 2, 5, 100, endStage]);
  const samples = results.filter((result) => sampleIds.has(result.stage)).map((result) => ({
    stage: result.stage,
    waves: result.waves,
    enemies: result.kills,
    exp: result.exp,
    battleMoney: result.battleMoney,
    castleHp: result.castleHp,
    durationMs: result.durationMs
  }));
  const assertions = {
    everyRequestedStageCompleted: results.length === stages.length,
    everyStageReachedVictory: failures.length === 0,
    everyStageReachedEveryWave: results.every((result) => result.waves === result.expectedWaves),
    everyStageKilledFullRoster: results.every((result) => result.kills === result.expectedEnemies),
    everyStageUsedExplicitTestAdapter: results.every((result) => result.adapter && result.adapter.testOnly),
    zeroConsoleErrors: results.every((result) => !(result.consoleErrors || []).length)
  };
  const summary = {
    ok: Object.values(assertions).every(Boolean),
    route: `${baseUrl}?stage=<1..220>&test=stage-battle-sweep`,
    stageRange: [startStage, endStage],
    stageCount: results.length,
    concurrency,
    timeoutMs,
    totalWaves: results.reduce((sum, result) => sum + (result.waves || 0), 0),
    totalEnemies: results.reduce((sum, result) => sum + (result.kills || 0), 0),
    totalExp: results.reduce((sum, result) => sum + (result.exp || 0), 0),
    victories: results.filter((result) => result.ok).length,
    failures: failures.map((result) => ({
      stage: result.stage, error: result.error || null, assertions: result.assertions || null,
      consoleErrors: result.consoleErrors || []
    })),
    checksum: checksumRows(results),
    wallDurationMs: Date.now() - wallStartedAt,
    slowestStages: results.slice().sort((left, right) => right.durationMs - left.durationMs).slice(0, 5)
      .map((result) => ({ stage: result.stage, durationMs: result.durationMs })),
    environmentWarnings: uniqueWarnings,
    samples,
    adapter: {
      testOnly: true,
      purpose: "force every stage through all production waves; explicitly excluded from balance claims"
    },
    assertions
  };
  console.log(JSON.stringify(summary));
  if (!summary.ok) process.exitCode = 1;
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
