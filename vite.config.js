import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // Sets the project root to your 'public' folder, where your HTML files are.
  root: 'public',
  
    server: {
    proxy: {
      // Any request starting with /api will be forwarded to your Node.js server
      '/api': {
        target: 'http://localhost:10000', // Your Node.js server's address
        changeOrigin: true,
      },
    },
  },
  
  build: {
    // Specifies that the final, optimized build files will be placed in a 'dist' folder
    // at the main project level (outside of 'public').
    outDir: '../dist',
    
    // Configures the multi-page setup by defining every HTML file as an entry point.
    rollupOptions: {
      input: {
        // --- Main Site Pages ---
        main: resolve(__dirname, 'public/index.html'),
        homepage: resolve(__dirname, 'public/homepage.html'),
        blog: resolve(__dirname, 'public/blog.html'),
        forbidden: resolve(__dirname, 'public/Forbidden.html'),
        
        // --- Login Pages ---
        staffLogin: resolve(__dirname, 'public/staff-login.html'),
        studentLogin: resolve(__dirname, 'public/talabat-login.html'), // Assuming 'talabat' is the student login
        testLogin: resolve(__dirname, 'public/test-login.html'),
        trainerLogin: resolve(__dirname, 'public/trainer-login.html'),
        
        // --- Dashboard Pages ---
        studentDashboard: resolve(__dirname, 'public/student-dashboard.html'),
        studentFitnessTest: resolve(__dirname, 'public/fitness-test.html'),
        trainerDashboard: resolve(__dirname, 'public/trainer-dashboard.html'),
        
        // --- Staff Dashboard Pages (inside the 'staff' folder) ---
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
});