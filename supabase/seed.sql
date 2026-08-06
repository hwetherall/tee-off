-- Dummy day-of seed for local / sandbox backends.
-- Run after schema.sql. Safe to re-run: conflicts are ignored.
-- Access codes (app-side only): team-1 = 1842, team-2 = 2715

-- ---------------------------------------------------------------------------
-- Teams (2 groups)
-- ---------------------------------------------------------------------------
insert into public.teams (id, name, short, start_hole, mulligans, string_inches) values
  ('team-1', 'Group 1', 'G01', 1, 2, 18),
  ('team-2', 'Group 2', 'G02', 3, 1, 12)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Scores — a handful of holes each so leaderboards are non-empty
-- ---------------------------------------------------------------------------
insert into public.scores (id, team_id, hole, strokes, entered_by, entered_at) values
  -- team-1 starting hole 1: birdie, par, birdie, par, birdie, par
  ('team-1-h1',  'team-1', 1,  3, 'team-1-p1', now() - interval '90 minutes'),
  ('team-1-h2',  'team-1', 2,  3, 'team-1-p1', now() - interval '80 minutes'),
  ('team-1-h3',  'team-1', 3,  3, 'team-1-p2', now() - interval '70 minutes'),
  ('team-1-h4',  'team-1', 4,  4, 'team-1-p2', now() - interval '60 minutes'),
  ('team-1-h5',  'team-1', 5,  4, 'team-1-p3', now() - interval '50 minutes'),
  ('team-1-h6',  'team-1', 6,  4, 'team-1-p3', now() - interval '40 minutes'),
  -- team-2 starting hole 3: par, birdie, par, birdie, birdie, par
  ('team-2-h3',  'team-2', 3,  4, 'team-2-p1', now() - interval '85 minutes'),
  ('team-2-h4',  'team-2', 4,  3, 'team-2-p1', now() - interval '75 minutes'),
  ('team-2-h5',  'team-2', 5,  5, 'team-2-p2', now() - interval '65 minutes'),
  ('team-2-h6',  'team-2', 6,  3, 'team-2-p2', now() - interval '55 minutes'),
  ('team-2-h7',  'team-2', 7,  2, 'team-2-p3', now() - interval '45 minutes'),
  ('team-2-h8',  'team-2', 8,  4, 'team-2-p3', now() - interval '35 minutes')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Contest claims — one per contest across the two teams
-- ---------------------------------------------------------------------------
insert into public.claims (id, contest_id, hole_number, player_name, team_id, mark, unit, claimed_at) values
  ('claim-closest', 'closest', 2,  'Steve Noble',   'team-1', 62,    'in',  now() - interval '75 minutes'),
  ('claim-speed',   'speed',   12, 'Group 2',       'team-2', 276.4, 'sec', now() - interval '30 minutes'),
  ('claim-drive',   'drive',   15, 'Mitch Holland', 'team-2', 264,   'yd',  now() - interval '20 minutes'),
  ('claim-putt',    'putt',    18, 'Rich Mann',     'team-1', 18,    'ft',  now() - interval '10 minutes')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Volunteer / cash sales (shop ledger)
-- ---------------------------------------------------------------------------
insert into public.sales (id, product, qty, amount, team_id, sold_by, sold_at, string_inches) values
  ('sale-1', 'mulligan', 2, 20, 'team-1', 'Dan C',    now() - interval '2 hours', null),
  ('sale-2', 'raffle',   3, 60, 'team-1', 'Marcus S', now() - interval '90 minutes', null),
  ('sale-3', 'string',   1, 20, 'team-2', 'Dan C',    now() - interval '80 minutes', 14),
  ('sale-4', 'mulligan', 1, 10, 'team-2', 'Marcus S', now() - interval '70 minutes', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Orders + entitlements
-- order-seed-1: team-1 bought 2 mulligans + 2 raffle tickets (self / Stripe)
-- order-seed-2: team-2 bought 1 string envelope (volunteer)
-- ---------------------------------------------------------------------------
insert into public.orders (id, team_id, buyer_id, lines, amount, channel, payment_ref, created_at) values
  (
    'order-seed-1',
    'team-1',
    'team-1-p1',
    '[{"productId":"mulligan","qty":2},{"productId":"raffle","qty":2}]'::jsonb,
    60,
    'self',
    'pi_seed_team1_demo',
    now() - interval '100 minutes'
  ),
  (
    'order-seed-2',
    'team-2',
    'Dan C',
    '[{"productId":"string","qty":1}]'::jsonb,
    20,
    'volunteer',
    null,
    now() - interval '80 minutes'
  )
on conflict (id) do nothing;

insert into public.envelopes (id, order_id, team_id, inches, opened_at) values
  ('envelope-seed-2-1', 'order-seed-2', 'team-2', 14, now() - interval '75 minutes')
on conflict (id) do nothing;

insert into public.tickets (id, order_id, team_id, number) values
  ('ticket-seed-1-1', 'order-seed-1', 'team-1', 'DB-SEED01'),
  ('ticket-seed-1-2', 'order-seed-1', 'team-1', 'DB-SEED02')
on conflict (id) do nothing;
