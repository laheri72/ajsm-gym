IF OBJECT_ID('dbo.StudentStatusHistory', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StudentStatusHistory (
        StatusHistoryID INT IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_StudentStatusHistory PRIMARY KEY,
        TR INT NOT NULL,
        ActionType VARCHAR(12) NOT NULL,
        PreviousStatus VARCHAR(8) NULL,
        NewStatus VARCHAR(8) NOT NULL,
        ChangeReason NVARCHAR(500) NULL,
        ChangedAt DATETIME2(0) NOT NULL
            CONSTRAINT DF_StudentStatusHistory_ChangedAt DEFAULT SYSUTCDATETIME(),
        ChangedByUserID INT NULL,
        ChangedByUsername NVARCHAR(50) NULL,
        ChangedByRole NVARCHAR(20) NULL,
        BranchSnapshot VARCHAR(7) NOT NULL,
        GenderSnapshot VARCHAR(6) NOT NULL,
        PreviousSlotID INT NULL,
        PreviousSlotName NVARCHAR(50) NULL,
        NewSlotID INT NULL,
        NewSlotName NVARCHAR(50) NULL,
        CONSTRAINT FK_StudentStatusHistory_TestMaster
            FOREIGN KEY (TR) REFERENCES dbo.TestMaster(TR),
        CONSTRAINT FK_StudentStatusHistory_PassBank
            FOREIGN KEY (ChangedByUserID) REFERENCES dbo.PassBank(UserID) ON DELETE SET NULL,
        CONSTRAINT CK_StudentStatusHistory_ActionType
            CHECK (ActionType IN ('Activated', 'Deactivated')),
        CONSTRAINT CK_StudentStatusHistory_StatusFlow
            CHECK (
                (ActionType = 'Activated' AND NewStatus = 'Active' AND (PreviousStatus = 'Inactive' OR PreviousStatus IS NULL))
                OR
                (ActionType = 'Deactivated' AND PreviousStatus = 'Active' AND NewStatus = 'Inactive')
            ),
        CONSTRAINT CK_StudentStatusHistory_Reason
            CHECK (
                ActionType <> 'Deactivated'
                OR NULLIF(LTRIM(RTRIM(ChangeReason)), '') IS NOT NULL
            )
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_StudentStatusHistory_TR_ChangedAt'
      AND object_id = OBJECT_ID('dbo.StudentStatusHistory')
)
BEGIN
    CREATE INDEX IX_StudentStatusHistory_TR_ChangedAt
    ON dbo.StudentStatusHistory (TR, ChangedAt DESC)
    INCLUDE (ActionType, PreviousStatus, NewStatus, ChangeReason, ChangedByUsername, ChangedByRole, PreviousSlotName, NewSlotName);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_StudentStatusHistory_TR_ActionType_ChangedAt'
      AND object_id = OBJECT_ID('dbo.StudentStatusHistory')
)
BEGIN
    CREATE INDEX IX_StudentStatusHistory_TR_ActionType_ChangedAt
    ON dbo.StudentStatusHistory (TR, ActionType, ChangedAt DESC)
    INCLUDE (ChangeReason, ChangedByUsername, ChangedByRole, PreviousSlotName, NewSlotName);
END;
