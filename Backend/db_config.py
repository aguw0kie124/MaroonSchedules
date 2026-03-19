import os

# Centralized Postgres database configuration
# Using the connection parameters provided previously for transition readiness.

CONNECTION_PARAMS = "host=10.246.145.251 dbname=maroon_schedules user=dev_rian password=admin"

def get_db_connection():
    """
    TODO: Replace JSON file loading with actual psycopg connection later.
    Currently returns the connection string.
    """
    return CONNECTION_PARAMS
