-- Bulldogs Golf Day day-of tables. Run in the Supabase SQL editor before
-- providing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
create table if not exists public.scores (
  id text primary key,
  team_id text not null,
  hole smallint not null check (hole between 1 and 18),
  strokes smallint not null check (strokes between 1 and 15),
  entered_by text not null,
  entered_at timestamptz not null default now(),
  unique (team_id, hole)
);

create table if not exists public.claims (
  id text primary key,
  contest_id text not null unique,
  hole_number smallint not null,
  player_name text not null,
  team_id text not null,
  mark numeric not null,
  unit text not null,
  claimed_at timestamptz not null default now()
);

create table if not exists public.sales (
  id text primary key,
  product text not null,
  qty smallint not null check (qty > 0),
  amount numeric not null check (amount >= 0),
  team_id text not null,
  sold_by text not null,
  sold_at timestamptz not null default now(),
  string_inches smallint
);

create table if not exists public.teams (
  id text primary key,
  name text not null,
  short text not null,
  start_hole smallint not null check (start_hole between 1 and 18),
  mulligans smallint not null default 0 check (mulligans >= 0),
  string_inches smallint not null default 0 check (string_inches >= 0)
);

create table if not exists public.orders (
  id text primary key,
  team_id text not null,
  buyer_id text not null,
  lines jsonb not null,
  amount numeric not null check (amount >= 0),
  channel text not null check (channel in ('self', 'volunteer')),
  payment_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.envelopes (
  id text primary key,
  order_id text not null,
  team_id text not null,
  inches smallint check (inches between 6 and 24),
  opened_at timestamptz
);

create table if not exists public.tickets (
  id text primary key,
  order_id text not null,
  team_id text not null,
  number text not null unique
);

create table if not exists public.photos (
  id text primary key,
  team_id text not null,
  uploader_id text not null,
  url text not null,
  storage_path text not null,
  hole smallint not null check (hole between 1 and 18),
  taken_at timestamptz not null default now()
);

alter table public.teams add column if not exists short text;
update public.teams set short = upper(left(replace(name, ' ', ''), 4)) where short is null;
alter table public.teams alter column short set not null;

alter table public.scores enable row level security;
alter table public.claims enable row level security;
alter table public.sales enable row level security;
alter table public.teams enable row level security;
alter table public.orders enable row level security;
alter table public.envelopes enable row level security;
alter table public.tickets enable row level security;
alter table public.photos enable row level security;

-- ASSUMPTION: The four-digit team code is the app's only entry control for v1.
-- These event-scoped policies intentionally allow anonymous day-of access.
drop policy if exists "day-of scores" on public.scores;
drop policy if exists "day-of claims" on public.claims;
drop policy if exists "day-of sales" on public.sales;
drop policy if exists "day-of teams" on public.teams;
drop policy if exists "day-of orders" on public.orders;
drop policy if exists "day-of envelopes" on public.envelopes;
drop policy if exists "day-of tickets" on public.tickets;
drop policy if exists "day-of photos" on public.photos;
create policy "day-of scores" on public.scores for all to anon using (true) with check (true);
create policy "day-of claims" on public.claims for all to anon using (true) with check (true);
create policy "day-of sales" on public.sales for all to anon using (true) with check (true);
create policy "day-of teams" on public.teams for all to anon using (true) with check (true);
create policy "day-of orders" on public.orders for all to anon using (true) with check (true);
create policy "day-of envelopes" on public.envelopes for all to anon using (true) with check (true);
create policy "day-of tickets" on public.tickets for all to anon using (true) with check (true);
create policy "day-of photos" on public.photos for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = true;

-- ASSUMPTION: Photo ownership/moderation will move to account-based policies
-- once Jay confirms ownership. The prototype uses event-wide anonymous access.
drop policy if exists "day-of photo files" on storage.objects;
create policy "day-of photo files" on storage.objects
for all to anon using (bucket_id = 'photos') with check (bucket_id = 'photos');
