const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// POST /api/alerts/send
router.post('/send', async (req, res) => {
  const { phoneNumber, plateNumber } = req.body;

  if (!phoneNumber || !plateNumber) {
    return res.status(400).json({ error: 'phoneNumber and plateNumber are required.' });
  }

  try {
    const message = await client.messages.create({
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: `URGENT: Your vehicle (Plate: ${plateNumber}) is blocking another vehicle in the campus parking lot. Please move it immediately.`
    });

    res.status(200).json({ success: true, messageSid: message.sid });
  } catch (err) {
    console.error('Twilio error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
