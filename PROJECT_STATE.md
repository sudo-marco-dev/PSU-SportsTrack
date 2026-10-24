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
- [x] Phase 7.8 Universal Light & Dark Mode Color Palette Harmonization (`DevSandbox.tsx` seamless match with project design tokens)
- [x] Phase 7.9 Strict Zero-Emoji Anti-Slop Vector Enforcement (Complete elimination of raw emojis & unicode arrows across entire codebase)
- [x] Phase 7.10 Developer Role RLS Permission Elevation (Updated `has_role(role_name text)` PostgreSQL function to grant `'dev'` role test bench write permissions across all tables)
- [x] Phase 7.11 Sandbox Scenario Engine Hardening (Resolved check constraint serialization in Scenario B `verification_documents.status = 'Pending'`, Scenario D `player_stars` foreign key and `'Gold'/'Red'` constraints, and added `formatErrorMessage` for clean PostgREST error reporting)
- [x] Phase 7.12 The Grand Binturungan Olympiad Super Demo (Scenario E: Provisions all 9 official PSU sports, 9 collegiate squads, regulation rosters with jersey numbers `#1`–`#99`, sport-specific positions, starters/subs, team captains, coaches, complete 8-team tournament brackets, live volleyball match, and Gold/Silver/Bronze podium crowning CEAT, CS, and CBA)
- [x] Phase 7.13 Match Center Filter Revamp & Tree-Like Tournament Bracketing (Unified single-tier sport discipline rail, compact tournament dropdown & search toolbar, reactive auto-open of Phase 2 playoffs when elimination is complete, orthogonal SVG bracket tree connector forks linking Quarters -> Semis -> Finals, and isolated Battle for 3rd Place bronze podium stage)
- [x] Phase 7.14 PSU Binturungan Cluster / Tribe System & Bracket Tree Scoping Fix (Strict single-tournament bracket ladder scoping resolving duplicate bronze matches, PostgreSQL migration adding `affiliation_type`, `college_id`, `cluster_id` to `teams`, seeding 6 authentic Binturungan tribes into `clusters`, Coach team registration toggle between College Squad vs Cluster/Tribe, and 3-way Standing View toggle on `/ranking` crowning College or Tribe champions on the Gold podium)
- [x] Phase 7.15 Match Center UI/UX Architecture Decomposition (`BracketMatchCard`, `KnockoutBracketTree`, `BronzeMatchCard`, `MatchCenterToolbar`, `MatchCenterHeader`, `MatchScheduleList`) with clutter reduction (eliminated per-card stage headers, trimmed venue clutter, balanced bronze podium intensity)
- [x] Phase 7.16 Dual-Phase Tournament Ecosystem (Phase 1 Elimination group stage pools + Phase 2 Playoff Knockout Brackets across all 9 sports, totaling 108 matches)
- [x] Phase 7.17 Full Team Roster Provisioning & Authentic Roster Simulation (144+ student athlete accounts provisioned across 9 colleges with starters, subs, captaincy, and authentic sport positions)
- [x] Phase 7.18 Live Court-side Box Score Roster Enrichment (Player cards displaying `#jersey`, athlete name, captain indicator, sport position, and `[STARTER]` / `[SUB]` badges)
- [x] Phase 8.1 Database Security Hardening, RLS InitPlan Optimization & Foreign Key Indexing (PostgreSQL migration `20261014_harden_security_and_indexes.sql`: revoked anonymous RPC executions, hardened search_path, added covering B-tree indexes for all 25 unindexed foreign keys dropping advisor findings to 0, optimized RLS policies with auth.uid() subqueries, persisted clock state columns)
- [x] Phase 8.2 Realtime Match Telemetry & Spectator Synchronization (Decoupled public spectator match listeners from auth gate, corrected match status query discrepancies in AdminDashboard, replaced full database refetches in TournamentExplorer with optimistic patching)
- [x] Phase 8.3 Tournament Management Monolith Decomposition (Refactored 2,953-line `TournamentManagement.tsx` into modular sub-components: `TournamentListTab.tsx`, `TeamApprovalsTab.tsx`, `TournamentMvpTab.tsx`, `CreateTournamentModal.tsx`, `DeleteTournamentModal.tsx`, `ConcludeTournamentModal.tsx`, and `BracketGenerationModal.tsx`)
- [x] Phase 8.4 UI/UX Polish: Reusable Skeleton Loaders & Rich Empty States (`SkeletonCard.tsx`, `EmptyState.tsx` integrated across AdminAuditLogs, TeamManagement, and TournamentManagement)
- [x] Phase 8.5 Automated Test Suite with Playwright Verification (Comprehensive navigation, spectator, and match center test coverage passing in 9.0s)
- [x] Phase 8.6 Multi-Format Bracketing, Seeding & Schedule Engine Overhaul (4 complete formats: Single Elimination, Double Elimination with Upper & Lower Brackets + Grand Finals, Round Robin Only crowning Champion by Most Wins, and Round Robin + Playoffs Phase 1 -> Phase 2; interactive VS seed dropdowns & swap in Step 2; non-destructive Reset & Reseed flow; and in-place editing of published match dates, times, venues, and teams)
- [x] Phase 8.7 Universal Mobile-First Elimination Layouts & Bracketing Alignment (Zero Team Name Truncation)
- [x] Phase 8.8 Reactive Expandable Icon Tabs & Desktop Centered Pill Architecture (`ExpandableIconTabs.tsx`)
- [x] Phase 8.9 Unified Glassmorphic Toolbars & Anti-Corner Tucking Architecture (`DataToolbar.tsx`, `TournamentExplorer.tsx`, `AdminAuditLogs.tsx`)
- [x] Phase 8.10 Responsive Dual-Segmented Switch, 1-Click Roster Recruitment & Light Mode Harmony (`TeamManagement.tsx`, `ScoutingHub.tsx`)
- [x] Phase 8.11 Automated Visual Regression & Multi-Viewport Verification Suite (`tests/visual-inspection.spec.ts`)
- [x] Phase 8.12 Comprehensive PostgreSQL Security, Automated Bracket Progression & Role Escapes Lockdown (`20261024_comprehensive_security_and_engine.sql`)
- [x] Phase 8.13 Courtside Offline Resilience, Undo Score Deductions, Bundle Code Splitting & Global UI Error Boundaries (`ErrorBoundary.tsx`, `offlineQueue.ts`, `FacilitatorKiosk.tsx`)
- [x] Phase 8.14 Strict Ballgames Tournament Scoping & Non-Ballgame Code Purge (`CreateTournamentModal.tsx`, `sportIcons.ts`, `TournamentExplorer.tsx`, `TournamentManagement.tsx`)
- [x] Phase 8.15 Mobile-First Lightweight UI Enhancements, Hardware-Accelerated Shimmer Skeletons & Navigation Flair (`SkeletonCard.tsx`, `index.css`, `TournamentExplorer.tsx`, `Ranking.tsx`, `ScoutingHub.tsx`)

## 🛠️ Recent Modifications & Change Log

### Multi-Format Bracketing, Seeding & Schedule Engine Overhaul (Phase 8.6)
- **Description**: Upgraded the tournament bracketing, seeding, and scheduling architecture across `BracketGenerationModal.tsx`, `KnockoutBracketTree.tsx`, `TournamentExplorer.tsx`, and `Ranking.tsx`:
  1. **Four Complete Tournament Formats (Step 1)**:
     - **Single Elimination (`single`)**: Direct knockout bracket tree (`Quarterfinals` -> `Semifinals` -> `3rd Place Playoff` & `Finals`) with balanced power-of-2 `BYE` distribution.
     - **Double Elimination (`double`)**: Full **Upper Bracket (Winners)**, **Lower Bracket (Losers Redemption Tree)**, and **Grand Finals**, linking winners via `next_match_id` and losers via `loser_next_match_id`, and crowning Lower Finals loser as Bronze (3rd Place).
     - **Round Robin Only (`round_robin_only`)**: Generates all-vs-all Round Robin league fixtures without proceeding to a bracket tree; automatically ranks teams by **Most Wins** (tiebreakers: Point Differential, Points For) to crown the #1 team as Official Champion across the Podium, Match Center, and University Leaderboard (`/ranking`).
     - **Round Robin + Playoffs (`round_robin_playoffs`)**: Runs Phase 1 Elimination pools and unlocks a **Generate Phase 2 Playoffs** action that seeds Top 4 teams (`#1 vs #4`, `#2 vs #3`) into the Phase 2 Knockout Tree while preserving Phase 1 match history.
  2. **Interactive `VS` Seed Editing & Fixed "Reset & Reseed" Flow (Step 2)**:
     - Replaced static read-only `VS` labels in Step 2 with interactive `<Select>` team dropdowns and a 1-click **Swap (`⇄ VS`)** button, automatically swapping duplicate seeds and recalculating `BYE` auto-advancements in real time.
     - Added **Shuffle Seeds** in Step 2 to re-randomize team pairings while preserving custom edited venues and dates/times.
     - Fixed **Reset & Reseed** to enter Step 1 format selection (`isReseedingMode`) and safely clear self-referencing foreign keys before re-publishing.
  3. **In-Place Match Schedule, Venue & Team Editing After Publishing**:
     - Added scheduled **Date & Time** display and an inline **Edit** mode on published match cards in `BracketGenerationModal.tsx`, allowing admins to update `venue`, `match_time`, and (for `Scheduled` matches) `team_a_id` / `team_b_id` directly in Supabase without resetting the bracket.
- **Files Modified**:
  - `src/components/tournament-management/types.ts`
  - `src/components/tournament-management/BracketGenerationModal.tsx`
  - `src/components/match-center/KnockoutBracketTree.tsx`
  - `src/pages/TournamentExplorer.tsx`
  - `src/pages/Ranking.tsx`
  - `PROJECT_STATE.md`
  - `local_change_log.md`
  - `CONTEXT.md`

### Full System Audit, Security Hardening & Architecture Decomposition (Phase 8)
- **Description**: Conducted an exhaustive audit of database performance, application telemetry, frontend code health, and component modularity, followed by targeted improvements:
  1. **Database Security & Indexing (PostgreSQL Migration)**:
     - Applied `20261014_harden_security_and_indexes.sql` to production Supabase project `kxnkdhznnpwvnljjmfwl`.
     - Revoked `EXECUTE` privileges from `anon` and `PUBLIC` on sensitive RPC functions (`sync_offline_match_events`, `has_role`, `get_user_role`, `handle_profiles_update`, `handle_user_email_sync`).
     - Added covering B-tree indexes for all 25 unindexed foreign keys identified by Supabase Advisor (Advisor unindexed foreign keys dropped from 25 to 0).
     - Hardened functions with `SET search_path = 'public'`.
     - Optimized RLS subqueries with `(SELECT auth.uid())` initPlans to avoid per-row function evaluation.
     - Added `game_time_seconds`, `current_period`, `is_clock_running` persistence to `matches`.
  2. **Critical Telemetry & Realtime Sync Fixes**:
     - Fixed `AdminDashboard.tsx` live match counter query to check `.in('status', ['Ongoing', 'Live'])` matching database statuses.
     - Decoupled `PlayerDashboard.tsx` realtime broadcast listeners from `if (!user) return;` so public spectators receive live scoring events without being logged in.
     - Optimized `TournamentExplorer.tsx` live payload handlers to apply in-memory optimistic updates instead of firing 3 redundant database round-trips per score event.
  3. **Monolith Decomposition**:
     - Decomposed 2,953-line `TournamentManagement.tsx` into clean, testable sub-components in `src/components/tournament-management/` (`TournamentListTab.tsx`, `TeamApprovalsTab.tsx`, `TournamentMvpTab.tsx`, `CreateTournamentModal.tsx`, `DeleteTournamentModal.tsx`, `ConcludeTournamentModal.tsx`, `BracketGenerationModal.tsx`).
     - Pruned obsolete dead code `Login.tsx`.
     - Fixed AudioContext memory leaks in `LiveMatch.tsx` by using singleton synthesizer.
  4. **Automated Testing & UI/UX State Polish**:
     - Built `EmptyState.tsx` and `SkeletonCard.tsx` for zero-content and loading states.
     - Implemented Playwright test suite (`tests/navigation.spec.ts`, `tests/match-center.spec.ts`) running green in 9.0s.
     - Verified zero TypeScript errors (`tsc -b`), zero build errors (`vite build`), and zero ESLint errors (`eslint . --quiet`).

### Match Center UI/UX Redesign, Dual-Phase Bracketing & Full Roster Simulation
- **Description**: Rebuilt the Match Center from the ground up to reduce clutter, established modular bracket architecture, and upgraded dev seeding to simulate fully booked events across all 9 sports:
  1. **Match Center UI/UX Modernization & Modular Decomposition**:
     - Decomposed monolithic `TournamentExplorer.tsx` into focused modules: `MatchCenterHeader.tsx`, `MatchCenterToolbar.tsx`, `KnockoutBracketTree.tsx`, `BracketMatchCard.tsx`, `BronzeMatchCard.tsx`, `MatchScheduleList.tsx`, and `types.ts`.
     - De-cluttered bracket cards by removing redundant "Quarter Finals" tags from every card and moving venue info to detail views.
     - Toned down the 3rd-Place Bronze podium styling to sit harmoniously below the Championship Finals without overpowering it.
  2. **Phase 1 Elimination & Phase 2 Playoff Brackets Across All 9 Sports**:
     - Configured all 9 sports in `ALL_SPORTS_CONFIG` with 4 Phase 1 Elimination fixtures (Pool A & Pool B) and 8 Phase 2 Playoff Knockout fixtures (QF1-QF4 -> SF1-SF2 -> Finals & Bronze Playoff). Total of 108 fixtures in DB.
     - Diverse lifecycle states: Completed championships (Basketball, Baseball), live ongoing playoff semifinals and elimination deciders with commentary feeds (Soccer, Volleyball, Futsal, Pickleball), and scheduled finals.
  3. **Full Team Roster Simulation (Starters & Substitutes)**:
     - Authored `scripts/seed_athletes.js` provisioning 144 authentic student athletes across all 9 colleges in Supabase Auth and `public.users`.
     - Updated `devScenarios.ts` to assign full starting lineups (`is_starter: true`, `Active`) and full bench substitutes (`is_starter: false`, `Bench`) for every team across all 9 sports.
     - Assigned 1 captain per team (`is_captain: true`), unique jersey numbers (`#1`-`#99`), and sport-specific positions.
  4. **LiveMatch Box Score Roster Enrichment**:
     - Enhanced `LiveMatch.tsx` Box Score deck to display jersey number, athlete name, captain badge, sport position, `[STARTER]` / `[SUB]` badges, and real-time points.
- **Files Modified / Created**:
  - `src/components/match-center/MatchCenterHeader.tsx`
  - `src/components/match-center/MatchCenterToolbar.tsx`
  - `src/components/match-center/KnockoutBracketTree.tsx`
  - `src/components/match-center/BracketMatchCard.tsx`
  - `src/components/match-center/BronzeMatchCard.tsx`
  - `src/components/match-center/BracketConnectors.tsx`
  - `src/components/match-center/MatchScheduleList.tsx`
  - `src/components/match-center/types.ts`
  - `src/pages/TournamentExplorer.tsx`
  - `src/pages/LiveMatch.tsx`
  - `src/lib/devScenarios.ts`
  - `scripts/seed_athletes.js`
  - `PROJECT_STATE.md`
  - `local_change_log.md`

### Developer Sandbox RLS Bypass & Grand Binturungan Olympiad Super Demo
- **Description**: Resolved RLS permission barriers for the developer role, fixed schema check constraints across scenarios B, C, and D, and built the comprehensive multi-sport collegiate festival simulator (Scenario E):
  1. **PostgreSQL RLS Fix (`has_role`)**: Updated `has_role(role_name text)` function in PostgreSQL migration `supabase/migrations/20261012_grant_dev_rls_bypass.sql` to treat `'dev'` role as having administrative write bypass on all tables, fixing `403 Forbidden` errors during scenario injections.
  2. **Schema Constraint Fixes**:
     - *Scenario B*: Corrected `verification_documents` columns (`storage_path`, `extracted_student_no`, `document_type: 'COR'`) and capitalized `status: 'Pending'` to satisfy database check constraints.
     - *Scenario D*: Corrected `player_stars` foreign key to `player_id` (was `user_id`) and capitalized `star_type` to `'Gold'` and `'Red'`.
     - *Clean Error Serialization*: Created `formatErrorMessage(err)` in `devScenarios.ts` to unwrap PostgREST error objects and eliminate `[object Object]` toast notifications.
  3. **Super Demo Scenario E ("The Grand Binturungan Olympiad")**:
     - Provisions all 9 PSU athletic disciplines: Basketball, Volleyball, Soccer, Futsal, Sepak Takraw, Baseball, Softball, Pickleball, and Table Tennis.
     - Enrolls all 9 Palawan State University colleges: CAH, CBA, CCRD, CCJE, CEAT, CHMT, CNHS, CS, and CTE.
     - Populates regulation rosters with jersey numbers (`#1` to `#99`), sport-specific positions (e.g. Point Guard, Outside Hitter, Striker, Tekong, Pitcher, Paddler), starters (`is_starter: true`), bench substitutes (`is_starter: false`), team captains (`is_captain: true`), and assigned coaches.
     - Generates full tournament bracket tree: Quarterfinals, Semifinals, 3rd-Place Bronze Playoff, and Championship Finals crowning CEAT Red Scorpions (Gold), CS Byte Titans (Silver), and CBA Golden Wolves (Bronze).
     - Deploys live in-progress Volleyball match (CEAT vs CS Set 3, 24-22 match point) and MVP Red & Gold Stars that instantly compute into `/ranking` and `/explorer`.
  4. **Documentation & Anti-Slop Audit**:
     - Purged hallucinated "achievement badges" and "fan star votes" from `user_roles_and_access_control.md` and moved developer tooling documentation to Section 6.
     - Removed duplicate `design.md` file, retaining `design_context.md` as canonical specification.
- **Files Modified / Created**:
  - `supabase/migrations/20261012_grant_dev_rls_bypass.sql`
  - `src/lib/devScenarios.ts`
  - `src/pages/DevSandbox.tsx`
  - `user_roles_and_access_control.md`
  - `PROJECT_STATE.md`
  - `local_change_log.md`

### Mobile-First Design System, Responsive Ergonomics & Unified Toolbar Architecture (Phase 8.7 - 8.11)
- **Description**: Comprehensive system-wide ergonomic overhaul eliminating vertical scroll frenzy, team truncation, corner-tucking, and non-responsive desktop/mobile table layouts:
  1. **Phase 1 Match Center Mobile Top-Down VS Layout (`MatchScheduleList.tsx`)**: Replaced horizontal `[Team A] [Score] [Team B]` row on mobile with stacked 2-slot cards mirroring tournament brackets. Displays full college affiliation badge, full uppercase team name without truncation dots, winner crown indicator (`👑`), and right-aligned tabular score. Desktop maintains wide horizontal layout.
  2. **Reactive Expandable Icon Tabs (`ExpandableIconTabs.tsx`)**: Upgraded standings and sub-view switchers across `Ranking.tsx`, `TournamentExplorer.tsx`, `Profile.tsx`, `ScoutingHub.tsx`, and `TournamentManagement.tsx`. Inactive tabs render as sleek icon buttons with counts, active tab expands smoothly with label. Auto-centers as a unified pill on desktop (`sm:mx-auto sm:self-center sm:w-fit`) and distributes full-width on mobile.
  3. **Unified Elimination Toolbar & Anti-Corner Tucking (`TournamentExplorer.tsx`)**: Eliminated fragmented, corner-stranded controls. Combined sub-tabs and stage filter dropdown into a single glassmorphic toolbar card with left/right desktop balance, mobile-first stacking, 1-tap `X` reset, and reactive auto-reset on sport/tournament switch.
  4. **Universal DataToolbar Integration (`DataToolbar.tsx`, `AdminAuditLogs.tsx`)**: Deployed system-standard glassmorphic toolbar to Audit Logs with responsive search, time filters, live monitoring badge, and 1-tap `X` clear affordances.
  5. **1-Click Coach Recruitment & Sport Card Identification (`TeamManagement.tsx`, `ScoutingHub.tsx`)**: Added 1-click roster recruitment from scouting dossier, distinct sport discipline icons and badges on team cards, and balanced dual-segmented controls.
  6. **Automated Visual Regression Test Suite (`tests/visual-inspection.spec.ts`)**: Comprehensive Playwright test suite validating desktop (1440x900) and mobile (390x844) layouts, filter auto-resets, and tab reactivity (9 of 9 tests passing).
- **Files Modified / Created**:
  - `src/components/match-center/MatchScheduleList.tsx`
  - `src/components/match-center/MatchCenterToolbar.tsx`
  - `src/components/admin/DataToolbar.tsx`
  - `src/components/ui/expandable-icon-tabs.tsx`
  - `src/pages/TournamentExplorer.tsx`
  - `src/pages/AdminAuditLogs.tsx`
  - `src/pages/Ranking.tsx`
  - `src/pages/TeamManagement.tsx`
  - `src/pages/ScoutingHub.tsx`
  - `src/pages/Profile.tsx`
  - `tests/visual-inspection.spec.ts`
  - `PROJECT_STATE.md`
  - `local_change_log.md`

## 🎯 Deployment & Capstone Readiness
- [x] Phase 8: Mobile-First Ergonomics, Anti-Truncation, Reactive Tabs & Unified Toolbars
- [x] Automated E2E Visual & Functional Suite: 100% pass rate (9 tests passing across desktop & mobile)
- [x] Phase 4: MVP Star System (Red & Gold Stars)
- [x] Phase 4.1: Binturungan Multi-Sport Creation & Tournament Lifecycle
- [x] Phase 5: Facilitator Governance, Offline Resilience & Bronze Brackets
- [x] Phase 5.9 - 5.15: Role Normalization, COR Pipeline, Theme Engine & Icon Standardization
- [x] Phase 6: Live Scoring Engine, Stadium Jumbotron Focus View, Facilitator Kiosk, Web Audio FX & Navigation Polish
- [x] Phase 7: Developer Portal, Capstone Command Center, Multi-Stage Scenarios & Thesis Defense Script
- [x] Phase 7.10 - 7.12: RLS Bypass, Scenario Bug Fixes & Grand Binturungan Olympiad Super Demo
- [x] Production Build Validation: Zero TypeScript compiler errors (`tsc -b`), zero build failures (`vite build`)
- [x] Code Quality Audit: Zero ESLint errors across entire `src/` codebase
- [x] Database Synchronization: All migrations executed and active on remote Supabase project
- [x] Deployment Configuration: `vercel.json` SPA routing rewrites and security redirects configured

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
  1. **Canonical `dev` Role & Database Table Provisioning**: Updated Supabase PostgreSQL `users_role_check` constraint to support `'dev'`. Created database migration `20261012_add_dev_role.sql`. Provisioned standalone developer account (`dev@sportstrack.com`). To grant developer access, the role is manually assigned/edited directly in the Supabase database table (`public.users.role = 'dev'`).
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
  8. **Strict Admin & Dev Isolation**: Completely segregated Super Admin from Developer tools. Super Administrators have zero access to `/dev`, no dev buttons on `AdminDashboard.tsx`, and no dev links in navigation. Platform Developers operate within `/dev` with their own independent login credentials.
  9. **UI Polish & Contrast Elevation**: Softened the Developer Workbench layout by removing the pitch-black hard-angle box wrapper, introducing a curved hero banner (`rounded-[2.5rem]`) with ambient radial glow, and engineering high-contrast pill navigation triggers (`TabsList` / `TabsTrigger`) with bold uppercase collegiate typography and WCAG AAA legibility.
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


