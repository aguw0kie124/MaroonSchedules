import os
import sys

# Add Backend to path
sys.path.append(os.path.abspath("Backend"))

import main # Initializes app and services
from services import campus_hub_service

place_id = "garage-university-center"
detail = campus_hub_service.get_place_detail_snapshot(place_id)

print("Place Detail for University Center Garage:")
import json
print(json.dumps(detail, indent=2))
