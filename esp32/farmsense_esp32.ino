/*
 * ═══════════════════════════════════════════════════════════════
 * FarmSense AI — Professional Firmware (v3.4 MANUAL SWITCH)
 * ═══════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <SPI.h>
#include "DHT.h"

// --- CONFIG ---
const char* WIFI_SSID     = "Shinchan_4G";
const char* WIFI_PASSWORD = "manmeet8549";
const char* FIREBASE_HOST = "https://farmsense-580c0-default-rtdb.firebaseio.com";
const char* DEVICE_CODE   = "1234";

// --- PINS ---
#define DHT_PIN 4
#define SOIL_PIN 34
#define RELAY_PIN 26
#define LED_PIN 2
#define SWITCH_PIN 27  // Manual SPDT Switch

// OLED SPI
#define OLED_MOSI 23
#define OLED_CLK 18
#define OLED_DC 17
#define OLED_CS 5
#define OLED_RESET 16

DHT dht(DHT_PIN, DHT11);
Adafruit_SSD1306 display(128, 64, &SPI, OLED_DC, OLED_RESET, OLED_CS);

// --- STATE ---
float t = 0, h = 0;
int moist = 0;
bool pumpOn = false, manualMode = false;
unsigned long lastRelay = 0, lastWiFiRetry = 0, lastSync = 0, lastSensor = 0, lastDash = 0, lastUI = 0;
String mode = "AUTO";

void setup() {
  Serial.begin(115200);
  pinMode(RELAY_PIN, OUTPUT); pinMode(LED_PIN, OUTPUT); pinMode(SWITCH_PIN, INPUT_PULLUP);
  setRelay(false); dht.begin();
  if(!display.begin(SSD1306_SWITCHCAPVCC)) Serial.println("OLED Fail");
  display.clearDisplay(); display.setTextColor(WHITE);
  display.setTextSize(2); display.setCursor(10, 20); display.println("FarmSense"); display.display();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void loop() {
  unsigned long now = millis();
  manageWiFi(now);
  if (now - lastSensor >= 10000) { lastSensor = now; readSenses(); }
  if (now - lastSync >= 5000) { lastSync = now; sync(now); }
  if (now - lastDash >= 2000) { lastDash = now; printDash(); }
  
  handleSwitch();
  if (now - lastUI >= 50) { lastUI = now; updateUI(); }
}

void manageWiFi(unsigned long now) {
  if (WiFi.status() == WL_CONNECTED) digitalWrite(LED_PIN, HIGH);
  else { digitalWrite(LED_PIN, LOW); if (now - lastWiFiRetry >= 10000) { WiFi.begin(WIFI_SSID, WIFI_PASSWORD); lastWiFiRetry = now; } }
}

void printDash() {
  Serial.println("\n----------------------------------------");
  Serial.printf(" Moist: %d%% | Temp: %.1fC\n Pump:  %s | Mode: %s\n", moist, t, pumpOn ? "ON" : "OFF", manualMode ? "MANUAL" : mode.c_str());
}

void handleSwitch() {
  static bool lastSw = -1;
  bool sw = digitalRead(SWITCH_PIN); // LOW = ON (Pullup)
  if (sw != lastSw) {
    lastSw = sw;
    manualMode = true;
    setPump(sw == LOW);
  }
}

void updateUI() {
  display.clearDisplay();
  display.setTextSize(1); display.setCursor(0, 0);
  display.println("FARMSENSE AI MONITOR");
  display.drawLine(0, 10, 128, 10, WHITE);

  display.setCursor(0, 18); display.println("SOIL MOISTURE:");
  display.setTextSize(3); display.setCursor(0, 28); display.printf("%d%%", moist);

  display.setTextSize(1);
  display.setCursor(75, 20); display.printf("T:%.1fC", t);
  display.setCursor(75, 30); display.printf("H:%.0f%%", h);
  
  display.drawLine(0, 50, 128, 50, WHITE);
  display.setCursor(0, 54); 
  display.printf("PUMP:%s [%s]", pumpOn ? "ON" : "OFF", manualMode ? "MAN" : mode.c_str());
  display.setCursor(95, 54); display.printf("%s", (WiFi.status() == WL_CONNECTED) ? "WIFI" : "OFF!");
  display.display();
}

void setPump(bool on) {
  if (millis() - lastRelay < 1000) return;
  if (on != pumpOn) {
    pumpOn = on; setRelay(on); lastRelay = millis();
    if (WiFi.status() == WL_CONNECTED) {
      httpPut(String(FIREBASE_HOST) + "/irrigation/" + DEVICE_CODE + "/pumpStatus.json", on ? "\"ON\"" : "\"OFF\"");
    }
  }
}

void readSenses() {
  float temp = dht.readTemperature(); if (!isnan(temp) && temp < 100) { t = temp; h = dht.readHumidity(); }
  moist = constrain(map(analogRead(SOIL_PIN), 4095, 1500, 0, 100), 0, 100);
  if (WiFi.status() == WL_CONNECTED) {
    StaticJsonDocument<256> doc; doc["soilMoisture"] = moist; doc["temperature"] = round(t * 10) / 10.0;
    doc.createNestedObject("timestamp")[".sv"] = "timestamp";
    String j; serializeJson(doc, j);
    httpPut(String(FIREBASE_HOST) + "/sensorData/" + DEVICE_CODE + "/latest.json", j);
    httpPost(String(FIREBASE_HOST) + "/sensorData/" + DEVICE_CODE + "/history.json", j);
  }
}

void sync(unsigned long now) {
  if (WiFi.status() != WL_CONNECTED) return;
  static String lastCloudPump = "";
  HTTPClient h_cli; 
  h_cli.begin(String(FIREBASE_HOST) + "/irrigation/" + DEVICE_CODE + ".json");
  
  if (h_cli.GET() == 200) {
    StaticJsonDocument<512> doc; 
    deserializeJson(doc, h_cli.getString());
    
    String currentCloudPump = String(doc["pumpStatus"] | "OFF");
    mode = String(doc["mode"] | "MANUAL");

    // DETECT ONLINE OVERRIDE: If cloud status changed since our last fetch
    if (lastCloudPump != "" && currentCloudPump != lastCloudPump) {
      Serial.println("[CLOUD] Remote command detected: " + currentCloudPump);
      manualMode = false; // Remote command clears local manual override
      setPump(currentCloudPump == "ON");
    }
    lastCloudPump = currentCloudPump;

    // Logic based on Priority
    if (!manualMode) {
      bool target = (currentCloudPump == "ON");
      if (mode == "AUTO") {
        int threshold = doc["threshold"] | 30;
        if (moist < threshold && !target) target = true;
        else if (moist >= (threshold + 5) && target) target = false; // Added hysteresis
      }
      if (target != pumpOn) setPump(target);
    }

    // Heartbeat
    StaticJsonDocument<100> hb; hb["status"] = "online"; hb.createNestedObject("lastSeen")[".sv"] = "timestamp";
    String j; serializeJson(hb, j); httpPatch(String(FIREBASE_HOST) + "/devices/" + DEVICE_CODE + ".json", j);
  }
  h_cli.end();
}

void setRelay(bool on) { digitalWrite(RELAY_PIN, on ? LOW : HIGH); }
bool httpPut(String u, String j) { HTTPClient h; h.begin(u); int c = h.PUT(j); h.end(); return c == 200; }
bool httpPatch(String u, String j) { HTTPClient h; h.begin(u); int c = h.PATCH(j); h.end(); return c == 200; }
bool httpPost(String u, String j) { HTTPClient h; h.begin(u); int c = h.POST(j); h.end(); return c == 200; }
