const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const User = require("../models/User");

const secretKey = process.env.JWT_SECRET || "apjabdulkalam@545"; // ✅ use .env for secret

// ===== Signup =====
exports.signup = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password } = req.body;

    // 1. Check existing user
    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.status(400).json({ message: "User already registered" });
    }

    // 2. Hash password
    const hashPassword = await bcrypt.hash(password, 10);

    // 3. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 4. Save user first (with OTP + expiry)
    const newUser = new User({
      fullname,
      email,
      phoneNumber,
      password: hashPassword,
      otp,
      otpExpires: Date.now() + 5 * 60 * 1000, // 5 min validity
    });

    await newUser.save();

    // 5. Send OTP via Twilio (SMS)
    try {
      const twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      await twilioClient.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phoneNumber,
      });

      console.log("✅ OTP SMS sent to:", phoneNumber);
    } catch (error) {
      console.error("❌ Twilio error:", error.message);
    }

    // 6. Send OTP via Email
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}`,
      });

      console.log("✅ OTP Email sent to:", email);
    } catch (error) {
      console.error("❌ Nodemailer error:", error.message);
    }

    // 7. Success response
    res.status(201).json({ message: "Registration successful, OTP sent" });
  } catch (err) {
    console.error("❌ Registration failed:", err);
    res.status(500).json({ message: "Registration failed", error: err.message });
  }
};

// ===== Verify OTP =====
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "User not found", success: false });
    }

    if (user.otp !== otp) {
      return res.json({ message: "Invalid OTP", success: false });
    }

    if (user.otpExpires < Date.now()) {
      return res.json({ message: "OTP expired", success: false });
    }

    // Mark OTP as used
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: "OTP verified successfully", success: true });
  } catch (error) {
    console.error("❌ Verify OTP error:", error);
    res.json({ message: "Internal server error", success: false });
  }
};

// ===== Login =====
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "User not found" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { fullname: user.fullname, email: user.email, phoneNumber: user.phoneNumber },
      secretKey,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// ===== Profile =====
exports.profile = (req, res) => {
  res.json({ message: "Welcome to your profile", user: req.user });
};
