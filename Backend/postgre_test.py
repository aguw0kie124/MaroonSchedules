# Note: the module name is psycopg, not psycopg3
import psycopg

def test_postgre_data():
    # Connect to an existing database
    with psycopg.connect("dbname=postgres user=postgres password=admin") as conn:

        # Open a cursor to perform database operations
        with conn.cursor() as cur:

            cur.execute("""
                DROP TABLE test""")

            # Execute a command: this creates a new table
            cur.execute("""
                CREATE TABLE test (
                    id serial PRIMARY KEY,
                    num integer,
                    data text)
                """)

            # Pass data to fill a query placeholders and let Psycopg perform
            # the correct conversion (no SQL injections!)
            cur.execute(
                "INSERT INTO test (num, data) VALUES (%s, %s)",
                (100, "abc'def"))

            # Query the database and obtain data as Python objects.
            cur.execute("SELECT * FROM test")
            print(cur.fetchone())
            # will print (1, 100, "abc'def")

            # You can use `cur.executemany()` to perform an operation in batch
            cur.executemany(
                "INSERT INTO test (num) values (%s)",
                [(33,), (66,), (99,)])

            # You can use `cur.fetchmany()`, `cur.fetchall()` to return a list
            # of several records, or even iterate on the cursor
            cur.execute("SELECT id, num, data FROM test order by num")
            output = {}
            for record in cur:
                output[record[0]] = (record[1], record[2])

            # Make the changes to the database persistent
            conn.commit()
            print(output)
            return output