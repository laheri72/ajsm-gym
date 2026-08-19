# Architecture Reference: AJSM Gym Management System

## Folder Structure
```text
D:\My Sites\ajsm-gym
├── .ai/                    # AI Prompts & analysis instructions
├── docs/                   # System-generated documentation
├── public/                 # Frontend root (Vite root)
│   ├── assets/             # CSS, JS, Fonts (external libraries)
│   ├── css/                # Custom CSS for different roles (Student, Staff, etc.)
│   ├── gifs/               # Exercise animations
│   ├── images/             # Static images and logos
│   ├── js/                 # Role-specific JS modules
│   │   ├── student-modules/ # Modular Student dashboard logic (Auth, Data, State)
│   ├── logins/             # Login pages for different roles
│   ├── staff/              # Staff management HTML pages
│   ├── student/            # Student dashboard and fitness test HTML
│   └── trainer/            # Trainer dashboard HTML
├── routes/                 # Express API routes
├── utils/                  # Database connections and cache logic
├── uploads/                # Dynamic user uploads
├── server.js               # Application entry point & Express configuration
├── vite.config.js          # Frontend build configuration
└── package.json            # Dependencies and build scripts
```

## Request Lifecycle
1. **Frontend Request:** The client (browser) requests a resource (HTML page or API endpoint).
2. **Static Files:** Requests for HTML/CSS/JS are served from the `dist/` directory (built by Vite).
3. **API Requests:** Requests to `/api/*` are handled by Express.
4. **Middleware:** 
    - `cors`: Security for cross-origin requests.
    - `express-session`: Manages user state via session cookies.
    - `express.json`/`urlencoded`: Parses incoming data.
    - `cacheMiddleware`: (Optional) Custom caching via `node-cache` for GET requests.
5. **Route Controllers:** Express routers in `routes/` process requests, perform business logic, and interact with the database.
6. **Data Layer:** `utils/db.js` provides a centralized MSSQL connection pool for all queries.
7. **Response:** Data is returned as JSON for API calls, or HTML for page requests.

## Authentication Flow
The system uses session-based authentication with distinct login flows for each role:
- **Login:** Handled in `routes/auth.js`. 
    - Students use `TR` (TR number) and a hashed password (initially TR or ITS).
    - Staff/Trainers/Admins use a `Username` and hashed password from the `PassBank` table.
- **Session State:** Once authenticated, the user profile (`TR`, `Name`, `Role`, `Branch`, `Gender`) is stored in `req.session.user`.
- **Authorization:** Middleware (e.g., `isAdmin`, `isTrainer`) or inline checks verify the `Role` in the session before allowing access to restricted API endpoints.
- **First-Time Login:** The system detects if the user is logging in for the first time (`HasLoggedInBefore = 0` or `Password IS NULL`) and forces a password change.

## Service Layer & Logic
Logic is predominantly co-located with route handlers in `routes/`. Key features include:
- **Gamification Engine (`routes/gamification.js`):** Calculates XP, levels, and awards achievements (Consistency King, Social Butterfly, etc.) based on attendance and workouts. Hall of Fame ranking uses earned badge count first, then derived lifetime XP/level from `TestMaster`.
- **Direct Entry Workflow:** Student registration bypasses the legacy `WaitingList` table. Students are activated directly in `TestMaster` upon entry, with optional "Waiting for Slot" support.
- **Bulk Import Engine & Section Routing:** Spreadsheet import (`/api/fitness-test/bulk-validate` & `/api/fitness-test/bulk-commit`) implements a strict 3-tier hierarchy engine (`detectStudentGender`):
  1. *Level 1 (Absolute Authority):* `Darajah` codes ending in `M`/`F` or `DARS M`/`DARS F` auto-route students to Male (Talabat) vs Female (Talebaat) sections, completely ignoring name text.
  2. *Level 2 (Honorific Keywords):* Evaluated ONLY if `Darajah` has no `M`/`F` indicator (scans Bohra title keywords like `bai`/`bhen` vs `bhai`/`mulla`/`shaikh`).
  3. *Level 3 (Session Fallback):* Defaults to session gender.
  Admins can upload multi-gender branch files in a single batch with automatic section routing and an interactive SweetAlert modal preview badge. Single-gender Staff are protected against cross-section imports.
- **Student Revocation:** Admin-level student removal uses a "Revoke" status instead of permanent deletion to preserve historical analytics and records.
- **Workout Planner (V2):** Students compose weekly plans via a structured day-by-day UI. Plans are persisted in the normalized `WorkoutPrograms → WorkoutWeeks → WorkoutDays → PlannedExercises` tables. Exercises are fetched dynamically via `/api/exercises` from the master `Exercises` table (98 entries with Video URLs). Planner insights (adherence, weekday history, duration baseline) are derived from `AttendanceWeek`, `WorkoutDays`, and `TrainingPlan/TrainingLog`.
- **Performance Logging (Phase 3C):** Students can log set-by-set execution (reps, weight, RPE) for any exercise in the master list. This data is stored in `PerformanceLogs`, which feeds into the Personal Record (PR) engine for real-time achievement notifications.
- **Planner Rollout Control:** Student session payload includes `FeatureFlags.planner_v2_ui` to support phased rollout by TR/environment flags.
- **Execution Logging:** Trainer workout logging writes body-part logs to `TrainingPlan/TrainingLog` and can additionally persist exercise-level execution data into `PerformanceLogs` for granular performance tracking.

## External Integrations
- **MSSQL (External):** Remote database hosting via MSSQL server.
- **Render.com:** Cloud platform for hosting the Node.js application.
- **Moment Timezone:** Essential for converting IST (Indian Standard Time) to UTC for database storage and retrieval.
