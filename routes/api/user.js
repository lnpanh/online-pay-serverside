require('dotenv').config()
const express = require('express');
const router = express.Router();
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')

const User = require('../../models/user');

router.post('/register', async(req, res) => {
  const {name,phone,password, email, dob} = req.body

  if (!name || !phone || !password || !email || !dob)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {
    const phone_user = await User.findOne({phone})
    const email_user = await User.findOne({email})

    if (phone_user || email_user)
    return res.status(400).json({success: false, message: "Phone or Email existed"})

    // All good
    const hashPassword = await argon2.hash(password)
    const newUser = new User({name, phone, password: hashPassword, email, dob})
    await newUser.save()

    //return token
    const accessToken = jwt.sign({userId: newUser._id}, process.env.ACCESS_TOKEN)
    res.json({success: true, message: "Register Successfully", accessToken})


  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Cant"})
  }
})

router.post('/signin', async(req, res) => {
  const {phone,password} = req.body

  if (!phone || !password)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {
    const phone_user = await User.findOne({phone})

    if (phone_user)
    {
      if(await argon2.verify(phone_user["password"], password))
      {
      const accessToken = jwt.sign({userId: phone_user._id}, process.env.ACCESS_TOKEN)
      res.json({success: true, message: "LogIn Successfully", accessToken})
      }
      else
      res.json({success: false, message: "Wrong password"})
    }
    else
    {
      res.json({success: false, message: "Wrong phone number"})
    }
  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Cant"})
  }
})

module.exports = router;
