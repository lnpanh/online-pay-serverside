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
    type: mongoose.Types.ObjectId,
    ref: 'listAcc'
  },
  hist_id: {
    type: mongoose.Types.ObjectId,
    ref: 'listTrans'
  },
  balance: {
    type: Number,
    default: 100000
  }
});

module.exports = User = mongoose.model('USER_DOC', UserSchema);