
// routes/api.js
const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const { registerSensor } = require('../utils/utils');
const { sanitizeTimestamp } = require('../utils/utils');
const { trimFileToMax } = require('../utils/utils');
const checkESP32Key = require('./authRoutes');


// These must be provided by index.js when mounting the router
module.exports = function createApiRoutes({ DATA_DIR, MAX_FILE_SIZE, MAX_RECORDS }) {

    let requestCount = 0;
    const tempTypes = ["ds18b20", "thermocouple"];

    /**
     * post data from a temperature device
     */
    router.post('/temp1', checkESP32Key, async (req, res) => {
        requestCount++;

        let { esp32, name, temperature, type, address, time: clientTimestamp } = req.body;
        // Validation
        if (!esp32 || typeof esp32 !== 'string') {
            console.log(`[400] Missing esp32 | req#${requestCount} | body=`, req.body);
            return res.status(400).send('ESP32 device name required');
        }
        if (!name || typeof name !== 'string') {
            console.log(`[400] Missing name | req#${requestCount} | body=`, req.body);
            return res.status(400).send('Sensor name required');
        }
        if (temperature === undefined) {
            console.log(`[400] Missing temperature | req#${requestCount} | body=`, req.body);
            return res.status(400).send('Temperature required');
        }
        if (!type || typeof type !== 'string') {
            console.log(`[400] Missing type | req#${requestCount} | body=`, req.body);
            return res.status(400).send('Sensor type required');
        }
        if (!address || typeof address !== 'string') {
            address = "None";
        }
        console.log(req.body);
        const safeEsp32 = esp32.trim();
        const safeName = name.trim();
        // Register or load sensor metadata
        const sensorMeta = await registerSensor({
            esp32: safeEsp32,
            name: safeName,
            type,
            options: {
                address
            }
        });
        const filePath = path.join(DATA_DIR, sensorMeta.file);
        // Timestamp sanitization
        const { timestamp: finalTimestamp, source: sourceStr } = sanitizeTimestamp(clientTimestamp);
        try {
            const newRecord = JSON.stringify({
                t: finalTimestamp,
                v: temperature
            }) + '\n';
            await fs.appendFile(filePath, newRecord);
            console.log(
                `${requestCount} ${sourceStr}${req.protocol}: Appended: [${finalTimestamp}] ${sensorMeta.id} ${temperature}`
            );
            // Trim file if needed
            await trimFileToMax(filePath, MAX_FILE_SIZE, MAX_RECORDS);
            return res.sendStatus(200);
        } catch (err) {
            console.log("Storage error:\n", err);
            return res.status(500).send("Internal Server Error could not save file");
        }
    });

    
    // GET /api/last?id=xxxx
    router.get('/last', async (req, res) => {
        const sensorId = req.query.id;
        const filePath = path.join(DATA_DIR, `${sensorId}.jsonl`);

        try {
            const rawData = await fs.readFile(filePath, 'utf-8');
            const lines = rawData.split('\n').filter(line => line.trim());

            if (lines.length === 0) {
                return res.status(404).json({ error: "No data available for this sensor" });
            }

            const lastEntry = JSON.parse(lines[lines.length - 1]);
            return res.json(lastEntry);

        } catch (err) {
            console.log("get last error:\n", err);
            return res.status(404).json({ error: "Sensor not found" });
        }
    });

    // GET /api/sensors  → list all sensor IDs based on *.jsonl files
    router.get('/sensors', async (req, res) => {
        try {
            const files = await fs.readdir(DATA_DIR);

            // Only keep .jsonl files, ignore names.json
            const sensors = files
                .filter(f => f.endsWith('.jsonl'))
                .map(f => path.basename(f, '.jsonl'));

            return res.json(sensors);

        } catch (err) {
            console.error("get sensors error:", err);
            return res.status(500).json({ error: "Could not read sensor directory" });
        }
    });


    /**
     * return the sensors.json file list
     */
    router.get('/sensors1', async (req, res) => {
        try {
            const sensorsPath = path.join(DATA_DIR, `sensors.json`);
            const sensorListText = await fs.readFile(sensorsPath, "utf-8");
            const sensorList = JSON.parse(sensorListText);
            const tempSensorList = sensorList.filter(e => tempTypes.includes(e.type.toLowerCase()));
            return res.json(tempSensorList);
        } catch (err) {
            console.error("get sensors error:", err);
            return res.status(500).json({ error: "Could not read sensor directory" });
        }
    });

    // GET /api/history?id=xxxx
    router.get('/history1', async (req, res) => {
        const sensorId = req.query.id;
        if (sensorId === 'names') {
            console.log("Invalid sensor ID");
            return res.status(400).json({ error: "Invalid sensor ID" });
        }
        const filePath = path.join(DATA_DIR, `${sensorId}.jsonl`);
        console.log(filePath);
        try {
            const rawData = await fs.readFile(filePath, 'utf-8');
            const data = rawData
                .split('\n')
                .filter(line => line.trim())
                .slice(-MAX_RECORDS)
                .map(line => JSON.parse(line));

            return res.json(data);
        } catch (err) {
            console.log("get history error:\n", err);
            return res.status(404).json({ error: "Sensor not found" });
        }
    });



    return router;
};

// // POST /api/temp
//     router.post('/temp_old', async (req, res) => {
//         requestCount++;

//         let { temperature, address, time: clientTimestamp } = req.body;
//         const filePath = path.join(DATA_DIR, `${address}.jsonl`);

//         console.log("Post data:\n", req.body);

//         if (temperature === undefined) return res.status(400).send('No temp provided');
//         if (address === undefined || address === 'names') return res.status(400).send('Invalid address');

//         // Sanitize timestamp
//         if (typeof clientTimestamp === 'string') {
//             clientTimestamp = clientTimestamp.trim();
//         }

//         const MIN_VALID_YEAR = 2025;
//         const parsedDate = new Date(clientTimestamp);
//         const isValidDate =
//             clientTimestamp &&
//             !isNaN(parsedDate.getTime()) &&
//             parsedDate.getFullYear() >= MIN_VALID_YEAR;

//         let finalTimestamp;
//         let sourceStr;

//         if (isValidDate) {
//             finalTimestamp = parsedDate.toISOString();
//             sourceStr = "ESP_";
//         } else {
//             finalTimestamp = new Date().toISOString();
//             sourceStr = "SRVR";
//         }

//         try {
//             const newRecord = JSON.stringify({ t: finalTimestamp, v: temperature }) + '\n';
//             await fs.appendFile(filePath, newRecord);

//             console.log(`${requestCount} ${sourceStr}${req.protocol}: Appended: [${finalTimestamp}] ${address} ${temperature}`);

//             const stats = await fs.stat(filePath);

//             if (stats.size > MAX_FILE_SIZE) {
//                 const data = await fs.readFile(filePath, 'utf8');
//                 let lines = data.split('\n').filter(l => l.trim());

//                 if (lines.length > MAX_RECORDS) {
//                     await fs.writeFile(filePath, lines.slice(-MAX_RECORDS).join('\n') + '\n');
//                 } else {
//                     console.log(`Error: file size > 100K and less than ${MAX_RECORDS}`);
//                 }
//             }

//             res.sendStatus(200);

//         } catch (err) {
//             console.log("Storage error:\n", err);
//             res.status(500).send("Internal Server Error could not save file");
//         }
//     });

//     // GET /api/history?id=xxxx
//     router.get('/history_old', async (req, res) => {
//         const sensorId = req.query.id;
//         if (sensorId === 'names') return res.status(400).json({ error: "Invalid sensor ID" });

//         const filePath = path.join(DATA_DIR, `${sensorId}.jsonl`);

//         try {
//             const rawData = await fs.readFile(filePath, 'utf-8');
//             const data = rawData
//                 .split('\n')
//                 .filter(line => line.trim())
//                 .slice(-MAX_RECORDS)
//                 .map(line => JSON.parse(line));

//             return res.json(data);
//         } catch (err) {
//             console.log("get history error:\n", err);
//             return res.status(404).json({ error: "Sensor not found" });
//         }
//     });

    // // GET /api/names
    // router.get('/names_old', async (req, res) => {
    //     const filePath = path.join(DATA_DIR, 'names.json');

    //     try {
    //         const rawData = await fs.readFile(filePath, 'utf8');
    //         const data = JSON.parse(rawData);
    //         return res.json(data);
    //     } catch (err) {
    //         console.error("get names error:", err);
    //         return res.json({});
    //     }
    // });

    // // POST /api/names
    // router.post('/names_old', async (req, res) => {
    //     const filePath = path.join(DATA_DIR, 'names.json');
    //     const newNames = req.body;

    //     try {
    //         const data = JSON.stringify(newNames, null, 2);
    //         await fs.writeFile(filePath, data, 'utf8');
    //         return res.status(200).send("Names saved successfully");
    //     } catch (err) {
    //         console.error("Save names error:", err);
    //         return res.status(500).send("Could not save names.");
    //     }
    // });