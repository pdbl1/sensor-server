
// reedEvents.js
const express = require('express');
const router = express.Router();

/**
 * Expected JSON body example:
 * {
 *   "gpio": 4,
 *   "status": true,
 *   "timestamp": 1738872345
 * }
 */

router.post('/reed-event', (req, res) => {
    const event = req.body;

    if (!event || typeof event.gpio === 'undefined') {
        return res.status(400).json({ error: 'Invalid reed event payload' });
    }

    console.log('📡 Reed Event Received:');
    console.log(`  GPIO: ${event.gpio}`);
    console.log(`  Status: ${event.status ? 'OPEN' : 'CLOSED'}`);
    console.log(`  Timestamp: ${event.timestamp}`);
    console.log('----------------------------------');

    res.json({ ok: true });
});

module.exports = router;
