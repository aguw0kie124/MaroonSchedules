import sys
sys.path.append('Backend')
from db_config import get_db_connection
import psycopg

clerk_id = "user_3BPckTdu6R03UArr2XX0FeufrsE"

from routers.dining import optimize_day
try:
    res = optimize_day(clerk_id, "Sbisa", {"selected_meals": ["lunch"], "include_restaurant_alts": True})
    print("SUCCESS:", res)
except Exception as e:
    import traceback
    traceback.print_exc()
