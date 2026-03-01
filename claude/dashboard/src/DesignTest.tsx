/**
 * DesignTest.tsx — HORA Design Showcase v6
 *
 * Design brief:
 *   Emotion: Technical & cinematic — like entering a spacecraft cockpit
 *   Palette: HORA gold (brand), deep dark (background), stratified grays, emerald for positive
 *   Typo: Space Grotesk (display) + DM Sans (body) + JetBrains Mono (data)
 *   Signature: Neural spectre — an animated EEG-like frequency bar
 *
 * Zero inline styles for colors/fonts. Tailwind + semantic tokens only.
 */

import { useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export function DesignTest() {
  const [activeTab, setActiveTab] = useState<"overview" | "tokens" | "components">("overview");

  return (
    <div className="dark flex flex-col gap-0 font-sans min-h-0">

      {/* ── Hero / Title Block ─────────────────────────────────── */}
      <div className="stagger-1 relative overflow-hidden rounded-2xl border border-border bg-card">
        {/* Atmospheric glow — top left gold bleed */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-80 w-80 rounded-full bg-brand/3 blur-3xl" />

        <div className="relative flex items-end justify-between px-8 pb-6 pt-8">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 ring-1 ring-brand/20">
                <span className="text-sm font-bold text-brand font-display">H</span>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-semibold tracking-tight text-foreground font-display leading-none">
                  Design System
                </h1>
                <span className="mt-0.5 text-xs text-muted-foreground font-mono tracking-wide">
                  v6.0 / OKLCH tokens / dark-first
                </span>
              </div>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Systeme de design HORA. Tokens semantiques, typographie intentionnelle,
              composants construits pour la densite d'information.
            </p>
          </div>

          {/* Neural spectre — signature element */}
          <NeuralSpectre />
        </div>

        {/* Tab bar — integrated into the hero card */}
        <div className="flex gap-0 border-t border-border px-8">
          {(["overview", "tokens", "components"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 text-xs font-medium tracking-wide transition-colors duration-150 ${
                activeTab === tab
                  ? "text-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "overview" ? "Vue d'ensemble" : tab === "tokens" ? "Tokens" : "Composants"}
              {activeTab === tab && (
                <span className="absolute inset-x-4 -bottom-px h-px bg-brand" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "tokens" && <TokensTab />}
      {activeTab === "components" && <ComponentsTab />}

      {/* ── Footer signature ───────────────────────────────────── */}
      <div className="stagger-6 flex items-center gap-4 pb-2 pt-1">
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground/40 uppercase font-mono">
          HORA
        </span>
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs italic text-brand/30 font-display">
          your memory never sleeps
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   NEURAL SPECTRE — The signature detail
   An animated EEG-like frequency visualizer using pure CSS.
   ═══════════════════════════════════════════════════════════════════ */

function NeuralSpectre() {
  // Heights are intentionally irregular — mimicking a real EEG signal
  const bars = [3, 8, 5, 14, 7, 11, 4, 16, 6, 9, 13, 5, 10, 7, 15, 4, 8, 12, 6, 11, 3, 9, 7, 14];

  return (
    <div className="flex items-end gap-px opacity-70" aria-hidden="true">
      {bars.map((h, i) => (
        <div
          key={i}
          className="spectre-bar w-0.5 rounded-full bg-brand"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OVERVIEW TAB — KPIs + activity + system status
   ═══════════════════════════════════════════════════════════════════ */

function OverviewTab() {
  return (
    <div className="flex flex-col gap-3 pt-3">

      {/* KPI row — asymmetric: 1 hero + 3 secondary */}
      <div className="stagger-2 grid grid-cols-4 gap-3">
        <KpiCard
          label="Noeuds memoire"
          value="8,934"
          delta="+340"
          positive
          hero
        />
        <KpiCard label="Sessions" value="1,247" delta="+12.3%" positive />
        <KpiCard label="Temps reponse" value="1.8s" delta="-0.4s" positive />
        <KpiCard label="Embeddings" value="94%" delta="+2.1%" positive />
      </div>

      {/* Main content: activity feed + right column */}
      <div className="stagger-3 grid gap-3" style={{ gridTemplateColumns: "7fr 4fr" }}>

        {/* Activity feed */}
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-medium text-card-foreground font-display">
              Activite recente
            </h2>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground font-mono">
              7 jours
            </span>
          </div>
          <div className="divide-y divide-border">
            {ACTIVITY_DATA.map((item) => (
              <ActivityRow key={item.name} {...item} />
            ))}
          </div>
        </div>

        {/* Right: stacked panels */}
        <div className="flex flex-col gap-3">

          {/* Knowledge graph panel */}
          <div className="hover-lift rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-card-foreground font-display">
                Knowledge Graph
              </h3>
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand/10">
                <span className="text-[10px] text-brand font-mono">KG</span>
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
              Graphe bi-temporel &middot; 34 relations typees
            </p>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Metric label="Entites" value="2,847" />
              <Metric label="Faits" value="6,091" />
              <Metric label="Embedded" value="94%" accent />
            </div>
          </div>

          {/* Memory tiers panel */}
          <div className="hover-lift rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-medium text-card-foreground font-display">
              Tiers memoire
            </h3>
            <div className="mt-4 flex flex-col gap-3">
              <ProgressBar label="T1 court terme" value={72} accent />
              <ProgressBar label="T2 moyen terme" value={45} />
              <ProgressBar label="T3 permanent" value={28} />
            </div>
          </div>

          {/* System status */}
          <div className="hover-lift rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-card-foreground font-display">
                Systeme
              </h3>
              <StatusBadge status="operational" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              <Metric label="Uptime" value="99.8%" />
              <Metric label="Dernier GC" value="2h" />
              <Metric label="Hooks" value="247" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TOKENS TAB — Color palette, typography, spacing
   ═══════════════════════════════════════════════════════════════════ */

function TokensTab() {
  return (
    <div className="flex flex-col gap-3 pt-3">

      {/* Typography specimen */}
      <div className="stagger-2 rounded-xl border border-border bg-card p-6">
        <SectionLabel>Typographie</SectionLabel>
        <div className="mt-4 flex flex-col gap-5">
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <span className="text-2xl font-light tracking-tight text-foreground font-display leading-none">
              Space Grotesk <span className="font-bold">Display</span>
            </span>
            <span className="text-[10px] text-muted-foreground/50 font-mono">--font-display</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <span className="text-sm text-foreground/80 leading-relaxed">
              DM Sans body text -- optimise pour la lecture longue, avec un
              espacement genereux et une graisse confortable.
            </span>
            <span className="ml-8 shrink-0 text-[10px] text-muted-foreground/50 font-mono">--font-sans</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <span className="text-xs text-muted-foreground leading-relaxed">
              Texte secondaire pour les metadonnees, timestamps et informations de support --
              graisse plus legere pour la hierarchie.
            </span>
            <span className="ml-8 shrink-0 text-[10px] text-muted-foreground/50 font-mono">muted</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-brand/80 font-mono">
              const signal = await hora.crystallize("embeddings");
            </span>
            <span className="ml-8 shrink-0 text-[10px] text-muted-foreground/50 font-mono">--font-mono</span>
          </div>
        </div>
      </div>

      {/* Color tokens — two columns */}
      <div className="stagger-3 grid grid-cols-2 gap-3">

        {/* Core palette */}
        <div className="rounded-xl border border-border bg-card p-6">
          <SectionLabel>Palette core</SectionLabel>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ColorSwatch name="background" token="bg-background" />
            <ColorSwatch name="foreground" token="bg-foreground" />
            <ColorSwatch name="card" token="bg-card" />
            <ColorSwatch name="border" token="bg-border" />
            <ColorSwatch name="muted" token="bg-muted" />
            <ColorSwatch name="accent" token="bg-accent" />
          </div>
        </div>

        {/* Semantic palette */}
        <div className="rounded-xl border border-border bg-card p-6">
          <SectionLabel>Palette semantique</SectionLabel>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ColorSwatch name="brand" token="bg-brand" featured />
            <ColorSwatch name="brand-fg" token="bg-brand-foreground" />
            <ColorSwatch name="primary" token="bg-primary" />
            <ColorSwatch name="primary-fg" token="bg-primary-foreground" />
            <ColorSwatch name="destructive" token="bg-destructive" />
            <ColorSwatch name="secondary" token="bg-secondary" />
          </div>
        </div>
      </div>

      {/* Spacing + radius specimen */}
      <div className="stagger-4 rounded-xl border border-border bg-card p-6">
        <SectionLabel>Espacement & rayons</SectionLabel>
        <div className="mt-4 flex items-end gap-3">
          {[
            { label: "sm", size: "h-6 w-6", radius: "rounded-sm" },
            { label: "md", size: "h-8 w-8", radius: "rounded-md" },
            { label: "lg", size: "h-10 w-10", radius: "rounded-lg" },
            { label: "xl", size: "h-12 w-12", radius: "rounded-xl" },
            { label: "2xl", size: "h-14 w-14", radius: "rounded-2xl" },
            { label: "full", size: "h-14 w-14", radius: "rounded-full" },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <div className={`${item.size} ${item.radius} border border-brand/30 bg-brand/10`} />
              <span className="text-[10px] text-muted-foreground/50 font-mono">{item.label}</span>
            </div>
          ))}

          {/* Spacer */}
          <div className="mx-4 h-px w-px" />

          {/* Spacing scale */}
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <div key={n} className="flex flex-col items-center gap-2">
              <div className="flex h-14 items-end">
                <div
                  className="w-4 rounded-t-sm bg-brand/20"
                  style={{ height: `${n * 6}px` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground/50 font-mono">{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTS TAB — Interactive component specimens
   ═══════════════════════════════════════════════════════════════════ */

function ComponentsTab() {
  const [toggle1, setToggle1] = useState(true);
  const [toggle2, setToggle2] = useState(false);

  return (
    <div className="flex flex-col gap-3 pt-3">

      {/* Buttons */}
      <div className="stagger-2 rounded-xl border border-border bg-card p-6">
        <SectionLabel>Boutons</SectionLabel>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="hover-lift inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-xs font-semibold text-brand-foreground transition-all duration-150">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-foreground/40" />
            Primary action
          </button>
          <button className="hover-lift inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-xs font-medium text-card-foreground transition-all duration-150 hover:border-brand/20">
            Secondary
          </button>
          <button className="inline-flex h-9 items-center rounded-lg px-4 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground">
            Ghost
          </button>
          <button className="hover-lift inline-flex h-9 items-center rounded-lg bg-destructive/90 px-4 text-xs font-medium text-foreground transition-all duration-150 hover:bg-destructive">
            Destructif
          </button>
          <button className="inline-flex h-9 cursor-not-allowed items-center rounded-lg border border-border px-4 text-xs font-medium text-muted-foreground/30" disabled>
            Disabled
          </button>
        </div>

        {/* Small variants */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="inline-flex h-7 items-center rounded-md bg-brand/10 px-3 text-[11px] font-medium text-brand transition-colors duration-150 hover:bg-brand/20">
            Petit primary
          </button>
          <button className="inline-flex h-7 items-center rounded-md border border-border px-3 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground">
            Petit secondary
          </button>
          <button className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-3 text-[11px] font-medium text-secondary-foreground transition-colors duration-150 hover:bg-accent">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            Avec indicateur
          </button>
        </div>
      </div>

      {/* Form controls row */}
      <div className="stagger-3 grid grid-cols-2 gap-3">

        {/* Inputs + toggles */}
        <div className="rounded-xl border border-border bg-card p-6">
          <SectionLabel>Controles</SectionLabel>
          <div className="mt-4 flex flex-col gap-4">
            {/* Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Recherche</label>
              <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 transition-colors duration-150 focus-within:border-brand/40 focus-within:ring-1 focus-within:ring-brand/20">
                <svg className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  placeholder="Rechercher dans la memoire..."
                  className="h-full flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
                <kbd className="hidden rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground/50 font-mono sm:inline-block">
                  /
                </kbd>
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3">
              <Toggle label="Auto-embed" checked={toggle1} onChange={setToggle1} />
              <Toggle label="Dream cycle" checked={toggle2} onChange={setToggle2} />
            </div>
          </div>
        </div>

        {/* Tags + badges */}
        <div className="rounded-xl border border-border bg-card p-6">
          <SectionLabel>Tags & badges</SectionLabel>
          <div className="mt-4 flex flex-col gap-4">
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <Tag variant="brand">HORA</Tag>
              <Tag variant="default">react</Tag>
              <Tag variant="default">typescript</Tag>
              <Tag variant="success">stable</Tag>
              <Tag variant="warning">review</Tag>
              <Tag variant="danger">breaking</Tag>
              <Tag variant="default">oklch</Tag>
              <Tag variant="brand">design-system</Tag>
            </div>

            {/* Status badges */}
            <div className="flex flex-col gap-2">
              <StatusRow label="Knowledge Graph" status="operational" />
              <StatusRow label="Embedding Service" status="operational" />
              <StatusRow label="Dream Cycle" status="degraded" />
              <StatusRow label="Backup Agent" status="down" />
            </div>
          </div>
        </div>
      </div>

      {/* Code block + notifications */}
      <div className="stagger-4 grid grid-cols-3 gap-3">

        {/* Code specimen */}
        <div className="col-span-2 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-brand/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
            </div>
            <span className="text-[10px] text-muted-foreground/40 font-mono">signal-tracker.ts</span>
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-6 font-mono">
            <code>
              <Line n={1}><Kw>import</Kw> {"{"} HoraGraph {"}"} <Kw>from</Kw> <Str>"@hora/core"</Str>;</Line>
              <Line n={2} />
              <Line n={3}><Kw>export async function</Kw> <Fn>crystallize</Fn>(</Line>
              <Line n={4}>  graph: <Tp>HoraGraph</Tp>,</Line>
              <Line n={5}>  signal: <Tp>Signal</Tp></Line>
              <Line n={6}>) {"{"}</Line>
              <Line n={7}>  <Kw>const</Kw> embedding = <Kw>await</Kw> graph.<Fn>embed</Fn>(signal);</Line>
              <Line n={8}>  <Kw>const</Kw> tier = signal.count {">="} <Nm>3</Nm> ? <Str>"T3"</Str> : <Str>"T2"</Str>;</Line>
              <Line n={9} />
              <Line n={10}>  <Kw>return</Kw> graph.<Fn>promote</Fn>(embedding, tier);</Line>
              <Line n={11}>{"}"}</Line>
            </code>
          </pre>
        </div>

        {/* Notifications / alerts */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[10px] text-brand font-mono font-bold">!</span>
              <div>
                <p className="text-xs font-medium text-foreground">Cristallisation terminee</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  12 signaux promus en T3 depuis 3 sessions distinctes.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/20 text-[10px] text-destructive font-mono font-bold">x</span>
              <div>
                <p className="text-xs font-medium text-foreground">GC timeout</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Le garbage collector a depasse le seuil de 5000ms.
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-secondary/50 p-4">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground font-mono">i</span>
              <div>
                <p className="text-xs font-medium text-foreground">Backup programme</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  Prochain snapshot dans 2h.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

/* ── KPI Card ──────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  delta,
  positive,
  hero,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
  hero?: boolean;
}) {
  return (
    <div
      className={`hover-lift group relative overflow-hidden rounded-xl border bg-card p-5 ${
        hero ? "border-brand/15" : "border-border"
      }`}
    >
      {hero && (
        <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand/8 blur-2xl" />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground/60 uppercase font-mono">
          {label}
        </span>
        <span
          className={`text-[10px] font-semibold tabular-nums ${
            positive ? "text-emerald-400" : "text-destructive"
          }`}
        >
          {delta}
        </span>
      </div>
      <div
        className={`mt-2 text-2xl leading-none tracking-tight tabular-nums font-display ${
          hero ? "font-semibold text-brand" : "font-light text-card-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Metric ────────────────────────────────────────────────────── */

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] text-muted-foreground/50 font-mono">{label}</span>
      <span
        className={`text-sm font-semibold tracking-tight tabular-nums font-display ${
          accent ? "text-brand" : "text-card-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Progress Bar ──────────────────────────────────────────────── */

function ProgressBar({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-medium text-card-foreground tabular-nums font-mono">
          {value}%
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-accent">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            accent ? "bg-brand" : "bg-foreground/15"
          }`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/* ── Activity Row ──────────────────────────────────────────────── */

function ActivityRow({
  name,
  tag,
  time,
  status,
}: {
  name: string;
  tag: string;
  time: string;
  status: "done" | "review" | "wip";
}) {
  const tagColor =
    tag === "feat"
      ? "bg-brand/10 text-brand"
      : tag === "fix"
      ? "bg-emerald-500/10 text-emerald-400"
      : "bg-blue-500/10 text-blue-400";

  return (
    <div className="group flex items-center gap-3 px-5 py-2.5 transition-colors duration-100 hover:bg-accent/30">
      <span
        className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold tracking-wider uppercase font-mono ${tagColor}`}
      >
        {tag}
      </span>
      <span className="flex-1 truncate text-xs text-muted-foreground transition-colors duration-100 group-hover:text-foreground">
        {name}
      </span>
      {status === "review" && (
        <span className="rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[10px] font-medium text-amber-400">
          review
        </span>
      )}
      {status === "wip" && (
        <span className="rounded-full border border-brand/20 bg-brand/5 px-2 py-0.5 text-[10px] font-medium text-brand">
          wip
        </span>
      )}
      <span className="shrink-0 text-[11px] text-muted-foreground/40 tabular-nums font-mono">
        {time}
      </span>
    </div>
  );
}

/* ── Toggle ────────────────────────────────────────────────────── */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-brand" : "bg-accent"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-foreground shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/* ── Tag ───────────────────────────────────────────────────────── */

function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "brand" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-secondary text-muted-foreground",
    brand: "bg-brand/10 text-brand",
    success: "bg-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/10 text-amber-400",
    danger: "bg-destructive/10 text-destructive",
  };

  return (
    <span
      className={`inline-flex h-6 items-center rounded-md px-2 text-[11px] font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ── Status Badge ──────────────────────────────────────────────── */

function StatusBadge({ status }: { status: "operational" | "degraded" | "down" }) {
  const config = {
    operational: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Operationnel" },
    degraded: { dot: "bg-amber-400", text: "text-amber-400", label: "Degrade" },
    down: { dot: "bg-destructive", text: "text-destructive", label: "Hors ligne" },
  };
  const c = config[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} />
      <span className={`text-[11px] font-medium ${c.text}`}>{c.label}</span>
    </div>
  );
}

/* ── Status Row ────────────────────────────────────────────────── */

function StatusRow({ label, status }: { label: string; status: "operational" | "degraded" | "down" }) {
  const dotColor =
    status === "operational"
      ? "bg-emerald-400"
      : status === "degraded"
      ? "bg-amber-400"
      : "bg-destructive";

  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
    </div>
  );
}

/* ── Color Swatch ──────────────────────────────────────────────── */

function ColorSwatch({ name, token, featured }: { name: string; token: string; featured?: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${
        featured ? "border-brand/20 bg-brand/5" : "border-border bg-background/30"
      }`}
    >
      <div className={`h-4 w-4 rounded border border-foreground/10 ${token}`} />
      <span className="text-[11px] text-muted-foreground font-mono">{name}</span>
    </div>
  );
}

/* ── Section Label ─────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-medium tracking-widest text-muted-foreground/50 uppercase font-mono">
      {children}
    </span>
  );
}

/* ── Code syntax helpers ───────────────────────────────────────── */

function Line({ n, children }: { n: number; children?: React.ReactNode }) {
  return (
    <div className="flex">
      <span className="mr-6 inline-block w-6 select-none text-right text-muted-foreground/25 tabular-nums">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-brand/80">{children} </span>;
}

function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400">{children}</span>;
}

function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-emerald-400">{children}</span>;
}

function Tp({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-300">{children}</span>;
}

function Nm({ children }: { children: React.ReactNode }) {
  return <span className="text-brand">{children}</span>;
}

/* ═══════════════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════════════ */

const ACTIVITY_DATA: Array<{
  name: string;
  tag: string;
  time: string;
  status: "done" | "review" | "wip";
}> = [
  { name: "Designer agent v6 — cinematic showcase", tag: "feat", time: "now", status: "wip" },
  { name: "Signal crystallization cross-session", tag: "feat", time: "2h", status: "done" },
  { name: "OKLCH token alignment pipeline", tag: "fix", time: "3h", status: "done" },
  { name: "Knowledge graph agentic retrieval", tag: "feat", time: "hier", status: "review" },
  { name: "Memory tiers GC tuning (T2 max age)", tag: "perf", time: "2j", status: "done" },
  { name: "Session replay endpoint + component", tag: "feat", time: "3j", status: "done" },
  { name: "Embedding binary format (Float32Array)", tag: "perf", time: "4j", status: "done" },
];
