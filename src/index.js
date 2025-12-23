const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 8080;

// Middleware to parse JSON bodies sent by the ESP32
app.use(express.json());
app.use(express.static('public')); // Serve your HTML from a 'public' folder

const DATA_DIR = "../data"
const MAX_RECORDS = 1440; // 5 days at 5-min intervals

// Helper to save data
const saveData = (data,fn) => fs.writeFileSync(fn, JSON.stringify(data));
// Helper to load data
const loadData = (fn) => {
    if (!fs.existsSync(fn)) return [];
    return JSON.parse(fs.readFileSync(fn));
};

app.get('/api/sensors', (req, res) => {
    const dataFolder = "./data"; // folder where your files are
    fs.readdir(dataFolder, (err, files) => {
        if (err) return res.status(500).json({ error: 'Folder not found' });
        
        // Filter for .json files and remove the extension for the ID
        const sensors = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
            
        res.json(sensors);
    });
});

// API for ESP32 to POST data
app.post('/api/temp', (req, res) => {
    const { temperature, address } = req.body;
    const filePath = path.join(__dirname, DATA_DIR, `${address}.json`);
    //console.log(req.body);
    if (temperature === undefined) return res.status(400).send('No temp provided');
    const timestamp = new Date().toLocaleString();
    console.log(`[${timestamp}] Temperature Received: ${temperature}°C`);

    //console.log(filePath);
    let history = loadData(filePath);
    
    // Add new data with timestamp
    history.push({ t: new Date().toISOString(), v: temperature });

    // Keep only the last 5 days
    if (history.length > MAX_RECORDS) {
        history = history.slice(history.length - MAX_RECORDS);
    }

    saveData(history, filePath);
    console.log(`Stored: ${temperature}°C. Total records: ${history.length}`);
    res.sendStatus(200);
});

//retrieves the most recent upload from the requested sensor
app.get('/api/last', (req,res) => {
    const sensorId = req.query.id; // e.g. "28-00000xxxxxxx"
    const filePath = path.join(__dirname, DATA_DIR, `${sensorId}.json`);
    const data = loadData(filePath);

    if (!data || data.length === 0) {
        return res.status(404).json({ error: "No data found" });
    }
    const last_record = data[data.length - 1];
    res.json(last_record); // Usually better to return the whole object
})

// Returns all data for the selected sensor
app.get('/api/history', (req, res) => {
    const sensorId = req.query.id; // e.g. "28-00000xxxxxxx"
    const filePath = path.join(__dirname, DATA_DIR, `${sensorId}.json`);
    console.log("/api/history", filePath);
    res.json(loadData(filePath));
});

app.get('/api/names', (req, res) => {
    const filePath = path.join(__dirname, DATA_DIR, 'names.json');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            // If file doesn't exist yet, return an empty object
            return res.json({});
        }
        res.json(JSON.parse(data));
    });
});

app.post('/api/names', (req, res) => {
    const filePath = path.join(__dirname, DATA_DIR, 'names.json');
    const newNames = req.body;

    fs.writeFile(filePath, JSON.stringify(newNames, null, 2), (err) => {
        if (err) {
            console.error("Save error:", err);
            return res.status(500).send("Could not save names.");
        }
        res.send("Names updated successfully!");
    });
});


app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://192.168.50.1:${port}`);
});