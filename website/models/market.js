const mongoose = require('mongoose');

const marketSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    date: {
        start: { type: Date, required: true },
        end: { type: Date, required: true },
    },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

const Market = mongoose.model('Market', marketSchema);
module.exports = Market; // Ensure this line exports Market
