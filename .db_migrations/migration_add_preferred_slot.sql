-- =============================================
-- Migration: Add PreferredSlotID to WaitingList
-- Description: Adds PreferredSlotID column to WaitingList table to support the new Gym Entry manual entry flow.
-- =============================================

USE [fittracker]
GO

-- 1. Check if PreferredSlotID already exists (for safety). If not, add it.
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[WaitingList]') 
      AND name = 'PreferredSlotID'
)
BEGIN
    ALTER TABLE [dbo].[WaitingList]
    ADD [PreferredSlotID] [int] NULL;
    
    PRINT 'Added PreferredSlotID column to WaitingList.';
END
ELSE
BEGIN
    PRINT 'PreferredSlotID column already exists in WaitingList.';
    
END
GO

-- 2. Optional: Add Foreign Key constraint to Slots table
-- IF NOT EXISTS (
--     SELECT * FROM sys.foreign_keys 
--     WHERE object_id = OBJECT_ID(N'[dbo].[FK_WaitingList_Slots]') 
--       AND parent_object_id = OBJECT_ID(N'[dbo].[WaitingList]')
-- )
-- BEGIN
--     ALTER TABLE [dbo].[WaitingList]  WITH CHECK ADD  CONSTRAINT [FK_WaitingList_Slots] FOREIGN KEY([PreferredSlotID])
--     REFERENCES [dbo].[Slots] ([SlotID])
--     ON DELETE SET NULL;

--     ALTER TABLE [dbo].[WaitingList] CHECK CONSTRAINT [FK_WaitingList_Slots];
    
--     PRINT 'Added Foreign Key FK_WaitingList_Slots.';
-- END
-- GO

-- Note: The `Goal` column already exists in WaitingList as per the current schema:
-- [Goal] [varchar](50) NULL
-- Therefore, no migration is needed for the Goal column.
