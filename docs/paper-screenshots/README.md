# PSU SportsTrack — Authentic Multi-Role & Scrolled System UI Catalog

This catalog provides **86 high-resolution screen captures** (43 Desktop `1440×900` + 43 Mobile `390×844` figures) across all **PSU SportsTrack** user roles and system modules.

All captures were generated using **real authenticated database accounts** (zero dev impersonation banners and no developer sandbox tabs in navigation), **Light Mode** styling for academic print legibility, **deterministic anti-skeleton verification**, and **multi-part viewport scrolling** (both Top Overviews and Scrolled-Down Main Content views, plus interactive modals and sub-tabs).

---

## 1. Seeded Database Test Accounts (Live Login Credentials)

To manually test or demonstrate different role views without using Developer Impersonation, sign in via the Authentication Portal (`/?login=true`) using any of the following seeded database accounts:

**Standard Test Password (All Accounts):** `PsuSportsTrack@2026!`

| # | User Role | Full Name | Institutional Email | Clearance Status | College / Unit | Primary Route |
|---|---|---|---|---|---|---|
| **1** | **Admin (Sports Director)** | Dr. Ramon Bautista | `sports.director@psu.palawan.edu.ph` | Verified (`true`) | University Sports Development Office | `/admin` |
| **2** | **Athletic Coach** | Coach Danilo Soriano | `danilo.soriano@psu.palawan.edu.ph` | Verified (`true`) | College of Business and Accountancy (CBA) | `/coach` & `/coach/teams` |
| **3** | **Courtside Facilitator** | Engr. Patrick Manalo | `patrick.manalo@psu.palawan.edu.ph` | Verified (`true`) | CEAT • Technical Officials Committee | `/explorer` & `/match/:id/kiosk` |
| **4** | **Verified Student Athlete** | Juan Dela Cruz | `jdelacruz2024@psu.palawan.edu.ph` | Verified (`true`) | CAS • BS Information Technology (3rd Yr) | `/player` & `/profile` |
| **5** | **Verified Faculty Athlete** | Prof. Elena Fernandez | `elena.fernandez@psu.palawan.edu.ph` | Verified (`true`) | CTE • Physical Education & Athletics | `/player` & `/profile` |
| **6** | **Verified Staff Athlete** | Roberto Mendoza | `roberto.mendoza@psu.palawan.edu.ph` | Verified (`true`) | ICTD • University Administration | `/player` & `/profile` |
| **7** | **Pending Student Athlete** | Mark Mendoza | `mmendoza2024@psu.palawan.edu.ph` | **Pending COR (96%)** | CS • BS Computer Science (1st Yr) | `/player` |
| **8** | **Pending Faculty Athlete** | Prof. Carlos Villanueva | `carlos.villanueva@psu.palawan.edu.ph` | **Pending Faculty ID** | CEAT • Mechanical Engineering | `/player` |
| **9** | **Pending Staff Athlete** | Liza Santos | `liza.santos@psu.palawan.edu.ph` | **Pending Staff ID** | University Registrar Office | `/player` |

> [!TIP]
> To re-seed or refresh these accounts and their associated teams, rosters, pending COR/ID documents, and career telemetry at any time, run:
> ```powershell
> node scripts/seed_paper_test_users.js
> ```

---

## 2. Multi-Part Figure Catalog (Desktop vs. Mobile)

### 01. Public Spectator Dashboard (`/`)
*Showcases the public landing hub: (a) Top overview with upcoming tournament pipeline, and (b) Scrolled main content highlighting Live & Upcoming Games and real-time scorecards.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **01a. Top Overview & Pipeline** | ![Desktop](desktop/01a-public-dashboard-top.png) | ![Mobile](mobile/01a-public-dashboard-top.png) |
| **01b. Scrolled Live & Upcoming Games** | ![Desktop](desktop/01b-public-dashboard-content.png) | ![Mobile](mobile/01b-public-dashboard-content.png) |

---

### 02. Match Center & Tournament Explorer (`/explorer`)
*Showcases the 9 official ballgame filter rail, symmetric `DataToolbar`, scrolled elimination match cards, and Phase 2 knockout playoff bracket tree.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **02a. Top Discipline Rail & Filters** | ![Desktop](desktop/02a-explorer-elimination-top.png) | ![Mobile](mobile/02a-explorer-elimination-top.png) |
| **02b. Scrolled Elimination Match Cards** | ![Desktop](desktop/02b-explorer-elimination-matches.png) | ![Mobile](mobile/02b-explorer-elimination-matches.png) |
| **02c. Phase 2 Knockout Playoff Bracket** | ![Desktop](desktop/02c-explorer-playoff-bracket.png) | ![Mobile](mobile/02c-explorer-playoff-bracket.png) |

---

### 03. Official Leaderboard & Rankings (`/ranking`)
*Scrolled directly to frame (a) the Top 3 Championship Podium Cards and (b) the full institutional standings table.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **03a. Championship Top 3 Podium** | ![Desktop](desktop/03a-rankings-podium.png) | ![Mobile](mobile/03a-rankings-podium.png) |
| **03b. Institutional Standings Table** | ![Desktop](desktop/03b-rankings-standings-table.png) | ![Mobile](mobile/03b-rankings-standings-table.png) |

---

### 04. Athletics & Varsity Scouting Hub (`/athletics`)
*Scrolled to the varsity athlete directory cards and the interactive Player Dossier & Statistical Telemetry Modal.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **04a. Scrolled Athlete Directory Grid** | ![Desktop](desktop/04a-athletics-players-grid.png) | ![Mobile](mobile/04a-athletics-players-grid.png) |
| **04b. Player Dossier & Telemetry Modal** | ![Desktop](desktop/04b-athletics-player-dossier-modal.png) | ![Mobile](mobile/04b-athletics-player-dossier-modal.png) |

---

### 05. Legal, Privacy & Terms of Service (`/legal`)
*Republic Act 10173 (Data Privacy Act of 2012) compliance portal, sequential scroll reader, and printable policy clauses.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **05a. Legal Header & Navigation** | ![Desktop](desktop/05a-legal-privacy-top.png) | ![Mobile](mobile/05a-legal-privacy-top.png) |
| **05b. Scrolled Policy Clauses** | ![Desktop](desktop/05b-legal-privacy-content.png) | ![Mobile](mobile/05b-legal-privacy-content.png) |

---

### 06 & 07. Authentication & Role-Adaptive Registration (`/?login=true` & `/register`)
*Multi-role sign-in modal with rate-limit protection, Student Athlete registration form, and Faculty/Staff role-adaptive fields (Employee ID & Department).*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **06. Sign-In Portal Modal** | ![Desktop](desktop/06-auth-login-modal.png) | ![Mobile](mobile/06-auth-login-modal.png) |
| **07a. Student Athlete Registration** | ![Desktop](desktop/07a-register-student-form.png) | ![Mobile](mobile/07a-register-student-form.png) |
| **07b. Staff/Faculty Role-Adaptive Form** | ![Desktop](desktop/07b-register-faculty-staff-form.png) | ![Mobile](mobile/07b-register-faculty-staff-form.png) |

---

### 08, 09 & 10. Live Matchroom, Facilitator Kiosk & Stadium Jumbotron (`/match/:id`)
*Real-time match center scoreboard, scrolled box score & play-by-play feed, authenticated Facilitator Kiosk (`Engr. Patrick Manalo`), and 1920×1080 Arena Jumbotron Display.*

| View | Desktop (`1440×900` / `1920×1080`) | Mobile (`390×844` / `844×390`) |
|---|---|---|
| **08a. Live Matchroom Scoreboard** | ![Desktop](desktop/08a-live-matchroom-scoreboard.png) | ![Mobile](mobile/08a-live-matchroom-scoreboard.png) |
| **08b. Scrolled Box Score & Commentary** | ![Desktop](desktop/08b-live-matchroom-boxscore-feed.png) | ![Mobile](mobile/08b-live-matchroom-boxscore-feed.png) |
| **09a. Facilitator Kiosk Top Deck** | ![Desktop](desktop/09a-facilitator-kiosk-top.png) | ![Mobile](mobile/09a-facilitator-kiosk-top.png) |
| **09b. Scrolled Kiosk Scoring Controls** | ![Desktop](desktop/09b-facilitator-kiosk-controls.png) | ![Mobile](mobile/09b-facilitator-kiosk-controls.png) |
| **10. Arena Stadium Jumbotron Display** | ![Desktop](desktop/10-stadium-display-jumbotron.png) | ![Mobile](mobile/10-stadium-display-jumbotron.png) |

---

### 11, 12 & 13. Admin Command Center, Tournaments & Facilitator Hub (`Dr. Ramon Bautista`)
*Authenticated as real Admin (`sports.director@psu.palawan.edu.ph`): Command Center overview, scrolled KPI counters & verifications breakdown, populated tournament grid, team approvals, and Courtside Facilitator Operations Hub with COI warnings.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **11a. Admin Command Center Top** | ![Desktop](desktop/11a-admin-overview-top.png) | ![Mobile](mobile/11a-admin-overview-top.png) |
| **11b. Scrolled KPIs, Breakdown & Feed** | ![Desktop](desktop/11b-admin-overview-kpis-and-feed.png) | ![Mobile](mobile/11b-admin-overview-kpis-and-feed.png) |
| **12a. Populated Tournament Grid** | ![Desktop](desktop/12a-admin-tournaments-grid.png) | ![Mobile](mobile/12a-admin-tournaments-grid.png) |
| **12b. Team Enrollment Approvals Tab** | ![Desktop](desktop/12b-admin-tournaments-approvals.png) | ![Mobile](mobile/12b-admin-tournaments-approvals.png) |
| **13a. Match Officials Assignment Board** | ![Desktop](desktop/13a-admin-facilitator-assignments.png) | ![Mobile](mobile/13a-admin-facilitator-assignments.png) |
| **13b. Officials Roster & Recruitment** | ![Desktop](desktop/13b-admin-facilitator-roster.png) | ![Mobile](mobile/13b-admin-facilitator-roster.png) |

---

### 14, 15 & 16. Admin System Verifications, Audit Logs & Institutional Reports (`Dr. Ramon Bautista`)
*Populated COR & Employee ID clearance queue (`Mark Mendoza 96% High Match`, `Prof. Carlos Villanueva`, `Liza Santos`), in-screen Document Review Dossier modal, immutable audit trail, and FR-43 Institutional Reports.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **14a. Populated COR & ID Clearance Queue** | ![Desktop](desktop/14a-admin-verifications-queue.png) | ![Mobile](mobile/14a-admin-verifications-queue.png) |
| **14b. In-Screen Document Review Modal** | ![Desktop](desktop/14b-admin-verifications-detail.png) | ![Mobile](mobile/14b-admin-verifications-detail.png) |
| **15. Institutional Audit Trail Table** | ![Desktop](desktop/15-admin-audit-logs-content.png) | ![Mobile](mobile/15-admin-audit-logs-content.png) |
| **16a. Institutional Report Parameters** | ![Desktop](desktop/16a-admin-reports-parameters.png) | ![Mobile](mobile/16a-admin-reports-parameters.png) |
| **16b. Scrolled Report Champion Tables** | ![Desktop](desktop/16b-admin-reports-tables.png) | ![Mobile](mobile/16b-admin-reports-tables.png) |

---

### 17 & 18. Collegiate Coach Portal & Squad Lineup Management (`Coach Danilo Soriano`)
*Authenticated as real Coach (`danilo.soriano@psu.palawan.edu.ph`): Coach Analytics Overview, scrolled KPI metrics, My Teams squad cards (`CBA Golden Wolves` & `CBA Lady Wolves`), and the Manage Roster & Starters/Bench Lineup modal.*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **17a. Coach Dashboard Top & Pipeline** | ![Desktop](desktop/17a-coach-dashboard-overview.png) | ![Mobile](mobile/17a-coach-dashboard-overview.png) |
| **17b. Scrolled Coach KPIs & Metrics** | ![Desktop](desktop/17b-coach-dashboard-pipeline.png) | ![Mobile](mobile/17b-coach-dashboard-pipeline.png) |
| **18a. My Teams Squad Cards** | ![Desktop](desktop/18a-coach-teams-management.png) | ![Mobile](mobile/18a-coach-teams-management.png) |
| **18b. Manage Squad Roster & Lineup** | ![Desktop](desktop/18b-coach-teams-lineup-table.png) | ![Mobile](mobile/18b-coach-teams-lineup-table.png) |

---

### 19, 20, 21 & 22. Multi-Role Athlete Views (Verified Student, Faculty, Staff & Pending Clearance)
*Showcases different real database athlete personas: Verified Student Athlete (`Juan Dela Cruz`), Verified Faculty Athlete (`Prof. Elena Fernandez`), Verified Staff Athlete (`Roberto Mendoza`), Pending-Clearance Student (`Mark Mendoza` — 96% COR Match in progress), and Unverified Faculty Clearance Upload Form (`Prof. Carlos Villanueva`).*

| View | Desktop (`1440×900`) | Mobile (`390×844`) |
|---|---|---|
| **19a. Student Athlete Dashboard Top** | ![Desktop](desktop/19a-student-athlete-dashboard-top.png) | ![Mobile](mobile/19a-student-athlete-dashboard-top.png) |
| **19b. Scrolled Athlete Live & Friendly Games** | ![Desktop](desktop/19b-student-athlete-dashboard-matches.png) | ![Mobile](mobile/19b-student-athlete-dashboard-matches.png) |
| **20a. Student Athlete Profile & Telemetry** | ![Desktop](desktop/20a-student-athlete-profile-top.png) | ![Mobile](mobile/20a-student-athlete-profile-top.png) |
| **20b. Scrolled Multi-Sport Scoring Breakdown** | ![Desktop](desktop/20b-student-athlete-profile-stats.png) | ![Mobile](mobile/20b-student-athlete-profile-stats.png) |
| **21a. Verified Faculty Athlete Profile** | ![Desktop](desktop/21a-faculty-athlete-profile.png) | ![Mobile](mobile/21a-faculty-athlete-profile.png) |
| **21b. Verified Staff Athlete Profile** | ![Desktop](desktop/21b-staff-athlete-profile.png) | ![Mobile](mobile/21b-staff-athlete-profile.png) |
| **22a. Pending Student COR Status (96% Match)** | ![Desktop](desktop/22a-pending-student-clearance-view.png) | ![Mobile](mobile/22a-pending-student-clearance-view.png) |
| **22b. Faculty/Staff ID Clearance Upload Form** | ![Desktop](desktop/22b-pending-faculty-clearance-view.png) | ![Mobile](mobile/22b-pending-faculty-clearance-view.png) |
