const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true, // Ensure each tag name is unique
    }
}, { timestamps: true });

module.exports = mongoose.model('Tag', tagSchema);
