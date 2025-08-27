// server.js

// --- Dependencies ---
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

// --- Configuration ---
const app = express();
const port = 3001; // Port for the backend server

// Middleware to parse JSON bodies and enable CORS
app.use(express.json());
app.use(cors());

// --- Database Connection ---
// IMPORTANT: Replace with your actual MySQL database credentials.
const db = mysql
  .createConnection({
    host: "localhost",
    user: "root", // or your mysql username
    password: "Sathvik123!", // or your mysql password
    database: "hotel_billing",
  })
  .promise();

// --- API Routes ---

// Test route
app.get("/", (req, res) => {
  res.send("Hotel Billing Backend is running!");
});

// GET all menu items
app.get("/api/menu", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM menu_items ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error("Error fetching menu items:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST a new menu item
app.post("/api/menu", async (req, res) => {
  const { alphaCode, numericCode, description, generalRate, acRate } = req.body;

  if (!alphaCode || !numericCode || !description || !generalRate || !acRate) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const [result] = await db.query(
      "INSERT INTO menu_items (alphaCode, numericCode, description, generalRate, acRate, fixedPrice) VALUES (?, ?, ?, ?, ?, ?)",
      [alphaCode, numericCode, description, generalRate, acRate, generalRate] // Default fixedPrice to generalRate
    );
    res.status(201).json({ id: result.insertId, ...req.body });
  } catch (err) {
    console.error("Error adding menu item:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// POST a new bill
app.post("/api/bills", async (req, res) => {
  const { billDetails, billItems, total } = req.body;

  if (!billDetails || !billItems || billItems.length === 0 || !total) {
    return res.status(400).json({ error: "Invalid bill data" });
  }

  const connection = await db.getConnection(); // Get a connection from the pool
  try {
    await connection.beginTransaction();

    const [billResult] = await connection.query(
      "INSERT INTO bills (tableNo, partyNo, waiterNo, area, totalAmount) VALUES (?, ?, ?, ?, ?)",
      [
        billDetails.tableNo,
        billDetails.partyNo,
        billDetails.waiterNo,
        billDetails.area,
        total,
      ]
    );
    const billId = billResult.insertId;

    const billItemPromises = billItems.map((item) => {
      return connection.query(
        "INSERT INTO bill_items (bill_id, item_id, quantity, rate, amount) VALUES (?, ?, ?, ?, ?)",
        [billId, item.id, item.quantity, item.price, item.quantity * item.price]
      );
    });

    await Promise.all(billItemPromises);

    await connection.commit();
    res.status(201).json({ success: true, billId: billId });
  } catch (err) {
    await connection.rollback();
    console.error("Error saving bill:", err);
    res.status(500).json({ error: "Failed to save bill" });
  } finally {
    connection.release(); // Release the connection back to the pool
  }
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
