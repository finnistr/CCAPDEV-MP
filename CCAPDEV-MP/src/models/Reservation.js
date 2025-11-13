import mongoose from 'mongoose';

const optionalPackageSchema = new mongoose.Schema(
  {
    meal: {
      type: String,
      enum: ['none', 'standard', 'vegetarian', 'kosher'],
      default: 'none',
    },
    seat: {
      type: String,
      default: null,
      trim: true,
    },
    seatClass: {
      type: String,
      enum: ['economy', 'premium', 'business', 'first'],
      default: 'economy',
    },
    baggageCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    baggagePrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    mealPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    seatPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    _id: false,
  },
);

const passengerSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    passportNumber: {
      type: String,
      required: true,
      trim: true,
    },
    optionalPackage: {
      type: optionalPackageSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    flight: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Flight',
      required: true,
    },
    passengers: [passengerSchema],
    status: {
      type: String,
      enum: ['Pending', 'Confirmed', 'Cancelled'],
      default: 'Pending',
    },
    baseFareTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    optionalPackageTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    grandTotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

reservationSchema.methods.calculateTotals = function calculateTotals(baseFare = 0) {
  const packageTotal = this.passengers.reduce((sum, passenger) => {
    const pkg = passenger.optionalPackage || {};
    return (
      sum +
      (pkg.mealPrice || 0) +
      (pkg.baggagePrice || 0) +
      (pkg.seatPrice || 0)
    );
  }, 0);

  this.baseFareTotal = baseFare;
  this.optionalPackageTotal = packageTotal;
  this.grandTotal = baseFare + packageTotal;

  return {
    baseFareTotal: this.baseFareTotal,
    optionalPackageTotal: this.optionalPackageTotal,
    grandTotal: this.grandTotal,
  };
};

reservationSchema.pre('save', function preSave(next) {
  this.calculateTotals(this.baseFareTotal);
  next();
});

const Reservation = mongoose.model('Reservation', reservationSchema);

export default Reservation;

