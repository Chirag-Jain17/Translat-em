import os
import asyncio
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not found in environment.")
    exit(1)

# Connect to the database
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    try:
        # Sync the sequence for users table
        conn.execute(text("SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1), true);"))
        print("Successfully synced users sequence.")
    except Exception as e:
        print(f"Error syncing users sequence: {e}")

    try:
        # Sync the sequence for translations table
        conn.execute(text("SELECT setval('translations_id_seq', COALESCE((SELECT MAX(id) FROM translations), 1), true);"))
        print("Successfully synced translations sequence.")
    except Exception as e:
        print(f"Error syncing translations sequence: {e}")
    
    conn.commit()

print("Sequence sync complete!")
