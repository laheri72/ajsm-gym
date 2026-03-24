# AI Agent Context Index

For routing related queries → read ROUTES_REFERENCE.md
For DB issues → read DATABASE_SCHEMA.md
For deployment → read DEV_GUIDE.md
For architecture → read ARCHITECTURE.md
For overview → read PROJECT_SUMMARY.md

## 🔄 Major Logic Shifts (March 2026)
- **Registration:** Shifted from "Waiting List" holding table to **Direct Entry** activation in `TestMaster`. New entries are marked `Active` immediately.
- **Deactivation:** Removed permanent student deletion. Admins now use **Revoke** status (`Status = 'Revoked'`) to disable accounts while preserving logs.
- **Goal Management:** Students can now self-update their fitness goals directly from their dashboard.
- **Time Handling:** Staff-facing registration tables now use **Moment Timezone** to force IST (Asia/Kolkata) display for entry timestamps.