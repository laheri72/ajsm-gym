// utils/db.js
const sql = require('mssql');

const config = {
    user: 'idris5687',
    password: 'idris5253',
    server: 'fittracker.mssql.somee.com',
    database: 'fittracker',
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