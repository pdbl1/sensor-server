
// reedEvents.js
const express = require('express');
const router = express.Router();
const net = require('net');
const fs = require('fs/promises');
const path = require('path');

/**
 * Expected JSON body example:
 * {
 *   "gpio": 4,
 *   "status": true,
 *   "timestamp": 1738872345
 * }
 */

const ESP32_IP_ADDRESS = "192.168.50.112";

module.exports = function createReedRoutes({ DATA_DIR, MAX_FILE_SIZE, MAX_RECORDS }) {

    const filePath = path.join(DATA_DIR, 'reed-events.jsonl');

    router.post('/reed-event', async (req, res) => {
        const event = req.body;

        if (!event || typeof event.gpio === 'undefined') {
            return res.status(400).json({ error: 'Invalid reed event payload' });
        }

        const timestamp = event.timestamp
            ? new Date(event.timestamp).toISOString()
            : new Date().toISOString();

        const record = {
            t: timestamp,
            gpio: event.gpio,
            status: event.status ? 'CLOSED' : 'OPEN'
        };

        console.log("📡 Reed Event:", record);

        try {
            // Append event
            await fs.appendFile(filePath, JSON.stringify(record) + '\n');

            // Rotate if needed
            const stats = await fs.stat(filePath);
            if (stats.size > MAX_FILE_SIZE) {
                const raw = await fs.readFile(filePath, 'utf8');
                const lines = raw.split('\n').filter(l => l.trim());

                if (lines.length > MAX_RECORDS) {
                    await fs.writeFile(
                        filePath,
                        lines.slice(-MAX_RECORDS).join('\n') + '\n'
                    );
                }
            }

            return res.json({ ok: true });

        } catch (err) {
            console.error("Reed event storage error:", err);
            return res.status(500).json({ error: "Could not save reed event" });
        }
    });

    // GET /reed-events  → simple webpage showing recent events
    router.get('/reed-events', async (req, res) => {
        try {
            const filePath = path.join(DATA_DIR, 'reed-events.jsonl');
            const raw = await fs.readFile(filePath, 'utf8');

            const events = raw
                .split('\n')
                .filter(l => l.trim())
                .map(l => JSON.parse(l))
                .reverse(); // newest first

            let html = `
                <html>
                <head>
                    <title>Reed Switch Events</title>
                    <style>
                        body { font-family: Arial; padding: 20px; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #ccc; padding: 8px; }
                        th { background: #eee; }
                    </style>
                </head>
                <body>
                    <h2>Reed Switch Events</h2>
                    <table>
                        <tr><th>Time</th><th>GPIO</th><th>Status</th></tr>
                        ${events.map(e => `
                            <tr>
                                <td>${e.t}</td>
                                <td>${e.gpio}</td>
                                <td>${e.status}</td>
                            </tr>
                        `).join('')}
                    </table>
                </body>
                </html>
            `;

            res.send(html);

        } catch (err) {
            console.error("Error reading reed events:", err);
            res.status(500).send("Could not load reed events");
        }
    });

    router.get('/reed/status', async (req, res) => {
        try {
            const data = await requestReedStatusFromEsp32();
            res.json(JSON.parse(data));
        } catch (err) {
            console.error("Error getting reed status:", err);
            res.status(500).json({ error: "Failed to get reed status" });
        }
    });

    function requestReedStatusFromEsp32() {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            let buffer = "";

            client.connect(3333, ESP32_IP_ADDRESS, () => {
                client.write("reed_status\n");
            });

            client.on("data", chunk => {
                buffer += chunk.toString();
                if (buffer.trim().endsWith("}")) {  // crude but works
                    client.destroy();
                    resolve(buffer.trim());
                }
            });

            client.on("error", reject);
            client.on("close", () => {});
        });
    }


    return router;
};





// router.post('/reed-event', (req, res) => {
//     const event = req.body;
//     //console.log(`Reed event:`, event);

//     if (!event || typeof event.gpio === 'undefined') {
//         return res.status(400).json({ error: 'Invalid reed event payload' });
//     }

//     console.log('📡 Reed Event Received:');
//     console.log(`  GPIO: ${event.gpio}`);
//     console.log(`  Status: ${event.status ? 'CLOSED' : 'OPEN'}`);
//     console.log(`  Timestamp: ${event.time}`);
//     console.log('----------------------------------');

//     res.json({ ok: true });
// });

// module.exports = router;
