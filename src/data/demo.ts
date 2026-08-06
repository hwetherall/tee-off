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
  playerName: string;
  teamId: string;
  mark: number;
  unit: "in" | "sec" | "yd" | "ft";
  claimedAt: string;
  synced: boolean;
};

export type OrderLine = {
  productId: "mulligan" | "string" | "raffle";
  qty: number;
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
  synced: boolean;
};

export type Ticket = {
  id: string;
  orderId: string;
  teamId: string;
  number: string;
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

// ASSUMPTION: These pars and every yardage below are placeholders. Replace the
// full holes array with Applewood's official card before this reaches golfers.
export const COURSE = {
  id: "applewood-placeholder",
  name: "Applewood Golf Course",
  par: 71,
  holes: [
    { number: 1, par: 4, yards: 372 },
    { number: 2, par: 3, yards: 148 },
    { number: 3, par: 4, yards: 394 },
    { number: 4, par: 4, yards: 355 },
    { number: 5, par: 5, yards: 512 },
    { number: 6, par: 4, yards: 381 },
    { number: 7, par: 3, yards: 172 },
    { number: 8, par: 4, yards: 405 },
    { number: 9, par: 4, yards: 367 },
    { number: 10, par: 4, yards: 389 },
    { number: 11, par: 4, yards: 361 },
    { number: 12, par: 3, yards: 156 },
    { number: 13, par: 4, yards: 402 },
    { number: 14, par: 4, yards: 344 },
    { number: 15, par: 5, yards: 526 },
    { number: 16, par: 4, yards: 376 },
    { number: 17, par: 4, yards: 410 },
    { number: 18, par: 4, yards: 358 },
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

export const SCHEDULE = [
  ["12:00 pm", "Volunteers arrive"],
  ["12:30 pm", "Registration opens"],
  ["12:30–1:15 pm", "Range and bar open"],
  ["1:20 pm", "Golfers to carts"],
  ["1:25 pm", "Announcements"],
  ["1:30 pm", "Shotgun start"],
  ["~5:30 pm", "Awards and BBQ dinner"],
] as const;

export const CONTESTS = [
  { id: "closest", hole: 2, name: "Closest to the pin", short: "Closest", direction: "low", unit: "in" },
  { id: "speed", hole: 12, name: "Speed hole", short: "Speed", direction: "low", unit: "sec" },
  { id: "drive", hole: 15, name: "Long drive", short: "Long drive", direction: "high", unit: "yd" },
  { id: "putt", hole: 18, name: "Longest putt", short: "Long putt", direction: "high", unit: "ft" },
] as const;

export const PRODUCTS = [
  { id: "mulligan", name: "Mulligan", price: 10, note: "One re-hit" },
  { id: "string", name: "String", price: 20, note: "Sealed 6–24 in envelope" },
  { id: "raffle", name: "50/50 ticket", price: 20, note: "Half the pot goes to the winner" },
] as const;
