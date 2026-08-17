# Erinnerungsapp

Eine moderne Android-App für Erinnerungen, entwickelt mit Ionic, Vue und Capacitor.

---

##  Funktionen

- **Erinnerungen erstellen und bearbeiten:** Speichere und bearbeite Aufgaben mit Datum und Uhrzeit.
- **Push-Benachrichtigungen:** Erhalte rechtzeitig Benachrichtigungen für deine Termine.
- **Intelligente Berechtigungen:** Automatische Abfrage und direkter Link zu den Systemeinstellungen, falls Benachrichtigungen deaktiviert sind.
- **App Shortcuts:** Greife über das App-Icon direkt auf Funktionen wie "Neue Erinnerung" zu.
- **Native Date & Time Picker:** Komfortable Auswahl von Terminen über das native Capawesome-Plugin.

---

##  Voraussetzungen

Stelle sicher, dass folgende Software installiert ist:
- **Node.js** (LTS Version empfohlen)
- **Java JDK** (Version 17 oder höher empfohlen)
- **Android Studio** (für Emulator und Build-Prozesse)
- **Ionic CLI** (`npm install -g @ionic/cli`)
- **Capacitor CLI** (`npm install -g @capacitor/cli`)
---

##  Installation & Setup

1. **Repository klonen:**
   ```bash
   git clone https://github.com/vivienke/Erinnerungsapp.git
   cd Erinnerungsapp
   ```

2. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

3. **Build erstellen:**
   ```bash
   npm run build
   ```

4. **Capacitor Synchronisierung:**
   Überträgt den Code in das native Android-Projekt:
   ```bash
   npx cap sync android
   ```

---


### App auf Emulator/Gerät starten

 Befehl ausführen:
   ```bash
   npx cap run android
   ```

---


##  Verwendete Plugins

- `@capacitor/local-notifications`: Lokale System-Erinnerungen.
- `@capawesome/capacitor-app-shortcuts`: Schnellzugriff-Menüs auf dem Homescreen.
- `@capawesome-team/capacitor-datetime-picker`: Native Datums- und Zeitauswahl.
- `@capacitor/preferences`: Dauerhafte Speicherung der Daten.

---

##  KI-Unterstützung

Dieses Projekt wurde mit Unterstützung von **Claude (Anthropic)**, **Copilot**  und **Codex (OpenAI)** entwickelt. Die KI unterstützte bei:
- Projektstrukturierung & Architektur
- Konfiguration 
- Programmierung
- Fehlerbehebungen 
- Erstellung der technischen Dokumentation
