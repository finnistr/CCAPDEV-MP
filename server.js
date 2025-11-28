require('dotenv/config');
const express = require('express');
const expresshbs = require('express-handlebars');
const { connectToMongo } = require('./db/conn.js');
const path = require('path');
const mongoose = require('mongoose');

const port = process.env.PORT || 3000;
const app = express();

// Step 1. Establish MongoDB (Mongoose) connection via your conn.js
connectToMongo((err => {
  if (err) {
    console.error("Error: Failed to establish connection with MongoDB!");
    console.error(err);
    process.exit(1);
  }
  console.log("Successfully connected to MongoDB server via Mongoose!");
}));

// Step 2. Load Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Step 3. MongoDB Schema Models
const User = require('./models/User');
const Flight = require('./models/Flight');
const Reservation = require('./models/Reservation');

// Helper: Avoid CastError and optionally return plain objects for Handlebars
async function safeFindUser(userId, lean = false) {
  if (!userId) return null;
  if (!mongoose.isValidObjectId(userId)) return null;
  return lean
    ? await User.findById(userId).lean()
    : await User.findById(userId);
}

// Step 4. Setup Express Handlebars (hbs)
app.engine('hbs', expresshbs.engine({
  extname: 'hbs',
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
app.set('view engine', 'hbs');
app.set('views', './views');

// -----------------
// Routes
// -----------------

// index.hbs (partials/index)
app.get('/', (req, res) => {
  // optional: if userId provided, you can pass it to the view
  const userId = req.query.userId;
  res.render('partials/index', { userId });
});

// -----------------
// Auth: register / login (plain proof-of-concept; no hashing or sessions)
// -----------------

// GET register
app.get('/register', (req, res) => {
  res.render('partials/register', { layout: false });
});

// POST register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.render('partials/register', {
        layout: false,
        error: 'Registration failed. All fields are required!'
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('partials/register', {
        layout: false,
        error: 'Registration failed. Email is already registered!'
      });
    }

    const user = new User({
      name,
      email,
      password, // plain-text per your current proof-of-concept style
      role
    });

    const saved = await user.save().catch(err => err);
    if (saved instanceof Error) {
      console.error('Save error report from MongoDB:', saved);
      return res.render('partials/register', {
        layout: false,
        error: 'Registration failed. Please try again.'
      });
    }

    console.log('A', saved.role, 'has been registered:', saved._id);
    // Redirect to login with a query flag (handwritten style)
    res.redirect('/login?registered=true');
  } catch (err) {
    console.error('Registration exception:', err);
    res.render('partials/register', {
      layout: false,
      error: 'Registration failed. Please try again.'
    });
  }
});

// GET login
app.get('/login', (req, res) => {
  const registerSuccess = req.query.registered === 'true';
  const errorLog = req.query.error === 'true';
  if (registerSuccess) {
    return res.render('partials/login', { notification: 'Registration is successful!', layout: false });
  }
  if (errorLog) {
    return res.render('partials/login', { error: 'Role mismatch detected!', layout: false });
  }
  res.render('partials/login', { layout: false });
});

// POST login (plain password comparison)
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('partials/login', { layout: false, error: 'Login failed. All fields are required!' });
    }

    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res.render('partials/login', { layout: false, error: 'Login error. Email does not exist!' });
    }

    // plain-text compare to match your proof-of-concept system
    if (existingUser.password !== password) {
      return res.render('partials/login', { layout: false, error: 'Login error. Incorrect password!' });
    }

    console.log('User', existingUser.email, 'has logged in.');

    // Redirect and pass userId in querystring (no session)
    if (existingUser.role === 'admin') {
      return res.redirect(`/admin/flights?userId=${existingUser._id}`);
    } else {
      return res.redirect(`/flights/search?userId=${existingUser._id}`);
    }
  } catch (err) {
    console.error('Login exception:', err);
    res.render('partials/login', { layout: false, error: 'Login failed. Please try again.' });
  }
});

// -----------------
// Passenger routes (use userId via querystring)
// -----------------

// GET flights search (render passenger view)
app.get('/flights/search', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  if (user.role === 'passenger') {
    // load available flights metadata for filters
    const flightsAll = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set((flightsAll || []).map(f => f.origin))].sort();
    const destinations = [...new Set((flightsAll || []).map(f => f.destination))].sort();

    return res.render('partials/passenger/passenger_search', {
      userId: user._id,
      isAdmin: false,
      origins,
      destinations
    });
  }

  if (user.role === 'admin') {
    return res.redirect(`/profile?userId=${user._id}&mismatch=true`);
  }

  res.redirect('/login?error=true');
});

// POST flights search (search results)
app.post('/flights/search', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  if (user.role !== 'passenger') {
    return res.redirect(`/profile?userId=${user._id}&mismatch=true`);
  }

  try {
    const { origin, destination, departureDate } = req.body;

    const query = { isAvailable: true };
    if (origin && origin !== '') query.origin = origin;
    if (destination && destination !== '') query.destination = destination;
    if (departureDate) {
      const searchDate = new Date(departureDate);
      searchDate.setHours(0, 0, 0, 0);
      query.departureTime = { $gte: searchDate };
    }

    const flights = await Flight.find(query).lean();
    flights.forEach(f => {
      f.availableSeats = f.seatCapacity - (f.bookedSeats?.length || 0);
    });

    const allFlights = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set((allFlights || []).map(f => f.origin))].sort();
    const destinations = [...new Set((allFlights || []).map(f => f.destination))].sort();

    return res.render('partials/passenger/passenger_search', {
      userId: user._id,
      isAdmin: false,
      origins,
      destinations,
      flights,
      searched: true,
      searchParams: { origin, destination, departureDate }
    });
  } catch (err) {
    console.error('Search error:', err);
    const allFlights = await Flight.find({ isAvailable: true }).lean();
    const origins = [...new Set((allFlights || []).map(f => f.origin))].sort();
    const destinations = [...new Set((allFlights || []).map(f => f.destination))].sort();

    return res.render('partials/passenger/passenger_search', {
      userId: user._id,
      isAdmin: false,
      origins,
      destinations,
      error: 'Search failed. Please try again.'
    });
  }
});

// Reservation: show form (GET /reservation/form?userId=...&flightId=...)
app.get('/reservation/form', async (req, res) => {
  const userId = req.query.userId;
  const flightId = req.query.flightId;

  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  const flight = mongoose.isValidObjectId(flightId) ? await Flight.findById(flightId).lean() : null;
  if (!flight) return res.send('Flight not found');

  if (user.role === 'passenger') {
    flight.availableSeats = flight.seatCapacity - (flight.bookedSeats?.length || 0);
    // bookedSeats passed as JSON string for client-side seat UI
    return res.render('partials/passenger/passenger_reservation', {
      userId: user._id,
      flightId: flight._id,
      flight,
      bookedSeats: JSON.stringify(flight.bookedSeats || []),
      isAdmin: false
    });
  }

  if (user.role === 'admin') {
    return res.redirect(`/profile?userId=${user._id}&mismatch=true`);
  }

  res.redirect('/login?error=true');
});

// POST create reservation (form should include hidden input name="userId")
app.post('/reservations/create', async (req, res) => {
  try {
    const { userId, flightId, seat, meal, baggageWeight, passport } = req.body;

    const user = await safeFindUser(userId);
    if (!user) return res.redirect('/login?error=true');
    if (user.role !== 'passenger') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

    const flight = await Flight.findById(flightId);
    if (!flight || !flight.isAvailable) return res.redirect('/flights/search?userId=' + user._id);

    if (flight.bookedSeats && flight.bookedSeats.includes(seat)) {
      console.error('Seat already booked:', seat);
      return res.redirect(`/reservation/form?userId=${user._id}&flightId=${flight._id}`);
    }

    const reservation = new Reservation({
      userId: user._id,
      flightId,
      passengerName: user.name,
      passport,
      seat,
      meal,
      baggageWeight: parseInt(baggageWeight) || 0,
      status: 'confirmed'
    });

    // Use model's calculateTotal if present (keeps existing behavior)
    if (typeof reservation.calculateTotal === 'function') {
      reservation.calculateTotal(flight.price);
    }

    await reservation.save();

    if (!flight.bookedSeats) flight.bookedSeats = [];
    flight.bookedSeats.push(seat);
    await flight.save();

    return res.redirect(`/reservations/list?userId=${user._id}`);
  } catch (err) {
    console.error('Error creating reservation:', err);
    // best effort redirect
    return res.redirect('/flights/search');
  }
});

// Reservations list (GET /reservations/list?userId=...)
app.get('/reservations/list', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  if (user.role !== 'passenger') {
    return res.redirect(`/profile?userId=${user._id}&mismatch=true`);
  }

  try {
    const reservations = await Reservation.find({ userId: user._id }).populate('flightId').lean();
    return res.render('partials/passenger/passenger_list', {
      userId: user._id,
      isAdmin: false,
      reservations
    });
  } catch (err) {
    console.error('Error fetching reservations:', err);
    return res.render('partials/passenger/passenger_list', {
      userId: user._id,
      isAdmin: false,
      reservations: [],
      error: 'Failed to load reservations'
    });
  }
});

// Edit reservation (GET /reservations/edit/:id?userId=...)
app.get('/reservations/edit/:id', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  try {
    const reservation = await Reservation.findById(req.params.id).populate('flightId').lean();
    if (!reservation) return res.redirect(`/reservations/list?userId=${user._id}`);

    if (reservation.userId.toString() !== user._id.toString()) {
      return res.redirect(`/reservations/list?userId=${user._id}`);
    }

    const flight = await Flight.findById(reservation.flightId._id).lean();
    const bookedSeats = (flight.bookedSeats || []).filter(s => s !== reservation.seat);

    return res.render('partials/passenger/passenger_reservation_edit', {
      userId: user._id,
      isAdmin: false,
      reservation,
      bookedSeats: JSON.stringify(bookedSeats),
      seatCapacity: flight.seatCapacity
    });
  } catch (err) {
    console.error('Error loading reservation edit:', err);
    return res.redirect(`/reservations/list?userId=${user._id}`);
  }
});

// POST update reservation (form should include hidden userId)
app.post('/reservations/update/:id', async (req, res) => {
  const { userId } = req.body;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  try {
    const { seat, meal, baggageWeight } = req.body;
    const reservation = await Reservation.findById(req.params.id).populate('flightId');
    if (!reservation) return res.redirect(`/reservations/list?userId=${user._id}`);

    if (reservation.userId.toString() !== user._id.toString()) {
      return res.redirect(`/reservations/list?userId=${user._id}`);
    }

    const oldSeat = reservation.seat;
    if (oldSeat !== seat) {
      const flight = await Flight.findById(reservation.flightId._id);
      if (flight.bookedSeats && flight.bookedSeats.includes(seat)) {
        console.error('New seat already booked:', seat);
        return res.redirect(`/reservations/edit/${req.params.id}?userId=${user._id}`);
      }

      flight.bookedSeats = (flight.bookedSeats || []).filter(s => s !== oldSeat);
      flight.bookedSeats.push(seat);
      await flight.save();
    }

    reservation.seat = seat;
    reservation.meal = meal;
    reservation.baggageWeight = parseInt(baggageWeight) || 0;

    if (typeof reservation.calculateTotal === 'function') {
      reservation.calculateTotal(reservation.flightId.price);
    }

    await reservation.save();
    return res.redirect(`/reservations/list?userId=${user._id}`);
  } catch (err) {
    console.error('Error updating reservation:', err);
    return res.redirect(`/reservations/list?userId=${user._id}`);
  }
});

// POST cancel reservation (form should include hidden userId)
app.post('/reservations/cancel/:id', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  try {
    const reservation = await Reservation.findById(req.params.id).populate('flightId');
    if (!reservation) return res.redirect(`/reservations/list?userId=${user._id}`);

    if (reservation.userId.toString() !== user._id.toString()) {
      return res.redirect(`/reservations/list?userId=${user._id}`);
    }

    const flight = await Flight.findById(reservation.flightId._id);
    flight.bookedSeats = (flight.bookedSeats || []).filter(s => s !== reservation.seat);
    await flight.save();

    await Reservation.findByIdAndUpdate(req.params.id, { status: 'cancelled' });

    return res.redirect(`/reservations/list?userId=${user._id}`);
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    return res.redirect(`/reservations/list?userId=${user._id}`);
  }
});

// -----------------
// Admin routes (admin-only via role check, but still using userId query param)
// -----------------

app.get('/admin/flights', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');

  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const flights = await Flight.find().lean();
    flights.forEach(f => {
      f.bookedSeatsCount = (f.bookedSeats || []).length;
      f.availableSeats = f.seatCapacity - f.bookedSeatsCount;
    });

    return res.render('partials/admin/admin_flights', {
      userId: user._id,
      isAdmin: true,
      flights
    });
  } catch (err) {
    console.error('Error fetching flights:', err);
    return res.render('partials/admin/admin_flights', {
      userId: user._id,
      isAdmin: true,
      flights: [],
      error: 'Failed to load flights'
    });
  }
});

app.get('/admin/flights/new', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  return res.render('partials/admin/admin_flight_form', {
    userId: user._id,
    isAdmin: true
  });
});

app.post('/admin/flights/create', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const flightData = {
      ...req.body,
      isAvailable: req.body.isAvailable === 'true',
      bookedSeats: []
    };
    const flight = new Flight(flightData);
    await flight.save();
    console.log('Flight created:', flight._id);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  } catch (err) {
    console.error('Error creating flight:', err);
    return res.redirect(`/admin/flights/new?userId=${user._id}`);
  }
});

app.get('/admin/flights/edit/:id', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const flight = await Flight.findById(req.params.id).lean();
    if (!flight) return res.redirect(`/admin/flights?userId=${user._id}`);

    if (flight.departureTime) flight.departureTime = new Date(flight.departureTime).toISOString().slice(0,16);
    if (flight.arrivalTime) flight.arrivalTime = new Date(flight.arrivalTime).toISOString().slice(0,16);

    return res.render('partials/admin/admin_flight_form', {
      userId: user._id,
      isAdmin: true,
      flight
    });
  } catch (err) {
    console.error('Error fetching flight for edit:', err);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  }
});

app.post('/admin/flights/update/:id', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const updateData = {
      ...req.body,
      isAvailable: req.body.isAvailable === 'true'
    };
    await Flight.findByIdAndUpdate(req.params.id, updateData);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  } catch (err) {
    console.error('Error updating flight:', err);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  }
});

app.post('/admin/flights/delete/:id', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const flightId = req.params.id;
    // cancel confirmed reservations for this flight
    await Reservation.updateMany({ flightId: flightId, status: 'confirmed' }, { status: 'cancelled' });
    await Flight.findByIdAndDelete(flightId);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  } catch (err) {
    console.error('Error deleting flight:', err);
    return res.redirect(`/admin/flights?userId=${user._id}`);
  }
});

app.get('/admin/users', async (req, res) => {
  const userId = req.query.userId;
  const user = await safeFindUser(userId);
  if (!user) return res.redirect('/login?error=true');
  if (user.role !== 'admin') return res.redirect(`/profile?userId=${user._id}&mismatch=true`);

  try {
    const users = await User.find().lean();
    return res.render('partials/admin/admin_users', {
      userId: user._id,
      isAdmin: true,
      users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.render('partials/admin/admin_users', {
      userId: user._id,
      isAdmin: true,
      users: [],
      error: 'Failed to load users'
    });
  }
});

app.post('/admin/users/delete/:id', async (req, res) => {
  const userId = req.body.userId || req.query.userId;
  const adminUser = await safeFindUser(userId);
  if (!adminUser) return res.redirect('/login?error=true');
  if (adminUser.role !== 'admin') return res.redirect(`/profile?userId=${adminUser._id}&mismatch=true`);

  try {
    const userToDelete = req.params.id;
    if (userToDelete === adminUser._id.toString()) {
      console.log('Cannot delete own account');
      return res.redirect(`/admin/users?userId=${adminUser._id}`);
    }
    await User.findByIdAndDelete(userToDelete);
    return res.redirect(`/admin/users?userId=${adminUser._id}`);
  } catch (err) {
    console.error('Error deleting user:', err);
    return res.redirect(`/admin/users?userId=${adminUser._id}`);
  }
});

// -----------------
// Profile (GET & POST) - uses safeFindUser; GET uses lean for template
// -----------------

app.get('/profile', async (req, res) => {
  const updateSuccess = req.query.update === 'true';
  const userId = req.query.userId;
  const user = await safeFindUser(userId, true); // plain object for Handlebars
  if (!user) return res.redirect('/login?error=true');

  if (updateSuccess) {
    return res.render('partials/profile', {
      user,
      userId: user._id,
      isAdmin: user.role === 'admin',
      update: 'Profile has been successfully updated!'
    });
  } else {
    return res.render('partials/profile', {
      user,
      userId: user._id,
      isAdmin: user.role === 'admin',
    });
  }
});

app.post('/profile/update', async (req, res) => {
  const { userId, name, email } = req.body;

  // need mongoose doc for saving
  const modifyUser = await User.findById(userId);  
  if (!modifyUser) return res.redirect('/login?error=true');

  try {
    modifyUser.name = name;
    modifyUser.email = email;

    await modifyUser.save(); // <-- THIS IS THE IMPORTANT PART

    return res.redirect(`/profile?userId=${modifyUser._id}&update=true`);
  } catch (err) {
    console.error('Profile update error:', err);
    return res.redirect(`/profile?userId=${modifyUser._id}`);
  }
});

// -----------------
// End: start server
// -----------------
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
