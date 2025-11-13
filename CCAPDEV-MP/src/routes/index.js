import { Router } from 'express';
import Flight from '../models/Flight.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const upcomingFlights = await Flight.find({ status: 'Scheduled' })
      .sort({ departureTime: 1 })
      .limit(6);

    res.render('home', {
      title: 'CCS Airlines',
      upcomingFlights,
    });
  }),
);

export default router;

