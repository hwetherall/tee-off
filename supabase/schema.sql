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
  access_code text not null,
  start_hole smallint not null check (start_hole between 1 and 18),
  mulligans smallint not null default 0 check (mulligans >= 0),
  string_inches smallint not null default 0 check (string_inches >= 0)
);

alter table public.teams add column if not exists access_code text;
update public.teams
set access_code = case id
  when 'team-1' then '1842'
  when 'team-2' then '2715'
  when 'team-3' then '3168'
  when 'team-4' then '4093'
  when 'team-5' then '5581'
  when 'team-6' then '6027'
  when 'team-7' then '7344'
  when 'team-8' then '8621'
  when 'team-9' then '9450'
  when 'team-10' then '1076'
  else '0000'
end
where access_code is null;
alter table public.teams alter column access_code set not null;

create table if not exists public.players (
  id text primary key,
  team_id text not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  position smallint not null check (position between 1 and 4),
  unique (team_id, position)
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

create unique index if not exists orders_payment_ref_unique
on public.orders (payment_ref)
where payment_ref is not null;

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
alter table public.players enable row level security;
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
drop policy if exists "day-of players" on public.players;
drop policy if exists "day-of orders" on public.orders;
drop policy if exists "day-of envelopes" on public.envelopes;
drop policy if exists "day-of tickets" on public.tickets;
drop policy if exists "day-of photos" on public.photos;
create policy "day-of scores" on public.scores for all to anon using (true) with check (true);
create policy "day-of claims" on public.claims for all to anon using (true) with check (true);
create policy "day-of sales" on public.sales for all to anon using (true) with check (true);
create policy "day-of teams" on public.teams for all to anon using (true) with check (true);
create policy "day-of players" on public.players for all to anon using (true) with check (true);
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

-- Stripe fulfillment is a single transaction: either the paid order and all of
-- its entitlements are recorded once, or none of them are. Only a server-side
-- Supabase secret/service-role key may call this function.
create or replace function public.fulfill_stripe_checkout(
  p_order_id text,
  p_team_id text,
  p_buyer_id text,
  p_lines jsonb,
  p_amount numeric,
  p_payment_ref text,
  p_created_at timestamptz,
  p_mulligan_qty integer,
  p_envelope_ids jsonb,
  p_tickets jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer;
  existing_payment_ref text;
begin
  if p_order_id = '' or p_team_id = '' or p_buyer_id = '' or p_payment_ref = '' then
    raise exception 'Stripe fulfillment identifiers are required';
  end if;
  if p_amount < 0 or p_mulligan_qty < 0 or p_mulligan_qty > 20 then
    raise exception 'Stripe fulfillment values are invalid';
  end if;
  if jsonb_typeof(p_lines) <> 'array'
    or jsonb_typeof(p_envelope_ids) <> 'array'
    or jsonb_typeof(p_tickets) <> 'array' then
    raise exception 'Stripe fulfillment collections must be arrays';
  end if;

  perform 1 from public.teams where id = p_team_id;
  if not found then
    raise exception 'Unknown team for Stripe fulfillment';
  end if;

  insert into public.orders (
    id, team_id, buyer_id, lines, amount, channel, payment_ref, created_at
  ) values (
    p_order_id, p_team_id, p_buyer_id, p_lines, p_amount, 'self', p_payment_ref, p_created_at
  )
  on conflict do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    select payment_ref into existing_payment_ref
    from public.orders
    where id = p_order_id;

    if not found or existing_payment_ref is distinct from p_payment_ref then
      raise exception 'Stripe payment reference conflicts with an existing order';
    end if;
    return false;
  end if;

  insert into public.envelopes (id, order_id, team_id, inches, opened_at)
  select value, p_order_id, p_team_id, null, null
  from jsonb_array_elements_text(p_envelope_ids);

  insert into public.tickets (id, order_id, team_id, number)
  select ticket.id, p_order_id, p_team_id, ticket.number
  from jsonb_to_recordset(p_tickets) as ticket(id text, number text);

  update public.teams
  set mulligans = mulligans + p_mulligan_qty
  where id = p_team_id;

  return true;
end;
$$;

revoke all on function public.fulfill_stripe_checkout(
  text, text, text, jsonb, numeric, text, timestamptz, integer, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.fulfill_stripe_checkout(
  text, text, text, jsonb, numeric, text, timestamptz, integer, jsonb, jsonb
) to service_role;

notify pgrst, 'reload schema';
