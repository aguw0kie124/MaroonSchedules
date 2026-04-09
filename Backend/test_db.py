import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent))
from services.place_registry_service import resolve_place
print("College Station:", resolve_place("College Station"))
print("Bryan:", resolve_place("Bryan"))
