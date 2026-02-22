const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logging');
const nodemon = require('nodemon');

// accessMap.js
const accessMap = {
    // --- ESP32 ingestion routes ---
    "/sensors/api/temp1":        { esp32: true,  methods: ["post"] },
    "/sensors/api/reed-event":   { esp32: true,  methods: ["post"] },
    "/sensors/api/register":    {esp32: true, methods: ['post']},

    // --- Browser API routes (session required) ---
    "/sensors/api/last":         { user: 1, methods: ["get"] },
    "/sensors/api/sensors1":     { user: 1, methods: ["get"] },
    "/sensors/api/history1":     { user: 1, methods: ["get"] },

    "/sensors/api/reed-sensors": { user: 1, methods: ["get"] },
    "/sensors/api/reed-display": { user: 1, methods: ["get"] },
    "/sensors/api/reed-status":  { user: 1, methods: ["get"] },

    // --- Static HTML pages (session required) ---
    "/sensors/home.htm":            { public: true },
    "/sensors/reed.html":           { user: 1 },
    "/sensors/temp.html":           { user: 1 },
    "/sensors/temp_display.html":   { user: 1 },
    "/sensors/reed_status.html":    {user: 1},
    "/sensors/reedStatus.html":     {user: 1},

    // --- Public routes ---
    "/sensors/login":            { public: true },
    "/sensors/logout":           { public: true },

    // Static assets
    "/sensors/css":              { public: true },
    "/sensors/js":               { public: true },
    "/sensors/media":            { public: true },
};

//const allowRegex = /^(\/css|\/js|\/media|\/favicon|\/login|\/logout|\/home|\/uploads|\/receipts|\/\.well-known)/;
const allowRegex = /^\/sensors\/.*\.(js|css|png|jpg|svg)$/;
const esp32FirmWare = /^\/sensors\/[^\/]+\.bin$/;
exports.unifiedAuth = function (req, res, next) {
    const path = req.baseUrl + req.path;
    const rule = accessMap[path];
    //logger.verbose(`Auth validation for: ${path}`);
    //logger.verbose(`Method: ${req.method}`);
    //logger.verbose(`Rule: ${JSON.stringify(rule)}`);
    //allow static files in public directory
    if (allowRegex.test(req.path)) {
        return next();
    }
    //allow esp32 to get firmware updates
    if (esp32FirmWare.test(req.path)){
        const key = req.get("Api-Key");
        if (!key || key !== process.env.DEVICE_ESP32_KEY) {
            logger.warn(`ESP32 firmwae auth failed for ${path}; key: ${key}`);
            //comment out this line to allow firmware updated without validation
            return res.status(401).json({ error: "Unauthorized" });
        }
        logger.verbose(`ESP32 firmware validation Path: ${path}; key: ${key}`);
        return next();
    }
    //refresh session expiration so admin stays logged in (session will expire if more than 30 days since last access)
    if (req.session.level === 5) {  // admin
        req.session.touch(); // refresh expiration
    }
 
    // No rule → 404
    if (!rule) {
        logger.warn(`404 Not Found (missing in accessMap): ${path}`);
        return res.status(404).send(`Not Found: ${path}`);
    }

    // Method not allowed
    if (rule.methods && !rule.methods.includes(req.method.toLowerCase())) {
        logger.warn(`405 Method Not Allowed: ${req.method} ${path}`);
        return res.status(405).send(`Method Not Allowed: ${req.method}`);
    }

    // Public route
    if (rule.public) {
        return next();
    }

    // ESP32 route
    if (rule.esp32) {
        const key = req.get("Api-Key");
        //logger.verbose("Provided Key: ", key);
        if (!key || key !== process.env.DEVICE_ESP32_KEY) {
            logger.warn(`ESP32 auth failed for ${path}`);
            //return res.status(401).json({ error: "Unauthorized" });
        }
        return next();
    }

    // User route
    if (rule.user !== undefined) {
        const requiredLevel = rule.user;
        const userLevel = req.session.level || 0;

        if (userLevel >= requiredLevel) {
            return next();
        }

        logger.warn(`User auth failed for ${path} (level ${userLevel} < ${requiredLevel})`);
        req.session.accessReqFrom = path;

        return res.redirect("/sensors/login");
    }

    // Should never reach here
    logger.error(`Invalid rule for ${path}`);
    return res.status(500).send("Server auth configuration error");
};

exports.getLogin = (req, res) => {
    res.render("login", {
        auth: req.session.auth,
        message: req.query.error || ""
    });
};

const users = [{ 	username: 'admin',
			password: 'padmin',
			level: 5},
		{ 	username: 'user',
			password: 'puser',
			level: 3}
		];

exports.postLogin = (req, res, next) => {

    const { username, password } = req.body;
    const auth = users.find(u =>
        u.username === username && u.password === password
    );
    if (!auth) {
        logger.warn("Login failed:", username);
        return res.redirect("/sensors/login?error=Invalid%20credentials");
    }
    // Regenerate session to prevent fixation
    req.session.regenerate(err => {
        if (err) {
            logger.error("Session regenerate error:", err);
            return next(err);
        }
        if(username === "admin" ){  //persistant sessions for admin
            req.session.cookie.expires = false; // no absolute expiration
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            req.sessionStore.options.ttl = 30 * 24 * 60 * 60;     // 30 days

        }
        req.session.level = auth.level;
        req.session.save(err => {
            if (err) {
                logger.error("Session save error:", err);
                return next(err);
            }
            logger.log("User logged in:", username, "level:", auth.level);
            const redirectTo = req.session.accessReqFrom || "/sensors/home.htm";

            // If Android app logs in later:
            if (req.headers.accept?.includes("application/json")) {
                return res.json({ success: true, redirect: redirectTo });
            }

            res.redirect(redirectTo);
        });
    });
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect("/sensors/login");
    });
};

exports.registerEsp32 = async (req, res) => {
    let {device_mac, esp32, ip} =  req.body;
    if(!device_mac || typeof device_mac !== 'string'){
        logger.warn(`[400] device mac address missing or invalid | body= ${JSON.stringify(req.body)}`);
        return res.status(400).json({success: false, error: 'invalid mac'});
    }
    if (!esp32 || typeof esp32 !== 'string') {
        logger.warn(`[400] Missing esp32 | body= ${JSON.stringify(req.body)}`);
        return res.status(400).json({success: false, error: 'esp32 name missing or invaldi'});
    }
    if (!ip || typeof ip !== 'string') {
        logger.warn(`[400] Missing ip | body= ${JSON.stringify(req.body)}`);
        return res.status(400).json({success: false, error: 'ip missing or invaldi'});
    }
    const filePath = path.join(config.DATA_DIR, 'nodes.json');
    // --- Load existing nodes ---
    let nodes = [];
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        nodes = JSON.parse(raw);
        if (!Array.isArray(nodes)) nodes = [];
    } catch (err) {
        logger.warn(`nodes.json missing or unreadable, starting fresh`);
        nodes = [];
    }
    // --- Remove any existing entry for this MAC ---
    nodes = nodes.filter(n => n.device_mac !== device_mac);
    // --- Add the new/updated node ---
    const newNode = { device_mac, esp32, ip, last_seen: Date.now() };
    nodes.push(newNode);
    // --- Save file ---
    await fs.writeFile(filePath, JSON.stringify(nodes, null, 2));
    logger.info(`Registered ESP32 ${esp32} (${device_mac}) @ ${ip}`);
    return res.json({ success: true });
}