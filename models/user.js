// const { Schema } = require('mongoose');
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
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  dob: {
    type: String,
    required: true
  },
  acc_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'listAcc'
  },
  hist_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'listAcc'
  },
  balance: {
    type: Number,
    default: 0
  }
});

module.exports = User = mongoose.model('USER_DOC', UserSchema);