import { createClient } from "@supabase/supabase-js";
import {
  DEMO_CLAIMS,
  DEMO_ENVELOPES,
  DEMO_ORDERS,
  DEMO_SCORES,
  DEMO_TEAMS,
  DEMO_TICKETS,
  type Claim,
  type Envelope,
  type Order,
  type Photo,
  type Score,
  type Team,
  type Ticket,
} from "@/src/data/demo";
import { loadPhotoFile } from "@/src/lib/photos";

export type TimerState = {
  runningSince: number | null;
  elapsedMs: number;
};

export type PhotoDelete = {
  id: string;
  storagePath: string | null;
};

export type AppState = {
  teams: Team[];
  scores: Score[];
  claims: Claim[];
  orders: Order[];
  envelopes: Envelope[];
  tickets: Ticket[];
  photos: Photo[];
  photoDeletes: PhotoDelete[];
  timer: TimerState;
  dirtyTeamIds: string[];
};

type LegacySale = {
  id: string;
  product: "mulligan" | "string" | "raffle";
  qty: number;
  amount: number;
  teamId: string;
  soldBy: string;
  soldAt: string;
  synced: boolean;
};

type StoredState = Partial<AppState> & { sales?: LegacySale[] };

const STORAGE_KEY = "bulldogs-golf-day-v1";
const TEAM_KEY = "bulldogs-golf-team-v1";

export const DEMO_STATE: AppState = {
  teams: DEMO_TEAMS,
  scores: DEMO_SCORES,
  claims: DEMO_CLAIMS,
  orders: DEMO_ORDERS,
  envelopes: DEMO_ENVELOPES,
  tickets: DEMO_TICKETS,
  photos: [],
  photoDeletes: [],
  timer: { runningSince: null, elapsedMs: 0 },
  dirtyTeamIds: [],
};

function migrateSales(sales: LegacySale[] = []): Order[] {
  return sales.map((sale) => ({
    id: sale.id.replace("sale", "order"),
    teamId: sale.teamId,
    buyerId: sale.soldBy,
    lines: [{ productId: sale.product, qty: sale.qty }],
    amount: sale.amount,
    channel: "volunteer",
    paymentRef: null,
    createdAt: sale.soldAt,
    synced: sale.synced,
  }));
}

export function loadState(): AppState {
  if (typeof window === "undefined") return DEMO_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEMO_STATE;
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed.teams || !parsed.scores || !parsed.claims) return DEMO_STATE;
    return {
      teams: parsed.teams.map((team, index) => ({ ...team, short: team.short ?? `G${String(index + 1).padStart(2, "0")}` })),
      scores: parsed.scores,
      claims: parsed.claims,
      orders: parsed.orders ?? migrateSales(parsed.sales),
      envelopes: parsed.envelopes ?? [],
      tickets: parsed.tickets ?? [],
      photos: parsed.photos ?? [],
      photoDeletes: parsed.photoDeletes ?? [],
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
    + state.orders.filter((item) => !item.synced).length
    + state.envelopes.filter((item) => !item.synced).length
    + state.tickets.filter((item) => !item.synced).length
    + state.photos.filter((item) => !item.synced).length
    + state.photoDeletes.length
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
  const orderRows = state.orders.filter((order) => !order.synced).map((order) => ({
    id: order.id,
    team_id: order.teamId,
    buyer_id: order.buyerId,
    lines: order.lines,
    amount: order.amount,
    channel: order.channel,
    payment_ref: order.paymentRef,
    created_at: order.createdAt,
  }));
  const envelopeRows = state.envelopes.filter((envelope) => !envelope.synced).map((envelope) => ({
    id: envelope.id,
    order_id: envelope.orderId,
    team_id: envelope.teamId,
    inches: envelope.inches,
    opened_at: envelope.openedAt,
  }));
  const ticketRows = state.tickets.filter((ticket) => !ticket.synced).map((ticket) => ({
    id: ticket.id,
    order_id: ticket.orderId,
    team_id: ticket.teamId,
    number: ticket.number,
  }));
  const teamRows = state.teams.filter((team) => state.dirtyTeamIds.includes(team.id)).map((team) => ({
    id: team.id,
    name: team.name,
    short: team.short,
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
  if (orderRows.length) {
    const { error } = await supabase.from("orders").upsert(orderRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (envelopeRows.length) {
    const { error } = await supabase.from("envelopes").upsert(envelopeRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (ticketRows.length) {
    const { error } = await supabase.from("tickets").upsert(ticketRows, { onConflict: "id" });
    if (error) throw error;
  }
  if (teamRows.length) {
    const { error } = await supabase.from("teams").upsert(teamRows, { onConflict: "id" });
    if (error) throw error;
  }

  for (const deletion of state.photoDeletes) {
    if (deletion.storagePath) await supabase.storage.from("photos").remove([deletion.storagePath]);
    const { error } = await supabase.from("photos").delete().eq("id", deletion.id);
    if (error) throw error;
  }

  const uploadedPhotos = new Map<string, { url: string; storagePath: string }>();
  for (const photo of state.photos.filter((item) => !item.synced)) {
    const blob = await loadPhotoFile(photo.id);
    if (!blob) continue;
    const storagePath = `${photo.teamId}/${photo.id}.jpg`;
    const { error: uploadError } = await supabase.storage.from("photos").upload(storagePath, blob, {
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from("photos").getPublicUrl(storagePath);
    const url = data.publicUrl;
    const { error: rowError } = await supabase.from("photos").upsert({
      id: photo.id,
      team_id: photo.teamId,
      uploader_id: photo.uploaderId,
      url,
      storage_path: storagePath,
      hole: photo.hole,
      taken_at: photo.takenAt,
    }, { onConflict: "id" });
    if (rowError) throw rowError;
    uploadedPhotos.set(photo.id, { url, storagePath });
  }

  return {
    ...state,
    scores: state.scores.map((score) => ({ ...score, synced: true })),
    claims: state.claims.map((claim) => ({ ...claim, synced: true })),
    orders: state.orders.map((order) => ({ ...order, synced: true })),
    envelopes: state.envelopes.map((envelope) => ({ ...envelope, synced: true })),
    tickets: state.tickets.map((ticket) => ({ ...ticket, synced: true })),
    photos: state.photos.map((photo) => {
      const uploaded = uploadedPhotos.get(photo.id);
      return uploaded ? { ...photo, ...uploaded, synced: true } : photo;
    }),
    photoDeletes: [],
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
  const [scoresResult, claimsResult, ordersResult, envelopesResult, ticketsResult, photosResult, teamsResult] = await Promise.all([
    supabase.from("scores").select("*"),
    supabase.from("claims").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("envelopes").select("*"),
    supabase.from("tickets").select("*"),
    supabase.from("photos").select("*"),
    supabase.from("teams").select("*"),
  ]);
  const error = scoresResult.error ?? claimsResult.error ?? ordersResult.error ?? envelopesResult.error
    ?? ticketsResult.error ?? photosResult.error ?? teamsResult.error;
  if (error) throw error;

  const scores: Score[] = (scoresResult.data ?? []).map((row) => ({
    id: row.id, teamId: row.team_id, hole: row.hole, strokes: row.strokes,
    enteredBy: row.entered_by, enteredAt: row.entered_at, synced: true,
  }));
  const claims: Claim[] = (claimsResult.data ?? []).map((row) => ({
    id: row.id, contestId: row.contest_id, holeNumber: row.hole_number,
    playerName: row.player_name, teamId: row.team_id, mark: Number(row.mark),
    unit: row.unit, claimedAt: row.claimed_at, synced: true,
  }));
  const orders: Order[] = (ordersResult.data ?? []).map((row) => ({
    id: row.id, teamId: row.team_id, buyerId: row.buyer_id, lines: row.lines,
    amount: Number(row.amount), channel: row.channel, paymentRef: row.payment_ref,
    createdAt: row.created_at, synced: true,
  }));
  const envelopes: Envelope[] = (envelopesResult.data ?? []).map((row) => ({
    id: row.id, orderId: row.order_id, teamId: row.team_id, inches: row.inches,
    openedAt: row.opened_at, synced: true,
  }));
  const tickets: Ticket[] = (ticketsResult.data ?? []).map((row) => ({
    id: row.id, orderId: row.order_id, teamId: row.team_id, number: row.number, synced: true,
  }));
  const photos: Photo[] = (photosResult.data ?? []).map((row) => ({
    id: row.id,
    teamId: row.team_id,
    uploaderId: row.uploader_id,
    url: row.url,
    thumbnail: row.url,
    storagePath: row.storage_path,
    hole: row.hole,
    takenAt: row.taken_at,
    synced: true,
    mine: state.photos.find((photo) => photo.id === row.id)?.mine ?? false,
  }));
  const teamRows = new Map((teamsResult.data ?? []).map((row) => [row.id, row]));
  const teams = state.teams.map((team) => {
    if (state.dirtyTeamIds.includes(team.id)) return team;
    const row = teamRows.get(team.id);
    return row
      ? { ...team, name: row.name, short: row.short, startHole: row.start_hole, mulligans: row.mulligans, stringInches: row.string_inches }
      : team;
  });

  return {
    ...state,
    scores: mergeById(state.scores, scores),
    claims: mergeById(state.claims, claims),
    orders: mergeById(state.orders, orders),
    envelopes: mergeById(state.envelopes, envelopes),
    tickets: mergeById(state.tickets, tickets),
    photos: mergeById(state.photos, photos).filter((photo) => !state.photoDeletes.some((item) => item.id === photo.id)),
    teams,
  };
}
