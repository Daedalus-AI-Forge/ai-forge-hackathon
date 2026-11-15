/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api } from "./_generated/api";
import { endingRoute, endingStory } from "./link";
import { escapeHtml, funnel, ogHtml } from "./linkMetrics";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => convexTest(schema, modules);

async function seedChain(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("users", { name: "Mia", avatar: "#000", city: "SF", wishesLeft: 1, stars: 0 });
    const wishId = await ctx.db.insert("wishes", {
      creatorId,
      type: "local",
      text: "<script>alert(1)</script> & a guide",
      status: "found",
      expiresAt: Date.now() + 1000,
    });
    const h1 = await ctx.db.insert("hops", {
      wishId, depth: 1, holderName: "Ann", city: "SF", recipientTags: [], viaGroup: false, action: "pass",
    });
    const h2 = await ctx.db.insert("hops", {
      wishId, parentHopId: h1, depth: 2, holderName: "Ben", city: "SF", recipientTags: [], viaGroup: false,
      action: "pass", introVouch: 'Ben "knows" <everyone>',
    });
    const h3 = await ctx.db.insert("hops", {
      wishId, parentHopId: h2, depth: 3, holderName: "Cy", city: "Tokyo", recipientTags: [], viaGroup: false,
      action: "its_me",
    });
    return { wishId, h1, h2, h3 };
  });
}

describe("funnel math", () => {
  test("counts, completed = claim + push, split rates, divide-by-zero → 0", () => {
    expect(funnel([])).toEqual({
      opened: 0, wroteWish: 0, skipped: 0, completed: 0, leftContact: 0, downloadClicks: 0,
      completionRate: 0, completionRateWish: 0, completionRateSkip: 0,
    });
    const m = funnel([
      { event: "open" }, { event: "open" }, { event: "open" }, { event: "open" },
      { event: "wish_written" }, { event: "wish_written" },
      { event: "skip_wish" }, { event: "skip_wish" },
      { event: "claim", wroteWish: true },
      { event: "push", wroteWish: true },
      { event: "push", wroteWish: false },
      { event: "contact" }, { event: "download_click" },
    ]);
    expect(m.opened).toBe(4);
    expect(m.completed).toBe(3);
    expect(m.completionRate).toBe(0.75);
    expect(m.completionRateWish).toBe(1);
    expect(m.completionRateSkip).toBe(0.5);
    expect(m.leftContact).toBe(1);
    expect(m.downloadClicks).toBe(1);
  });

  test("track + metrics end to end", async () => {
    const t = setup();
    const deviceId = "device-abc";
    await t.mutation(api.linkMetrics.track, { deviceId, event: "open" });
    await t.mutation(api.linkMetrics.track, { deviceId, event: "open" });
    await t.mutation(api.linkMetrics.track, { deviceId, event: "skip_wish" });
    await t.mutation(api.linkMetrics.track, { deviceId, event: "push", wroteWish: false });
    const m = await t.query(api.linkMetrics.metrics, {});
    expect(m).toMatchObject({ opened: 2, skipped: 1, completed: 1, completionRate: 0.5, completionRateSkip: 1, completionRateWish: 0 });
    const rows = await t.run((ctx) => ctx.db.query("linkEvents").collect());
    expect(rows.every((r) => typeof r.at === "number")).toBe(true);
  });

  test("track rejects a bad device id", async () => {
    const t = setup();
    await expect(t.mutation(api.linkMetrics.track, { deviceId: "x", event: "open" })).rejects.toThrow("Invalid device id");
  });
});

describe("OG HTML", () => {
  test("escapes wish text and vouch", () => {
    const html = ogHtml(
      { hopId: "abc", senderName: "Ann", introVouch: 'Ben "knows" <everyone>', wishText: "<script>alert(1)</script>" },
      "https://app.example/",
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain('content="Ann: Ben &quot;knows&quot; &lt;everyone&gt;"');
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=https://app.example/l/abc">');
    expect(html).toContain('og:image" content="https://app.example/og-cover.jpg"');
    expect(html).toContain("twitter:card");
    expect(escapeHtml(`'&`)).toBe("&#39;&amp;");
  });

  test("clips a long vouch to 50 chars in the title and keeps the brand out", () => {
    const vouch = "You know every single drummer in the whole East Bay and half of SF too";
    const html = ogHtml({ hopId: "abc", senderName: "Louise", introVouch: vouch, wishText: "drums" }, undefined);
    const title = /og:title" content="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(title.startsWith("Louise: You know every single drummer")).toBe(true);
    expect(title.length).toBeLessThanOrEqual("Louise: ".length + 50);
    expect(title).not.toMatch(/wishwell/i);
  });

  test("default title without vouch, no image without APP_WEB_URL", () => {
    const html = ogHtml({ hopId: "abc", senderName: "Ann", introVouch: null, wishText: "hi" }, undefined);
    expect(html).toContain('og:title" content="Ann thought of you for a wish"');
    expect(html).not.toContain("og:image");
  });

  test("HTTP route serves the hop and 404s when missing", async () => {
    const t = setup();
    const { h2 } = await seedChain(t);
    const ok = await t.fetch(`/og/w/${h2}`, { method: "GET" });
    expect(ok.status).toBe(200);
    const body = await ok.text();
    expect(body).toContain("Ann: Ben &quot;knows&quot; &lt;everyone&gt;");
    expect(body).not.toContain("<script>");
    const missing = await t.fetch("/og/w/not-a-hop", { method: "GET" });
    expect(missing.status).toBe(404);
  });
});

describe("ending", () => {
  test("route dedupes consecutive cities in depth order, story is two sentences", async () => {
    const t = setup();
    const { wishId } = await seedChain(t);
    const view = await t.query(api.link.ending, { wishId });
    expect(view).toMatchObject({ status: "found", route: ["SF", "Tokyo"], ripples: 3, photoUrl: null });
    expect(view?.story.split(/(?<=\.)\s/).length).toBe(2);
    expect(await t.query(api.link.ending, { wishId: "nope" })).toBeNull();
  });

  test("helpers", () => {
    expect(endingRoute([
      { depth: 2, city: "LA", _creationTime: 2 }, { depth: 1, city: "SF", _creationTime: 1 },
      { depth: 3, city: "LA", _creationTime: 3 }, { depth: 4, _creationTime: 4 },
    ])).toEqual(["SF", "LA"]);
    expect(endingStory("traveling", [], 1)).toContain("1 pair of hands");
  });
});
