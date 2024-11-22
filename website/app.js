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
const sharp = require('sharp');
const fs = require('fs');

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

app.use(fileUpload({
    createParentPath: true, // Create parent directories if they do not exist
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)){
    fs.mkdirSync(uploadsDir, { recursive: true });
}

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
const Market = require('./models/market');

app.get('/', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        // Step 1: Fetch the current market
        const currentMarket = await Market.findOne({ 'date.end': { $gte: new Date() } })
            .sort({ 'date.start': 1 })
            .populate('participants');

        // Step 2: Get participant IDs if a market exists
        const participantIds = currentMarket 
            ? currentMarket.participants.map(p => p._id.toString()) 
            : [];

        // Step 3: Fetch tags
        const tags = await Tag.find();

        // Step 4: Get the selected tag ID from query parameters
        const selectedTagId = req.query.tagSelect;

        // Step 5: Build the product query
        let productQuery = { quantity: { $gt: 0 } };
        if (currentMarket && participantIds.length > 0) {
            productQuery.owner = { $in: participantIds };
        }
        if (selectedTagId) {
            productQuery.tags = selectedTagId;
        }

        // Step 6: Fetch filtered products
        const products = await Product.find(productQuery).populate('tags owner');

        // Step 7: Render the page
        res.render('index', {
            title: 'Home',
            sentTags: tags,
            products,
            selectedTagId,
            currentMarket,
            participantIds
        });
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
    if (!req.session.user){
        return res.redirect('/login');
    }
    const { tagNames } = req.body; // Retrieve the array of tag names

    // Check if any tag names are provided
    if (!tagNames || tagNames.length === 0) {
        return res.render('addTag', { title: 'Add Tags', error: 'At least one tag name is required.' });
    }

    try {
        // Ensure tagNames is always an array, even if only one tag is provided
        const tagNamesArray = Array.isArray(tagNames) ? tagNames : [tagNames];
    
        // Create an array to hold the tags
        const tagsToAdd = tagNamesArray.map(tagName => ({
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
    
        // Provide feedback on successfully added tags
        const successMsg = newTags.length > 0 ? `Successfully added: ${newTags.map(tag => tag.name).join(', ')}` : null;
    
        res.render('addTag', { 
            title: 'Add Tags', 
            error: errorMsg, 
            success: successMsg 
        });
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

        const imageFile = req.files.image;
        
        // Generate a unique filename
        const uniqueFileName = `${uuidv4()}_${imageFile.name}`;
        const uploadPath = path.join(__dirname, 'public', 'uploads', uniqueFileName);

        // Ensure the uploads directory exists (double-check just in case)
        const uploadsDir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(uploadsDir)){
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Process and save the image
        await sharp(imageFile.data)
            .resize({
                width: 1200,
                height: 1200,
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(uploadPath);

        let owner;
        if (req.body.owner) {
            owner = new mongoose.Types.ObjectId(req.body.owner);
        } else {
            owner = new mongoose.Types.ObjectId(req.session.user.id);
        }

        // Create the product object
        const productData = {
            name: req.body.name,
            description: req.body.description,
            price: parseFloat(req.body.price),
            quantity: parseInt(req.body.quantity),
            owner: owner,
            image: `/uploads/${uniqueFileName}`,
            tags: req.body.tags ? [req.body.tags] : []
        };

        // Create and save the new product
        const newProduct = new Product(productData);
        await newProduct.save();

        res.redirect('/');
    } catch (error) {
        console.error('Error saving product:', error);
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


// GET route to render the form with users
app.get('/addMarket', async (req, res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    try {
        const users = await User.find(); // Fetch all users to be displayed as participants
        res.render('addEvent', { users }); // Render the form, passing users array to the view
    } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send("Internal Server Error");
    }
});

// GET route for markets page
app.get('/markets', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    try {
        // Fetch all market events, populate participants, and sort by start date
        const markets = await Market.find()
            .populate('participants')
            .sort({ 'date.start': 1 }); // Sort markets by start date ascending

        // Fetch all users
        const availableUsers = await User.find({}, 'username');

        res.render('markets', { 
            markets, 
            availableUsers,
            currentUser: req.session.user 
        });
    } catch (err) {
        console.error("Error fetching markets:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.post('/markets/:id/delete', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    
    try {
        const marketId = req.params.id;
        
        // Check if the market exists
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).send("Market not found");
        }
        
        // Delete the market
        await Market.findByIdAndDelete(marketId);
        
        // Redirect back to the markets page
        res.redirect('/markets');
    } catch (err) {
        console.error("Error deleting market:", err);
        res.status(500).send("Internal Server Error");
    }
});

app.delete('/profile/item/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const itemId = req.params.id;
    const item = await Product.findById(itemId);
    const user = await User.findById(req.session.user.id)
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (item.owner.toString() == user._id.toString()) {
        const itemImg = item.image;
        await fs.unlink(path.join(__dirname, 'public', itemImg), (err) => {
            if (err) console.error(`Error deleting image: ${err}`);
        });
        await Product.findByIdAndDelete(itemId);
        res.json({ message: 'Item deleted successfully' });
        return;
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
});

// POST route for adding a participant to a market
app.post('/markets/:marketId/addParticipant', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { marketId } = req.params;
    const { userId } = req.body;

    try {
        // Find the market and update its participants
        const market = await Market.findById(marketId);
        if (!market) {
            return res.status(404).json({ error: 'Market not found' });
        }

        // Check if the user is already a participant
        if (market.participants.includes(userId)) {
            return res.status(400).json({ error: 'User is already a participant' });
        }

        // Add the user to the participants array
        market.participants.push(userId);
        await market.save();

        // Redirect back to the markets page
        res.redirect('/markets');
    } catch (err) {
        console.error("Error adding participant:", err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST route to add a new market event
app.post('/addMarket', async (req, res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    const { name, dateStart, dateEnd, participants } = req.body;

    try {
        // Create new market entry
        const newMarket = new Market({
            name,
            date: {
                start: new Date(dateStart),
                end: new Date(dateEnd),
            },
            participants: Array.isArray(participants) 
                ? participants.map(id => new mongoose.Types.ObjectId(id)) // Use 'new' with ObjectId
                : participants ? [new mongoose.Types.ObjectId(participants)] : [] // Wrap single participant in an array
        });

        await newMarket.save(); // Save to the database
        res.redirect('/markets'); // Redirect to the markets listing page (or wherever you want)
    } catch (err) {
        console.error("Error adding market:", err);
        res.status(500).send("Internal Server Error");
    }
});



// Route to get sales statistics
app.get('/stats', async (req, res) => {
    if (!req.session.user){
        return res.redirect('/login');
    }
    try {
        // Fetch all sales logs and populate productId
        const salesLogs = await SalesLog.find().populate('productId');
        const productIds = salesLogs.map(log => log.productId._id);

        // Fetch products with their owners
        const products = await Product.find({ _id: { $in: productIds } }).populate('owner');

        // Prepare sales details for rendering
        const salesDetails = await Promise.all(products.map(async (product) => {
            const logsForProduct = salesLogs.filter(log => log.productId._id.toString() === product._id.toString());
            const totalSales = logsForProduct.length;
            const totalRevenue = logsForProduct.reduce((sum, log) => sum + log.soldPrice, 0);

            // Initialize seller counts and top seller
            const sellerCounts = {};
            let topSellerId = null;

            logsForProduct.forEach(log => {
                if (log.userId) { // Ensure userId exists in the log
                    sellerCounts[log.userId] = (sellerCounts[log.userId] || 0) + 1;
                }
            });

            // Determine top seller if any sales exist
            if (totalSales > 0) {
                topSellerId = Object.keys(sellerCounts).reduce((a, b) => sellerCounts[a] > sellerCounts[b] ? a : b);
            }

            // Find the user details of the top seller, if one exists
            const topSeller = topSellerId ? await User.findById(topSellerId) : null;

            return {
                productId: product.name,
                ownerName: product.owner.username, // Correctly access the owner's username
                totalSales: totalSales,
                totalRevenue: totalRevenue.toFixed(2),
                topSeller: topSeller ? topSeller.username : 'N/A',
                salesLog: logsForProduct
            };
        }));

        // Send the gathered data to the EJS view
        res.render('stats', { salesDetails });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.get('/profile', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const user = await User.findById(req.session.user.id);
        const userItems = await Product.find({ owner: user._id }).populate('tags');

        res.render('profile', {
            title: 'User Profile',
            user: user,
            items: userItems
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.get('/profile/item/:id', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const item = await Product.findById(req.params.id).populate('tags');
        if (!item || item.owner.toString() !== req.session.user.id) {
            return res.status(404).send('Item not found or unauthorized');
        }

        const allTags = await Tag.find();

        res.render('editItem', {
            title: 'Edit Item',
            item: item,
            allTags: allTags
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
});

app.put('/profile/item/:id', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    try {
        const item = await Product.findById(req.params.id);
        if (!item || item.owner.toString() !== req.session.user.id) {
            return res.status(404).json({ message: 'Item not found or unauthorized' });
        }

        // Update item fields
        item.name = req.body.name;
        item.description = req.body.description;
        item.price = parseFloat(req.body.price);
        item.quantity = parseInt(req.body.quantity);
        item.tags = req.body.tags;

        // Handle image update if a new image is uploaded
        if (req.files && req.files.image) {
            const imageFile = req.files.image;
            const uniqueFileName = `${uuidv4()}_${imageFile.name}`;
            const uploadPath = path.join(__dirname, 'public', 'uploads', uniqueFileName);

            await sharp(imageFile.data)
                .resize({
                    width: 1200,
                    height: 1200,
                    fit: sharp.fit.inside,
                    withoutEnlargement: true
                })
                .jpeg({ quality: 80 })
                .toFile(uploadPath);

            item.image = `/uploads/${uniqueFileName}`;
        }

        await item.save();
        res.json({ message: 'Item updated successfully', item: item });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
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
