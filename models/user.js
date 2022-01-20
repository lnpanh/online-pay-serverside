const { Schema } = require('mongoose');
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  acc_id: {
    // type: Schema.Types.ObjectId,
    // ref: 'listAcc'
    type: String,
    default: ""
  },
  hist_id: {
    // type: Schema.Types.ObjectId,
    // ref: 'listAcc'
    type: String,
    default: ""
  },
  balance: {
    type: Number,
    default: 0
  }
});

module.exports = User = mongoose.model('user', UserSchema);