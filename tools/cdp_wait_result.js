const port = Number(process.argv[2] || 9222);
const timeoutMs = Number(process.argv[3] || 45000);
const pageNeedle = process.argv[4] || "127.0.0.1:8131";

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function discoverPage() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const pages = await response.json();
      const page = pages.find((candidate) => candidate.type === "page" && candidate.url.includes(pageNeedle));
      if (page) return page;
    } catch {}
    await sleep(100);
  }
  throw new Error(`No local test page appeared on CDP port ${port}`);
}

(async () => {
  const page = await discoverPage();
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
    const isLocalFavicon404 = entry.level === "error"
      && /\/favicon\.ico(?:$|\?)/.test(entry.url || "")
      && /404/.test(entry.text || "");
    if (entry.level === "error" && !isLocalFavicon404) diagnostics.errors.push(entry.text);
    else if (entry.level === "warning") diagnostics.warnings.push(entry.text);
  } else if (message.method === "Runtime.consoleAPICalled") {
    if (message.params.type === "error") diagnostics.errors.push("console.error");
    else if (message.params.type === "warning") diagnostics.warnings.push("console.warn");
  }
};

await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = () => reject(new Error("CDP WebSocket connection failed"));
});

const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

await call("Runtime.enable");
await call("Log.enable");

const expression = `(() => {
  const parse = (name) => {
    const value = document.body && document.body.dataset[name];
    if (!value) return null;
    try { return JSON.parse(value); } catch { return { parseError: true, value }; }
  };
  return { state: parse("restoreState"), result: parse("restoreResult") };
})()`;

const deadline = Date.now() + timeoutMs;
let snapshot = null;
while (Date.now() < deadline) {
  const evaluated = await call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true
  });
  snapshot = evaluated.result && evaluated.result.value;
  if (snapshot && (snapshot.result || (snapshot.state && snapshot.state.finished))) break;
  await sleep(100);
}

const complete = !!(snapshot && (snapshot.result || (snapshot.state && snapshot.state.finished)));
const output = {
  ok: complete && diagnostics.errors.length === 0,
  port,
  url: page.url,
  snapshot,
  consoleErrors: diagnostics.errors,
  consoleWarnings: diagnostics.warnings
};
console.log(JSON.stringify(output));
try { await call("Browser.close"); } catch {}
socket.close();
  if (!output.ok) process.exitCode = 1;
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
