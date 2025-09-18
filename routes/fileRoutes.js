const express = require("express");
const { uploadFile, getProfitGraph, filterBySubOrder } = require("../controllers/fileController");

const router = express.Router();

router.post("/upload", uploadFile);
router.get("/profit-graph", getProfitGraph);
router.get("/filter/:subOrderNo", filterBySubOrder);

module.exports = router;
