const sql = require('mssql');

function buildRequest(connection) {
    if (connection && typeof connection.request === 'function') {
        return connection.request();
    }
    return new sql.Request(connection);
}

function createHttpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function normalizeReason(reason) {
    const trimmed = String(reason ?? '').trim();
    return trimmed ? trimmed.slice(0, 500) : null;
}

function getActorSnapshot(sessionUser = {}) {
    return {
        userId: Number.isInteger(sessionUser.UserID) ? sessionUser.UserID : null,
        username: String(sessionUser.Username || sessionUser.Name || '').trim() || null,
        role: String(sessionUser.Role || '').trim() || null
    };
}

function assertCanManageStudent(student, sessionUser = {}) {
    if (!sessionUser || !sessionUser.Role || !sessionUser.Branch) {
        throw createHttpError(401, 'Unauthorized.');
    }

    if (student.Branch !== sessionUser.Branch) {
        throw createHttpError(403, 'Forbidden: You can only manage students in your own branch.');
    }

    if (sessionUser.Role === 'Staff' && student.Gender !== sessionUser.Gender) {
        throw createHttpError(403, 'Forbidden: You can only manage students for your own gender section.');
    }

    if (!['Admin', 'Staff'].includes(sessionUser.Role)) {
        throw createHttpError(403, 'Forbidden: Access restricted to Staff/Admin users.');
    }
}

async function hasStudentStatusHistoryTable(connection) {
    const result = await buildRequest(connection).query(`
        SELECT CASE
            WHEN OBJECT_ID('dbo.StudentStatusHistory', 'U') IS NOT NULL THEN 1
            ELSE 0
        END AS ExistsFlag
    `);

    return Boolean(result.recordset[0]?.ExistsFlag);
}

async function getStudentWithSlot(connection, tr) {
    const result = await buildRequest(connection)
        .input('TR', sql.Int, tr)
        .query(`
            SELECT TOP 1
                M.TR,
                M.Name,
                M.Status,
                M.Branch,
                M.Gender,
                M.SlotID,
                S.SlotName
            FROM TestMaster M
            LEFT JOIN Slots S ON M.SlotID = S.SlotID
            WHERE M.TR = @TR
        `);

    return result.recordset[0] || null;
}

async function insertStatusHistory(connection, {
    tr,
    actionType,
    previousStatus,
    newStatus,
    reason,
    student,
    previousSlotID,
    previousSlotName,
    newSlotID,
    newSlotName,
    sessionUser
}) {
    if (!(await hasStudentStatusHistoryTable(connection))) {
        return false;
    }

    const actor = getActorSnapshot(sessionUser);
    const request = buildRequest(connection);

    request.input('TR', sql.Int, tr);
    request.input('ActionType', sql.VarChar(12), actionType);
    request.input('PreviousStatus', sql.VarChar(8), previousStatus || null);
    request.input('NewStatus', sql.VarChar(8), newStatus);
    request.input('ChangeReason', sql.NVarChar(500), normalizeReason(reason));
    request.input('ChangedByUserID', sql.Int, actor.userId);
    request.input('ChangedByUsername', sql.NVarChar(50), actor.username);
    request.input('ChangedByRole', sql.NVarChar(20), actor.role);
    request.input('BranchSnapshot', sql.VarChar(7), student.Branch);
    request.input('GenderSnapshot', sql.VarChar(6), student.Gender);
    request.input('PreviousSlotID', sql.Int, previousSlotID ?? null);
    request.input('PreviousSlotName', sql.NVarChar(25), previousSlotName || null);
    request.input('NewSlotID', sql.Int, newSlotID ?? null);
    request.input('NewSlotName', sql.NVarChar(25), newSlotName || null);

    await request.query(`
        INSERT INTO dbo.StudentStatusHistory (
            TR,
            ActionType,
            PreviousStatus,
            NewStatus,
            ChangeReason,
            ChangedByUserID,
            ChangedByUsername,
            ChangedByRole,
            BranchSnapshot,
            GenderSnapshot,
            PreviousSlotID,
            PreviousSlotName,
            NewSlotID,
            NewSlotName
        )
        VALUES (
            @TR,
            @ActionType,
            @PreviousStatus,
            @NewStatus,
            @ChangeReason,
            @ChangedByUserID,
            @ChangedByUsername,
            @ChangedByRole,
            @BranchSnapshot,
            @GenderSnapshot,
            @PreviousSlotID,
            @PreviousSlotName,
            @NewSlotID,
            @NewSlotName
        )
    `);

    return true;
}

async function updateStudentStatusWithAudit({
    transaction,
    tr,
    newStatus,
    reason,
    sessionUser
}) {
    const targetStatus = String(newStatus || '').trim();
    if (!['Active', 'Inactive'].includes(targetStatus)) {
        throw createHttpError(400, 'Only Active and Inactive status changes are supported here.');
    }

    const student = await getStudentWithSlot(transaction, tr);
    if (!student) {
        throw createHttpError(404, 'Student not found.');
    }

    assertCanManageStudent(student, sessionUser);

    if (student.Status === 'Revoked') {
        throw createHttpError(400, 'Revoked students cannot be changed through this flow.');
    }

    if (student.Status === targetStatus) {
        return {
            success: true,
            changed: false,
            message: `Student is already ${targetStatus}.`,
            student
        };
    }

    const normalizedReason = normalizeReason(reason);
    if (targetStatus === 'Inactive' && !normalizedReason) {
        throw createHttpError(400, 'Reason is required when deactivating a student.');
    }

    if (targetStatus === 'Inactive' && student.Status !== 'Active') {
        throw createHttpError(400, `Only active students can be deactivated. Current status: ${student.Status}.`);
    }

    if (targetStatus === 'Active' && student.Status !== 'Inactive') {
        throw createHttpError(400, `Only inactive students can be activated. Current status: ${student.Status}.`);
    }

    const previousSlotID = student.SlotID ?? null;
    const previousSlotName = student.SlotName || null;
    const nextSlotID = targetStatus === 'Inactive' ? null : previousSlotID;
    const nextSlotName = targetStatus === 'Inactive' ? null : previousSlotName;

    await buildRequest(transaction)
        .input('TR', sql.Int, tr)
        .input('Status', sql.VarChar(8), targetStatus)
        .query(`
            UPDATE TestMaster
            SET
                Status = @Status,
                SlotID = CASE WHEN @Status = 'Inactive' THEN NULL ELSE SlotID END
            WHERE TR = @TR
        `);

    await insertStatusHistory(transaction, {
        tr,
        actionType: targetStatus === 'Active' ? 'Activated' : 'Deactivated',
        previousStatus: student.Status,
        newStatus: targetStatus,
        reason: normalizedReason,
        student,
        previousSlotID,
        previousSlotName,
        newSlotID: nextSlotID,
        newSlotName: nextSlotName,
        sessionUser
    });

    return {
        success: true,
        changed: true,
        message: `Student marked as ${targetStatus}.`,
        student: {
            ...student,
            Status: targetStatus,
            SlotID: nextSlotID,
            SlotName: nextSlotName
        }
    };
}

async function logActivationForCurrentStudent({
    connection,
    tr,
    previousStatus,
    sessionUser
}) {
    if (previousStatus === 'Active') {
        return false;
    }

    if (![null, 'Inactive'].includes(previousStatus)) {
        throw createHttpError(400, 'Only new or inactive students can be logged as activated.');
    }

    const student = await getStudentWithSlot(connection, tr);
    if (!student || student.Status !== 'Active') {
        return false;
    }

    await insertStatusHistory(connection, {
        tr,
        actionType: 'Activated',
        previousStatus,
        newStatus: 'Active',
        reason: null,
        student,
        previousSlotID: null,
        previousSlotName: null,
        newSlotID: student.SlotID ?? null,
        newSlotName: student.SlotName || null,
        sessionUser
    });

    return true;
}

async function getStudentStatusHistory(connection, tr) {
    if (!(await hasStudentStatusHistoryTable(connection))) {
        return [];
    }

    const result = await buildRequest(connection)
        .input('TR', sql.Int, tr)
        .query(`
            SELECT
                StatusHistoryID,
                TR,
                ActionType,
                PreviousStatus,
                NewStatus,
                ChangeReason,
                ChangedAt,
                ChangedByUserID,
                ChangedByUsername,
                ChangedByRole,
                BranchSnapshot,
                GenderSnapshot,
                PreviousSlotID,
                PreviousSlotName,
                NewSlotID,
                NewSlotName
            FROM dbo.StudentStatusHistory
            WHERE TR = @TR
            ORDER BY ChangedAt DESC, StatusHistoryID DESC
        `);

    return result.recordset;
}

module.exports = {
    createHttpError,
    normalizeReason,
    hasStudentStatusHistoryTable,
    getStudentWithSlot,
    getStudentStatusHistory,
    insertStatusHistory,
    updateStudentStatusWithAudit,
    logActivationForCurrentStudent
};
