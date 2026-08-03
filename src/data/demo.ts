export type Player = {
  id: string;
  name: string;
  teamId: string;
};

export type Team = {
  id: string;
  name: string;
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

export type Sale = {
  id: string;
  product: "mulligan" | "string" | "raffle";
  qty: number;
  amount: number;
  teamId: string;
  soldBy: string;
  soldAt: string;
  synced: boolean;
  stringInches?: number;
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

function players(teamId: string, names: string[]): Player[] {
  return names.map((name, index) => ({ id: `${teamId}-p${index + 1}`, name, teamId }));
}

export const DEMO_TEAMS: Team[] = [
  {
    id: "team-1",
    name: "Group 1",
    code: "1842",
    // ASSUMPTION: Starting holes and access codes have not been supplied.
    startHole: 1,
    players: players("team-1", ["Rich Mann", "Steve Noble", "Russell Waugh", "Dan Kerwin"]),
    mulligans: 2,
    stringInches: 18,
  },
  {
    id: "team-2",
    name: "Group 2",
    code: "2715",
    // ASSUMPTION: Starting holes and access codes have not been supplied.
    startHole: 3,
    players: players("team-2", ["Mitch Holland", "Drew Wolfe", "Matt Moore", "4th TBD"]),
    mulligans: 1,
    stringInches: 12,
  },
  // ASSUMPTION: Groups 3–10 are demo-only placeholders until the full draw arrives.
  { id: "team-3", name: "Group 3", code: "3168", startHole: 5, players: players("team-3", ["Golfer 3A", "Golfer 3B", "Golfer 3C", "Golfer 3D"]), mulligans: 2, stringInches: 20 },
  { id: "team-4", name: "Group 4", code: "4093", startHole: 7, players: players("team-4", ["Golfer 4A", "Golfer 4B", "Golfer 4C", "Golfer 4D"]), mulligans: 0, stringInches: 0 },
  { id: "team-5", name: "Group 5", code: "5581", startHole: 9, players: players("team-5", ["Golfer 5A", "Golfer 5B", "Golfer 5C", "Golfer 5D"]), mulligans: 3, stringInches: 24 },
  { id: "team-6", name: "Group 6", code: "6027", startHole: 11, players: players("team-6", ["Golfer 6A", "Golfer 6B", "Golfer 6C", "Golfer 6D"]), mulligans: 1, stringInches: 8 },
  { id: "team-7", name: "Group 7", code: "7344", startHole: 13, players: players("team-7", ["Golfer 7A", "Golfer 7B", "Golfer 7C", "Golfer 7D"]), mulligans: 2, stringInches: 14 },
  { id: "team-8", name: "Group 8", code: "8621", startHole: 15, players: players("team-8", ["Golfer 8A", "Golfer 8B", "Golfer 8C", "Golfer 8D"]), mulligans: 0, stringInches: 22 },
  { id: "team-9", name: "Group 9", code: "9450", startHole: 17, players: players("team-9", ["Golfer 9A", "Golfer 9B", "Golfer 9C", "Golfer 9D"]), mulligans: 1, stringInches: 6 },
  { id: "team-10", name: "Group 10", code: "1076", startHole: 18, players: players("team-10", ["Golfer 10A", "Golfer 10B", "Golfer 10C", "Golfer 10D"]), mulligans: 2, stringInches: 16 },
];

function seedScores(teamId: string, startHole: number, offsets: number[]): Score[] {
  return offsets.map((offset, index) => {
    const hole = ((startHole - 1 + index) % 18) + 1;
    const par = COURSE.holes[hole - 1].par;
    return {
      id: `${teamId}-h${hole}`,
      teamId,
      hole,
      strokes: par + offset,
      enteredBy: "demo",
      enteredAt: "demo",
      synced: true,
    };
  });
}

// ASSUMPTION: All scores, claims and sales below exist only to make the demo move.
export const DEMO_SCORES: Score[] = [
  ...seedScores("team-1", 1, [-1, 0, -1, 0, -1, 0]),
  ...seedScores("team-2", 3, [0, -1, 0, -1, -1, 0]),
  ...seedScores("team-3", 5, [-1, -1, 0, 0, -1, 0, -1]),
  ...seedScores("team-4", 7, [0, 0, -1, 0, 0]),
  ...seedScores("team-5", 9, [-1, 0, -1, -1, 0, -1]),
  ...seedScores("team-6", 11, [0, -1, 0, -1, 0, 0]),
  ...seedScores("team-7", 13, [-1, -1, -1, 0, -1]),
  ...seedScores("team-8", 15, [0, 0, -1, 0, 0, -1]),
  ...seedScores("team-9", 17, [-1, 0, -1, 0, -1]),
  ...seedScores("team-10", 18, [0, -1, 0, -1, -1, 0]),
];

export const DEMO_CLAIMS: Claim[] = [
  { id: "claim-closest", contestId: "closest", holeNumber: 2, playerName: "Steve Noble", teamId: "team-1", mark: 62, unit: "in", claimedAt: "demo", synced: true },
  { id: "claim-speed", contestId: "speed", holeNumber: 12, playerName: "Group 2", teamId: "team-2", mark: 276.4, unit: "sec", claimedAt: "demo", synced: true },
  { id: "claim-drive", contestId: "drive", holeNumber: 15, playerName: "Mitch Holland", teamId: "team-2", mark: 264, unit: "yd", claimedAt: "demo", synced: true },
  { id: "claim-putt", contestId: "putt", holeNumber: 18, playerName: "Rich Mann", teamId: "team-1", mark: 18, unit: "ft", claimedAt: "demo", synced: true },
];

export const DEMO_SALES: Sale[] = [
  { id: "sale-1", product: "mulligan", qty: 3, amount: 30, teamId: "team-3", soldBy: "Dan C", soldAt: "demo", synced: true },
  { id: "sale-2", product: "raffle", qty: 5, amount: 100, teamId: "team-5", soldBy: "Marcus S", soldAt: "demo", synced: true },
  { id: "sale-3", product: "string", qty: 1, amount: 20, teamId: "team-7", soldBy: "Dan C", soldAt: "demo", synced: true, stringInches: 14 },
];

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
