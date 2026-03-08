require("dotenv").config();
const express = require("express");
const path = require('path');
const { Pool } = require('pg');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 5000;

const pool = new Pool({}); 

// --- Middleware ---
app.use(express.json()); 
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// --- Views (HTML pages) ---
// GET / -> serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// Optional: GET /resources -> serve resources.html directly
app.get('/resources', (req, res) => {
  res.sendFile(path.join(publicDir, 'resources.html'));
});

// --- Updated Validation Rules ---
const resourceValidators = [
  body('action').trim().isIn(['create']).withMessage("action must be 'create'"),

  body('resourceName')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('resourceName must be 3-30 characters')
    .matches(/^[a-zA-Z0-9 ]+$/).withMessage('resourceName must contain only letters and numbers'),

  body('resourceDescription')
    .trim()
    .isLength({ min: 10, max: 50 }).withMessage('resourceDescription must be 10-50 characters')
    .matches(/^[a-zA-Z0-9 ]+$/).withMessage('resourceDescription must contain only letters, numbers, and spaces'),

  body('resourceAvailable')
    .isBoolean().withMessage('resourceAvailable must be a boolean')
    .toBoolean()
    .custom(value => value === true).withMessage('resourceAvailable must be true'),

  body('resourcePrice')
    .isFloat({ min: 0 }).withMessage('resourcePrice must be a non-negative number')
    .toFloat(),

  body('resourcePriceUnit')
    .trim()
    // ADDED: 'month' and 'year' to the allowed list
    .isIn(['hour', 'day', 'month', 'week']).withMessage("resourcePriceUnit must be 'hour', 'day', 'month', or 'week'"),
];

// --- API Route ---
app.post('/api/resources', resourceValidators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      errors: errors.array().map(e => ({ field: e.path, msg: e.msg })),
    });
  }

  const { resourceName, resourceDescription, resourceAvailable, resourcePrice, resourcePriceUnit } = req.body;

  try {
    const insertSql = `
      INSERT INTO resources (name, description, available, price, price_unit)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, description, available, price, price_unit, created_at
    `;
    const params = [resourceName, resourceDescription, resourceAvailable, resourcePrice, resourcePriceUnit];
    const { rows } = await pool.query(insertSql, params);

    return res.status(201).json({ ok: true, data: rows[0] });
  } catch (err) {
    console.error('DB Error:', err);
    return res.status(500).json({ ok: false, error: 'Database error' });
  }
});

// --- JSON Error Handler ---
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ ok: false, error: "Invalid JSON format" });
  }
  next();
});
app.get('/debug', (req, res) => {
  res.json({ status: "Server is running perfectly!" });
});
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));