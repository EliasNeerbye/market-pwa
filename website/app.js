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
const { v4: uuidv4 } = require('uuid');

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

app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const tags = await Tag.find();
        const sentTags = tags.map(tag => ({ username: tag.name, _id: tag._id }));

        // Fetch products from the database and exclude those with quantity 0
        const products = await Product.find({ quantity: { $gt: 0 } }).populate('tags'); // Only get products with quantity > 0

        // Get the selected tag ID from the query parameters
        const selectedTagId = req.query.tagSelect;

        // Check if a tag is selected for filtering
        const filteredProducts = selectedTagId ? products.filter(product => 
            product.tags.map(tag => tag.toString()).includes(selectedTagId)
        ) : products;

        // Send tags and filtered products to the EJS template
        res.render('index', { title: 'Home', sentTags, products: filteredProducts, selectedTagId });
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
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

app.get('/addItem', async (req,res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    const allOwners = await User.find();
    let owners = [];
    allOwners.forEach(element => {
        owners.push({ name: element.username, _id: element._id });
    });

    const tags = await Tag.find();
    let sentTags = [];
    tags.forEach(element => {
        sentTags.push({ name: element.name, _id: element._id });
    });
    res.render('addItem', { title: 'Add Item', error: undefined, owners, sentTags });
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

app.post('/products/add', async (req, res) => {
    // Check if user is logged in
    if (!req.session.user) {
        return res.redirect('/');
    }

    try {
        // Check if there are files and extract the image file
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const imageFile = req.files.image; // Assuming the input name is 'image'
        
        // Generate a unique filename by appending a UUID
        const uniqueFileName = `${uuidv4()}_${imageFile.name}`;
        const uploadPath = path.join(__dirname, 'public', 'uploads', uniqueFileName);

        // Move the uploaded file to the specified directory
        await imageFile.mv(uploadPath);

        let owner;
        if (req.body.owner) {
            // Ensure owner is an ObjectId
            owner = new mongoose.Types.ObjectId(req.body.owner);
        } else {
            // Use the session user ID and ensure it's an ObjectId
            owner = new mongoose.Types.ObjectId(req.session.user.id); // Ensure you're using the correct session field
        }

        // Create the product object
        const productData = {
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            quantity: parseInt(req.body.quantity),
            owner: owner, // Ensure this is the user's ID as ObjectId
            image: `/uploads/${uniqueFileName}`, // Save relative URL for the image
            tags: req.body.tags ? [req.body.tags] : [] // Assuming tags come in an array
        };

        // Create a new product instance
        const newProduct = new Product(productData);

        // Save the product to the database
        await newProduct.save();

        // Redirect or send a success response
        res.redirect('/'); // Adjust to your success page
    } catch (error) {
        console.error(error);
        res.status(500).send('Error saving product: ' + error.message);
    }
});

app.get('/product/:id', async (req, res) => {
    if(!req.session.user){
        return res.redirect('/');
    }
    const params = req.params;
    if (!params){
        return res.redirect('/404');
    }

    const product = await Product.findById(params.id);
    res.render('product', { title: product.name,  product });
});

app.post('/sell/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const productId = req.params.id;
    const { quantitySold, salePrice } = req.body;
    const userId = new mongoose.Types.ObjectId(req.session.user.id);

    try {
        // Find the product by ID
        const product = await Product.findById(productId);
        if (!product) {
            return res.redirect('/404');
        }

        // Validate if the requested quantitySold is not more than the available quantity
        if (quantitySold > product.quantity) {
            return res.status(400).send('Not enough quantity available.');
        }

        // Calculate the average price per unit
        const averagePrice = salePrice / quantitySold;

        // Reduce the product's quantity
        product.quantity -= quantitySold;
        await product.save();

        // Log each sale separately for each item sold
        for (let i = 0; i < quantitySold; i++) {
            const salesLog = new SalesLog({
                userId: userId,
                productId: productId,
                soldPrice: averagePrice, // Store the average price per item
                saleDate: new Date(), // Automatically generated but can override if needed
            });

            // Save each sales log entry in the database
            await salesLog.save();
        }

        // Redirect or return a success message
        return res.redirect(`/`); // Redirect to home or another page after sale
    } catch (error) {
        console.error('Error processing sale:', error);
        return res.status(500).send('An error occurred while processing the sale.');
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
