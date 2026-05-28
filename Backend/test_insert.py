import psycopg
from db_config import CONNECTION_PARAMS
import json

def test_insert():
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            with conn.cursor() as cur:
                # Insert a test ping in Stanford, CA
                lat = 37.4275
                lng = -122.1697
                user_id = "test_cali_user"
                content = "Test Ping from California!"
                location_tag = "Stanford Campus"
                
                custom_data = {
                    "ping_category": "hangout",
                    "lat": lat,
                    "lng": lng,
                    "start_at": "2024-04-08T20:00:00Z"
                }

                cur.execute(
                    """
                    INSERT INTO crowdping_posts 
                    (user_id, user_name, user_image, content, lat, lng, location_tag, post_type, custom_data)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                    """,
                    (
                        user_id, "Test Runner", "",
                        content,
                        lat, lng, location_tag, "ping",
                        json.dumps(custom_data)
                    )
                )
                conn.commit()
                print("Successfully inserted test California ping.")
    except Exception as e:
        print(f"Test insert failed: {e}")

if __name__ == "__main__":
    test_insert()
