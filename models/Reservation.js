const mongoose = require('mongoose');
const baggageSchema = require('./ReservationBaggage.js');

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

  // ⬇️ NEW: multiple baggages
  baggages: {
    type: [baggageSchema],
    default: []
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

// Method to calculate total
reservationSchema.methods.calculateTotal = function (flightPrice) {
  const mealPrices = {
    'None': 0,
    'Standard': 50,
    'Vegetarian': 60,
    'Kosher': 70
  };

  this.mealPrice = mealPrices[this.meal] || 0;

  // Calculate baggage prices for each entry
  this.baggages.forEach(b => {
    b.price = b.weight * 5; // Php 5 per kg placeholder
  });

  const totalBaggagePrice = this.baggages.reduce((sum, b) => sum + b.price, 0);

  this.totalAmount = flightPrice + this.mealPrice + totalBaggagePrice;
};

module.exports = mongoose.model('Reservation', reservationSchema);