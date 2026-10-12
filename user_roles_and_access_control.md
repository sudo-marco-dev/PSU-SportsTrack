# PSU SportsTrack - User Roles & Access Control Specification

## Overview

This document specifies the unified role-based access control (RBAC) architecture of PSU SportsTrack. It outlines all recognized production user types, permission boundaries, accessible routes, database-level Row Level Security (RLS) policies, and functional capabilities across both frontend and backend systems.

All production roles are unified and enforced using standard PostgreSQL `snake_case` identifiers with zero duplicate or legacy role aliases.

---

## 1. Unified Production Role Hierarchy & Identity Keys

The production platform recognizes six primary user types:

| User Type | Database Role Key (`users.role`) | Frontend Permission Flag | Default Landing Route | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Public / Spectator** | *None (Unauthenticated)* | N/A | `/` | Anonymous visitors, fans, and university students exploring schedules, brackets, and scores. |
| **Student Athlete** | `player_student` | `isStudentAthlete = true` | `/player` | Enrolled PSU student competing in official university sports tournaments. |
| **Faculty Athlete** | `player_faculty` | `isFacultyAthlete = true` | `/player` | University professors and personnel competing in dedicated faculty sports divisions. |
| **Coach** | `coach` | `isCoach = true` | `/coach` | Team mentor managing rosters, recruitments, uniform numbers, and starting lineups. |
| **Court-Side Facilitator** | `facilitator` | `isFacilitator = true` | `/explorer` | Appointed table official operating game timers, scorecards, fouls, and box scores. |
| **Super Administrator** | `super_admin` | `isSuperAdmin = true` | `/admin` | University athletic directorate with complete administrative oversight and audit rights. |

> **Note**: For temporary capstone testing, scenario seeding, and thesis defense evaluation, a standalone developer sandbox role (`dev`) is documented separately in [Section 6: Developer Workbench & Pre-Production Debugging Suite](#6-developer-workbench--pre-production-debugging-suite-non-production-only) at the bottom of this document.

---

## 2. Functional Capabilities by Production Role

### 2.1 Public / Spectator (Guest)
Unauthenticated users with read-only access to published athletic data.

*   **Accessible Routes**: `/`, `/explorer`, `/ranking`, `/about`, `/match/:matchId`, `/match/:matchId/display`, `/login`, `/register`, `/reset-password`.
*   **Accessible Features**:
    *   **Live Dashboard & Ticker (`/`)**: View live match updates, upcoming schedules, trending games, and college standing summaries.
    *   **Match Center (`/explorer`)**: Search and filter tournaments by sport, college, and status; view tournament brackets, schedules, and past box scores.
    *   **Live Match Viewer (`/match/:matchId`)**: Watch real-time scoreboards, period clocks, court-side event logs, team fouls, and star leaderboards.
    *   **Stadium Focus Jumbotron (`/match/:matchId/display`)**: View big-screen scoreboard broadcast with synchronized clock, timeouts, fouls, and keyframe animations.
    *   **Leaderboard (`/ranking`)**: View official Palawan State University college medal tallies (Gold, Silver, Bronze), overall points, and historical standings.
    *   **About Hub (`/about`)**: Read athletic guidelines, platform documentation, and university directorate information.
    *   **Account Portals**: Access registration and login modals to create student, faculty, or coach accounts.
*   **Restrictions**:
    *   Cannot interact with scoring or timer controls.
    *   Cannot submit team applications or upload verification files.
    *   Read-only access across all live matchrooms.

---

### 2.2 Student Athlete (`player_student`)
Enrolled students representing their academic college in competitive tournaments.

*   **Accessible Routes**: All Public views + `/player`, `/profile`.
*   **Accessible Features**:
    *   **Athlete Console (`/player`)**: View college affiliation, degree program, student number, year level, and current verification status (`Unverified`, `Pending`, `Approved`, `Rejected`).
    *   **COR Document Verification**: Upload Certificate of Registration (COR) PDF files with instant client-side OCR evaluation and confidence score previews.
    *   **Team Invitations**: Receive, review, accept, or decline team recruitment invitations dispatched by college coaches.
    *   **Active Squads & Schedules**: Review confirmed team memberships, assigned uniform jersey numbers, captain designations, and upcoming match schedules.
    *   **Trophy Case & MVP Honors (`/profile`)**: Track personal points, matches played, and earned MVP distinction stars (Red Stars for Game MVP, Gold Stars for Tournament MVP).
*   **Restrictions**:
    *   Strictly prohibited from operating court-side scorekeeper desks or clocks.
    *   Cannot create teams or recruit other students.
    *   Cannot access administrative or coaching hubs (`/coach/*`, `/admin/*`).

---

### 2.3 Faculty Athlete (`player_faculty`)
University teaching and non-teaching personnel participating in dedicated faculty sports divisions.

*   **Accessible Routes**: All Public views + `/player`, `/profile`.
*   **Accessible Features**:
    *   All core features available to Student Athletes.
    *   **Faculty Credential Verification**: Uploads employee or faculty identification documentation in place of a student COR.
    *   **Faculty Tournament Brackets**: Enters tournaments and rosters designated specifically for faculty clusters and employee divisions.
*   **Restrictions**:
    *   Same security boundaries as Student Athletes.

---

### 2.4 Coach (`coach`)
Instructors and athletic coaches in charge of team creation and roster construction.

*   **Accessible Routes**: All Public views + `/coach`, `/coach/teams`, `/profile`.
*   **Accessible Features**:
    *   **Coach Console (`/coach`)**: Review aggregate win/loss records, upcoming tournament games for managed squads, and pending athlete rosters.
    *   **Team Creation (`/coach/teams`)**: Form new squads under designated college departments and tournament divisions.
    *   **Recruitment Desk**: Search verified athletes within the assigned college and dispatch recruitment invitations.
    *   **Roster Management**: Accept or reject athlete join requests; update athlete membership status (`Approved`, `Pending`, `Rejected`).
    *   **Lineup Governance**: Assign permanent jersey numbers, designate team captains (`is_captain`), and configure starting lineups (`is_starter`).
    *   **Roster Pruning**: Remove ineligible or dropped athletes from active team rosters.
*   **Restrictions**:
    *   **Court-Side Read-Only**: Strictly blocked from scorekeeping and clock manipulation in `/match/:matchId` to eliminate coaching bias.
    *   Cannot generate tournament brackets, approve COR documents, or view system audit logs.

---

### 2.5 Court-Side Facilitator (`facilitator`)
Appointed game referees, table officials, and scorekeepers.

*   **Accessible Routes**: All Public views + `/match/:matchId` (with scorekeeper authorization), `/match/:matchId/kiosk`.
*   **Accessible Features**:
    *   **Scorekeeper Lease Protocol**: Claim the exclusive scorekeeping lock for an assigned match (includes automatic 90-second timeout disconnect protection and explicit lease-transfer handshakes).
    *   **Point Attribution**: Award points (`+1 FT`, `+2 Field`, `+3 Triple`) with attribution to roster athletes by jersey number or custom walk-on entries.
    *   **Score Correction & Rollback**: Reverse scoring misinputs via a destructive confirmation modal with automatic player stat rollback and score-floor protection (`score >= 0`).
    *   **Clock Management**: Start, pause, resume, and modify period countdown timers; transition periods (Quarters, Halves, Sets).
    *   **Fouls & Timeouts**: Record personal fouls, technical fouls, team fouls, and official timeouts.
    *   **Tactile Facilitator Kiosk (`/match/:matchId/kiosk`)**: Access touch-optimized Steam Deck style console with zero-scroll viewport snapping, 2-tap substitutions, and physical score buttons.
    *   **Match Finalization & MVP Designation**: Conclude games, record final scores, designate winning teams, award Game MVP Red Star, and generate official box scores.
*   **Restrictions**:
    *   Cannot access university-level administration consoles (`/admin/*`).
    *   Cannot create or modify tournament structures and brackets.
    *   Cannot approve or reject verification documents.

---

### 2.6 Super Administrator (`super_admin`)
Athletic directors, tournament commissioners, and university system administrators.

*   **Accessible Routes**: Unrestricted system-wide access across all production routes, including `/admin`, `/admin/tournaments`, `/admin/verifications`, `/admin/audit-logs`, `/admin/recovery`.
*   **Accessible Features**:
    *   **Executive Metrics (`/admin`)**: Real-time counters for athletes, coaches, active tournaments, live matches, and pending verifications.
    *   **Tournament Engineering (`/admin/tournaments`)**:
        *   Create tournaments with custom sports rules, divisions, and elimination brackets (Single Elimination, Double Elimination, Round Robin).
        *   Generate seeds, assign brackets, and publish game schedules.
        *   Assign venues, dates, and designated court-side facilitators.
        *   Finalize tournament standings and award Gold, Silver, and Bronze medals to college tallies.
        *   Award Tournament MVP Gold Star accolades.
    *   **Verification Review Desk (`/admin/verifications`)**:
        *   Inspect uploaded COR and Faculty ID documents via an embedded PDF canvas viewer with zoom controls.
        *   Review automated OCR confidence scores and breakdown variables (student number, institutional email, name similarity %, PSU official seal, academic term).
        *   Cross-verify against the official PSU AIMS Student Portal (`https://oes.psu.palawan.edu.ph/aims/students/`).
        *   One-click Approve (marks athlete as `is_verified = true`) or Reject with feedback notes.
    *   **Facilitator Management**: Appoint registered users to the `facilitator` role or revoke their officiating status.
    *   **Audit Trail Logs (`/admin/audit-logs`)**: Complete historical audit log tracking administrative actions, timestamps, and JSON diffs.
    *   **Recovery Center (`/admin/recovery`)**: Restore soft-deleted tournaments, teams, matches, or users with blame attribution tracking.
    *   **Master Game Override**: Master authority to override scorekeeper leases and adjust scores in any live match.

---

## 3. Production Route Permission Matrix

| Route Path | View / Component | Public | Student Athlete | Faculty Athlete | Coach | Facilitator | Super Admin |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `/` | Live Dashboard & Ticker | Yes | Yes | Yes | Yes | Yes | Yes |
| `/explorer` | Tournament Explorer & Brackets | Yes | Yes | Yes | Yes | Yes | Yes |
| `/ranking` | University Medal Standings | Yes | Yes | Yes | Yes | Yes | Yes |
| `/about` | Platform Rules & Information | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId` | Live Matchroom (Viewer Mode) | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId` | Live Matchroom (Scorekeeper Desk) | No | No | No | No | **Yes** | **Yes** |
| `/match/:matchId/display` | Stadium Focus Jumbotron | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId/kiosk` | Courtside Facilitator Kiosk | No | No | No | No | **Yes** | **Yes** |
| `/player` | Athlete Console & COR Upload | No | **Yes** | **Yes** | No | No | Yes |
| `/profile` | Profile, Roster Invites & Trophy Case | No | **Yes** | **Yes** | **Yes** | **Yes** | Yes |
| `/coach` | Coach Dashboard & Squad Stats | No | No | No | **Yes** | No | Yes |
| `/coach/teams` | Roster & Lineup Management | No | No | No | **Yes** | No | Yes |
| `/admin` | Executive Analytics & Appoint Modal | No | No | No | No | No | **Yes** |
| `/admin/tournaments` | Bracket Engineering & Seeding | No | No | No | No | No | **Yes** |
| `/admin/verifications` | COR PDF Review & AIMS Validation | No | No | No | No | No | **Yes** |
| `/admin/audit-logs` | Security Event Audit Trail | No | No | No | No | No | **Yes** |
| `/admin/recovery` | Soft-Deleted Entity Restoration | No | No | No | No | No | **Yes** |

---

## 4. Database Row Level Security (RLS) Reference

Production database constraint enforced on `users.role`:
```sql
CHECK (role IN ('super_admin', 'facilitator', 'coach', 'player_student', 'player_faculty'))
```

| Database Table | Select (Read) | Insert (Create) | Update (Modify) | Delete (Remove) |
| :--- | :--- | :--- | :--- | :--- |
| `users` | Public (active profiles) | Authenticated (registration) | Self (own profile) or Super Admin | Super Admin only (soft delete) |
| `colleges` / `clusters` | Public | Super Admin | Super Admin | Super Admin |
| `tournaments` | Public (published) | Super Admin | Super Admin | Super Admin |
| `teams` | Public | Coach (own college) or Super Admin | Coach (own team) or Super Admin | Super Admin |
| `team_roster` | Public | Coach (own team) or Super Admin | Coach (own team) or Super Admin | Coach (own team) or Super Admin |
| `matches` | Public | Super Admin | Facilitator (holding lease) or Super Admin | Super Admin |
| `match_events` | Public | Facilitator (holding lease) or Super Admin | Super Admin | Super Admin |
| `match_score_events`| Public | Facilitator (holding lease) or Super Admin | Facilitator (rollback) or Super Admin | Super Admin |
| `player_stars` | Public | Facilitator / Super Admin | Super Admin | Super Admin |
| `verification_documents` | Self (own document) or Super Admin | Self (authenticated upload) | Super Admin (approve / reject) | Super Admin |
| `audit_logs` | Super Admin | Authenticated (audit logging routines) | Super Admin | Super Admin |
| `storage.objects` (`verification_documents`) | Self or Super Admin | Authenticated (own user ID path) | Super Admin | Super Admin |

---

## 5. Security & Verification Engine Guardrails

### 5.1 Court-Side Scorekeeper Lease Protocol
1. **Single-Lease Enforcement**: Only one official can hold the active lease on a match at any given moment (`active_scorekeeper_id`).
2. **Heartbeat & Disconnect Timeout**: Leases automatically expire after 90 seconds of inactivity or disconnection.
3. **Lease Takeover Safeguard**: Other facilitators must request a lease transfer, triggering a countdown prompt on the current scorekeeper's console before forcing an override.
4. **Coaching Isolation**: Users with the `coach` role are blocked by client checks and RLS policies from acquiring a scorekeeper lease.

### 5.2 Certificate of Registration (COR) Confidence Scoring
Documents uploaded by athletes are evaluated across a 100-point confidence model:
*   **Student Number Match (25 pts)**: Extracted document student number matches profile student number.
*   **Name Similarity (25 pts)**: Fuzzy string similarity between registered name and document name (100% = 25 pts, >80% = 18 pts, >60% = 10 pts).
*   **College Match (20 pts)**: Document college matches registered college abbreviation or full title.
*   **Institutional Email Match (15 pts)**: Email format `[student_number]@psu.palawan.edu.ph` cross-validated against document.
*   **Official PSU Seal Marker (5 pts)**: Document contains official institutional headers or university seal identifiers.
*   **Academic Term Validation (10 pts)**: Registration corresponds to the current academic calendar year.
*   **Confidence Tiers**:
    *   **High (>= 90 pts)**: Fast-track approval recommended.
    *   **Moderate (60 - 89 pts)**: Standard admin inspection.
    *   **Low (1 - 59 pts)**: Manual review against PSU AIMS required.
    *   **Non-Parsable (0 pts)**: Flagged for re-upload or unreadable document.

---

## 6. Developer Workbench & Pre-Production Debugging Suite (Non-Production Only)

> [!WARNING]
> **PRE-PRODUCTION / EVALUATION ENVIRONMENT ONLY**  
> The developer workbench (`/dev`) and `'dev'` database role documented below are **transient development and thesis evaluation instruments**. They are strictly intended for defense demonstrations, empirical testing, and rapid data seeding. **They will not exist in the final production release.**

### 6.1 Developer Persona (`dev`)
System engineers and capstone evaluators requiring root sandbox controls, rapid state transitions, and real-time stress testing during jury presentations.

*   **Accessible Routes**: `/dev`, plus public inspection views.
*   **Strict Role Isolation**:
    *   **Segregated from Super Admin**: Platform Developers operate strictly within the `/dev` command center and cannot access super administrator management suites (`/admin/*`). Likewise, Super Administrators cannot access developer sandbox controls (`/dev`).
    *   **Independent Account & Provisioning**: The `'dev'` persona uses distinct credentials (`dev@sportstrack.com`). Developer accounts cannot be created through the public registration portal; they must be explicitly assigned directly in the database table (`public.users.role = 'dev'`).
    *   **Database Check Constraint (Dev Migration)**: In local and preview environments, database migration `20261012_add_dev_role.sql` permits `'dev'` in `users_role_check`:
        ```sql
        CHECK (role = ANY (ARRAY['super_admin', 'facilitator', 'coach', 'player_student', 'player_faculty', 'dev']))
        ```

### 6.2 Capstone Command Deck Capabilities (`/dev`)

The Developer Workbench is organized into five specialized evaluation tabs:

1.  **Multi-Stage Scenario Injectors (`devScenarios.ts`)**:
    *   *Clean Slate*: Resets ephemeral test tournaments, brackets, match events, and rosters without touching university colleges or user credentials.
    *   *COR Verification Queue*: Seeds a draft tournament and generates mock student athletes with realistic OCR verification documents and confidence scores (95%, 80%, 45%) for live defense demonstration of the AIMS verification workflow.
    *   *Live Halftime Showdown*: Injects a high-octane 4th-quarter basketball match (CAS 68 vs CBA 65) with running clock, fouls, timeouts, player star tallies, and commentary feed ready for immediate kiosk and jumbotron demonstration.
    *   *Completed Championship*: Deploys championship finals, bronze deciders, MVP Red/Gold stars, and updates the official Palawan State University medal standing ledger (`/ranking`).
2.  **User & Stats Ledger**:
    *   Real-time user directory with 1-click role switcher dropdown (`dev`, `super_admin`, `facilitator`, `coach`, `player_student`, `player_faculty`).
    *   1-click verification status toggle (`is_verified`).
    *   Instant rate-limiting lockout reset for testing login failure barriers.
3.  **Live Match Event Bot**:
    *   Interactive play simulator and auto-play pulse triggering real-time scoring events (+2, +3, fouls, turnovers) every 6 seconds over WebSockets.
    *   Validates multi-device synchronization across spectator browsers, courtside kiosks, and big-screen displays.
4.  **Database & System Health Telemetry**:
    *   Live row counters across core tables (`tournaments`, `teams`, `matches`, `match_events`, `users`, `verification_documents`).
    *   One-click purge routines for orphaned test records and force-release of expired scorekeeper leases.
5.  **Capstone Defense Presentation Script**:
    *   Structured 6-step walkthrough with direct deep-links designed to guide thesis defense panelists through the complete tournament lifecycle.
