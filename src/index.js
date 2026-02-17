const express = require('express');
//const { request } = require('http');
const https = require('https');
const http = require('http');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { json } = require('stream/consumers');
const createApiRoutes = require('./routes/temp');
const createReedRoutes = require('./routes/reedEvents');

const app = express();
const port = 8080;

// Middleware to parse JSON bodies sent by the ESP32
app.use(express.json());
app.use("/sensors/", express.static('public')); // Serve your HTML from a 'public' folder

//const DATA_DIR = "../data"
const DATA_DIR = path.join(__dirname, '../data');
const MAX_RECORDS = 1440; // 5 days at 5-min intervals
const MAX_FILE_SIZE = 100 * 1024 //100 kB

//avoid caching files on cloudflare
app.use(['/api', '/sensor'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(['/sensors/api', '/api'], createApiRoutes({ DATA_DIR, MAX_FILE_SIZE, MAX_RECORDS }));
//app.use('/api', reedEvents);
app.use(['/sensors/api', '/api'], createReedRoutes({ DATA_DIR, MAX_FILE_SIZE, MAX_RECORDS }));


async function startServer() {
    try {
        // 1. Wait for both files to read in parallel
        const [httpsKey, httpsCert] = await Promise.all([
            fs.readFile(process.env.HTTPS_KEY),
            fs.readFile(process.env.HTTPS_CERT)
        ]);

        const httpsOpts = {
            key: httpsKey,
            cert: httpsCert
        };

        // 2. Create and start servers
        const httpServer = http.createServer(app);
        const httpsServer = https.createServer(httpsOpts, app);

        httpServer.listen(process.env.HTTPPORT, () => {
            console.log(`HTTP Server listening on port: ${process.env.HTTPPORT}`);
            console.log(`Data Path: ${DATA_DIR}`)
        });

        httpsServer.listen(process.env.HTTPSPORT, () => {
            console.log(`HTTPS Server listening on port: ${process.env.HTTPSPORT}`);
        });

    } catch (error) {
        console.error("Failed to start server. Check certificate paths/permissions:");
        console.error(error);
        process.exit(1); // Exit if we can't load SSL
    }
}

startServer();

