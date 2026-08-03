# CLAUDE.md — Bulldogs Golf Day (Day-Of App)

## What this is

A phone-first web app used **on the course** during the Denver Bulldogs Golf Day
fundraiser. Four people to a cart, one of them enters the team's score, everyone
else watches the ladder move. Volunteers on a roaming cart use the same app to
sell mulligans and string.

This file covers the **day-of app only**. The pre-event side (registration,
payments, sponsor logos, the draw) is a separate build and is explicitly out of
scope here.

**Primary user:** a golfer on hole 7, one bar of signal, phone in direct
Colorado sun, half a beer in, wearing a glove on one hand.

Everything follows from that sentence. Big tap targets, high contrast, works
offline, never more than two taps to enter a score.

---

## The event (source of truth)

Taken from Jay Blistan's email to golfers, 2 Aug. Treat these as facts; anything
not listed here is an assumption and must be marked as one.

| | |
|---|---|
| Event | Denver Bulldogs Golf Day fundraiser |
| Date | Saturday, 8 August |
| Venue | Applewood Golf Course, 14001 W 32nd Ave, Golden, CO 80401 |
| Format | Scramble, shotgun start |
| Organiser | Jay Blistan, Events Chair — events@denverbulldogs.com, 203-505-5555 |

### Schedule

| Time | What |
|---|---|
| 12:00 pm | Volunteers arrive |
| 12:30 pm | Registration opens, golfers arrive |
| 12:30–1:15 pm | Range and bar open |
| 1:20 pm | Golfers to carts |
| 1:25 pm | Announcements |
| 1:30 pm | Shotgun start |
| ~5:30 pm | Awards and BBQ dinner |

### Registration includes

Gift bag (snacks, bottled water), two drink tickets, range balls, BBQ dinner.

### Prize holes

| Hole | Contest | Run by |
|---|---|---|
| 2 | Closest to the pin | — |
| 12 | Speed hole | Dakota H, David P |
| 15 | Long drive | — |
| 18 | Longest putt | — |
| TBC | Beat the Pro | Harry W, Alex A |

### Fundraising items

| Item | Price | Notes |
|---|---|---|
| Mulligan | $10 | Sold at check-in and from the roaming cart |
| String extender | $20 | Sealed envelope, length 6–24 in revealed after purchase |
| 50/50 raffle ticket | $20 | Pot splits 50/50 with the club |
| Beat the Pro | TBC | Price and mechanics not yet confirmed |

Purchasable in advance **or on the day**, so the app must handle both a
pre-purchased balance and on-course top-ups.

### Volunteers

- All — registration setup, 12:00–12:30
- Harry W, Alex A — Beat the Pro hole
- Dan C, Marcus S — string extender and mulligan sales (check-in, then roaming cart)
- Dakota H, David P — Speed hole

### Known solo groupings

- **Group 1** — Rich Mann, Steve Noble, Russell Waugh, Dan Kerwin
- **Group 2** — Mitch Holland, Drew Wolfe, Matt Moore, 4th TBD

---

## Course data — UNVERIFIED

The prototype ships with a placeholder card: par 71, front 35 / back 36, with
hole 2 and hole 12 as par 3s and hole 15 as a par 5 so the prize holes make
sense. **This is invented.** Before anything goes live, get the real scorecard
from Applewood and replace `COURSE.holes` wholesale. Do not let placeholder
yardages reach a golfer.

---

## Scope

### In

1. Check-in and "what's my team, what's my starting hole"
2. Team score entry, hole by hole
3. Live ladder
4. Prize hole claims, including the speed hole timer
5. Self-serve shop — players buy their own mulligans, string and raffle tickets
6. Volunteer selling mode with a running fundraising total
7. Photo gallery, uploaded from the course
8. Clubhouse view — the big screen in the room
9. Event info reference (schedule, address, what's included)

### Out

Registration, sponsor management, the draw, dinner seating. Anything that
happens before 12:30 pm or after the awards.

### Deliberately not built

- **User accounts.** Nobody is signing up for an account in a golf cart. Entry
  is a QR code or a four-digit team code. That's it.
- **Individual scoring.** It's a scramble. One score per team per hole.
- **Handicaps.** Gross team scores only unless Jay says otherwise. See open questions.

---

## The surfaces

Six tabs on the phone: **Ladder · Card · Prizes · Shop · Photos · Info**.
Six is the ceiling for a bottom bar — do not add a seventh, fold it into an
existing tab instead.

Plus one non-phone surface, the **Clubhouse view**, covered at the end.

### 1. Ladder

The default screen. Team name, holes completed, score to par, position.
Under par shows red, over par shows navy. A team's own row is pinned and
highlighted regardless of position.

Sorting: score to par ascending, then holes completed descending (a team that
is -4 through 12 sits above -4 through 10).

### 2. Card

Score entry. Shows the current hole based on the team's shotgun start position
and how many holes they've completed. Big stepper, par pre-filled as the
default, a confirm button. Once confirmed the hole locks and moves on.

An "edit previous hole" path is required, because someone will always fumble it.
Keep it one level deep — a list of completed holes, tap to correct.

Also tracks consumables: mulligans remaining, string remaining (in inches,
decrementing as they use it).

### 3. Prizes

The four prize holes with the current holder and the mark to beat. Claiming is
open to any player — this is a fundraiser, not a major, and social pressure
handles the honesty problem better than a permissions model.

- Closest to the pin (hole 2) — distance in feet and inches
- Longest putt (hole 18) — distance in feet
- Long drive (hole 15) — distance in yards
- Speed hole (hole 12) — a stopwatch, run by the volunteers on that hole

The speed hole timer is the one screen a volunteer holds for four hours. Make
start/stop enormous and make it survive a page refresh.

### 4. Shop

One tab, two modes, switched by a segmented control at the top.

**Buy for my team** — the self-serve store. Quantity steppers on each product,
a basket, and a single pay button. Apple Pay and Google Pay first, card as the
fallback; nobody is typing a card number on a golf cart. This is real money
moving, so it needs a payments provider (Stripe) and receipts.

What happens after payment matters more than the payment itself:

- **Mulligans** land straight in the team's counter on the Card tab
- **String extender** creates a sealed envelope the player taps to open. Length
  is randomised 6–24 inches at the moment of opening and then added to the
  team's string balance. This mirrors the physical sealed envelope Jay is
  selling, and the reveal is the single most enjoyable moment in the app —
  build it properly, with the seal visibly closed until tapped.
- **50/50 tickets** issue visible ticket numbers so people have something to
  hold and check against the draw

The important thing this unlocks: a group on hole 14 who wants a mulligan no
longer waits for the cart to find them. Expect self-serve to overtake the
roaming cart by mid-afternoon.

**Volunteer sales** — the roaming cart tally for Dan C and Marcus S. Tap to
log, cash and card handled outside the app. This is a tally, not a till.

Both modes write to the same counts, so the fundraising total and the 50/50
pot are one number regardless of how the sale happened. In the prototype the
mode switch is an open toggle; in the real build it is gated to volunteer
accounts.

### 5. Photos

Anyone can add, everyone can see. Camera-first: the add button opens the
camera directly, multiple selection allowed, and uploads queue offline like
scores do. Auto-caption with the team and the hole they're on, because nobody
types a caption in a golf cart.

Photos feed the clubhouse view during the BBQ, which is the actual reason this
tab exists — a club that sees itself on the screen at dinner comes back next
year.

Needs a delete-my-own-photo path and a way for Jay to pull anything down. Keep
moderation to that; a committee of volunteers is not going to review a queue.

### 6. Info

Schedule, address with a maps link, what registration includes, prize hole
list, and Jay's phone number. Static. This is the screen that stops forty
people texting the events chair.

---

### The Clubhouse view

A separate 16:9 layout for the TV in the room. Not a responsive breakpoint of
the phone app — a different screen with different content, sharing the same
data. In the prototype it's a toggle above the device; in production it is its
own URL the club opens on a laptop and casts.

Four blocks:

1. **The ladder** — top 10, large type, readable from the back of the room
2. **The 50/50 pot** — the biggest number on the screen, updating live. A pot
   people can watch grow sells more tickets than a volunteer asking does.
3. **On the course** — all 18 holes across the bottom with team tags showing
   who is where. Prize holes marked in red. This is the block that makes the
   room point at the screen, and it's the one thing the paper system can never
   do.
4. **Hot hands / Gone missing** — the two teams lists nobody asked for and
   everybody watches. Computed on the last three holes relative to par: best
   three are hot, worst three have gone missing. Purely social, zero effect on
   the result, and it gives the MC something to read out.

Design constraints: dark background, no interaction, no scrolling, everything
above the fold. Assume a 55-inch screen viewed from 20 feet and a laptop
nobody will touch after 1 pm. Refresh on a timer, never require a click.

During the BBQ, swap the course block for the photo gallery. That's a mode
switch, not a redesign.

---

## Data model

```
Event    { id, name, date, venue, format, startTime }
Course   { id, name, par, holes: [{ number, par, yards }] }
Team     { id, name, short, startHole, players: [Player], mulligans, stringInches }
Player   { id, name, teamId }
Score    { teamId, hole, strokes, enteredBy, enteredAt, synced }
Claim    { contestId, holeNumber, playerName, teamId, mark, unit, claimedAt }
Product  { id, name, price, description, active }
Order    { id, teamId, buyerId, lines: [{productId, qty}], amount,
           channel: 'self' | 'volunteer', paymentRef, createdAt, synced }
Envelope { id, orderId, teamId, inches, openedAt }
Ticket   { id, orderId, teamId, number }
Photo    { id, teamId, uploaderId, url, hole, takenAt, synced }
```

`short` on Team is the four-character tag used on the clubhouse course strip.

Derived, never stored: ladder position, score to par, current hole
(`(startHole - 1 + holesPlayed) mod 18 + 1`), last-three form, fundraising
total, 50/50 pot. Recompute these; do not cache them into rows that can drift.

`Score`, `Order` and `Photo` all carry a `synced` flag. That flag is the whole
architecture — see below.

---

## Rules of play

- **Scramble.** All four tee off, pick the best ball, all play from there,
  repeat. One score per hole per team.
- **Mulligans** are a re-hit of any shot. Doesn't change scoring logic; just
  decrement the counter.
- **String** substitutes for a putt — the team moves the ball up to the length
  of string they hold and cuts that length off. Track remaining inches.
- **Ties** resolve on countback: back nine, then last six, then last three,
  then last hole. If still tied at the awards, Jay decides. Build the countback,
  because two committee members arguing over a printed sheet at 5:45 pm is
  exactly what this app exists to prevent.

---

## Technical direction

**Stack:** React + Vite + TypeScript, Tailwind. Single-page, no router library
needed for five tabs. Supabase for persistence and realtime when we go live.

**The one hard constraint: offline.** Applewood sits against the foothills and
coverage will be patchy. Assume a group loses signal somewhere on the back nine.

- All writes go to local storage first and render immediately
- A background queue retries against the server
- The UI shows sync state honestly — a small "3 holes waiting to send" line,
  never a spinner that blocks entry
- Conflict resolution: last write wins per `(teamId, hole)`. It's a charity
  scramble; do not build CRDTs.

Build this from the first commit. Retrofitting offline onto a working online app
is a rewrite, not a refactor.

**Two exceptions to offline-first:**

- **Payments must be online.** Do not queue a card charge. If there's no
  signal, tell the player plainly — "No signal here. Try again near the
  clubhouse, or flag down the cart" — and leave the basket intact. Never take
  an order you can't charge for.
- **Photos queue but don't block.** Upload the thumbnail immediately from local
  storage, send the full file when signal returns, and never make someone wait
  on a progress bar mid-round.

**Everything else can be naive.** Polling every 20 seconds is fine for the
ladder. Sixteen teams is not a scale problem.

---

## Design system

Taken from the club crest — royal blue shield, navy outline, red sash, white.

```css
--navy:  #0D1E48   /* headers, over-par scores, text on light */
--royal: #2A4C9E   /* primary actions, active states */
--red:   #D31F2B   /* under-par scores, live indicators, the sash */
--bone:  #F3F2ED   /* app background */
--ink:   #131620   /* body text */
--line:  #DAD8D0   /* dividers */
```

**No green.** A golf app defaults to fairway green and country-club serif. This
is a footy club's fundraiser, so it wears the club's colours instead. The only
green permitted is whatever's outside the cart.

**Type:** Barlow Condensed 700/800 for scores, positions and headers — the
compression reads as scoreboard and as guernsey numbering. Inter for body and
labels. Numerals tabular everywhere so columns don't jitter as scores update.

**Under par is red, over par is navy.** Standard US scorecard convention that
happens to land exactly on the club palette.

**Contrast floor:** this is used outdoors at 1:30 pm in Colorado. Body text at
minimum 7:1 against the background. No light grey on white anywhere. No thin
weights below 16px.

**Tap targets:** 56px minimum on anything used mid-round. Assume a gloved thumb.

---

## Build phases

### Phase 0 — Demo (done, see `prototype.html`)

Single file, hardcoded data, no backend. Exists to show Jay and the committee
what the thing is and to argue about it. Every screen navigable, every
interaction fake but responsive.

### Phase 1 — Real scoring

Ship the ladder and score entry against Supabase with the offline queue. Teams
loaded from a CSV Jay exports. Prize claims included. **This is the minimum
that replaces paper.**

### Phase 2 — Clubhouse and volunteer sales

The TV view and the volunteer tally. Neither needs payments, both are visible
wins, and the clubhouse screen is what the committee will remember.

### Phase 3 — Self-serve shop

Stripe, the basket, the envelope reveal, ticket numbers. Last because it's the
only piece that handles money and therefore the only piece that can go wrong
expensively. **Do not ship this half-finished.** A broken checkout on the day
costs the club more than not having one.

### Phase 4 — Photos and polish

Gallery, the BBQ slideshow, countback, edit history, and a post-event summary
the club can put in a newsletter.

If time runs out, Phase 1 alone is still a better day than a stack of pencils.

---

## Open questions for Jay

**Blocking the build**

1. How many teams, and is it a full 18-group shotgun or are some holes doubled up?
2. Gross scores only, or is there a handicap adjustment on team scores?
3. Can we get the official Applewood scorecard (pars and yardages) before Saturday?
4. Does the club have a Stripe account, or do we route self-serve payments
   through something that already exists? This decides whether the shop is
   possible at all this year.

**Nice to resolve**

5. Beat the Pro — price, which hole, and does it feed the ladder or sit separate?
6. Speed hole — fastest team time wins outright, or is there a stroke penalty component?
7. Is the 50/50 drawn at the BBQ, and does the app need to do the draw?
8. Who owns the photos, and is anyone uncomfortable being on the screen at dinner?
9. Is there a TV in the room at Applewood, and can we plug a laptop into it?
10. Who is the 4th in Group 2?

---

## Rules for the coding agent

- **Never invent event facts.** If it isn't in "The event" section above, ask or
  mark it `// ASSUMPTION:` in the code. Wrong tee times are worse than missing ones.
- Keep the hardcoded demo data in one file, `src/data/demo.ts`, so swapping to
  live data is a single import change.
- Write copy in the club's voice: plain, short, no exclamation marks. "Score
  saved", not "Great job! Your score has been submitted!"
- Buttons say what happens. "Save hole 7", not "Submit".
- Every destructive action is reversible or confirmed. Someone will tap the wrong
  thing on a moving golf cart.
- Do not add a feature that requires signal to work.
- Test everything at 375px wide, in bright light, one-handed.
