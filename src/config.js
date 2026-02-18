const path = require('path');

const config = {
    DATA_DIR: path.join(__dirname, '../data'),
    MAX_RECORDS: 1440,
    MAX_FILE_SIZE: 100 * 1024
};

module.exports = config;
