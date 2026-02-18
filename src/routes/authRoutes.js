

require('dotenv').config();

function checkESP32Key(req, res, next) {
    // if(req.get("Api-Key") !== process.env.DEVICE_ESP32_KEY){
    //     //console.log("ESP 32 API key does not match");
    //     return res.status(401).json({ error: "Unauthorized" });
    // }
    //console.log("ESP32 API key matches");
    next();
}

module.exports = checkESP32Key;