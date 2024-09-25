const mongoose = require('mongoose');

const salesLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    soldPrice: { type: Number, required: true }, // Price at which the product was sold
    saleDate: { type: Date, default: Date.now } // When the sale was logged
}, { timestamps: true }); // Automatically create createdAt and updatedAt fields

const SalesLog = mongoose.model('SalesLog', salesLogSchema);
module.exports = SalesLog;