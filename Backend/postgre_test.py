# Note: the module name is psycopg, not psycopg3
import psycopg
import sys

def test_postgre_data():
    connection_params = "host=10.246.145.251 dbname=maroon_schedules user=dev_rian password=admin"
    print(f"DEBUG: Attempting to connect to database with params: {connection_params}")
    
    try:
        # Connect to an existing database
        with psycopg.connect(connection_params) as conn:
            print("DEBUG: Connection successful!")
            
            # Open a cursor to perform database operations
            with conn.cursor() as cur:
                print("DEBUG: Cursor opened.")
                
                try:
                    cur.execute("DROP TABLE IF EXISTS test")
                    print("DEBUG: Table 'test' dropped (if it existed).")
                except Exception as e:
                    print(f"DEBUG: Error dropping table: {e}")

                # Execute a command: this creates a new table
                cur.execute("""
                    CREATE TABLE test (
                        id serial PRIMARY KEY,
                        num integer,
                        data text)
                    """)
                print("DEBUG: Table 'test' created.")

                # Pass data to fill a query placeholders and let Psycopg perform
                # the correct conversion (no SQL injections!)
                cur.execute(
                    "INSERT INTO test (num, data) VALUES (%s, %s)",
                    (100, "abc'def"))
                print("DEBUG: Data inserted into 'test'.")

                # Query the database and obtain data as Python objects.
                cur.execute("SELECT * FROM test")
                row = cur.fetchone()
                print(f"DEBUG: Fetched from 'test': {row}")
                # will print (1, 100, "abc'def")

                # You can use `cur.executemany()` to perform an operation in batch
                cur.executemany(
                    "INSERT INTO test (num) values (%s)",
                    [(33,), (66,), (99,)])
                print("DEBUG: Batch insert into 'test' completed.")

                # You can use `cur.fetchmany()`, `cur.fetchall()` to return a list
                # of several records, or even iterate on the cursor
                cur.execute("SELECT id, num, data FROM test order by num")
                output = {}
                print("DEBUG: Selecting from 'majors'...")
                
                try:
                    cur.execute("SELECT major_id, major_name FROM majors order by major_id LIMIT 2")
                    for record in cur:
                        output[record[0]] = record[1]
                        print(f"DEBUG: Found major: {record}")
                except Exception as e:
                    print(f"DEBUG: Error querying 'majors' table: {e}. Ensure the table exists.")

                # Make the changes to the database persistent
                conn.commit()
                print(f"DEBUG: Transaction committed. Output: {output}")
                return output
                
    except psycopg.OperationalError as e:
        print(f"ERROR: Database connection failed: {e}", file=sys.stderr)
        return {"error": "Connection failed", "details": str(e)}
    except Exception as e:
        print(f"ERROR: An unexpected error occurred: {e}", file=sys.stderr)
        return {"error": "Unexpected error", "details": str(e)}