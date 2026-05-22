# LendApp API 🔧

REST-API für die LendApp – Gegenstände ausleihen mit Freunden & Familie.

**Stack:** Python · FastAPI · SQLite · Docker

---

## Quickstart

```bash
# 1. Bauen & starten
docker compose up --build

# 2. API ist erreichbar unter
http://localhost:8000

# 3. Interaktive Docs (Swagger UI)
http://localhost:8000/docs
```

---

## Lokale Entwicklung (ohne Docker)

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## API-Übersicht

### Users
| Methode | Endpoint              | Beschreibung          |
|---------|-----------------------|-----------------------|
| POST    | /users/register       | Account erstellen     |
| POST    | /users/login          | Einloggen             |
| GET     | /users/{id}           | Profil abrufen        |

### Groups
| Methode | Endpoint                  | Beschreibung              |
|---------|---------------------------|---------------------------|
| POST    | /groups/                  | Gruppe erstellen          |
| GET     | /groups/{id}              | Gruppe abrufen            |
| POST    | /groups/{id}/join         | Per Einladungslink beitreten |
| GET     | /groups/{id}/members      | Mitglieder auflisten      |

### Items
| Methode | Endpoint                      | Beschreibung              |
|---------|-------------------------------|---------------------------|
| POST    | /items/                       | Gegenstand erfassen       |
| GET     | /items/group/{group_id}       | Alle Gegenstände der Gruppe |
| GET     | /items/{id}                   | Gegenstand abrufen        |
| PATCH   | /items/{id}                   | Gegenstand bearbeiten     |
| DELETE  | /items/{id}                   | Gegenstand löschen        |

### Bookings
| Methode | Endpoint                        | Beschreibung              |
|---------|---------------------------------|---------------------------|
| POST    | /bookings/                      | Buchung anfragen          |
| GET     | /bookings/item/{item_id}        | Buchungen für Gegenstand  |
| GET     | /bookings/user/{user_id}        | Buchungen eines Users     |
| PATCH   | /bookings/{id}/status           | Status ändern (approved/rejected/returned) |

---

## Beispiel-Flow

```bash
# 1. User registrieren
curl -X POST http://localhost:8000/users/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Anna", "email": "anna@example.com", "password": "secret"}'

# 2. Gruppe erstellen (user_id als Query-Parameter)
curl -X POST "http://localhost:8000/groups/?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Familie Müller"}'

# 3. Gegenstand erfassen
curl -X POST "http://localhost:8000/items/?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{"name": "Bohrmaschine", "category": "Werkzeug", "group_id": 1, "max_days": 7}'

# 4. Buchung anfragen
curl -X POST "http://localhost:8000/bookings/?user_id=2" \
  -H "Content-Type: application/json" \
  -d '{"item_id": 1, "date_from": "2026-05-20T00:00:00", "date_to": "2026-05-25T00:00:00"}'

# 5. Buchung genehmigen (Besitzer)
curl -X PATCH "http://localhost:8000/bookings/1/status?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

## Hinweise

- **Auth:** Aktuell vereinfacht via `user_id` Query-Parameter. Für Produktion → JWT (z.B. `python-jose`) einbauen.
- **Bilder:** `image_url` speichert eine URL. Für Uploads → z.B. MinIO oder S3 integrieren.
- **Datenbank:** SQLite-Datei liegt unter `./lendapp.db` (wird automatisch erstellt).
