const mongoose = require('mongoose');

const salesLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    soldPrice: { type: Number, required: true },
    saleDate: { type: Date, default: Date.now }
}, { timestamps: true });

const SalesLog = mongoose.model('SalesLog', salesLogSchema);
module.exports = SalesLog;