import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Centralized Postgres database configuration
# Using environment variables for flexibility between dev/prod.

DB_HOST = os.getenv("DB_HOST", "10.246.145.251")
DB_NAME = os.getenv("DB_NAME", "maroon_schedules")
DB_USER = os.getenv("DB_USER", "dev_rian")
DB_PASS = os.getenv("DB_PASS", "admin")

CONNECTION_PARAMS = f"host={DB_HOST} dbname={DB_NAME} user={DB_USER} password={DB_PASS}"

def get_db_connection():
    """
    Returns the connection string constructed from environment variables.
    """
    return CONNECTION_PARAMS
