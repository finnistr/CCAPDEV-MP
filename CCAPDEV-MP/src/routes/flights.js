import { Router } from 'express';
import { renderSearchPage, listFlights, showFlight } from '../controllers/flightController.js';

const router = Router();

router.get('/search', renderSearchPage);
router.get('/', listFlights);
router.get('/:id', showFlight);

export default router;

