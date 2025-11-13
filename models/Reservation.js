const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  flightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flight',
    required: true
  },
  passengerName: {
    type: String,
    required: true
  },
  passport: {
    type: String,
    required: true
  },
  seat: {
    type: String,
    required: true
  },
  meal: {
    type: String,
    enum: ['None', 'Standard', 'Vegetarian', 'Kosher'],
    default: 'None'
  },
  mealPrice: {
    type: Number,
    default: 0
  },
  baggageWeight: {
    type: Number,
    default: 0
  },
  baggagePrice: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed'
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Method to calculate total amount
reservationSchema.methods.calculateTotal = function(flightPrice) {
  // Meal prices
  const mealPrices = {
    'None': 0,
    'Standard': 50,
    'Vegetarian': 60,
    'Kosher': 70
  };
  
  this.mealPrice = mealPrices[this.meal] || 0;
  
  // Baggage pricing: Php 5 per kg [placeholder price]
  this.baggagePrice = this.baggageWeight * 5;
  
  // Calculate total
  this.totalAmount = flightPrice + this.mealPrice + this.baggagePrice;
};

module.exports = mongoose.model('Reservation', reservationSchema);