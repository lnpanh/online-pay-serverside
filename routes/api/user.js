require('dotenv').config()

const express = require('express');
var mongoose = require('mongoose');
const router = express.Router();
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');

const User = require('../../models/user');
const Acc = require('../../models/acc');
const ListAcc = require('../../models/listacc');

const Trans = require('../../models/trans');
const ListTrans = require('../../models/listtrans');

const paypal = require('paypal-rest-sdk');

paypal.configure({
  'mode': 'sandbox', //sandbox or live
  'client_id': 'ARciZMkxvE2KsX6N7SxCZEZ-euR-AG997zgxPfQhsQGeAaM2sQI9V7x9beZNDwZovvuDsARAFH2_L_dB',
  'client_secret': 'ED4Z3xBxpBZml0VCQCZQz5QfSiQ-H2VLOYDfR5D7bGEMKxMKnDFcffdXIy46TfZzPoRlMjTMtxfAr-yx'
});

const config = require('../../config/default.json');
var dateFormat = require('x-date');

var $ = require('jquery');

// console.log(vnpUrl)
// const Nexmo = require('nexmo')
// const nexmo = new Nexmo({
//   apiKey: "9ea4f114",
//   apiSecret: "hL2iD1UQstu8vmzU"
// })

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
  if (!req.body.phone || !req.body.password)
  return res.status(400).json({success: false, message: "Missing fields"})

  try {

    const cur_user = await User.findOne({phone: req.body.phone})
    const phone_user= cur_user["phone"]

    if (phone_user)
    {
      if(await argon2.verify(cur_user["password"], req.body.password) )
      {
      const accessToken = jwt.sign({userId: cur_user._id}, process.env.ACCESS_TOKEN)
      res.status(200).json({success: true, message: "LogIn Successfully", accessToken})
      }
      else 
        res.status(401).json({success: cur_user, message: "Wrong password"})

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
          const num = encode(item.accNum)
          d.push({ "accNum" : num, "partiesName" :item.partiesName, "_id": item._id})
          
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
    const cur_acc = await ListAcc.findOne({ _id : mongoose.Types.ObjectId(cur_user["acc_id"])})
    var newTrans_cur = new Trans()
    cur_acc["linkAcc"].forEach(function(item)
    {
      if (item._id == req.body._id)
      {
        newTrans_cur = new Trans({name_3rd_party: item.partiesName, num_3rd_party: encode(item.accNum), amount_money: req.body.money, type: req.body.type, dt: Date.now()})
      }  
    })

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

  else if (req.query.type == "payviapaypal")
  {
    console.log("Hello")
    const rcv_user = infor["transactions"][0]["payee"]["email"]
    const total_money = infor["transactions"][0]["amount"]["total"]
    const d = infor["update_time"]

    const newTrans_cur = new Trans({name_rcv: rcv_user, amount_money: total_money, type: "payviapaypal", dt: Date(d)})

    if (cur_user["hist_id"]) 
    {
      await ListTrans.findOne({ _id : mongoose.Types.ObjectId(cur_user["hist_id"])}).updateOne({$push : {TransList: newTrans_cur}})
      res.status(200).json({success: true, message: "Payment successfully"})
    }
    else
    { 
      const newList = new ListTrans({TransList: [newTrans_cur]})
      await newList.save()
      await User.findOne({_id: mongoose.Types.ObjectId(userID)}).updateOne({$set: {hist_id: newList._id}})
      return res.status(200).json({success: true, message: "Payment successfully"})
    }  
  }
  });


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
    const now = new Date()
    const month = now.getMonth() 
    list_trans["TransList"].forEach(function(item)
    {
      if (item.dt.getMonth() == month)
      {
        if (item.type == "transfer")
          d.push({"name_rcv": item.name_rcv, "phone_rcv": item.phone_rcv, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})
        else if (item.type == "Receive")
          d.push({"name_send": item.name_send, "phone_send": item.phone_send, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})
        else if (item.type == "deposit")
          d.push({"name_account": item.name_3rd_party, "num_account": item.num_3rd_party, "amount_money": item.amount_money, "type": item.type , "dt": item.dt})
      }
    })
    return res.status(200).json({success: true, message: "Okie", data: d})
  }
})

// router.post("/sendsms", function(req, res) {
//   let fromPhone = req.body.fromPhone;
//   let toPhone = req.body.toPhone;
//   let content = req.body.content;

//   if (!fromPhone || !toPhone || !content)
//     return res.status(400).json({success: false, message: "Missing fields"})
    
//   console.log(fromPhone, toPhone, content)
  
//   sendSMS(fromPhone, toPhone, content, function(responseData){
//       console.log(responseData);
//       if (responseData === "Message sent successfully.") {
//         return res.status(200).json({success: true, message: responseData})
//       }
//       else
//       {
//         return res.status(401).json({success: false, message: "Send failed: " + responseData})
//       } 
//   });
// })

// function sendSMS(fromPhone, toPhone, content, callback){
//   nexmo.message.sendSms(fromPhone, toPhone, content, {
//       type: "unicode"
//     }, (err, responseData) => {
//       if (err) {
//         console.log(err);
//       } else { 
//         if (responseData.messages[0]['status'] === "0") {
//           callback("Message sent successfully.")
//         } else {
//           callback(`Message failed with error: ${responseData.messages[0]['error-text']}`);
//         }
//       }
//     })
// }

function encode(account)
{
  const star = '*'.repeat(account.length - 4)
  return account.substring(0,2) + star + account.substring(account.length - 2,account.length)
}


router.post("/getInfor/:accessToken", async(req, res)=>{
  const userID = jwt.decode(req.params.accessToken)["userId"]
  const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})
  return res.status(200).json({success: true, message: "Get information successfully",data: cur_user})
})


router.post('/paypal/:accessToken', async(req, res) => {
  // const host = req.get('host');
  const create_payment_json = {
    "intent": "sale",
    "payer": {
        "payment_method": "paypal"
    },
    "redirect_urls": {
        "return_url": "http://localhost:8082/paypalsuccess/" + req.params.accessToken,
        "cancel_url": "http://localhost:8082/cancel/" + req.params.accessToken
    },
    "transactions": [{
        "item_list": {
            "items": [{
                "name": "Redhock Bar Soap",
                "sku": "001",
                "price": "10.00",
                "currency": "USD",
                "quantity": 1
            }]
        },
        "amount": {
            "currency": "USD",
            "total": "10.00"
        },
        "description": "Washing Bar soap"
    }]
};

paypal.payment.create(create_payment_json, function (error, payment) {
  if (error) {
      // throw error;
      return res.status(400).json({success: false, message: error});
  } else {
      for(let i = 0;i < payment.links.length;i++){
        if(payment.links[i].rel === 'approval_url'){
          res.redirect(payment.links[i].href);
        }
      }
  }
});
});


router.get('/paypalsuccess/:accessToken', async(req, res) => {
  // const userID = jwt.decode(req.params.accessToken)["userId"]
  // const cur_user = await User.findOne({_id: mongoose.Types.ObjectId(userID)})

  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId;

  const execute_payment_json = {
    "payer_id": payerId,
    "transactions": [{
        "amount": {
            "currency": "USD",
            "total": "10.00"
        }
    }]
  };

  var infor;
// Obtains the transaction details from paypal
  paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
      //When error occurs when due to non-existent transaction, throw an error else log the transaction details in the console then send a Success string reposponse to the user.
    if (error) {
        // console.log(error.response);
        return res.status(400).json({success: false, message: error});
    } 
    else {
        const rcv_user = payment["transactions"][0]["payee"]["email"]
        const total_money = payment["transactions"][0]["amount"]["total"]
        const d = payment["update_time"]

        res.redirect(308, "http://localhost:8082/transaction/" + req.params.accessToken + "?type=payviapaypal?rcv_user=" + rcv_user + "&total_money=" + total_money + "&date=" + d)
        // return res.status(200).json({success: true, message: "Paid"});
    }
});
});

router.get('/cancel', async(req, res) => res.status(400).json({success: false, message: "false"}));


router.get('/create_payment_url', function (req, res, next) {
  var date = new Date();
  var createDate = date.format('yyyy-mm-dd HH:mm:ss')
  var desc = 'Thanh toan don hang thoi gian: ' + createDate;
  res.status(200).json({title: 'Tạo mới đơn hàng', amount: 10000, description: desc})
});

router.post('/create_payment_url', function (req, res, next) {
  var ipAddr = req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress||
      req.remoteAddress ||
      req.socket.remoteAddress;

  // if (ipAddr.substr(0, 7) == "::ffff:") {
  //   ipAddr = ipAddr.substr(7)}

  var tmnCode = config['vnp_TmnCode'];
  var secretKey = config['vnp_HashSecret'];
  var vnpUrl = config['vnp_Url'];
  var returnUrl = config['vnp_ReturnUrl'];
  var date = new Date();
  var createDate = date.format('yyyymmddHHmmss');
  var orderId = date.format('HHmmss');

  var amount = parseInt(req.body.amount,10);
  var bankCode = req.body.bankCode;
  
  var orderInfo = req.body.orderDescription;
  var orderType = req.body.orderType;
  var locale = req.body.language;
  if(locale === null || locale === ''){
      locale = 'vn';
  }
  var currCode = 'VND';
  var vnp_Params = {};
  vnp_Params['vnp_Version'] = '2.1.0';
  vnp_Params['vnp_Command'] = 'pay';
  vnp_Params['vnp_TmnCode'] = tmnCode;
  // vnp_Params['vnp_Merchant'] = ''
  vnp_Params['vnp_Locale'] = locale;
  vnp_Params['vnp_CurrCode'] = currCode;
  vnp_Params['vnp_TxnRef'] = orderId;
  vnp_Params['vnp_OrderInfo'] = orderInfo;
  vnp_Params['vnp_OrderType'] = orderType;
  vnp_Params['vnp_Amount'] = amount * 100;
  vnp_Params['vnp_ReturnUrl'] = returnUrl;
  vnp_Params['vnp_IpAddr'] = ipAddr;
  vnp_Params['vnp_CreateDate'] = createDate;
  if(bankCode !== null && bankCode !== ''){
      vnp_Params['vnp_BankCode'] = bankCode;
  }

  vnp_Params = sortObject(vnp_Params);

  var querystring = require('qs');
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");     
  var hmac = crypto.createHmac("sha512", secretKey);
  // var signed = hmac.update(new Buffer.alloc(signData.length, 'utf-8')).digest("hex"); 
  var signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex"); 
  vnp_Params['vnp_SecureHash'] = signed;
  vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });
  res.redirect(vnpUrl)
});

router.get('/vnpay_return', function (req, res, next) {
  console.log("hello")
  var vnp_Params = req.query;

  var secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  var tmnCode = config['vnp_TmnCode'];
  var secretKey = config['vnp_HashSecret'];
  var vnpUrl = config['vnp_Url'];
  var returnUrl = config['vnp_ReturnUrl'];

  vnp_Params = sortObject(vnp_Params);

  var querystring = require('qs');
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");     
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");     

  if(secureHash === signed){
      //Kiem tra xem du lieu trong db co hop le hay khong va thong bao ket qua
      res.status(200).json('success', {code: vnp_Params['vnp_ResponseCode']})
  } else{
      res.status(400).json('fail', {code: '97'})
  }
});

router.get('/vnpay_ipn', function (req, res, next) {
  var vnp_Params = req.query;
  var secureHash = vnp_Params['vnp_SecureHash'];

  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  vnp_Params = sortObject(vnp_Params);
  // var config = require('config');
  // var secretKey = config.get('vnp_HashSecret');
  var querystring = require('qs');
  var signData = querystring.stringify(vnp_Params, { encode: false });
  var crypto = require("crypto");     
  var hmac = crypto.createHmac("sha512", secretKey);
  var signed = hmac.update(new Buffer.from(signData, 'utf-8')).digest("hex");     
   

  if(secureHash === signed){
      var orderId = vnp_Params['vnp_TxnRef'];
      var rspCode = vnp_Params['vnp_ResponseCode'];
      //Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
      res.status(200).json({RspCode: '00', Message: 'success'})
  }
  else {
      res.status(200).json({RspCode: '97', Message: 'Fail checksum'})
  }
});

function sortObject(obj) {
var sorted = {};
var str = [];
var key;
for (key in obj){
  if (obj.hasOwnProperty(key)) {
  str.push(encodeURIComponent(key));
  }
}
str.sort();
  for (key = 0; key < str.length; key++) {
      sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}



// router.post("/sendsmsbytwillo", function(req, res) {
//   const FROM_NUMBER = '+19362364789';
//   const TO_NUMBER = '+84939807294';
//   // const TO_NUMBER = '+84931873551';

//   const AUTH_TOKEN = 'bd616461869461e4a19e440e6376ace2';
//   const ACCOUNT_SID = 'AC24c7ad92d2eea7c5aa99563414ae90de';
  
//   const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);
  
//   client.messages
//       .create({
//         body: '123456',
//         from: FROM_NUMBER,
//         to: TO_NUMBER
//       })
//       .then(message => {
//         console.log(message);
//       }).catch((error) => {
//         console.log(error)
//       });
// })

 
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

