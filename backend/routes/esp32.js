const express = require('express');
const router = express.Router();
const { admin, db, bucket } = require('../firebase-admin');

const vision = require('@google-cloud/vision');
const visionClient = new vision.ImageAnnotatorClient({ keyFilename: './serviceAccountKey.json' });

const COOLDOWN_SECONDS = 10;

// POST /api/esp32/scan
router.post('/scan', async (req, res) => {
  const { rfid_uid } = req.body;

  if (!rfid_uid) {
    return res.status(400).json({ error: 'rfid_uid is required.' });
  }

  try {
    // Step 1: Look up the vehicle by RFID UID
    const snapshot = await db.collection('vehicles')
      .where('rfid_uid', '==', rfid_uid)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'Unregistered Vehicle' });
    }

    // Step 2: Extract vehicle data
    const vehicleDoc = snapshot.docs[0];
    const vehicle_id = vehicleDoc.id;
    const vehicleData = vehicleDoc.data();
    const registeredPlate = vehicleData.plate_number;

    // Step 3: Enforce cooldown to prevent duplicate rapid scans
    if (vehicleData.last_scan_at) {
      const lastScanMs = vehicleData.last_scan_at.toMillis();
      const elapsedSeconds = (Date.now() - lastScanMs) / 1000;

      if (elapsedSeconds < COOLDOWN_SECONDS) {
        const remaining = Math.ceil(COOLDOWN_SECONDS - elapsedSeconds);
        return res.status(200).json({
          message: `Scan ignored (cooldown active). Try again in ${remaining}s.`,
          cooldown: true
        });
      }
    }

    // Step 4: Determine current status and toggle to new state
    const currentStatus = vehicleData.status || 'outside';
    const newStatus = currentStatus === 'outside' ? 'inside' : 'outside';
    const logType = currentStatus === 'outside' ? 'entry' : 'exit';

    // Step 5: Update vehicle document with new status and scan timestamp
    await db.collection('vehicles').doc(vehicle_id).update({
      status: newStatus,
      last_scan_at: admin.firestore.FieldValue.serverTimestamp()
    });

    // Step 6: Write initial basic log entry (without imageUrl)
    const logPayload = {
      vehicle_id,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: logType
    };
    const logRef = await db.collection('logs').add(logPayload);

    const action = logType === 'entry' ? 'Entry Granted' : 'Exit Recorded';
    
    // Step 7: IMMEDIATELY Return 200 to ESP32 Context (Opens Gate instantly)
    res.status(200).json({ message: `${action} & Logged`, vehicle_id, status: newStatus, type: logType });

    // Step 8: BACKGROUND FIRE-AND-FORGET THREAD: Fetch image, upload, and update DB
    (async () => {
      try {
        const cameraIp = process.env.CAMERA_IP || 'http://192.168.1.50/capture';
        // 15s timeout is safe here since it runs asynchronously in the background
        const camRes = await fetch(cameraIp, { signal: AbortSignal.timeout(15000) });
        
        if (camRes.ok) {
          const arrayBuffer = await camRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // --- Google Cloud Vision ANPR Processing ---
          const [result] = await visionClient.textDetection(buffer);
          const detections = result.textAnnotations;
          const rawText = detections.length > 0 ? detections[0].description : '';
          
          // Clean Indian License Plate Formats (e.g., KL 05 AB 1234)
          // Strip newlines and special characters keeping only exact alphanumerics
          const cleanText = rawText.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          const plateRegex = /([A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4})/;
          const match = cleanText.match(plateRegex);
          const extractedPlate = match ? match[1] : '';

          // --- Security Alert Logic ---
          const normalizePlate = (str) => str ? str.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
          const cleanRegistered = normalizePlate(registeredPlate);
          const cleanDetected = normalizePlate(extractedPlate);

          let isAlert = false;
          let alertReason = "";

          if (!cleanDetected) {
            isAlert = true;
            alertReason = "No plate detected";
          } else if (!cleanDetected.includes(cleanRegistered)) {
            isAlert = true;
            alertReason = "Plate mismatch detected!";
          }

          // Resume Firebase sequence
          const fileName = `parking_snaps/${vehicle_id}_${Date.now()}.jpg`;
          const file = bucket.file(fileName);
          
          await file.save(buffer, {
            metadata: { contentType: 'image/jpeg' }
          });
          
          // Use user-requested public url logic
          await file.makePublic();
          const imageUrl = file.publicUrl();
          
          // Bind image URL, ANPR metadata, AND SECURITY ALERTS to the active log ref
          await logRef.update({ 
            imageUrl,
            detected_plate: extractedPlate,
            raw_vision_text: rawText,
            alert: isAlert,
            alert_reason: alertReason,
            registered_plate: registeredPlate
          });
          console.log(`Background ANPR + image upload successful for log: ${logRef.id}`);
        } else {
          console.error('Background Camera fetched HTTP', camRes.status);
        }
      } catch (camErr) {
        // Failsafe: logs backend faults silently without affecting gate routines
        console.error('Background camera capture offline or timeout:', camErr.message);
      }
    })();

  } catch (err) {
    console.error('ESP32 scan error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;
