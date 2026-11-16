const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test } = require("node:test");

const workerUrl = pathToFileURL(
  path.join(__dirname, "..", "relay", "cloudflare-worker.js")
).href;
const middlewareUrl = pathToFileURL(
  path.join(__dirname, "..", "vite-diagnostic-middleware.mjs")
).href;

function createMemoryCache() {
  const store = new Map();
  return {
    async match(key) {
      const entry = store.get(String(key));
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(String(key));
        return null;
      }
      return new Response(entry.body, { headers: entry.headers });
    },
    async put(key, response) {
      const cc = response.headers.get("Cache-Control") || "";
      const match = /max-age=(\d+)/i.exec(cc);
      const ttlMs = (match ? Number(match[1]) : 60) * 1000;
      const body = await response.text();
      store.set(String(key), {
        body,
        headers: Object.fromEntries(response.headers.entries()),
        expiresAt: Date.now() + ttlMs,
      });
    },
  };
}

function makeWirePayload(overrides = {}) {
  const { report: reportOverrides, ...topOverrides } = overrides;
  return {
    schemaVersion: 1,
    repository: "CAPTCHAAAAA/SillyClient",
    title: "forged title [phishing](https://evil.example)",
    body: "forged body @admin <script>alert(1)</script>",
    commentBody: "forged comment",
    report: {
      area: "launch",
      stage: "boot",
      errorCode: "E_PORT_BUSY",
      summary: "Bearer topsecret-123 failed at C:\\Users\\Alice\\Tavern",
      userNote: "Check [click](https://evil.example) @maintainer <img src=x> ```break```",
      platform: "windows",
      appVersion: "1.14.5",
      elapsedMs: 320,
      fingerprint: "SC-a1b2c3d4",
      ...(reportOverrides || {}),
    },
    ...topOverrides,
  };
}

test("Cloudflare Worker responds to /health and enforces allowed CORS origins", async () => {
  const { handleDiagnosticRelayRequest } = await import(workerUrl);

  const healthRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/health", {
      method: "GET",
      headers: { Origin: "capacitor://localhost" },
    }),
    { ALLOWED_ORIGIN: "capacitor://localhost,https://localhost,app://-" }
  );
  assert.equal(healthRes.status, 200);
  const healthJson = await healthRes.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.repository, "CAPTCHAAAAA/SillyClient");
  assert.equal(healthRes.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");

  const blockedRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
      body: JSON.stringify(makeWirePayload()),
    }),
    {
      GITHUB_TOKEN: "github_pat_dummy",
      ALLOWED_ORIGIN: "capacitor://localhost,https://localhost,app://-",
    }
  );
  assert.equal(blockedRes.status, 403);
});

test("Cloudflare Worker renders server-side sanitized Markdown and blocks injected client markup", async () => {
  const { handleDiagnosticRelayRequest } = await import(workerUrl);
  const createdBodies = [];

  const fetchMock = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/issues?state=open")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (target.includes("/search/issues?")) {
      return new Response(JSON.stringify({ total_count: 0, items: [] }), { status: 200 });
    }
    if (target.endsWith("/issues") && init.method === "POST") {
      const payload = JSON.parse(init.body);
      createdBodies.push(payload);
      return new Response(
        JSON.stringify({
          number: 88,
          html_url: "https://github.com/CAPTCHAAAAA/SillyClient/issues/88",
        }),
        { status: 201 }
      );
    }
    throw new Error(`Unexpected fetch URL: ${target}`);
  };

  const res = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: {
        Origin: "https://localhost",
        "Content-Type": "application/json",
        "CF-Connecting-IP": "203.0.113.10",
      },
      body: JSON.stringify(makeWirePayload()),
    }),
    { GITHUB_TOKEN: "github_pat_test_secret_value", CACHE: createMemoryCache() },
    { fetchImpl: fetchMock }
  );

  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.reportId, "#88");
  assert.equal(json.deliveryMode, "relay");
  assert.equal(json.deduplicated, false);

  assert.equal(createdBodies.length, 1);
  const posted = createdBodies[0];
  assert.match(posted.title, /^\[异常反馈\]\[启动\] /);
  assert.doesNotMatch(posted.title + posted.body, /forged title|forged body/);
  assert.doesNotMatch(posted.title + posted.body, /topsecret-123|C:\\Users\\Alice|evil\.example|<img|<script/);
  assert.doesNotMatch(posted.body, /@maintainer/);
  assert.match(posted.body, /sc:a1b2c3d4/);
});

test("Cloudflare Worker deduplicates via Search API beyond recent 30 issues and ignores PRs", async () => {
  const { handleDiagnosticRelayRequest } = await import(workerUrl);
  let postedCommentUrl = "";

  const fetchMock = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/issues?state=open")) {
      return new Response(
        JSON.stringify([
          {
            number: 100,
            pull_request: { url: "https://api.github.com/pulls/100" },
            html_url: "https://github.com/CAPTCHAAAAA/SillyClient/pull/100",
            body: "<!-- sillyclient-diagnostic: fingerprint=sc-a1b2c3d4 area=launch --> sc:a1b2c3d4",
          },
        ]),
        { status: 200 }
      );
    }
    if (target.includes("/search/issues?")) {
      return new Response(
        JSON.stringify({
          total_count: 1,
          items: [
            {
              number: 12,
              html_url: "https://github.com/CAPTCHAAAAA/SillyClient/issues/12",
              body: "<!-- sillyclient-diagnostic: fingerprint=sc-a1b2c3d4 tag=sc:a1b2c3d4 area=launch -->",
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (target.endsWith("/issues/12/comments") && init.method === "POST") {
      postedCommentUrl = target;
      return new Response(JSON.stringify({ id: 999 }), { status: 201 });
    }
    throw new Error(`Unexpected fetch URL: ${target}`);
  };

  const res = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.20" },
      body: JSON.stringify(makeWirePayload()),
    }),
    { GITHUB_TOKEN: "github_pat_test_secret_value", CACHE: createMemoryCache() },
    { fetchImpl: fetchMock }
  );

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.reportId, "#12");
  assert.equal(json.deduplicated, true);
  assert.match(postedCommentUrl, /\/issues\/12\/comments$/);
});

test("Cloudflare Worker suppresses same-IP fingerprint bursts and enforces hourly rate limit", async () => {
  const { handleDiagnosticRelayRequest } = await import(workerUrl);
  const sharedCache = createMemoryCache();
  let githubPostCount = 0;

  const fetchMock = async (url, init = {}) => {
    const target = String(url);
    if (target.includes("/issues?state=open")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (target.includes("/search/issues?")) {
      return new Response(JSON.stringify({ total_count: 0, items: [] }), { status: 200 });
    }
    if (target.endsWith("/issues") && init.method === "POST") {
      githubPostCount += 1;
      return new Response(
        JSON.stringify({
          number: 50 + githubPostCount,
          html_url: `https://github.com/CAPTCHAAAAA/SillyClient/issues/${50 + githubPostCount}`,
        }),
        { status: 201 }
      );
    }
    throw new Error(`Unexpected fetch URL: ${target}`);
  };

  const env = {
    GITHUB_TOKEN: "github_pat_test_secret_value",
    CACHE: sharedCache,
    RATE_LIMIT_MAX_PER_HOUR: "2",
    FINGERPRINT_COOLDOWN_SECONDS: "600",
  };

  // First submission creates #51
  const firstRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify(makeWirePayload()),
    }),
    env,
    { fetchImpl: fetchMock }
  );
  assert.equal(firstRes.status, 201);

  // Repeat of identical fingerprint from same IP hits cooldown with 0 GitHub API calls
  const repeatRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify(makeWirePayload()),
    }),
    env,
    { fetchImpl: fetchMock }
  );
  assert.equal(repeatRes.status, 200);
  const repeatJson = await repeatRes.json();
  assert.equal(repeatJson.reportId, "#51");
  assert.equal(repeatJson.suppressedDuplicate, true);
  assert.equal(githubPostCount, 1);

  // Second distinct fingerprint counts as #2 in hourly limit -> succeeds
  const secondRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify(
        makeWirePayload({ report: { fingerprint: "SC-99998888", summary: "Second error" } })
      ),
    }),
    env,
    { fetchImpl: fetchMock }
  );
  assert.equal(secondRes.status, 201);
  assert.equal(githubPostCount, 2);

  // Third distinct fingerprint exceeds RATE_LIMIT_MAX_PER_HOUR=2 -> 429
  const limitedRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.30" },
      body: JSON.stringify(
        makeWirePayload({ report: { fingerprint: "SC-77776666", summary: "Third error" } })
      ),
    }),
    env,
    { fetchImpl: fetchMock }
  );
  assert.equal(limitedRes.status, 429);
  assert.ok(Number(limitedRes.headers.get("Retry-After")) >= 1);
});

test("Cloudflare Worker rejects oversized UTF-8 payloads and redacts secrets on errors", async () => {
  const { handleDiagnosticRelayRequest } = await import(workerUrl);

  const oversized = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "中".repeat(25000) }),
    }),
    { GITHUB_TOKEN: "github_pat_test" }
  );
  assert.equal(oversized.status, 413);

  const errorRes = await handleDiagnosticRelayRequest(
    new Request("https://relay.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeWirePayload()),
    }),
    { GITHUB_TOKEN: "github_pat_secret_123456789" },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({ message: "Bad token github_pat_secret_123456789" }),
          { status: 401 }
        ),
    }
  );
  assert.equal(errorRes.status, 502);
  const errJson = await errorRes.json();
  assert.doesNotMatch(errJson.error, /github_pat_secret_123456789/);
});

test("Vite local dev middleware deduplicates safely via injected ghApi helper", async () => {
  const { submitToGitHubViaGh } = await import(middlewareUrl);
  const calls = [];

  const res = await submitToGitHubViaGh(makeWirePayload(), async (endpoint, options = {}) => {
    calls.push({ endpoint, method: options.method || "GET", body: options.inputJson });
    if (endpoint.includes("issues?state=open")) {
      return [];
    }
    if (endpoint.startsWith("search/issues?")) {
      return {
        items: [
          {
            number: 42,
            html_url: "https://github.com/CAPTCHAAAAA/SillyClient/issues/42",
            body: "<!-- sillyclient-diagnostic: fingerprint=sc-a1b2c3d4 area=launch -->",
          },
        ],
      };
    }
    if (endpoint.endsWith("issues/42/comments")) {
      return { id: 1001 };
    }
    throw new Error(`Unexpected gh api endpoint: ${endpoint}`);
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.reportId, "#42");
  assert.equal(res.deliveryMode, "local-gh");
  assert.equal(res.deduplicated, true);
  assert.ok(calls.some((c) => c.endpoint.endsWith("issues/42/comments")));
});
