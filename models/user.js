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

  userSession: {
    type: Array,
    default:[]
  },
  hasFace: {
    type: Boolean,
    default: false
  }
});

module.exports = User = mongoose.model('USER_DOC', UserSchema);