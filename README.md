# 🏆 PSU SportsTrack

Official Palawan State University (PSU) Sports Tracking, Live Scoring & Tournament Arena Portal.

## 🏛️ System Overview

**PSU SportsTrack** is an enterprise-grade collegiate athletic management system engineered for Palawan State University. The platform coordinates multi-sport tournaments (e.g., PSU Binturungan, STRASUC), authenticates athlete clearances via university Certificate of Registration (COR) verification, and provides high-speed courtside match operations with real-time broadcasting.

## ✨ Core Features

- **Courtside Facilitator Kiosk Mode**: Tactile Stream Deck style console (`/match/:id/kiosk`) featuring zero-scroll mobile viewport snapping (`h-dvh`), dual-thumb split-view controls, 2-tap substitutions, fouls counters with bonus indicators, timeout LED pips, master digital game clock, and court side swap.
- **Stadium Jumbotron / Focus View**: Distraction-free big-screen arena presentation (`/match/:id/display`) with Screen Wake Lock API, live action ticker, digital scoreboard clock, spectator URL, and fullscreen toggle.
- **Web Audio FX Synthesizer**: Procedural, zero-dependency browser synthesizer generating dynamic score chimes, referee Fox 40 whistle, arena buzzer klaxon, timeout klaxon, and scorer's table sub horns.
- **Picture-in-Picture Multitasking**: Canvas-piped live scoreboard stream for native OS Picture-in-Picture window multitasking outside the browser.
- **Dynamic Scoreboard Telemetry**: Visual score-pop spring physics, floating delta badges (+1, +2, +3, -1), lead-change alerts, and unanswered momentum run detection.
- **Sport-Specific Scoring Profiles**: Dedicated scoring logic for 9 collegiate ball sports (Basketball, Volleyball, Soccer, Sepak Takraw, Baseball, Softball, Table Tennis, Pickleball, Esports).
- **Institutional Athlete Verification**: Student corporate email validation and in-browser PDF.js canvas viewer for university Certificates of Registration.
- **Strict Role-Based Access Control**: Standardized permissions across 5 canonical roles: `super_admin`, `facilitator`, `coach`, `player_student`, and `player_faculty`.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite 8, Tailwind CSS, shadcn/ui, next-themes, Lucide Icons, React Icons.
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, Supabase Auth, Storage, Realtime WebSockets).
- **Audio & Media**: Web Audio API Procedural Synthesizer, HTML5 Canvas, Screen Wake Lock API, Picture-in-Picture API.
- **Testing**: Playwright.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation & Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build
```bash
npm run build
```
