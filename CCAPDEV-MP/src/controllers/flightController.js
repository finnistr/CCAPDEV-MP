import Flight from '../models/Flight.js';
import asyncHandler from '../utils/asyncHandler.js';

const normalizeQuery = (value) => (value ? value.trim() : '');

const buildDateRange = (dateString) => {
  if (!dateString) {
    return null;
  }

  const start = new Date(dateString);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(start);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { $gte: start, $lte: end };
};

export const renderSearchPage = asyncHandler(async (req, res) => {
  const { origin, destination, departure } = req.query;

  const filters = {};
  const originQuery = normalizeQuery(origin);
  const destinationQuery = normalizeQuery(destination);
  const departureRange = buildDateRange(departure);

  if (originQuery) {
    filters.origin = { $regex: new RegExp(originQuery, 'i') };
  }

  if (destinationQuery) {
    filters.destination = { $regex: new RegExp(destinationQuery, 'i') };
  }

  if (departureRange) {
    filters.departureTime = departureRange;
  }

  let flights = [];

  if (Object.keys(filters).length > 0) {
    flights = await Flight.find(filters).sort({ departureTime: 1 });
  }

  res.render('flights/search', {
    title: 'Search Flights',
    filters: {
      origin,
      destination,
      departure,
    },
    flights,
    hasResults: flights.length > 0,
    attemptedSearch: Object.keys(req.query).length > 0,
  });
});

export const listFlights = asyncHandler(async (req, res) => {
  const flights = await Flight.find().sort({ departureTime: 1 });
  res.render('flights/index', {
    title: 'All Flights',
    flights,
  });
});

export const showFlight = asyncHandler(async (req, res) => {
  const flight = await Flight.findById(req.params.id);

  if (!flight) {
    return res.status(404).render('errors/404', {
      title: 'Flight Not Found',
      message: 'The requested flight could not be found.',
    });
  }

  res.render('flights/detail', {
    title: `Flight ${flight.flightNumber}`,
    flight,
  });
});

