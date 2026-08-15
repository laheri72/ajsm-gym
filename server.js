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
const app = express();
const moment = require('moment-timezone');
const { pool, connectDB } = require('./utils/db.js');
const adminRoutes = require('./routes/admin.js');
const authRoutes = require('./routes/auth.js');
const fitnessTestRoutes = require('./routes/fitnessTest.js');
const studentRoutes = require('./routes/stu-routes.js');
const staffRoutes = require('./routes/staff.js');
const gamificationRoutes = require('./routes/gamification.js');
const { cache } = require('./utils/cache.js');



// Set up the port
const port = 10000;

app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: 'https://ajsm-gym.onrender.com',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use(session({
  secret: process.env.SESSION_SECRET,  
  name: 'ajsm.sid',
  resave: false,
  saveUninitialized: false,
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


app.use(adminRoutes);
app.use(authRoutes);
app.use(fitnessTestRoutes);
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
    res.status(404).sendFile(path.join(__dirname, 'dist/Forbidden.html')); // Or a custom 404 page
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
            // console.log('✅ Connected to SQL Server!');
            // console.log(`🚀 Server is running on http://localhost:${port}`);
        });
    })
    .catch(err => {
        console.error('❌ Database Connection Failed! Server not started.');
        console.error(err);
    });
