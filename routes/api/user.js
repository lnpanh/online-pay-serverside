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
const ListTrans = require('../../models/listtrans');


const Nexmo = require('nexmo')
const nexmo = new Nexmo({
  apiKey: "9ea4f114",
  apiSecret: "hL2iD1UQstu8vmzU"
})


// const firebaseConfig = {
//     apiKey: "AIzaSyAWy9R-DeZXjaBkPd2D1HoLYEXuPN7mMic",
//     authDomain: "online-payment-bb087.firebaseapp.com",
//     projectId: "online-payment-bb087",
//     storageBucket: "online-payment-bb087.appspot.com",
//     messagingSenderId: "449203698562",
//     appId: "1:449203698562:web:312c855ad32c5ce75a2d9b",
//     measurementId: "G-CB6D9XV3DY"
//   };


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

router.post('/linkAcc/:accessToken', async(req, res) => {
  const userID = jwt.decode(req.params.accessToken)["userId"]
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
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
    await User.findOne({_id: mongoose.Types.ObjectId(userID)}).updateOne({$set: {acc_id: newList._id}})
    res.status(200).json({success: true, message: "Link Account successfully"})
  }
  
})

router.get('/getListAcc/:accessToken/:linkType', async(req, res) => {
  const userID = jwt.decode(req.params.accessToken)["userId"]
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
  if (cur_user == null)
  {
    return res.status(401).json({success: false, message: "Account not existed"})
  }
  else
  {
    const cur_list = await ListAcc.findOne({ _id : mongoose.Types.ObjectId(cur_user["acc_id"]), linkAcc: {$elemMatch: {linkType : req.params.linkType}}})
    if (cur_list == null)
    {
      return res.status(401).json({success: false, message: "This type of link account is not existed"})
    }
    else
    {
      const d = []
      cur_list["linkAcc"].forEach(function(item)
      {
        if (item.linkType == req.params.linkType)
        {
          const star = '*'.repeat(item.accNum.length - 4)
          d.push({ "accNum" : item.accNum.substring(0,2) + star + item.accNum.substring(item.accNum.length - 2,item.accNum.length), "partiesName" :item.partiesName, "_id": item._id})
        }
      })
      
      return res.status(200).json({success: true, message: "Okie", data: d})
    }
  }
})

router.post('/transaction/:accessToken', async(req, res) => {
  const userID = jwt.decode(req.params.accessToken)["userId"]
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
  
  if (req.body.type == "transfer")
  {
    const rcv_user = await User.findOne({phone: req.body.phone})
    if (!rcv_user || cur_user._id == rcv_user._id)
    {
      res.status(401).json({success: false, message: "Unauthorized phone number"})
    }
    else
    {
        if (req.body.money < cur_user["balance"])
        {
          const newTrans_cur = new Trans({name_rcv: req.body.name, phone_rcv: req.body.phone, amount_money: req.body.money, type: req.body.type, dt: Date.now()})
          const newTrans_rcv = new Trans({name_send: cur_user["name"], phone_send: cur_user["phone"], amount_money: req.body.money, type: "Receive", dt: Date.now()})

          await cur_user.updateOne({$inc: {balance: -req.body.money}})
          await rcv_user.updateOne({$inc: {balance: req.body.money}})

          if (cur_user["hist_id"]) 
          {
            await ListTrans.findOne({ _id : mongoose.Types.ObjectId(cur_user["hist_id"])}).updateOne({$push : {TransList: newTrans_cur}})
            res.status(200).json({success: true, message: "Transfer successfully"})
          }
          else
          { 
            const newList = new ListTrans({TransList: [newTrans_cur]})
            await newList.save()
            await User.findOne({_id: mongoose.Types.ObjectId(userID)}).updateOne({$set: {hist_id: newList._id}})
            res.status(200).json({success: true, message: "Transfer successfully"})
          }

          
          if(rcv_user["hist_id"])
          {
            await ListTrans.findOne({ _id : mongoose.Types.ObjectId(rcv_user["hist_id"])}).updateOne({$push : {TransList: newTrans_rcv}})
          }
          else
          {
            const newList = new ListTrans({TransList: [newTrans_rcv]})
            await newList.save()
            await User.findOne({_id: mongoose.Types.ObjectId(rcv_user._id)}).updateOne({$set: {hist_id: newList._id}})
          }

        }
        else
        {
          return res.status(401).json({success: false, message: "Unauthorized balance"})
        }
      } 
  }
  else if (req.body.type  == "deposit")
  {
    const newTrans_cur = new Trans({name_3rd_party: req.body.name, num_3rd_party: req.body.num, amount_money: req.body.money, type: req.body.type, dt: Date.now()})
    
    await cur_user.updateOne({$inc: {balance: req.body.money}})

    if (cur_user["hist_id"]) 
    {
      await ListTrans.findOne({ _id : mongoose.Types.ObjectId(cur_user["hist_id"])}).updateOne({$push : {TransList: newTrans_cur}})
      res.status(200).json({success: true, message: "Deposit successfully"})
    }
    else
    { 
      const newList = new ListTrans({TransList: [newTrans_cur]})
      await newList.save()
      await User.findOne({_id: mongoose.Types.ObjectId(userID)}).updateOne({$set: {hist_id: newList._id}})
      res.status(200).json({success: true, message: "Deposit successfully"})  
    }
  }
})

router.get('/getHistory/:accessToken', async(req, res) => {
  const userID = jwt.decode(req.params.accessToken)["userId"]
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
  const list_trans = await ListTrans.findOne({_id: mongoose.Types.ObjectId(cur_user["hist_id"])})
  if (list_trans == null)
  {
    return res.status(401).json({success: false, message: "This account has no transaction"})
  }
  else
  {
    const d = []
    list_trans["TransList"].forEach(function(item)
    {
      if (item.type == "transfer")
        d.push({"name_rcv": item.name_rcv, "phone_rcv": item.phone_rcv, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})
      else if (item.type == "Receive")
        d.push({"name_send": item.name_send, "phone_send": item.phone_send, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})
      else if (item.type == "deposit")
        d.push({"name_account": item.name_3rd_party, "num_account": item.num_3rd_party, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})

    })
    return res.status(200).json({success: true, message: "Okie", data: d})
  }
})

router.post("/sendsms", function(req, res) {
  let fromPhone = req.body.fromPhone;
  let toPhone = req.body.toPhone;
  let content = req.body.content;
  sendSMS(fromPhone, toPhone, content, function(responseData){
      console.log(responseData);
  });
})

function sendSMS(fromPhone, toPhone, content, callback){
  nexmo.message.sendSms(fromPhone, toPhone, content, {
      type: "unicode"
    }, (err, responseData) => {
      if (err) {
        console.log(err);
      } else { 
        if (responseData.messages[0]['status'] === "0") {
          callback("Message sent successfully.")
        } else {
          callback(`Message failed with error: ${responseData.messages[0]['error-text']}`);
        }
      }
    })
}


module.exports = router;

