import json
from services import pulse_service

def test_aggregation():
    try:
        # Invalidate cache first
        pulse_service.invalidate_pulse_map_cache()
        
        # Get the map
        pulse_map = pulse_service.get_pulse_map(limit=60)
        
        print(f"Status: {pulse_map.get('status')}")
        print(f"Hotspots Found: {len(pulse_map.get('hotspots', []))}")
        
        for hotspot in pulse_map.get('hotspots', []):
            print(f"Hotspot: {hotspot['locationName']} at {hotspot['coord']}")
            
    except Exception as e:
        print(f"Aggregation test failed: {e}")

if __name__ == "__main__":
    test_aggregation()
