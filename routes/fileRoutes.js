const express = require("express");
const {
  uploadFile,
  getProfitGraph,
  filterBySubOrder,
} = require("../controllers/fileController");

const router = express.Router();

// File Upload
router.post("/upload", uploadFile);

// Analytics
router.get("/profit-graph", getProfitGraph);

// Filter by Sub Order
router.get("/suborder/:subOrderNo", filterBySubOrder);

module.exports = router;
