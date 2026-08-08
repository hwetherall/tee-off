"use client";

import {
  BadgeDollarSign,
  Camera,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flag,
  Info,
  Images,
  LockKeyhole,
  MapPin,
  Medal,
  Minus,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ShoppingBag,
  ShieldCheck,
  Smartphone,
  Trash2,
  Trophy,
  Tv,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTACTS,
  CONTESTS,
  COURSE,
  EVENT,
  PRODUCTS,
  SCHEDULE,
  type Claim,
  type Envelope,
  type MulliganUse,
  type Order,
  type OrderLine,
  type Photo,
  type Score,
  type Team,
} from "@/src/data/demo";
import { PAYMENTS_ENABLED } from "@/src/lib/shop";
import {
  INITIAL_STATE,
  loadCurrentTeam,
  loadState,
  makeBalanceDelta,
  pendingCount,
  pullRemote,
  pushPending,
  reconcile,
  remoteConfigured,
  saveCurrentTeam,
  saveState,
  type AppState,
} from "@/src/lib/local-first";
import { deletePhotoFile, makePhotoThumbnail, savePhotoFile } from "@/src/lib/photos";

type Tab = "ladder" | "card" | "prizes" | "shop" | "photos" | "info";
type ProductId = (typeof PRODUCTS)[number]["id"];
type ContestId = (typeof CONTESTS)[number]["id"];

// Social Upload (Photos tab) is paused for now. Flip to true to bring it back —
// PhotosScreen and sync/upload code stay in place.
const PHOTOS_TAB_ENABLED = false;

const NAV_ITEMS: { id: Tab; label: string; Icon: typeof Trophy }[] = [
  { id: "ladder", label: "Ladder", Icon: Trophy },
  { id: "card", label: "Card", Icon: NotebookPen },
  { id: "prizes", label: "Prizes", Icon: Medal },
  { id: "shop", label: "Shop", Icon: ShoppingBag },
  ...(PHOTOS_TAB_ENABLED ? [{ id: "photos" as const, label: "Photos", Icon: Images }] : []),
  { id: "info", label: "Info", Icon: Info },
];

function makeId(prefix: string) {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function holeSequence(startHole: number) {
  return Array.from({ length: 18 }, (_, index) => ((startHole - 1 + index) % 18) + 1);
}

function teamScores(scores: Score[], teamId: string) {
  return scores.filter((score) => score.teamId === teamId);
}

function scoreToPar(scores: Score[], teamId: string) {
  return teamScores(scores, teamId).reduce(
    (total, score) => total + score.strokes - COURSE.holes[score.hole - 1].par,
    0,
  );
}

function subsetStrokes(scores: Score[], teamId: string, holes: number[]) {
  const subset = new Set(holes);
  return teamScores(scores, teamId)
    .filter((score) => subset.has(score.hole))
    .reduce((total, score) => total + score.strokes, 0);
}

function rankTeams(teams: Team[], scores: Score[]) {
  const sorted = [...teams].sort((a, b) => {
    const aScores = teamScores(scores, a.id);
    const bScores = teamScores(scores, b.id);
    const relative = scoreToPar(scores, a.id) - scoreToPar(scores, b.id);
    if (relative !== 0) return relative;
    if (aScores.length !== bScores.length) return bScores.length - aScores.length;

    if (aScores.length === 18 && bScores.length === 18) {
      const countbackSets = [
        Array.from({ length: 9 }, (_, index) => index + 10),
        Array.from({ length: 6 }, (_, index) => index + 13),
        [16, 17, 18],
        [18],
      ];
      for (const holes of countbackSets) {
        const difference = subsetStrokes(scores, a.id, holes) - subsetStrokes(scores, b.id, holes);
        if (difference !== 0) return difference;
      }
    }
    return a.name.localeCompare(b.name);
  });
  return sorted.map((team, index) => ({
    team,
    position: index + 1,
    holes: teamScores(scores, team.id).length,
    relative: scoreToPar(scores, team.id),
  }));
}

function formatRelative(value: number) {
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `${value}`;
}

function scoreClass(value: number) {
  return value < 0 ? "score-under" : value > 0 ? "score-over" : "score-even";
}

function ordinal(value: number) {
  const lastTwo = value % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
  const suffix = value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

function formatTimer(ms: number) {
  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function formatMark(claim: Claim) {
  if (claim.unit === "in") {
    return `${Math.floor(claim.mark / 12)} ft ${Math.round(claim.mark % 12)} in`;
  }
  if (claim.unit === "sec") return formatTimer(claim.mark * 1000);
  return `${claim.mark} ${claim.unit}`;
}

function contestLeader(claims: Claim[], contestId: ContestId) {
  const contest = CONTESTS.find((item) => item.id === contestId)!;
  return claims
    .filter((claim) => claim.contestId === contestId)
    .reduce<Claim | undefined>((leader, claim) => {
      if (!leader) return claim;
      const wins = contest.direction === "low" ? claim.mark < leader.mark : claim.mark > leader.mark;
      if (wins) return claim;
      if (claim.mark === leader.mark && claim.claimedAt < leader.claimedAt) return claim;
      return leader;
    }, undefined);
}

function ticketBeneficiaryLabel(
  ticket: { beneficiaryType: "team" | "player"; beneficiaryPlayerId: string | null; teamId: string },
  teams: Team[],
) {
  const team = teams.find((item) => item.id === ticket.teamId);
  if (ticket.beneficiaryType === "team") return `Split with ${team?.name ?? "team"}`;
  return team?.players.find((player) => player.id === ticket.beneficiaryPlayerId)?.name ?? "Assigned player";
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark-compact" : ""}`} aria-hidden="true">
      <span>DB</span>
      <i />
    </div>
  );
}

function SyncLine({ online, pending, syncing }: { online: boolean; pending: number; syncing: boolean }) {
  const Icon = online ? Wifi : WifiOff;
  let copy = "Saved on this device";
  if (remoteConfigured && syncing) copy = "Sending saved changes";
  else if (remoteConfigured && pending === 0 && online) copy = "Up to date";
  else if (remoteConfigured && pending > 0) copy = `${pending} ${pending === 1 ? "change" : "changes"} waiting to send`;
  else if (!online) copy = `${pending || 0} saved offline`;
  return (
    <div className="sync-line" role="status">
      <Icon size={14} strokeWidth={2.5} />
      <span>{copy}</span>
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

function ViewModeToggle({
  active,
  onPhone,
  onTv,
  tone = "light",
}: {
  active: "phone" | "tv";
  onPhone: () => void;
  onTv: () => void;
  tone?: "light" | "dark";
}) {
  return (
    <div className={`view-mode view-mode-${tone}`} role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        className={active === "phone" ? "active" : ""}
        aria-selected={active === "phone"}
        onClick={onPhone}
      >
        <Smartphone size={16} />
        <span>Phone</span>
      </button>
      <button
        type="button"
        role="tab"
        className={active === "tv" ? "active" : ""}
        aria-selected={active === "tv"}
        onClick={onTv}
      >
        <Tv size={16} />
        <span>TV</span>
      </button>
    </div>
  );
}

function LadderRow({
  item,
  own = false,
  large = false,
}: {
  item: ReturnType<typeof rankTeams>[number];
  own?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`ladder-row ${own ? "ladder-own" : ""} ${large ? "ladder-large" : ""}`}>
      <div className="position">{item.position}</div>
      <div className="team-cell">
        <strong>{item.team.name}</strong>
        <span>{item.holes === 18 ? "Final" : `Thru ${item.holes}`}{own ? " · Your team" : ""}</span>
      </div>
      <div className={`relative-score ${scoreClass(item.relative)}`}>{formatRelative(item.relative)}</div>
    </div>
  );
}

function LadderScreen({
  state,
  currentTeamId,
  onClubhouse,
}: {
  state: AppState;
  currentTeamId: string;
  onClubhouse: () => void;
}) {
  const ranked = rankTeams(state.teams, state.scores);
  const own = ranked.find((item) => item.team.id === currentTeamId)!;
  const field = ranked.filter((item) => item.team.id !== currentTeamId);

  return (
    <section className="screen ladder-screen">
      <SectionHeader
        eyebrow="Live ladder"
        title="Standings"
        action={
          <ViewModeToggle
            active="phone"
            onPhone={() => undefined}
            onTv={onClubhouse}
          />
        }
      />
      <div className="own-rank-card">
        <div>
          <span>Your position</span>
          <strong>{ordinal(own.position)}</strong>
        </div>
        <div className={`own-score ${scoreClass(own.relative)}`}>{formatRelative(own.relative)}</div>
        <div className="own-progress">{own.holes} / 18 holes</div>
      </div>
      <div className="ladder-table">
        <div className="table-label"><span>Team</span><span>Score</span></div>
        <LadderRow item={own} own />
        <div className="field-divider"><span>Field</span></div>
        {field.map((item) => <LadderRow key={item.team.id} item={item} />)}
      </div>
      <p className="table-note">Ties use back nine, last six, last three, then hole 18 countback.</p>
    </section>
  );
}

function CardScreen({
  state,
  currentTeam,
  onState,
  notify,
  requestConfirm,
}: {
  state: AppState;
  currentTeam: Team;
  onState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (message: string) => void;
  requestConfirm: (options: ConfirmOptions) => void;
}) {
  const completed = teamScores(state.scores, currentTeam.id);
  const sequence = holeSequence(currentTeam.startHole);
  const nextHole = sequence.find((hole) => !completed.some((score) => score.hole === hole));
  const [editHole, setEditHole] = useState<number | null>(null);
  const activeHole = editHole ?? nextHole ?? null;
  const activeScore = activeHole ? completed.find((score) => score.hole === activeHole) : undefined;
  const par = activeHole ? COURSE.holes[activeHole - 1].par : 0;
  // The draft is tagged with the hole it belongs to and falls back to par for any
  // other hole. Deriving it beats resetting in an effect, which left one frame
  // showing the previous hole's number after each save.
  const [draft, setDraft] = useState<{ hole: number; strokes: number } | null>(null);
  const draftStrokes = draft && draft.hole === activeHole ? draft.strokes : activeScore?.strokes ?? par;
  const adjustDraft = (delta: number) => {
    if (!activeHole) return;
    setDraft({ hole: activeHole, strokes: Math.max(1, Math.min(15, draftStrokes + delta)) });
  };
  const [showHistory, setShowHistory] = useState(false);
  const availableStrings = state.envelopes.filter((envelope) => (
    envelope.teamId === currentTeam.id && envelope.collectedAt && !envelope.usedAt
  ));
  const teamTab = state.orders
    .filter((order) => order.teamId === currentTeam.id && !order.paymentRef)
    .reduce((sum, order) => sum + order.amount, 0);

  const saveScore = () => {
    if (!activeHole) return;
    const score: Score = {
      id: `${currentTeam.id}-h${activeHole}`,
      teamId: currentTeam.id,
      hole: activeHole,
      strokes: draftStrokes,
      enteredBy: currentTeam.players[0]?.name ?? currentTeam.name,
      enteredAt: new Date().toISOString(),
      synced: false,
    };
    onState((current) => ({
      ...current,
      scores: [...current.scores.filter((item) => item.id !== score.id), score],
    }));
    notify(editHole ? `Hole ${activeHole} corrected` : `Hole ${activeHole} saved`);
    setEditHole(null);
    setShowHistory(false);
    setDraft(null);
  };

  const burnMulligan = () => {
    const usedAt = new Date().toISOString();
    const use: MulliganUse = {
      id: makeId("mulligan-use"),
      teamId: currentTeam.id,
      usedBy: currentTeam.name,
      usedAt,
      synced: false,
    };
    onState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === currentTeam.id
        ? {
          ...team,
          mulligans: Math.max(0, team.mulligans - 1),
        }
        : team),
      mulliganUses: [...current.mulliganUses, use],
      balanceDeltas: [...current.balanceDeltas, makeBalanceDelta(currentTeam.id, -1, 0)],
    }));
    notify("Mulligan used · no refund available");
  };

  const useMulligan = () => requestConfirm({
    title: "Use one mulligan?",
    body: `${currentTeam.name} will have ${Math.max(0, currentTeam.mulligans - 1)} remaining. This final-sale credit cannot be restored.`,
    confirmLabel: "Use mulligan",
    onConfirm: burnMulligan,
  });

  const useString = () => {
    const string = availableStrings[0];
    if (!string) return;
    requestConfirm({
      title: "Burn this entire string?",
      body: "Each string may be used only once. It cannot be cut, stretched, reused or restored. Measure from the lip of the cup to any part of the ball.",
      confirmLabel: "Yes, burn this string",
      onConfirm: () => {
        onState((current) => ({
          ...current,
          envelopes: current.envelopes.map((envelope) => envelope.id === string.id
            ? { ...envelope, usedAt: new Date().toISOString(), synced: false }
            : envelope),
        }));
        notify("String burned · previous shot counts");
      },
    });
  };

  return (
    <section className="screen scorecard-screen">
      <SectionHeader eyebrow={`${currentTeam.name} · starts hole ${currentTeam.startHole}`} title="Team card" />
      <div className="balance-strip">
        <div><span>Mulligans</span><strong>{currentTeam.mulligans}</strong></div>
        <div><span>Strings ready</span><strong>{availableStrings.length}</strong></div>
      </div>
      {!PAYMENTS_ENABLED && (
        <div className="volunteer-note">
          <BadgeDollarSign />
          <span>
            <strong>Team {currentTeam.id.replace("team-", "")} — ${teamTab} on the tab</strong>
            Harry will text your captain a payment link after the round.
          </span>
        </div>
      )}

      {activeHole ? (
        <div className="score-entry-card">
          <div className="hole-kicker">{editHole ? "Correcting" : "Now scoring"}</div>
          <div className="hole-title-row">
            <div><span>Hole</span><strong>{activeHole}</strong></div>
            <div className="hole-meta"><span>Par {par}</span><span>{COURSE.holes[activeHole - 1].yards} yd</span></div>
          </div>
          <div className="score-stepper" aria-label={`Score for hole ${activeHole}`}>
            <button onClick={() => adjustDraft(-1)} aria-label="Decrease score"><Minus /></button>
            <div><strong>{draftStrokes}</strong><span>{draftStrokes - par === 0 ? "Par" : formatRelative(draftStrokes - par)}</span></div>
            <button onClick={() => adjustDraft(1)} aria-label="Increase score"><Plus /></button>
          </div>
          <button className="primary-button save-score" onClick={saveScore}>
            {editHole ? `Save correction · hole ${activeHole}` : `Save hole ${activeHole}`}
          </button>
          {editHole && <button className="text-button" onClick={() => setEditHole(null)}>Cancel correction</button>}
        </div>
      ) : (
        <div className="round-complete-card"><ShieldCheck /><h2>Card complete</h2><p>All 18 holes are saved.</p></div>
      )}

      <div className="consumables-grid">
        <button onClick={useMulligan} disabled={currentTeam.mulligans === 0}>
          <RotateCcw /><span>Use mulligan</span><small>{currentTeam.mulligans} left</small>
        </button>
        <button onClick={useString} disabled={availableStrings.length === 0}>
          <span className="string-icon">—</span><span>Use whole string</span><small>{availableStrings.length} ready</small>
        </button>
      </div>

      <button className="history-toggle" onClick={() => setShowHistory((value) => !value)}>
        <span><Pencil size={18} /> Edit previous hole</span>
        <ChevronDown className={showHistory ? "rotated" : ""} />
      </button>
      {showHistory && (
        <div className="history-list">
          {[...completed].sort((a, b) => sequence.indexOf(b.hole) - sequence.indexOf(a.hole)).map((score) => (
            <button key={score.id} onClick={() => setEditHole(score.hole)}>
              <span>Hole {score.hole}<small>Par {COURSE.holes[score.hole - 1].par}</small></span>
              <strong>{score.strokes}</strong>
              <ChevronRight size={20} />
            </button>
          ))}
          {completed.length === 0 && <p>No completed holes yet.</p>}
        </div>
      )}
    </section>
  );
}

function PrizesScreen({
  state,
  currentTeam,
  onState,
  notify,
  requestConfirm,
}: {
  state: AppState;
  currentTeam: Team;
  onState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (message: string) => void;
  requestConfirm: (options: ConfirmOptions) => void;
}) {
  const [selected, setSelected] = useState<ContestId>("closest");
  const [claimOpen, setClaimOpen] = useState(false);
  const [speedTeamChoice, setSpeedTeamChoice] = useState("");
  const [playerChoice, setPlayerChoice] = useState("");
  const [feet, setFeet] = useState("0");
  const [inches, setInches] = useState("0");
  const [mark, setMark] = useState("");
  const [now, setNow] = useState(0);
  const contest = CONTESTS.find((item) => item.id === selected)!;
  const holder = contestLeader(state.claims, selected);
  const claimTeam = selected === "speed"
    ? state.teams.find((team) => team.id === speedTeamChoice) ?? currentTeam
    : currentTeam;
  // Derived rather than reset in an effect, so switching team never flashes a
  // player from the previous group in the picker.
  const playerId = claimTeam.players.some((player) => player.id === playerChoice)
    ? playerChoice
    : claimTeam.players[0]?.id ?? "";
  const elapsed = state.timer.elapsedMs
    + (state.timer.runningSince && now ? Math.max(0, now - state.timer.runningSince) : 0);

  // A wall-clock ticker is what effects are for. Seeded once immediately so the
  // readout does not sit a tick behind after Start.
  useEffect(() => {
    if (!state.timer.runningSince) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [state.timer.runningSince]);

  const toggleTimer = () => {
    onState((current) => current.timer.runningSince
      ? {
        ...current,
        timer: {
          elapsedMs: current.timer.elapsedMs + Date.now() - current.timer.runningSince,
          runningSince: null,
        },
      }
      : { ...current, timer: { ...current.timer, runningSince: Date.now() } });
    setNow(Date.now());
  };

  const resetTimer = () => requestConfirm({
    title: "Reset the speed timer?",
    body: "The current time will be cleared. The leading time stays on the prize board.",
    confirmLabel: "Reset timer",
    onConfirm: () => onState((current) => ({ ...current, timer: { runningSince: null, elapsedMs: 0 } })),
  });

  const submitClaim = () => {
    let numericMark = Number(mark);
    if (selected === "closest") numericMark = Number(feet) * 12 + Number(inches);
    if (selected === "speed") numericMark = elapsed / 1000;
    // Zero is legitimate for closest-to-the-pin: a hole in one, or a gimme that
    // measures under half an inch. Only the timed and distance contests need a
    // mark above zero.
    const allowsZero = selected === "closest";
    if (!Number.isFinite(numericMark) || numericMark < 0 || (!allowsZero && numericMark <= 0)) {
      notify("Enter a valid mark");
      return;
    }
    const beatsHolder = !holder || (contest.direction === "low" ? numericMark < holder.mark : numericMark > holder.mark);
    const player = claimTeam.players.find((item) => item.id === playerId);
    if (!player) {
      notify("Choose a player");
      return;
    }
    const claim: Claim = {
      id: makeId("claim"),
      contestId: selected,
      holeNumber: contest.hole,
      playerId: player.id,
      playerName: player.name,
      teamId: claimTeam.id,
      mark: numericMark,
      unit: contest.unit,
      claimedAt: new Date().toISOString(),
      synced: false,
    };
    onState((current) => ({
      ...current,
      claims: [...current.claims, claim],
      timer: selected === "speed" ? { runningSince: null, elapsedMs: 0 } : current.timer,
    }));
    notify(beatsHolder ? `${contest.short} lead updated` : `${contest.short} result saved`);
    setClaimOpen(false);
  };

  return (
    <section className="screen prizes-screen">
      <SectionHeader eyebrow="Prize holes" title="Marks to beat" />
      <div className="contest-tabs" role="tablist" aria-label="Prize holes">
        {CONTESTS.map((item) => (
          <button key={item.id} className={selected === item.id ? "active" : ""} onClick={() => setSelected(item.id)}>
            <span>H{item.hole}</span>{item.short}
          </button>
        ))}
      </div>

      <div className="prize-hero">
        <div className="prize-hole"><Flag size={17} /> Hole {contest.hole}</div>
        <h2>{contest.name}</h2>
        {holder ? (
          <div className="mark-to-beat">
            <span>Mark to beat</span>
            <strong>{formatMark(holder)}</strong>
            <small>{holder.playerName} · {state.teams.find((team) => team.id === holder.teamId)?.name}</small>
          </div>
        ) : (
          <div className="mark-to-beat"><span>No mark yet</span><strong>—</strong><small>Be the first to claim it</small></div>
        )}
      </div>

      {selected === "speed" ? (
        <div className="timer-panel">
          <div className="speed-player-picker">
            <label className="field-label">Team
              <select value={claimTeam.id} onChange={(event) => { setSpeedTeamChoice(event.target.value); setPlayerChoice(""); }}>
                {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <label className="field-label">Player
              <select value={playerId} onChange={(event) => setPlayerChoice(event.target.value)}>
                {claimTeam.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
              </select>
            </label>
          </div>
          <div className={`timer-display ${state.timer.runningSince ? "running" : ""}`}>{formatTimer(elapsed)}</div>
          <button className={`timer-button ${state.timer.runningSince ? "timer-stop" : "timer-start"}`} onClick={toggleTimer}>
            {state.timer.runningSince ? "Stop" : elapsed > 0 ? "Resume" : "Start"}
          </button>
          <div className="timer-actions">
            <button onClick={resetTimer} disabled={elapsed === 0}><RotateCcw size={18} /> Reset</button>
            <button onClick={() => setClaimOpen(true)} disabled={elapsed === 0 || Boolean(state.timer.runningSince)}><Medal size={18} /> Claim time</button>
          </div>
          <p>The timer survives a refresh and works without signal.</p>
        </div>
      ) : (
        <button className="primary-button claim-button" onClick={() => setClaimOpen(true)}><Medal size={21} /> Claim the lead</button>
      )}

      <div className="all-prizes">
        <h3>Prize board</h3>
        {CONTESTS.map((item) => {
          const current = contestLeader(state.claims, item.id);
          return (
            <button key={item.id} onClick={() => setSelected(item.id)}>
              <span className="mini-hole">{item.hole}</span>
              <span><strong>{item.name}</strong><small>{current?.playerName ?? "No claim"}</small></span>
              <b>{current ? formatMark(current) : "—"}</b>
            </button>
          );
        })}
      </div>

      {claimOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="claim-title">
            <button className="modal-close" onClick={() => setClaimOpen(false)} aria-label="Close"><X /></button>
            <span className="eyebrow">Hole {contest.hole}</span>
            <h2 id="claim-title">Claim {contest.short.toLowerCase()}</h2>
            {selected !== "speed" ? (
              <label className="field-label">Player
                <select value={playerId} onChange={(event) => setPlayerChoice(event.target.value)}>
                  {claimTeam.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
              </label>
            ) : <p className="modal-copy">Saving for <strong>{claimTeam.players.find((player) => player.id === playerId)?.name}</strong> · {claimTeam.name}</p>}
            {selected === "closest" ? (
              <div className="split-inputs">
                <label className="field-label">Feet<input inputMode="numeric" type="number" min="0" value={feet} onChange={(event) => setFeet(event.target.value)} /></label>
                <label className="field-label">Inches<input inputMode="numeric" type="number" min="0" max="11" value={inches} onChange={(event) => setInches(event.target.value)} /></label>
              </div>
            ) : selected === "speed" ? (
              <div className="claim-time-readout">{formatTimer(elapsed)}</div>
            ) : (
              <label className="field-label">{selected === "drive" ? "Yards" : "Feet"}
                <input inputMode="decimal" type="number" min="0" step="0.1" value={mark} onChange={(event) => setMark(event.target.value)} autoFocus />
              </label>
            )}
            <button className="primary-button" onClick={submitClaim}>Save result</button>
          </div>
        </div>
      )}
    </section>
  );
}

// Module scope so it is a stable reference: as a value rebuilt each render it
// made every basket effect re-run on every keystroke.
const EMPTY_CART = { mulligan: 0, string: 0, splits: 0 } satisfies Record<ProductId, number>;

function orderQuantity(order: Order, productId: ProductId) {
  return order.lines.find((line) => line.productId === productId)?.qty ?? 0;
}

function basketLines(cart: Record<ProductId, number>, splitsBeneficiary: string): OrderLine[] {
  return PRODUCTS
    .filter((product) => cart[product.id] > 0)
    .map((product) => product.id === "splits"
      ? {
        productId: product.id,
        qty: cart[product.id],
        beneficiaryType: splitsBeneficiary === "team" ? "team" : "player",
        beneficiaryPlayerId: splitsBeneficiary === "team" ? null : splitsBeneficiary,
      }
      : { productId: product.id, qty: cart[product.id] });
}

function applyOrder(
  current: AppState,
  order: Order,
  envelopeIds: string[],
  ticketData: Array<{
    id: string;
    number: string;
    beneficiaryType: "team" | "player";
    beneficiaryPlayerId: string | null;
  }>,
) {
  if (current.orders.some((item) => item.id === order.id)) return current;
  const mulligans = orderQuantity(order, "mulligan");
  const fulfilledServerSide = Boolean(order.paymentRef);
  const envelopes: Envelope[] = envelopeIds.map((id) => ({
    id,
    orderId: order.id,
    teamId: order.teamId,
    inches: null,
    openedAt: null,
    collectedAt: null,
    usedAt: null,
    synced: fulfilledServerSide,
  }));
  const tickets = ticketData.map((ticket) => ({
    ...ticket,
    orderId: order.id,
    teamId: order.teamId,
    synced: fulfilledServerSide,
  }));
  // A Stripe order and its items are written server-side by the webhook. The
  // confirmation copy is display-only; pushing it from the browser could race
  // the webhook and leave a paid order without its credits. An order with no
  // payment reference (volunteer sale or IOU tab purchase) never touches the
  // webhook, so there the device owns every pending write.
  const clientOwnsCredit = !order.paymentRef;
  return {
    ...current,
    orders: [...current.orders, order],
    envelopes: [...current.envelopes, ...envelopes],
    tickets: [...current.tickets, ...tickets],
    teams: current.teams.map((team) => team.id === order.teamId
      ? { ...team, mulligans: team.mulligans + mulligans }
      : team),
    balanceDeltas: mulligans && clientOwnsCredit
      ? [...current.balanceDeltas, makeBalanceDelta(order.teamId, mulligans, 0)]
      : current.balanceDeltas,
  };
}

function ProductPicker({
  cart,
  onAdjust,
}: {
  cart: Record<ProductId, number>;
  onAdjust: (product: ProductId, amount: number) => void;
}) {
  return (
    <div className="product-grid">
      {PRODUCTS.map((product) => (
        <div className={`product-card ${cart[product.id] ? "selected" : ""}`} key={product.id}>
          <button className="product-main" onClick={() => onAdjust(product.id, 1)}>
            <span>{product.id === "mulligan" ? <RotateCcw /> : product.id === "string" ? <span className="string-icon">—</span> : <CircleDollarSign />}</span>
            <strong>{product.name}</strong>
            <b>${product.price}</b>
            <small>{product.note}</small>
          </button>
          <div className="quantity-control">
            <button onClick={() => onAdjust(product.id, -1)} aria-label={`Remove ${product.name}`}><Minus /></button>
            <strong>{cart[product.id]}</strong>
            <button onClick={() => onAdjust(product.id, 1)} aria-label={`Add ${product.name}`}><Plus /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SplitsBeneficiaryPicker({
  team,
  value,
  onChange,
}: {
  team: Team;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field-label beneficiary-picker">Banana Splits entry belongs to
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="team">Split with {team.name}</option>
        {team.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
      </select>
      <small>Applies to every Banana Splits number in this basket.</small>
    </label>
  );
}

function ShopScreen({
  state,
  currentTeam,
  online,
  onState,
  notify,
  requestConfirm,
}: {
  state: AppState;
  currentTeam: Team;
  online: boolean;
  onState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (message: string) => void;
  requestConfirm: (options: ConfirmOptions) => void;
}) {
  const [mode, setMode] = useState<"self" | "volunteer">("self");
  const [selfCart, setSelfCart] = useState<Record<ProductId, number>>(EMPTY_CART);
  const [volunteerCart, setVolunteerCart] = useState<Record<ProductId, number>>(EMPTY_CART);
  const [teamId, setTeamId] = useState(currentTeam.id);
  const [seller, setSeller] = useState("Dan C");
  const [selfSplitsBeneficiary, setSelfSplitsBeneficiary] = useState("team");
  const [volunteerSplitsBeneficiary, setVolunteerSplitsBeneficiary] = useState("team");
  const [checkingOut, setCheckingOut] = useState(false);
  const confirmationHandled = useRef(false);
  const paymentReady = process.env.NEXT_PUBLIC_SHOP_ENABLED === "true";
  const basketKey = `bulldogs-basket-${currentTeam.id}`;
  const selfTotal = PRODUCTS.reduce((sum, product) => sum + selfCart[product.id] * product.price, 0);
  const volunteerTotal = PRODUCTS.reduce((sum, product) => sum + volunteerCart[product.id] * product.price, 0);
  const dayTotal = state.orders.reduce((sum, order) => sum + order.amount, 0);
  const splitsTotal = state.orders.reduce((sum, order) => sum + orderQuantity(order, "splits") * 20, 0);
  const teamEnvelopes = state.envelopes.filter((envelope) => envelope.teamId === currentTeam.id);
  const teamTickets = state.tickets.filter((ticket) => ticket.teamId === currentTeam.id);
  const volunteerTeam = state.teams.find((team) => team.id === teamId) ?? currentTeam;
  const selfBeneficiary = selfSplitsBeneficiary === "team"
    || currentTeam.players.some((player) => player.id === selfSplitsBeneficiary)
    ? selfSplitsBeneficiary
    : "team";
  const volunteerBeneficiary = volunteerSplitsBeneficiary === "team"
    || volunteerTeam.players.some((player) => player.id === volunteerSplitsBeneficiary)
    ? volunteerSplitsBeneficiary
    : "team";

  // Restores the basket the golfer left behind when they switch team or come back
  // from Stripe. localStorage is client-only, so a mount effect is the right home.
  useEffect(() => {
    const saved = window.localStorage.getItem(basketKey);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (saved) {
      try { setSelfCart(JSON.parse(saved)); } catch { setSelfCart(EMPTY_CART); }
    } else {
      setSelfCart(EMPTY_CART);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [basketKey]);

  useEffect(() => {
    window.localStorage.setItem(basketKey, JSON.stringify(selfCart));
  }, [basketKey, selfCart]);

  useEffect(() => {
    if (confirmationHandled.current) return;
    const params = new URLSearchParams(window.location.search);
    const shopResult = params.get("shop");
    if (shopResult === "cancelled") {
      confirmationHandled.current = true;
      notify("Checkout cancelled · basket kept");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const sessionId = params.get("session_id");
    if (shopResult !== "success" || !sessionId) return;
    confirmationHandled.current = true;
    // Reacting to the Stripe redirect in the URL, which is external state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCheckingOut(true);
    fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const order = result.order as Order;
        onState((current) => applyOrder(current, order, result.envelopeIds, result.tickets));
        setSelfCart(EMPTY_CART);
        window.localStorage.removeItem(`bulldogs-basket-${order.teamId}`);
        notify("Payment received · items added");
      })
      .catch(() => notify("Payment needs checking · contact Jay"))
      .finally(() => {
        setCheckingOut(false);
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, [notify, onState]);

  const adjustSelf = (product: ProductId, amount: number) => {
    setSelfCart((current) => ({ ...current, [product]: Math.max(0, Math.min(20, current[product] + amount)) }));
  };
  const adjustVolunteer = (product: ProductId, amount: number) => {
    setVolunteerCart((current) => ({ ...current, [product]: Math.max(0, Math.min(20, current[product] + amount)) }));
  };

  const putOnTab = () => {
    const lines = basketLines(selfCart, selfBeneficiary);
    if (!lines.length) return;
    const orderId = makeId("order");
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    const order: Order = {
      id: orderId,
      teamId: currentTeam.id,
      buyerId: currentTeam.id,
      lines,
      amount: selfTotal,
      channel: "self",
      paymentRef: null,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    onState((current) => applyOrder(
      current,
      order,
      Array.from({ length: selfCart.string }, (_, index) => `envelope-${orderId}-${index + 1}`),
      Array.from({ length: selfCart.splits }, (_, index) => ({
        id: `ticket-${orderId}-${index + 1}`,
        number: `DB-${stamp}-${String(index + 1).padStart(2, "0")}`,
        beneficiaryType: selfBeneficiary === "team" ? "team" as const : "player" as const,
        beneficiaryPlayerId: selfBeneficiary === "team" ? null : selfBeneficiary,
      })),
    ));
    setSelfCart(EMPTY_CART);
    notify(`Added to Team ${currentTeam.id.replace("team-", "")}'s tab. Harry will send a payment link after the round.`);
  };

  const checkout = async () => {
    if (!PAYMENTS_ENABLED) {
      putOnTab();
      return;
    }
    if (!online) {
      notify("No signal here. Try again near the clubhouse, or flag down the cart");
      return;
    }
    if (!paymentReady) {
      notify("Payments are not connected yet");
      return;
    }
    const lines = basketLines(selfCart, selfBeneficiary);
    if (!lines.length) return;
    setCheckingOut(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: currentTeam.id, lines }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error);
      window.location.assign(result.url);
    } catch {
      notify("Checkout is unavailable. Your basket is still here");
      setCheckingOut(false);
    }
  };

  const saveVolunteerOrder = () => {
    if (!volunteerTotal) return;
    const orderId = makeId("order");
    const lines = basketLines(volunteerCart, volunteerBeneficiary);
    const order: Order = {
      id: orderId,
      teamId,
      buyerId: seller,
      lines,
      amount: volunteerTotal,
      channel: "volunteer",
      paymentRef: null,
      createdAt: new Date().toISOString(),
      synced: false,
    };
    const stringQty = volunteerCart.string;
    const splitsQty = volunteerCart.splits;
    const stamp = Date.now().toString(36).toUpperCase().slice(-6);
    onState((current) => applyOrder(
      current,
      order,
      Array.from({ length: stringQty }, (_, index) => `envelope-${orderId}-${index + 1}`),
      Array.from({ length: splitsQty }, (_, index) => ({
        id: `ticket-${orderId}-${index + 1}`,
        number: `DB-${stamp}-${String(index + 1).padStart(2, "0")}`,
        beneficiaryType: volunteerBeneficiary === "team" ? "team" as const : "player" as const,
        beneficiaryPlayerId: volunteerBeneficiary === "team" ? null : volunteerBeneficiary,
      })),
    ));
    setVolunteerCart(EMPTY_CART);
    notify(`$${volunteerTotal} sale saved`);
  };

  const collectEnvelope = (envelope: Envelope) => requestConfirm({
    title: "Collect this string?",
    body: "Show this voucher to the volunteer first. Confirm only after the sealed physical string has been handed to your team.",
    confirmLabel: "String received",
    onConfirm: () => {
      onState((current) => ({
        ...current,
        envelopes: current.envelopes.map((item) => item.id === envelope.id
          ? { ...item, collectedAt: new Date().toISOString(), synced: false }
          : item),
      }));
      notify("String collected · ready to use once");
    },
  });

  return (
    <section className="screen shop-screen">
      <SectionHeader eyebrow="Fundraising shop" title="Buy on the course" />
      <div className="shop-mode" role="tablist" aria-label="Shop mode">
        <button className={mode === "self" ? "active" : ""} onClick={() => setMode("self")}><ShoppingBag /> Buy for my team</button>
        <button className={mode === "volunteer" ? "active" : ""} onClick={() => setMode("volunteer")}><BadgeDollarSign /> Volunteer sales</button>
      </div>
      {!PAYMENTS_ENABLED && (
        <div className="payment-setup">
          <BadgeDollarSign />
          <span><strong>Card payments are down today.</strong>Buy now, settle up tonight — we’ll text your captain a link.</span>
        </div>
      )}
      <div className="sales-total-card compact-totals">
        <div><span>Raised today</span><strong>${dayTotal.toLocaleString()}</strong></div>
        <div><span>Banana Splits pot</span><strong>${splitsTotal.toLocaleString()}</strong><small>${(splitsTotal / 2).toLocaleString()} to winner</small></div>
      </div>

      {mode === "self" ? (
        <>
          <div className="string-rules-card">
            <span className="string-icon">—</span>
            <span><strong>String is single-use</strong>Measure from the lip of the cup to any part of the ball. Do not cut, stretch or reuse it.</span>
          </div>
          {(teamEnvelopes.length > 0 || teamTickets.length > 0) && (
            <div className="my-purchases">
              <h3>Your team’s items</h3>
              {teamEnvelopes.map((envelope) => (
                <button
                  key={envelope.id}
                  className={`sealed-envelope ${envelope.collectedAt ? "opened" : ""} ${envelope.usedAt ? "used" : ""}`}
                  onClick={() => collectEnvelope(envelope)}
                  disabled={Boolean(envelope.collectedAt)}
                >
                  <span className="envelope-flap"><i /></span>
                  <span>
                    {envelope.usedAt ? "String used" : envelope.collectedAt ? "Physical string ready" : "String collection voucher"}
                    <small>{envelope.usedAt
                      ? `Burned ${new Date(envelope.usedAt).toLocaleString()}`
                      : envelope.collectedAt
                        ? "Available on your Card · use whole once"
                        : "Show volunteer, then tap to confirm collection"}</small>
                  </span>
                  {envelope.collectedAt ? <ShieldCheck /> : <LockKeyhole />}
                </button>
              ))}
              {teamTickets.length > 0 && (
                <div className="ticket-wallet">
                  <span>Banana Splits numbers</span>
                  <div>{teamTickets.map((ticket) => (
                    <span className="ticket-chip" key={ticket.id}>
                      <strong>{ticket.number}</strong>
                      <small>{ticketBeneficiaryLabel(ticket, state.teams)}</small>
                    </span>
                  ))}</div>
                </div>
              )}
            </div>
          )}
          {PAYMENTS_ENABLED && !paymentReady && <div className="payment-setup"><LockKeyhole /><span><strong>Payments need setup</strong>Connect the club’s Stripe account before enabling checkout.</span></div>}
          {PAYMENTS_ENABLED && !online && <div className="no-signal-shop"><WifiOff /><span>No signal here. Your basket stays put; try again near the clubhouse or flag down the cart.</span></div>}
          <ProductPicker cart={selfCart} onAdjust={adjustSelf} />
          {selfCart.splits > 0 && (
            <SplitsBeneficiaryPicker team={currentTeam} value={selfBeneficiary} onChange={setSelfSplitsBeneficiary} />
          )}
          {/* The pay bar only pins itself once there is something to pay for.
              An empty basket used to float a 194px card over two of the three
              products, so you had to scroll to discover most of the shop. */}
          <div className={`sale-checkout shop-checkout ${selfTotal > 0 ? "shop-checkout-pinned" : ""}`}>
            <div className="shop-checkout-row">
              <div><span>Basket</span><strong>${selfTotal}</strong></div>
              <button className="primary-button" disabled={selfTotal === 0 || checkingOut} onClick={checkout}>
                {checkingOut ? "Opening payment" : !PAYMENTS_ENABLED ? "Put it on the tab" : paymentReady ? `Pay $${selfTotal}` : "Payments not connected"}
              </button>
            </div>
          </div>
          {PAYMENTS_ENABLED && <p className="shop-payment-note">Apple Pay or Google Pay when available. Card is the fallback. Stripe collects an email for the receipt.</p>}
        </>
      ) : (
        <>
          <div className="volunteer-note"><BadgeDollarSign /><span><strong>Roaming cart tally</strong>Cash and card are handled outside this app.</span></div>
          <div className="seller-row">
            <label className="field-label">Selling as
              <select value={seller} onChange={(event) => setSeller(event.target.value)}><option>Dan C</option><option>Marcus S</option></select>
            </label>
            <label className="field-label">Assign to
              <select value={teamId} onChange={(event) => { setTeamId(event.target.value); setVolunteerSplitsBeneficiary("team"); }}>
                {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
          </div>
          <ProductPicker cart={volunteerCart} onAdjust={adjustVolunteer} />
          {volunteerCart.splits > 0 && (
            <SplitsBeneficiaryPicker team={volunteerTeam} value={volunteerBeneficiary} onChange={setVolunteerSplitsBeneficiary} />
          )}
          <div className="sale-checkout">
            <div><span>Sale total</span><strong>${volunteerTotal}</strong></div>
            <button className="primary-button" disabled={volunteerTotal === 0} onClick={saveVolunteerOrder}>Save ${volunteerTotal} sale</button>
            <p>String creates a collection voucher. Banana Splits numbers keep the selected beneficiary.</p>
          </div>
        </>
      )}
    </section>
  );
}

function PhotosScreen({
  state,
  currentTeam,
  onState,
  notify,
  requestConfirm,
}: {
  state: AppState;
  currentTeam: Team;
  onState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (message: string) => void;
  requestConfirm: (options: ConfirmOptions) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [moderating, setModerating] = useState(false);
  const played = teamScores(state.scores, currentTeam.id).length;
  // A finished team stays on their last hole rather than wrapping to the start.
  const sequence = holeSequence(currentTeam.startHole);
  const currentHole = sequence[Math.min(played, 17)];
  const photos = [...state.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt));

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setAdding(true);
    const additions: Photo[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const id = makeId("photo");
        const thumbnail = await makePhotoThumbnail(file);
        await savePhotoFile(id, file);
        additions.push({
          id,
          teamId: currentTeam.id,
          uploaderId: currentTeam.players[0]?.id ?? currentTeam.id,
          url: null,
          thumbnail,
          storagePath: null,
          hole: currentHole,
          takenAt: new Date().toISOString(),
          synced: false,
          mine: true,
        });
      } catch {
        notify("One photo could not be added");
      }
    }
    if (additions.length) {
      onState((current) => ({ ...current, photos: [...current.photos, ...additions] }));
      notify(`${additions.length} ${additions.length === 1 ? "photo" : "photos"} saved`);
    }
    setAdding(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePhoto = (photo: Photo) => requestConfirm({
    title: "Delete this photo?",
    body: "It will be removed from the gallery. This cannot be undone on this device.",
    confirmLabel: "Delete photo",
    onConfirm: () => {
      onState((current) => ({
        ...current,
        photos: current.photos.filter((item) => item.id !== photo.id),
        photoDeletes: photo.synced
          ? [...current.photoDeletes, { id: photo.id, storagePath: photo.storagePath }]
          : current.photoDeletes,
      }));
      void deletePhotoFile(photo.id);
      notify("Photo deleted");
    },
  });

  return (
    <section className="screen photos-screen">
      <SectionHeader
        eyebrow="From the course"
        title="Golf day photos"
        action={<button className="icon-action camera-action" onClick={() => inputRef.current?.click()} aria-label="Add photos"><Camera /></button>}
      />
      <input ref={inputRef} className="photo-input" type="file" accept="image/*" capture="environment" multiple onChange={(event) => void addPhotos(event.target.files)} />
      <button className="primary-button add-photo-button" onClick={() => inputRef.current?.click()} disabled={adding}>
        <Camera /> {adding ? "Preparing photos" : "Take or add photos"}
      </button>
      <div className="photo-caption-note"><Images /><span>Photos are captioned automatically with {currentTeam.name} and hole {currentHole}. Uploads wait safely when signal drops.</span></div>
      <button className={`moderation-toggle ${moderating ? "active" : ""}`} onClick={() => setModerating((value) => !value)}>
        <ShieldCheck /><span><strong>Volunteer photo tools</strong><small>Open in the prototype · account-gated when live</small></span>
      </button>
      {photos.length ? (
        <div className="photo-grid">
          {photos.map((photo) => {
            const team = state.teams.find((item) => item.id === photo.teamId);
            return (
              <article key={photo.id} className="photo-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumbnail || photo.url || ""} alt={`${team?.name ?? "Team"} on hole ${photo.hole}`} />
                <div><span>{team?.short ?? "TEAM"} · H{photo.hole}</span><small>{photo.synced ? "Shared" : "Waiting to send"}</small></div>
                {(photo.mine || moderating) && <button onClick={() => removePhoto(photo)} aria-label="Delete photo"><Trash2 /></button>}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="photos-empty"><Camera /><h2>First photo is open</h2><p>Add one from the course. It will appear here and on the BBQ screen.</p></div>
      )}
    </section>
  );
}

function InfoScreen({ onClubhouse }: { onClubhouse: (mode: "course") => void }) {
  return (
    <section className="screen info-screen">
      <SectionHeader eyebrow="Event reference" title="Golf day info" />
      <div className="event-hero-card">
        <BrandMark />
        <div><span>{EVENT.date}</span><h2>{EVENT.venue}</h2><p>{EVENT.format}</p></div>
      </div>
      <div className="info-card venue-card">
        <div className="info-card-title"><MapPin /><h3>Applewood Golf Course</h3></div>
        <p>{EVENT.address}</p>
        <a className="outline-button" href="https://www.google.com/maps/search/?api=1&query=Applewood+Golf+Course+14001+W+32nd+Ave+Golden+CO+80401" target="_blank" rel="noreferrer">Open in maps <ExternalLink size={18} /></a>
      </div>
      <div className="info-card">
        <div className="info-card-title"><Clock3 /><h3>Day schedule</h3></div>
        <div className="schedule-list">
          {SCHEDULE.map(([time, item]) => <div key={`${time}-${item}`}><strong>{time}</strong><span>{item}</span></div>)}
        </div>
      </div>
      <div className="info-card">
        <div className="info-card-title"><ShieldCheck /><h3>Your registration includes</h3></div>
        <ul className="check-list"><li>Gift bag with snacks and bottled water</li><li>Two drink tickets</li><li>Range balls</li><li>BBQ dinner</li></ul>
      </div>
      <div className="info-card">
        <div className="info-card-title"><Trophy /><h3>Prize holes</h3></div>
        <div className="prize-reference">
          <div><b>2</b><span>Closest to the pin</span></div>
          <div><b>12</b><span>Speed hole · Dakota H, David P</span></div>
          <div><b>15</b><span>Long drive</span></div>
          <div><b>18</b><span>Longest putt</span></div>
        </div>
      </div>
      <div className="info-card clubhouse-links">
        <div className="info-card-title"><Tv /><h3>Clubhouse screen</h3></div>
        <p>Open the cast-ready 16:9 course view on the clubhouse laptop.</p>
        <div><button className="outline-button" onClick={() => onClubhouse("course")}>Course view</button></div>
      </div>
      <div className="info-card contact-card">
        <div className="info-card-title"><Phone /><h3>Need help?</h3></div>
        <p>Tap any name to call. Someone will pick up.</p>
        <div className="contact-list">
          {CONTACTS.map((contact) => (
            <a key={contact.tel} href={`tel:${contact.tel}`}>
              <span>
                <strong>{contact.name}</strong>
                {contact.role && <small>{contact.role}</small>}
              </span>
              <b>{contact.display}</b>
              <Phone size={18} />
            </a>
          ))}
        </div>
        <a className="email-link" href="mailto:events@denverbulldogs.com">events@denverbulldogs.com</a>
      </div>
    </section>
  );
}

function lastThreeForm(team: Team, scores: Score[]) {
  const sequence = holeSequence(team.startHole);
  const played = teamScores(scores, team.id);
  const lastThree = [...played]
    .sort((a, b) => sequence.indexOf(a.hole) - sequence.indexOf(b.hole))
    .slice(-3);
  if (lastThree.length < 3) return null;
  return lastThree.reduce((total, score) => total + score.strokes - COURSE.holes[score.hole - 1].par, 0);
}

function ClubhouseView({
  state,
  mode,
  onClose,
}: {
  state: AppState;
  mode: "course" | "bbq";
  onClose: () => void;
}) {
  const ranked = rankTeams(state.teams, state.scores);
  const splitsTotal = state.orders.reduce((sum, order) => sum + orderQuantity(order, "splits") * 20, 0);
  const form = state.teams
    .map((team) => ({ team, value: lastThreeForm(team, state.scores) }))
    .filter((item): item is { team: Team; value: number } => item.value !== null);
  const hot = [...form].sort((a, b) => a.value - b.value).slice(0, 3);
  const missing = [...form].sort((a, b) => b.value - a.value).slice(0, 3);
  const prizeHoles = new Set<number>(CONTESTS.map((contest) => contest.hole));
  const gallery = [...state.photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, 6);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <main className={`clubhouse-view clubhouse-dashboard mode-${mode}`}>
      <header>
        <div className="clubhouse-brand"><BrandMark /><div><span>Denver Bulldogs</span><h1>{mode === "bbq" ? "Golf Day · BBQ" : "Golf Day · On Course"}</h1></div></div>
        <div className="clubhouse-meta">
          <span><i /> Live</span>
          <strong>{clock}</strong>
          <ViewModeToggle
            active="tv"
            tone="dark"
            onPhone={onClose}
            onTv={() => undefined}
          />
        </div>
      </header>
      <div className="clubhouse-top-grid">
        <section className="clubhouse-board">
          <div className="clubhouse-block-title"><span>Live ladder</span><small>{ranked.length > 10 ? "Top 10" : "All groups"}</small></div>
          <div className="clubhouse-table-head"><span>Pos</span><span>Team</span><span>Holes</span><span>Score</span></div>
          {ranked.slice(0, 10).map((item) => (
            <div className="clubhouse-row" key={item.team.id}>
              <span className="clubhouse-pos">{item.position}</span>
              <strong>{item.team.name}</strong>
              <span>{item.holes === 18 ? "Final" : item.holes}</span>
              <b className={scoreClass(item.relative)}>{formatRelative(item.relative)}</b>
            </div>
          ))}
        </section>
        <aside className="clubhouse-pot">
          <CircleDollarSign />
          <span>Live Banana Splits pot</span>
          <strong>${splitsTotal.toLocaleString()}</strong>
          <b>${(splitsTotal / 2).toLocaleString()} to the winner</b>
          <small>Banana Splits are $20 in the app or from the roaming cart</small>
        </aside>
      </div>
      <div className="clubhouse-lower-grid">
        {mode === "course" ? (
          <section className="course-strip-block">
            <div className="clubhouse-block-title"><span>On the course</span><small>Prize holes in red</small></div>
            <div className="course-strip">
              {COURSE.holes.map((hole) => {
                const here = state.teams.filter((team) => {
                  const played = teamScores(state.scores, team.id).length;
                  return played < 18 && holeSequence(team.startHole)[played] === hole.number;
                });
                return (
                  <div key={hole.number} className={prizeHoles.has(hole.number) ? "prize-hole-cell" : ""}>
                    <b>{hole.number}</b>
                    <span>{here.map((team) => <i key={team.id}>{team.short}</i>)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="clubhouse-gallery-block">
            <div className="clubhouse-block-title"><span>Today on the course</span><small>Latest photos</small></div>
            {gallery.length ? (
              <div className="clubhouse-gallery">
                {gallery.map((photo) => {
                  const team = state.teams.find((item) => item.id === photo.teamId);
                  return (
                    <figure key={photo.id}>
                      {/* Sources are local data URIs and Supabase public URLs; the
                          next/image loader adds nothing here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.thumbnail || photo.url || ""} alt="" />
                      <figcaption>{team?.short} · H{photo.hole}</figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : <div className="clubhouse-no-photos"><Camera /><span>Course photos will appear here</span></div>}
          </section>
        )}
        {/* Form needs three scored holes, so this block is empty for the first
            stretch after the shotgun. Say so rather than showing a bare box. */}
        <section className="form-block">
          <div className="form-column hot-form">
            <span>Hot hands</span>
            {hot.length
              ? hot.map((item) => <div key={item.team.id}><b>{item.team.short}</b><strong>{item.team.name}</strong><em>{formatRelative(item.value)}</em></div>)
              : <p className="form-empty">After three holes</p>}
          </div>
          <div className="form-column missing-form">
            <span>Gone missing</span>
            {missing.length
              ? missing.map((item) => <div key={item.team.id}><b>{item.team.short}</b><strong>{item.team.name}</strong><em>{formatRelative(item.value)}</em></div>)
              : <p className="form-empty">After three holes</p>}
          </div>
        </section>
      </div>
      <footer><span>Applewood Golf Course · {EVENT.date}</span><span>Updates every 20 seconds</span></footer>
    </main>
  );
}

type ConfirmOptions = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <h2 id="confirm-title">{options.title}</h2>
        <p>{options.body}</p>
        <button className="primary-button" onClick={() => { options.onConfirm(); onClose(); }}>{options.confirmLabel}</button>
        <button className="outline-button" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

function TeamModal({
  teams,
  currentTeamId,
  onChoose,
  onClose,
}: {
  teams: Team[];
  currentTeamId: string;
  onChoose: (teamId: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const checkCode = () => {
    const team = teams.find((item) => item.code === code);
    if (!team) {
      setError("That code does not match a team.");
      return;
    }
    onChoose(team.id);
    onClose();
  };
  const current = teams.find((team) => team.id === currentTeamId)!;
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="modal team-modal" role="dialog" aria-modal="true" aria-labelledby="team-title">
        <button className="modal-close" onClick={onClose} aria-label="Close"><X /></button>
        <span className="eyebrow">Check in</span>
        <h2 id="team-title">Find your team</h2>
        <p className="modal-copy">Enter the four-digit code from your cart card.</p>
        <label className="field-label">Team code
          <input className="code-input" inputMode="numeric" maxLength={4} placeholder="0000" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} autoFocus />
        </label>
        {error && <p className="field-error">{error}</p>}
        <button className="primary-button" onClick={checkCode} disabled={code.length !== 4}>Open team</button>
        <div className="current-team-note"><Users size={18} /><span>Current: {current.name} · starts hole {current.startHole}</span></div>
      </div>
    </div>
  );
}

export default function GolfDayApp() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [currentTeamId, setCurrentTeamId] = useState("team-1");
  const [tab, setTab] = useState<Tab>("ladder");
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clubhouseMode, setClubhouseMode] = useState<"course" | "bbq" | null>(null);
  const [teamModal, setTeamModal] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [toast, setToast] = useState("");
  // The sync loop needs the freshest state without re-subscribing every render.
  // Written in an effect rather than during render so React never sees a ref
  // mutated mid-render.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Hydration: localStorage, navigator.onLine and the query string only exist on
  // the client, so this genuinely belongs in a mount effect. The one cascading
  // render it costs happens before the golfer sees anything.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
    setCurrentTeamId(loadCurrentTeam());
    setOnline(navigator.onLine);
    const params = new URLSearchParams(window.location.search);
    const clubhouse = params.get("clubhouse");
    if (clubhouse === "course" || clubhouse === "bbq") setClubhouseMode(clubhouse);
    if (params.has("shop")) setTab("shop");
    setHydrated(true);
  }, []);

  useEffect(() => {
    const readLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get("clubhouse");
      setClubhouseMode(mode === "course" || mode === "bbq" ? mode : null);
    };
    window.addEventListener("popstate", readLocation);
    return () => window.removeEventListener("popstate", readLocation);
  }, []);

  useEffect(() => {
    if (hydrated) saveState(state);
  }, [state, hydrated]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const sync = useCallback(async () => {
    if (!remoteConfigured || !navigator.onLine) return;
    setSyncing(true);
    try {
      const pushed = await pushPending(stateRef.current);
      const remote = await pullRemote();
      // Reconcile against the state as it is NOW, not the snapshot this pass
      // started from. A push plus a photo upload can take many seconds on course
      // signal, and a hole saved inside that window used to be overwritten.
      setState((current) => reconcile(current, pushed, remote));
    } catch {
      // Pending writes remain in local storage and will retry on the next pass.
    } finally {
      setSyncing(false);
    }
  }, []);

  // Subscribing to an external system (Supabase) on a 20s heartbeat plus the
  // browser's online event. The kickoff call is the initial fetch.
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync();
    const interval = window.setInterval(sync, 20_000);
    window.addEventListener("online", sync);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", sync);
    };
  }, [hydrated, sync]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const chooseTeam = (teamId: string) => {
    setCurrentTeamId(teamId);
    saveCurrentTeam(teamId);
    setTab("ladder");
    notify(`${state.teams.find((team) => team.id === teamId)?.name} opened`);
  };

  const currentTeam = state.teams.find((team) => team.id === currentTeamId) ?? state.teams[0];
  const pending = pendingCount(state);

  const openClubhouse = (mode: "course" | "bbq") => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("clubhouse", mode);
    window.history.pushState({}, "", url);
    setClubhouseMode(mode);
  };

  const closeClubhouse = () => {
    const url = new URL(window.location.href);
    url.search = "";
    window.history.pushState({}, "", url);
    setClubhouseMode(null);
  };

  if (clubhouseMode) {
    return <ClubhouseView state={state} mode={clubhouseMode} onClose={closeClubhouse} />;
  }

  return (
    <div className="site-stage">
      <main className="app-shell">
        <header className="app-header">
          <div className="app-brand"><BrandMark compact /><div><span>Denver Bulldogs</span><strong>Golf Day</strong></div></div>
          <button className="team-switcher" onClick={() => setTeamModal(true)}>
            <span>{currentTeam.name}</span><small>Starts H{currentTeam.startHole}</small><ChevronDown size={17} />
          </button>
        </header>
        <SyncLine online={online} pending={pending} syncing={syncing} />
        <div className="app-content">
          {tab === "ladder" && <LadderScreen state={state} currentTeamId={currentTeam.id} onClubhouse={() => openClubhouse("course")} />}
          {tab === "card" && <CardScreen state={state} currentTeam={currentTeam} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {tab === "prizes" && <PrizesScreen state={state} currentTeam={currentTeam} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {tab === "shop" && <ShopScreen state={state} currentTeam={currentTeam} online={online} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {PHOTOS_TAB_ENABLED && tab === "photos" && <PhotosScreen state={state} currentTeam={currentTeam} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {tab === "info" && <InfoScreen onClubhouse={openClubhouse} />}
        </div>
        <nav className="bottom-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => { setTab(id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
              <Icon size={22} strokeWidth={tab === id ? 2.8 : 2.2} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </main>
      {teamModal && <TeamModal teams={state.teams} currentTeamId={currentTeam.id} onChoose={chooseTeam} onClose={() => setTeamModal(false)} />}
      {confirm && <ConfirmModal options={confirm} onClose={() => setConfirm(null)} />}
      {toast && <div className="toast" role="status"><ShieldCheck size={19} />{toast}</div>}
    </div>
  );
}
