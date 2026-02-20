const express = require("express");
const router = express.Router();
const authCtl = require("../controllers/authCtl");

router.get("/login", authCtl.getLogin);
router.post("/login", authCtl.postLogin);
router.get("/logout", authCtl.logout);

router.post('/api/register', authCtl.registerEsp32);

module.exports = router;
