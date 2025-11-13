const express = require('express');
const router = express.Router();
const Flight = require('../models/flight'); // Import flight model

// GET /admin/flights : Show all flights
router.get('/flights', async (req, res) => {
  try {
    const flights = await Flight.find().lean();
    res.render('admin-flights', {
      title: 'Admin - Flight Management',
      flights: flights,
      layout: 'main'
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// GET /admin/flights/add : Show form to add a new flight
router.get('/flights/add', (req, res) => {
  res.render('admin-flight-form', { // Handlebars
    title: 'Add New Flight',
    action: '/admin/flights/add', // Form post URL
    isNew: true
  });
});

// POST /admin/flights/add : Create a new flight
router.post('/flights/add', async (req, res) => {
  try {
    const newFlight = new Flight(req.body);
    await newFlight.save();
    res.redirect('/admin/flights');
  } catch (err) {
    console.error(err);
    res.render('admin-flight-form', { // Handlebars
        title: 'Add New Flight',
        action: '/admin/flights/add',
        isNew: true,
        error: 'Failed to add flight. Check your inputs.'
    });
  }
});

// GET /admin/flights/edit/:id : Show form to edit a flight
router.get('/flights/edit/:id', async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id).lean();
    if (!flight) {
      return res.status(404).send('Flight not found');
    }
    res.render('admin-flight-form', { // Handlebars
      title: 'Edit Flight',
      action: `/admin/flights/update/${flight._id}`, // Form post URL
      flight: flight,
      isNew: false
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// POST /admin/flights/update/:id : Update a flight
router.post('/flights/update/:id', async (req, res) => {
  try {
    await Flight.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/admin/flights');
  } catch (err) {
     console.error(err);
     const flight = req.body;
     flight._id = req.params.id;
     res.render('admin-flight-form', {
        title: 'Edit Flight',
        action: `/admin/flights/update/${flight._id}`,
        flight: flight,
        isNew: false,
        error: 'Failed to update flight. Check your inputs.'
    });
  }
});

// GET /admin/flights/delete/:id : Delete a flight
router.get('/flights/delete/:id', async (req, res) => {
  try {
    await Flight.findByIdAndDelete(req.params.id);
    res.redirect('/admin/flights');
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Export for use in server.js
module.exports = router;