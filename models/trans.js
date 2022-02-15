const mongoose = require('mongoose');

const TransSchema = new mongoose.Schema({
    name_rcv:{
        type: String
    },
    phone_rcv:{
        type: String
    },
    name_send:{
        type: String
    },

    name_3rd_party:{
        type: String
    },

    num_3rd_party:{
        type: String
    },

    phone_send:{
        type: String
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

module.exports = Trans = mongoose.model('Trans', TransSchema);