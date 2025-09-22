import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  build: {
    outDir: '../dist',
    rollupOptions: {
      input: {
        // --- Main Site Pages (at root) ---
        main: resolve(__dirname, 'public/index.html'),
        homepage: resolve(__dirname, 'public/homepage.html'),
        blog: resolve(__dirname, 'public/blog.html'),
        forbidden: resolve(__dirname, 'public/Forbidden.html'),
        
        // --- Login Pages (in /logins/) ---
        loginStaff: resolve(__dirname, 'public/logins/staff-login.html'),
        loginStudent: resolve(__dirname, 'public/logins/talabat-login.html'),
        loginTest: resolve(__dirname, 'public/logins/test-login.html'),
        loginTrainer: resolve(__dirname, 'public/logins/trainer-login.html'),
        
        // --- Student Pages (in /student/) ---
        studentDashboard: resolve(__dirname, 'public/student/student-dashboard.html'),
        studentFitnessTest: resolve(__dirname, 'public/student/fitness-test.html'),

        // --- Trainer Pages (in /trainer/) ---
        trainerDashboard: resolve(__dirname, 'public/trainer/trainer-dashboard.html'),
        
        // --- Staff Pages (in /staff/) ---
        staffOverview: resolve(__dirname, 'public/staff/overview.html'),
        staffEntry: resolve(__dirname, 'public/staff/entry.html'),
        staffAdmin: resolve(__dirname, 'public/staff/admin.html'),
        staffRecords: resolve(__dirname, 'public/staff/records.html'),
        staffProgress: resolve(__dirname, 'public/staff/progress.html'),
        staffTest: resolve(__dirname, 'public/staff/test.html'),
        staffAttendance: resolve(__dirname, 'public/staff/attendance.html'),
      },
    },
  },
  server: { // Your dev server proxy
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
    },
  },
});