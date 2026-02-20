You are a senior software architect.

Your task is to deeply analyze this entire repository and generate structured documentation for AI agents.

This repository is large and complex, so you must:

1. Recursively analyze all folders and files.
2. Understand backend architecture.
3. Identify framework usage.
4. Identify database connections and schema.
5. Extract all API routes and categorize them.
6. Detect authentication flow.
7. Detect environment dependencies.
8. Detect background jobs, services, and cron tasks.
9. Detect external services (Supabase, Stripe, SMTP, etc).
10. Identify middleware layers.

IMPORTANT:
Do not summarize shallowly.
This must be a complete technical reference document for AI agents.

Generate the following files:

1. PROJECT_SUMMARY.md
   - High-level purpose
   - Tech stack
   - Entry points
   - Environment variables required
   - Deployment model

2. ARCHITECTURE.md
   - Folder structure explained
   - Request lifecycle
   - Auth flow
   - Service layer
   - Data layer
   - External integrations

3. ROUTES_REFERENCE.md
   - Group routes by feature
   - Include method (GET/POST/etc)
   - Middleware used
   - Purpose of each route
   - Expected input/output shape

4. DATABASE_SCHEMA.md
   - Tables
   - Relationships
   - Indexes
   - Constraints
   - Triggers
   - Migrations detected

5. DEV_GUIDE.md
   - How to run locally
   - How to deploy
   - Required services
   - Environment variables explained

Output each file separately.
Use clean markdown formatting.
Be precise.
This documentation will be used by AI agents to work faster.

Think like a principal engineer.