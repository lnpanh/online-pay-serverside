const mongoose = require('mongoose');

const AccSchema = new mongoose.Schema({
    accNum:{
        type: String,
        required:true
    },
    partiesName:{
        type: String,
        required:true
    },
    linkType:{
        type: String,
        required:true
    },
    token:{
        type: String,
        required:true
    },
});

module.exports = Accs = mongoose.model('Accs', AccSchema);