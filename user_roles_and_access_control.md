# PSU SportsTrack - User Roles & Access Control Specification

## Overview

This document specifies the unified role-based access control (RBAC) architecture of PSU SportsTrack. It outlines all recognized user types, permission boundaries, accessible routes, database-level Row Level Security (RLS) policies, and functional capabilities across both frontend and backend systems.

All roles are unified and enforced using standard PostgreSQL `snake_case` identifiers with zero duplicate or legacy role aliases.

---

## 1. Unified Role Hierarchy & Identity Keys

The platform recognizes seven user types:

| User Type | Database Role Key (`users.role`) | Frontend Permission Flag | Default Landing Route | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Public / Spectator** | *None (Unauthenticated)* | N/A | `/` | Anonymous visitors, fans, and university students exploring schedules and scores. |
| **Student Athlete** | `player_student` | `isStudentAthlete = true` | `/player` | Enrolled PSU student competing in official university sports tournaments. |
| **Faculty Athlete** | `player_faculty` | `isFacultyAthlete = true` | `/player` | University professors and personnel competing in faculty sports divisions. |
| **Coach** | `coach` | `isCoach = true` | `/coach` | Team mentor managing rosters, recruitments, uniform numbers, and lineups. |
| **Facilitator** | `facilitator` | `isFacilitator = true` | `/explorer` | Court-side match official operating game timers, scorecards, fouls, and box scores. |
| **Super Administrator** | `super_admin` | `isSuperAdmin = true` | `/admin` | University athletic directorate with complete administrative oversight and audit rights. |
| **Platform Developer** | `dev` | `isDev = true` (Root Access) | `/dev` | System engineers and thesis evaluators with root sandbox controls, scenario injectors, and live test tools. |

---

## 2. Functional Capabilities by Role

### 2.1 Public / Spectator (Guest)
Unauthenticated users with read-only access to published athletic data.

*   **Accessible Routes**: `/`, `/explorer`, `/ranking`, `/about`, `/match/:matchId`, `/login`, `/register`, `/reset-password`.
*   **Accessible Features**:
    *   **Live Dashboard & Ticker (`/`)**: View live match updates, upcoming schedules, trending games, and college standing summaries.
    *   **Match Center (`/explorer`)**: Search and filter tournaments by sport, college, and status; view tournament brackets, schedules, and past box scores.
    *   **Live Match Viewer (`/match/:matchId`)**: Watch real-time scoreboards, period clocks, court-side event logs, team fouls, and star leaderboards.
    *   **Leaderboard (`/ranking`)**: View official Palawan State University college medal tallies (Gold, Silver, Bronze), overall points, and historical standings.
    *   **About Hub (`/about`)**: Read athletic guidelines, platform documentation, and university directorate information.
    *   **Account Portals**: Access registration and login modals to create student, faculty, or coach accounts.
*   **Restrictions**:
    *   Cannot interact with scoring or timer controls.
    *   Cannot submit team applications or upload verification files.
    *   Cannot vote for MVPs or star players without authentication.

---

### 2.2 Student Athlete (`player_student`)
Enrolled students representing their academic college in competitive tournaments.

*   **Accessible Routes**: All Public views + `/player`, `/profile`.
*   **Accessible Features**:
    *   **Athlete Console (`/player`)**: View college affiliation, degree program, student number, year level, and current verification status (`Unverified`, `Pending`, `Approved`, `Rejected`).
    *   **COR Document Verification**: Upload Certificate of Registration (COR) PDF files with instant client-side OCR evaluation and confidence score previews.
    *   **Team Invitations**: Receive, review, accept, or decline team join invitations dispatched by team coaches.
    *   **Active Squads & Schedules**: Review confirmed team memberships, assigned uniform jersey numbers, captain designations, and upcoming match schedules.
    *   **Player Statistics & Honors**: Track personal points, matches played, MVP awards, and unlocked achievement badges in `/profile`.
    *   **Fan Engagement**: Cast star votes for active athletes during live match broadcasts in `/match/:matchId`.
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

*   **Accessible Routes**: All Public views + `/match/:matchId` (with scorekeeper authorization).
*   **Accessible Features**:
    *   **Scorekeeper Lease Protocol**: Claim the exclusive scorekeeping lock for an assigned match (includes automatic 90-second timeout disconnect protection and explicit lease-transfer handshakes).
    *   **Point Attribution**: Award points (`+1 FT`, `+2 Field`, `+3 Triple`) with attribution to roster athletes by jersey number or custom walk-on entries.
    *   **Score Correction & Rollback**: Reverse scoring misinputs via a destructive confirmation modal with automatic player stat rollback and score-floor protection (`score >= 0`).
    *   **Clock Management**: Start, pause, resume, and modify period countdown timers; transition periods (Quarters, Halves, Sets).
    *   **Fouls & Timeouts**: Record personal fouls, technical fouls, team fouls, and official timeouts.
    *   **Match Finalization**: Conclude games, record final scores, designate winning teams, nominate Game MVP, and generate official box scores.
*   **Restrictions**:
    *   Cannot access university-level administration consoles (`/admin/*`).
    *   Cannot create or modify tournament structures and brackets.
    *   Cannot approve or reject verification documents.

---

### 2.6 Super Administrator (`super_admin`)
Athletic directors, tournament commissioners, and university system administrators.

*   **Accessible Routes**: Unrestricted system-wide access across all routes, including `/admin`, `/admin/tournaments`, `/admin/verifications`, `/admin/audit-logs`, `/admin/recovery`.
*   **Accessible Features**:
    *   **Executive Metrics (`/admin`)**: Real-time counters for athletes, coaches, active tournaments, live matches, and pending verifications.
    *   **Tournament Engineering (`/admin/tournaments`)**:
        *   Create tournaments with custom sports rules, divisions, and elimination brackets (Single Elimination, Double Elimination, Round Robin).
        *   Generate seeds, assign brackets, and publish game schedules.
        *   Assign venues, dates, and designated court-side facilitators.
        *   Finalize tournament standings and award Gold, Silver, and Bronze medals to college tallies.
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

### 2.7 Platform Developer (`dev`)
System architects, thesis developers, and capstone evaluators with unrestricted root access across the entire platform. Designed specifically for live defense demonstrations, empirical testing, stress-testing, and rapid state transitions.

*   **Accessible Routes**: All platform views without restriction (`/`, `/explorer`, `/ranking`, `/about`, `/match/*`, `/player`, `/profile`, `/coach/*`, `/admin/*`, `/dev`).
*   **Accessible Features**:
    *   **Capstone Command Center & Workbench (`/dev`)**: Dedicated developer console containing testing instrumentation, scenario injectors, and live match simulators.
    *   **Multi-Stage Scenario Injectors**:
        *   *Clean Slate*: Wipes test matches, brackets, events, and rosters without touching core colleges or system user accounts.
        *   *COR Verification Queue*: Seeds a draft tournament and generates mock student athletes with realistic OCR verification documents and confidence scores (95%, 80%, 45%) for instant live demo of the AIMS verification workflow.
        *   *Live Halftime Showdown*: Injects a high-stakes, 4th quarter basketball match (CAS 68 vs CBA 65) with live clock, fouls, timeouts, player star tallies, and commentary feed ready for immediate kiosk or display testing.
        *   *Completed Championship*: Populates championship finals, 3rd place bronze deciders, MVP Red/Gold stars, and updates the official Palawan State University medal tally (`/ranking`).
    *   **User & Stats Manager**: Search and inspect all registered accounts, switch roles instantly (`dev`, `super_admin`, `facilitator`, `coach`, `player_student`, `player_faculty`), toggle `is_verified` status with one click, and reset rate-limiting lockouts.
    *   **Live Match Event Bot**: Select any active match and pulse real-time scoring events (+2, +3, fouls, turnovers) every 6 seconds over WebSockets to demonstrate real-time telemetry across spectator screens, stadium displays, and mobile views.
    *   **Database & System Health**: Monitor live row counts across 6 core tables (`tournaments`, `teams`, `matches`, `match_events`, `users`, `verification_documents`), purge orphaned records, and force-release expired scorekeeper leases.
    *   **Capstone Defense Presentation Script**: 6-step guided walkthrough with direct deep-links for defense panelists.
    *   **Dedicated Account & Database Provisioning**: Developer accounts are strictly separated from Super Admin credentials with their own distinct email and password. To assign or provision a `dev` account, the `role` column must be manually edited in the Supabase database table (`public.users.role = 'dev'`). The public registration portal cannot register developer accounts.
    *   **Strict Access Boundary**: Platform Developers operate within the `/dev` command center and cannot access super administrator management suites (`/admin/*`). Likewise, Super Administrators cannot access developer sandbox controls (`/dev`).

---

## 3. Comprehensive Route Permission Matrix

| Route Path | View / Component | Public | Student Athlete | Faculty Athlete | Coach | Facilitator | Super Admin | Platform Dev |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/` | Live Dashboard & Ticker | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/explorer` | Tournament Explorer & Brackets | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/ranking` | University Medal Standings | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/about` | Platform Rules & Information | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId` | Live Matchroom (Viewer Mode) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId` | Live Matchroom (Scorekeeper Desk) | No | No | No | No | **Yes** | **Yes** | No |
| `/match/:matchId/display` | Stadium Focus Jumbotron | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| `/match/:matchId/kiosk` | Courtside Facilitator Kiosk | No | No | No | No | **Yes** | **Yes** | No |
| `/player` | Athlete Console & COR Upload | No | **Yes** | **Yes** | No | No | No | No |
| `/profile` | Profile, Invites & Achievements | No | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| `/coach` | Coach Dashboard & Squad Stats | No | No | No | **Yes** | No | No | No |
| `/coach/teams` | Roster & Lineup Management | No | No | No | **Yes** | No | No | No |
| `/admin` | Executive Analytics & Appoint Modal | No | No | No | No | No | **Yes** | No |
| `/admin/tournaments` | Bracket Engineering & Seeding | No | No | No | No | No | **Yes** | No |
| `/admin/verifications` | COR PDF Review & AIMS Validation | No | No | No | No | No | **Yes** | No |
| `/admin/audit-logs` | Security Event Audit Trail | No | No | No | No | No | **Yes** | No |
| `/admin/recovery` | Soft-Deleted Entity Restoration | No | No | No | No | No | **Yes** | No |
| `/dev` | Developer Sandbox & Thesis Command | No | No | No | No | No | No | **Yes** |

---

## 4. Database Row Level Security (RLS) Reference

Database constraint enforced on `users.role`:
```sql
CHECK (role = ANY (ARRAY['super_admin', 'facilitator', 'coach', 'player_student', 'player_faculty', 'dev']))
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
