import mongoose from 'mongoose';

const flightSchema = new mongoose.Schema(
  {
    flightNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    origin: {
      type: String,
      required: true,
      trim: true,
    },
    destination: {
      type: String,
      required: true,
      trim: true,
    },
    departureTime: {
      type: Date,
      required: true,
    },
    arrivalTime: {
      type: Date,
      required: true,
    },
    aircraftType: {
      type: String,
      required: true,
      trim: true,
    },
    seatCapacity: {
      type: Number,
      required: true,
      min: 1,
    },
    baseFare: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Cancelled', 'Completed'],
      default: 'Scheduled',
    },
    amenities: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

flightSchema.virtual('route').get(function getRoute() {
  return `${this.origin} → ${this.destination}`;
});

const Flight = mongoose.model('Flight', flightSchema);

export default Flight;

