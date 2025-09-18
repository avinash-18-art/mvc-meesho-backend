const PDFDocument = require("pdfkit");
const { formatINR } = require("../utils/helpers");
const { _getLatestData } = require("../controllers/fileController");

function drawTable(doc, { headers, rows }, options = {}) {
  const {
    startX = 60,
    startY = 120,
    colWidths = [],
    rowHeight = 26,
    headerHeight = 28,
    maxY = doc.page.height - 60,
    headerFont = "Helvetica-Bold",
    rowFont = "Helvetica",
    fontSize = 10,
    cellPaddingX = 8,
  } = options;

  const cols = headers.length;
  const widths =
    colWidths.length === cols
      ? colWidths
      : Array(cols).fill(Math.floor((doc.page.width - startX * 2) / cols));

  let y = startY;

  function maybeAddPage(nextRowHeight) {
    if (y + nextRowHeight > maxY) {
      doc.addPage();
      y = 60;
    }
  }

  doc.font(headerFont).fontSize(fontSize);
  maybeAddPage(headerHeight);
  let x = startX;
  for (let c = 0; c < cols; c++) {
    doc.rect(x, y, widths[c], headerHeight).stroke();
    doc.text(String(headers[c]), x + cellPaddingX, y + 8, {
      width: widths[c] - cellPaddingX * 2,
      ellipsis: true,
    });
    x += widths[c];
  }
  y += headerHeight;

  doc.font(rowFont).fontSize(fontSize);
  rows.forEach((row) => {
    maybeAddPage(rowHeight);
    let x = startX;
    for (let c = 0; c < cols; c++) {
      doc.rect(x, y, widths[c], rowHeight).stroke();
      doc.text(String(row[c] ?? ""), x + cellPaddingX, y + 7, {
        width: widths[c] - cellPaddingX * 2,
        ellipsis: true,
      });
      x += widths[c];
    }
    y += rowHeight;
  });

  return y;
}

function downloadPdf(req, res) {
  const latestData = _getLatestData();
  if (!latestData) return res.status(404).json({ error: "No data found" });

  const categorized = latestData.categories || {};
  const totals = latestData.totals || {};
  const profitByDate = Array.isArray(latestData.profitByDate)
    ? [...latestData.profitByDate]
    : [];

  profitByDate.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=dashboard-report.pdf");

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).font("Helvetica-Bold").text("📊 Dashboard Report", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1.5);

  doc.font("Helvetica-Bold").fontSize(12).text("Summary Metrics");
  doc.moveDown(0.5);

  const tableTop = doc.y + 6;
  const cellHeight = 26;
  const col1X = 60;
  const col2X = 360;
  const col1Width = 300;
  const col2Width = 160;

  doc.rect(col1X, tableTop, col1Width, cellHeight).stroke();
  doc.rect(col2X, tableTop, col2Width, cellHeight).stroke();

  doc.font("Helvetica-Bold").fontSize(10)
    .text("Metric", col1X + 8, tableTop + 8)
    .text("Value", col2X + 8, tableTop + 8);

  const metrics = {
    "All Orders": (categorized.all || []).length || 0,
    "RTO": (categorized.rto || []).length || 0,
    "Door Step Exchanged": (categorized.door_step_exchanged || []).length || 0,
    "Delivered (count / discounted total)":
      `${totals?.sellInMonthProducts || 0} / ${formatINR(totals?.deliveredSupplierDiscountedPriceTotal || 0)}`,
    "Cancelled": (categorized.cancelled || []).length || 0,
    "Pending": (categorized.ready_to_ship || []).length || 0,
    "Shipped": (categorized.shipped || []).length || 0,
    "Other": (categorized.other || []).length || 0,
    "Supplier Listed Total Price": formatINR(totals?.totalSupplierListedPrice || 0),
    "Supplier Discounted Total Price": formatINR(totals?.totalSupplierDiscountedPrice || 0),
    "Total Profit": formatINR(totals?.totalProfit || 0),
    "Profit %": `${totals?.profitPercent || "0.00"}%`,
  };

  doc.font("Helvetica").fontSize(10);
  let y = tableTop + cellHeight;
  const bottomMargin = doc.page.height - 60;

  for (const [key, value] of Object.entries(metrics)) {
    if (y + cellHeight > bottomMargin) {
      doc.addPage();
      y = 60;
      doc.rect(col1X, y, col1Width, cellHeight).stroke();
      doc.rect(col2X, y, col2Width, cellHeight).stroke();
      doc.font("Helvetica-Bold").text("Metric", col1X + 8, y + 8).text("Value", col2X + 8, y + 8);
      y += cellHeight;
      doc.font("Helvetica");
    }

    doc.rect(col1X, y, col1Width, cellHeight).stroke();
    doc.rect(col2X, y, col2Width, cellHeight).stroke();

    doc.text(key, col1X + 8, y + 8, { width: col1Width - 16, ellipsis: true });
    doc.text(String(value), col2X + 8, y + 8, { width: col2Width - 16, ellipsis: true });

    y += cellHeight;
  }

  doc.moveDown(2);

  doc.font("Helvetica-Bold").fontSize(12).text("Profit By Date");
  doc.moveDown(0.5);

  const headers = ["Date", "Profit"];
  const rows = profitByDate.map((p) => [p.date, formatINR(p.profit || 0)]);
  const tableData = { headers, rows: rows.length ? rows : [["—", "—"]] };

  drawTable(doc, tableData, {
    startX: 60,
    startY: doc.y + 6,
    colWidths: [200, 140],
    rowHeight: 24,
    headerHeight: 26,
    maxY: doc.page.height - 60,
    fontSize: 10,
  });

  doc.end();
}

// ✅ Correct export
module.exports = { downloadPdf };
