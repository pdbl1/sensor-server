const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { json } = require('stream/consumers');
const app = express();
const port = 8080;

// Middleware to parse JSON bodies sent by the ESP32
app.use(express.json());
app.use(express.static('public')); // Serve your HTML from a 'public' folder

const DATA_DIR = "../data"
const MAX_RECORDS = 1440; // 5 days at 5-min intervals

//re-write to use async file operations
// API for ESP32 to POST data
app.post('/api/temp', async (req, res) => {
    let { temperature, address, time: clientTimestamp } = req.body;
    const filePath = path.join(__dirname, DATA_DIR, `${address}.json`);
    //console.log(req.body);
    if (temperature === undefined) return res.status(400).send('No temp provided');

    // 1. Sanitize the timestamp (remove whitespace/newlines from ESP32)
    if (typeof clientTimestamp === 'string') {
        clientTimestamp = clientTimestamp.trim();
    }
    const MIN_VALID_YEAR = 2025;
    const parsedDate = new Date(clientTimestamp);
    const isValidDate = clientTimestamp && !isNaN(parsedDate.getTime()) && 
        parsedDate.getFullYear() >= MIN_VALID_YEAR;
    let finalTimestamp;
    let sourceStr;
    
    if (isValidDate){
        finalTimestamp = parsedDate.toISOString();
        //console.log("Date from ESP: ", finalTimestamp);
        sourceStr = "ESP_"
    } else {
        //console.warn(`Invalid date ${clientTimestamp} from ESP.  Used Server Time `);
        finalTimestamp = new Date().toISOString();
        sourceStr = "SRVR"
    }
    
    //const timestamp = new Date().toLocaleString();
    console.log(`${sourceStr}: [${finalTimestamp}] Temperature ${temperature}°C Address: ${address}`);

    try{
        let history = [];
        try{
            const rawData = await fs.readFile(filePath, 'utf8');
            history = JSON.parse(rawData);
        } catch(err){
            // If file doesn't exist, start with empty array
            console.log("Adding new sensor: ",address);
            history = [];
        }
        //process data, Add new data with timestamp
        //history.push({t: new Date().toISOString(), v: temperature});
        history.push({t: finalTimestamp, v: temperature});
        if (history.length > MAX_RECORDS) {
            history = history.slice(history.length - MAX_RECORDS);
        }
        await fs.writeFile(filePath, JSON.stringify(history));
        res.sendStatus(200);
    } catch (err) {
        console.log("Storage error:\n", err);
        res.status(500).send("Internal Server Error could not save file");
    }
});

app.get('/api/sensors', async (req, res) => {
    const dataFolder = "./data"; 
    try {
        // Use the promise-based readdir
        const files = await fs.readdir(dataFolder);

        const sensors = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''))
            .filter(file => file !== "names");

        res.json(sensors);
    } catch (err) {
        console.error("Directory read error:", err);
        res.status(500).json({ error: 'Folder not found or inaccessible' });
    }
});

app.get('/api/last', async (req,res) => {
    const sensorId = req.query.id; // e.g. "28-00000xxxxxxx"
    const filePath = path.join(__dirname, DATA_DIR, `${sensorId}.json`);
    try{
        const rawData = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(rawData);
        if (data.length === 0){
            return res.status(404).json({ error: "No data found for this sensor" });
        }
        const last_record = data[data.length - 1];
        res.json(last_record);
    } catch (err) {
        console.error("get last error:", err);
        return res.status(404).json({ error: `sensor not found ${sensorId}` });
    }

});

// Returns all data for the selected sensor
app.get('/api/history', async (req, res) => {
    const sensorId = req.query.id; // e.g. "28-00000xxxxxxx"
    const filePath = path.join(__dirname, DATA_DIR, `${sensorId}.json`);

    try{
        const rawData = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(rawData); // Use PARSE, not stringify
        return res.json(data);
    }catch(err) {
        console.error("get history error:", err);
        return res.status(404).json({ error: `sensor not found ${sensorId} or corrupted file` });
    }
});

//get the file names from names.json
app.get('/api/names', async (req, res) => {
    const filePath = path.join(__dirname, DATA_DIR, 'names.json');
    
    try{
        const rawData = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(rawData);
        return res.json(data);
    }catch(err) {
        console.error("get names error:", err);
        return res.json({});
    }
});

app.post('/api/names', async (req, res) => {
    const filePath = path.join(__dirname, DATA_DIR, 'names.json');
    const newNames = req.body;

    try{
        const data = JSON.stringify(newNames, null, 2)
        await fs.writeFile(filePath, data, 'utf8');
        return res.status(200).send("Names saved successfully");
    }catch(err) {
        console.error("Save names error:", err);
        return res.status(500).send("Could not save names.");
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://192.168.50.1:${port}`);
});