const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const fileUpload = require('express-fileupload'); // Optional file upload middleware
const path = require('path');
require('dotenv').config();
const favicon = require('serve-favicon');

const app = express();

// MongoDB connection using environment variable
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected to marketdb'))
    .catch(err => console.log(err));

// EJS as templating engine
app.set('view engine', 'ejs');

// Middleware
app.use(express.urlencoded({ extended: true })); // For parsing form data
app.use(express.json()); // For parsing JSON data
app.use(favicon(path.join(__dirname, 'public', 'assets/favicon.ico')));

// Static files (e.g., CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// File upload middleware (optional, if needed for later)
app.use(fileUpload());

// Session middleware with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET, // Loaded from the .env file
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }), // Use the same URI for session store
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 60 // 60 days
    }
}));

const User = require('./models/user');
const Product = require('./models/product');
const SalesLog = require('./models/saleslog');
const Tag = require('./models/tag');

app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('index', { title: 'Home' });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { title: 'Login', error: undefined });
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/'); // Or handle error
        }
        res.clearCookie('connect.sid'); // Clear the cookie
        res.redirect('/login'); // Redirect to login page after logout
    });
});

app.get('/addItem', (req,res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    res.render('addItem', { title: 'Add Item', error: undefined });
});

app.get('/addTag', (req,res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    res.render('addTag', { title: 'Add Tag', error: undefined });
});

app.post('/login/user', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find the user by username
        const user = await User.findOne({ username });

        // Check if the user exists
        if (!user) {
            return res.status(401).render('login', {
                title: 'Login',
                error: 'Invalid username or password.'
            });
        }

        // Compare the password with the stored hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).render('login', {
                title: 'Login',
                error: 'Invalid username or password.'
            });
        }

        // Set the user session
        req.session.user = {
            id: user._id,
            username: user.username,
            // Add any other user details you want to store in the session
        };

        // Redirect to home page or dashboard
        return res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).render('login', {
            title: 'Login',
            error: 'An error occurred while logging in. Please try again.'
        });
    }
});

app.post('/tags/add', async (req, res) => {
    const { tagNames } = req.body; // Retrieve the array of tag names

    // Check if any tag names are provided
    if (!tagNames || tagNames.length === 0) {
        return res.render('addTag', { title: 'Add Tags', error: 'At least one tag name is required.' });
    }

    try {
        // Create an array to hold the tags
        const tagsToAdd = tagNames.map(tagName => ({
            name: tagName.trim() // Trim whitespace from the tag name
        }));

        // Check for existing tags to prevent duplicates
        const existingTags = await Tag.find({ name: { $in: tagsToAdd.map(tag => tag.name) } }).lean();
        const existingTagNames = existingTags.map(tag => tag.name);

        // Filter out tags that already exist
        const newTags = tagsToAdd.filter(tag => !existingTagNames.includes(tag.name));

        // Save new tags to the database
        if (newTags.length > 0) {
            await Tag.insertMany(newTags);
        }

        // Provide feedback on existing tags that were not added
        const errorMsg = existingTagNames.length > 0 ? `Tags already exist: ${existingTagNames.join(', ')}` : null;

        res.render('addTag', { title: 'Add Tags', error: errorMsg });
    } catch (error) {
        console.error('Error adding tags:', error);
        res.render('addTag', { title: 'Add Tags', error: 'Error adding tags. Please try again.' });
    }
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
