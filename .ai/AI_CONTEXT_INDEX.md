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

## 🔄 Major Logic Shifts (April 2026)
- **Attendance Exception Logic:** Weekly attendance (for both Staff and Students) no longer strictly uses `JoinedAt` as the sole baseline. Absences are dynamically masked (shown as `-`) on days where a student's `StudentStatusHistory` reflects an `Inactive` status or if their slot was `Pending`.
- **Slot Changes Logged:** The `StudentStatusHistory` table now supports an `ActionType` of `'SlotChange'`. Whenever a student's `SlotID` is modified in the staff dashboard, this change is recorded (provided their status remains `Active`). This ensures accurate historical tracking of when a student transitions from a "Pending" slot to an actual assigned slot without relying on first-attendance heuristics.