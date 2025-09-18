const express = require("express");
const { downloadPdf } = require("../controllers/pdfController");

const router = express.Router();
router.get("/download-pdf", downloadPdf);


module.exports = router;
