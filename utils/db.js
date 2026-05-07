// utils/db.js
require('dotenv').config();
const sql = require('mssql');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,               
        trustServerCertificate: true 
    }
};

// Create the pool but don't connect yet
const pool = new sql.ConnectionPool(config);

// Create a function to connect
const connectDB = async () => {
  try {
    await pool.connect();
    console.log('✅ Connected to SQL Server!');
  } catch (err) {
    console.error('❌ Database Connection Failed! Server not started.');
    console.error(err);
    process.exit(1); // Exit the app if DB connection fails
  }
};

// Export the pool and the connect function
module.exports = {
  pool,
  connectDB
};