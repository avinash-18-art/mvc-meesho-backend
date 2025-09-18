const express = require("express");
const { signup, verifyOtp, login, profile } = require("../controllers/authController");
const verifyToken = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.get("/profile", verifyToken, profile);

module.exports = router;
