const mongoose = require('mongoose');

const logSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    id: Number,
    timeOut: Date,
    timeIn: Date,
    duration: Number
})

module.exports = mongoose.model('Log', logSchema);