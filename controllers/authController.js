const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const User = require("../models/User");

const secretKey = "apjabdulkalam@545";

exports.signup = async (req, res) => {
  try {
    const { fullname, email, phoneNumber, password } = req.body;

    const existUser = await User.findOne({ email });
    if (existUser) {
      return res.status(400).send({ message: "User already registered" });
    }

    const hashPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    try {
      const message = await twilioClient.messages.create({
        body: `Your OTP is ${otp}`,
        from: process.env.TWILIO_FROM_NUMBER,
        to: phoneNumber,
      });
      console.log("OTP SMS sent:", message.sid);
    } catch (error) {
      console.error("Twilio error:", error.message);
    }

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

    const newUser = new User({
      fullname,
      email,
      phoneNumber,
      otp,
      password: hashPassword,
    });

    await newUser.save();

    res.send({ message: "Registration successful, OTP sent" });
  } catch (err) {
    console.error("Registration failed:", err.message);
    res
      .status(500)
      .send({ message: "Registration failed", error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: "User not found", success: false });
    }

    if (user.otp === otp) {
      return res.json({ message: "OTP verified successfully", success: true });
    } else {
      return res.json({ message: "Invalid OTP", success: false });
    }
  } catch (error) {
    res.json({ message: "Internal server error", success: false });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.json({ message: "the user not found" });
  }
  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.send({ message: "user is creditional" });
  }
  const token = jwt.sign(
    { fullname: user.fullname, email: user.email, phoneNumber: user.phoneNumber },
    secretKey,
    { expiresIn: "1h" }
  );
  res.send({ message: "login successful", token });
};

exports.profile = (req, res) => {
  res.send({ message: "welcome to our profile", user: req.user });
};
