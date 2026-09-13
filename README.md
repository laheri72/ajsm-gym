<div align="center">

  <img src="public/images/Unted.png" width="120" height="120" alt="AJSM FitTracker Icon" style="border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);" />

  # FitTracker (خيمة الرياضة • Khaima al-Riyada) — Enterprise Campus Fitness, Attendance & Gamified Workout Intelligence System

  **Engineered specifically for the students, faculty, trainers, and administrative staff of Raudat ul Ikhwaan at the Al Jamea Tus Saifiyah Marol Campus, this platform centralizes athletic operations and health intelligence in a secure institutional environment. It delivers automated multi-tier attendance verification, normalized V2 progressive workout prescription, clinical-grade biometric diagnostics, and competitive XP-driven gamification to elevate student physical discipline and athletic health.**

  <p align="center">
    <a href="https://github.com/laheri72/ajsm-gym/releases"><img src="https://img.shields.io/badge/version-v1.0.0-059669?style=for-the-badge&logo=git&logoColor=white" alt="Version" /></a>
    <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/runtime-Node.js_v20+-1E293B?style=for-the-badge&logo=node.js&logoColor=white" alt="Runtime" /></a>
    <a href="https://expressjs.com/"><img src="https://img.shields.io/badge/backend-Express_4.18-059669?style=for-the-badge&logo=express&logoColor=white" alt="Express" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/frontend-Vite_7_%7C_Bootstrap_5-D97706?style=for-the-badge&logo=vite&logoColor=white" alt="Frontend" /></a>
    <a href="https://www.microsoft.com/sql-server"><img src="https://img.shields.io/badge/database-MSSQL_Server-1E293B?style=for-the-badge&logo=microsoftsqlserver&logoColor=white" alt="Database" /></a>
    <a href="https://github.com/laheri72/ajsm-gym"><img src="https://img.shields.io/badge/build-passing-059669?style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Status" /></a>
    <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/license-ISC-D97706?style=for-the-badge" alt="License" /></a>
  </p>

</div>

---

## ⚡ Scannable Key Features

* 🏋️‍♂️ **Normalized Workout Architecture (V2)**  
  Re-architected from legacy monolithic JSON strings into an enterprise 6-table normalized relational schema (`WorkoutPrograms` ➔ `WorkoutWeeks` ➔ `WorkoutDays` ➔ `PlannedExercises` ➔ `PerformanceLogs` ➔ `StudentPRs`). Supports granular day-by-day workout prescription, target sets, rep ranges, and rest intervals with an in-session execution logging modal (Phase 3C). Includes 98 verified exercises mapped to target muscle groups with embedded video demonstrations and automated 1-Rep Max (1RM) Personal Record calculation using the Epley formula.

* ⏱️ **Multi-Tier Attendance Intelligence**  
  Automated week-based and slot-based attendance tracking with strict Indian Standard Time (`IST` / `UTC+5:30`) normalization via `moment-timezone`. Features dynamic exception masking: masking days before registration (`JoinedAt`) or during `Inactive`/`Pending` status as not expected (`-`) rather than false absences. Includes dynamic slot-change auditing via `StudentStatusHistory`, dual-pass bulk holiday leave assignment, and checkout duration tracking that awards experience points (XP) based on training duration.

* 🎮 **Gamification & Hall of Fame**  
  Multi-tier leveling and progression engine calculating dynamic level thresholds (`level * 100 XP`) and running totals for workout streaks and exercise duration. Issues achievement milestone badges (e.g., *Consistency King*, *Iron Dedication*, *Social Butterfly*, *Milestone Lift*) and generates live campus-wide Hall of Fame leaderboards ranked by verified badge counts with cumulative lifetime XP tiebreakers. Includes persistent level-up SweetAlert2 celebratory modal triggers.

* 🏥 **Comprehensive Biometric Diagnostics**  
  Multi-parameter physical evaluation pipeline capturing anatomical biometrics (Height, Weight, Waist, Hips, Neck, BMI, Body Fat %, BMR, Calorie Intake, VO2Max) alongside functional capacity indicators (Push-Ups, Sit-Ups, Squats, Sit-and-Reach, Step-Up Pulse Rate). Features structured batch management (`EvaluationBatches`) enabling certified evaluators to review trainer-submitted logs, submit categorized clinical remarks, and assign objective letter grades (A–F).

* 🛡️ **Role-Segregated Multi-Tenant Architecture**  
  Strict 5-tier role-based access control (`Student`, `Trainer`, `Staff`, `Evaluator`, `Admin`) partitioned by campus physical `Branch` and `Gender` (Talabat vs. Talebaat sections). Implements an intelligent 3-tier bulk Excel import validation engine (`detectStudentGender`): prioritizing Darajah code suffix authority (`M`/`F`), fallback Bohra honorific keyword parsing (`bhai`/`shaikh` vs. `bai`/`bhen`), and session context fallbacks with interactive SweetAlert2 preview verification.

* ⚡ **High-Performance Caching Subsystem**  
  High-throughput server-side in-memory caching powered by `node-cache` with an automatic 60-second TTL and instant targeted cache invalidation (`clearUserCache`) on user mutations. Client features responsive dark and light mode themes, Cal-Heatmap workout activity grids, Chart.js progression telemetry, SweetAlert2 micro-animations, and DataTables integration.

* 🌙 **Hijri Umm al-Qura Calendar**  
  Native dual-calendar engine incorporating standard Gregorian timestamps with Umm al-Qura Islamic Hijri calendar calculations and configurable runtime offsets (`HIJRI_OFFSET_DAYS`) tailored for campus observance.

---

## 🏗️ Architecture Directory Map

The codebase adheres to **Layered Clean Architecture** principles, maintaining strict separation between presentation views, application routing controllers, domain business logic, data persistence models, and shared kernel utilities:

```text
ajsm-gym/
├── .ai/                       # AI architectural context, domain reasoning & migration notes
├── docs/                      # Architectural specifications, API schema guides & changelogs
├── middleware/                # [Infrastructure / Security] Express request validation & security filters
│   └── validation.js          # Zod schema definitions & SQL injection control character sanitizers
├── public/                    # [UI / Presentation Layer] Client-facing MPA, assets & view templates
│   ├── assets/                # Vendored frontend libraries (Bootstrap 5, Chart.js, SweetAlert2, DataTables)
│   ├── css/                   # Role-segregated CSS stylesheets (Student, Staff, Trainer, Planner)
│   ├── gifs/                  # Interactive visual exercise movement demonstrations
│   ├── images/                # Institutional branding logos, optimized WebP graphics & badge SVGs
│   │   └── badges/            # Gamification achievement award icons (Gold/Silver/Bronze tiers)
│   ├── js/                    # Client application logic & student modular subsystem
│   │   └── student-modules/   # Modular client controllers (auth, dashboard, planner, telemetry)
│   ├── logins/                # Role-specific authentication entry views (Talabat, Staff, Trainer)
│   ├── staff/                 # Administrative & staff portal views (attendance, records, leaves, blacklist)
│   ├── student/               # Student dashboard, workout planner UI & fitness test portals
│   └── trainer/               # Trainer real-time check-in, set logger & session monitors
├── routes/                    # [Application Layer] Express RESTful API routers & business workflows
│   ├── admin.js               # System governance, user provisioning & evaluation batch controls
│   ├── auth.js                # Multi-role authentication, session management & password resets
│   ├── fitnessTest.js         # Biometric testing records, medical disclosures & evaluator scoring
│   ├── gamification.js        # XP calculation algorithms, streak engine & badge distribution
│   ├── staff.js               # Direct entry registration, attendance matrices & leave workflows
│   └── stu-routes.js          # Student workout planner V2, PR tracking & analytics endpoints
├── sql/                       # [Infrastructure / Persistence] Database migrations, DDL & seeds
│   └── migrations/            # Idempotent incremental SQL migration scripts (V2 planner, schema patches)
├── utils/                     # [Infrastructure / Shared Kernel] Core utilities & cross-cutting concerns
│   ├── cache.js               # In-memory node-cache engine & targeted cache invalidator (clearUserCache)
│   ├── db.js                  # Centralized MSSQL connection pooling & resilience layer
│   ├── mumineenCalendar.js    # Hijri Umm al-Qura calendar calculation & offset logic
│   └── studentStatusAudit.js  # Audit logging subsystem for student state & slot transitions
├── dist/                      # [Compiled Artifacts] Production-optimized static output generated by Vite
├── server.js                  # [Application Entry Point] Express bootstrapper, session store & middleware
├── vite.config.js             # [Build System] Multi-page application (MPA) rollup configuration
└── package.json               # Manifest declaring dependencies, scripts, and runtime metadata
```

---

## 🚀 Platform-Segregated Quick Start

Follow the platform-specific instructions below to set up and run the application locally or in a containerized environment.

### Prerequisites

- **Node.js**: `v18.0.0` or higher (`v20+ LTS` recommended)
- **Database**: Access to a Microsoft SQL Server (`MSSQL` 2017+ or Azure SQL Database)
- **Package Manager**: `npm` v9+

---

### 🪟 Windows Setup (PowerShell)

1. **Clone the Repository**
   ```powershell
   git clone https://github.com/laheri72/ajsm-gym.git
   cd ajsm-gym
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory:
   ```powershell
   Copy-Item .env.example .env
   # Or create manually with the following variables:
   Set-Content .env @"
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server.database.windows.net
   DB_NAME=fittracker
   SESSION_SECRET=super_secure_session_secret_passphrase
   INTERNAL_SECRET=AjsmGymEvaluation_2026!
   HIJRI_OFFSET_DAYS=1
   PORT=10000
   "@
   ```

3. **Install Dependencies**
   ```powershell
   npm install
   ```

4. **Apply Database Migrations**
   Execute the migration scripts located in `sql/migrations/` in sequential order using **Azure Data Studio** or **SQL Server Management Studio (SSMS)**.

5. **Build and Launch Application**
   ```powershell
   # Compile frontend assets with Vite
   npm run build

   # Start the production Node.js Express server
   npm start
   ```
   Access the web application at `http://localhost:10000`.

---

### 🐧 Linux & macOS Setup (Bash)

1. **Clone the Repository**
   ```bash
   git clone https://github.com/laheri72/ajsm-gym.git
   cd ajsm-gym
   ```

2. **Configure Environment Variables**
   ```bash
   cat << 'EOF' > .env
   DB_USER=your_db_username
   DB_PASSWORD=your_db_password
   DB_SERVER=your_db_server.database.windows.net
   DB_NAME=fittracker
   SESSION_SECRET=super_secure_session_secret_passphrase
   INTERNAL_SECRET=AjsmGymEvaluation_2026!
   HIJRI_OFFSET_DAYS=1
   PORT=10000
   EOF
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Build Frontend & Launch Server**
   ```bash
   # Compile optimized production bundle into dist/
   npm run build

   # Start the Express server
   npm start
   ```
   Access the web application at `http://localhost:10000`.

---

### 🐳 Docker Deployment

1. **Build the Container Image**
   ```bash
   docker build -t ajsm-gym:latest .
   ```

2. **Launch with Environment File**
   ```bash
   docker run -d \
     --name ajsm-gym-app \
     -p 10000:10000 \
     --env-file .env \
     --restart unless-stopped \
     ajsm-gym:latest
   ```

> [!TIP]
> **💡 Setup & Troubleshooting Tips:**
> - **Self-Signed Certificates**: When connecting to a local or remote MSSQL instance, ensure `trustServerCertificate: true` and `encrypt: true` are enabled in your database configuration to prevent SSL handshake rejections.
> - **Vite Build Requirement**: Always execute `npm run build` prior to running `node server.js` or `npm start`. In production, Express directly serves pre-compiled bundles from the `dist/` directory.
> - **Hot Module Replacement (HMR)**: For frontend development, run `npm run dev` alongside the backend server. Requests to `/api/*` are automatically proxied from port `5173` to `10000`.
> - **PowerShell Execution Policy**: If script execution errors occur on Windows during npm commands, run:  
>   `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`.

---

## 🔒 Security & Privacy Deep-Dive

The AJSM Gym Management System is built with zero-trust principles, safeguarding sensitive biometric, academic, and attendance data:

* **Strict Local & Dedicated Persistence**:  
  All student records, fitness telemetry, medical histories, and attendance data reside exclusively within an isolated Microsoft SQL Server instance. No biometric metrics or personal identity records are ever transmitted to third-party APIs or external analytics brokers.

* **Cryptographic Credential Protection**:  
  All user passwords (students, staff, trainers, evaluators, and administrators) are cryptographically salted and hashed using `bcrypt` (work factor 10). Initial accounts are flagged with mandatory first-login password updates. User sessions are persisted directly into MSSQL via `connect-mssql`, secured with HTTP-Only, Lax SameSite, and strict 2-hour sliding expirations.

* **Zod Input Sanitization & Anti-Injection Defense**:  
  All authentication and state mutation endpoints enforce strict schema validation using `zod`. Incoming payloads are sanitized to intercept SQL control characters, evasion delimiters (`--`, `/*`, `*/`), and unexpected type coercions before executing parameterized SQL queries.

* **Air-Gapped Privacy & Zero Third-Party Telemetry**:  
  The application does not embed external advertising pixels, behavioral trackers, or third-party telemetry collectors. All chart visualizations, animations, calendar projections, and UI widgets are served from local static assets or self-contained enterprise CDNs.

* **Multi-Tenant Section Isolation**:  
  Database queries strictly segment operational data by `Branch` and `Gender` across all roles. Students and staff are isolated to their designated campus divisions, eliminating unauthorized cross-section data exposure.

---

## 👥 Credits & Attribution

### 🔹 Developed By
- **Mulla Idris Bh Laheri** — *Lead Architect & Full-Stack Developer*
- **Mulla Abizer Bh Dewas** — *Co-Developer & Systems Engineer*

### 🔹 Institutional Patronage
- **Raudat ul Ikhwaan**
- **Al Jamea Tus Saifiyah**, Marol Campus, Mumbai

### 🔹 Release Information
- **Current Version**: `v1.0.0 (Production Edition)`
- **License**: [ISC License](LICENSE)
- **Repository**: [github.com/laheri72/ajsm-gym](https://github.com/laheri72/ajsm-gym)

---

<div align="center">
  <sub>Built with discipline and dedication for the athletic development of the students of Al Jamea Tus Saifiyah.</sub>
</div>
