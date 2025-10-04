import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'; // <-- ADD THIS LINE

export default defineConfig({
  root: 'public',
  plugins: [ // <-- ADD THIS PLUGINS SECTION
    viteStaticCopy({
      targets: [
        {
          src: 'images', // Source is relative to your 'root'
          dest: ''       // Destination is relative to 'outDir' (dist)
        },
        {
          src: 'gifs',
          dest: ''
        }
      ]
    })
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // ... your existing input configuration remains the same ...
        main: resolve(__dirname, 'public/index.html'),
        homepage: resolve(__dirname, 'public/homepage.html'),
        blog: resolve(__dirname, 'public/blog.html'),
        forbidden: resolve(__dirname, 'public/Forbidden.html'),
        loginStaff: resolve(__dirname, 'public/logins/staff-login.html'),
        loginStudent: resolve(__dirname, 'public/logins/talabat-login.html'),
        loginTest: resolve(__dirname, 'public/logins/test-login.html'),
        loginTrainer: resolve(__dirname, 'public/logins/trainer-login.html'),
        studentDashboard: resolve(__dirname, 'public/student/student-dashboard.html'),
        studentFitnessTest: resolve(__dirname, 'public/student/fitness-test.html'),
        trainerDashboard: resolve(__dirname, 'public/trainer/trainer-dashboard.html'),
        staffOverview: resolve(__dirname, 'public/staff/overview.html'),
        staffEntry: resolve(__dirname, 'public/staff/entry.html'),
        staffAdmin: resolve(__dirname, 'public/staff/admin.html'),
        staffRecords: resolve(__dirname, 'public/staff/records.html'),
        staffProgress: resolve(__dirname, 'public/staff/progress.html'),
        staffTest: resolve(__dirname, 'public/staff/test.html'),
        staffAttendance: resolve(__dirname, 'public/staff/attendance.html'),
        staffLeaves: resolve(__dirname, 'public/staff/leaves.html'),
        staffProfile: resolve(__dirname, 'public/staff/profile.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
    },
  },
});