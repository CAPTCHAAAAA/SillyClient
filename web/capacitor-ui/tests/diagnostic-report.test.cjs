const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { test } = require("node:test");

function loadTsModule(relativePath, cache = new Map()) {
  const normalizedRel = relativePath.replace(/\\/g, "/");
  if (cache.has(normalizedRel)) {
    return cache.get(normalizedRel).exports;
  }
  const sourcePath = path.join(__dirname, "..", normalizedRel);
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const compiledModule = { exports: {} };
  cache.set(normalizedRel, compiledModule);
  const context = {
    exports: compiledModule.exports,
    module: compiledModule,
    URL,
    URLSearchParams,
    TextEncoder,
    AbortController,
    setTimeout,
    clearTimeout,
    require: (id) => {
      if (id === "react") {
        return { useEffect: () => {}, useState: (init) => [typeof init === "function" ? init() : init, () => {}] };
      }
      if (id.startsWith(".")) {
        const baseDir = path.dirname(sourcePath);
        if (id.endsWith(".json")) {
          const jsonPath = path.resolve(baseDir, id);
          if (fs.existsSync(jsonPath)) {
            const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
            return { __esModule: true, default: parsed, ...parsed };
          }
        }
        const candidateTs = path.resolve(baseDir, `${id}.ts`);
        if (fs.existsSync(candidateTs)) {
          const nextRel = path.relative(path.join(__dirname, ".."), candidateTs);
          return loadTsModule(nextRel, cache);
        }
      }
      throw new Error(`Unexpected runtime import in ${relativePath}: ${id}`);
    },
  };
  vm.runInNewContext(compiled, context, { filename: sourcePath });
  return compiledModule.exports;
}

const {
  buildDiagnosticIssueBody,
  buildDiagnosticIssueTitle,
  buildPrefilledGitHubIssueUrl,
  deliverDiagnosticReport,
  formatDiagnosticReportIdDisplay,
  normalizeDiagnosticEndpointUrl,
  openDiagnosticPrefillDraft,
  resolveDiagnosticEndpoints,
} = loadTsModule("src/lib/diagnostic-report.ts");

const {
  SENTRY_DSN_STORAGE_KEY,
  buildSentryEventEnvelope,
  buildSentryFeedbackEnvelope,
  parseSentryDsn,
  resolveSentryDsn,
} = loadTsModule("src/lib/sentry-diagnostic.ts");

test("redacts tokens, credentials, paths, and markdown fences from formatted issues", () => {
  const input = {
    area: "launch",
    stage: "boot",
    errorCode: "E_BOOT",
    summary:
      "Failed with Bearer secret-token-123456 at https://admin:superpass@example.com/?token=abc and C:\\Users\\Alice\\secrets\n```injected```",
    userNote: "Key sk-proj-1234567890abcdef and github_pat_1234567890ABCDEF",
    platform: "windows",
    appVersion: "1.14.1",
    elapsedMs: 420,
    fingerprint: "deadbeef",
  };

  const title = buildDiagnosticIssueTitle(input);
  const body = buildDiagnosticIssueBody(input);

  assert.match(title, /^\[异常反馈\]\[启动\]/);
  assert.doesNotMatch(title + body, /secret-token-123456/);
  assert.doesNotMatch(title + body, /superpass/);
  assert.doesNotMatch(title + body, /sk-proj-1234567890abcdef/);
  assert.doesNotMatch(title + body, /github_pat_1234567890ABCDEF/);
  assert.doesNotMatch(title + body, /C:\\Users\\Alice/);
  assert.doesNotMatch(body, /```injected```/);
  assert.doesNotMatch(title, /```injected```/);
  assert.match(body, /sc:deadbeef/);
  assert.match(body, /<!-- sillyclient-diagnostic: fingerprint=deadbeef/);
  const scPrefixedBody = buildDiagnosticIssueBody({ ...input, fingerprint: "SC-f9d96145" });
  assert.match(scPrefixedBody, /sc:f9d96145/);
  assert.doesNotMatch(scPrefixedBody, /sc:sc-/);
});

test("buildPrefilledGitHubIssueUrl truncates oversized summary cleanly within URL cap", () => {
  const input = {
    area: "runtime",
    summary: "X".repeat(9500),
    userNote: "repro note",
    platform: "web",
    appVersion: "1.14.1",
    fingerprint: "cafe1234",
  };

  const result = buildPrefilledGitHubIssueUrl(input, 1300);
  assert.ok(result.url.startsWith("https://github.com/CAPTCHAAAAA/SillyClient/issues/new?"));
  assert.ok(result.url.length <= 1300);
  assert.equal(result.truncated, true);
  assert.match(result.fullBody, /X{500}/);
});

test("normalizeDiagnosticEndpointUrl validates safe relay origins only", () => {
  assert.equal(normalizeDiagnosticEndpointUrl("https://relay.example.com/report"), "https://relay.example.com/report");
  assert.equal(normalizeDiagnosticEndpointUrl("http://127.0.0.1:8787/report"), "http://127.0.0.1:8787/report");
  assert.equal(normalizeDiagnosticEndpointUrl("/api/report"), "/api/report");
  assert.equal(normalizeDiagnosticEndpointUrl("http://insecure.example.com/report"), null);
  assert.equal(normalizeDiagnosticEndpointUrl("//evil.example.com/report"), null);
  assert.equal(normalizeDiagnosticEndpointUrl("javascript:alert(1)"), null);
});

test("deliverDiagnosticReport routes native -> relay -> local-gh -> github-prefill cleanly", async () => {
  const basePayload = {
    area: "launch",
    stage: "launch",
    summary: "test error summary",
    platform: "web",
    appVersion: "1.14.1",
    fingerprint: "ab12cd34",
  };

  // 1. Native bridge wins when implemented
  const nativeRes = await deliverDiagnosticReport({
    payload: basePayload,
    nativeSubmit: async () => ({
      ok: true,
      reportId: "#99",
      reportUrl: "https://github.com/CAPTCHAAAAA/SillyClient/issues/99",
    }),
    openUrl: async () => {
      throw new Error("Should not openUrl");
    },
  });
  assert.equal(nativeRes.ok, true);
  assert.equal(nativeRes.deliveryMode, "native");
  assert.equal(nativeRes.reportId, "#99");

  // 2. Real native errors (non-UNIMPLEMENTED) propagate instead of bypassing
  await assert.rejects(
    () =>
      deliverDiagnosticReport({
        payload: basePayload,
        nativeSubmit: async () => {
          throw new Error("Disk permission denied");
        },
        openUrl: async () => {},
      }),
    /Disk permission denied/
  );

  // 2b. Windows Electron unknown-method IPC error falls back cleanly to Sentry
  let winSentryUrl = "";
  const winFallbackRes = await deliverDiagnosticReport({
    payload: { ...basePayload, platform: "windows" },
    nativeSubmit: async () => {
      throw new Error("Error invoking remote method 'tarven-env': Error: 未知方法: submitDiagnosticReport");
    },
    configuredSentryDsn: "https://abcdef1234567890abcdef1234567890@o12345.ingest.us.sentry.io/456789",
    storage: null,
    fetchImpl: async (url) => {
      winSentryUrl = String(url);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: "0123456789abcdef0123456789abcdef" }),
      };
    },
    openUrl: async () => {},
  });
  assert.equal(winFallbackRes.deliveryMode, "sentry");
  assert.match(winSentryUrl, /ingest\.us\.sentry\.io\/api\/456789\/envelope/);

  // 3. Configured relay endpoint when native throws UNIMPLEMENTED
  let relayCalledUrl = "";
  let relaySentBody = null;
  const relayRes = await deliverDiagnosticReport({
    payload: basePayload,
    nativeSubmit: async () => {
      const err = new Error("TarvenEnv is not implemented on web");
      err.code = "UNIMPLEMENTED";
      throw err;
    },
    configuredEndpoint: "https://relay.example.com/v1/report",
    storage: null,
    fetchImpl: async (url, init) => {
      relayCalledUrl = String(url);
      relaySentBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            ok: true,
            reportId: "#12",
            reportUrl: "https://github.com/CAPTCHAAAAA/SillyClient/issues/12",
          }),
      };
    },
    openUrl: async () => {},
  });
  assert.equal(relayCalledUrl, "https://relay.example.com/v1/report");
  assert.equal(relaySentBody.repository, "CAPTCHAAAAA/SillyClient");
  assert.equal(relayRes.deliveryMode, "relay");
  assert.equal(relayRes.reportId, "#12");

  // 4. Local Vite dev middleware when isDev=true and native unimplemented
  const devRes = await deliverDiagnosticReport({
    payload: basePayload,
    nativeSubmit: async () => {
      const err = new Error("not implemented on web");
      err.code = "UNIMPLEMENTED";
      throw err;
    },
    isDev: true,
    isNativePlatform: false,
    storage: null,
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          ok: true,
          reportId: "#6",
          reportUrl: "https://github.com/CAPTCHAAAAA/SillyClient/issues/6",
          deliveryMode: "local-gh",
        }),
    }),
    openUrl: async () => {},
  });
  assert.equal(devRes.deliveryMode, "local-gh");
  assert.equal(devRes.reportId, "#6");
  assert.equal(devRes.reportUrl, "https://github.com/CAPTCHAAAAA/SillyClient/issues/6");

  // 5. Dev middleware failure surfaces real error cleanly
  await assert.rejects(
    () =>
      deliverDiagnosticReport({
        payload: basePayload,
        isDev: true,
        isNativePlatform: false,
        storage: null,
        fetchImpl: async () => ({
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ ok: false, error: "gh: HTTP 401 Bad credentials" }),
        }),
        openUrl: async () => {},
      }),
    /HTTP 401 Bad credentials/
  );

  // 6. Production unconfigured fallback copies Markdown & opens prefilled GitHub URL
  let copied = "";
  let opened = "";
  const prefillRes = await deliverDiagnosticReport({
    payload: basePayload,
    isDev: false,
    isNativePlatform: false,
    storage: null,
    copyText: async (text) => {
      copied = text;
    },
    openUrl: async (url) => {
      opened = url;
    },
  });
  assert.equal(prefillRes.deliveryMode, "github-prefill");
  assert.equal(prefillRes.reportId, "GITHUB-DRAFT");
  assert.ok(opened.startsWith("https://github.com/CAPTCHAAAAA/SillyClient/issues/new?"));
  assert.match(copied, /test error summary/);
});

test("formatDiagnosticReportIdDisplay avoids double hashes and labels drafts cleanly", () => {
  assert.equal(formatDiagnosticReportIdDisplay("#6", "local-gh"), "#6");
  assert.equal(formatDiagnosticReportIdDisplay("42", "relay"), "#42");
  assert.equal(formatDiagnosticId("GITHUB-DRAFT", "github-prefill"), "GitHub 预填草稿");
});

function formatDiagnosticId(id, mode) {
  return formatDiagnosticReportIdDisplay(id, mode);
}

test("resolveDiagnosticEndpoints parses comma-separated lists and deduplicates safely", () => {
  const endpoints = resolveDiagnosticEndpoints({
    configuredEndpoint: "https://primary.example.com/report, http://insecure.example.com, https://secondary.example.com/report",
    configuredFallbackEndpoint: "https://secondary.example.com/report, https://backup.example.com/report",
    storage: null,
  });
  assert.deepEqual([...endpoints], [
    "https://primary.example.com/report",
    "https://secondary.example.com/report",
    "https://backup.example.com/report",
  ]);
});

test("deliverDiagnosticReport fails over across configured endpoints on 5xx/network errors but stops on 429", async () => {
  const basePayload = {
    area: "launch",
    stage: "boot",
    summary: "failover verification",
    platform: "android",
    appVersion: "1.14.5",
    fingerprint: "SC-deadcafe",
  };

  const attemptedUrls = [];
  const res = await deliverDiagnosticReport({
    payload: basePayload,
    configuredEndpoint: "https://primary.example.com/report",
    configuredFallbackEndpoint: "https://backup.example.com/report",
    storage: null,
    fetchImpl: async (url) => {
      attemptedUrls.push(String(url));
      if (String(url).includes("primary")) {
        return {
          ok: false,
          status: 502,
          text: async () => JSON.stringify({ ok: false, error: "Upstream transient 502" }),
        };
      }
      return {
        ok: true,
        status: 201,
        text: async () =>
          JSON.stringify({
            ok: true,
            reportId: "#77",
            reportUrl: "https://github.com/CAPTCHAAAAA/SillyClient/issues/77",
          }),
      };
    },
    openUrl: async () => {},
  });

  assert.deepEqual(attemptedUrls, [
    "https://primary.example.com/report",
    "https://backup.example.com/report",
  ]);
  assert.equal(res.deliveryMode, "relay");
  assert.equal(res.reportId, "#77");

  const rateLimitedUrls = [];
  await assert.rejects(
    () =>
      deliverDiagnosticReport({
        payload: basePayload,
        configuredEndpoint: "https://primary.example.com/report",
        configuredFallbackEndpoint: "https://backup.example.com/report",
        storage: null,
        fetchImpl: async (url) => {
          rateLimitedUrls.push(String(url));
          return {
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ ok: false, error: "提交过于频繁，请稍后再试" }),
          };
        },
        openUrl: async () => {},
      }),
    /提交过于频繁/
  );
  assert.deepEqual(rateLimitedUrls, ["https://primary.example.com/report"]);
});

test("openDiagnosticPrefillDraft creates sanitized draft directly as fallback action", async () => {
  let openedUrl = "";
  let copiedBody = "";
  const draft = await openDiagnosticPrefillDraft({
    payload: {
      area: "update",
      summary: "Relay timed out on restricted network",
      userNote: "Tried without proxy",
      platform: "ios",
      appVersion: "1.14.5",
      fingerprint: "SC-12345678",
    },
    copyText: async (text) => {
      copiedBody = text;
    },
    openUrl: async (url) => {
      openedUrl = url;
    },
  });

  assert.equal(draft.ok, true);
  assert.equal(draft.deliveryMode, "github-prefill");
  assert.equal(draft.reportId, "GITHUB-DRAFT");
  assert.ok(openedUrl.startsWith("https://github.com/CAPTCHAAAAA/SillyClient/issues/new?"));
  assert.match(copiedBody, /Tried without proxy/);
});

test("parseSentryDsn and resolveSentryDsn validate public DSNs cleanly", () => {
  const std = parseSentryDsn("https://abcdef1234567890abcdef1234567890@o12345.ingest.us.sentry.io/456789");
  assert.ok(std);
  assert.equal(
    std.envelopeUrl,
    "https://o12345.ingest.us.sentry.io/api/456789/envelope/?sentry_key=abcdef1234567890abcdef1234567890&sentry_version=7"
  );

  const prefixed = parseSentryDsn("https://pub12345678@sentry.example.com/subpath/42/");
  assert.ok(prefixed);
  assert.equal(
    prefixed.envelopeUrl,
    "https://sentry.example.com/subpath/api/42/envelope/?sentry_key=pub12345678&sentry_version=7"
  );

  assert.ok(parseSentryDsn("http://pub12345678@127.0.0.1:9999/7"));
  assert.equal(parseSentryDsn(""), null);
  assert.equal(parseSentryDsn("http://pub12345678@o1.ingest.sentry.io/1"), null);
  assert.equal(parseSentryDsn("https://pub12345678:secretpass@o1.ingest.sentry.io/1"), null);
  assert.equal(parseSentryDsn("https://pub12345678@o1.ingest.sentry.io/not-a-number"), null);

  const storage = {
    getItem: (key) =>
      key === SENTRY_DSN_STORAGE_KEY ? "https://storedkey1@o9.ingest.sentry.io/99" : null,
  };
  assert.equal(
    resolveSentryDsn({
      configuredSentryDsn: "https://buildkey1@o1.ingest.sentry.io/1",
      storage,
    }).projectId,
    "99"
  );
  assert.equal(
    resolveSentryDsn({
      sentryDsnOverride: "https://override1@o2.ingest.sentry.io/2",
      configuredSentryDsn: "https://buildkey1@o1.ingest.sentry.io/1",
      storage,
    }).projectId,
    "2"
  );
  assert.throws(
    () => resolveSentryDsn({ configuredSentryDsn: "https://invalid-dsn-without-project" }),
    /Sentry DSN 配置格式无效/
  );
});

test("buildSentryEventEnvelope computes exact UTF-8 byte lengths and avoids leaking PII", () => {
  const dsn = parseSentryDsn("https://pub12345678@o1.ingest.us.sentry.io/123");
  const eventId = "0123456789abcdef0123456789abcdef";
  const envelope = buildSentryEventEnvelope(
    {
      area: "launch",
      stage: "spawn-node",
      errorCode: "E_SPAWN",
      summary: "中文报错信息：启动实例失败（已脱敏路径）",
      userNote: "点击启动按钮后卡住",
      platform: "android",
      appVersion: "1.14.0",
      fingerprint: "sc-launch01",
    },
    {
      dsn,
      eventId,
      nowMs: 1700000000000,
      areaLabel: "启动",
    }
  );

  const lines = envelope.trimEnd().split("\n");
  assert.equal(lines.length, 3);
  const envelopeHeader = JSON.parse(lines[0]);
  const itemHeader = JSON.parse(lines[1]);
  const payload = JSON.parse(lines[2]);

  assert.equal(envelopeHeader.event_id, eventId);
  assert.equal(itemHeader.type, "event");
  assert.equal(itemHeader.length, Buffer.byteLength(lines[2], "utf8"));
  assert.equal(payload.tags.area_label, "启动");
  assert.equal(payload.release, "sillyclient@1.14.0");
  assert.equal(payload.user, undefined);
  assert.equal(payload.request, undefined);
  assert.equal(payload.extra.user_note, "点击启动按钮后卡住");

  const feedbackEnvelope = buildSentryFeedbackEnvelope(
    {
      area: "launch",
      summary: "中文报错信息",
      userNote: "每次必现",
      platform: "android",
      appVersion: "1.14.0",
    },
    {
      dsn,
      feedbackEventId: "fedcba9876543210fedcba9876543210",
      associatedEventId: eventId,
      nowMs: 1700000000000,
      areaLabel: "启动",
    }
  );
  const fbLines = feedbackEnvelope.trimEnd().split("\n");
  assert.equal(fbLines.length, 3);
  const fbHeader = JSON.parse(fbLines[1]);
  const fbPayload = JSON.parse(fbLines[2]);
  assert.equal(fbHeader.type, "feedback");
  assert.equal(fbHeader.length, Buffer.byteLength(fbLines[2], "utf8"));
  assert.equal(fbPayload.contexts.feedback.associated_event_id, eventId);
  assert.equal(fbPayload.contexts.feedback.message, "每次必现");
});

test("deliverDiagnosticReport sends CORS-simple Sentry envelopes and surfaces proxy hint on network failures", async () => {
  const requests = [];
  const serverId = "aabbccdd11223344556677889900aabb";
  const result = await deliverDiagnosticReport({
    payload: {
      area: "create",
      stage: "download",
      errorCode: "ETIMEDOUT",
      summary: "Download failed with Bearer my-secret-token-value",
      userNote: "开着代理也复现了一次",
      platform: "windows",
      appVersion: "1.14.0",
    },
    configuredSentryDsn: "https://pub12345678@o42.ingest.us.sentry.io/777",
    storage: null,
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: serverId }),
      };
    },
    openUrl: async () => {
      throw new Error("Should not open browser when Sentry succeeds");
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.deliveryMode, "sentry");
  assert.equal(result.reportId, "SC-AABBCCDD");
  assert.equal(result.reportUrl, undefined);
  assert.equal(formatDiagnosticReportIdDisplay(result.reportId, result.deliveryMode), "SC-AABBCCDD");
  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].url,
    "https://o42.ingest.us.sentry.io/api/777/envelope/?sentry_key=pub12345678&sentry_version=7"
  );
  // No custom headers -> browser chooses CORS-simple text/plain;charset=UTF-8.
  assert.equal(requests[0].init.headers, undefined);
  assert.doesNotMatch(String(requests[0].init.body), /my-secret-token-value/);
  const fbPayload = JSON.parse(String(requests[1].init.body).trimEnd().split("\n")[2]);
  assert.equal(fbPayload.contexts.feedback.associated_event_id, serverId);

  // If network / VPN is missing, fail cleanly with proxy guidance so UI offers "打开草稿".
  await assert.rejects(
    () =>
      deliverDiagnosticReport({
        payload: {
          area: "update",
          summary: "Network unreachable",
          platform: "android",
          appVersion: "1.14.0",
        },
        configuredSentryDsn: "https://pub12345678@o42.ingest.us.sentry.io/777",
        storage: null,
        fetchImpl: async () => {
          throw new TypeError("Failed to fetch");
        },
        openUrl: async () => {},
      }),
    /代理\/梯子.*打开草稿/
  );
});

test("real HTTP loopback fetch sends valid byte-accurate multi-byte Sentry envelopes", async (t) => {
  const received = [];
  const serverId = "1234567890abcdef1234567890abcdef";
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      received.push({
        method: req.method,
        url: req.url,
        contentType: req.headers["content-type"],
        rawBody: Buffer.concat(chunks),
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: serverId }));
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const res = await deliverDiagnosticReport({
    payload: {
      area: "runtime",
      stage: "download-zip",
      errorCode: "ETIMEDOUT",
      summary: "下载归档超时：请开启代理后重试 — UTF-8 多字节校验 🚀",
      userNote: "补充说明：开启本地代理后需要手动重试",
      platform: "ios",
      appVersion: "1.14.0",
    },
    configuredSentryDsn: `http://pub12345678@127.0.0.1:${address.port}/987654`,
    storage: null,
    fetchImpl: fetch,
    openUrl: async () => {},
  });

  assert.equal(res.deliveryMode, "sentry");
  assert.equal(res.reportId, "SC-12345678");
  assert.equal(received.length, 2);

  for (const req of received) {
    assert.equal(req.method, "POST");
    assert.equal(
      req.url,
      "/api/987654/envelope/?sentry_key=pub12345678&sentry_version=7"
    );
    assert.match(String(req.contentType || ""), /^text\/plain/i);

    const firstNl = req.rawBody.indexOf(0x0a);
    const secondNl = req.rawBody.indexOf(0x0a, firstNl + 1);
    assert.ok(firstNl > 0 && secondNl > firstNl);
    const itemHeader = JSON.parse(req.rawBody.subarray(firstNl + 1, secondNl).toString("utf8"));
    const payloadSlice = req.rawBody.subarray(
      secondNl + 1,
      secondNl + 1 + itemHeader.length
    );
    assert.equal(payloadSlice.byteLength, itemHeader.length);
    // Exact Relay-style byte slice must yield complete, valid JSON without truncation.
    const parsedPayload = JSON.parse(payloadSlice.toString("utf8"));
    assert.ok(parsedPayload.event_id);
  }
});

test("deliverDiagnosticReport accepts zero-code Pipedream default HTML ack and { success: true } JSON while rejecting portal HTML", async () => {
  const pipedreamDefault = await deliverDiagnosticReport({
    payload: {
      area: "settings",
      summary: "Zero-code Pipedream webhook test",
      platform: "windows",
      appVersion: "1.14.0",
    },
    configuredEndpoint: "https://eo12345.m.pipedream.net",
    storage: null,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () => "<p><b>Success!</b></p><p>To customize this response, check out our docs</p>",
    }),
    openUrl: async () => {},
  });
  assert.equal(pipedreamDefault.ok, true);
  assert.equal(pipedreamDefault.deliveryMode, "relay");
  assert.equal(pipedreamDefault.reportId, "SC-QUEUED");

  const pipedreamJson = await deliverDiagnosticReport({
    payload: {
      area: "settings",
      summary: "Pipedream custom JSON test",
      platform: "android",
      appVersion: "1.14.0",
    },
    configuredEndpoint: "https://eo12345.m.pipedream.net",
    storage: null,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          success: true,
          number: 188,
          html_url: "https://github.com/CAPTCHAAAAA/SillyClient/issues/188",
        }),
    }),
    openUrl: async () => {},
  });
  assert.equal(pipedreamJson.ok, true);
  assert.equal(pipedreamJson.reportId, "#188");
  assert.equal(pipedreamJson.reportUrl, "https://github.com/CAPTCHAAAAA/SillyClient/issues/188");

  await assert.rejects(
    () =>
      deliverDiagnosticReport({
        payload: {
          area: "settings",
          summary: "Captive portal rejection test",
          platform: "windows",
          appVersion: "1.14.0",
        },
        configuredEndpoint: "https://eo12345.m.pipedream.net",
        storage: null,
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          text: async () => "<!doctype html><html><body>Wi-Fi Login Portal</body></html>",
        }),
        openUrl: async () => {},
      }),
    /HTTP 200/
  );
});
