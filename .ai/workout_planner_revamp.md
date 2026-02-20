You are a senior product architect, UX designer, and full-stack engineer.

Analyze the file:

@public/student/student-dashboard.html

Specifically the "Planner" tab and current workout planner implementation.

The current system is:
- Hardcoded
- Modal-based exercise picker
- Plain text canvas
- Minimal interaction
- Only supports pulling last week's data
- No intelligent tracking
- No analytics
- No progressive overload logic
- No structured periodization
- Not intuitive for beginners
- Not professional

Your task is NOT to just improve UI.

Your task is to completely redesign the workout planning system into a modern, intelligent, and scalable system.

------------------------------------
PHASE 1 — ANALYSIS
------------------------------------
1. Explain current architecture of planner.
2. Identify limitations in:
   - UX
   - Data model
   - Scalability
   - Tracking
   - Analytics
   - User engagement

------------------------------------
PHASE 2 — SYSTEM REDESIGN
------------------------------------
Design a futuristic workout planning system including:

1. Smart Workout Builder
   - Drag & drop exercises
   - Muscle group heatmap
   - Weekly load visualization
   - Auto volume calculation
   - Auto rest suggestion

2. Structured Program Types
   - Beginner template
   - Hypertrophy
   - Strength
   - Fat loss
   - Custom

3. Tracking System
   - Progressive overload tracking
   - Volume tracking per muscle group
   - PR detection
   - Performance trends
   - Fatigue estimation

4. Calendar View
   - Monthly planner
   - Periodization blocks
   - Deload week detection

5. Analytics Dashboard
   - Volume per week
   - Muscle group distribution
   - Strength progression graphs
   - Consistency score

6. AI Assistance (Optional Design Layer)
   - Suggest next week's adjustments
   - Suggest load increase
   - Detect plateau

------------------------------------
PHASE 3 — DATA ARCHITECTURE
------------------------------------
Propose new database schema including:
- workout_programs
- workout_weeks
- workout_days
- exercises
- sets
- performance_logs
- muscle_group_volume_tracking
- PR_tracking

Define relationships clearly.

------------------------------------
PHASE 4 — IMPLEMENTATION PLAN
------------------------------------
Provide:

1. Frontend redesign strategy
2. Backend API changes required
3. Migration strategy from current system
4. Step-by-step refactor plan
5. Performance considerations
6. Scalability considerations

------------------------------------
PHASE 5 — OUTPUT FORMAT
------------------------------------
Generate:

1. WORKOUT_PLANNER_REDESIGN.md
2. DATABASE_SCHEMA_UPGRADE.md
3. FRONTEND_REBUILD_PLAN.md
4. BACKEND_API_PLAN.md
5. MIGRATION_STRATEGY.md

Be extremely structured.
Think like a senior engineer building a production SaaS fitness platform.
Do not give surface-level suggestions.
Provide deep technical design.