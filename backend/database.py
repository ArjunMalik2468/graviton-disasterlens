
import os
import sqlite3
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

DB_PATH = Path(__file__).parent / "disasterlens.db"
DATABASE_URL = os.getenv("DATABASE_URL")


def connect():
    if DATABASE_URL:
        return psycopg.connect(
            DATABASE_URL,
            row_factory=dict_row
        )

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def init_db():
    with connect() as db:
        if DATABASE_URL:
            db.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    lat DOUBLE PRECISION NOT NULL,
                    lng DOUBLE PRECISION NOT NULL,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    phash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                        DEFAULT (CURRENT_TIMESTAMP::text)
                )
            """)

            db.execute("""
                ALTER TABLE reports
                ADD COLUMN IF NOT EXISTS image_status TEXT
            """)

            db.execute("""
                ALTER TABLE reports
                ADD COLUMN IF NOT EXISTS review_status TEXT
            """)

        else:
            db.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    type TEXT NOT NULL,
                    description TEXT NOT NULL,
                    lat REAL NOT NULL,
                    lng REAL NOT NULL,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    sha256 TEXT NOT NULL,
                    phash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                        DEFAULT CURRENT_TIMESTAMP
                )
            """)

            columns = {
                row["name"]
                for row in db.execute("PRAGMA table_info(reports)")
            }

            if "image_status" not in columns:
                db.execute(
                    "ALTER TABLE reports ADD COLUMN image_status TEXT"
                )

            if "review_status" not in columns:
                db.execute(
                    "ALTER TABLE reports ADD COLUMN review_status TEXT"
                )

        db.execute("""
            UPDATE reports
            SET image_status = CASE
                WHEN status IN ('Duplicate', 'Possible Duplicate')
                    THEN status
                WHEN reason = 'Exact image match'
                    THEN 'Duplicate'
                WHEN reason = 'Visually similar image'
                    THEN 'Possible Duplicate'
                ELSE 'Pending'
            END
            WHERE image_status IS NULL
        """)

        db.execute("""
            UPDATE reports
            SET review_status = CASE
                WHEN status IN ('Verified', 'Rejected')
                    THEN status
                ELSE 'Awaiting Review'
            END
            WHERE review_status IS NULL
        """)
