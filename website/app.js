const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const fileUpload = require('express-fileupload'); // Optional file upload middleware
const path = require('path');
require('dotenv').config();

const app = express();

// MongoDB connection (default localhost, using "marketdb")
mongoose.connect('mongodb://localhost:27017/marketdb')
    .then(() => console.log('MongoDB connected to marketdb'))
    .catch(err => console.log(err));

// EJS as templating engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing JSON data

// Static files (e.g., CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// File upload middleware (optional, if needed for later)
app.use(fileUpload());

// Session middleware with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET, // Loaded from the .env file
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/marketdb' }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 60 // 60 days
    }
}));


app.use('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

// 404 handler (Page not found)
app.use((req, res, next) => {
    res.status(404).render('404', { title: '404: Not Found' });
});

// 500 handler (Internal server error)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('500', { title: '500: Server Error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});