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

const ListAccSchema = new mongoose.Schema({
  linkAcc: {
    listAcc: [AccSchema]
  }
});

module.exports = ListAcc = mongoose.model('listAcc', ListAccSchema);