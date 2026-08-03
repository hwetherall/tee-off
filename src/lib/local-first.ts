import { createClient } from "@supabase/supabase-js";
import {
  DEMO_CLAIMS,
  DEMO_SALES,
  DEMO_SCORES,
  DEMO_TEAMS,
  type Claim,
  type Sale,
  type Score,
  type Team,
} from "@/src/data/demo";

export type TimerState = {
  runningSince: number | null;
  elapsedMs: number;
};

export type AppState = {
  teams: Team[];
  scores: Score[];
  claims: Claim[];
  sales: Sale[];
  timer: TimerState;
  dirtyTeamIds: string[];
};

const STORAGE_KEY = "bulldogs-golf-day-v1";
const TEAM_KEY = "bulldogs-golf-team-v1";

export const DEMO_STATE: AppState = {
  teams: DEMO_TEAMS,
  scores: DEMO_SCORES,
  claims: DEMO_CLAIMS,
  sales: DEMO_SALES,
  timer: { runningSince: null, elapsedMs: 0 },
  dirtyTeamIds: [],
};

export function loadState(): AppState {
  if (typeof window === "undefined") return DEMO_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEMO_STATE;
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.teams || !parsed.scores || !parsed.claims || !parsed.sales) return DEMO_STATE;
    return {
      ...parsed,
      timer: parsed.timer ?? DEMO_STATE.timer,
      dirtyTeamIds: parsed.dirtyTeamIds ?? [],
    };
  } catch {
    return DEMO_STATE;
  }
}

export function saveState(state: AppState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function loadCurrentTeam(): string {
  if (typeof window === "undefined") return "team-1";
  return window.localStorage.getItem(TEAM_KEY) ?? "team-1";
}

export function saveCurrentTeam(teamId: string) {
  if (typeof window !== "undefined") window.localStorage.setItem(TEAM_KEY, teamId);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const remoteConfigured = Boolean(supabaseUrl && supabaseKey);
const supabase = remoteConfigured ? createClient(supabaseUrl!, supabaseKey!) : null;

export function pendingCount(state: AppState) {
  return state.scores.filter((item) => !item.synced).length
    + state.claims.filter((item) => !item.synced).length
    + state.sales.filter((item) => !item.synced).length
    + state.dirtyTeamIds.length;
}

export async function pushPending(state: AppState): Promise<AppState> {
  if (!supabase) return state;

  const scoreRows = state.scores.filter((score) => !score.synced).map((score) => ({
    id: score.id,
    team_id: score.teamId,
    hole: score.hole,
    strokes: score.strokes,
    entered_by: score.enteredBy,
    entered_at: score.enteredAt,
  }));
  const claimRows = state.claims.filter((claim) => !claim.synced).map((claim) => ({
    id: claim.id,
    contest_id: claim.contestId,
    hole_number: claim.holeNumber,
    player_name: claim.playerName,
    team_id: claim.teamId,
    mark: claim.mark,
    unit: claim.unit,
    claimed_at: claim.claimedAt,
  }));
  const saleRows = state.sales.filter((sale) => !sale.synced).map((sale) => ({
    id: sale.id,
    product: sale.product,
    qty: sale.qty,
    amount: sale.amount,
    team_id: sale.teamId,
    sold_by: sale.soldBy,
    sold_at: sale.soldAt,
    string_inches: sale.stringInches ?? null,
  }));
  const teamRows = state.teams.filter((team) => state.dirtyTeamIds.includes(team.id)).map((team) => ({
    id: team.id,
    name: team.name,
    start_hole: team.startHole,
    mulligans: team.mulligans,
    string_inches: team.stringInches,
  }));

  if (scoreRows.length) {
    const { error } = await supabase.from("scores").upsert(scoreRows, { onConflict: "team_id,hole" });
    if (error) throw error;
  }
  if (claimRows.length) {
    const { error } = await supabase.from("claims").upsert(claimRows, { onConflict: "contest_id" });
    if (error) throw error;
  }
  if (saleRows.length) {
    const { error } = await supabase.from("sales").upsert(saleRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (teamRows.length) {
    const { error } = await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
    if (error) throw error;
  }

  return {
    ...state,
    scores: state.scores.map((score) => ({ ...score, synced: true })),
    claims: state.claims.map((claim) => ({ ...claim, synced: true })),
    sales: state.sales.map((sale) => ({ ...sale, synced: true })),
    dirtyTeamIds: [],
  };
}

function mergeById<T extends { id: string; synced: boolean }>(local: T[], remote: T[]): T[] {
  const merged = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => {
    if (!item.synced || !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

export async function pullRemote(state: AppState): Promise<AppState> {
  if (!supabase) return state;
  const [scoresResult, claimsResult, salesResult, teamsResult] = await Promise.all([
    supabase.from("scores").select("*"),
    supabase.from("claims").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("teams").select("*"),
  ]);
  const error = scoresResult.error ?? claimsResult.error ?? salesResult.error ?? teamsResult.error;
  if (error) throw error;

  const scores: Score[] = (scoresResult.data ?? []).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    hole: row.hole,
    strokes: row.strokes,
    enteredBy: row.entered_by,
    enteredAt: row.entered_at,
    synced: true,
  }));
  const claims: Claim[] = (claimsResult.data ?? []).map((row) => ({
    id: row.id,
    contestId: row.contest_id,
    holeNumber: row.hole_number,
    playerName: row.player_name,
    teamId: row.team_id,
    mark: Number(row.mark),
    unit: row.unit,
    claimedAt: row.claimed_at,
    synced: true,
  }));
  const sales: Sale[] = (salesResult.data ?? []).map((row) => ({
    id: row.id,
    product: row.product,
    qty: row.qty,
    amount: Number(row.amount),
    teamId: row.team_id,
    soldBy: row.sold_by,
    soldAt: row.sold_at,
    stringInches: row.string_inches ?? undefined,
    synced: true,
  }));
  const teamRows = new Map((teamsResult.data ?? []).map((row) => [row.id, row]));
  const teams = state.teams.map((team) => {
    if (state.dirtyTeamIds.includes(team.id)) return team;
    const row = teamRows.get(team.id);
    return row
      ? { ...team, name: row.name, startHole: row.start_hole, mulligans: row.mulligans, stringInches: row.string_inches }
      : team;
  });

  return {
    ...state,
    scores: mergeById(state.scores, scores),
    claims: mergeById(state.claims, claims),
    sales: mergeById(state.sales, sales),
    teams,
  };
}
