
# 🏋️‍♂️ GMY (Gym Management System)

> A project by **Raudat ul Ikhwaan**,  
> under the University of **Al Jamea Tus Saifiyah**, Marol Campus.
### 🔹 Developed by
  - Mulla Idris Bh Laheri
     - Mulla Abizer Bh Dewas

---

## 📋 Project Description

GMY is a lightweight web app designed to **manage students' and staff's gym attendance**, track **weekly progress**, and highlight **student goals**.  
It ensures a smooth workflow for both students and staff to monitor performance easily.

---

## 🛠 Built With
- **Backend**: Node.js + Express + SQL Server
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Database**: SQL Server (`Master`, `Attendance`, `AttendanceWeek` tables)

---

## ✨ Features

### 🔹 Student Dashboard
- Login using **TR number**.
- View **Name, Slot, Darajah, Goal**.
- **Weekly attendance** shown from **Monday to Sunday**.
- Select **Week** dynamically from dropdown.

### 🔹 Staff Dashboard
- View **all students' weekly attendance**.
- Filter attendance by **Week**.
- Identify students with **low attendance**.
- **Delete inactive** students if required.

### 🔹 Dynamic Week Management
- Weeks are fetched **dynamically** from the `AttendanceWeek` table.
- No need to manually add dropdown options.

---

## 🗂️ Database Structure

**Master Table**
| Field | Type | Description |
|:---|:---|:---|
| TR | Int (PK) | Unique ID for student |
| Name | Varchar | Full name |
| Slot | Varchar | Assigned time slot |
| Darajah | Varchar | Student's level |
| Goal | Varchar | Main goal for joining |

**Attendance Table**
| Field | Type | Description |
|:---|:---|:---|
| AttendanceID | Int (PK) | Unique ID |
| TR | Int (FK) | Linked student |
| WeekID | Int (FK) | Linked week |
| IsPresent | Bit | 1 = Present, 0 = Absent |
| CreatedAt | Datetime | Date of attendance |

**AttendanceWeek Table**
| Field | Type | Description |
|:---|:---|:---|
| WeekID | Int (PK) | Unique week ID |
| StartDate | Date | Start of the week |
| EndDate | Date | End of the week |

---

## 🔌 APIs Used

| Method | Endpoint | Purpose |
|:---|:---|:---|
| `GET` | `/api/student-info/:tr` | Fetch student profile |
| `GET` | `/api/student-attendance/:weekId/:tr` | Fetch student weekly attendance |
| `GET` | `/api/weekly-attendance/:weekId` | Fetch all students' attendance |
| `GET` | `/api/weeks` | Fetch all available weeks |
| `POST` | `/api/login` | Login student |
| `DELETE` | `/api/delete-student/:tr` | Remove a student |

---

## 🌟 How It Works
1. Students/staff login.
2. Weeks are **auto-fetched** from database (`AttendanceWeek`).
3. Attendance shows ✅ (Present) or **Absent** for each day.
4. No manual editing needed for new weeks.
5. Staff can maintain the gym database easily!

---

## 📄 Frontend Pages

- **student-dashboard.html** → Student portal
- **staff-dashboard.html** → Staff portal
- **talabat-login.html** → Student login page

---

## 🔒 Security Measures
- Students must **log in** to view dashboard.
- **LocalStorage** handles simple login sessions.
- Unauthorized users are **redirected** to login page.

---

# 🏆 Acknowledgements

This project is proudly developed by  
**Raudat ul Ikhwaan** students,  
**University of Al Jamea Tus Saifiyah**, **Marol Campus**.

---

# 🙌 Thank You!

We hope GMY becomes a helpful system to manage your gym students' progress and attendance effectively!  
**May Allah (SWT) grant success to all efforts made in His path.**

---


