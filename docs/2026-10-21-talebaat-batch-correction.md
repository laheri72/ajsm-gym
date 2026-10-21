# Marol Talebaat batch correction — 21 October 2026

The previous active batch captured this year's Talebaat trainer tests. A guarded, one-time update changed only `TestRecords.BatchID` from **7** (`Batch 1447_Test #2`) to **10** (`Batch 1448_Test #1`) for Marol, Female, Trainer submissions dated from 1 January 2026 through 31 December 2026.

Read-only preflight identified **285 records from 2026** (285 students), with **151 records from 2025** in batch 7. The transaction moved exactly 285 `TestLog` IDs, checked the updated ID set and counts, then committed. A separate verification confirmed all 285 selected IDs in batch 10, zero qualifying 2026 records remaining in batch 7, and all 151 records from 2025 remaining in batch 7. The target held zero records before the update.

The audit manifest containing the exact `TestLog` IDs is stored locally in the ignored `migration-audit/` directory. The guarded script is `scripts/migrate-marol-talebaat-2026-batch.js`; rerunning `--apply` will fail its 285-record preflight and make no changes. Comments and activity logs remain attached through `TestLog`.
