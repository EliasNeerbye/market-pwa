const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to User (staff)
    quantity: { type: Number, required: true, default: 0 }, // Initial quantity
    image: { type: String } // Optional field for product image
}, { timestamps: true }); // Automatically create createdAt and updatedAt fields

const Product = mongoose.model('Product', productSchema);
module.exports = Product;