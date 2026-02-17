const fs = require('fs/promises');
const path = require('path');

//we are inside the util directory here
const DATA_DIR = path.join(__dirname, './../../', 'data');

async function loadSensorIndex() {
    try {
        const raw = await fs.readFile(path.join(DATA_DIR, "sensors.json"), "utf8");
        let index = JSON.parse(raw);

        // Normalize: convert old object-map format → array
        if (!Array.isArray(index)) {
            index = Object.keys(index).map(k => ({
                id: k,
                ...index[k]
            }));
        }

        return index;

    } catch (err) {
        // File missing or invalid JSON → start fresh
        return [];
    }
}

async function saveSensorIndex(index) {
    await fs.writeFile(
        path.join(DATA_DIR, "sensors.json"),
        JSON.stringify(index, null, 2)
    );
}

async function registerSensor({ esp32, name, type }) {
    const id = `${esp32}_${name}`;
    const file = `${id}.jsonl`;

    let index = await loadSensorIndex();

    let existing = index.find(s => s.id === id);

    if (!existing) {
        const newSensor = { id, esp32, name, type, file };
        index.push(newSensor);
        await saveSensorIndex(index);
        return newSensor;
    }

    return existing;
}

// ------------------------------
// Sanitize timestamp
// ------------------------------
function sanitizeTimestamp(clientTimestamp) {
    if (typeof clientTimestamp === 'string') {
        clientTimestamp = clientTimestamp.trim();
    }

    const MIN_VALID_YEAR = 2025;
    const parsedDate = new Date(clientTimestamp);

    const isValid =
        clientTimestamp &&
        !isNaN(parsedDate.getTime()) &&
        parsedDate.getFullYear() >= MIN_VALID_YEAR;

    return {
        timestamp: isValid ? parsedDate.toISOString() : new Date().toISOString(),
        source: isValid ? "ESP_" : "SRVR"
    };
}

// ------------------------------
// Trim file to MAX_RECORDS
// ------------------------------
async function trimFileToMax(filePath, MAX_FILE_SIZE, MAX_RECORDS) {
    const stats = await fs.stat(filePath);

    if (stats.size <= MAX_FILE_SIZE) {
        return; // nothing to do
    }

    const data = await fs.readFile(filePath, 'utf8');
    let lines = data.split('\n').filter(l => l.trim());

    if (lines.length > MAX_RECORDS) {
        await fs.writeFile(
            filePath,
            lines.slice(-MAX_RECORDS).join('\n') + '\n'
        );
    }
}

module.exports = {
    loadSensorIndex,
    saveSensorIndex,
    registerSensor,
    sanitizeTimestamp,
    trimFileToMax
};