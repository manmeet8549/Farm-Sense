/*
 * ═══════════════════════════════════════════════════════════════
 * FarmSense AI — ESP32 Sensor Module
 * ═══════════════════════════════════════════════════════════════
 * 
 * Hardware Required:
 *   - ESP32 DevKit
 *   - DHT22 (Temperature + Humidity sensor) — Pin D4
 *   - Capacitive Soil Moisture Sensor v1.2 — Pin D34 (ADC)
 *   - Relay Module (for water pump) — Pin D26
 *   - LED indicator — Pin D2 (onboard)
 * 
 * Wiring:
 *   DHT22:  VCC → 3.3V, GND → GND, DATA → GPIO4
 *   Soil:   VCC → 3.3V, GND → GND, AOUT → GPIO34
 *   Relay:  VCC → 5V,   GND → GND, IN   → GPIO26
 *   
 * Firebase DB URL: https://farmsense-580c0-default-rtdb.firebaseio.com
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "DHT.h"

// ═══════════════════════════════════════════
// CONFIGURATION — Edit these values
// ═══════════════════════════════════════════
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Firebase Realtime Database
const char* FIREBASE_HOST = "https://farmsense-580c0-default-rtdb.firebaseio.com";
const char* USER_ID       = "user_001";

// Sensor Pins
#define DHT_PIN          4
#define DHT_TYPE         DHT22
#define SOIL_SENSOR_PIN  34   // Analog pin
#define RELAY_PIN        26   // Pump relay
#define LED_PIN          2    // Onboard LED

// Timing
#define SENSOR_INTERVAL  30000   // Read sensors every 30 seconds
#define PUMP_CHECK_INTERVAL 5000 // Check pump command every 5 seconds

// Soil moisture calibration (adjust based on your sensor)
#define SOIL_DRY_VALUE   4095   // ADC reading when completely dry
#define SOIL_WET_VALUE   1500   // ADC reading when submerged in water

// ═══════════════════════════════════════════
// GLOBALS
// ═══════════════════════════════════════════
DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastSensorRead = 0;
unsigned long lastPumpCheck  = 0;
bool pumpOn = false;

// ═══════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  Serial.println("\n🌱 FarmSense AI — ESP32 Starting...");
  
  // Pin modes
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);  // Pump OFF initially
  digitalWrite(LED_PIN, LOW);
  
  // Initialize DHT sensor
  dht.begin();
  
  // Connect to WiFi
  connectWiFi();
  
  Serial.println("✅ FarmSense ESP32 ready!\n");
}

// ═══════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════
void loop() {
  unsigned long now = millis();
  
  // Ensure WiFi is connected
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Read and upload sensor data periodically
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    readAndUploadSensors();
  }
  
  // Check pump status from Firebase
  if (now - lastPumpCheck >= PUMP_CHECK_INTERVAL) {
    lastPumpCheck = now;
    checkPumpStatus();
  }
  
  delay(100);
}

// ═══════════════════════════════════════════
// WiFi Connection
// ═══════════════════════════════════════════
void connectWiFi() {
  Serial.print("📶 Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
    digitalWrite(LED_PIN, !digitalRead(LED_PIN)); // Blink LED
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connected!");
    Serial.print("   IP: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_PIN, HIGH); // Solid LED = connected
  } else {
    Serial.println("\n❌ WiFi connection failed! Retrying in 5s...");
    digitalWrite(LED_PIN, LOW);
    delay(5000);
  }
}

// ═══════════════════════════════════════════
// Read Sensors & Upload to Firebase
// ═══════════════════════════════════════════
void readAndUploadSensors() {
  // Read DHT22
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();
  
  // Read soil moisture (analog)
  int soilRaw = analogRead(SOIL_SENSOR_PIN);
  int soilMoisture = map(soilRaw, SOIL_DRY_VALUE, SOIL_WET_VALUE, 0, 100);
  soilMoisture = constrain(soilMoisture, 0, 100);
  
  // Validate readings
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("⚠️ DHT sensor read failed!");
    return;
  }
  
  Serial.println("📊 Sensor Readings:");
  Serial.printf("   Soil Moisture: %d%%\n", soilMoisture);
  Serial.printf("   Temperature:   %.1f°C\n", temperature);
  Serial.printf("   Humidity:      %.1f%%\n", humidity);
  
  // Upload to Firebase — Update 'latest'
  String latestUrl = String(FIREBASE_HOST) + "/sensorData/" + USER_ID + "/latest.json";
  
  StaticJsonDocument<256> latestDoc;
  latestDoc["soilMoisture"] = soilMoisture;
  latestDoc["temperature"]  = round(temperature * 10) / 10.0;
  latestDoc["humidity"]     = round(humidity * 10) / 10.0;
  latestDoc["timestamp"]    = millis(); // Use server timestamp ideally
  
  String latestJson;
  serializeJson(latestDoc, latestJson);
  
  if (httpPut(latestUrl, latestJson)) {
    Serial.println("   ✅ Latest data uploaded");
  }
  
  // Push to 'history' for graphs
  String historyUrl = String(FIREBASE_HOST) + "/sensorData/" + USER_ID + "/history.json";
  
  if (httpPost(historyUrl, latestJson)) {
    Serial.println("   ✅ History entry added");
  }
  
  Serial.println();
}

// ═══════════════════════════════════════════
// Check Pump Status from Firebase
// ═══════════════════════════════════════════
void checkPumpStatus() {
  String url = String(FIREBASE_HOST) + "/irrigation/" + USER_ID + "/pumpStatus.json";
  
  HTTPClient http;
  http.begin(url);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String response = http.getString();
    response.replace("\"", ""); // Remove quotes
    
    bool shouldBeOn = (response == "ON");
    
    if (shouldBeOn != pumpOn) {
      pumpOn = shouldBeOn;
      digitalWrite(RELAY_PIN, pumpOn ? HIGH : LOW);
      Serial.printf("💧 Pump %s\n", pumpOn ? "ON ✅" : "OFF ⛔");
    }
  } else {
    Serial.printf("⚠️ Pump check failed (HTTP %d)\n", httpCode);
  }
  
  http.end();
}

// ═══════════════════════════════════════════
// HTTP Helper — PUT request
// ═══════════════════════════════════════════
bool httpPut(String url, String jsonPayload) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.PUT(jsonPayload);
  bool success = (httpCode == 200);
  
  if (!success) {
    Serial.printf("   ❌ PUT failed (HTTP %d)\n", httpCode);
  }
  
  http.end();
  return success;
}

// ═══════════════════════════════════════════
// HTTP Helper — POST request
// ═══════════════════════════════════════════
bool httpPost(String url, String jsonPayload) {
  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonPayload);
  bool success = (httpCode == 200);
  
  if (!success) {
    Serial.printf("   ❌ POST failed (HTTP %d)\n", httpCode);
  }
  
  http.end();
  return success;
}
