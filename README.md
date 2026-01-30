# Kantor – aplikacja do wymiany walut

## Opis projektu
**Kantor** to aplikacja umożliwiająca sprawdzanie kursów walut oraz wykonywanie **symulowanej wymiany walut**. System składa się z:

- **Backendu** – odpowiedzialnego za logikę biznesową, komunikację z bazą danych oraz udostępnianie REST API.
- **Aplikacji mobilnej** – interfejsu użytkownika umożliwiającego korzystanie z funkcjonalności kantoru.

---

## Technologie
- **Node.js**
- **Express.js**
- **JavaScript**
- **SQLite**
- **React Native (Expo)**

---

## Struktura projektu
```txt
kantor/
│
├── backend/
│   ├── server.js        # Główny plik serwera
│   ├── db.js            # Połączenie z bazą danych
│   ├── .env             # Zmienne środowiskowe
│   ├── package.json
│   └── node_modules/
│
└── mobile-kantor/       # Aplikacja mobilna (Expo / React Native)
Wymagania

Node.js (zalecane: LTS)

npm (lub yarn)

Expo CLI (uruchamianie aplikacji mobilnej przez npx expo)

(Opcjonalnie) Android Studio / emulator lub aplikacja Expo Go na telefonie

Instalacja
1) Klonowanie repozytorium
git clone https://github.com/DzUjO-dot/kantor.git
cd kantor

2) Backend – instalacja zależności
cd backend
npm install

3) Mobile – instalacja zależności
cd ../mobile-kantor
npm install

Uruchomienie
Backend
cd backend
node server.js

Aplikacja mobilna
cd mobile-kantor
npx expo start


Po uruchomieniu Expo możesz odpalić aplikację na:

emulatorze Android/iOS (jeśli skonfigurowany),

lub telefonie (Expo Go) skanując QR code.

Funkcjonalności aplikacji

Pobieranie aktualnych kursów walut

Wyświetlanie tabeli kursów

Przeliczanie walut

Symulowana wymiana walut

Komunikacja aplikacji mobilnej z backendem

Obsługa zapytań REST API

Jak to działa (w skrócie)

Backend udostępnia API do pobierania kursów i wykonywania przeliczeń / wymiany.

Aplikacja mobilna pobiera dane z backendu i prezentuje je użytkownikowi w czytelnym interfejsie.
