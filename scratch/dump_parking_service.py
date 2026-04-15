import os
import sys

# Add Backend to path
sys.path.append(os.path.abspath("Backend"))

from services import place_registry_service

places = place_registry_service.get_all_places()
parking_places = [p for p in places if p["type"] == "Parking"]

import json
print(json.dumps(parking_places, indent=2))
