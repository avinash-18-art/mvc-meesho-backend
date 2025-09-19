const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Load .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// DB connection
require("./config/db")();

// Middleware
app.use(cors({
  origin:  "https://mvc-meesho-frontend.vercel.app", // frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// Routes
const authRoutes = require("./routes/authRoutes");
const fileRoutes = require("./routes/fileRoutes");
const pdfRoutes = require("./routes/pdfRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/file", fileRoutes);
app.use("/api/pdf", pdfRoutes);

// Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
