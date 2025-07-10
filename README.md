# 🚨 MITR SOS Device – Complete Emergency Alert System

**Mitr** is a compact, AI-powered, phone-independent emergency SOS system designed to detect distress automatically or manually and notify trusted contacts with live GPS tracking — even when offline.

> 🔗 Frontend, Backend, Embedded Code – all integrated in this repository.

---

## 📦 Project Structure

```
Complete-Mitr/
├── frontend/          # React Web App (Victim control panel + live tracking)
├── backend/           # Node.js API server (Location log, reset, SMS handling)
├── embedded/          # ESP32 + A7670C device code (AI, GPS, GSM)
└── README.md          # This file
```

---

## 💡 Key Features

### 📱 Embedded Device (ESP32 + A7670C)
- 🎤 **AI-based Scream Detection** using TensorFlow Lite for Microcontrollers
- 🆘 **Manual Trigger Button** for SOS alert
- 📡 **GPS + GSM Module (A7670C)**:
  - Sends GPS to server via GPRS (HTTP)
  - Sends SMS with tracking link to contacts
- 📲 **Bluetooth Sync** with mobile app to:
  - Update emergency contacts
  - Modify trigger word & AI sensitivity
  - Reset after SOS
- 🔌 **Offline Buffering**:
  - Saves GPS + timestamp to SPIFFS if internet unavailable
  - Automatically uploads buffered data when network is restored
- 🔄 **Reset System**:
  - Device freezes after trigger until manually reset via mobile/web

### 🌐 Web Interface
- 🧭 **Live Tracking Page** (`/track?id=DEVICE_ID`)
- 👤 **Admin Panel** to reset device remotely
- 🗺️ **Stores logs with timestamps** per device

### 📱 Mobile App (via Bluetooth)
- Add/update emergency contacts
- Modify AI trigger sensitivity
- Reset triggered devices

---

## 🔧 Tech Stack

| Component        | Tech Used                      |
|------------------|-------------------------------|
| Embedded Code    | ESP32-S3, Arduino, TinyML, SPIFFS |
| AI Model         | TensorFlow Lite for Microcontrollers |
| GPS/GSM          | SIM A7670C module             |
| Backend Server   | Node.js + Express.js + MongoDB |
| Frontend         | React.js                      |
| Hosting          | Vercel (Frontend), Render (Backend) |

---

## 🛠️ Hardware Diagram

```
+----------------------------+
|   MITR SOS Device (Keychain)  |
|----------------------------|
| - ESP32-S3 (AI + Bluetooth) |
| - A7670C (GPS + GSM)        |
| - MAX9814 (Mic for AI)      |
| - Push Button (Manual SOS)  |
| - Battery + USB Charging    |
+----------------------------+
```

---

## 🔐 Security and Privacy

- 🔒 No data is stored permanently on the device
- 📲 Contacts and trigger words stored in EEPROM (writable via app)
- 🛡️ Server verifies device before showing GPS info

---

## 🚀 Future Features

- 🎙️ Multi-parameter AI model (scream + emotion + keyword detection)
- 🧠 Adaptive sensitivity based on environment
- 📍 Real-time location tracking with breadcrumbs
- 📉 Device analytics dashboard

---

## 👨‍💻 Contributors

- **Arjav Jain** – Embedded Systems, AI Model, Hardware
- **Kushagra** – Full Stack Developer (Frontend + Backend)
- **Abhey** – AI & Voice Classification
- **Prince** – Early Hardware Prototyping

---

## 🔗 Useful Links

- 🌍 **Live Map (Frontend)**: [mitr-location.vercel.app](https://mitr-location.vercel.app/)
- ⚙️ **API (Backend)**: [mitr-new-api.onrender.com](https://mitr-new-api.onrender.com/)
- 📦 **Embedded Repo**: `embedded/MitrSOSDevice.ino`
