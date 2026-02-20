
const fs = require('fs/promises');
const path = require('path');
const sensorUtils = require('../utils/utils');
//const checkESP32Key = require('./authRoutes');
const config = require('../config');
const logger = require('../utils/logging');


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
        logger.warn(`[400] Missing esp32 | req#${requestCount} | body=`, req.body);
        return res.status(400).send('ESP32 device name required');
    }
    if (!name || typeof name !== 'string') {
        logger.warn(`[400] Missing name | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Sensor name required');
    }
    if (temperature === undefined) {
        logger.warn(`[400] Missing temperature | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Temperature required');
    }
    if (!type || typeof type !== 'string') {
        logger.warn(`[400] Missing type | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Sensor type required');
    }
    if (!address || typeof address !== 'string') {
        address = "None";
    }
    //logger.verbose(`Post temperature id: ${esp32}: ${name}; temp: ${temperature}`);
    const safeEsp32 = esp32.trim();
    const safeName = name.trim();
    // Register or load sensor metadata
    const sensorMeta = await sensorUtils.registerSensor({
        esp32: safeEsp32,
        name: safeName,
        type,
        options: {
            address
        }
    });
    const filePath = path.join(config.DATA_DIR, sensorMeta.file);
    // Timestamp sanitization
    const { timestamp: finalTimestamp, source: sourceStr } = sensorUtils.sanitizeTimestamp(clientTimestamp);
    try {
        const newRecord = JSON.stringify({
            t: finalTimestamp,
            v: temperature
        }) + '\n';
        await fs.appendFile(filePath, newRecord);
        logger.verbose(
            `${requestCount} ${sourceStr}${req.protocol}: Appended: [${finalTimestamp}] ${sensorMeta.id} ${temperature}`
        );
        // Trim file if needed
        await sensorUtils.trimFileToMax(filePath, config.MAX_FILE_SIZE, config.MAX_RECORDS);
        return res.sendStatus(200);
    } catch (err) {
        logger.warn("Storage error:\n", err);
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
        logger.error("get last error:\n", err);
        return res.status(404).json({ error: "Sensor not found" });
    }
};

/** 
 * return the sensors.json file list
 */
exports.getTempSensors = async (req, res) => {
    try{
        const list = await sensorUtils.getSensorList(tempTypes);
        return res.json(list);
    } catch(err){
        logger.error("get sensors error:", err);
        return res.status(500).json({ error: "Could not read sensor directory" });
    }
}

// GET /api/history?id=xxxx
exports.getHistory = async (req, res) => {
    const sensorId = req.query.id;
    if (sensorId === 'names') {
        logger.warn("Invalid sensor ID");
        return res.status(400).json({ error: "Invalid sensor ID" });
    }
    const filePath = path.join(config.DATA_DIR, `${sensorId}.jsonl`);
    logger.verbose(filePath);
    try {
        const rawData = await fs.readFile(filePath, 'utf-8');
        const data = rawData
            .split('\n')
            .filter(line => line.trim())
            .slice(-config.MAX_RECORDS)
            .map(line => JSON.parse(line));

        return res.json(data);
    } catch (err) {
        logger.error("get history error:\n", err);
        return res.status(404).json({ error: "Sensor not found" });
    }
};

