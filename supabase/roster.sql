-- Authoritative roster parsed from
-- "V2 Golfers - Denver Bulldogs Group Aug 8.xlsx" (Sheet1, A2:C33).
--
-- The workbook does not include starting holes or four-digit cart-card codes,
-- so those fields retain the existing Group 1-8 event configuration. This
-- transaction resets only team consumables; it does not erase live scores,
-- orders, claims, photos, or other day-of activity.

begin;

alter table public.teams add column if not exists access_code text;

create table if not exists public.players (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  position smallint not null check (position between 1 and 4),
  unique (team_id, position)
);

insert into public.teams (
  id, name, short, access_code, start_hole, mulligans, string_inches
) values
  ('team-1', 'Group 1', 'G01', '1842', 1, 0, 0),
  ('team-2', 'Group 2', 'G02', '2715', 3, 0, 0),
  ('team-3', 'Group 3', 'G03', '3168', 5, 0, 0),
  ('team-4', 'Group 4', 'G04', '4093', 7, 0, 0),
  ('team-5', 'Group 5', 'G05', '5581', 9, 0, 0),
  ('team-6', 'Group 6', 'G06', '6027', 11, 0, 0),
  ('team-7', 'Group 7', 'G07', '7344', 13, 0, 0),
  ('team-8', 'Group 8', 'G08', '8621', 15, 0, 0)
on conflict (id) do update set
  name = excluded.name,
  short = excluded.short,
  access_code = excluded.access_code,
  start_hole = excluded.start_hole,
  mulligans = excluded.mulligans,
  string_inches = excluded.string_inches;

insert into public.players (
  id, team_id, first_name, last_name, position
) values
  ('team-1-p1', 'team-1', 'Wills', 'Brassil', 1),
  ('team-1-p2', 'team-1', 'Mitch', 'Holland', 2),
  ('team-1-p3', 'team-1', 'Matt', 'Moore', 3),
  ('team-1-p4', 'team-1', 'Drew', 'Wolfe', 4),
  ('team-2-p1', 'team-2', 'Rich', 'Mann', 1),
  ('team-2-p2', 'team-2', 'Steve', 'Noble', 2),
  ('team-2-p3', 'team-2', 'Dan', 'Kerwin', 3),
  ('team-2-p4', 'team-2', 'Russell', 'Waugh', 4),
  ('team-3-p1', 'team-3', 'Jay', 'Blistan', 1),
  ('team-3-p2', 'team-3', 'Miggy', 'Morgan', 2),
  ('team-3-p3', 'team-3', 'Travis', 'Bruce', 3),
  ('team-3-p4', 'team-3', 'Dan', 'Harris', 4),
  ('team-4-p1', 'team-4', 'Jarryd', 'Watters', 1),
  ('team-4-p2', 'team-4', 'Andrew', 'Rowling', 2),
  ('team-4-p3', 'team-4', 'Matt', 'Klahn', 3),
  ('team-4-p4', 'team-4', 'Jay', 'Vay', 4),
  ('team-5-p1', 'team-5', 'Alex', 'Shaw', 1),
  ('team-5-p2', 'team-5', 'Charly', 'Van Norden', 2),
  ('team-5-p3', 'team-5', 'Oz', 'Alkaitis', 3),
  ('team-5-p4', 'team-5', 'Lucas', 'Newcomb', 4),
  ('team-6-p1', 'team-6', 'Hallie', 'Kastanek', 1),
  ('team-6-p2', 'team-6', 'Lindsey', 'Kastanek', 2),
  ('team-6-p3', 'team-6', 'Anna', 'Thexton', 3),
  ('team-6-p4', 'team-6', 'Durrell', 'Bostic', 4),
  -- These four duplicate names are present verbatim in the source workbook.
  ('team-7-p1', 'team-7', 'Mark', 'Clifton', 1),
  ('team-7-p2', 'team-7', 'Mark', 'Clifton', 2),
  ('team-7-p3', 'team-7', 'Mark', 'Clifton', 3),
  ('team-7-p4', 'team-7', 'Mark', 'Clifton', 4),
  ('team-8-p1', 'team-8', 'Phil', 'Camping', 1),
  ('team-8-p2', 'team-8', 'PJ', 'Dwiggins', 2),
  ('team-8-p3', 'team-8', 'Nick', 'Garcia', 3),
  ('team-8-p4', 'team-8', 'Teejay', 'Hoch', 4)
on conflict (id) do update set
  team_id = excluded.team_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  position = excluded.position;

delete from public.players
where id not in (
  'team-1-p1', 'team-1-p2', 'team-1-p3', 'team-1-p4',
  'team-2-p1', 'team-2-p2', 'team-2-p3', 'team-2-p4',
  'team-3-p1', 'team-3-p2', 'team-3-p3', 'team-3-p4',
  'team-4-p1', 'team-4-p2', 'team-4-p3', 'team-4-p4',
  'team-5-p1', 'team-5-p2', 'team-5-p3', 'team-5-p4',
  'team-6-p1', 'team-6-p2', 'team-6-p3', 'team-6-p4',
  'team-7-p1', 'team-7-p2', 'team-7-p3', 'team-7-p4',
  'team-8-p1', 'team-8-p2', 'team-8-p3', 'team-8-p4'
);

delete from public.teams
where id not in (
  'team-1', 'team-2', 'team-3', 'team-4',
  'team-5', 'team-6', 'team-7', 'team-8'
);

alter table public.teams alter column access_code set not null;
alter table public.players enable row level security;

drop policy if exists "day-of players" on public.players;
create policy "day-of players" on public.players
for all to anon using (true) with check (true);

notify pgrst, 'reload schema';

commit;
