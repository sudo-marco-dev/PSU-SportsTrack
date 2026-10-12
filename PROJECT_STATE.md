# PSU SportsTrack - Project State

## 🏛️ Architecture
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui, next-themes.
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage, Realtime).
- **Testing**: Playwright.

## 📍 Current State
- **Active Phase**: Phase 7: Developer Portal, Capstone Command Center & Thesis Defense Workbench.
- **Completed**: Project scaffolding, Playwright configuration, Supabase DB Schema & RLS initialization.
- [x] Phase 3.1 Database Schema (Matches, Live Feed, MVP Stars).
- [x] Phase 3.2 Dual-Mode Bracket Generation (Auto/Manual).
- [x] Phase 3.3 Match Execution & Live Play-by-Play Dashboard.
- **Test Data Seeded**: Admin, Coaches, and 10 Pre-Verified Players.

## 🚀 Features
- [x] Database Schema & RLS Policies
- [x] Authentication Flow (Supabase Auth)
- [x] Login Security & Rate Limiting (3 Failed Attempts Limit + 5-Minute Cooldown with Real-time Countdown & Remaining Attempts Alert)
- [x] Role-Based Protected Routes
- [x] Document Verification Upload (Supabase Storage)
- [x] Admin Verification Dashboard
- [x] Admin Tournament Termination & Cascade Cleanup (with Two-Step Safety Confirmation Modal)
- [x] User Ranking & Leaderboard Architecture (Multi-Dimensional Filters: Tournaments, Sports, Most Wins, Overall Championships, and Competition Years)
- [x] Phase 2.1 Database Schema (Tournaments & Teams)
- [x] Phase 2.2 Coach Team Formation & 2-Step Roster Invites
- [x] Phase 2.3 Admin Tournament Setup & Team Approvals
- [x] Phase 3.2 Dual-Mode Bracket Generation
- [x] Phase 3.3 Live Scoring & Commentary Control
- [x] Phase 4 MVP Star System (Red & Gold Stars)
- [x] Phase 5.1 Realtime Dashboard Polish (WebSockets)
- [x] Phase 5.2 Custom 404 Page & Smart Role-Based Redirects
- [x] Phase 5.3 Supabase Auth Production Routes (Email Confirm & Password Reset)
- [x] Phase 5.4 Vercel Deployment Configuration (SPA Rewrites & Legacy Redirects)
- [x] Phase 5.5 Forgot Password Flow (Login screen integration, secure reset token handling, and form validation)
- [x] Phase 5.6 Admin Audit Log Time Filters (Today, Week, Month)
- [x] Phase 5.7 Registration Security (Confirm Password Field)
- [x] Phase 5.8 Coach Recruitment Validation (Duplicate Sport Prevention)
- [x] Phase 5.9 Role Normalization & Unified RBAC (`super_admin`, `facilitator`, `coach`, `player_student`, `player_faculty`, `dev`)
- [x] Phase 5.10 Institutional PSU COR Verification & Student Corporate Email Parser
- [x] Phase 5.11 Courtside Scorer Attribution, Score Deduction & Realtime Box Score Deck
- [x] Phase 5.12 Anti-Slop Vector Sports Icon System (`react-icons/gi`, `react-icons/fa6` & centralized `sportIcons.ts`)
- [x] Phase 5.13 Universal Mobile-First App Shell (Persistent 5-tier bottom nav rail, safe-area insets & zero-overflow dialogs)
- [x] Phase 5.14 Next-Themes Dynamic Dark/Light Mode Engine & Nocturnal Color Architecture
- [x] Phase 5.15 Public Users Email Synchronization (`trg_sync_user_email` trigger & registration pipeline persistence)
- [x] Phase 6.1 Authentic Sport Scoring Rule Profiles (`sportScoringRules.ts` for 9 ball sports)
- [x] Phase 6.2 Standalone Big Screen Stadium Jumbotron / Focus View (`/match/:id/display`)
- [x] Phase 6.3 Universal Picture-in-Picture Floating Window & In-App Widget (`pipScoreboard.ts`, `FloatingScoreWidget.tsx`)
- [x] Phase 6.4 Dynamic Scoreboard Keyframe Animations & Telemetry (Score pop, floating deltas, lead-change alerts, momentum runs)
- [x] Phase 6.5 Procedural Courtside Web Audio FX Synthesizer (Score chimes, buzzer klaxon, Fox 40 whistle, timeout klaxon, sub horns)
- [x] Phase 6.6 Courtside Facilitator Kiosk Mode (`/match/:id/kiosk` Steam Deck tactile console, zero-scroll mobile viewport snapping, dual split / full card thumb controls, 2-tap subs, master game clock, timeouts, fouls, court swap)
- [x] Phase 6.7 Official Timeout Clock Auto-Pause & Stadium Lower-Third Substitution Banner
- [x] Phase 6.8 Kiosk Direct Database Write Verification (`.select('id')` RLS rejection detection)
- [x] Phase 6.9 Context-Aware Login Redirection (Preserving current route on courtside/in-progress pages)
- [x] Phase 6.10 In-Tab SPA Navigation Harmonization (Replacing multi-tab spawning with seamless in-app navigation)
- [x] Phase 7.1 Canonical `'dev'` Role & Root Access RBAC Bypass (`isDev = true`, full system traversal)
- [x] Phase 7.2 Dedicated Developer Sandbox Workbench (`/dev` with 5-tab control center)
- [x] Phase 7.3 Multi-Stage Capstone Scenario Injectors (`Clean Slate`, `Verification Queue`, `Live Halftime Showdown`, `Completed Championship`)
- [x] Phase 7.4 Live Match Realtime Event Bot Simulator (6s interval auto-play pulse across WebSockets)
- [x] Phase 7.5 User Ledger, Quick Role Switcher, Lockout Reset & Instant Verification Toggle
- [x] Phase 7.6 Database Row Counter & System Health Tooling
- [x] Phase 7.7 Guided Capstone Defense Script with Direct Interactive Deep Links

## 🛠️ Recent Modifications & Change Log

### Security & Audit Polish
- **Description**: Implemented several security and usability enhancements across the platform:
  1. **Registration Polish**: Added a "Confirm Password" field with Zod schema validation to prevent password typos during account creation.
  2. **Audit Logs Timeline**: Upgraded the `AdminAuditLogs` view with a time-based filtering dropdown, allowing administrators to filter activity logs by "Today", "Past 7 Days", and "Past 30 Days", alongside the existing text search.
  3. **Recruitment Validation**: Added robust database validation in `TeamManagement` to block coaches from recruiting athletes who are already on an active or pending roster for a team competing in the same sport.
- **Files Modified**:
  - `src/pages/Register.tsx`: Added confirm password field and schema updates.
  - `src/pages/AdminAuditLogs.tsx`: Integrated time filters and live monitoring badges.
  - `src/pages/TeamManagement.tsx`: Added duplicate sport validation check prior to `team_roster` insertion.

### Tournament Termination & Deletion with Two-Step Confirmation
- **Description**: Added an option for administrators to delete/terminate an entire tournament directly from the Tournament Arena (`/admin/tournaments`) in both Grid and List view. 
  - To prevent accidental deletions, a dedicated confirmation dialog requires typing `DELETE` to confirm.
  - Deletion performs a safe cascade deletion in the database: breaks self-referencing `next_match_id` pointers, purges associated `match_events`, `player_stars`, `matches`, `team_roster`, and registered `teams` before removing the tournament row, and logs the action to audit logs.
  - Removed duplicate dialog declaration so only a single confirmation modal opens upon clicking the termination trash icon.
- **Files Modified**:
  - `src/components/ui/dialog.tsx`: Cleaned up `DialogContent` base classes and removed `-mx-4 -mb-4 bg-muted/50` from `DialogFooter` to prevent nested/doubled card appearance.
  - `src/pages/TournamentManagement.tsx`: Removed duplicate `isDeleteOpen` Dialog component, added cascade cleanup logic, and audit logging.
  - `PROJECT_STATE.md`: Documented tournament deletion feature and safety confirmation modal.

### Coming Soon Games & Draft Tournament Pipeline Across All Dashboards
- **Description**: Enabled the **Coming Soon / Draft Tournament** showcase across user dashboards:
  1. **Admin Dashboard (`/admin/dashboard`)**: Displays the *Upcoming Tournament Arena Pipeline* showing open draft tournaments with one-click navigation to review teams and setup brackets.
  2. **Coach Dashboard (`/coach/dashboard`)**: Displays the *Coming Soon • Registration Open* pipeline showcase enabling coaches to view enrolling competitions and apply squads.
  3. **Player Dashboard (`/player/dashboard`)**: Added the *Coming Soon • Upcoming Tournaments* recruitment cards showcasing upcoming competitions, sports disciplines, and kickoff dates so athletes know what tournaments are recruiting.
  4. **Match Center (`/matches`)**: Displays "Coming Soon" badges in the sidebar and a dedicated Draft State overview screen when a draft tournament is selected.
- **Files Modified**:
  - `src/pages/PlayerDashboard.tsx`: Added draft tournaments query and Coming Soon cards section.
  - `src/pages/AdminDashboard.tsx`: Upcoming Tournament Arena Pipeline showcase.
  - `src/pages/CoachDashboard.tsx`: Coming Soon Registration Open showcase.
  - `src/pages/TournamentExplorer.tsx`: Coming Soon badges and Draft Phase hero state.
  - `PROJECT_STATE.md`: Documented dashboard updates.

### Mobile Responsiveness Refactoring Across All Dashboards & Components
- **Description**: Comprehensive UI/UX mobile responsiveness refactor for all recent features:
  1. **Admin Dashboard (`/admin`)**: Made Coming Soon pipeline banner flex wrapping & mobile-friendly, optimized stat cards to 2-column mobile grid, made verification breakdown progress bar & legends stack cleanly on small screens.
  2. **Coach Dashboard (`/coach`)**: Compact header padding & icon sizes, mobile full-width action buttons, responsive analytics card padding and typography.
  3. **Player Dashboard (`/player`)**: Responsive athlete hub banner, achievement preview flex wrapping, Coming Soon recruitment cards layout & inline details modal.
  4. **Match Center (`/explorer`)**: Responsive hero header, mobile tab bar layout with centered text/icons, matchup card layout.
  5. **Leaderboard & Ranking (`/ranking`)**: Responsive header banner, mobile-safe podium cards (`scale-100` on mobile to prevent overflow), responsive filter toolbar.
  6. **Tournament Arena (`/admin/tournaments`)**: Added `overflow-x-auto` horizontal scrolling container for table view.
- **Files Modified**:
  - `src/pages/AdminDashboard.tsx`
  - `src/pages/CoachDashboard.tsx`
  - `src/pages/PlayerDashboard.tsx`
  - `src/pages/TournamentExplorer.tsx`
  - `src/pages/Ranking.tsx`
  - `src/pages/TournamentManagement.tsx`
  - `PROJECT_STATE.md`

### Phase 5: Facilitator Governance, Bronze Brackets & Capstone Readiness
- **Description**: Implementing the 5 core systems finalized during architectural grilling:
  1. **Facilitator Scoring Authority & Lease Engine**: Restricting live scoring and match controls strictly to `facilitator` and `super_admin` (removing coach scoring permissions). Single facilitator 90s heartbeat lease engine with Admin override.
  2. **Coach Pre-Match Lineup & Availability Ops**: Starting lineup selection (Starters vs Bench), jersey number management (`team_roster.jersey_number`), sports positions, and game-day availability check-in (`active`, `injured`, `excused`).
  3. **Automated 3rd-Place (Bronze Medal) Bracket Engine**: Connecting semi-final losers to a Bronze Playoff fixture (`loser_next_match_id`), and rendering prominently on the tournament bracket canvas.
  4. **Court-Side Offline Resilience**: IndexedDB event buffering for intermittent campus network dropouts, deferred completion syncing, and atomic batch sync RPC.
  5. **Capstone Demo Staging Protocol**: Idempotent demo reset script `npm run seed:demo` and triple-guarded Admin Dashboard reset trigger.
- **Files Modified**:
  - `CONTEXT.md`
  - `PROJECT_STATE.md`
  - `supabase/migrations/20260922_phase5_facilitator_and_bronze_brackets.sql`
  - `src/pages/LiveMatch.tsx`
  - `src/pages/TeamManagement.tsx`
  - `src/pages/TournamentManagement.tsx`
  - `src/pages/TournamentExplorer.tsx`
  - `src/pages/AdminDashboard.tsx`
  - `src/lib/offlineQueue.ts`
  - `src/lib/demoReset.ts`
  - `scripts/seed_demo.js`
  - `package.json`

### Canonical Role Normalization & Unified Governance
- **Description**: Rebuilt and unified the entire user role architecture to eliminate legacy PascalCase/snake_case disparities:
  1. **Canonical Schema Check**: Hardened database constraint to strictly require canonical snake_case identifiers (`CHECK (role IN ('super_admin', 'facilitator', 'coach', 'player_student', 'player_faculty'))`).
  2. **Database Data Normalization**: Executed data migration normalizing all existing users to canonical values.
  3. **Strict Context & Route Guards**: Refactored `AuthContext.tsx` and `ProtectedRoute.tsx` to eliminate redundant fallback checks, cleanly routing `super_admin` directly to `/admin`, `coach` to `/coach`, and athletes to `/player`.
  4. **Documentation Sync**: Rewrote `user_roles_and_access_control.md` to establish the definitive source of truth for platform RBAC.
- **Files Modified**:
  - `supabase/migrations/20261010_unify_roles.sql`
  - `src/context/AuthContext.tsx`
  - `src/components/ProtectedRoute.tsx`
  - `src/App.tsx`
  - `src/components/auth/LoginModal.tsx`
  - `src/pages/Register.tsx`
  - `user_roles_and_access_control.md`

### Official PSU COR Verification, Corporate Email Parser & PDF Canvas Preview
- **Description**: Upgraded the athlete clearance pipeline with strict university-grade verification tools:
  1. **Discrete Name Parsing**: Upgraded athlete registration to separate First Name and Last Name inputs for unambiguous database storage and accurate document string matching.
  2. **Corporate Student Email Validation**: Added regex extraction for official PSU student corporate emails (`[student_number]@psu.palawan.edu.ph`), cross-verifying the student ID extracted from the Certificate of Registration (COR) and contributing 15 confidence points.
  3. **Client-Side Canvas PDF Viewer**: Integrated custom PDF.js canvas viewer in `CanvasPdfViewer.tsx`, eliminating forced browser download prompts and enabling in-browser document inspection with anchored zoom controls.
  4. **Direct University Portal Integration**: Added direct verification links to the official PSU student portal (`https://oes.psu.palawan.edu.ph/aims/students/`).
- **Files Modified**:
  - `src/lib/corParser.ts`
  - `src/components/admin/CanvasPdfViewer.tsx`
  - `src/pages/SystemVerifications.tsx`
  - `src/pages/Register.tsx`
  - `src/components/auth/LoginModal.tsx`

### Live Match Scorer Attribution, Score Deductions & Box Score Deck
- **Description**: Enhanced courtside live match operations for facilitators and administrators:
  1. **Player Scoring Attribution**: Clicking score increment buttons (`+1 FT`, `+2 Field`, `+3 Triple`) launches the Scorer Attribution Modal to assign the point to specific active or pending team athletes, with an inline fallback for walk-on jersey numbers.
  2. **Deduction & Rollback Safeguards**: Added score deduction dialog with destructive confirmation warning and a non-negative floor guard (`score >= 0`) that rolls back athlete box scores and generates audit entries.
  3. **Real-time Box Score Deck**: Integrated live courtside Box Score leaderboard tracking points per player, updating automatically over Supabase Realtime Postgres change events and broadcast channels.
- **Files Modified**:
  - `src/pages/LiveMatch.tsx`

### Universal Mobile-First App Shell & Anti-Overflow Architecture
- **Description**: Implemented universal mobile-first layout standards eliminating clipping and scroll bugs:
  1. **5-Tier Persistent Bottom Navigation Rail**: Implemented persistent, fixed bottom navigation bar on mobile with role-aware destinations (`Home`, `Matches`, `Rankings`, `Profile/Login`, `More`), isolation styling, and iOS `.pb-safe` padding.
  2. **Elimination of Redundant Action Buttons**: Removed duplicate header login and burger menu buttons on mobile; eliminated redundant toggle buttons in auth dialogs.
  3. **Nocturnal Arena Visual Standards**: Replaced washed-out, muddy brown/orange gradients with deep solid slate (`#020617`), vibrant orange court accents, and WCAG AA contrast.
  4. **Zero-Overflow Modal Dialogs & Dropdowns**: Enforced `max-h-[88dvh] overflow-y-auto` and `min-w-0` across all dialogs, preventing horizontal scroll blowout and mobile keyboard clipping.
- **Files Modified**:
  - `src/components/AppLayout.tsx`
  - `src/index.css`
  - `src/components/ui/dialog.tsx`
  - `src/components/ui/select.tsx`
  - `src/components/ui/card.tsx`
  - `src/components/ui/tabs.tsx`
  - `src/pages/About.tsx`
  - `design_context.md`
  - `design.md`

### Dynamic Theme Engine (Next-Themes) & Nocturnal Color Architecture
- **Description**: Integrated dark/light mode switching system:
  1. **Theme Provider**: Added `ThemeProvider` using `next-themes` with system preference detection and class attribute toggling.
  2. **Theme Toggle Component**: Created animated `ThemeToggle` button with smooth SVG rotation between Sun and Moon icons, accessible from both desktop sidebar and mobile drawer.
  3. **Universal Color Token Mapping**: Configured dark mode HSL CSS variables in `index.css` and audited all pages to ensure crisp contrast (`dark:bg-slate-900`, `dark:text-white`, `dark:border-white/10`).
- **Files Modified**:
  - `src/context/ThemeProvider.tsx`
  - `src/components/ui/ThemeToggle.tsx`
  - `src/App.tsx`
  - `src/components/AppLayout.tsx`
  - `src/components/layout/Navbar.tsx`
  - `src/index.css`
  - All page views (`AdminDashboard`, `CoachDashboard`, `LiveMatch`, `PlayerDashboard`, `Profile`, `Ranking`, `SystemVerifications`, `TeamManagement`, `TournamentExplorer`, `TournamentManagement`)

### Centralized Sports Vector Icon Registry (`sportIcons.ts`)
- **Description**: Eliminated generic placeholder icons and centralized all sport iconography:
  1. **Central Registry**: Created `src/lib/sportIcons.ts` with authentic vector sport glyphs from `react-icons/gi` and `react-icons/fa6` for all 11 collegiate disciplines.
  2. **Dynamic Resolver**: Implemented `getSportIcon(sportName)` fallback utility for seamless icon resolution across tournaments, match ledgers, brackets, and dashboard feeds.
- **Files Modified**:
  - `src/lib/sportIcons.ts`
  - `src/pages/AdminDashboard.tsx`
  - `src/pages/TournamentManagement.tsx`
  - `src/pages/TournamentExplorer.tsx`

### Public Users Email Schema Synchronization & Registration Pipeline
- **Description**: Connected Supabase Auth user emails to the public profile schema:
  1. **Database Migration**: Added `email TEXT` column to `public.users`, backfilled existing accounts from `auth.users`, and provisioned automatic trigger `trg_sync_user_email`.
  2. **Registration Flow**: Updated account registration and auth modal to insert `email` directly into `public.users`.
  3. **Verification Query Fallback**: Added resilient query handling in `SystemVerifications.tsx` to handle email lookups gracefully.
- **Files Modified**:
  - `supabase/migrations/20261011_add_email_to_users.sql`
  - `src/pages/Register.tsx`
  - `src/components/auth/LoginModal.tsx`
  - `src/pages/SystemVerifications.tsx`

### Phase 6: Live Scoring Ecosystem, Focus View Jumbotron, Courtside Kiosk & Audio FX Engine
- **Description**: Enterprise-grade live match presentation and courtside operations suite:
  1. **Sport Scoring Rules**: Authentic sport-specific scoring profiles for 9 ball sports (`SPORT_SCORING_PROFILES`) with custom units, action buttons, and period structures.
  2. **Focus View / Stadium Jumbotron (`/match/:id/display`)**: Standalone, edge-to-edge arena presentation with Screen Wake Lock, jumbotron clock pillar, live action ticker, spectator URL, and fullscreen toggle.
  3. **Multitasking PiP & In-App Widget**: Native OS Picture-in-Picture scoreboard canvas pipeline (`pipScoreboard.ts`) and reactive floating scoreboard badge (`FloatingScoreWidget.tsx`).
  4. **Procedural Web Audio FX Synthesizer (`audioFx.ts`)**: Pure Web Audio API synthesis (zero external audio files) providing score chimes, referee Fox 40 whistle, arena buzzer klaxon, timeout klaxon, sub horns, and clock chimes.
  5. **Tactile Courtside Facilitator Kiosk (`/match/:id/kiosk`)**: Steam Deck style console with zero-scroll mobile viewport snapping (`h-dvh max-h-dvh`), dual-thumb side-by-side split view, master digital game clock, 2-tap substitutions modal, timeouts with LED pips, fouls counter with bonus threshold alert, and court side swap.
  6. **Official Timeout Clock Auto-Pause & Broadcast Overlays**: Calling timeout auto-pauses the master clock and synchronizes SVG countdown overlay and lower-third substitution banners across all screens over WebSockets.
  7. **RLS Write Verification & Contextual Navigation**: Secured kiosk mutations with `.select('id')` verification to catch RLS rejections, preserved current path during in-kiosk login, and harmonized Focus View/Kiosk navigation to in-tab SPA transitions.
- **Files Modified**:
  - `src/lib/sportScoringRules.ts`
  - `src/lib/audioFx.ts`
  - `src/lib/pipScoreboard.ts`
  - `src/lib/scoreboardAnimations.ts`
  - `src/pages/StadiumDisplay.tsx`
  - `src/pages/FacilitatorKiosk.tsx`
  - `src/components/kiosk/KioskScoreColumn.tsx`
  - `src/components/kiosk/KioskCenterConsole.tsx`
  - `src/components/kiosk/KioskSubstitutionModal.tsx`
  - `src/components/scoreboard/StadiumGameClock.tsx`
  - `src/components/scoreboard/StadiumTimeoutOverlay.tsx`
  - `src/components/scoreboard/StadiumSubBanner.tsx`
  - `src/components/scoreboard/FloatingScoreWidget.tsx`
  - `src/components/auth/LoginModal.tsx`
  - `src/pages/LiveMatch.tsx`
  - `src/App.tsx`
  - `vite.config.ts`

### Phase 7: Developer Portal, Capstone Command Center & Thesis Defense Workbench
- **Description**: Enterprise developer instrumentation suite, multi-stage thesis presentation scenarios, and canonical root persona:
  1. **Canonical `dev` Role & Database Constraint**: Updated Supabase PostgreSQL `users_role_check` constraint to support `'dev'`. Created database migration `20261012_add_dev_role.sql`. Added `isDev` with complete root bypass across all RBAC evaluations (`isSuperAdmin`, `isCoach`, `isFacilitator`, `isStudentAthlete`).
  2. **Dedicated Capstone Sandbox Workbench (`/dev`)**: Built standalone developer portal (`DevSandbox.tsx`) accessible via `/dev` with 5 specialized evaluation tabs.
  3. **Multi-Stage Capstone Scenario Injectors (`devScenarios.ts`)**:
     - *Clean Slate*: Safely clears ephemeral test tournaments, brackets, match events, and rosters without touching university colleges or user credentials.
     - *COR Verification Queue*: Automatically provisions a draft tournament, mock athletes, and authentic OCR verification records with simulated confidence scores (95%, 80%, 45%) for live AIMS validation demos.
     - *Live Halftime Showdown*: Injects a high-octane 4th quarter basketball match (CAS 68 vs CBA 65) complete with running clock, fouls, timeouts, player star tallies, and commentary feed ready for immediate kiosk or display demonstration.
     - *Completed Championship*: Deploys championship and bronze matches, awards MVP Red & Gold Stars, and updates the official Palawan State University medal standing ledger (`/ranking`).
  4. **User & Stats Ledger**: Real-time user browser with 1-click role switcher dropdown, 1-click verification toggle (`is_verified`), and brute-force lockout reset.
  5. **Live Match Event Bot**: Interactive play simulator and auto-play bot pulsing real-time score events every 6s over WebSockets for multi-device sync testing.
  6. **Database Health & Row Counter**: Live row counts across 6 primary tables with one-click cleanup routines.
  7. **Capstone Defense Presentation Script**: 6-step guided walkthrough with direct interactive deep-links.
  8. **Clean Admin Separation**: Removed the disruptive demo reset banner from `AdminDashboard.tsx`, replacing it with an elegant "Dev Sandbox" button in Quick Operations.
- **Files Modified / Created**:
  - `supabase/migrations/20261012_add_dev_role.sql`
  - `src/context/AuthContext.tsx`
  - `src/components/ProtectedRoute.tsx`
  - `src/components/auth/LoginModal.tsx`
  - `src/components/AppLayout.tsx`
  - `src/pages/PlayerDashboard.tsx`
  - `src/pages/AdminDashboard.tsx`
  - `src/lib/devScenarios.ts`
  - `src/pages/DevSandbox.tsx`
  - `src/App.tsx`
  - `user_roles_and_access_control.md`
  - `PROJECT_STATE.md`
  - `local_change_log.md`

## 🎯 Deployment & Capstone Readiness
- [x] Phase 4: MVP Star System (Red & Gold Stars)
- [x] Phase 4.1: Binturungan Multi-Sport Creation & Tournament Lifecycle
- [x] Phase 5: Facilitator Governance, Offline Resilience & Bronze Brackets
- [x] Phase 5.9 - 5.15: Role Normalization, COR Pipeline, Theme Engine & Icon Standardization
- [x] Phase 6: Live Scoring Engine, Stadium Jumbotron Focus View, Facilitator Kiosk, Web Audio FX & Navigation Polish
- [x] Phase 7: Developer Portal, Capstone Command Center, Multi-Stage Scenarios & Thesis Defense Script
- [x] Production Build Validation: Zero TypeScript compiler errors (`tsc -b`), zero build failures (`vite build`)
- [x] Code Quality Audit: Zero ESLint errors across entire `src/` codebase
- [x] Database Synchronization: All migrations executed and active on remote Supabase project
- [x] Deployment Configuration: `vercel.json` SPA routing rewrites and security redirects configured


