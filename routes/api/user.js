require('dotenv').config()
const express = require('express');
var mongoose = require('mongoose');
const router = express.Router();
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')

const User = require('../../models/user');
const Acc = require('../../models/acc');
const ListAcc = require('../../models/listacc');
const Trans = require('../../models/trans');


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
    res.status(200).json({success: true, message: "Register Successfully", accessToken})


  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
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
      res.status(200).json({success: true, message: "LogIn Successfully", accessToken})
      }
      else
      res.status(401).json({success: false, message: "Wrong password"})
    }
    else
    {
      res.status(401).json({success: false, message: "Unauthorized phone number"})
    }
  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
  }
})

router.post('/linkAcc/:userID', async(req, res) => {
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(req.params.userID)})
  if (cur_user["acc_id"]) 
  {
    
    const cur_linkAcc = await ListAcc.find({ _id : mongoose.Types.ObjectId(cur_user["acc_id"]), linkAcc: {$elemMatch: {accNum : req.body.accNum, partiesName: req.body.partiesName}}})

    if (cur_linkAcc.length != 0) 
    {
      return res.status(401).json({success: false, message: "Account existed"})
    }
    else
    {
      const newAcc = new Acc({accNum : req.body.accNum, partiesName: req.body.partiesName, linkType: req.body.linkType, token: req.body.token})
      await ListAcc.find({ _id : mongoose.Types.ObjectId(cur_user["acc_id"])}).updateOne({$push : {linkAcc: newAcc}})
      res.status(200).json({success: true, message: "Link Account successfully"})
    }
  }
  else
  {
    const newAcc = new Acc({accNum : req.body.accNum, partiesName: req.body.partiesName, linkType: req.body.linkType, token: req.body.token})
    const newList = new ListAcc({linkAcc: [newAcc]})
    await newList.save()
    await User.findOne({_id: mongoose.Types.ObjectId(req.params.userID)}).updateOne({$set: {acc_id: newList._id}})
    res.status(200).json({success: true, message: "Link Account successfully"})
  }
  
})

router.post('/getListAcc/:userID', async(req, res) => {
  
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(req.params.userID)})["acc_id"]
  console.log(cur_user)

  if (!cur_user)
  {
    return res.status(401).json({success: false, message: "Account not existed"})
  }
  else
  {
    const cur_list = await ListAcc.find({ _id : mongoose.Types.ObjectId(cur_user), linkAcc: {$elemMatch: {linkType : req.body.linkType}}})
    console.log(cur_list)

    if (cur_list.length == 0)
    {
      return res.status(401).json({success: false, message: "This type of link account is not existed"})
    }
    else
    {
      const data = []
      cur_list.forEach(function(item)
      {
        if (item.linkType == req.body.linkType)
        {
            data.push(item.accNum.substring(0,2) + (item.accNum.length - 4)* "*" + item.accNum.substring(-2,item.accNum.length), item.partiesName)
        }
      })
      console.log(data)
      return res.status(200).json({success: true, message: "Okie", data: data})
    }
  }
})


router.post('/:userID/transaction', async(req, res) => {
  const {type,name, phone, money, accID} = req.body

  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(req.params.userID)})
  const rcv_user = await User.findOne({phone})
  if (!rcv_user)
  {
    res.status(401).json({success: false, message: "Unauthorized phone number"})
  }
  else
  {
    if (type == "Transfer")
    {
      if (money < cur_user["balance"])
      {
        const newTrans = new Trans({name, phone, money, type, accID})
        await newTrans.save()
        cur_user.updateOne({$inc: {balance: -money}})
        rcv_user.updateOne({$inc: {balance: money}})
        res.status(200).json({success: true, message: "Transfer successfully"})
      }
    }

    else if (type == "Deposit")
    {

    }
  }
})


router.get('/:userID/history', async(req, res) => {
  const {userID} = req.body

  if (!phone || !password)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {
    const phone_user = await User.findOne({phone})

    if (phone_user)
    {
      if(await argon2.verify(phone_user["password"], password))
      {
      const accessToken = jwt.sign({userId: phone_user._id}, process.env.ACCESS_TOKEN)
      res.status(200).json({success: true, message: "LogIn Successfully", accessToken})
      }
      else
      res.status(401).json({success: false, message: "Wrong password"})
    }
    else
    {
      res.status(401).json({success: false, message: "Unauthorized phone number"})
    }
  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
  }
})

module.exports = router;
