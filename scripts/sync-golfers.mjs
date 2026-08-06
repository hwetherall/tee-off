import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_WORKBOOK = "V2 Golfers - Denver Bulldogs Group Aug 8.xlsx";
const TEAM_CONFIGURATION = new Map([
  [1, { startHole: 1, accessCode: "1842" }],
  [2, { startHole: 3, accessCode: "2715" }],
  [3, { startHole: 5, accessCode: "3168" }],
  [4, { startHole: 7, accessCode: "4093" }],
  [5, { startHole: 9, accessCode: "5581" }],
  [6, { startHole: 11, accessCode: "6027" }],
  [7, { startHole: 13, accessCode: "7344" }],
  [8, { startHole: 15, accessCode: "8621" }],
]);

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function elementText(xml) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1]))
    .join("");
}

function unzipText(workbookPath, entry) {
  return execFileSync("unzip", ["-p", workbookPath, entry], { encoding: "utf8" });
}

function parseWorkbook(workbookPath) {
  const sharedStringsXml = unzipText(workbookPath, "xl/sharedStrings.xml");
  const sheetXml = unzipText(workbookPath, "xl/worksheets/sheet1.xml");
  const sharedStrings = [...sharedStringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => elementText(match[1]));
  const cells = new Map();

  for (const match of sheetXml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = match[1];
    const body = match[2] ?? "";
    const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!reference) continue;
    const type = attributes.match(/\bt="([^"]+)"/)?.[1];
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    let value = "";
    if (type === "s" && raw !== undefined) value = sharedStrings[Number(raw)] ?? "";
    else if (type === "inlineStr") value = elementText(body);
    else if (raw !== undefined) value = decodeXml(raw);
    cells.set(reference, value.trim());
  }

  const headers = [cells.get("A1"), cells.get("B1"), cells.get("C1")];
  if (headers.join("|") !== "Group|First|Last") {
    throw new Error(`Unexpected Sheet1 headers: ${headers.join(", ")}`);
  }

  const golfers = [];
  let group = null;
  for (let row = 2; row <= 33; row += 1) {
    const groupCell = cells.get(`A${row}`);
    if (groupCell) group = Number(groupCell);
    const firstName = cells.get(`B${row}`);
    const lastName = cells.get(`C${row}`);
    if (!group || !firstName || !lastName) {
      throw new Error(`Incomplete golfer row at Sheet1!A${row}:C${row}`);
    }
    const position = golfers.filter((golfer) => golfer.group === group).length + 1;
    golfers.push({ group, position, firstName, lastName, sourceRow: row });
  }

  if (golfers.length !== 32) throw new Error(`Expected 32 golfers, found ${golfers.length}`);
  for (const [groupNumber] of TEAM_CONFIGURATION) {
    const count = golfers.filter((golfer) => golfer.group === groupNumber).length;
    if (count !== 4) throw new Error(`Expected 4 golfers in Group ${groupNumber}, found ${count}`);
  }
  const unexpectedGroups = golfers.filter((golfer) => !TEAM_CONFIGURATION.has(golfer.group));
  if (unexpectedGroups.length) {
    throw new Error(`Unexpected group number at Sheet1 row ${unexpectedGroups[0].sourceRow}`);
  }

  return golfers;
}

function duplicateNames(golfers) {
  const counts = new Map();
  for (const golfer of golfers) {
    const name = `${golfer.firstName} ${golfer.lastName}`;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1);
}

async function applyRoster(golfers) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !supabaseSecret) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required to apply the roster");
  }

  const supabase = createClient(supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: schemaError } = await supabase.from("players").select("id").limit(1);
  if (schemaError) {
    throw new Error(`Supabase roster schema is not ready: ${schemaError.message}. Apply supabase/roster.sql first.`);
  }

  const { data: existingTeams, error: teamsReadError } = await supabase.from("teams").select("*");
  if (teamsReadError) throw teamsReadError;
  const existingById = new Map((existingTeams ?? []).map((team) => [team.id, team]));
  const teamRows = [...TEAM_CONFIGURATION].map(([group, configuration]) => {
    const id = `team-${group}`;
    const existing = existingById.get(id);
    return {
      id,
      name: `Group ${group}`,
      short: `G${String(group).padStart(2, "0")}`,
      access_code: configuration.accessCode,
      start_hole: configuration.startHole,
      mulligans: existing?.mulligans ?? 0,
      string_inches: existing?.string_inches ?? 0,
    };
  });
  const playerRows = golfers.map((golfer) => ({
    id: `team-${golfer.group}-p${golfer.position}`,
    team_id: `team-${golfer.group}`,
    first_name: golfer.firstName,
    last_name: golfer.lastName,
    position: golfer.position,
  }));

  const { error: teamsUpsertError } = await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
  if (teamsUpsertError) throw teamsUpsertError;
  const { error: playersUpsertError } = await supabase.from("players").upsert(playerRows, { onConflict: "id" });
  if (playersUpsertError) throw playersUpsertError;

  const { data: existingPlayers, error: playersReadError } = await supabase.from("players").select("id");
  if (playersReadError) throw playersReadError;
  const playerIds = new Set(playerRows.map((player) => player.id));
  const stalePlayerIds = (existingPlayers ?? []).map((player) => player.id).filter((id) => !playerIds.has(id));
  if (stalePlayerIds.length) {
    const { error } = await supabase.from("players").delete().in("id", stalePlayerIds);
    if (error) throw error;
  }
  const teamIds = new Set(teamRows.map((team) => team.id));
  const staleTeamIds = (existingTeams ?? []).map((team) => team.id).filter((id) => !teamIds.has(id));
  if (staleTeamIds.length) {
    const { error } = await supabase.from("teams").delete().in("id", staleTeamIds);
    if (error) throw error;
  }
}

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const workbookPath = args.find((arg) => arg !== "--apply") ?? DEFAULT_WORKBOOK;
await access(workbookPath);
const golfers = parseWorkbook(workbookPath);
const duplicates = duplicateNames(golfers);

console.log(`Validated ${golfers.length} golfer rows across ${TEAM_CONFIGURATION.size} groups from ${workbookPath}.`);
for (const [name, count] of duplicates) {
  console.warn(`Source duplicate: ${name} appears ${count} times.`);
}

if (apply) {
  await applyRoster(golfers);
  console.log("Supabase roster is up to date.");
} else {
  console.log("Parse-only mode; no Supabase data was changed.");
}
