/*
 * Smart College Parking - ESP32 WROOM + MFRC522 RFID → backend /api/esp32/scan
 *
 * Board: ESP32 Dev Module (or equivalent WROOM)
 * Library: MFRC522 by GithubCommunity (Arduino Library Manager)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// --- WiFi: set your network credentials ---
const char *WIFI_SSID = "302";
const char *WIFI_PASSWORD = "12345678";

// --- Backend API ---
// IMPORTANT: Replace 192.168.X.X with your computer's local IPv4 address (same LAN as the ESP32).
// Example: run `ipconfig` (Windows) or `ip addr` / `ifconfig` (Linux/macOS) and use the Wi‑Fi IPv4.
const char *BACKEND_SCAN_URL = "http://10.87.210.208:5000/api/esp32/scan";

// --- MFRC522 on ESP32 WROOM (SPI) ---
// Typical VSPI mapping; SS and RST as specified.
#define MFRC522_SCK 18
#define MFRC522_MISO 19
#define MFRC522_MOSI 23
#define SS_PIN 5
#define RST_PIN 22

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Convert UID bytes to continuous uppercase hex string (e.g. "A1B2C3D4")
String uidToHexString(const MFRC522::Uid &uid) {
  String out = "";
  for (byte i = 0; i < uid.size; i++) {
    byte b = uid.uidByte[i];
    if (b < 0x10) {
      out += "0";
    }
    out += String(b, HEX);
  }
  out.toUpperCase();
  return out;
}

void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println();
  Serial.println(F("Smart Parking RFID - ESP32 + MFRC522"));

  // SPI for ESP32: use explicit pins
  SPI.begin(MFRC522_SCK, MFRC522_MISO, MFRC522_MOSI, SS_PIN);
  mfrc522.PCD_Init();

  delay(100);
  mfrc522.PCD_DumpVersionToSerial();  // reader diagnostics
  Serial.println(F("MFRC522 ready."));

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print(F("Connecting to WiFi"));
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(F("."));
  }
  Serial.println();
  Serial.print(F("WiFi connected. IP address: "));
  Serial.println(WiFi.localIP());

  Serial.println(F("Present RFID tag to scan..."));
}

void loop() {
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  String rfidUid = uidToHexString(mfrc522.uid);
  Serial.print(F("UID: "));
  Serial.println(rfidUid);

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("WiFi disconnected; reconnecting..."));
    WiFi.reconnect();
    delay(2000);
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(2000);
    return;
  }

  HTTPClient http;
  http.begin(BACKEND_SCAN_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(15000); // 15 seconds timeout to allow for backend camera fetch & generic cloud storage uploads

  String jsonBody = "{\"rfid_uid\":\"" + rfidUid + "\"}";
  int httpCode = http.POST(jsonBody);

  Serial.print(F("HTTP code: "));
  Serial.println(httpCode);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.print(F("Response: "));
    Serial.println(payload);
  } else {
    Serial.print(F("HTTP request failed: "));
    Serial.println(http.errorToString(httpCode).c_str());
  }

  http.end();

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  delay(2000);
}
