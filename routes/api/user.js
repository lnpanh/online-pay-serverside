require('dotenv').config()
const express = require('express');
const router = express.Router();

const argon2 = require('argon2')
const jwt = require('jsonwebtoken')

// Load Book model
const User = require('../../models/user');


// router.get('/', (req, res) => res.send('USER ROUTE!'));

// @route POST api/user/register
// @desc Register
// @access Public

router.post('/register', async(req, res) => {
  const {name,phone,password, email} = req.body

  if (!name || !phone || !password || !email)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {
    //check phone existed
    const phone_user = await User.findOne({phone})

    if (phone_user)
    return res.status(400).json({success: false, message: "Phone existed"})

    // All good
    const hashPassword = await argon2.hash(password)
    const newUser = new User({name, phone, password: hashPassword, email})
    await newUser.save()

    //return token
    const accessToken = jwt.sign({userId: newUser._id}, process.env.ACCESS_TOKEN)
    res.json({success: true, message: "Register", accessToken})


  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Cant"})
  }
})

module.exports = router;
