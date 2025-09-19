const multer = require("multer");
const XLSX = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
const { parsePrice, getColumnValue } = require("../utils/helpers");

const upload = multer({ dest: "uploads/" });

let latestData = null;

// ===== Status List =====
const statusList = [
  "all",
  "rto",
  "door_step_exchanged",
  "delivered",
  "cancelled",
  "ready_to_ship",
  "shipped",
  "supplier_listed_price",
  "supplier_discounted_price",
];

// ===== Categorize Rows =====
function categorizeRows(rows) {
  const categories = {};
  statusList.forEach((status) => (categories[status] = []));
  categories.other = [];

  let totalSupplierListedPrice = 0;
  let totalSupplierDiscountedPrice = 0;
  let sellInMonthProducts = 0;
  let deliveredSupplierDiscountedPriceTotal = 0;
  let totalDoorStepExchanger = 0;

  rows.forEach((row) => {
    const status = (row["Reason for Credit Entry"] || "").toLowerCase().trim();
    categories["all"].push(row);

    const listedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Listed Price (Incl. GST + Commission)",
        "Supplier Listed Price",
        "Listed Price",
      ])
    );

    const discountedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Discounted Price (Incl GST and Commission)",
        "Supplier Discounted Price (Incl GST and Commision)", // typo handled
        "Supplier Discounted Price",
        "Discounted Price",
      ])
    );

    totalSupplierListedPrice += listedPrice;
    totalSupplierDiscountedPrice += discountedPrice;

    if (status.includes("delivered")) {
      sellInMonthProducts++;
      deliveredSupplierDiscountedPriceTotal += discountedPrice;
    }

    if (status.includes("door_step_exchanged")) {
      totalDoorStepExchanger += 80;
    }

    let matched = false;
    if (
      status.includes("rto_complete") ||
      status.includes("rto_locked") ||
      status.includes("rto_initiated")
    ) {
      categories["rto"].push(row);
      matched = true;
    } else {
      statusList.forEach((s) => {
        if (s !== "all" && s !== "rto" && status.includes(s)) {
          categories[s].push(row);
          matched = true;
        }
      });
    }

    if (!matched) categories.other.push(row);
  });

  const totalProfit =
    deliveredSupplierDiscountedPriceTotal - sellInMonthProducts * 500;

  const profitPercent =
    sellInMonthProducts > 0
      ? (totalProfit / (sellInMonthProducts * 500)) * 100
      : 0;

  categories.totals = {
    totalSupplierListedPrice,
    totalSupplierDiscountedPrice,
    sellInMonthProducts,
    deliveredSupplierDiscountedPriceTotal,
    totalDoorStepExchanger,
    totalProfit,
    profitPercent: profitPercent.toFixed(2),
  };

  return categories;
}

// ===== Save Data =====
function saveData(rows, res) {
  if (!rows || !rows.length) {
    return res.status(400).json({ message: "No data to save" });
  }

  const categorized = categorizeRows(rows);

  // Build profit graph
  const profitByDate = {};
  rows.forEach((row) => {
    const status = (row["Reason for Credit Entry"] || "").toLowerCase().trim();
    if (!status.includes("delivered")) return;

    const dateKey =
      row["Order Date"] ||
      row["Date"] ||
      row["Created At"] ||
      row["Delivered Date"];

    if (!dateKey) return;

    const date = new Date(dateKey).toISOString().split("T")[0];

    const discountedPrice = parsePrice(
      getColumnValue(row, [
        "Supplier Discounted Price (Incl GST and Commission)",
        "Supplier Discounted Price (Incl GST and Commision)",
        "Supplier Discounted Price",
        "Discounted Price",
      ])
    );

    if (!profitByDate[date]) {
      profitByDate[date] = { total: 0, count: 0 };
    }

    profitByDate[date].total += discountedPrice;
    profitByDate[date].count += 1;
  });

  const profitGraphArray = Object.entries(profitByDate).map(([date, { total, count }]) => ({
    date,
    profit: total - count * 500,
  }));

  latestData = {
    submittedAt: new Date(),
    data: rows,
    totals: categorized.totals,
    categories: categorized,
    profitByDate: profitGraphArray,
  };

  console.log("✅ Data stored in memory with", rows.length, "rows");
  return res.json({ ...categorized, profitByDate: profitGraphArray });
}

// ===== Upload File =====
exports.uploadFile = [
  upload.single("file"),
  (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const ext = path.extname(file.originalname).toLowerCase();
    let rows = [];

    try {
      if (ext === ".csv") {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on("data", (data) => rows.push(data))
          .on("end", () => {
            fs.unlinkSync(file.path);
            saveData(rows, res);
          })
          .on("error", (err) => {
            console.error("❌ CSV parse error:", err.message);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return res.status(500).json({ error: "CSV parse failed" });
          });
      } else if (ext === ".xlsx" || ext === ".xls") {
        const workbook = XLSX.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        fs.unlinkSync(file.path);
        saveData(rows, res);
      } else {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: "Unsupported file format" });
      }
    } catch (error) {
      console.error("❌ Error processing file:", error);
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(500).json({ error: "Failed to process file" });
    }
  },
];

// ===== Get Profit Graph =====
exports.getProfitGraph = (req, res) => {
  if (!latestData) return res.status(404).json({ error: "No data found" });
  res.json(latestData.profitByDate || []);
};

// ===== Filter By Sub Order =====
exports.filterBySubOrder = (req, res) => {
  if (!latestData) return res.status(404).json({ error: "No data found" });

  const subOrderNo = req.params.subOrderNo.trim().toLowerCase();
  const rows = latestData.data;

  const match = rows.find((row) => {
    const keys = Object.keys(row).map((k) => k.toLowerCase());
    const subOrderKey = keys.find((k) => k.includes("sub") && k.includes("order"));
    if (
      subOrderKey &&
      row[subOrderKey] &&
      row[subOrderKey].toString().trim().toLowerCase() === subOrderNo
    ) {
      return true;
    }
    return Object.values(row).some(
      (v) => v && v.toString().trim().toLowerCase() === subOrderNo
    );
  });

  if (!match) return res.status(404).json({ error: "Sub Order No not found" });

  const listedPrice = parsePrice(
    getColumnValue(match, [
      "Supplier Listed Price (Incl. GST + Commission)",
      "Supplier Listed Price",
      "Listed Price",
    ])
  );

  const discountedPrice = parsePrice(
    getColumnValue(match, [
      "Supplier Discounted Price (Incl GST and Commission)",
      "Supplier Discounted Price (Incl GST and Commision)",
      "Supplier Discounted Price",
      "Discounted Price",
    ])
  );

  res.json({
    subOrderNo,
    listedPrice,
    discountedPrice,
    profit: discountedPrice - 500, // ✅ Corrected formula
  });
};

// ===== Export Latest Data =====
exports._getLatestData = () => latestData;
