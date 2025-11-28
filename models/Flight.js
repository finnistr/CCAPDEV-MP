// models/flight.js
const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: {
    type: String,
    required: true,
    unique: true,
  },
  airline: {
    type: String,
    required: true,
  },
  origin: {
    type: String,
    required: true,
  },
  destination: {
    type: String,
    required: true,
  },
  departureTime: {
    type: Date,
    required: true,
  },
  arrivalTime: {
    type: Date,
    required: true,
  },
  aircraft: {
    type: String,
    required: true,
  },
  seatCapacity: {
    type: Number,
    required: true,
    min: 0,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
    isAvailable: {
    type: Boolean,
    default: true
  },
    bookedSeats: {
    type: [String],
    default: []
  }
});

module.exports = mongoose.model('Flight', flightSchema);
