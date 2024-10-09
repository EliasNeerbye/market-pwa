const mongoose = require('mongoose');
const readline = require('readline');
const bcrypt = require('bcryptjs');
const User = require('./models/user'); // Adjust the path if necessary

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/marketdb').then(() => {
    console.log("Connected to MongoDB");
}).catch(err => {
    console.error("MongoDB connection error:", err);
});

// Function to generate a random password
const generatePassword = (length) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return password;
};

// Setup readline to get user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Prompt for user details
rl.question('Enter username: ', (username) => {
    rl.question('Enter email: ', (email) => {
        const password = generatePassword(8); // Generate a random password
        const hashedPassword = bcrypt.hashSync(password, 10); // Hash the password

        const newUser = new User({ username, email, password: hashedPassword });

        // Save the new user to the database
        newUser.save()
            .then(() => {
                console.log(`User created successfully:`);
                console.log(`Username: ${username}`);
                console.log(`Password: ${password}`);
                rl.close();
                mongoose.connection.close(); // Close the connection
            })
            .catch(err => {
                console.error("Error creating user:", err);
                rl.close();
                mongoose.connection.close(); // Close the connection
            });
    });
});
