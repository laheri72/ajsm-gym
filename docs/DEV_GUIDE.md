# Developer Guide: AJSM Gym Management System

This guide provides instructions for setting up the development environment, running the application locally, and deployment considerations.

## Prerequisites
- **Node.js:** v18 or higher (v20+ recommended).
- **npm:** v9 or higher.
- **Database:** Access to a Microsoft SQL Server (MSSQL).
- **IDE:** Visual Studio Code (recommended).

## Local Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/laheri72/ajsm-gym.git
cd ajsm-gym
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory and populate it with your database credentials and session secret.

```env
# Database Credentials
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server_address (e.g., localhost or remote ip)
DB_NAME=fittracker

# Session Configuration
SESSION_SECRET=your_secure_random_string

# Internal Security
INTERNAL_SECRET=AjsmGymEvaluation_2025!
```

*Note: In the current development state, some credentials might be hardcoded in `utils/db.js`. It is highly recommended to migrate these to environment variables using `process.env` before production.*

### 4. Running the Application

#### Frontend Development (Vite)
To run the frontend with Hot Module Replacement (HMR):
```bash
npm run dev
```
The frontend will be available at `http://localhost:5173`. Requests to `/api` are proxied to the backend at `http://localhost:10000`.

#### Backend Server
To start the Node.js server:
```bash
npm start
```
The server will run on `http://localhost:10000`.

## Build and Deployment

### 1. Build for Production
This command compiles the frontend using Vite and outputs the static assets to the `dist/` folder.
```bash
npm run build
```

### 2. Production Runtime
In production, the Express server serves the static files from the `dist/` folder.
```bash
# Ensure build is complete first
node server.js
```

### 3. Deployment (Render.com)
The project is configured for deployment on Render.com.
- **Build Command:** `npm install && npm run build`
- **Start Command:** `node server.js`
- **Environment:** Ensure all `.env` variables are added to the Render dashboard.
- **Auto-Deploy:** Keep enabled (`Yes`) so pushes to `main` trigger immediate zero-downtime builds on Render's free tier.

## Automated GitHub Releases & Deployment Pipeline

The repository uses GitHub Actions (`.github/workflows/release-and-deploy.yml`) to automatically tag releases, generate changelogs, and register production deployments whenever code is pushed to `main`.

### How Semantic Versioning Works (Conventional Commits)
Version bumps are derived automatically from commit messages:
- **Patch release** (`v1.0.0` ➔ `v1.0.1`): Use prefix `fix:`, `perf:`, or `refactor:`. (Default fallback for normal commits).
- **Minor release** (`v1.0.1` ➔ `v1.1.0`): Use prefix `feat:`.
- **Major release** (`v1.1.0` ➔ `v2.0.0`): Use prefix `feat!:` or include `BREAKING CHANGE:` in the commit message body.

### GitHub UI Integrations
- **Releases Section**: Updates the repository sidebar with the new release tag, notes, and asset archives.
- **Environments / Deployments**: Registers an active `Production` deployment pointing to `https://ajsm-gym.onrender.com`.
- **Dynamic Badges**: The Shields.io badges in `README.md` dynamically pull the latest release tag and deployment state.

### One-Time Setup Requirement
In GitHub repository **Settings ➔ Actions ➔ General ➔ Workflow permissions**:
- Select **Read and write permissions**.
- Check **"Allow GitHub Actions to create and approve pull requests"**.

## Database Migrations
Currently, the project does not use a migration tool like Knex or Sequelize. Schema changes must be applied manually to the MSSQL instance. 
- Refer to `docs/DATABASE_SCHEMA.md` for the current table structures.
- Use a tool like **Azure Data Studio** or **SQL Server Management Studio (SSMS)** to manage the remote database.

## Background Tasks
Achievement evaluations are designed as a "fire-and-forget" process triggered via a POST request to `/api/achievements/evaluate`. This can be automated using a cron job service (like Render Cron Jobs or GitHub Actions) to call the endpoint daily.
