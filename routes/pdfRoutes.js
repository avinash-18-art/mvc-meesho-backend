const express = require("express");
const { downloadPdf } = require("../controllers/pdfController");

const router = express.Router();

// PDF Download Route
router.get("/pdf/download", downloadPdf);

module.exports = router;
