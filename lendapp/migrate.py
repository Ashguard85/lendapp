"""
Einmalig ausführen um deleted_at Spalten hinzuzufügen.
python migrate.py
"""
import sqlite3
import os

DB = "/app/data/lendapp.db"
if not os.path.exists(DB):
    print("DB nicht gefunden – wird beim ersten Start erstellt.")
    exit(0)

conn = sqlite3.connect(DB)
cur  = conn.cursor()

migrations = [
    ("users",  "ALTER TABLE users  ADD COLUMN deleted_at DATETIME"),
    ("groups", "ALTER TABLE groups ADD COLUMN deleted_at DATETIME"),
    ("items",  "ALTER TABLE items  ADD COLUMN deleted_at DATETIME"),
]

for table, sql in migrations:
    try:
        cur.execute(sql)
        print(f"✓ {table}.deleted_at hinzugefügt")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"→ {table}.deleted_at bereits vorhanden")
        else:
            print(f"✗ Fehler bei {table}: {e}")

conn.commit()
conn.close()
print("Migration abgeschlossen.")
