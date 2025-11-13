import Reservation from '../models/Reservation.js';
import Flight from '../models/Flight.js';
import asyncHandler from '../utils/asyncHandler.js';

const MEAL_PRICING = {
  none: 0,
  standard: 50,
  vegetarian: 60,
  kosher: 70,
};

const BAGGAGE_PRICE = 30;

const defaultOptionalPackage = () => ({
  meal: 'none',
  mealPrice: 0,
  seat: null,
  seatClass: 'economy',
  seatPrice: 0,
  baggageCount: 0,
  baggagePrice: 0,
  notes: '',
});

const buildOptionalPackage = ({ meal, seat, baggageCount }) => {
  const normalizedMeal = meal && MEAL_PRICING[meal] !== undefined ? meal : 'none';
  const mealPrice = MEAL_PRICING[normalizedMeal] || 0;
  const sanitizedSeat = seat ? seat.trim().toUpperCase() : null;
  const sanitizedBaggageCount = Math.max(Number(baggageCount) || 0, 0);
  const baggagePrice = sanitizedBaggageCount * BAGGAGE_PRICE;

  return {
    ...defaultOptionalPackage(),
    meal: normalizedMeal,
    seat: sanitizedSeat,
    baggageCount: sanitizedBaggageCount,
    mealPrice,
    baggagePrice,
  };
};

const getReservedSeats = (reservations) => {
  const seats = new Set();
  reservations.forEach((reservation) => {
    reservation.passengers.forEach((passenger) => {
      const seat = passenger.optionalPackage?.seat;
      if (seat) {
        seats.add(seat);
      }
    });
  });
  return Array.from(seats);
};

export const listReservations = asyncHandler(async (req, res) => {
  const reservations = await Reservation.find()
    .populate('flight')
    .sort({ createdAt: -1 })
    .lean({ virtuals: true, defaults: true });

  res.render('reservations/list', {
    title: 'My Reservations',
    reservations,
  });
});

export const renderCreateForm = asyncHandler(async (req, res) => {
  const flightsRaw = await Flight.find().sort({ departureTime: 1 }).lean();
  const flights = flightsRaw.map((flight) => ({
    ...flight,
    _id: flight._id.toString(),
  }));
  let selectedFlight = null;
  let reservedSeats = [];

  if (req.query.flightId) {
    selectedFlight = flights.find((flight) => flight._id === req.query.flightId) || null;

    if (selectedFlight) {
      const flightReservations = await Reservation.find({ flight: req.query.flightId });
      reservedSeats = getReservedSeats(flightReservations);
    }
  }

  res.render('reservations/form', {
    title: 'Book a Flight',
    flights,
    selectedFlight,
    selectedFlightId: selectedFlight ? selectedFlight._id : '',
    reservedSeats,
    pricing: {
      meal: MEAL_PRICING,
      baggagePerUnit: BAGGAGE_PRICE,
    },
  });
});

export const createReservation = asyncHandler(async (req, res) => {
  const {
    flightId,
    fullName,
    email,
    passportNumber,
    meal,
    seat,
    baggageCount,
    notes,
  } = req.body;

  const flight = await Flight.findById(flightId);

  if (!flight) {
    return res.status(404).render('errors/404', {
      title: 'Flight Not Found',
      message: 'The flight you attempted to book was not found.',
    });
  }

  const reservationDocs = await Reservation.find({ flight: flight._id }, 'passengers.optionalPackage');
  const reservedSeats = getReservedSeats(reservationDocs);

  if (seat && reservedSeats.includes(seat.toUpperCase())) {
    return res.status(409).render('reservations/form', {
      title: 'Book a Flight',
      flights: [flight],
      selectedFlight: flight,
      reservedSeats,
      pricing: {
        meal: MEAL_PRICING,
        baggagePerUnit: BAGGAGE_PRICE,
      },
      error: `Seat ${seat} is no longer available. Please choose another seat.`,
      formData: req.body,
    });
  }

  const optionalPackage = buildOptionalPackage({ meal, seat, baggageCount });

  const reservation = new Reservation({
    flight: flight._id,
    passengers: [
      {
        fullName,
        email,
        passportNumber,
        optionalPackage,
      },
    ],
    baseFareTotal: flight.baseFare,
    notes,
  });

  reservation.calculateTotals(flight.baseFare);
  await reservation.save();

  res.redirect(`/reservations/${reservation._id}`);
});

export const showReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findById(req.params.id)
    .populate('flight')
    .lean({ virtuals: true, defaults: true });

  if (!reservation) {
    return res.status(404).render('errors/404', {
      title: 'Reservation Not Found',
      message: 'The reservation you are trying to view does not exist.',
    });
  }

  res.render('reservations/detail', {
    title: 'Reservation Details',
    reservation,
    mealPricing: MEAL_PRICING,
    baggagePrice: BAGGAGE_PRICE,
  });
});

export const updateOptionalPackage = asyncHandler(async (req, res) => {
  const { id, passengerId } = req.params;
  const { meal, seat, baggageCount, notes } = req.body;

  const reservation = await Reservation.findById(id).populate('flight');

  if (!reservation) {
    return res.status(404).render('errors/404', {
      title: 'Reservation Not Found',
      message: 'The reservation you attempted to update does not exist.',
    });
  }

  const passenger = reservation.passengers.id(passengerId);

  if (!passenger) {
    return res.status(404).render('errors/404', {
      title: 'Passenger Not Found',
      message: 'Unable to locate the passenger for this reservation.',
    });
  }

  const reservationDocs = await Reservation.find(
    {
      flight: reservation.flight._id,
      'passengers._id': { $ne: passenger._id },
    },
    'passengers.optionalPackage.seat',
  );
  const reservedSeats = getReservedSeats(reservationDocs);

  if (seat && reservedSeats.includes(seat.toUpperCase())) {
    return res.status(409).render('reservations/detail', {
      title: 'Reservation Details',
      reservation,
      mealPricing: MEAL_PRICING,
      baggagePrice: BAGGAGE_PRICE,
      error: `Seat ${seat} is already taken. Please select a different seat.`,
    });
  }

  const optionalPackage = buildOptionalPackage({ meal, seat, baggageCount });
  optionalPackage.notes = notes || '';

  passenger.optionalPackage = optionalPackage;
  reservation.calculateTotals(reservation.baseFareTotal);
  await reservation.save();

  res.redirect(`/reservations/${reservation._id}`);
});

export const removeOptionalPackage = asyncHandler(async (req, res) => {
  const { id, passengerId } = req.params;

  const reservation = await Reservation.findById(id).populate('flight');

  if (!reservation) {
    return res.status(404).render('errors/404', {
      title: 'Reservation Not Found',
      message: 'The reservation you attempted to update does not exist.',
    });
  }

  const passenger = reservation.passengers.id(passengerId);

  if (!passenger) {
    return res.status(404).render('errors/404', {
      title: 'Passenger Not Found',
      message: 'Unable to locate the passenger for this reservation.',
    });
  }

  passenger.optionalPackage = defaultOptionalPackage();
  reservation.calculateTotals(reservation.baseFareTotal);
  await reservation.save();

  res.redirect(`/reservations/${reservation._id}`);
});

