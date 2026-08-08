import { GOLFER_ROSTER, TEAM_CONFIGURATION } from "@/src/data/roster";

export type Player = {
  id: string;
  name: string;
  teamId: string;
};

export type Team = {
  id: string;
  name: string;
  short: string;
  code: string;
  startHole: number;
  players: Player[];
  mulligans: number;
  stringInches: number;
};

export type Hole = {
  number: number;
  par: number;
  yards: number;
};

export type Score = {
  id: string;
  teamId: string;
  hole: number;
  strokes: number;
  enteredBy: string;
  enteredAt: string;
  synced: boolean;
};

export type Claim = {
  id: string;
  contestId: "closest" | "speed" | "drive" | "putt";
  holeNumber: number;
  playerId: string;
  playerName: string;
  teamId: string;
  mark: number;
  unit: "in" | "sec" | "yd" | "ft";
  claimedAt: string;
  synced: boolean;
};

export type OrderLine = {
  productId: "mulligan" | "string" | "splits";
  qty: number;
  beneficiaryType?: "team" | "player";
  beneficiaryPlayerId?: string | null;
};

export type Order = {
  id: string;
  teamId: string;
  buyerId: string;
  lines: OrderLine[];
  amount: number;
  channel: "self" | "volunteer";
  paymentRef: string | null;
  createdAt: string;
  synced: boolean;
};

export type Envelope = {
  id: string;
  orderId: string;
  teamId: string;
  inches: number | null;
  openedAt: string | null;
  collectedAt: string | null;
  usedAt: string | null;
  synced: boolean;
};

export type Ticket = {
  id: string;
  orderId: string;
  teamId: string;
  number: string;
  beneficiaryType: "team" | "player";
  beneficiaryPlayerId: string | null;
  synced: boolean;
};

export type MulliganUse = {
  id: string;
  teamId: string;
  usedBy: string;
  usedAt: string;
  synced: boolean;
};

export type Photo = {
  id: string;
  teamId: string;
  uploaderId: string;
  url: string | null;
  thumbnail: string;
  storagePath: string | null;
  hole: number;
  takenAt: string;
  synced: boolean;
  mine: boolean;
};

export const EVENT = {
  id: "denver-bulldogs-golf-day",
  name: "Bulldogs Golf Day",
  date: "Saturday, 8 August",
  venue: "Applewood Golf Course",
  address: "14001 W 32nd Ave, Golden, CO 80401",
  format: "Scramble · shotgun start",
  startTime: "1:30 pm",
} as const;

// SOURCED FROM PUBLISHED SCORECARDS, not club-confirmed. Two independent
// sources (golflink.com and 18birdies.com) agree on this card: out 36, in 35,
// par 71, 6,188 yd from the Blue tees. Yardages are Blue; they are display-only
// and do not affect scoring. Pars DO drive every ladder position, so if Jay can
// hand over the official card, diff it against this before the shotgun.
export const COURSE = {
  id: "applewood",
  name: "Applewood Golf Course",
  par: 71,
  holes: [
    { number: 1, par: 4, yards: 294 },
    { number: 2, par: 3, yards: 119 },
    { number: 3, par: 4, yards: 381 },
    { number: 4, par: 5, yards: 458 },
    { number: 5, par: 4, yards: 416 },
    { number: 6, par: 4, yards: 374 },
    { number: 7, par: 5, yards: 471 },
    { number: 8, par: 4, yards: 344 },
    { number: 9, par: 3, yards: 203 },
    { number: 10, par: 4, yards: 381 },
    { number: 11, par: 3, yards: 173 },
    { number: 12, par: 4, yards: 379 },
    { number: 13, par: 4, yards: 426 },
    { number: 14, par: 3, yards: 151 },
    { number: 15, par: 5, yards: 527 },
    { number: 16, par: 5, yards: 529 },
    { number: 17, par: 3, yards: 181 },
    { number: 18, par: 4, yards: 381 },
  ] satisfies Hole[],
} as const;

export const INITIAL_TEAMS: Team[] = TEAM_CONFIGURATION.map((team) => {
  const teamId = `team-${team.group}`;
  const players = GOLFER_ROSTER
    .filter((golfer) => golfer.group === team.group)
    .map((golfer) => ({
      id: `${teamId}-p${golfer.position}`,
      name: `${golfer.firstName} ${golfer.lastName}`,
      teamId,
    }));

  return {
    id: teamId,
    name: `Group ${team.group}`,
    short: `G${String(team.group).padStart(2, "0")}`,
    code: team.code,
    startHole: team.startHole,
    players,
    mulligans: 0,
    stringInches: 0,
  };
});

export const INITIAL_SCORES: Score[] = [];
export const INITIAL_CLAIMS: Claim[] = [];
export const INITIAL_ORDERS: Order[] = [];
export const INITIAL_ENVELOPES: Envelope[] = [];
export const INITIAL_TICKETS: Ticket[] = [];
export const INITIAL_MULLIGAN_USES: MulliganUse[] = [];

export const SCHEDULE = [
  ["12:00 pm", "Volunteers arrive"],
  ["12:30 pm", "Registration opens"],
  ["12:30–1:15 pm", "Range and bar open"],
  ["1:20 pm", "Golfers to carts"],
  ["1:25 pm", "Announcements"],
  ["1:30 pm", "Shotgun start"],
  ["~5:30 pm", "Awards and BBQ dinner"],
] as const;

// Day-of phone numbers, in the order a golfer should try them.
export const CONTACTS = [
  { name: "Harry Wetherall", role: "App help", display: "720-323-9825", tel: "+17203239825" },
  { name: "Phil Camping", role: "On the course", display: "970-371-5658", tel: "+19703715658" },
  { name: "Jay Blistan", role: "Events Chair", display: "203-505-5555", tel: "+12035055555" },
] as const;

export const CONTESTS = [
  { id: "closest", hole: 2, name: "Closest to the pin", short: "Closest", direction: "low", unit: "in" },
  { id: "speed", hole: 12, name: "Speed hole", short: "Speed", direction: "low", unit: "sec" },
  { id: "drive", hole: 15, name: "Long drive", short: "Long drive", direction: "high", unit: "yd" },
  { id: "putt", hole: 18, name: "Longest putt", short: "Long putt", direction: "high", unit: "ft" },
] as const;

export const PRODUCTS = [
  { id: "mulligan", name: "Mulligan", price: 10, note: "One team re-hit · final sale" },
  { id: "string", name: "String", price: 20, note: "One-use sealed 6–24 in string" },
  { id: "splits", name: "Banana Splits", price: 20, note: "Half the pot goes to the winner" },
] as const;
