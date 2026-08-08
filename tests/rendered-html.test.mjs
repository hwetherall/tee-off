import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Bulldogs Golf Day app", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Bulldogs Golf Day<\/title>/i);
  assert.match(html, /Live scoring, on-course fundraising, photos and clubhouse views/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/i);
});

test("contains the workbook roster as eight four-person groups", async () => {
  const { GOLFER_ROSTER, TEAM_CONFIGURATION } = await import("../src/data/roster.ts");
  assert.equal(TEAM_CONFIGURATION.length, 8);
  assert.equal(GOLFER_ROSTER.length, 32);

  for (const { group } of TEAM_CONFIGURATION) {
    assert.equal(GOLFER_ROSTER.filter((golfer) => golfer.group === group).length, 4);
  }
  assert.equal(
    GOLFER_ROSTER.filter((golfer) => golfer.firstName === "Mark" && golfer.lastName === "Clifton").length,
    4,
  );
  assert.ok(GOLFER_ROSTER.every((golfer) => !/Golfer|TBD/i.test(`${golfer.firstName} ${golfer.lastName}`)));
});

test("starts with no fabricated day-of activity and invalidates the old demo cache", async () => {
  const [eventData, localFirst, app] = await Promise.all([
    readFile(new URL("../src/data/demo.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/local-first.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/GolfDayApp.tsx", import.meta.url), "utf8"),
  ]);

  for (const collection of ["SCORES", "CLAIMS", "ORDERS", "ENVELOPES", "TICKETS", "MULLIGAN_USES"]) {
    assert.match(eventData, new RegExp(`export const INITIAL_${collection}[^=]*= \\[\\];`));
  }
  assert.match(localFirst, /bulldogs-golf-day-v3/);
  assert.doesNotMatch(localFirst, /DEMO_STATE|DEMO_TEAMS/);
  assert.doesNotMatch(app, /Demo codes|className="demo-code"/);
});

test("validates Banana Splits beneficiaries against the purchasing team", async () => {
  const { checkoutBeneficiaryValid, validateCheckoutLines } = await import("../src/lib/shop.ts");

  const teamSplit = validateCheckoutLines([
    { productId: "splits", qty: 2, beneficiaryType: "team", beneficiaryPlayerId: null },
  ]);
  const playerSplit = validateCheckoutLines([
    { productId: "splits", qty: 1, beneficiaryType: "player", beneficiaryPlayerId: "team-1-p2" },
  ]);

  assert.ok(teamSplit);
  assert.ok(playerSplit);
  assert.equal(checkoutBeneficiaryValid(teamSplit, "team-1"), true);
  assert.equal(checkoutBeneficiaryValid(playerSplit, "team-1"), true);
  assert.equal(checkoutBeneficiaryValid(playerSplit, "team-2"), false);
  assert.equal(checkoutBeneficiaryValid([
    { productId: "splits", qty: 1, beneficiaryType: "player", beneficiaryPlayerId: "team-1-p99" },
  ], "team-1"), false);
  assert.equal(validateCheckoutLines([{ productId: "splits", qty: 1 }]), null);
});

test("models prize players and one-use physical strings in the live schema", async () => {
  const [schema, app] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/GolfDayApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /claims drop constraint if exists claims_contest_id_key/i);
  assert.match(schema, /player_id text/i);
  assert.match(schema, /collected_at timestamptz/i);
  assert.match(schema, /used_at timestamptz/i);
  assert.match(schema, /beneficiary_type text/i);
  assert.match(schema, /create table if not exists public\.mulligan_uses/i);

  assert.match(app, /Each string may be used only once/);
  assert.match(app, /Yes, burn this string/);
  assert.doesNotMatch(app, /How much was cut\?|stringAmount/);
});
