"use client";

import {
  BadgeDollarSign,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Flag,
  Info,
  MapPin,
  Medal,
  Minus,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trophy,
  Tv,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CONTESTS,
  COURSE,
  EVENT,
  PRODUCTS,
  SCHEDULE,
  type Claim,
  type Sale,
  type Score,
  type Team,
} from "@/src/data/demo";
import {
  DEMO_STATE,
  loadCurrentTeam,
  loadState,
  pendingCount,
  pullRemote,
  pushPending,
  remoteConfigured,
  saveCurrentTeam,
  saveState,
  type AppState,
} from "@/src/lib/local-first";

type Tab = "ladder" | "card" | "prizes" | "sell" | "info";
type ProductId = (typeof PRODUCTS)[number]["id"];
type ContestId = (typeof CONTESTS)[number]["id"];

const NAV_ITEMS = [
  { id: "ladder", label: "Ladder", Icon: Trophy },
  { id: "card", label: "Card", Icon: NotebookPen },
  { id: "prizes", label: "Prizes", Icon: Medal },
  { id: "sell", label: "Sell", Icon: BadgeDollarSign },
  { id: "info", label: "Info", Icon: Info },
] as const;

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
        title="Round standings"
        action={
          <button className="icon-action" onClick={onClubhouse} aria-label="Open clubhouse view">
            <Tv size={23} />
          </button>
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
  const [draft, setDraft] = useState(activeScore?.strokes ?? par);
  const [showHistory, setShowHistory] = useState(false);
  const [stringUseOpen, setStringUseOpen] = useState(false);
  const [stringAmount, setStringAmount] = useState(Math.min(6, currentTeam.stringInches));

  useEffect(() => {
    setDraft(activeScore?.strokes ?? par);
  }, [activeHole, activeScore?.strokes, par]);

  const saveScore = () => {
    if (!activeHole) return;
    const score: Score = {
      id: `${currentTeam.id}-h${activeHole}`,
      teamId: currentTeam.id,
      hole: activeHole,
      strokes: draft,
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
  };

  const updateTeamBalance = (kind: "mulligan" | "string", amount: number) => {
    onState((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === currentTeam.id
        ? {
          ...team,
          mulligans: kind === "mulligan" ? Math.max(0, team.mulligans - amount) : team.mulligans,
          stringInches: kind === "string" ? Math.max(0, team.stringInches - amount) : team.stringInches,
        }
        : team),
      dirtyTeamIds: [...new Set([...current.dirtyTeamIds, currentTeam.id])],
    }));
    notify(kind === "mulligan" ? "Mulligan used" : `${amount} in of string used`);
  };

  const useMulligan = () => requestConfirm({
    title: "Use one mulligan?",
    body: `${currentTeam.name} will have ${Math.max(0, currentTeam.mulligans - 1)} remaining.`,
    confirmLabel: "Use mulligan",
    onConfirm: () => updateTeamBalance("mulligan", 1),
  });

  const useString = () => {
    setStringAmount(Math.min(6, currentTeam.stringInches));
    setStringUseOpen(true);
  };

  return (
    <section className="screen scorecard-screen">
      <SectionHeader eyebrow={`${currentTeam.name} · starts hole ${currentTeam.startHole}`} title="Team card" />
      <div className="balance-strip">
        <div><span>Mulligans</span><strong>{currentTeam.mulligans}</strong></div>
        <div><span>String</span><strong>{currentTeam.stringInches}<small> in</small></strong></div>
      </div>

      {activeHole ? (
        <div className="score-entry-card">
          <div className="hole-kicker">{editHole ? "Correcting" : "Now scoring"}</div>
          <div className="hole-title-row">
            <div><span>Hole</span><strong>{activeHole}</strong></div>
            <div className="hole-meta"><span>Par {par}</span><span>{COURSE.holes[activeHole - 1].yards} yd</span></div>
          </div>
          <div className="score-stepper" aria-label={`Score for hole ${activeHole}`}>
            <button onClick={() => setDraft((value) => Math.max(1, value - 1))} aria-label="Decrease score"><Minus /></button>
            <div><strong>{draft}</strong><span>{draft - par === 0 ? "Par" : formatRelative(draft - par)}</span></div>
            <button onClick={() => setDraft((value) => Math.min(15, value + 1))} aria-label="Increase score"><Plus /></button>
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
        <button onClick={useString} disabled={currentTeam.stringInches === 0}>
          <span className="string-icon">—</span><span>Use string</span><small>{currentTeam.stringInches} in left</small>
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
      <div className="data-warning"><Info size={16} /><span>Demo scorecard only. Pars and yardages are not verified.</span></div>
      {stringUseOpen && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="string-title">
            <button className="modal-close" onClick={() => setStringUseOpen(false)} aria-label="Close"><X /></button>
            <span className="eyebrow">String extender</span>
            <h2 id="string-title">How much was cut?</h2>
            <div className="score-stepper string-stepper">
              <button onClick={() => setStringAmount((value) => Math.max(1, value - 1))} aria-label="Use one inch less"><Minus /></button>
              <div><strong>{stringAmount}</strong><span>Inches</span></div>
              <button onClick={() => setStringAmount((value) => Math.min(currentTeam.stringInches, value + 1))} aria-label="Use one inch more"><Plus /></button>
            </div>
            <p className="modal-copy">{currentTeam.stringInches - stringAmount} in will remain.</p>
            <button className="primary-button" onClick={() => { updateTeamBalance("string", stringAmount); setStringUseOpen(false); }}>Use {stringAmount} in of string</button>
          </div>
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
  const [playerId, setPlayerId] = useState(currentTeam.players[0]?.id ?? "");
  const [feet, setFeet] = useState("0");
  const [inches, setInches] = useState("0");
  const [mark, setMark] = useState("");
  const [now, setNow] = useState(Date.now());
  const contest = CONTESTS.find((item) => item.id === selected)!;
  const holder = state.claims.find((claim) => claim.contestId === selected);
  const elapsed = state.timer.elapsedMs + (state.timer.runningSince ? now - state.timer.runningSince : 0);

  useEffect(() => {
    if (!state.timer.runningSince) return;
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [state.timer.runningSince]);

  useEffect(() => {
    setPlayerId(currentTeam.players[0]?.id ?? "");
  }, [currentTeam]);

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
    if (!Number.isFinite(numericMark) || numericMark <= 0) {
      notify("Enter a valid mark");
      return;
    }
    const beatsHolder = !holder || (contest.direction === "low" ? numericMark < holder.mark : numericMark > holder.mark);
    if (!beatsHolder) {
      notify("Current lead stands");
      setClaimOpen(false);
      return;
    }
    const player = currentTeam.players.find((item) => item.id === playerId);
    const claim: Claim = {
      id: `claim-${selected}`,
      contestId: selected,
      holeNumber: contest.hole,
      playerName: selected === "speed" ? currentTeam.name : player?.name ?? currentTeam.name,
      teamId: currentTeam.id,
      mark: numericMark,
      unit: contest.unit,
      claimedAt: new Date().toISOString(),
      synced: false,
    };
    onState((current) => ({
      ...current,
      claims: [...current.claims.filter((item) => item.contestId !== selected), claim],
    }));
    notify(`${contest.short} lead updated`);
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
          const current = state.claims.find((claim) => claim.contestId === item.id);
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
            {selected !== "speed" && (
              <label className="field-label">Player
                <select value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                  {currentTeam.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
                </select>
              </label>
            )}
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
            <button className="primary-button" onClick={submitClaim}>Save leading mark</button>
          </div>
        </div>
      )}
    </section>
  );
}

function SellScreen({
  state,
  onState,
  notify,
}: {
  state: AppState;
  onState: React.Dispatch<React.SetStateAction<AppState>>;
  notify: (message: string) => void;
}) {
  const [cart, setCart] = useState<Record<ProductId, number>>({ mulligan: 0, string: 0, raffle: 0 });
  const [teamId, setTeamId] = useState(state.teams[0].id);
  const [seller, setSeller] = useState("Dan C");
  const [stringInches, setStringInches] = useState("");
  const total = PRODUCTS.reduce((sum, product) => sum + cart[product.id] * product.price, 0);
  const dayTotal = state.sales.reduce((sum, sale) => sum + sale.amount, 0);
  const raffleTotal = state.sales.filter((sale) => sale.product === "raffle").reduce((sum, sale) => sum + sale.amount, 0);

  const adjust = (product: ProductId, amount: number) => {
    setCart((current) => ({ ...current, [product]: Math.max(0, current[product] + amount) }));
  };

  const saveSale = () => {
    if (total === 0) return;
    const totalString = Number(stringInches);
    if (cart.string > 0 && (!Number.isFinite(totalString) || totalString < cart.string * 6 || totalString > cart.string * 24)) {
      notify(`Enter ${cart.string * 6}–${cart.string * 24} in of revealed string`);
      return;
    }
    const additions: Sale[] = PRODUCTS.filter((product) => cart[product.id] > 0).map((product) => ({
      id: makeId("sale"),
      product: product.id,
      qty: cart[product.id],
      amount: cart[product.id] * product.price,
      teamId,
      soldBy: seller,
      soldAt: new Date().toISOString(),
      synced: false,
      stringInches: product.id === "string" ? totalString : undefined,
    }));
    onState((current) => ({
      ...current,
      sales: [...current.sales, ...additions],
      teams: current.teams.map((team) => team.id === teamId ? {
        ...team,
        mulligans: team.mulligans + cart.mulligan,
        stringInches: team.stringInches + (cart.string ? totalString : 0),
      } : team),
      dirtyTeamIds: [...new Set([...current.dirtyTeamIds, teamId])],
    }));
    notify(`$${total} sale saved`);
    setCart({ mulligan: 0, string: 0, raffle: 0 });
    setStringInches("");
  };

  return (
    <section className="screen sell-screen">
      <SectionHeader eyebrow="Volunteer mode" title="On-course sales" />
      <div className="sales-total-card">
        <div><span>Raised today</span><strong>${dayTotal.toLocaleString()}</strong></div>
        <div><span>50/50 pot</span><strong>${raffleTotal.toLocaleString()}</strong><small>${(raffleTotal / 2).toLocaleString()} to winner</small></div>
      </div>

      <div className="seller-row">
        <label className="field-label">Selling as
          <select value={seller} onChange={(event) => setSeller(event.target.value)}><option>Dan C</option><option>Marcus S</option></select>
        </label>
        <label className="field-label">Assign to
          <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
            {state.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
      </div>

      <div className="product-grid">
        {PRODUCTS.map((product) => (
          <div className={`product-card ${cart[product.id] ? "selected" : ""}`} key={product.id}>
            <button className="product-main" onClick={() => adjust(product.id, 1)}>
              <span>{product.id === "mulligan" ? <RotateCcw /> : product.id === "string" ? <span className="string-icon">—</span> : <CircleDollarSign />}</span>
              <strong>{product.name}</strong>
              <b>${product.price}</b>
              <small>{product.note}</small>
            </button>
            <div className="quantity-control">
              <button onClick={() => adjust(product.id, -1)} aria-label={`Remove ${product.name}`}><Minus /></button>
              <strong>{cart[product.id]}</strong>
              <button onClick={() => adjust(product.id, 1)} aria-label={`Add ${product.name}`}><Plus /></button>
            </div>
          </div>
        ))}
      </div>

      {cart.string > 0 && (
        <label className="field-label string-reveal">Revealed string length · total inches
          <input inputMode="numeric" type="number" min={cart.string * 6} max={cart.string * 24} placeholder={`${cart.string * 6}–${cart.string * 24}`} value={stringInches} onChange={(event) => setStringInches(event.target.value)} />
        </label>
      )}

      <div className="sale-checkout">
        <div><span>Sale total</span><strong>${total}</strong></div>
        <button className="primary-button" disabled={total === 0} onClick={saveSale}>Save ${total} sale</button>
        <p>Cash and card are handled outside this app.</p>
      </div>
    </section>
  );
}

function InfoScreen() {
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
          <div><b>?</b><span>Beat the Pro · hole and price TBC</span></div>
        </div>
      </div>
      <div className="info-card contact-card">
        <div className="info-card-title"><Phone /><h3>Need help?</h3></div>
        <p>Jay Blistan · Events Chair</p>
        <a className="primary-button" href="tel:+12035055555">Call 203-505-5555</a>
        <a className="email-link" href="mailto:events@denverbulldogs.com">events@denverbulldogs.com</a>
      </div>
    </section>
  );
}

function ClubhouseView({ state, onExit }: { state: AppState; onExit: () => void }) {
  const ranked = rankTeams(state.teams, state.scores);
  const [clock, setClock] = useState("");
  useEffect(() => {
    const update = () => setClock(new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <main className="clubhouse-view">
      <header>
        <div className="clubhouse-brand"><BrandMark /><div><span>Denver Bulldogs</span><h1>Golf Day Ladder</h1></div></div>
        <div className="clubhouse-meta"><span><i /> Live</span><strong>{clock}</strong><button onClick={onExit}>Exit TV view</button></div>
      </header>
      <section className="clubhouse-board">
        <div className="clubhouse-table-head"><span>Pos</span><span>Team</span><span>Holes</span><span>Score</span></div>
        {ranked.map((item) => (
          <div className="clubhouse-row" key={item.team.id}>
            <span className="clubhouse-pos">{item.position}</span>
            <strong>{item.team.name}</strong>
            <span>{item.holes === 18 ? "Final" : item.holes}</span>
            <b className={scoreClass(item.relative)}>{formatRelative(item.relative)}</b>
          </div>
        ))}
      </section>
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
        <div className="demo-code"><span>Demo codes</span><button onClick={() => setCode("1842")}>Group 1 · 1842</button><button onClick={() => setCode("2715")}>Group 2 · 2715</button></div>
        <div className="current-team-note"><Users size={18} /><span>Current: {current.name} · starts hole {current.startHole}</span></div>
      </div>
    </div>
  );
}

export default function GolfDayApp() {
  const [state, setState] = useState<AppState>(DEMO_STATE);
  const [currentTeamId, setCurrentTeamId] = useState("team-1");
  const [tab, setTab] = useState<Tab>("ladder");
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clubhouse, setClubhouse] = useState(false);
  const [teamModal, setTeamModal] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmOptions | null>(null);
  const [toast, setToast] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(loadState());
    setCurrentTeamId(loadCurrentTeam());
    setOnline(navigator.onLine);
    setHydrated(true);
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
      const pulled = await pullRemote(pushed);
      setState(pulled);
    } catch {
      // Pending writes remain in local storage and will retry on the next pass.
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
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

  if (clubhouse) return <ClubhouseView state={state} onExit={() => setClubhouse(false)} />;

  return (
    <div className="site-stage">
      <div className="desktop-event-panel" aria-hidden="true">
        <BrandMark />
        <span>Denver Bulldogs</span>
        <h2>Golf Day</h2>
        <p>{EVENT.date}<br />{EVENT.venue}</p>
        <div className="desktop-score"><small>Shotgun start</small><strong>1:30</strong><span>pm</span></div>
        <div className="desktop-stripe" />
      </div>
      <main className="app-shell">
        <header className="app-header">
          <div className="app-brand"><BrandMark compact /><div><span>Denver Bulldogs</span><strong>Golf Day</strong></div></div>
          <button className="team-switcher" onClick={() => setTeamModal(true)}>
            <span>{currentTeam.name}</span><small>Starts H{currentTeam.startHole}</small><ChevronDown size={17} />
          </button>
        </header>
        <SyncLine online={online} pending={pending} syncing={syncing} />
        <div className="app-content">
          {tab === "ladder" && <LadderScreen state={state} currentTeamId={currentTeam.id} onClubhouse={() => setClubhouse(true)} />}
          {tab === "card" && <CardScreen state={state} currentTeam={currentTeam} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {tab === "prizes" && <PrizesScreen state={state} currentTeam={currentTeam} onState={setState} notify={notify} requestConfirm={setConfirm} />}
          {tab === "sell" && <SellScreen state={state} onState={setState} notify={notify} />}
          {tab === "info" && <InfoScreen />}
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
