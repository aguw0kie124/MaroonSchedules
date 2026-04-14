import os
import sys
import datetime
from dotenv import load_dotenv

sys.path.append(os.getcwd())
load_dotenv(".env")

from repositories import feed_repository, user_repository, tag_repository
from db_config import get_pool

def setup_test_data():
    clerk_id = "test_user_rec_001"
    print(f"--- Setting up test user {clerk_id} ---")
    
    # 1. Ensure user exists with specific prefs
    user_repository.upsert_user(clerk_id, email="test@example.com", full_name="Test Rec User")
    user_repository.update_profile(clerk_id, {
        "major": "Computer Science"
    })
    tag_repository.set_user_tags(clerk_id, ["Free Food", "Tech Talks"])
    
    # 2. Add some posts manually to DB for predictable test
    with get_pool().connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM crowdping_posts WHERE user_id = %s", ("test_poster",))
            
            # Post A: Matches Category (Free Food)
            cur.execute(
                "INSERT INTO crowdping_posts (user_id, content, post_type, custom_data, created_at) VALUES (%s, %s, %s, %s, %s)",
                ("test_poster", "Pizza at the MSC!", "ping", '{"ping_category": "Free Food"}', datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10))
            )
            
            # Post B: Matches Major (Computer Science)
            cur.execute(
                "INSERT INTO crowdping_posts (user_id, content, post_type, custom_data, created_at) VALUES (%s, %s, %s, %s, %s)",
                ("test_poster", "New high-performance computing lab open.", "post", '{"ping_category": "Campus"}', datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=5))
            )
            
            # Post C: Random Post
            cur.execute(
                "INSERT INTO crowdping_posts (user_id, content, post_type, custom_data, created_at) VALUES (%s, %s, %s, %s, %s)",
                ("test_poster", "Just walking around.", "post", '{"ping_category": "General"}', datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=1))
            )
        conn.commit()
    return clerk_id

def verify_tailored_feed(clerk_id):
    print(f"--- Verifying tailored recommendations for {clerk_id} ---")
    feed = feed_repository.get_tailored_feed_for_user(clerk_id, limit=5)
    
    for i, p in enumerate(feed):
        print(f"{i+1}. {p['content'][:40]} | Score: {p.get('_rec_score', 0):.2f} | Cat: {p.get('custom_data', {}).get('ping_category')}")

    if len(feed) < 3:
        print("Error: Expected 3 test posts in feed.")
        return

    # Post A (Free Food) should be #1 because category match (+50) beats major match (+30) and fresh match (0)
    top_post = feed[0]
    if top_post.get("custom_data", {}).get("ping_category") == "Free Food":
        print("SUCCESS: 'Free Food' prioritized correctly.")
    else:
        print(f"FAILURE: 'Free Food' not at top. Top is {top_post.get('custom_data', {}).get('ping_category')}")

if __name__ == "__main__":
    cid = setup_test_data()
    verify_tailored_feed(cid)
