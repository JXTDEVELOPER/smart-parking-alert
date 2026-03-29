#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>

// =======================
// WIFI CREDENTIALS
// =======================
const char* ssid = "302";
const char* password = "12345678";

// =======================
// CAMERA PINOUT (Standard AI-Thinker ESP32-CAM)
// =======================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

WebServer server(80);

void handleCapture() {
  camera_fb_t * fb = NULL;
  
  // 1. Grab a frame from the frame buffer
  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed!");
    server.send(500, "text/plain", "Camera capture failed");
    return;
  }

  // 2. Return the frame directly to the HTTP client
  server.setContentLength(fb->len);
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "image/jpeg", "");
  
  WiFiClient client = server.client();
  client.write(fb->buf, fb->len);

  // 3. Return the frame buffer immediately to free up memory
  esp_camera_fb_return(fb);
  
  Serial.println("Snapshot sent successfully!");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nInitializing ESP32-CAM...");

  // Initialize Camera Configuration
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // OV3660 Optimization
  // PSRAM check allows higher resolutions
  if (psramFound()) {
    config.frame_size = FRAMESIZE_UXGA; // UXGA (1600x1200) for high quality
    config.jpeg_quality = 10;           // Lower means higher quality (0-63)
    config.fb_count = 2;                // Double buffering
  } else {
    config.frame_size = FRAMESIZE_SVGA; // Fallback to SVGA (800x600)
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  // Initialize the camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x\n", err);
    return;
  }

  // Apply OV3660-specific sensor tweaks (optional but recommended for clarity)
  sensor_t * s = esp_camera_sensor_get();
  if (s->id.PID == OV3660_PID) {
    s->set_vflip(s, 1);      // flip vertically if needed
    s->set_brightness(s, 1); // boost brightness a bit
    s->set_saturation(s, 0); 
  }

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWi-Fi Connected!");
  
  // Start the Native Web Server Endpoint
  server.on("/capture", HTTP_GET, handleCapture);
  server.begin();

  // Print IP for Node.js .env Mapping
  Serial.println("===============================");
  Serial.println("CAMERA SERVER RUNNING");
  Serial.print("Add this to your Node.js .env: CAMERA_IP=http://");
  Serial.print(WiFi.localIP());
  Serial.println("/capture");
  Serial.println("===============================");
}

void loop() {
  server.handleClient();
}
