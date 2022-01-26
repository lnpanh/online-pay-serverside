
const mongoose = require('mongoose');
const ListTransSchema = new mongoose.Schema({
    TransList: {
        type: Array,
        default: []
    }
  });


module.exports = ListTrans = mongoose.model('listTrans', ListTransSchema);