# PSU SportsTrack - Project State

## 🏛️ Architecture
- **Frontend**: React 18, Vite (SWC), TypeScript, Tailwind CSS, shadcn/ui.
- **Backend/DB**: Supabase (PostgreSQL, Auth, Storage).
- **Testing**: Playwright.

## 📍 Current State
- **Active Phase**: Phase 5: Final Polish & Capstone Readiness.
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

## 🛠️ Recent Modifications & Change Log

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

## 🎯 Future Goals
- [x] Phase 4: MVP Star System (Red & Gold Stars).
- [x] Phase 4.1: Binturungan One-Click Multi-Sport Creation & Draft Lifecycle.
- Phase 5: Final Polish & Capstone Readiness.

