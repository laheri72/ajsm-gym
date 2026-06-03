import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy'; 

export default defineConfig({
  base: './',

  root: 'public',
  plugins: [ 
    viteStaticCopy({
      targets: [
        { src: 'images', dest: '' },
        { src: 'gifs', dest: '' },
        { src: 'assets', dest: '' }
      ]
    })
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    cssMinify: false,
    rollupOptions: {
            external: [
        '/assets/js/jquery.min.js',
        '/assets/js/bootstrap.bundle.min.js',
        '/assets/js/sweetalert2.all.min.js',
        '/assets/js/chart.min.js',
        '/assets/js/dataTables.min.js',
      ],
      input: {
        main: resolve(__dirname, 'public/index.html'),
        homepage: resolve(__dirname, 'public/homepage.html'),
        blog: resolve(__dirname, 'public/blog.html'),
        forbidden: resolve(__dirname, 'public/Forbidden.html'),
        loginStaff: resolve(__dirname, 'public/logins/staff-login.html'),
        loginStudent: resolve(__dirname, 'public/logins/talabat-login.html'),
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
        staffFitnessAttendance: resolve(__dirname, 'public/staff/fitness-attendance.html'),
        staffLeaves: resolve(__dirname, 'public/staff/leaves.html'),
        staffProfile: resolve(__dirname, 'public/staff/profile.html'),
        staffEvaluation: resolve(__dirname, 'public/staff/evaluation.html'),
        staffCommentEntry: resolve(__dirname, 'public/staff/comment-entry.html'),
        staffeveluationlogs: resolve(__dirname, 'public/staff/evaluation-log.html'),
        privacy: resolve(__dirname, 'public/privacy.html'),
        terms: resolve(__dirname, 'public/terms.html'),
        
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
