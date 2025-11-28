process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server'); // Mock database for testing
const app = require('../server');
let mongoServer;

// Start database before tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();

  // Disconnect any existing connection from server.js execution
  await mongoose.disconnect(); 
  await mongoose.connect(mongoServer.getUri());
});

// Close database after tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('CCS Airlines Unit Tests', () => {
  // Agents allows sessions across requests
  const passengerAgent = request.agent(app);
  const adminAgent = request.agent(app);
  
  let flightId;
  let reservationId;

  // User Authentication Tests
  describe('1. User Authentication', () => {
    test('POST /register - Should register a new passenger', async () => {
      const res = await request(app).post('/register').send({
        name: 'Mike James',
        email: 'mikejames@gmail.com',
        password: 'password123',
        role: 'passenger'
      });
      expect(res.statusCode).toBe(302); // Redirects to login
      expect(res.headers.location).toBe('/login');
    });

    test('POST /login - Should login successfully (Valid)', async () => {
      const res = await passengerAgent.post('/login').send({
        email: 'mikejames@gmail.com',
        password: 'password123'
      });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toBe('/flights/search');
    });

    test('POST /login - Should fail with incorrect password (Invalid)', async () => {
      const res = await request(app).post('/login').send({
        email: 'mikejames@gmail.com',
        password: 'wrongpassword'
      });
      expect(res.text).toContain('Invalid credentials');
    });
  });

  // Flight Creation Tests
  describe('2. Flight Creation with Admin Account', () => {
    // Register and login as Admin first
    beforeAll(async () => {
      await request(app).post('/register').send({
        name: 'Admin User',
        email: 'admin@gmail.com',
        password: 'adminpass',
        role: 'admin'
      });
      await adminAgent.post('/login').send({
        email: 'admin@gmail.com',
        password: 'adminpass'
      });
    });

    test('POST /admin/flights/create - Should create flight as admin (Valid)', async () => {
      const res = await adminAgent.post('/admin/flights/create').send({
        flightNumber: 'CCS-101',
        airline: 'Philippine Airlines',
        origin: 'Manila',
        destination: 'Tokyo',
        departureTime: new Date(Date.now() + 86400000), // Tomorrow
        arrivalTime: new Date(Date.now() + 90000000),
        aircraft: 'Boeing 737',
        seatCapacity: 200,
        price: 10000,
        isAvailable: 'true'
      });
      
      expect(res.statusCode).toBe(302); // Redirect to admin flights list
      
      // Verify in DB
      const flight = await mongoose.model('Flight').findOne({ flightNumber: 'CCS-101' });
      expect(flight).toBeTruthy();
      flightId = flight._id;
    });

    test('POST /admin/flights/create - Should deny access to passenger (Invalid)', async () => {
      const res = await passengerAgent.post('/admin/flights/create').send({
        flightNumber: 'FAIL-101',
        airline: 'Philippine Airlines',
      });
      expect(res.statusCode).toBe(403); // Access denied
    });
  });

  // Reservations Tests
  describe('3. Reservations', () => {
    test('POST /reservations/create - Should create a reservation (Valid)', async () => {
      const res = await passengerAgent.post('/reservations/create').send({
        flightId: flightId,
        seat: '1A',
        passport: 'P1234567A',
        meal: 'Standard',
        baggageWeight: 10
      });
      
      expect(res.statusCode).toBe(302); // Redirect to list
      
      // Verify in DB
      const reservation = await mongoose.model('Reservation').findOne({ seat: '1A' });
      expect(reservation).toBeTruthy();
      expect(reservation.status).toBe('confirmed');
      reservationId = reservation._id;
    });

    test('POST /reservations/create - Should fail if seat taken (Invalid)', async () => {
      const res = await passengerAgent.post('/reservations/create').send({
        flightId: flightId,
        seat: '1A', // Same seat
        passport: 'P9999999',
        meal: 'None',
        baggageWeight: 5
      });

      expect(res.statusCode).toBe(302); // Redirect back to the form
      expect(res.headers.location).toContain(`/reservations/new/${flightId}`);
    });

    test('POST /reservations/cancel/:id - Should cancel reservation', async () => {
      const res = await passengerAgent.post(`/reservations/cancel/${reservationId}`);
      expect(res.statusCode).toBe(302);
      
      const reservation = await mongoose.model('Reservation').findById(reservationId);
      expect(reservation.status).toBe('cancelled');
    });
  });
});
