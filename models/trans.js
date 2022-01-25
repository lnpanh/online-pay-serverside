const mongoose = require('mongoose');

const TransSchema = new mongoose.Schema({
    name_rcv:{
        type: String,
        required:true
    },
    phone_rcv:{
        type: String,
        required:true
    },
    amount_money:{
        type: Number,
        required:true
    },
    dt:{
        type: Date,
        required:true,
        defautl: Date.now()
    },
    type:{
        type: String,
        required: true
    },
    acc_id:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Accs'
    }
});



const ListTransSchema = new mongoose.Schema({
    TransList: {
        TransList: [TransSchema]
    }
  });


module.exports = ListTrans = mongoose.model('listTrans', ListTransSchema);