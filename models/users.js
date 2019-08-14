const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.Number,
    name: String,
    passIssued: Boolean,
    grade: Number
})

module.exports = mongoose.model('User', userSchema);