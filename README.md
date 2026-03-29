# Automated Smart Parking System
**St. Joseph's College of Engineering and Technology**

![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-339933?logo=node.js)
![Firebase](https://img.shields.io/badge/Database-Firebase-FFCA28?logo=firebase)
![Google Cloud](https://img.shields.io/badge/AI-Google%20Cloud%20Vision-4285F4?logo=google-cloud)
![ESP32](https://img.shields.io/badge/Hardware-ESP32-E7352C)

---

## 1. Project Overview & Features

A real-time, two-factor vehicle authentication system for college parking lots. Every vehicle entry or exit is verified using **two independent security checks** run in sequence:

1. **Factor 1 — RFID Tag Scan:** An ESP32 reads the vehicle's registered RFID tag and sends it to the Node.js backend. The backend confirms the tag is registered in the Firestore database before opening the gate.
2. **Factor 2 — ANPR Visual Verification (Automatic Number Plate Recognition):** After the gate opens, an ESP32-CAM silently captures a photo of the vehicle. Google Cloud Vision AI extracts the license plate from the image and compares it against the plate registered in the database. Any mismatch or missing plate triggers an automatic security alert flagged on the live dashboard.

### Key Features
- 🔐 **Dual-Factor Security** — RFID + AI Camera verification
- 🤖 **AI ANPR** — Google Cloud Vision OCR for Indian license plates
- ⚡ **Zero-Latency Gate Trigger** — Camera capture runs as background async task; gate opens instantly
- 📸 **Live Dashboard** — Real-time Firestore `onSnapshot` listeners update the UI instantly
- 🚨 **Security Alerts** — Plate mismatch or no-detection events flagged with visual red banners
- 🖼️ **Image Lightbox** — Click any snapshot to view the full-resolution ESP32-CAM photo
- 🛡️ **Granular Firestore Rules** — Owner-only access to vehicle and log documents
- 📱 **SMS Alerts** — Twilio integration to notify owners when vehicles are blocked

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOCAL NETWORK                           │
│                                                                 │
│  ┌─────────────┐      HTTP POST       ┌──────────────────────┐  │
│  │ ESP32 RFID  │ ─────/api/esp32/scan─▶                      │  │
│  │ + RC-522    │                      │   Node.js Backend    │  │
│  └─────────────┘                      │   (Express, Port 5000│  │
│                                       │                      │  │
│  ┌─────────────┐  GET /capture        │  1. Verify RFID in   │  │
│  │ ESP32-CAM   │ ◀────────────────────│     Firestore        │  │
│  │ (OV3660)    │ ──image/jpeg──────── │  2. Send 200 → Gate  │  │
│  └─────────────┘                      │  3. Fetch CAM image  │  │
│                                       │  4. Run Vision OCR   │  │
└───────────────────────────────────────│  5. Upload Storage   │  │
                                        │  6. Update Log doc   │  │
                                        └──────────┬───────────┘  │
                                                   │ Firebase Admin SDK
                                        ┌──────────▼───────────┐
                                        │      FIREBASE CLOUD   │
                                        │  ┌─────────────────┐  │
                                        │  │  Firestore DB   │  │
                                        │  │ (vehicles/logs) │  │
                                        │  └────────┬────────┘  │
                                        │           │            │
                                        │  ┌────────▼────────┐  │
                                        │  │ Cloud Storage   │  │
                                        │  │ (parking_snaps) │  │
                                        │  └─────────────────┘  │
                                        └──────────┬────────────┘
                                                   │ onSnapshot
                                        ┌──────────▼────────────┐
                                        │   React Dashboard      │
                                        │   (Vite, Port 5173)    │
                                        └───────────────────────┘
```

---

## 3. Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | v18+ | Backend runtime |
| [Arduino IDE](https://www.arduino.cc/en/software) | 2.x | ESP32 firmware |
| [Arduino ESP32 Board Package](https://docs.espressif.com/projects/arduino-esp32/en/latest/installing.html) | Latest | Board support for both ESP32 boards |
| [MFRC522 Arduino Library](https://github.com/miguelbalboa/rfid) | Latest | RC-522 RFID reader |
| [Firebase CLI](https://firebase.google.com/docs/cli) | Latest | Deployment |
| A Google Cloud / Firebase Project | — | All cloud backend services |

---

## 4. Hardware Setup

### 4.1 ESP32 WROOM (DevKit V1) + RC-522 RFID Reader — SPI Pinout

| RC-522 Pin | ESP32 Pin | Notes |
|-----------|-----------|-------|
| SDA (SS) | GPIO 5 | Chip Select |
| SCK | GPIO 18 | SPI Clock |
| MOSI | GPIO 23 | SPI Data Out |
| MISO | GPIO 19 | SPI Data In |
| RST | GPIO 22 | Reset |
| GND | GND | — |
| 3.3V | 3.3V | **Do NOT use 5V** |

Flash `esp32_rfid/esp32_rfid.ino`. After flashing, update the following constants at the top of the file:
```cpp
const char *WIFI_SSID = "YOUR_WIFI_SSID";
const char *WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char *BACKEND_SCAN_URL = "http://YOUR_PC_LOCAL_IP:5000/api/esp32/scan";
```

### 4.2 ESP32-CAM (AI-Thinker, OV3660 Sensor)

> ⚠️ **CRITICAL — Power Requirement:** The ESP32-CAM **must** be powered by a solid **5V / 2A** supply. Powering it over a standard USB cable from a PC often causes "brownout" resets when the camera activates its Wi-Fi radio simultaneously. Use a dedicated phone charger or a powered USB hub to prevent this.

Flash `esp32_cam/esp32_cam.ino`. Update your WiFi credentials:
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

After boot, the **Serial Monitor** (at 115200 baud) will print the camera's IP. Copy it for the backend `.env`:
```
CAMERA_IP=http://10.87.X.X/capture
```

---

## 5. Firebase & Google Cloud Setup

### 5.1 Get your Service Account Key
1. Go to the [Firebase Console](https://console.firebase.google.com) → **Project Settings** → **Service Accounts**.
2. Click **"Generate new private key"** and download the JSON file.
3. Rename it to `serviceAccountKey.json` and place it in the `/backend` directory.
4. **Add it to `.gitignore` immediately — never commit this file.**

### 5.2 Firestore Security Rules
Deploy the following in **Firestore → Rules**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    match /vehicles/{vehicleId} {
      allow read, write: if request.auth != null && resource.data.owner_uid == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.owner_uid == request.auth.uid;
    }
    match /logs/{logId} {
      allow read: if request.auth != null;
      allow update: if request.auth != null &&
        get(/databases/$(database)/documents/vehicles/$(resource.data.vehicle_id)).data.owner_uid == request.auth.uid;
      allow delete: if request.auth != null &&
        get(/databases/$(database)/documents/vehicles/$(resource.data.vehicle_id)).data.owner_uid == request.auth.uid;
      allow create: if false; // Only the Admin SDK backend can create logs
    }
  }
}
```

### 5.3 Firebase Storage Rules
In **Storage → Rules**, allow the Admin SDK to write publicly readable files:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /parking_snaps/{allPaths=**} {
      allow read: if true;
      allow write: if false; // Only the Admin SDK backend may write
    }
  }
}
```

### 5.4 Enable the Google Cloud Vision API
1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Select your Firebase project from the top project dropdown.
3. Navigate to **APIs & Services → Library**.
4. Search for **"Cloud Vision API"** and click **Enable**.
5. Your `serviceAccountKey.json` already has the permissions to call this API on behalf of your project.

---

## 6. Local Development Setup

### 6.1 Backend

```bash
cd smart-parking-alert/backend
npm install
```

Create a `.env` file in the `/backend` directory with the following variables:

```env
PORT=5000
FIREBASE_STORAGE_BUCKET="your-project-id.firebasestorage.app"
CAMERA_IP="http://ESP32_CAM_LOCAL_IP/capture"
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"
```

Start the backend:
```bash
node index.js
# Expected output: Server listening on port 5000
```

### 6.2 Frontend

```bash
cd smart-parking-alert/frontend
npm install
```

Create a `.env` file in the `/frontend` directory:
```env
VITE_FIREBASE_CONFIG='{...your firebase client config object as a JSON string...}'
```

> You can find the client config in the Firebase Console → Project Settings → Your Apps.

Start the development server:
```bash
npm run dev
# Open: http://localhost:5173
```

---

## 7. Firebase CLI & Hosting Deployment

### 7.1 Install Firebase Tools
```bash
npm install -g firebase-tools
```

### 7.2 Login & Initialize
```bash
firebase login
```

Navigate to the project root and initialize hosting:
```bash
cd smart-parking-alert
firebase init
```

At the prompts, select:
- **Which features?** → `Hosting: Configure files for Firebase Hosting`
- **Select your Firebase project** → Choose your project from the list
- **What do you want to use as your public directory?** → `frontend/dist`
- **Configure as a single-page app?** → `Yes`
- **Overwrite `index.html`?** → `No`

### 7.3 Build & Deploy
```bash
# Build the production React bundle
cd frontend
npm run build

# Return to root and deploy
cd ..
firebase deploy --only hosting
```

Firebase will output a live URL like:
```
✔  Hosting URL: https://your-project-id.web.app
```

---

## Project Structure

```
smart-parking-alert/
├── backend/
│   ├── routes/
│   │   ├── esp32.js        # RFID scan route + ANPR background logic
│   │   └── alerts.js       # Twilio SMS alert route
│   ├── firebase-admin.js   # Admin SDK initialization (db + bucket)
│   ├── serviceAccountKey.json  # ⚠️ NEVER COMMIT — add to .gitignore
│   ├── index.js
│   └── .env
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx   # Main bento grid UI + real-time logs
│       │   ├── Login.jsx
│       │   └── Register.jsx
│       └── config/
│           └── firebase.js     # Firebase client SDK init
├── esp32_rfid/
│   └── esp32_rfid.ino      # RFID scanner firmware
├── esp32_cam/
│   └── esp32_cam.ino       # Camera web server firmware
├── firestore.rules
├── firestore.indexes.json
└── README.md
```

---

*Built with ❤️ for St. Joseph's College of Engineering and Technology*
