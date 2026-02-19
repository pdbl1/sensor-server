// routes/api.js

const express = require('express');
const router = express.Router();
const reedCtl = require('../controllers/reedCtl');
const tempCtl = require('../controllers/tempCtl');

router.post('/temp1', tempCtl.postTempEvent);
router.get('last', tempCtl.getLastTemp);
router.get('/sensors1', tempCtl.getTempSensors);
router.get('/history1', tempCtl.getHistory);


module.exports = router;


