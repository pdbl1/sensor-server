// routes/api.js

const express = require('express');
const router = express.Router();
const reedCtl = require('../controllers/reedCtl');
const checkESP32Key = require('./authRoutes');
const tempCtl = require('../controllers/tempCtl');

router.post('/temp1', checkESP32Key, tempCtl.postTempEvent);
router.get('last', tempCtl.getLastTemp);
router.get('/sensors1', tempCtl.getSensorList);
router.get('/history1', tempCtl.getHistory);


module.exports = router;


