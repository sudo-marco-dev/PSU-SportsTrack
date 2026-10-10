# PSU SportsTrack — UI/UX Design System Specification & Anti-Slop Directive

> **Document:** Design System, UI/UX Philosophy, Anti-Slop Directives & Mobile-First Reactive Specification  
> **Target Audience:** Frontend Engineers, UI/UX Designers, Product Architects, AI Pair Programmers  
> **Revision:** 3.0 (Anti-Slop Hardened, Pure Vector, Athletic Precision & Mobile-First Reactive)  
> **Skill References:** `frontend-design`, `ui-ux-pro-max`, `web-design-guidelines`, `brand-guidelines`  
> **Scope:** Entire PSU SportsTrack Platform (Palawan State University Athletics)

---

## 1. Executive Summary & Creative Vision

### 1.1 "Athletic Precision Meets Academic Prestige"
PSU SportsTrack is not a generic enterprise CRM or a cookie-cutter SaaS dashboard; it is the official digital arena for **Palawan State University Athletics**. The design fuses the high-octane energy of modern collegiate sports broadcast systems (ESPN, FIBA, NCAA) with the rigorous clarity of university institutional governance:

1. **High-Contrast Athletic Energy**: Deep nocturnal slate arenas (`#020617` / `#0F172A`) illuminated by radiant Palawan Solar Orange (`#F97316` / `hsl(24 95% 53%)`), emerald turf verification badges, and gold championship accolades.
2. **Mobile-First Reactive Architecture**: Designed touch-first from the ground up. Every view scales seamlessly from 320px smartphone viewports up to ultra-wide desktop displays with comfortable 44px+ touch targets and zero horizontal viewport blowout.
3. **Information Density with Tactical Breathing Room**: Compact stat blocks, uppercase athletic typography, and tabular figures maximize information density for coaches and tournament facilitators without visual fatigue.
4. **Zero-Emoji Discipline (Anti-Slop Vector Standard)**: Raw text emojis are strictly prohibited in the user interface. All visual cues use scalable SVG vector glyphs (`lucide-react`, `react-icons/gi`, `react-icons/fa6`) with unified stroke geometry.
5. **Realtime Kinetic Tactility**: Instant active press feedback (`active:scale-[0.98]`), live pulse pings, and spring-like transitions make the platform feel like a live courtside scoring console.

---

## 2. The Anti-Slop Manifesto: Eradicating Generic AI Aesthetics

AI-generated user interfaces frequently converge on lazy, uninspired tropes that degrade user experience. PSU SportsTrack enforces strict design guardrails derived from the `frontend-design` and `ui-ux-pro-max` design skills to reject generic "AI slop" aesthetics.

### 2.1 The 8 Sins of AI UI Slop (What We Reject)

| AI Slop Trope | Why It Fails | PSU SportsTrack Antidote |
| :--- | :--- | :--- |
| **1. Cliched Purple/Indigo Gradients** | Predictable, corporate SaaS fluff (`from-indigo-500 to-purple-600`) with no athletic identity. | **Palawan Solar Orange & Nocturnal Slate**: High-contrast, authentic collegiate palette built on `#F97316` and `#020617`. |
| **2. Uniform Radius Spam** | Blindly plastering `rounded-2xl` or `rounded-3xl` on every card, input, and button indiscriminately. | **Hierarchical Radius Scale**: Sharp functional badges (`rounded-md`), structural cards (`rounded-2xl sm:rounded-[2rem]`), and intentional tactile buttons (`rounded-2xl`). |
| **3. Low Information Density** | Massive bloated cards with tiny snippets of text, wasting 80% of screen space like a generic landing page. | **High-Density Athletic Stat Blocks**: Compact tabular scorecards, structured metadata grids, and tight collegiate tournament brackets. |
| **4. Raw Emoji Bloat** | Sprinkling emojis (`🏀`, `🏆`, `🔥`, `⚡`, `🎉`) as cheap visual filler instead of engineered vector design. | **Pure SVG Vector Iconography**: Typed, scalable icons (`GiBasketballBall`, `GiSoccerBall`, `Trophy`) with consistent stroke weights and theme colors. |
| **5. Generic, Characterless Fonts** | Defaulting to unstyled system fonts or standard Inter without typographic voice or hierarchy. | **Athletic Slanted Display Typography**: High-impact uppercase athletic headers (`font-black italic tracking-tighter uppercase`) paired with monospaced tabular numerals (`tabular-nums`). |
| **6. Floaty Disembodied Cards** | Cards with massive blurry drop shadows (`shadow-2xl`) hovering in empty white voids without visual anchors. | **Architectural Arena Framing**: Subtle court-line borders (`border-white/10`, `border-slate-200/80`), dark inset stages, and tactile elevation layers. |
| **7. Desktop-First Breakdowns** | Multi-column layouts that overflow horizontally, clip labels, or require pinch-to-zoom on mobile viewports. | **Mobile-First Reactive Primitives**: Single-column base stacks, horizontal swipe rails (`scrollbar-hide`), and mobile round segment selectors for brackets. |
| **8. Static, Lifeless Elements** | Zero feedback on tap/click, jumping digits when scores update, and snap transitions with no tactile feel. | **Kinetic Haptic Feedback**: `active:scale-[0.98]`, stabilized `tabular-nums`, live match pulse pings, and fluid 150ms transitions. |
| **9. Muddy Dark-to-Brown Wash Gradients** | Blending dark slates into murky dark oranges/browns (`to-orange-950/40`, `via-slate-950 to-orange-950`) or using washed-out corner color blobs. Passes through dirty brownish-taupe tones, creating an unreadable muddy smudge. | **Solid Nocturnal Slate with Razor Accents**: Solid `bg-slate-950` with crisp `border-white/10` court lines and sharp, high-contrast single-hue accents (`bg-orange-500` or `from-orange-500 to-orange-600`). Zero murky brown washes. |

### 2.2 Strictly Prohibited Visual Anti-Patterns ("DON'TS")
1. **🚫 NO Murky / Muddy Gradients**: Never blend dark slate into dark orange/brown tones (e.g. `to-orange-950`, `via-slate-950 to-orange-950/40`, or dark blurry corner smog). Use solid nocturnal surfaces (`bg-slate-950`) with high-contrast court borders and vibrant accents.
2. **🚫 NO Collapsed / Micro Checkboxes**: Never rely on unconfigured fractional Tailwind sizes (e.g. `size-4.5`) that collapse checkboxes to a 2px border box. Checkboxes must strictly use `size-5 min-w-[20px] min-h-[20px] border-2` for tactile touch accessibility.
3. **🚫 NO Duplicate Action Buttons**: Never render duplicate primary actions on the same view (e.g. `Log In` in top header AND bottom nav; or `Create Account` at top right of modal AND at the footer). Maintain a single canonical action hierarchy.
4. **🚫 NO Low-Contrast Ghost Buttons**: Never place semi-transparent white-on-light or unreadable ghost buttons on dark cards. Secondary buttons on dark surfaces must use `bg-slate-900 border border-white/15 text-white hover:bg-slate-800`.
5. **🚫 NO Raw Emojis**: Emojis are strictly banned across all components, badges, toasts, and headers. Use pure scalable vector icons.


## 3. Color Tokens & Semantic Palette Architecture

The platform uses a semantic design token system configured in `index.css` and extended via Tailwind CSS.

### 3.1 Core Foundation Palette

```
[ Nocturnal Base #020617 ] ────────── [ Surface Dark #0F172A ] ────────── [ Inset Stage #1E293B ]
            │                                     │                                    │
            ▼                                     ▼                                    ▼
[ Palawan Orange #F97316 ] ───────── [ Active State #EA580C ] ────────── [ Accent Subtle rgba(249,115,22,0.1) ]
```

| Role | Token / Utility | Hex / RGB Value | Semantic Application & Contrast Rule |
| :--- | :--- | :--- | :--- |
| **Primary (Palawan Solar Orange)** | `hsl(var(--primary))` / `orange-500` | `#F97316` | Main CTAs, active navigation items, live score emphasis, champion trophy glow. Minimum 3:1 contrast against dark backgrounds. |
| **Primary Pressed / Hover** | `orange-600` | `#EA580C` | Button hover and pressed feedback states. |
| **Primary Subtle Tint** | `orange-500/10` to `orange-500/20` | `rgba(249,115,22,0.1)` | Pill backgrounds, active radio fills, subtle tournament stage highlights. |
| **Deep Arena Nocturnal Base** | `slate-950` | `#020617` | Bracket canvas background, live match arena background, high-contrast modal backdrops. |
| **Surface Dark (Elevated)** | `slate-900` | `#0F172A` | Desktop persistent sidebar, dark mode cards, header bars. |
| **Surface Dark Inset** | `slate-800` | `#1E293B` | Inset score containers, secondary stat blocks, input backdrops in dark mode. |
| **Surface Light (Body)** | `slate-50` / `hsl(var(--background))` | `#F8FAFC` | Light mode page canvas, soft containers, table row alternates. |
| **Surface Light Card** | `white` / `hsl(var(--card))` | `#FFFFFF` | Light mode elevated cards, popover surfaces, dropdown menus. |
| **Borders & Court Dividers** | `slate-200` / `white/10` | `#E2E8F0` / `rgba(255,255,255,0.1)` | Subtle structural separation, tournament bracket connective lines. |

### 3.2 Semantic Status & Accolade Signals

| Status | Color Tokens | Icon Token | Semantic Application |
| :--- | :--- | :--- | :--- |
| **Live Match / Ongoing** | `bg-red-500 text-white animate-pulse` | `Activity`, Ping dot | Real-time active match, buzzer countdown, live scoring facilitator session. |
| **Verified / Approved** | `text-emerald-500 bg-emerald-500/10` | `CheckCircle2` | Approved athlete eligibility, cleared medical waiver, team roster verified. |
| **Pending / Under Review** | `text-amber-500 bg-amber-500/10` | `Clock`, `AlertTriangle` | Document awaiting athletic director review, lease timeout warning. |
| **Rejected / Ineligible** | `text-rose-500 bg-rose-500/10` | `XCircle` | Disqualified team, rejected eligibility document, network transmission error. |
| **Champion / MVP Gold** | `text-amber-400 bg-amber-400/15` | `Crown`, `Trophy` | Tournament Champion Knockout Winner, MVP top performer accolade. |
| **Bronze Medalist / 3rd** | `text-amber-600 bg-amber-600/15` | `Medal` | 3rd-place playoff bracket matches and podium finishers. |

---

## 4. Typography System: Athletic Voice & Tabular Precision

Typography must reflect the collegiate athletic spirit—authoritative, kinetic, and readable from a distance.

### 4.1 Type Hierarchy & Tailwind Conventions

```
HERO DISPLAY      MATCH CENTER / TOURNAMENT ARENA       (text-3xl sm:text-5xl font-black italic uppercase)
SECTION (H2)      KNOCKOUT STAGE — QUARTER FINALS       (text-xl sm:text-2xl font-black italic uppercase)
SUBHEADER (H3)    COLLEGE OF ENGINEERING (CEAT)         (text-sm sm:text-base font-black uppercase)
EYEBROW OVERLINE  SPORT DISCIPLINE • VENUE COURT 1       (text-[10px] font-black uppercase tracking-[0.2em])
TABULAR NUMBERS   89 : 86   |   Q4 02:45                (font-black tabular-nums tracking-tight)
BODY STANDARD     Official tournament scoring rules...  (text-xs sm:text-sm font-medium leading-relaxed)
```

| Hierarchy Level | Tailwind Specification | Visual Character | Usage Guidelines |
| :--- | :--- | :--- | :--- |
| **Hero Display** | `text-3xl sm:text-5xl md:text-6xl font-black italic tracking-tighter uppercase leading-none` | Bold slanted collegiate headline; commands immediate focus. | Page hero banners, tournament titles, giant match headers. |
| **Section Header (H2)** | `text-xl sm:text-2xl font-black italic tracking-tight uppercase` | Section divider with collegiate momentum. | Bracket phase titles, card section titles, modal headers. |
| **Subheader (H3/H4)** | `text-sm sm:text-base font-black uppercase tracking-tight` | Dense, crisp team and category marker. | Team names in brackets, roster list names, table headers. |
| **Eyebrow / Overline** | `text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500` | Widely spaced, authoritative meta label. | Form field categories, match timestamps, tournament format badges. |
| **Tabular Numbers** | `font-black tabular-nums tracking-tight` | Monospaced numeric glyphs; zero layout jitter during score changes. | Live scoreboards, game clocks (`14:32`), standings point differentials. |
| **Body Standard** | `text-xs sm:text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300` | Clean, high-legibility body copy (WCAG AA). | Explanatory rules, modal descriptions, empty state guidelines. |

---

## 5. Iconography Standards (Anti-Slop Pure Vector Policy)

Raw emojis (`🏀`, `⚽`, `🏆`) are strictly banned from all UI components, buttons, dropdowns, and toast messages. All iconography is rendered via typed React SVG components with strict visual alignment.

### 5.1 Collegiate Sport Glyphs (`react-icons/gi` & `react-icons/fa6`)

| Sport Discipline | React Component | Package | Visual Representation |
| :--- | :--- | :--- | :--- |
| **Basketball** | `<GiBasketballBall />` | `react-icons/gi` | Authentic 8-panel collegiate basketball sphere. |
| **Volleyball** | `<GiVolleyballBall />` | `react-icons/gi` | Regulation 18-panel volleyball sphere. |
| **Soccer / Football** | `<GiSoccerBall />` | `react-icons/gi` | Classic truncated icosahedron soccer ball. |
| **Badminton** | `<GiShuttlecock />` | `react-icons/gi` | Feathered shuttlecock / birdie in flight. |
| **Baseball** | `<GiBaseballBat />` | `react-icons/gi` | Crossed regulation collegiate baseball bats. |
| **Futsal** | `<GiSoccerKick />` | `react-icons/gi` | Dynamic indoor court strike action. |
| **Table Tennis** | `<GiPingPongBat />` | `react-icons/gi` | Regulation paddle with ball in play. |
| **Esports** | `<GiGamepad />` | `react-icons/gi` | Competitive console / esports gamepad controller. |
| **Chess** | `<GiChessKnight />` | `react-icons/gi` | Sculpted tactical chess knight piece. |
| **Swimming** | `<FaPersonSwimming />` | `react-icons/fa6` | Swimmer freestyle stroke silhouette. |
| **Athletics / Track** | `<GiRunningShoe />` | `react-icons/gi` | Track and field running spike shoe. |

### 5.2 System & Action Icons (`lucide-react`)
- **Navigation**: `LayoutDashboard`, `Globe` (Match Center), `Trophy` (Tournaments), `Medal` (Standings), `ShieldCheck` (Verifications), `ClipboardList` (Audit Logs), `UserCheck` (My Teams).
- **Controls & Modals**: `Clock` (Scheduled match), `MapPin` (Venue location), `Search` (Filter triggers), `ChevronRight` (Breadcrumbs), `Lock` (Locked Phase 2), `Crown` (Champion accolade), `AlertTriangle` (Validation warnings), `Zap` (Starter athlete indicator), `CheckCircle2` / `XCircle` (Approval controls).

### 5.3 Icon Styling & Enclosure Guidelines
- **Sport Chip Enclosure**: Always pair sport glyphs with a dedicated subtle badge container:
  ```tsx
  <div className="size-5 rounded-lg flex items-center justify-center bg-orange-500/10 text-orange-600 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
    <GiBasketballBall className="size-3.5" />
  </div>
  ```
- **Stroke Width Consistency**: Use `strokeWidth={2}` for system navigation and `strokeWidth={2.5}` for small status indicators (12px–14px). Never mix heavy 3px strokes with hairline 1px strokes in the same component.

---

## 6. Mobile-First Reactive UI Architecture

Every page must be designed for mobile first, ensuring fluid usability on 320px–420px viewports before progressively enhancing for tablets and wide desktop arenas.

### 6.1 Breakpoint Grid Matrix

```
┌─────────────────────────────────────────────────────────────┐
│ Mobile (Default, 320px – 639px):                            │
│  • Single-column fluid stack (grid-cols-1)                  │
│  • Full-width touch targets (w-full, min-h-[44px])          │
│  • Horizontal swipeable chip lists with scrollbar-hide      │
│  • Mobile Round Segment Selector for Knockout Brackets       │
│  • Bottom-anchored modal sheets or full-screen dialogs      │
├─────────────────────────────────────────────────────────────┤
│ Tablet (sm / md, 640px – 1023px):                           │
│  • Balanced 2-column form grids (sm:grid-cols-2)            │
│  • Collapsible side drawer with overlay backdrop            │
│  • Semi-expanded bracket trees with horizontal swipe cue    │
├─────────────────────────────────────────────────────────────┤
│ Desktop Arena (lg / xl, 1024px+):                           │
│  • Persistent dark navigation rail (w-64)                   │
│  • 3-to-4 column tournament data cards                      │
│  • Multi-column side-by-side knockout bracket tree canvas   │
│  • Split-view athlete verification document inspector       │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Essential Mobile-First Reactive Patterns

#### 1. Zero-Horizontal-Scroll Law
The viewport body must never scroll horizontally (`overflow-x-hidden` on outer shell). Any component requiring horizontal traversal (sport filters, bracket stages, stat tables) must be self-contained within a dedicated scroll wrapper:
```tsx
<div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 touch-pan-x">
  {sports.map(sport => (...))}
</div>
```

#### 2. Touch Target Minimums & Safe Areas
- **Minimum Hit Area**: Every clickable button, tab, or select trigger must measure at least **44px $\times$ 44px** (or `min-h-[44px]`).
- **Touch Spacing**: Maintain at least **8px** of spacing between adjacent tap targets to prevent accidental mis-taps courtside.
- **Dynamic Viewport Height**: Always use `min-h-dvh` instead of `min-h-screen` or `100vh` to avoid mobile browser navigation bar jumps.

#### 3. Mobile Round Segment Selector (Knockout Bracket Navigation)
Large tournament brackets cannot fit side-by-side on mobile without making team names unreadable. We implement an **Adaptive Round Segment Selector**:
- On Mobile (`< md`): Users tap pills (`[ Quarters ] [ Semis ] [ Championship ]`) to instantly focus on the active stage.
- On Desktop (`md+`): The entire bracket expands into a connected horizontal tree canvas with visual connector branches.

---

## 7. Component Conventions: Anti-Slop vs Generic AI Code

To guarantee consistency, use these side-by-side patterns when implementing or refactoring UI components:

### 7.1 Buttons: Athletic Action vs Generic AI Button

```tsx
// ❌ GENERIC AI SLOP (Bland gradient, blurry shadow, raw emoji, zero active feedback)
<button className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white p-4 rounded-xl shadow-lg hover:opacity-90">
  🚀 Join Tournament Now
</button>

// ✅ PSU SPORTSTRACK STANDARD (Tactile, uppercase athletic slant, pure vector, instant press)
<Button className="bg-orange-500 hover:bg-orange-600 text-white font-black uppercase italic tracking-wider h-11 sm:h-12 px-5 sm:px-6 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-all inline-flex items-center gap-2">
  <Trophy className="size-4" />
  <span>ENTER TOURNAMENT</span>
</Button>
```

### 7.2 Cards: Dark Inset Stage vs Floaty Generic Card

```tsx
// ❌ GENERIC AI SLOP (Floating white box, massive shadow, low density, generic icon)
<div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 flex flex-col gap-4">
  <div className="p-3 bg-purple-100 rounded-full w-fit">✨</div>
  <h3 className="text-xl font-bold">Match Summary</h3>
  <p className="text-gray-500">Some details about the match will go here.</p>
</div>

// ✅ PSU SPORTSTRACK STANDARD (Nocturnal arena stage, collegiate borders, high density, tabular nums)
<div className="bg-slate-950 text-white border border-white/10 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-2xl relative overflow-hidden group hover:border-orange-500/30 transition-all">
  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
    <div className="flex items-center gap-2">
      <div className="size-7 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
        <GiBasketballBall className="size-4" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        CHAMPIONSHIP MATCH • COURT 1
      </span>
    </div>
    <span className="bg-red-500 text-white font-black text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md animate-pulse">
      LIVE Q4
    </span>
  </div>
  <div className="flex items-center justify-between">
    <div className="space-y-1">
      <p className="text-base font-black uppercase tracking-tight">CEAT WILDCATS</p>
      <p className="text-3xl font-black tabular-nums tracking-tighter text-orange-500">89</p>
    </div>
    <span className="text-xs font-black italic text-slate-600 uppercase">VS</span>
    <div className="space-y-1 text-right">
      <p className="text-base font-black uppercase tracking-tight">CS TITANS</p>
      <p className="text-3xl font-black tabular-nums tracking-tighter text-white">84</p>
    </div>
  </div>
</div>
```

### 7.3 Badges & Category Chips: High-Energy Pill vs Pastel Blob

```tsx
// ❌ GENERIC AI SLOP (Soft pastel blob with emoji, no border definition)
<span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
  🏀 Basketball
</span>

// ✅ PSU SPORTSTRACK STANDARD (Collegiate contrast, vector glyph, border definition)
<span className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase tracking-wider border border-orange-500/20 inline-flex items-center gap-1.5">
  <GiBasketballBall className="size-3" />
  <span>BASKETBALL</span>
</span>
```

### 7.4 Form Inputs & Dropdown Triggers: Robust Touch Primitives

- **Full Grid Occupancy**: Select triggers and inputs must span full width (`w-full`) to adapt cleanly across mobile stacks and desktop grids.
- **Graceful Value Truncation**: `<SelectValue>` must incorporate `truncate block max-w-full` to prevent long college names from displacing trigger boundaries.
- **Multi-Line Option Wrapping**: `<SelectItem>` text must use `whitespace-normal break-words py-2 pr-8 pl-4` so descriptive college departments never get cut off.

---

## 8. Motion, Feedback & Kinetic Tactility

UI interactions must communicate physical cause-and-effect with zero perceptible lag.

### 8.1 Motion Guidelines
- **Duration Timing**: Keep micro-interactions between **150ms and 250ms**. Transitions exceeding 400ms feel sluggish in a live sports scoring context.
- **Physical Press Feedback**: Apply scale transformations on active touch:
  - Large CTAs: `active:scale-[0.98]`
  - Small pills & chips: `active:scale-95`
- **Synchronized Live Pulse**: Active games combine a steady background pulse with an outward ping:
  ```tsx
  <span className="relative flex size-2">
    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
    <span className="relative inline-flex rounded-full size-2 bg-red-500" />
  </span>
  ```
- **Reduced Motion Support**: Always respect accessibility preferences via Tailwind's `motion-reduce:` modifiers (`motion-reduce:transition-none`).

---

## 9. Domain-Specific UI Pattern Blueprints

### 9.1 The Live Match Scorer
- **Courtside Touch Controls**: Oversized plus/minus buttons (`min-h-[56px]`) for rapid point logging by table officials under pressure.
- **Stabilized Score Clocks**: Monospaced digits (`tabular-nums`) ensure the timer (`02:45.3`) does not cause layout shifts while counting down.
- **Foul / Period Pips**: Visual pip indicators (filled and outlined circles) representing team fouls and period markers instead of raw text counters.

### 9.2 The Knockout Bracket Arena
- **Connector Hierarchy**: Knockout tree lines use subtle semi-transparent borders (`border-white/10` or `border-slate-200`) connecting match pairs directly to their winner slot.
- **Locked Phase Signaling**: Upcoming phases display a locked badge (`<Lock className="size-3.5" /> PHASE 2 LOCKED`) with semi-transparent team slots.
- **Champion Podium Card**: The championship winner slot is highlighted with a gold halo border (`border-amber-400/40`), radial glow, and `<Trophy />` vector crest.

### 9.3 Athlete Verification Inspector
- **Split-View Verification**: On desktop, show the athlete's college roster profile alongside the uploaded document preview (COR, Medical Clearance, PSA Certificate).
- **Instant Decision Bar**: Sticky footer action bar with distinct, separated actions:
  - Green Approve: `<CheckCircle2 /> APPROVE ATHLETE`
  - Red Reject: `<XCircle /> REJECT (SPECIFY REASON)`

---

## 10. Anti-Slop Pre-Flight Checklist for Engineers & AI Agents

Before submitting any new feature, page, or UI refactoring, verify compliance against every rule in this checklist:

- [ ] **1. Zero Raw Emojis**: Verify that zero raw emojis (`🏀`, `🏆`, `🔥`, `🎉`) exist in UI code, strings, tooltips, or toast notifications. All icons use `react-icons/gi` (sports) or `lucide-react` (system).
- [ ] **2. No Generic AI Color Palettes**: Confirm absence of generic purple/indigo gradients. UI adheres to Palawan Solar Orange (`#F97316`) and Nocturnal Slate (`#020617`).
- [ ] **3. Mobile-First Tested**: Verified at 360px viewport width. Zero horizontal page overflow; all sport filter bars and brackets support horizontal swipe or segment selection.
- [ ] **4. 44px+ Touch Targets**: All interactive elements (buttons, filter chips, dropdown triggers) have minimum heights of at least 40px–44px with 8px+ touch spacing.
- [ ] **5. Slanted Athletic Display Headings**: Page titles and section markers use `font-black italic uppercase tracking-tighter`.
- [ ] **6. Tabular Scoring Digits**: All scores, game clocks, and statistics utilize `tabular-nums` to eliminate layout jitter.
- [ ] **7. Controlled Dropdowns Without UUID Bleed**: Radix `<SelectValue>` components dynamically resolve to human-readable labels rather than raw database UUIDs.
- [ ] **8. Kinetic Press States**: Interactive buttons feature `active:scale-[0.98]` and clean 150ms transitions.
- [ ] **9. High Information Density**: Cards prioritize athletic data, match times, team codes, and status pills over empty whitespace.
- [ ] **10. Route-Level Code Splitting**: New pages are loaded via `React.lazy()` with athletic suspense fallbacks to protect bundle size.
- [ ] **11. WCAG AA Contrast Parity**: White text on dark cards and dark slate text on light backgrounds meet 4.5:1 contrast requirements.
- [ ] **12. Production Cleanliness**: All debug logs are gated behind `import.meta.env.DEV`, and `npm run build` exits with code 0.
