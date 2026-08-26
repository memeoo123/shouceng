const port = Number(process.argv[2] || 9222);
const datasetName = process.argv[3];
const timeoutMs = Number(process.argv[4] || 30000);
const pageNeedle = process.argv[5] || "127.0.0.1:8131";

if (!datasetName) throw new Error("dataset name is required");

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
      const favicon404 = entry.level === "error"
        && /\/favicon\.ico(?:$|\?)/.test(entry.url || "") && /404/.test(entry.text || "");
      if (entry.level === "error" && !favicon404) diagnostics.errors.push(entry.text);
      else if (entry.level === "warning") diagnostics.warnings.push(entry.text);
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

  const deadline = Date.now() + timeoutMs;
  let result = null;
  while (Date.now() < deadline) {
    const evaluated = await call("Runtime.evaluate", {
      expression: `document.body && document.body.dataset[${JSON.stringify(datasetName)}] || null`,
      returnByValue: true
    });
    const value = evaluated.result && evaluated.result.value;
    if (value) {
      try { result = JSON.parse(value); } catch { result = { parseError: true, value }; }
      break;
    }
    await sleep(100);
  }
  const output = {
    ok: !!result && result.ok !== false && diagnostics.errors.length === 0,
    port, url: page.url, datasetName, result,
    consoleErrors: diagnostics.errors, consoleWarnings: diagnostics.warnings
  };
  console.log(JSON.stringify(output));
  try { await call("Browser.close"); } catch {}
  socket.close();
  if (!output.ok) process.exitCode = 1;
})().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
