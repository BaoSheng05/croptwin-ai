#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Requires ArduinoJson library

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your Backend IP Address (must be accessible from the ESP32)
// Example: "http://192.168.1.100:8000/api/sensors/readings"
const char* serverUrl = "http://YOUR_COMPUTER_IP:8000/api/sensors/readings";

// Which layer this ESP32 represents
const char* layerId = "a_01"; 

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);

  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Simulate reading physical sensors (DHT22, Soil Moisture, etc.)
    // In a real scenario, you would use: float temp = dht.readTemperature();
    float temp = 22.5 + random(-10, 10) / 10.0;
    float humidity = 60.0 + random(-20, 20) / 10.0;
    float moisture = 70.0 + random(-50, 50) / 10.0;
    float ph = 6.0 + random(-2, 2) / 10.0;
    int light = 500 + random(-50, 50);

    // Build the JSON payload using ArduinoJson
    StaticJsonDocument<200> doc;
    doc["layer_id"] = layerId;
    doc["temperature"] = temp;
    doc["humidity"] = humidity;
    doc["soil_moisture"] = moisture;
    doc["ph"] = ph;
    doc["light_intensity"] = light;
    doc["water_level"] = 80.0;

    String requestBody;
    serializeJson(doc, requestBody);

    Serial.println("Sending data to CropTwin AI:");
    Serial.println(requestBody);

    // Send the POST request
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpResponseCode);
      String payload = http.getString();
      Serial.println(payload);
    } else {
      Serial.printf("Error code: %d\n", httpResponseCode);
    }
    
    http.end();
  }
  
  // Send telemetry every 5 seconds
  delay(5000);
}
