-- Pre-shotgun snapshot of Bulldogs Golf Day.
-- Restores the roster and any day-of activity captured at snapshot time.
-- Anonymous clients hold full write access to every table, so if the ladder
-- gets wiped mid-round, run this in the Supabase SQL editor to recover.
-- Taken: 2026-08-08T03:24:40.318843+00:00

begin;

-- teams: 8 row(s)
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-1', 'Group 1', 'G01', 1, 0, 0, '1842') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-2', 'Group 2', 'G02', 3, 0, 0, '2715') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-3', 'Group 3', 'G03', 5, 0, 0, '3168') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-4', 'Group 4', 'G04', 7, 0, 0, '4093') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-5', 'Group 5', 'G05', 9, 0, 0, '5581') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-6', 'Group 6', 'G06', 11, 0, 0, '6027') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-7', 'Group 7', 'G07', 13, 0, 0, '7344') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;
insert into public.teams (id, name, short, start_hole, mulligans, string_inches, access_code) values ('team-8', 'Group 8', 'G08', 15, 0, 0, '8621') on conflict (id) do update set name = excluded.name, short = excluded.short, start_hole = excluded.start_hole, mulligans = excluded.mulligans, string_inches = excluded.string_inches, access_code = excluded.access_code;

-- players: 32 row(s)
insert into public.players (id, team_id, first_name, last_name, position) values ('team-1-p1', 'team-1', 'Wills', 'Brassil', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-1-p2', 'team-1', 'Mitch', 'Holland', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-1-p3', 'team-1', 'Matt', 'Moore', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-1-p4', 'team-1', 'Drew', 'Wolfe', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-2-p1', 'team-2', 'Rich', 'Mann', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-2-p2', 'team-2', 'Steve', 'Noble', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-2-p3', 'team-2', 'Dan', 'Kerwin', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-2-p4', 'team-2', 'Russell', 'Waugh', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-3-p1', 'team-3', 'Jay', 'Blistan', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-3-p2', 'team-3', 'Miggy', 'Morgan', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-3-p3', 'team-3', 'Travis', 'Bruce', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-3-p4', 'team-3', 'Dan', 'Harris', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-4-p1', 'team-4', 'Jarryd', 'Watters', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-4-p2', 'team-4', 'Andrew', 'Rowling', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-4-p3', 'team-4', 'Matt', 'Klahn', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-4-p4', 'team-4', 'Jay', 'Vay', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-5-p1', 'team-5', 'Alex', 'Shaw', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-5-p2', 'team-5', 'Charly', 'Van Norden', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-5-p3', 'team-5', 'Oz', 'Alkaitis', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-5-p4', 'team-5', 'Lucas', 'Newcomb', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-6-p1', 'team-6', 'Hallie', 'Kastanek', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-6-p2', 'team-6', 'Lindsey', 'Kastanek', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-6-p3', 'team-6', 'Anna', 'Thexton', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-6-p4', 'team-6', 'Durrell', 'Bostic', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-7-p1', 'team-7', 'Mark', 'Clifton', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-7-p2', 'team-7', 'Mark', 'Clifton', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-7-p3', 'team-7', 'Mark', 'Clifton', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-7-p4', 'team-7', 'Mark', 'Clifton', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-8-p1', 'team-8', 'Phil', 'Camping', 1) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-8-p2', 'team-8', 'PJ', 'Dwiggins', 2) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-8-p3', 'team-8', 'Nick', 'Garcia', 3) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;
insert into public.players (id, team_id, first_name, last_name, position) values ('team-8-p4', 'team-8', 'Teejay', 'Hoch', 4) on conflict (id) do update set team_id = excluded.team_id, first_name = excluded.first_name, last_name = excluded.last_name, position = excluded.position;

-- scores: 0 row(s)

-- claims: 0 row(s)

-- orders: 0 row(s)

-- envelopes: 0 row(s)

-- tickets: 0 row(s)

-- photos: 0 row(s)

commit;
