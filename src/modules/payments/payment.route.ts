import { Router } from 'express';
import { paymentController } from './payment.controller';

const router = Router();

// Webhook listener (called by payment gateway servers)
router.post('/webhook', paymentController.handleWebhook);

export default router;
