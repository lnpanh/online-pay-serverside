require('dotenv').config()

const express = require('express');
var mongoose = require('mongoose');
const router = express.Router();
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const request = require('request')

router.use(cookieParser());

const User = require('../../models/user');

const config = require('../../config/default.json');

router.post('/register', async(req, res) => {
  const {name,phone,password, email, dob} = req.body
// front checked already
  if (!name || !phone || !password || !email || !dob)
  return res.status(400).json({success: false, message: "Missing fields"})

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const phone_user = await User.findOne({phone})
    const email_user = await User.findOne({email})

    if (phone_user || email_user) {
      await session.abortTransaction()
      session.endSession()
      return res.status(400).json({success: false, message: "Phone or Email existed"})
    }

    // All good
    const hashPassword = await argon2.hash(password)
    const newUser = new User({name, phone, password: hashPassword, email, dob})
    await newUser.save()

    const accessToken = jwt.sign({userId: newUser._id}, process.env.ACCESS_TOKEN, {
      expiresIn: process.env.TIME_EXPIRED * 1000})
    
    var userSess = {"time_in":Date.now(), "time_out": process.env.TIME_EXPIRED*1000 + Date.now(), "bbox": "", "img_url": "", "accessToken": accessToken}
    console.log(newUser._id)    
    await User.findOneAndUpdate({_id: mongoose.Types.ObjectId(newUser._id)},{$push: {userSession:userSess}}, {session})
    
    res.cookie("accessToken", accessToken, { maxAge: process.env.TIME_EXPIRED * 1000, withCredentials: true, httpOnly: true, sameSite: 'None', secure: true })
    await session.commitTransaction()
    session.endSession()
    return res.status(200).json({success: true, message: "Register Successfully"}).end()

  }catch(error){
    await session.abortTransaction()
    session.endSession()
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
  }
})

router.post('/registerWithFace', async(req, res) => {
  const {name,phone,password, email, dob, url_img} = req.body
// front checked already
  if (!name || !phone || !password || !email || !dob || !url_img)
  return res.status(400).json({success: false, message: "Missing fields"})

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hashPhone = await argon2.hash(phone)
    const formData = {
      label: phone,
      url: url_img
    }

    const header = {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1MTYyMzkwMjIsImlzcyI6Imtob2FsdWFua2V5IiwiZXhwIjoxNzE2MjM5MDIyLCJvcmdhbml6YXRpb24iOiJYUiJ9.KU8a8tyOzsDyXfRGCA2WSssKVGauKtzE0ng122acvok',
    }

    request({method:"POST", url:'http://146.190.5.124:8000/faces/register',  body: formData, json: true, headers : header}, async function (err, httpResponse, body) {
      if (err) {
        return console.error('upload failed:', err);
      }
      httpResponse.setEncoding('utf8')
      const hashPassword = await argon2.hash(password)
      console.log('Upload successful!  httpResponded with:', httpResponse.body);
      const inforAuthen = httpResponse.body;
      const newUser = new User({name, phone, password: hashPassword, email, dob, hasFace: true})
      await newUser.save();

      const accessToken = jwt.sign({userId: newUser._id}, process.env.ACCESS_TOKEN, {
        expiresIn: process.env.TIME_EXPIRED * 1000})

      const userSess = {"time_in":inforAuthen.time_in, "time_out": process.env.TIME_EXPIRED*1000 + inforAuthen.time_in, "bbox": inforAuthen.bbox, "img_url": url_img, "accessToken": accessToken}

      await User.findOneAndUpdate({_id: mongoose.Types.ObjectId(newUser._id)},{$push: {userSession: userSess}}, {session})

      res.cookie("accessToken", accessToken, { maxAge: process.env.TIME_EXPIRED * 1000, withCredentials: true, httpOnly: true, sameSite: 'None', secure: true })
      await session.commitTransaction()
      session.endSession()
      return res.status(200).json({success: true, message: "Register Successfully"}).end()
    });

  }catch(error){
    await session.abortTransaction()
    session.endSession()
    console.log(error)
    return res.status(500).json({success: false, message: "Server Error"})
  }
})

router.post('/signinWithFace', async(req, res) => {
  const {phone, url_img} = req.body
  if (!phone || !url_img)
  return res.status(400).json({success: false, message: "Missing fields"})

  const hashPhone = await argon2.hash(phone)
  const cur_user = await User.findOne({phone: req.body.phone})
  try {
    const formData = {
      label: phone,
      url: url_img
    }
    const header = {
      Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1MTYyMzkwMjIsImlzcyI6Imtob2FsdWFua2V5IiwiZXhwIjoxNzE2MjM5MDIyLCJvcmdhbml6YXRpb24iOiJYUiJ9.KU8a8tyOzsDyXfRGCA2WSssKVGauKtzE0ng122acvok',
    }

    request({method:"POST", url:'http://146.190.5.124:8000/faces/verify',  body: formData, json: true, headers : header}, async function (err, httpResponse, body) {
      if (err) {
        return console.error('upload failed:', err);
      }
      httpResponse.setEncoding('utf8')
      console.log('Upload successful!  httpResponded with:', httpResponse.body);
      
      if (httpResponse.body.result) 
      {
        // console.log('Upload successful!  httpResponded with:', httpResponse.body);
        const inforAuthen = httpResponse.body

        const accessToken = jwt.sign({userId: cur_user._id}, process.env.ACCESS_TOKEN, {
          expiresIn: process.env.TIME_EXPIRED * 1000})
        const userSess = {"time_in":inforAuthen.time, "time_out": process.env.TIME_EXPIRED*1000 + inforAuthen.time, "bbox": inforAuthen.bbox, "img_url": url_img, "accessToken": accessToken}
        await User.findOneAndUpdate({_id: mongoose.Types.ObjectId(cur_user._id)},{$push: {userSession: userSess}})
        
        res.cookie("accessToken", accessToken, { maxAge: process.env.TIME_EXPIRED * 1000, withCredentials: true, httpOnly: true, sameSite: 'None', secure: true })
        return res.status(200).json({success: true, message: "Login Successfully"}).end()
      }
      else
      {
        return res.status(400).json({success: false, message: "Login Failed and Please Resend The Image"}).end()
      }
      
    });
  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
  }
})

router.post('/signin', async(req, res) => {
  if (!req.body.phone || !req.body.password)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {

    const cur_user = await User.findOne({phone: req.body.phone})
    if (!cur_user){
      res.status(403).json({success: false, message: "Unauthorized phone number"})
    }
    else{
      const phone_user= cur_user["phone"]

      if (phone_user)
      {
        if(await argon2.verify(cur_user["password"], req.body.password) )
        {
        const accessToken = jwt.sign({userId: cur_user._id}, process.env.ACCESS_TOKEN, {
          expiresIn: process.env.TIME_EXPIRED * 1000})
        
        var userSess = {"time_in":Date.now(), "time_out": process.env.TIME_EXPIRED*1000 + Date.now(), "bbox": "", "img_url": "", "accessToken": accessToken}
        
        await User.findOneAndUpdate({_id: mongoose.Types.ObjectId(cur_user._id)},{$push: {userSession: userSess}})

        res.cookie("accessToken", accessToken, { maxAge: process.env.TIME_EXPIRED * 1000, withCredentials: true, httpOnly: true, sameSite: 'None', secure: true })
    
        res.status(200).json({success: true, message: "LogIn Successfully"}).end()
        }
        else 
          res.status(401).json({success: false, message: "Wrong password"})
      }
      else
      {
        res.status(403).json({success: false, message: "Unauthorized phone number"})
      }
    }
  }catch(error){
    console.log(error)
    res.status(500).json({success: false, message: "Server Error"})
  }
})

router.get('/logout', async(req, res) => {
  const accessToken = req.cookies.accessToken

  if (!accessToken) {
    return res.status(401).json({success: false, message: "Unauthorized token"}).end()
  }
  var payload = jwt.decode(accessToken)
  if (Date.now() < payload['exp'] *1000){
    var userId = payload['userId']
    await User.updateOne({_id: mongoose.Types.ObjectId(userId), "userSession.accessToken":accessToken}, {$set:{"userSession.$.time_out":Date.now()}})
    res.clearCookie("accessToken")
    return res.status(200).json({success: true, message: "Bye Bye"}).end()
  }
  else {
    return res.status(401).json({success: false, message: "Token is expired"}).end()
  }
})

router.get('/getInfor', async(req, res)=>{

  const accessToken = req.cookies.accessToken
  if (!accessToken) {
    return res.status(401).json({success: false, message: "Unauthorized token"}).end()
  }
  var payload = jwt.decode(accessToken)
  if (Date.now() < payload['exp'] *1000){
    var userID = payload['userId']
  }
  else {
    return res.status(401).json({success: false, message: "Token is expired"}).end()
  }

  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
  const user_data = {"name":cur_user.name, "phone":cur_user.phone, "email":cur_user.email, "dob": cur_user.dob, "balance":cur_user.balance}
  return res.status(200).json({success: true, message: "Get information successfully",data: user_data})
})

 
//----------------------email sender---------------------------
const makeVerifyCode = (length) =>{
  let result = '';
  let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let charactersLength = characters.length;
  for ( let i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}
router.post("/email-verification", async(req, res) => {
      const {receiver} = req.body
      if (!receiver)
        return res.status(400).json({success: false, message: "Missing fields"})

      const subject = "HCMUS Email Verification Service";
      const code =  makeVerifyCode(6);
      const content = "Your verification code is: " + code; 
      //console.log("Verification code: ",content)
      try {
        //console.log("Test transporter host");
        let transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true, // use SSL
          auth: {
            user: process.env.TEMP_USERNAME,
            pass: process.env.TEMP_PASSWORD,
          }
        });
        
        // send mail with defined transport object
        let info = await transporter.sendMail({
          from: process.env.TEMP_USERNAME, // sender address
          to: receiver, // list of receivers
          subject: subject, // Subject line
          text: content, // plain text body
        });
  
        //console.log("Message sent: %s", info.messageId);
        //console.log("Info", info);
        if(info.accepted){
          res.status(200).json({success: true, message: "Email attempt: Successfully"});
        }
        else{
          res.status(400).json({success: false, message: "Email attempt: Failed"});
        } 
      }
      catch(error){
      console.log(error)
      res.status(500).json({success: false, message: "Server Error Occurred with Nodemailer Service :<"});
    }
});

module.exports = router;

