Kantor – aplikacja do wymiany walut

Opis projektu:
Kantor to aplikacja umożliwiająca sprawdzanie kursów walut oraz wykonywanie symulowanej wymiany walut. System składa się z:
Backendu – odpowiedzialnego za logikę biznesową, komunikację z bazą danych oraz udostępnianie API.
Aplikacji mobilnej – interfejsu użytkownika umożliwiającego korzystanie z funkcjonalności kantoru.

Technologie
Node.js
Express.js
JavaScript
sqlite
React Native

Struktura projektu:
kantor/
│
├── backend/
│   ├── server.js        # Główny plik serwera
│   ├── db.js            # Połączenie z bazą danych
│   ├── .env             # Zmienne środowiskowe
│   ├── package.json
│   └── node_modules/
│
└── mobile-kantor/        # Aplikacja mobilna

Instalacja i uruchomienie:
cd backend
node server.js

cd mobile-kantor
npx expo start

Funkcjonalności aplikacji:
Pobieranie aktualnych kursów walut
Wyświetlanie tabeli kursów
Przeliczanie walut
Komunikacja aplikacji mobilnej z backendem
Obsługa zapytań REST API
;
