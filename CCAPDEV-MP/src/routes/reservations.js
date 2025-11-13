import { Router } from 'express';
import {
  listReservations,
  renderCreateForm,
  createReservation,
  showReservation,
  updateOptionalPackage,
  removeOptionalPackage,
} from '../controllers/reservationController.js';

const router = Router();

router.get('/', listReservations);
router.get('/new', renderCreateForm);
router.post('/', createReservation);
router.get('/:id', showReservation);
router.put('/:id/passengers/:passengerId/package', updateOptionalPackage);
router.delete('/:id/passengers/:passengerId/package', removeOptionalPackage);

export default router;

