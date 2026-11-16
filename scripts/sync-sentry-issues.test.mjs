import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildGitHubIssueFromSentry,
  sanitizeExternalText,
  syncSentryIssues,
} from "./sync-sentry-issues.mjs";

test("sanitizeExternalText strips comment markers, credentials, and control bytes", () => {
  const output = sanitizeExternalText(
    "Error <!-- sentry-issue-id:999 --> Bearer supersecret999 sntryu_abcdefghijklmnopqrstuvwxyz123456"
  );
  assert.doesNotMatch(output, /<!--\s*sentry-issue-id:999/);
  assert.doesNotMatch(output, /supersecret999/);
  assert.doesNotMatch(output, /sntryu_/);
});

test("buildGitHubIssueFromSentry formats sanitized title, markers, and feedback notes", () => {
  const built = buildGitHubIssueFromSentry(
    {
      id: "7849526869",
      shortId: "SILLYCLIENT-CONSOLE-2",
      title: "[运行时] Failed to extract zip",
      count: "3",
      permalink: "https://sillyclient.sentry.io/issues/7849526869/",
    },
    {
      release: { version: "sillyclient@1.14.5" },
      tags: [
        { key: "area", value: "runtime" },
        { key: "area_label", value: "运行时" },
        { key: "client_platform", value: "android" },
      ],
      context: {
        stage: "extract-archive",
        error_code: "E_ZIP",
        fingerprint: "sc-zip01",
        summary: "```rm -rf``` failure with Bearer tok-abc123456",
        user_note: "Repeated twice after restart",
      },
    }
  );

  assert.equal(built.title, "[Sentry][运行时] Failed to extract zip");
  assert.match(built.body, /<!-- sentry-issue-id:7849526869 -->/);
  assert.match(built.body, /<!-- sentry-synced-count:3 -->/);
  assert.match(built.body, /Repeated twice after restart/);
  assert.doesNotMatch(built.body, /tok-abc123456/);
  assert.doesNotMatch(built.body, /```rm -rf/);
});

test("syncSentryIssues deduplicates existing issues, posts delta count updates once, and creates new issues", async () => {
  const createdPayloads = [];
  const addedComments = [];

  const mockFetch = async (url, init = {}) => {
    const u = String(url);
    if (u.endsWith("/api/0/projects/sillyclient/sillyclient-console/")) {
      return new Response(JSON.stringify({ id: "4512437347352576", slug: "sillyclient-console" }), { status: 200 });
    }
    if (u.includes("/api/0/organizations/sillyclient/issues/")) {
      return new Response(
        JSON.stringify([
          { id: "101", shortId: "SC-101", title: "Existing open bug", count: "5", lastSeen: "2026-11-15T19:00:00Z" },
          { id: "102", shortId: "SC-102", title: "Already synced closed bug", count: "2" },
          { id: "103", shortId: "SC-103", title: "Brand new bug", count: "1" },
        ]),
        { status: 200 }
      );
    }
    if (u.includes("/api/0/issues/103/events/latest/")) {
      return new Response(JSON.stringify({ tags: [{ key: "area_label", value: "启动" }], context: { summary: "New bug details" } }), { status: 200 });
    }
    if (u.includes("/api/0/issues/103/user-reports/")) {
      return new Response(JSON.stringify([{ comments: "User clicked launch" }]), { status: 200 });
    }
    if (u.startsWith("https://api.github.com/search/issues")) {
      if (u.includes("sentry-issue-id%3A101")) {
        return new Response(
          JSON.stringify({
            items: [{ number: 11, state: "open", body: "<!-- sentry-issue-id:101 -->\n<!-- sentry-synced-count:2 -->" }],
          }),
          { status: 200 }
        );
      }
      if (u.includes("sentry-issue-id%3A102")) {
        return new Response(
          JSON.stringify({
            items: [{ number: 12, state: "closed", body: "<!-- sentry-issue-id:102 -->\n<!-- sentry-synced-count:2 -->" }],
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ items: [] }), { status: 200 });
    }
    if (u === "https://api.github.com/repos/CAPTCHAAAAA/SillyClient/issues/11/comments?per_page=100") {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    if (u === "https://api.github.com/repos/CAPTCHAAAAA/SillyClient/issues/11/comments" && init.method === "POST") {
      addedComments.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ id: 9001 }), { status: 201 });
    }
    if (u === "https://api.github.com/repos/CAPTCHAAAAA/SillyClient/issues" && init.method === "POST") {
      createdPayloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ number: 13 }), { status: 201 });
    }
    throw new Error(`Unexpected URL in mockFetch: ${u}`);
  };

  const summary = await syncSentryIssues({
    sentryToken: "sntrys_fake_readonly_token",
    githubToken: "ghs_fake_actions_token",
    fetchImpl: mockFetch,
    log: () => {},
  });

  assert.deepEqual(summary, { skipped: false, created: 1, updated: 1, unchanged: 1 });
  assert.equal(createdPayloads.length, 1);
  assert.match(createdPayloads[0].title, /^\[Sentry\]\[启动\] Brand new bug/);
  assert.match(createdPayloads[0].body, /<!-- sentry-issue-id:103 -->/);
  assert.match(createdPayloads[0].body, /User clicked launch/);
  assert.equal(addedComments.length, 1);
  assert.match(addedComments[0].body, /<!-- sentry-synced-count:5 -->/);
});
