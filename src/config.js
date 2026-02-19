const path = require('path');

const config = {
    DATA_DIR: path.join(__dirname, '../data'),
    MAX_RECORDS: 1440,
    MAX_FILE_SIZE: 100 * 1024,
    apiKey: process.env.DEVICE_ESP32_KEY
};

module.exports = config;
