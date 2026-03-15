USE [master]
GO
/****** Object:  Database [fittracker]    Script Date: 20-02-2026 16:19:20 ******/
CREATE DATABASE [fittracker]
 CONTAINMENT = NONE
 ON  PRIMARY 
( NAME = N'fittracker_Data', FILENAME = N'c:\dzsqls\fittracker.mdf' , SIZE = 8192KB , MAXSIZE = 30720KB , FILEGROWTH = 22528KB )
 LOG ON 
( NAME = N'fittracker_Logs', FILENAME = N'c:\dzsqls\fittracker.ldf' , SIZE = 8192KB , MAXSIZE = 30720KB , FILEGROWTH = 22528KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT
GO
ALTER DATABASE [fittracker] SET COMPATIBILITY_LEVEL = 150
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [fittracker].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [fittracker] SET ANSI_NULL_DEFAULT OFF 
GO
ALTER DATABASE [fittracker] SET ANSI_NULLS OFF 
GO
ALTER DATABASE [fittracker] SET ANSI_PADDING OFF 
GO
ALTER DATABASE [fittracker] SET ANSI_WARNINGS OFF 
GO
ALTER DATABASE [fittracker] SET ARITHABORT OFF 
GO
ALTER DATABASE [fittracker] SET AUTO_CLOSE OFF 
GO
ALTER DATABASE [fittracker] SET AUTO_SHRINK OFF 
GO
ALTER DATABASE [fittracker] SET AUTO_UPDATE_STATISTICS ON 
GO
ALTER DATABASE [fittracker] SET CURSOR_CLOSE_ON_COMMIT OFF 
GO
ALTER DATABASE [fittracker] SET CURSOR_DEFAULT  GLOBAL 
GO
ALTER DATABASE [fittracker] SET CONCAT_NULL_YIELDS_NULL OFF 
GO
ALTER DATABASE [fittracker] SET NUMERIC_ROUNDABORT OFF 
GO
ALTER DATABASE [fittracker] SET QUOTED_IDENTIFIER OFF 
GO
ALTER DATABASE [fittracker] SET RECURSIVE_TRIGGERS OFF 
GO
ALTER DATABASE [fittracker] SET  ENABLE_BROKER 
GO
ALTER DATABASE [fittracker] SET AUTO_UPDATE_STATISTICS_ASYNC OFF 
GO
ALTER DATABASE [fittracker] SET DATE_CORRELATION_OPTIMIZATION OFF 
GO
ALTER DATABASE [fittracker] SET TRUSTWORTHY OFF 
GO
ALTER DATABASE [fittracker] SET ALLOW_SNAPSHOT_ISOLATION OFF 
GO
ALTER DATABASE [fittracker] SET PARAMETERIZATION SIMPLE 
GO
ALTER DATABASE [fittracker] SET READ_COMMITTED_SNAPSHOT OFF 
GO
ALTER DATABASE [fittracker] SET HONOR_BROKER_PRIORITY OFF 
GO
ALTER DATABASE [fittracker] SET RECOVERY SIMPLE 
GO
ALTER DATABASE [fittracker] SET  MULTI_USER 
GO
ALTER DATABASE [fittracker] SET PAGE_VERIFY CHECKSUM  
GO
ALTER DATABASE [fittracker] SET DB_CHAINING OFF 
GO
ALTER DATABASE [fittracker] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF ) 
GO
ALTER DATABASE [fittracker] SET TARGET_RECOVERY_TIME = 60 SECONDS 
GO
ALTER DATABASE [fittracker] SET DELAYED_DURABILITY = DISABLED 
GO
ALTER DATABASE [fittracker] SET ACCELERATED_DATABASE_RECOVERY = OFF  
GO
ALTER DATABASE [fittracker] SET QUERY_STORE = OFF
GO
USE [fittracker]
GO
/****** Object:  User [idris5687]    Script Date: 20-02-2026 16:19:25 ******/
CREATE USER [idris5687] FOR LOGIN [idris5687] WITH DEFAULT_SCHEMA=[dbo]
GO
ALTER ROLE [db_owner] ADD MEMBER [idris5687]
GO
/****** Object:  Schema [idris5687]    Script Date: 20-02-2026 16:19:26 ******/
CREATE SCHEMA [idris5687]
GO
/****** Object:  UserDefinedTableType [dbo].[TestMasterUploadType]    Script Date: 20-02-2026 16:19:26 ******/
CREATE TYPE [dbo].[TestMasterUploadType] AS TABLE(
	[TR] [int] NOT NULL,
	[ITS] [bigint] NOT NULL,
	[Name] [nvarchar](100) NOT NULL,
	[Darajah] [nvarchar](50) NOT NULL,
	PRIMARY KEY CLUSTERED 
(
	[ITS] ASC
)WITH (IGNORE_DUP_KEY = OFF)
)
GO
/****** Object:  Table [dbo].[Achievements]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Achievements](
	[AchievementID] [int] IDENTITY(1,1) NOT NULL,
	[AchievementName] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](255) NOT NULL,
	[BadgeImageURL] [nvarchar](255) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[AchievementID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Attendance]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Attendance](
	[AttendanceID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[WeekID] [int] NOT NULL,
	[IsPresent] [bit] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[OnLeave] [bit] NOT NULL,
	[OutTime] [datetime] NULL,
	[DurationInMinutes] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[AttendanceID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[AttendanceWeek]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[AttendanceWeek](
	[WeekID] [int] IDENTITY(1,1) NOT NULL,
	[WeekStartDate] [date] NULL,
	[WeekEndDate] [date] NULL,
PRIMARY KEY CLUSTERED 
(
	[WeekID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_WeekStart_End] UNIQUE NONCLUSTERED 
(
	[WeekStartDate] ASC,
	[WeekEndDate] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[BodyParts]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[BodyParts](
	[BodyPartID] [int] IDENTITY(1,1) NOT NULL,
	[Name] [varchar](25) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[BodyPartID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_BodyParts_Name] UNIQUE NONCLUSTERED 
(
	[Name] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CommentCategories]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CommentCategories](
	[CategoryID] [int] IDENTITY(1,1) NOT NULL,
	[CategoryName] [nvarchar](100) NOT NULL,
	[Description] [nvarchar](255) NULL,
PRIMARY KEY CLUSTERED 
(
	[CategoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[EvaluationBatches]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[EvaluationBatches](
	[BatchID] [int] IDENTITY(1,1) NOT NULL,
	[BatchName] [nvarchar](100) NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[IsActive] [bit] NOT NULL,
	[CreatedAt] [datetime] NULL,
	[CreatedBy] [varchar](50) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[BatchID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Evaluations]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Evaluations](
	[EvaluationID] [int] IDENTITY(1,1) NOT NULL,
	[LogID] [int] NOT NULL,
	[EvaluatorID] [int] NOT NULL,
	[CategoryID] [int] NOT NULL,
	[CommentText] [nvarchar](max) NULL,
	[DateEvaluated] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[EvaluationID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Evaluators]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Evaluators](
	[EvaluatorID] [int] IDENTITY(1,1) NOT NULL,
	[UserID] [int] NULL,
	[Name] [nvarchar](100) NULL,
	[Profession] [nvarchar](100) NULL,
	[Contact] [nvarchar](100) NULL,
	[Email] [nvarchar](100) NULL,
PRIMARY KEY CLUSTERED 
(
	[EvaluatorID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[LeaveRequests]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[LeaveRequests](
	[LeaveID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[LeaveStartDate] [date] NOT NULL,
	[LeaveEndDate] [date] NOT NULL,
	[Reason] [nvarchar](500) NOT NULL,
	[Status] [varchar](10) NOT NULL,
	[RequestedAt] [datetime] NOT NULL,
	[ReviewedBy] [varchar](50) NULL,
	[ReviewedAt] [datetime] NULL,
	[Remarks] [nvarchar](500) NULL,
PRIMARY KEY CLUSTERED 
(
	[LeaveID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[MedicalHistory]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[MedicalHistory](
	[HistoryID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[Allergies] [nvarchar](max) NULL,
	[Medications] [nvarchar](max) NULL,
	[FamilyHistory] [nvarchar](max) NULL,
	[PreviousInjuries] [nvarchar](max) NULL,
PRIMARY KEY CLUSTERED 
(
	[HistoryID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_MedicalHistory_TR] UNIQUE NONCLUSTERED 
(
	[TR] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PassBank]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PassBank](
	[Username] [varchar](50) NOT NULL,
	[Password] [nvarchar](100) NOT NULL,
	[Role] [varchar](9) NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[IsDefaultPassword] [bit] NOT NULL,
	[UserID] [int] IDENTITY(1,1) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[Username] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_UserID] UNIQUE NONCLUSTERED 
(
	[UserID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Slots]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Slots](
	[SlotID] [int] IDENTITY(1,1) NOT NULL,
	[SlotName] [nvarchar](25) NOT NULL,
	[MaxCapacity] [int] NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[IsActive] [bit] NULL,
PRIMARY KEY CLUSTERED 
(
	[SlotID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[StudentAchievements]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[StudentAchievements](
	[StudentAchievementID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[AchievementID] [int] NOT NULL,
	[DateEarned] [datetime] NOT NULL,
	[Context] [nvarchar](50) NULL,
PRIMARY KEY CLUSTERED 
(
	[StudentAchievementID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TestActivityLog]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TestActivityLog](
	[ActivityLogID] [int] IDENTITY(1,1) NOT NULL,
	[TestLog] [int] NOT NULL,
	[PushUps] [smallint] NULL,
	[SitUps] [smallint] NULL,
	[Squats] [smallint] NULL,
	[SitAndReach] [smallint] NULL,
	[StepUpPulseRate] [smallint] NULL,
PRIMARY KEY CLUSTERED 
(
	[ActivityLogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TestMaster]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TestMaster](
	[TR] [int] NOT NULL,
	[ITS] [int] NOT NULL,
	[Darajah] [varchar](15) NULL,
	[Name] [nvarchar](100) NULL,
	[DOB] [date] NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[Password] [nvarchar](100) NULL,
	[FitnessLevel] [int] NOT NULL,
	[CurrentXP] [int] NOT NULL,
	[Status] [varchar](8) NULL,
	[SlotID] [int] NULL,
	[JoinedAt] [datetime] NULL,
	[BestStreak] [int] NOT NULL,
	[TotalMinutesLogged] [int] NOT NULL,
	[Goal] [varchar](50) NULL,
	[Height] [decimal](5, 2) NULL,
	[HasLoggedInBefore] [bit] NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[TR] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_TestMaster_ITS] UNIQUE NONCLUSTERED 
(
	[ITS] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TestRecords]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TestRecords](
	[TestLog] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NULL,
	[Weight] [float] NOT NULL,
	[Height] [float] NOT NULL,
	[Waist] [float] NOT NULL,
	[Hips] [float] NOT NULL,
	[Neck] [float] NOT NULL,
	[BMI] [float] NOT NULL,
	[BMIStatus] [varchar](20) NOT NULL,
	[BodyFat] [float] NOT NULL,
	[BMR] [float] NOT NULL,
	[CalorieIntake] [float] NOT NULL,
	[VO2Max] [float] NOT NULL,
	[Total] [float] NOT NULL,
	[Grade] [nvarchar](2) NOT NULL,
	[CreatedAt] [datetime] NULL,
	[SubmittedBy] [varchar](7) NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
	[BatchID] [int] NULL,
	[TrainerID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[TestLog] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[Trainers]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Trainers](
	[TrainerID] [int] IDENTITY(1,1) NOT NULL,
	[UserID] [int] NULL,
	[Name] [varchar](50) NULL,
	[Profession] [varchar](30) NULL,
	[Contact] [nvarchar](30) NULL,
	[Email] [nvarchar](40) NULL,
PRIMARY KEY CLUSTERED 
(
	[TrainerID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TrainingLog]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TrainingLog](
	[LogID] [int] IDENTITY(1,1) NOT NULL,
	[PlanID] [int] NULL,
	[BodyPartID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[LogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[TrainingPlan]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[TrainingPlan](
	[PlanID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[CreatedAt] [datetime] NOT NULL,
	[Branch] [varchar](7) NOT NULL,
	[Gender] [varchar](6) NOT NULL,
PRIMARY KEY CLUSTERED 
(
	[PlanID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WaitingList]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WaitingList](
	[WaitingID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[Name] [nvarchar](100) NULL,
	[Darajah] [varchar](15) NULL,
	[Goal] [varchar](50) NULL,
	[Branch] [varchar](7) NULL,
	[Gender] [varchar](6) NULL,
	[RequestedAt] [datetime] NULL,
	[SlotID] [int] NULL,
	[PreferredSlotID] [int] NULL,
PRIMARY KEY CLUSTERED 
(
	[WaitingID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
 CONSTRAINT [UQ_WaitingList_TR] UNIQUE NONCLUSTERED 
(
	[TR] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WeightTracking]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WeightTracking](
	[LogID] [int] IDENTITY(1,1) NOT NULL,
	[TR] [int] NOT NULL,
	[Weight] [decimal](5, 2) NOT NULL,
	[CreatedAt] [datetime] NULL,
PRIMARY KEY CLUSTERED 
(
	[LogID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[WorkoutPlan]    Script Date: 20-02-2026 16:19:26 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[WorkoutPlan](
	[TR] [int] NULL,
	[Day] [varchar](20) NULL,
	[Content] [nvarchar](max) NULL,
	[Branch] [varchar](7) NULL,
	[Gender] [varchar](6) NULL,
	[WeekID] [int] NULL
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Index [IX_TestRecords_BatchID]    Script Date: 20-02-2026 16:19:26 ******/
CREATE NONCLUSTERED INDEX [IX_TestRecords_BatchID] ON [dbo].[TestRecords]
(
	[BatchID] ASC
)
WHERE ([BatchID] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO
ALTER TABLE [dbo].[Attendance] ADD  CONSTRAINT [DF_Attendance_Branch]  DEFAULT ('Marol') FOR [Branch]
GO
ALTER TABLE [dbo].[Attendance] ADD  CONSTRAINT [DF_Attendance_Gender]  DEFAULT ('Male') FOR [Gender]
GO
ALTER TABLE [dbo].[Attendance] ADD  DEFAULT ((0)) FOR [OnLeave]
GO
ALTER TABLE [dbo].[EvaluationBatches] ADD  DEFAULT ((0)) FOR [IsActive]
GO
ALTER TABLE [dbo].[EvaluationBatches] ADD  DEFAULT (getutcdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Evaluations] ADD  DEFAULT (getdate()) FOR [DateEvaluated]
GO
ALTER TABLE [dbo].[LeaveRequests] ADD  CONSTRAINT [DF_LeaveRequests_Status]  DEFAULT ('Pending') FOR [Status]
GO
ALTER TABLE [dbo].[LeaveRequests] ADD  DEFAULT (getutcdate()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[PassBank] ADD  CONSTRAINT [DF_PassBank_Role]  DEFAULT ('Staff') FOR [Role]
GO
ALTER TABLE [dbo].[PassBank] ADD  CONSTRAINT [DF_PassBank_Branch]  DEFAULT ('Marol') FOR [Branch]
GO
ALTER TABLE [dbo].[PassBank] ADD  CONSTRAINT [DF_PassBank_Gender]  DEFAULT ('Male') FOR [Gender]
GO
ALTER TABLE [dbo].[PassBank] ADD  DEFAULT ((1)) FOR [IsDefaultPassword]
GO
ALTER TABLE [dbo].[Slots] ADD  DEFAULT ((1)) FOR [IsActive]
GO
ALTER TABLE [dbo].[StudentAchievements] ADD  DEFAULT (getutcdate()) FOR [DateEarned]
GO
ALTER TABLE [dbo].[TestMaster] ADD  CONSTRAINT [DF_TestMaster_Branch]  DEFAULT ('Marol') FOR [Branch]
GO
ALTER TABLE [dbo].[TestMaster] ADD  CONSTRAINT [DF_TestMaster_Gender]  DEFAULT ('Male') FOR [Gender]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ((1)) FOR [FitnessLevel]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ((0)) FOR [CurrentXP]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ('Active') FOR [Status]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT (getdate()) FOR [JoinedAt]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ((0)) FOR [BestStreak]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ((0)) FOR [TotalMinutesLogged]
GO
ALTER TABLE [dbo].[TestMaster] ADD  DEFAULT ((0)) FOR [HasLoggedInBefore]
GO
ALTER TABLE [dbo].[TestRecords] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[TestRecords] ADD  CONSTRAINT [DF_TestRecords_SubmittedBy]  DEFAULT ('Student') FOR [SubmittedBy]
GO
ALTER TABLE [dbo].[TestRecords] ADD  CONSTRAINT [DF_TestRecords_Branch]  DEFAULT ('Marol') FOR [Branch]
GO
ALTER TABLE [dbo].[TestRecords] ADD  CONSTRAINT [DF_TestRecords_Gender]  DEFAULT ('Male') FOR [Gender]
GO
ALTER TABLE [dbo].[TrainingPlan] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[WaitingList] ADD  DEFAULT (getdate()) FOR [RequestedAt]
GO
ALTER TABLE [dbo].[WeightTracking] ADD  DEFAULT (getdate()) FOR [CreatedAt]
GO
ALTER TABLE [dbo].[Attendance]  WITH CHECK ADD  CONSTRAINT [FK_Attendance_AttendanceWeek] FOREIGN KEY([WeekID])
REFERENCES [dbo].[AttendanceWeek] ([WeekID])
GO
ALTER TABLE [dbo].[Attendance] CHECK CONSTRAINT [FK_Attendance_AttendanceWeek]
GO
ALTER TABLE [dbo].[Attendance]  WITH CHECK ADD  CONSTRAINT [FK_Attendance_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[Attendance] CHECK CONSTRAINT [FK_Attendance_TestMaster]
GO
ALTER TABLE [dbo].[Evaluations]  WITH CHECK ADD FOREIGN KEY([CategoryID])
REFERENCES [dbo].[CommentCategories] ([CategoryID])
GO
ALTER TABLE [dbo].[Evaluations]  WITH CHECK ADD FOREIGN KEY([EvaluatorID])
REFERENCES [dbo].[Evaluators] ([EvaluatorID])
GO
ALTER TABLE [dbo].[Evaluations]  WITH CHECK ADD FOREIGN KEY([LogID])
REFERENCES [dbo].[TestRecords] ([TestLog])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[Evaluators]  WITH CHECK ADD  CONSTRAINT [FK_Evaluators_UserID_PassBank_UserID] FOREIGN KEY([UserID])
REFERENCES [dbo].[PassBank] ([UserID])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[Evaluators] CHECK CONSTRAINT [FK_Evaluators_UserID_PassBank_UserID]
GO
ALTER TABLE [dbo].[LeaveRequests]  WITH CHECK ADD  CONSTRAINT [FK_LeaveRequests_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[LeaveRequests] CHECK CONSTRAINT [FK_LeaveRequests_TestMaster]
GO
ALTER TABLE [dbo].[MedicalHistory]  WITH CHECK ADD  CONSTRAINT [FK_MedicalHistory_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[MedicalHistory] CHECK CONSTRAINT [FK_MedicalHistory_TestMaster]
GO
ALTER TABLE [dbo].[StudentAchievements]  WITH CHECK ADD  CONSTRAINT [FK_StudentAchievements_Achievements] FOREIGN KEY([AchievementID])
REFERENCES [dbo].[Achievements] ([AchievementID])
GO
ALTER TABLE [dbo].[StudentAchievements] CHECK CONSTRAINT [FK_StudentAchievements_Achievements]
GO
ALTER TABLE [dbo].[StudentAchievements]  WITH CHECK ADD  CONSTRAINT [FK_StudentAchievements_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[StudentAchievements] CHECK CONSTRAINT [FK_StudentAchievements_TestMaster]
GO
ALTER TABLE [dbo].[TestActivityLog]  WITH CHECK ADD  CONSTRAINT [FK_TestActivityLog_TestRecords] FOREIGN KEY([TestLog])
REFERENCES [dbo].[TestRecords] ([TestLog])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[TestActivityLog] CHECK CONSTRAINT [FK_TestActivityLog_TestRecords]
GO
ALTER TABLE [dbo].[TestRecords]  WITH CHECK ADD FOREIGN KEY([BatchID])
REFERENCES [dbo].[EvaluationBatches] ([BatchID])
GO
ALTER TABLE [dbo].[TestRecords]  WITH CHECK ADD FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[TestRecords]  WITH CHECK ADD  CONSTRAINT [FK_TestRecords_Trainers] FOREIGN KEY([TrainerID])
REFERENCES [dbo].[Trainers] ([TrainerID])
GO
ALTER TABLE [dbo].[TestRecords] CHECK CONSTRAINT [FK_TestRecords_Trainers]
GO
ALTER TABLE [dbo].[Trainers]  WITH CHECK ADD  CONSTRAINT [FK_Trainers_PassBank] FOREIGN KEY([UserID])
REFERENCES [dbo].[PassBank] ([UserID])
ON DELETE SET NULL
GO
ALTER TABLE [dbo].[Trainers] CHECK CONSTRAINT [FK_Trainers_PassBank]
GO
ALTER TABLE [dbo].[TrainingLog]  WITH CHECK ADD FOREIGN KEY([BodyPartID])
REFERENCES [dbo].[BodyParts] ([BodyPartID])
GO
ALTER TABLE [dbo].[TrainingLog]  WITH CHECK ADD  CONSTRAINT [FK_TrainingLog_TrainingPlan] FOREIGN KEY([PlanID])
REFERENCES [dbo].[TrainingPlan] ([PlanID])
ON DELETE CASCADE
GO
ALTER TABLE [dbo].[TrainingLog] CHECK CONSTRAINT [FK_TrainingLog_TrainingPlan]
GO
ALTER TABLE [dbo].[TrainingPlan]  WITH CHECK ADD  CONSTRAINT [FK_TrainingPlan_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[TrainingPlan] CHECK CONSTRAINT [FK_TrainingPlan_TestMaster]
GO
ALTER TABLE [dbo].[WeightTracking]  WITH CHECK ADD  CONSTRAINT [FK_WeightTracking_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[WeightTracking] CHECK CONSTRAINT [FK_WeightTracking_TestMaster]
GO
ALTER TABLE [dbo].[WorkoutPlan]  WITH CHECK ADD  CONSTRAINT [FK_WorkoutPlan_AttendanceWeek] FOREIGN KEY([WeekID])
REFERENCES [dbo].[AttendanceWeek] ([WeekID])
GO
ALTER TABLE [dbo].[WorkoutPlan] CHECK CONSTRAINT [FK_WorkoutPlan_AttendanceWeek]
GO
ALTER TABLE [dbo].[WorkoutPlan]  WITH CHECK ADD  CONSTRAINT [FK_WorkoutPlan_TestMaster] FOREIGN KEY([TR])
REFERENCES [dbo].[TestMaster] ([TR])
GO
ALTER TABLE [dbo].[WorkoutPlan] CHECK CONSTRAINT [FK_WorkoutPlan_TestMaster]
GO
ALTER TABLE [dbo].[TestRecords]  WITH CHECK ADD  CONSTRAINT [CK_SubmittedBy_ValidValue] CHECK  (([SubmittedBy]='Trainer' OR [SubmittedBy]='Student'))
GO
ALTER TABLE [dbo].[TestRecords] CHECK CONSTRAINT [CK_SubmittedBy_ValidValue]
GO
USE [master]
GO
ALTER DATABASE [fittracker] SET  READ_WRITE 
GO
