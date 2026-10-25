// Import required modules
require('dotenv').config();

const express = require('express');
const bcrypt = require('bcrypt');
const sql = require('mssql');
const router = express.Router();
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const session = require("express-session");
const MSSQLStore = require('connect-mssql')(session);
const app = express();
const moment = require('moment-timezone');
const { pool, connectDB } = require('./utils/db.js');
const adminRoutes = require('./routes/admin.js');
const authRoutes = require('./routes/auth.js');
const fitnessTestRoutes = require('./routes/fitnessTest.js');
const fitnessProfileRoutes = require('./routes/fitnessProfiles.js');
const studentRoutes = require('./routes/stu-routes.js');
const staffRoutes = require('./routes/staff.js');
const gamificationRoutes = require('./routes/gamification.js');
const { cache } = require('./utils/cache.js');
const { requireStudentPasswordChange, requireGymMembership } = require('./middleware/studentAccess.js');
const { requireStaffPasswordChange } = require('./middleware/staffPasswordChange.js');

const port = Number(process.env.PORT) || 10000;

app.set('trust proxy', 1);

// Middleware
// Fix: ALLOWED_ORIGIN env var lets local dev work without code changes
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://ajsm-gym.onrender.com',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────────
// SEO: Explicit content-type for sitemap.xml and robots.txt so they
// are never served as text/html regardless of static-file middleware.
// ─────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const file = path.join(__dirname, 'dist', 'sitemap.xml');
  if (fs.existsSync(file)) {
    res.type('application/xml').sendFile(file);
  } else {
    res.status(404).send('sitemap.xml not found — rebuild required');
  }
});

app.get('/robots.txt', (req, res) => {
  const file = path.join(__dirname, 'dist', 'robots.txt');
  if (fs.existsSync(file)) {
    res.type('text/plain').sendFile(file);
  } else {
    res.status(404).send('robots.txt not found — rebuild required');
  }
});

// ─────────────────────────────────────────────────────────────────
// SEO: 301 redirects for duplicate/alias public URLs.
// Must appear BEFORE express.static so redirects fire first.
// Preserves query strings; does NOT touch POSTs, APIs, or dashboards.
// ─────────────────────────────────────────────────────────────────
function seoRedirect(from, to) {
  app.get(from, (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, to + qs);
  });
}

// Homepage aliases → /
seoRedirect('/index',        '/');
seoRedirect('/index.html',   '/');
seoRedirect('/homepage',     '/');
seoRedirect('/homepage.html','/' );

// Blog alias
seoRedirect('/blog.html', '/blog');

// Legal page aliases
seoRedirect('/privacy.html', '/privacy');
seoRedirect('/terms.html',   '/terms');

// Login extensionless → canonical .html
seoRedirect('/logins/talabat-login', '/logins/talabat-login.html');
seoRedirect('/logins/staff-login',   '/logins/staff-login.html');
seoRedirect('/logins/trainer-login', '/logins/trainer-login.html');

// ─────────────────────────────────────────────────────────────────
// SEO: X-Robots-Tag: noindex for dashboard/app shell paths.
// Covers both .html and extensionless variants.
// Does NOT affect public pages, logins, blog, privacy, terms, or APIs.
// IMPORTANT: noindex is NOT access control; auth middleware is preserved below.
// ─────────────────────────────────────────────────────────────────
const NOINDEX_PREFIXES = [
  '/student/',
  '/staff/',
  '/trainer/',
  '/fitness/',
];

app.use((req, res, next) => {
  const p = req.path;
  if (NOINDEX_PREFIXES.some(prefix => p.startsWith(prefix))) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// ─────────────────────────────────────────────────────────────────
// Static file serving (dist directory built by Vite)
// ─────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));

app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ commit: process.env.RENDER_GIT_COMMIT || null });
});

// Fix: Replaced MemoryStore with connect-mssql so sessions survive Render deployments/restarts
const sessionStoreConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

app.use(session({
  secret: process.env.SESSION_SECRET,
  name: 'ajsm.sid',
  resave: false,
  saveUninitialized: false,
  store: new MSSQLStore(sessionStoreConfig),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 2 // 2 hours
  }
}));


app.use((req, res, next) => {
  // Default: No caching for security (login, sensitive APIs)
  res.set("Cache-Control", "no-store");
  next();
});

app.use('/api', requireStudentPasswordChange);
app.use('/api', requireStaffPasswordChange);
app.use('/api', requireGymMembership(pool, sql));


app.use(adminRoutes);
app.use(authRoutes);
app.use(fitnessTestRoutes);
app.use(fitnessProfileRoutes);
app.use(studentRoutes);
app.use(staffRoutes);
app.use(gamificationRoutes);



//------------------------------------------------------------------------------------------------

// code for install anything via terminal 
// Set-ExecutionPolicy RemoteSigned -Scope CurrentUser


// This catch-all route MUST be at the end, after all API routes.
app.get('*', (req, res) => {
    // Construct the potential path to a file or directory on the server
    const resourcePath = path.join(__dirname, 'dist', req.path);

    // 1. Check if the requested path is a directory
    if (fs.existsSync(resourcePath) && fs.lstatSync(resourcePath).isDirectory()) {
        // If it is a directory, send a 403 Forbidden error.
        return res.status(403).send('Forbidden: Access to this directory is not allowed.');
    }

    // 2. Check if a corresponding .html file exists for the path
    const filePath = resourcePath + '.html';
    if (fs.existsSync(filePath)) {
        // If the HTML file exists, send it.
        return res.sendFile(filePath);
    }
    
    // 3. If it's neither a directory nor a file, send a 404 Not Found error.
    res.status(404).sendFile(path.join(__dirname, 'dist/Forbidden.html')); // Custom 404 page
});

// Catch-all safe global error middleware
app.use((err, req, res, next) => {
  console.error('SERVER LOG ERROR:', {
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? 'Cleaned' : err.stack
  });

  res.status(err.status || 500).json({
    success: false,
    message: err.status ? err.message : 'An unexpected backend error occurred.'
  });
});




connectDB().then(() => {
        app.listen(port, '0.0.0.0', () => {
            // console.log('✅ Connected to SQL Server!')
            // console.log(`🚀 Server is running on http://localhost:${port}`)
        });
    })
    .catch(err => {
        console.error('❌ Database Connection Failed! Server not started.');
        console.error(err);
    });
