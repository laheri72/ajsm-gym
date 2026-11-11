'use strict';

function summarizeDurations(rows) {
    const minutes = rows.map(row => Number(row.DurationInMinutes))
        .filter(value => Number.isFinite(value) && value > 0);
    return {
        averageMinutes: minutes.length
            ? Number((minutes.reduce((sum, value) => sum + value, 0) / minutes.length).toFixed(1))
            : null,
        sessionCount: minutes.length
    };
}

// Student responses must never return the general staff audit record.
function studentStatusSummary(rows) {
    return rows.map(row => ({
        ChangedAt: row.ChangedAt,
        ActionType: row.ActionType,
        PreviousStatus: row.PreviousStatus,
        NewStatus: row.NewStatus,
        PreviousSlotName: row.PreviousSlotName,
        NewSlotName: row.NewSlotName
    }));
}

module.exports = { summarizeDurations, studentStatusSummary };
