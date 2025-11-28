const mongoose = require('mongoose');

const baggageSchema = new mongoose.Schema({
  weight: {
    type: Number,
    required: true,
    default: 0
  },
  price: {
    type: Number,
    required: true,
    default: 0
  }
});

module.exports = baggageSchema;