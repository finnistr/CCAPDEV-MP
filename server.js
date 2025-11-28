const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const { engine } = require('express-handlebars');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

// MongoDB Connection
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect('mongodb://localhost:27017/ccs_airlines')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });
}

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Handlebars Setup
app.engine('handlebars', engine({
  defaultLayout: 'main',
  helpers: {
    eq: (a, b) => a === b,
    formatDate: (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleDateString();
    },
    formatTime: (date) => {
      if (!date) return 'N/A';
      const d = new Date(date);
      return isNaN(d.getTime()) ? 'Invalid Time' : d.toLocaleTimeString();
    }
  }
}));
app.set('view engine', 'handlebars');
app.set('views', './views');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: 'ccs-airlines-secret',
  resave: false,
  saveUninitialized: false
}));

// Auth Middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).send('Access denied');
  }
  next();
};

// Models
const User = require('./models/User');
const Flight = require('./models/Flight');
const Reservation = require('./models/Reservation');

// Routes

// Home
app.get('/', (req, res) => {
  res.render('index', {
    user: req.session.userId ? { name: req.session.userName, role: req.session.role } : null
  });
});

// Auth Routes
app.get('/register', (req, res) => {
  res.render('register', { layout: false });
});

app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('register', { 
        error: 'Email already registered', 
        layout: false 
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || 'passenger'
    });
    
    await user.save();
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    res.render('register', { 
      error: error.code === 11000 ? 'Email already registered' : 'Registration failed. Please try again.', 
      layout: false 
    });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { layout: false });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid credentials', layout: false });
    }
    
    req.session.userId = user._id;
    req.session.userName = user.name;
    req.session.role = user.role;
    
    if (user.role === 'admin') {
      res.redirect('/admin/flights');
    } else {
      res.redirect('/flights/search');
    }
  } catch (error) {
    res.render('login', { error: 'Login failed', layout: false });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Profile
app.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.redirect('/login');
    }
    res.render('profile', { 
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.redirect('/');
  }
});

app.post('/profile/update', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    await User.findByIdAndUpdate(req.session.userId, { name, email });
    req.session.userName = name;
    res.redirect('/profile');
  } catch (error) {
    res.redirect('/profile');
  }
});

// Flight Search
app.get('/flights/search', requireAuth, async (req, res) => {
  try {
    // Only get available flights
    const flights = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set(flights.map(f => f.origin))].sort();
    const destinations = [...new Set(flights.map(f => f.destination))].sort();
    
    res.render('flightsearch', { 
      user: { name: req.session.userName },
      origins: origins,
      destinations: destinations
    });
  } catch (error) {
    console.error('Error loading search page:', error);
    res.render('flightsearch', { 
      user: { name: req.session.userName },
      origins: [],
      destinations: [],
      error: 'Failed to load search options'
    });
  }
});

app.post('/flights/search', requireAuth, async (req, res) => {
  try {
    const { origin, destination, departureDate } = req.body;
    console.log('Search params:', { origin, destination, departureDate });
    
    // Build query - only search available flights
    const query = { isAvailable: true };
    if (origin && origin !== '') {
      query.origin = origin;
    }
    if (destination && destination !== '') {
      query.destination = destination;
    }
    if (departureDate) {
      const searchDate = new Date(departureDate);
      searchDate.setHours(0, 0, 0, 0);
      query.departureTime = { $gte: searchDate };
    }
    
    console.log('Search query:', query);
    
    const flights = await Flight.find(query).lean();
    console.log('Flights found:', flights.length);
    
    // Calculate available seats for each flight
    flights.forEach(flight => {
      flight.availableSeats = flight.seatCapacity - (flight.bookedSeats?.length || 0);
    });
    
    const allFlights = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set(allFlights.map(f => f.origin))].sort();
    const destinations = [...new Set(allFlights.map(f => f.destination))].sort();
    
    res.render('flightsearch', {
      user: { name: req.session.userName },
      origins: origins,
      destinations: destinations,
      flights: flights,
      searched: true,
      searchParams: { origin, destination, departureDate }
    });
  } catch (error) {
    console.error('Search error:', error);
    const allFlights = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set(allFlights.map(f => f.origin))].sort();
    const destinations = [...new Set(allFlights.map(f => f.destination))].sort();
    
    res.render('flightsearch', { 
      user: { name: req.session.userName },
      origins: origins,
      destinations: destinations,
      error: 'Search failed. Please try again.' 
    });
  }
});

// Reservations
app.get('/reservations/new/:flightId', requireAuth, async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.flightId).lean();
    if (!flight || !flight.isAvailable) {
      return res.redirect('/flights/search');
    }
    
    // Add available seats count
    flight.availableSeats = flight.seatCapacity - (flight.bookedSeats?.length || 0);
    
    res.render('reservationform', { 
      user: { name: req.session.userName },
      flight: flight,
      bookedSeats: JSON.stringify(flight.bookedSeats || [])
    });
  } catch (error) {
    console.error('Error loading reservation form:', error);
    res.redirect('/flights/search');
  }
});

app.post('/reservations/create', requireAuth, async (req, res) => {
  try {
    const { flightId, seat, meal, baggageWeight, passport } = req.body;
    
    console.log('Creating reservation:', { flightId, seat, meal, baggageWeight, passport });
    
    // Get flight details
    const flight = await Flight.findById(flightId);
    if (!flight || !flight.isAvailable) {
      console.error('Flight not found or not available');
      return res.redirect('/flights/search');
    }
    
    // Check if seat is already booked
    if (flight.bookedSeats && flight.bookedSeats.includes(seat)) {
      console.error('Seat already booked:', seat);
      return res.redirect(`/reservations/new/${flightId}`);
    }
    
    // Create reservation
    const reservation = new Reservation({
      userId: req.session.userId,
      flightId,
      passengerName: req.session.userName,
      passport,
      seat,
      meal,
      baggageWeight: parseInt(baggageWeight) || 0,
      status: 'confirmed'
    });
    
    // Calculate total price
    reservation.calculateTotal(flight.price);
    
    // Save reservation
    await reservation.save();
    console.log('Reservation created:', reservation._id);
    
    // Update flight with booked seat
    if (!flight.bookedSeats) {
      flight.bookedSeats = [];
    }
    flight.bookedSeats.push(seat);
    await flight.save();
    console.log('Flight updated with booked seat:', seat);
    
    res.redirect('/reservations/list');
  } catch (error) {
    console.error('Error creating reservation:', error);
    res.redirect('/flights/search');
  }
});

app.get('/reservations/list', requireAuth, async (req, res) => {
  try {
    const reservations = await Reservation.find({ userId: req.session.userId })
      .populate('flightId')
      .lean();
    
    console.log('Reservations found:', reservations.length);
    
    res.render('reservationlist', {
      user: { name: req.session.userName },
      reservations
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.render('reservationlist', {
      user: { name: req.session.userName },
      reservations: [],
      error: 'Failed to load reservations'
    });
  }
});

app.get('/reservations/edit/:id', requireAuth, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate('flightId').lean();
    if (!reservation) {
      return res.redirect('/reservations/list');
    }
    
    // Check ownership
    if (reservation.userId.toString() !== req.session.userId.toString()) {
      return res.redirect('/reservations/list');
    }
    
    // Get current booked seats (excluding this reservation's seat)
    const flight = await Flight.findById(reservation.flightId._id).lean();
    const bookedSeats = flight.bookedSeats.filter(s => s !== reservation.seat);
    
    res.render('reservationedit', {
      user: { name: req.session.userName },
      reservation,
      bookedSeats: JSON.stringify(bookedSeats),
      seatCapacity: flight.seatCapacity
    });
  } catch (error) {
    console.error('Error loading reservation edit:', error);
    res.redirect('/reservations/list');
  }
});

app.post('/reservations/update/:id', requireAuth, async (req, res) => {
  try {
    const { seat, meal, baggageWeight } = req.body;
    
    console.log('Updating reservation:', req.params.id, { seat, meal, baggageWeight });
    
    // Get the reservation with flight details
    const reservation = await Reservation.findById(req.params.id).populate('flightId');
    if (!reservation) {
      return res.redirect('/reservations/list');
    }
    
    // Check ownership
    if (reservation.userId.toString() !== req.session.userId.toString()) {
      return res.redirect('/reservations/list');
    }
    
    const oldSeat = reservation.seat;
    
    // Update flight's booked seats if seat changed
    if (oldSeat !== seat) {
      const flight = await Flight.findById(reservation.flightId._id);
      
      // Check if new seat is available
      if (flight.bookedSeats && flight.bookedSeats.includes(seat)) {
        console.error('New seat already booked:', seat);
        return res.redirect(`/reservations/edit/${req.params.id}`);
      }
      
      // Remove old seat and add new seat
      flight.bookedSeats = flight.bookedSeats.filter(s => s !== oldSeat);
      flight.bookedSeats.push(seat);
      await flight.save();
      console.log('Flight seats updated:', { removed: oldSeat, added: seat });
    }
    
    // Update reservation fields
    reservation.seat = seat;
    reservation.meal = meal;
    reservation.baggageWeight = parseInt(baggageWeight) || 0;
    
    // Re-calculate prices
    reservation.calculateTotal(reservation.flightId.price);
    
    await reservation.save();
    console.log('Reservation updated:', reservation._id);
    res.redirect('/reservations/list');
  } catch (error) {
    console.error('Error updating reservation:', error);
    res.redirect('/reservations/list');
  }
});

app.post('/reservations/cancel/:id', requireAuth, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate('flightId');
    if (!reservation) {
      return res.redirect('/reservations/list');
    }
    
    // Check ownership
    if (reservation.userId.toString() !== req.session.userId.toString()) {
      return res.redirect('/reservations/list');
    }
    
    // Remove seat from flight's booked seats
    const flight = await Flight.findById(reservation.flightId._id);

    //Array initialization
    if (!flight.bookedSeats) {
        flight.bookedSeats = [];
    }

    flight.bookedSeats = flight.bookedSeats.filter(s => s !== reservation.seat);
    await flight.save();
    console.log('Seat freed:', reservation.seat);
    
    // Update reservation status
    await Reservation.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    console.log('Reservation cancelled:', req.params.id);
    res.redirect('/reservations/list');
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.redirect('/reservations/list');
  }
});

// Admin Routes
app.get('/admin/flights', requireAdmin, async (req, res) => {
  try {
    const flights = await Flight.find().lean();
    console.log('Flights fetched:', flights);
    
    // Add booking statistics for each flight
    flights.forEach(flight => {
      flight.bookedSeatsCount = flight.bookedSeats?.length || 0;
      flight.availableSeats = flight.seatCapacity - flight.bookedSeatsCount;
    });
    
    res.render('admin_flights', {
      user: { name: req.session.userName, role: 'admin' },
      flights: flights
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    res.render('admin_flights', {
      user: { name: req.session.userName, role: 'admin' },
      flights: [],
      error: 'Failed to load flights'
    });
  }
});

app.get('/admin/flights/new', requireAdmin, (req, res) => {
  res.render('admin_flight_form', {
    user: { name: req.session.userName, role: 'admin' }
  });
});

app.post('/admin/flights/create', requireAdmin, async (req, res) => {
  try {
    console.log('Creating flight with data:', req.body);
    const flightData = {
      ...req.body,
      isAvailable: String(req.body.isAvailable) === 'true',
      bookedSeats: []
    };
    const flight = new Flight(flightData);
    await flight.save();
    console.log('Flight created successfully:', flight._id);
    res.redirect('/admin/flights');
  } catch (error) {
    console.error('Error creating flight:', error);
    res.redirect('/admin/flights/new');
  }
});

app.get('/admin/flights/edit/:id', requireAdmin, async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id).lean();
    if (!flight) {
      return res.redirect('/admin/flights');
    }
    
    // Format dates for datetime-local input
    if (flight.departureTime) {
      flight.departureTime = new Date(flight.departureTime).toISOString().slice(0, 16);
    }
    if (flight.arrivalTime) {
      flight.arrivalTime = new Date(flight.arrivalTime).toISOString().slice(0, 16);
    }
    
    console.log('Flight to edit:', flight);
    res.render('admin_flight_form', {
      user: { name: req.session.userName, role: 'admin' },
      flight: flight
    });
  } catch (error) {
    console.error('Error fetching flight for edit:', error);
    res.redirect('/admin/flights');
  }
});

app.post('/admin/flights/update/:id', requireAdmin, async (req, res) => {
  try {
    console.log('Updating flight:', req.params.id, 'with data:', req.body);
    const updateData = {
      ...req.body,
      isAvailable: String(req.body.isAvailable) === 'true'
    };
    await Flight.findByIdAndUpdate(req.params.id, updateData);
    console.log('Flight updated successfully');
    res.redirect('/admin/flights');
  } catch (error) {
    console.error('Error updating flight:', error);
    res.redirect('/admin/flights');
  }
});

app.post('/admin/flights/delete/:id', requireAdmin, async (req, res) => {
  try {
    const flightId = req.params.id;
    console.log('Deleting flight:', flightId);
    
    // Also cancel all reservations for this flight
    await Reservation.updateMany(
      { flightId: flightId, status: 'confirmed' },
      { status: 'cancelled' }
    );
    
    await Flight.findByIdAndDelete(flightId);
    console.log('Flight deleted successfully');
    res.redirect('/admin/flights');
  } catch (error) {
    console.error('Error deleting flight:', error);
    res.redirect('/admin/flights');
  }
});

app.get('/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find().lean();
    console.log('Users fetched:', users);
    res.render('admin_users', {
      user: { name: req.session.userName, role: 'admin' },
      users: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.render('admin_users', {
      user: { name: req.session.userName, role: 'admin' },
      users: [],
      error: 'Failed to load users'
    });
  }
});

app.post('/admin/users/delete/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    console.log('Deleting user:', userId);
    
    if (userId === req.session.userId.toString()) {
      console.log('Cannot delete own account');
      return res.redirect('/admin/users');
    }
    
    await User.findByIdAndDelete(userId);
    console.log('User deleted successfully');
    res.redirect('/admin/users');
  } catch (error) {
    console.error('Error deleting user:', error);
	res.redirect('/admin/users');
  }
});

const PORT = process.env.PORT || 3000; 
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
