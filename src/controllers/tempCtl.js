
const fs = require('fs/promises');
const path = require('path');
const { registerSensor } = require('../utils/utils');
const { sanitizeTimestamp } = require('../utils/utils');
const { trimFileToMax } = require('../utils/utils');
//const checkESP32Key = require('./authRoutes');
const config = require('../config');


let requestCount = 0;
const tempTypes = ["ds18b20", "thermocouple"];

/**
 * post data from a temperature device
 */
exports.postTempEvent = async (req, res) => {
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
    const filePath = path.join(config.DATA_DIR, sensorMeta.file);
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
}


// GET /api/last?id=xxxx
exports.getLastTemp = async (req, res) => {
    const sensorId = req.query.id;
    const filePath = path.join(config.DATA_DIR, `${sensorId}.jsonl`);

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
};

/**
 * return the sensors.json file list
 */
exports.getSensorList = async (req, res) => {
    try {
        const sensorsPath = path.join(config.DATA_DIR, `sensors.json`);
        const sensorListText = await fs.readFile(sensorsPath, "utf-8");
        const sensorList = JSON.parse(sensorListText);
        const tempSensorList = sensorList.filter(e => tempTypes.includes(e.type.toLowerCase()));
        return res.json(tempSensorList);
    } catch (err) {
        console.error("get sensors error:", err);
        return res.status(500).json({ error: "Could not read sensor directory" });
    }
};

// GET /api/history?id=xxxx
exports.getHistory = async (req, res) => {
    const sensorId = req.query.id;
    if (sensorId === 'names') {
        console.log("Invalid sensor ID");
        return res.status(400).json({ error: "Invalid sensor ID" });
    }
    const filePath = path.join(config.DATA_DIR, `${sensorId}.jsonl`);
    console.log(filePath);
    try {
        const rawData = await fs.readFile(filePath, 'utf-8');
        const data = rawData
            .split('\n')
            .filter(line => line.trim())
            .slice(-config.MAX_RECORDS)
            .map(line => JSON.parse(line));

        return res.json(data);
    } catch (err) {
        console.log("get history error:\n", err);
        return res.status(404).json({ error: "Sensor not found" });
    }
};

