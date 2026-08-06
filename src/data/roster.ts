// Parsed from "V2 Golfers - Denver Bulldogs Group Aug 8.xlsx" (Sheet1, A2:C33).
// The workbook supplies group membership and names only. Starting holes and
// four-digit cart-card codes remain the existing event configuration.
export const TEAM_CONFIGURATION = [
  { group: 1, startHole: 1, code: "1842" },
  { group: 2, startHole: 3, code: "2715" },
  { group: 3, startHole: 5, code: "3168" },
  { group: 4, startHole: 7, code: "4093" },
  { group: 5, startHole: 9, code: "5581" },
  { group: 6, startHole: 11, code: "6027" },
  { group: 7, startHole: 13, code: "7344" },
  { group: 8, startHole: 15, code: "8621" },
] as const;

export const GOLFER_ROSTER = [
  { group: 1, position: 1, firstName: "Wills", lastName: "Brassil" },
  { group: 1, position: 2, firstName: "Mitch", lastName: "Holland" },
  { group: 1, position: 3, firstName: "Matt", lastName: "Moore" },
  { group: 1, position: 4, firstName: "Drew", lastName: "Wolfe" },
  { group: 2, position: 1, firstName: "Rich", lastName: "Mann" },
  { group: 2, position: 2, firstName: "Steve", lastName: "Noble" },
  { group: 2, position: 3, firstName: "Dan", lastName: "Kerwin" },
  { group: 2, position: 4, firstName: "Russell", lastName: "Waugh" },
  { group: 3, position: 1, firstName: "Jay", lastName: "Blistan" },
  { group: 3, position: 2, firstName: "Miggy", lastName: "Morgan" },
  { group: 3, position: 3, firstName: "Travis", lastName: "Bruce" },
  { group: 3, position: 4, firstName: "Dan", lastName: "Harris" },
  { group: 4, position: 1, firstName: "Jarryd", lastName: "Watters" },
  { group: 4, position: 2, firstName: "Andrew", lastName: "Rowling" },
  { group: 4, position: 3, firstName: "Matt", lastName: "Klahn" },
  { group: 4, position: 4, firstName: "Jay", lastName: "Vay" },
  { group: 5, position: 1, firstName: "Alex", lastName: "Shaw" },
  { group: 5, position: 2, firstName: "Charly", lastName: "Van Norden" },
  { group: 5, position: 3, firstName: "Oz", lastName: "Alkaitis" },
  { group: 5, position: 4, firstName: "Lucas", lastName: "Newcomb" },
  { group: 6, position: 1, firstName: "Hallie", lastName: "Kastanek" },
  { group: 6, position: 2, firstName: "Lindsey", lastName: "Kastanek" },
  { group: 6, position: 3, firstName: "Anna", lastName: "Thexton" },
  { group: 6, position: 4, firstName: "Durrell", lastName: "Bostic" },
  // The source workbook contains this same name in all four Group 7 rows.
  { group: 7, position: 1, firstName: "Mark", lastName: "Clifton" },
  { group: 7, position: 2, firstName: "Mark", lastName: "Clifton" },
  { group: 7, position: 3, firstName: "Mark", lastName: "Clifton" },
  { group: 7, position: 4, firstName: "Mark", lastName: "Clifton" },
  { group: 8, position: 1, firstName: "Phil", lastName: "Camping" },
  { group: 8, position: 2, firstName: "PJ", lastName: "Dwiggins" },
  { group: 8, position: 3, firstName: "Nick", lastName: "Garcia" },
  { group: 8, position: 4, firstName: "Teejay", lastName: "Hoch" },
] as const;
