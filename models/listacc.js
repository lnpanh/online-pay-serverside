const mongoose = require('mongoose');

const ListAccSchema = new mongoose.Schema({
    linkAcc: {
      type: Array,
      default: []
    }
  });
  
  module.exports = ListAcc = mongoose.model('listAcc', ListAccSchema);