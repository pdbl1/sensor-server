const express = require('express');
//const { request } = require('http');
//const https = require('https');
const http = require('http');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { json } = require('stream/consumers');
const reedRts = require('./routes/reedRts');
const tempRts = require('./routes/tempRts');
const authRts = require('./routes/authRts');
const config = require('./config');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const auth = require('./controllers/authCtl');
const logger = require('./utils/logging');

//logger.printTest();

const app = express();
const port = process.env.HTTPPORT;

const sessParam = {
    store: new FileStore({
        path: "./.sessions",
        retries: 1,
        ttl: 86400, // 1 day
        reapInterval: 3600,      // cleanup every hour
        reapAsync: true,
        reapSyncFallback: true
    }),
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: true,          // requires HTTPS
        sameSite: "lax",       // allows Android fetch() to send cookies
        maxAge: 86400000       // 1 day
    },
    name: "SensorSess",
    level: 0,
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); 
app.use(express.urlencoded({ extended: true }));
// Middleware to parse JSON bodies sent by the ESP32
app.use(express.json());
//allows express to trust the proxy, Caddy.
app.set('trust proxy', true);
app.use(session(sessParam));
app.use(auth.unifiedAuth);
app.use("/sensors/", express.static('public')); // Serve HTML from a 'public' folder
//avoid caching files on cloudflare
app.use(['/sensors/api', '/api', '/sensor'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(['/sensors', '/sensors/api'], authRts);
app.use(['/sensors/api', '/api'], reedRts);
app.use(['/sensors/api', '/api'], tempRts);

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
        //const httpsServer = https.createServer(httpsOpts, app);

        httpServer.listen(process.env.HTTPPORT, () => {
            logger.log(`HTTP Server listening on port: ${process.env.HTTPPORT}`);
            logger.log(`Data Path: ${config.DATA_DIR}`)
        });

        // httpsServer.listen(process.env.HTTPSPORT, () => {
        //     console.log(`HTTPS Server listening on port: ${process.env.HTTPSPORT}`);
        // });

    } catch (error) {
        logger.error("Failed to start server. Check certificate paths/permissions:");
        logger.error(error);
        process.exit(1); // Exit if we can't load SSL
    }
}

startServer();

