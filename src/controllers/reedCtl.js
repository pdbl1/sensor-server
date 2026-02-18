const net = require('net');
const fs = require('fs/promises');
const path = require('path');
const { registerSensor } = require('../utils/utils');
const { sanitizeTimestamp } = require('../utils/utils');
const { trimFileToMax } = require('../utils/utils');
const { syncBuiltinESMExports } = require('module');
const config = require('../config');


const ESP32_IP_ADDRESS = "192.168.50.112";
let requestCount = 0;
//const filePath = path.join(config.DATA_DIR, 'reed-events.jsonl');
const reedTypes = ["reed"];

exports.postReedEvent = async (req, res) => {
    let { esp32, name, status, gpio, type, time: clientTimestamp } = req.body;
    // Validation
    if (!esp32 || typeof esp32 !== 'string') {
        console.log(`[400] Missing esp32 | req#${requestCount} | body=`, req.body);
        return res.status(400).send('ESP32 device name required');
    }
    if (!name || typeof name !== 'string') {
        console.log(`[400] Missing name | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Sensor name required');
    }
    if (status === undefined) {
        console.log(`[400] Missing status | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Status required');
    }
    if (gpio === undefined) {
        console.log(`[400] Missing type | req#${requestCount} | body=`, req.body);
        return res.status(400).send('Sensor gpio required');
    }
    const safeEsp32 = esp32.trim();
    const safeName = name.trim();
    const key = `${safeEsp32}_${safeName}`;
    // Register or load sensor metadata
    const sensorMeta = await registerSensor({
        esp32: safeEsp32,
        name: safeName,
        type,
        options: {
            gpio
        }
    });
    const filePath = path.join(config.DATA_DIR, sensorMeta.file);
    // Timestamp sanitization
    const { timestamp: finalTimestamp, source: sourceStr } = sanitizeTimestamp(clientTimestamp);

    try {
        const newRecord = JSON.stringify( {
            t: finalTimestamp,
            s: status ? 'CLOSED' : 'OPEN',
            g: gpio
        }) + '\n';
        // Append event
        await fs.appendFile(filePath, newRecord);
        console.log(`${requestCount} ${sourceStr}${req.protocol}: Appended: [${finalTimestamp}] ${sensorMeta.id} ${status ? 'CLOSED' : 'OPEN'}`);
        // Trim if needed
        await trimFileToMax(filePath, config.MAX_FILE_SIZE, config.MAX_RECORDS);
        return res.sendStatus(200);

    } catch (err) {
        console.error("Reed event storage error:", err);
        return res.status(500).json({ error: "Internal Server Error could not save file" });
    }
}

exports.getReedSensors = async (req, res) => {
    try {
        // Load sensors.json
        const raw = await fs.readFile(path.join(config.DATA_DIR, "sensors.json"), "utf8");
        const sensorList = JSON.parse(raw); 
        const reedSensors = sensorList.filter(s => reedTypes.includes(s.type.toLowerCase()));
        const optList = [ {id: "All", txt: "All"}, 
            ...reedSensors.map(el => ({id: el.id, txt: `${el.esp32}: ${el.name}`}))
        ];
        return res.json(optList);
    } catch(err){
        console.error("Unable to read sensor list:", err);
        return res.status(500).json({ error: "Internal Server Error could not sensor list" });
    }
}

exports.getReedDisplay = async (req, res) => {
    try {
        const sensorRaw = req.query.sensor?.trim();
        const sensor = sensorRaw || "All"; // "" should also default to All
        let numEvents = parseInt(req.query.evts, 10);
        if (isNaN(numEvents) || numEvents <= 0) {
            numEvents = 10;
        }
        // Load sensors.json
        const raw = await fs.readFile(path.join(config.DATA_DIR, "sensors.json"), "utf8");
        let sensorList = JSON.parse(raw);

        // Normalize in case old format sneaks in
        if (!Array.isArray(sensorList)) {
            sensorList = Object.keys(sensorList).map(k => ({
                id: k,
                ...sensorList[k]
            }));
        }
        // Filter reed sensors
        let reedSensors = sensorList.filter(s => reedTypes.includes(s.type.toLowerCase()));
        if (sensor !== "All") {
            reedSensors = reedSensors.filter(s => s.id === sensor);
            if (reedSensors.length === 0) {
                console.error(`No record for sensor ${sensor}`);
                return res.status(400).send(`Unknown sensor: ${sensor}`);
            }
        }
        let allEvents = [];
        // Load each reed event file
        for (const sensor of reedSensors) {
            const filePath = path.join(config.DATA_DIR, sensor.file);
            try {
                const raw = await fs.readFile(filePath, 'utf8');

                const events = raw
                    .split('\n')
                    .filter(l => l.trim())
                    .map(l => {
                        const obj = JSON.parse(l);
                        //obj.sensor = file.replace('.jsonl', '');
                        obj.sensor = `${sensor.esp32}: ${sensor.name}`
                        return obj;
                    });
                const last100 = events.slice(-numEvents);
                allEvents.push(...last100);
            } catch (err) {
                console.log(`Error reading ${file}:`, err);
            }
        }
        // Sort newest first
        allEvents.sort((a, b) => new Date(b.t) - new Date(a.t));
        // Build HTML
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
                <input type="number" id="evtsInput" placeholder="Number of events" min="1">
                <select id="sensorSel">
                    <option value="All">All</option>
                </select>
                <button onclick="go()">Load</button>
                <table>
                    <tr><th>Time</th><th>GPIO</th><th>Status</th><th>Sensor</th></tr>
                    ${allEvents.map(e => `
                        <tr>
                            <td class="utc-time">${e.t}</td>
                            <td>${e.g}</td>
                            <td>${e.s}</td>
                            <td>${e.sensor}</td>
                        </tr>
                    `).join('')}
                </table>
            <script src="../reed.js"></script>
            </body>
            </html>
        `;

        return res.send(html);

    } catch (err) {
        console.error("Error loading reed events:", err);
        return res.status(500).send("Could not load reed events");
    }
}


exports.getReedStatus = async (req, res) => {
    try {
        const dataRaw = await requestReedStatusFromEsp32();
        const data = JSON.parse(dataRaw);
        res.json(data);
    } catch (err) {
        console.error("Error getting reed status:", err);
        res.status(500).json({ error: "Failed to get reed status" });
    }
}
 
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