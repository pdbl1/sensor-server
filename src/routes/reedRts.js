const express = require('express');
const router = express.Router();
const reedCtl = require('../controllers/reedCtl');
const checkESP32Key = require('./authRoutes');

router.post('/reed-event', checkESP32Key, reedCtl.postReedEvent);
router.get('/reed-sensors', reedCtl.getReedSensors);
router.get('/reed-display', reedCtl.getReedDisplay);
router.get('/reed-status', reedCtl.getReedStatus);

module.exports = router;