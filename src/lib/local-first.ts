import { createClient } from "@supabase/supabase-js";
import {
  INITIAL_CLAIMS,
  INITIAL_ENVELOPES,
  INITIAL_ORDERS,
  INITIAL_SCORES,
  INITIAL_TEAMS,
  INITIAL_TICKETS,
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

// Mulligans and string inches are stored as signed adjustments, never as an
// absolute count to upload. Four phones on one team all mutate the same row, so
// pushing an absolute would let a stale device resurrect a spent mulligan or
// erase a paid one. Each delta is applied to the remote row with a
// compare-and-swap and dropped once it lands.
export type BalanceDelta = {
  id: string;
  teamId: string;
  mulligans: number;
  stringInches: number;
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
  balanceDeltas: BalanceDelta[];
};

type LegacySale = {
  id: string;
  product: "mulligan" | "string" | "splits";
  qty: number;
  amount: number;
  teamId: string;
  soldBy: string;
  soldAt: string;
  synced: boolean;
};

type StoredState = Partial<AppState> & { sales?: LegacySale[]; dirtyTeamIds?: string[] };

const STORAGE_KEY = "bulldogs-golf-day-v2";
const TEAM_KEY = "bulldogs-golf-team-v1";

export const INITIAL_STATE: AppState = {
  teams: INITIAL_TEAMS,
  scores: INITIAL_SCORES,
  claims: INITIAL_CLAIMS,
  orders: INITIAL_ORDERS,
  envelopes: INITIAL_ENVELOPES,
  tickets: INITIAL_TICKETS,
  photos: [],
  photoDeletes: [],
  timer: { runningSince: null, elapsedMs: 0 },
  balanceDeltas: [],
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
  if (typeof window === "undefined") return INITIAL_STATE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return INITIAL_STATE;
  try {
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed.teams || !parsed.scores || !parsed.claims) return INITIAL_STATE;
    return {
      teams: parsed.teams.map((team, index) => ({ ...team, short: team.short ?? `G${String(index + 1).padStart(2, "0")}` })),
      scores: parsed.scores,
      claims: parsed.claims,
      orders: parsed.orders ?? migrateSales(parsed.sales),
      envelopes: parsed.envelopes ?? [],
      tickets: parsed.tickets ?? [],
      photos: parsed.photos ?? [],
      photoDeletes: parsed.photoDeletes ?? [],
      timer: parsed.timer ?? INITIAL_STATE.timer,
      balanceDeltas: parsed.balanceDeltas ?? [],
    };
  } catch {
    return INITIAL_STATE;
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
    + state.balanceDeltas.length;
}

export function makeBalanceDelta(teamId: string, mulligans: number, stringInches: number): BalanceDelta {
  const token = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id: `delta-${token}`, teamId, mulligans, stringInches };
}

// Signatures let the reconcile step tell "this row is exactly what we uploaded"
// apart from "the golfer edited it while the upload was in flight". Only an
// exact match is marked synced; anything else stays pending and retries.
function scoreSignature(score: Score) {
  return [score.teamId, score.hole, score.strokes, score.enteredBy, score.enteredAt].join("|");
}
function claimSignature(claim: Claim) {
  return [claim.contestId, claim.holeNumber, claim.playerName, claim.teamId, claim.mark, claim.unit, claim.claimedAt].join("|");
}
function orderSignature(order: Order) {
  return [order.teamId, order.buyerId, JSON.stringify(order.lines), order.amount, order.channel, order.paymentRef, order.createdAt].join("|");
}
function envelopeSignature(envelope: Envelope) {
  return [envelope.orderId, envelope.teamId, envelope.inches, envelope.openedAt].join("|");
}
function ticketSignature(ticket: Ticket) {
  return [ticket.orderId, ticket.teamId, ticket.number].join("|");
}

export type PushResult = {
  scores: Map<string, string>;
  claims: Map<string, string>;
  orders: Map<string, string>;
  envelopes: Map<string, string>;
  tickets: Map<string, string>;
  photos: Map<string, { url: string; storagePath: string }>;
  photoDeletes: string[];
  balanceDeltas: string[];
};

function emptyPush(): PushResult {
  return {
    scores: new Map(),
    claims: new Map(),
    orders: new Map(),
    envelopes: new Map(),
    tickets: new Map(),
    photos: new Map(),
    photoDeletes: [],
    balanceDeltas: [],
  };
}

// Compare-and-swap: read the row, add the delta, then write it back only if the
// row still holds the values we read. A losing race retries; a persistently
// contended delta stays pending and is attempted again next sync pass.
async function applyBalanceDelta(delta: BalanceDelta): Promise<boolean> {
  if (!supabase) return false;
  if (delta.mulligans === 0 && delta.stringInches === 0) return true;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await supabase
      .from("teams")
      .select("mulligans,string_inches")
      .eq("id", delta.teamId)
      .limit(1);
    if (error) throw error;
    const row = data?.[0];
    if (!row) return true;
    const { data: updated, error: updateError } = await supabase
      .from("teams")
      .update({
        mulligans: Math.max(0, row.mulligans + delta.mulligans),
        string_inches: Math.max(0, row.string_inches + delta.stringInches),
      })
      .eq("id", delta.teamId)
      .eq("mulligans", row.mulligans)
      .eq("string_inches", row.string_inches)
      .select("id");
    if (updateError) throw updateError;
    if (updated && updated.length > 0) return true;
  }
  return false;
}

export async function pushPending(state: AppState): Promise<PushResult> {
  if (!supabase) return emptyPush();

  const pendingScores = state.scores.filter((score) => !score.synced);
  const pendingClaims = state.claims.filter((claim) => !claim.synced);
  const pendingOrders = state.orders.filter((order) => !order.synced);
  const pendingEnvelopes = state.envelopes.filter((envelope) => !envelope.synced);
  const pendingTickets = state.tickets.filter((ticket) => !ticket.synced);
  const result = emptyPush();

  if (pendingScores.length) {
    const { error } = await supabase.from("scores").upsert(pendingScores.map((score) => ({
      id: score.id,
      team_id: score.teamId,
      hole: score.hole,
      strokes: score.strokes,
      entered_by: score.enteredBy,
      entered_at: score.enteredAt,
    })), { onConflict: "team_id,hole" });
    if (error) throw error;
    pendingScores.forEach((score) => result.scores.set(score.id, scoreSignature(score)));
  }

  if (pendingClaims.length) {
    const { error } = await supabase.from("claims").upsert(pendingClaims.map((claim) => ({
      id: claim.id,
      contest_id: claim.contestId,
      hole_number: claim.holeNumber,
      player_name: claim.playerName,
      team_id: claim.teamId,
      mark: claim.mark,
      unit: claim.unit,
      claimed_at: claim.claimedAt,
    })), { onConflict: "contest_id" });
    if (error) throw error;
    pendingClaims.forEach((claim) => result.claims.set(claim.id, claimSignature(claim)));
  }

  if (pendingOrders.length) {
    const { error } = await supabase.from("orders").upsert(pendingOrders.map((order) => ({
      id: order.id,
      team_id: order.teamId,
      buyer_id: order.buyerId,
      lines: order.lines,
      amount: order.amount,
      channel: order.channel,
      payment_ref: order.paymentRef,
      created_at: order.createdAt,
    })), { onConflict: "id" });
    if (error) throw error;
    pendingOrders.forEach((order) => result.orders.set(order.id, orderSignature(order)));
  }

  if (pendingEnvelopes.length) {
    const { error } = await supabase.from("envelopes").upsert(pendingEnvelopes.map((envelope) => ({
      id: envelope.id,
      order_id: envelope.orderId,
      team_id: envelope.teamId,
      inches: envelope.inches,
      opened_at: envelope.openedAt,
    })), { onConflict: "id" });
    if (error) throw error;
    pendingEnvelopes.forEach((envelope) => result.envelopes.set(envelope.id, envelopeSignature(envelope)));
  }

  if (pendingTickets.length) {
    const { error } = await supabase.from("tickets").upsert(pendingTickets.map((ticket) => ({
      id: ticket.id,
      order_id: ticket.orderId,
      team_id: ticket.teamId,
      number: ticket.number,
    })), { onConflict: "id" });
    if (error) throw error;
    pendingTickets.forEach((ticket) => result.tickets.set(ticket.id, ticketSignature(ticket)));
  }

  for (const delta of state.balanceDeltas) {
    if (await applyBalanceDelta(delta)) result.balanceDeltas.push(delta.id);
  }

  for (const deletion of state.photoDeletes) {
    if (deletion.storagePath) await supabase.storage.from("photos").remove([deletion.storagePath]);
    const { error } = await supabase.from("photos").delete().eq("id", deletion.id);
    if (error) throw error;
    result.photoDeletes.push(deletion.id);
  }

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
    result.photos.set(photo.id, { url, storagePath });
  }

  return result;
}

export type RemoteSnapshot = {
  scores: Score[];
  claims: Claim[];
  orders: Order[];
  envelopes: Envelope[];
  tickets: Ticket[];
  photos: Array<Omit<Photo, "mine">>;
  teams: Array<Omit<Team, "players">>;
  playersByTeam: Map<string, Team["players"]>;
} | null;

export async function pullRemote(): Promise<RemoteSnapshot> {
  if (!supabase) return null;
  const [scoresResult, claimsResult, ordersResult, envelopesResult, ticketsResult, photosResult, teamsResult, playersResult] = await Promise.all([
    supabase.from("scores").select("*"),
    supabase.from("claims").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("envelopes").select("*"),
    supabase.from("tickets").select("*"),
    supabase.from("photos").select("*"),
    supabase.from("teams").select("*"),
    supabase.from("players").select("*").order("team_id").order("position"),
  ]);
  const error = scoresResult.error ?? claimsResult.error ?? ordersResult.error ?? envelopesResult.error
    ?? ticketsResult.error ?? photosResult.error ?? teamsResult.error ?? playersResult.error;
  if (error) throw error;

  const playersByTeam = new Map<string, Team["players"]>();
  for (const row of playersResult.data ?? []) {
    const players = playersByTeam.get(row.team_id) ?? [];
    players.push({ id: row.id, name: `${row.first_name} ${row.last_name}`.trim(), teamId: row.team_id });
    playersByTeam.set(row.team_id, players);
  }

  return {
    scores: (scoresResult.data ?? []).map((row) => ({
      id: row.id, teamId: row.team_id, hole: row.hole, strokes: row.strokes,
      enteredBy: row.entered_by, enteredAt: row.entered_at, synced: true,
    })),
    claims: (claimsResult.data ?? []).map((row) => ({
      id: row.id, contestId: row.contest_id, holeNumber: row.hole_number,
      playerName: row.player_name, teamId: row.team_id, mark: Number(row.mark),
      unit: row.unit, claimedAt: row.claimed_at, synced: true,
    })),
    orders: (ordersResult.data ?? []).map((row) => ({
      id: row.id, teamId: row.team_id, buyerId: row.buyer_id, lines: row.lines,
      amount: Number(row.amount), channel: row.channel, paymentRef: row.payment_ref,
      createdAt: row.created_at, synced: true,
    })),
    envelopes: (envelopesResult.data ?? []).map((row) => ({
      id: row.id, orderId: row.order_id, teamId: row.team_id, inches: row.inches,
      openedAt: row.opened_at, synced: true,
    })),
    tickets: (ticketsResult.data ?? []).map((row) => ({
      id: row.id, orderId: row.order_id, teamId: row.team_id, number: row.number, synced: true,
    })),
    photos: (photosResult.data ?? []).map((row) => ({
      id: row.id, teamId: row.team_id, uploaderId: row.uploader_id, url: row.url,
      thumbnail: row.url, storagePath: row.storage_path, hole: row.hole,
      takenAt: row.taken_at, synced: true,
    })),
    teams: (teamsResult.data ?? []).map((row) => ({
      id: row.id, name: row.name, short: row.short, code: row.access_code,
      startHole: row.start_hole, mulligans: row.mulligans, stringInches: row.string_inches,
    })),
    playersByTeam,
  };
}

function markSynced<T extends { id: string; synced: boolean }>(
  items: T[],
  pushed: Map<string, string>,
  signature: (item: T) => string,
): T[] {
  if (pushed.size === 0) return items;
  return items.map((item) => {
    const uploaded = pushed.get(item.id);
    if (uploaded === undefined || item.synced) return item;
    return uploaded === signature(item) ? { ...item, synced: true } : item;
  });
}

function mergeById<T extends { id: string; synced: boolean }>(local: T[], remote: T[]): T[] {
  const merged = new Map(remote.map((item) => [item.id, item]));
  local.forEach((item) => {
    if (!item.synced || !merged.has(item.id)) merged.set(item.id, item);
  });
  return [...merged.values()];
}

// Applied against the LATEST local state rather than the snapshot the sync pass
// started from, so a hole saved while the upload was in flight survives.
export function reconcile(current: AppState, push: PushResult, remote: RemoteSnapshot): AppState {
  const appliedDeltas = new Set(push.balanceDeltas);
  const deletedPhotos = new Set(push.photoDeletes);

  const scores = markSynced(current.scores, push.scores, scoreSignature);
  const claims = markSynced(current.claims, push.claims, claimSignature);
  const orders = markSynced(current.orders, push.orders, orderSignature);
  const envelopes = markSynced(current.envelopes, push.envelopes, envelopeSignature);
  const tickets = markSynced(current.tickets, push.tickets, ticketSignature);
  const photos = current.photos.map((photo) => {
    const uploaded = push.photos.get(photo.id);
    return uploaded ? { ...photo, ...uploaded, synced: true } : photo;
  });
  const balanceDeltas = current.balanceDeltas.filter((delta) => !appliedDeltas.has(delta.id));
  const photoDeletes = current.photoDeletes.filter((item) => !deletedPhotos.has(item.id));

  const base: AppState = {
    ...current,
    scores,
    claims,
    orders,
    envelopes,
    tickets,
    photos,
    photoDeletes,
    balanceDeltas,
  };

  if (!remote) return base;

  // A team's shown balance is the remote row plus whatever this device has spent
  // or earned but not yet landed. Instant UI, and no absolute count is uploaded.
  const pendingByTeam = new Map<string, { mulligans: number; stringInches: number }>();
  for (const delta of balanceDeltas) {
    const totals = pendingByTeam.get(delta.teamId) ?? { mulligans: 0, stringInches: 0 };
    totals.mulligans += delta.mulligans;
    totals.stringInches += delta.stringInches;
    pendingByTeam.set(delta.teamId, totals);
  }
  const remoteTeams: Team[] = remote.teams.map((row) => {
    const pending = pendingByTeam.get(row.id);
    return {
      ...row,
      players: remote.playersByTeam.get(row.id) ?? [],
      mulligans: Math.max(0, row.mulligans + (pending?.mulligans ?? 0)),
      stringInches: Math.max(0, row.stringInches + (pending?.stringInches ?? 0)),
    };
  });

  const remotePhotos: Photo[] = remote.photos.map((photo) => ({
    ...photo,
    mine: current.photos.find((item) => item.id === photo.id)?.mine ?? false,
  }));

  return {
    ...base,
    scores: mergeById(scores, remote.scores),
    claims: mergeById(claims, remote.claims),
    orders: mergeById(orders, remote.orders),
    envelopes: mergeById(envelopes, remote.envelopes),
    tickets: mergeById(tickets, remote.tickets),
    photos: mergeById(photos, remotePhotos).filter((photo) => !photoDeletes.some((item) => item.id === photo.id)),
    teams: remoteTeams.length ? remoteTeams : base.teams,
  };
}
