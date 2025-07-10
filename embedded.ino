// MITR SOS DEVICE - Embedded Code (ESP32 + A7670C)
// Features: Scream Detection, Manual Trigger, GPS+GSM, Bluetooth, Offline Buffer

// === Libraries ===
#include <Arduino.h>
#include <TensorFlowLite.h>              // TensorFlow Lite for Microcontrollers
#include "model_data.h"                  // TinyML model data array
#include <EEPROM.h>                      // For storing persistent settings
#include <BluetoothSerial.h>             // Bluetooth support for ESP32
#include <ArduinoJson.h>                 // JSON parsing from app input
#include "FS.h"                          // File system support
#include "SPIFFS.h"                      // SPI Flash File System (used for offline storage)
#include "driver/i2s.h"                  // I2S driver for microphone audio input

// === Microphone Pins ===
#define I2S_WS 25
#define I2S_SD 34
#define I2S_SCK 26

// === Button Pin ===
#define BUTTON_PIN 12

// === A7670C Module Pins ===
#define A7670C_RX 16
#define A7670C_TX 17

// === EEPROM Size & Data Offsets ===
#define EEPROM_SIZE 512
#define CONTACT1_OFFSET 0
#define CONTACT2_OFFSET 30
#define TRIGGER_OFFSET 60
#define SENSITIVITY_OFFSET 100

// === Audio Sampling ===
#define SAMPLE_RATE 16000
#define SAMPLE_BUFFER_SIZE 16000

// === Global Variables ===
BluetoothSerial SerialBT;
HardwareSerial A7670C(1);
bool sosTriggered = false;
String contacts[2];
String triggerWord = "help";
float sensitivity = 0.8;
String deviceID = "MITR001";  // Unique Device ID

// === TensorFlow Lite Globals ===
namespace {
  tflite::MicroErrorReporter micro_error_reporter;
  tflite::ErrorReporter* error_reporter = &micro_error_reporter;
  const tflite::Model* model = tflite::GetModel(model_data);
  tflite::MicroInterpreter* interpreter;
  constexpr int tensor_arena_size = 32 * 1024;
  uint8_t tensor_arena[tensor_arena_size];
}
TfLiteTensor* input;

// === Function Prototypes ===
void setupModel();
void setupI2S();
bool detectScream();
void triggerSOS(String reason);
String getGPSLocation();
bool sendToServer(String location);
void sendSMSWithLink(String location);
void saveToBuffer(String location);
void uploadBufferedLocations();
void handleBluetooth();
void checkForReset();
void loadFromEEPROM();
String readModem();
String parseGPS(String raw);

// === Setup Function ===
void setup() {
  Serial.begin(115200);
  A7670C.begin(9600, SERIAL_8N1, A7670C_RX, A7670C_TX);
  SerialBT.begin("MITR-DEVICE");
  EEPROM.begin(EEPROM_SIZE);
  SPIFFS.begin(true);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  loadFromEEPROM();     // Load settings from EEPROM
  setupI2S();           // Initialize microphone
  setupModel();         // Initialize TinyML model
  Serial.println("MITR SOS Device Initialized.");
}

// === Main Loop ===
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 4000; // 4 seconds
void loop() {
  unsigned long currentTime = millis();
  if (!sosTriggered) {
    if (currentTime - lastSendTime >= sendInterval) {
      uploadBufferedLocations();
      lastSendTime = currentTime;
    }
    if (detectScream()) {
      triggerSOS("Scream Detected");
    }
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(200);
      if (digitalRead(BUTTON_PIN) == LOW) {
        triggerSOS("Button Pressed");
      }
    }
    handleBluetooth();         // Receive and store config from mobile
    uploadBufferedLocations(); // Try sending offline saved coordinates
  } else {
    checkForReset();           // Wait for RESET via Bluetooth
  }
}

// === Model Setup ===
void setupModel() {
  static tflite::MicroMutableOpResolver<4> resolver;
  resolver.AddFullyConnected();
  resolver.AddReshape();
  resolver.AddSoftmax();
  resolver.AddQuantize();

  static tflite::MicroInterpreter static_interpreter(
    model, resolver, tensor_arena, tensor_arena_size, error_reporter);
  interpreter = &static_interpreter;
  interpreter->AllocateTensors();
  input = interpreter->input(0);
}

// === Audio Scream Detection ===
bool detectScream() {
  int16_t audio_data[SAMPLE_BUFFER_SIZE];
  size_t bytes_read = 0;
  i2s_read(I2S_NUM_0, audio_data, SAMPLE_BUFFER_SIZE * sizeof(int16_t), &bytes_read, portMAX_DELAY);
  for (int i = 0; i < SAMPLE_BUFFER_SIZE; ++i) {
    input->data.int8[i] = (int8_t)(audio_data[i] >> 8);
  }
  if (interpreter->Invoke() != kTfLiteOk) return false;
  TfLiteTensor* output = interpreter->output(0);
  return output->data.uint8[0] > (uint8_t)(sensitivity * 255);
}

// === I2S Microphone Setup ===
void setupI2S() {
  const i2s_config_t i2s_config = {
    .mode = i2s_mode_t(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_I2S_MSB,
    .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
    .dma_buf_count = 4,
    .dma_buf_len = 1024,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };
  const i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_SCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = I2S_SD
  };
  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0);
}

// === Trigger SOS Event ===
void triggerSOS(String reason) {
  Serial.println("Triggering SOS due to: " + reason);
  sosTriggered = true;
  String gpsData = getGPSLocation();
  bool sent = sendToServer(gpsData);
  if (!sent) {
    saveToBuffer(gpsData);     // Save locally if no internet
  }
  sendSMSWithLink(gpsData);    // Send tracking link via SMS
}

// === Get GPS Location from A7670C ===
String getGPSLocation() {
  A7670C.println("AT+CGPSINFO");
  delay(2000);
  String response = readModem();
  return parseGPS(response);
}

// === HTTP POST to Server ===
bool sendToServer(String location) {
  A7670C.println("AT+HTTPINIT");
  delay(500);
  A7670C.println("AT+HTTPPARA="CID","1"");
  delay(500);
  A7670C.println("AT+HTTPPARA="URL","https://mitr-new-api.onrender.com/api/location"");
  delay(500);
  A7670C.println("AT+HTTPPARA="USERDATA","API-KEY: *****"");
  delay(500);
  A7670C.println("AT+HTTPDATA=100,10000");
  delay(500);
  A7670C.print("location=" + location);
  delay(1000);
  A7670C.println("AT+HTTPACTION=1");
  delay(3000);
  String response = readModem();
  return response.indexOf(",200,") > 0; // Check for HTTP 200
}

// === Save GPS to SPIFFS (if offline) ===
void saveToBuffer(String location) {
  if (!SPIFFS.exists("/buffer.txt")) {
    File init = SPIFFS.open("/buffer.txt", FILE_WRITE);
    init.println(deviceID); // Write device ID at the top
    init.close();
  }
  String timestamp = String(millis());
  File file = SPIFFS.open("/buffer.txt", FILE_APPEND);
  if (file) {
    file.println(timestamp + "," + location);
    file.close();
  }
}

// === Send SMS with Tracking Link ===
void sendSMSWithLink(String location) {
  String link = "https://mitr-location.vercel.app/track?id=" + deviceID;
  for (String contact : contacts) {
    if (contact.length() > 0) {
      A7670C.println("AT+CMGS="" + contact + """);
      delay(500);
      A7670C.print("🚨 Emergency! Track: " + link);
      A7670C.write(26);
      delay(3000);
    }
  }
}

// === Bluetooth Data Receiver (App Settings) ===
void handleBluetooth() {
  if (SerialBT.available()) {
    String input = SerialBT.readStringUntil('\n');
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, input);
    if (!err) {
      contacts[0] = doc["contacts"][0].as<String>();
      contacts[1] = doc["contacts"][1].as<String>();
      triggerWord = doc["trigger_word"].as<String>();
      sensitivity = doc["sensitivity"].as<float>();

      EEPROM.writeString(CONTACT1_OFFSET, contacts[0]);
      EEPROM.writeString(CONTACT2_OFFSET, contacts[1]);
      EEPROM.writeString(TRIGGER_OFFSET, triggerWord);
      EEPROM.put(SENSITIVITY_OFFSET, sensitivity);
      EEPROM.commit();

      SerialBT.println("✅ Data saved to EEPROM");
    } else {
      SerialBT.println("❌ JSON parse error");
    }
  }
}

// === Check for Reset Command via Bluetooth ===
void checkForReset() {
  if (SerialBT.available()) {
    String cmd = SerialBT.readStringUntil('\n');
    if (cmd == "RESET") {
      sosTriggered = false;
      SerialBT.println("Device Reset.");
    }
  }
}

// === Load Config from EEPROM ===
void loadFromEEPROM() {
  contacts[0] = EEPROM.readString(CONTACT1_OFFSET);
  contacts[1] = EEPROM.readString(CONTACT2_OFFSET);
  triggerWord = EEPROM.readString(TRIGGER_OFFSET);
  EEPROM.get(SENSITIVITY_OFFSET, sensitivity);
}

// === Check if Internet is Available ===
bool isInternetAvailable() {
  A7670C.println("AT+CREG?");
  delay(500);
  String response = readModem();
  return response.indexOf(",1") != -1 || response.indexOf(",5") != -1; // Registered to network
}

// === Read Serial Response from A7670C ===
String readModem() {
  String response = "";
  long timeout = millis() + 5000;
  while (millis() < timeout) {
    while (A7670C.available()) {
      response += char(A7670C.read());
    }
  }
  return response;
}

// === Parse GPS Response from AT+CGPSINFO ===
String parseGPS(String raw) {
  int start = raw.indexOf(":");
  if (start != -1) return raw.substring(start + 1).trim();
  return "0,0";
}

// === Re-upload Offline Stored GPS Data ===
bool isInternetAvailable();

void uploadBufferedLocations() {
  if (!SPIFFS.exists("/buffer.txt")) return;
  File file = SPIFFS.open("/buffer.txt", FILE_READ);
  if (!file || file.size() == 0) return;

  File tempFile = SPIFFS.open("/temp.txt", FILE_WRITE);
  String deviceHeader = file.readStringUntil('\n');
  tempFile.println(deviceHeader);  // Keep device ID

  while (file.available()) {
    String line = file.readStringUntil('\n');
    if (line.length() == 0) continue;
    int commaIdx = line.indexOf(',');
    if (commaIdx == -1) continue;

    String timestamp = line.substring(0, commaIdx);
    String location = line.substring(commaIdx + 1);
        bool success = false;
    if (isInternetAvailable()) {
      success = sendToServer(location);
    }
    if (!success) {
      tempFile.println(line);  // Keep for next time
    }
  }
  file.close();
  tempFile.close();
  SPIFFS.remove("/buffer.txt");
  SPIFFS.rename("/temp.txt", "/buffer.txt");
}