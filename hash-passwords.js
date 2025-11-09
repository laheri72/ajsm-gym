// File: hash-passwords.js

const sql = require('mssql');
const bcrypt = require('bcrypt');

// IMPORTANT: Fill in your database credentials here
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

const saltRounds = 10; // Standard salt rounds

async function migratePasswords() {
    console.log('Connecting to the database...');
    try {
        await sql.connect(config);
        const request = new sql.Request();

        console.log('Fetching existing users from PassBank...');
        const result = await request.query('SELECT Username, Password FROM PassBank');
        const users = result.recordset;

        if (users.length === 0) {
            console.log('No users found in PassBank. Nothing to do.');
            return;
        }

        console.log(`Found ${users.length} users. Starting hashing process...`);

        for (const user of users) {
            // Check if the password looks like it's already a bcrypt hash
            if (user.Password.startsWith('$2b$')) {
                console.log(`-> Skipping user '${user.Username}' (password already appears to be hashed).`);
                continue;
            }

            console.log(`-> Hashing password for user '${user.Username}'...`);
            const hashedPassword = await bcrypt.hash(user.Password, saltRounds);

            const updateRequest = new sql.Request();
            await updateRequest
                .input('Username', sql.VarChar, user.Username)
                .input('HashedPassword', sql.NVarChar, hashedPassword)
                .query('UPDATE PassBank SET Password = @HashedPassword WHERE Username = @Username');
        }

        console.log('✅ All passwords have been successfully hashed and updated!');

    } catch (err) {
        console.error('❌ An error occurred during password migration:', err);
    } finally {
        await sql.close();
    }
}

migratePasswords();