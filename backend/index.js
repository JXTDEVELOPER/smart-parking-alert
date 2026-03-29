require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { admin, db } = require('./firebase-admin');
const alertsRoute = require('./routes/alerts');
const esp32Route = require('./routes/esp32');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/alerts', alertsRoute);
app.use('/api/esp32', esp32Route);

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'Smart Parking Alert Backend is running.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
