import sys
import json
sys.path.append("Backend")
from routers.traffic import transit_proxy

data = transit_proxy._post('/RouteMap/GetPatternPaths/', 'routeKeys%5B%5D=22')
paths = data[0].get('patternPaths', [])
for p in paths:
    print('Pattern Path elements:', {k: v for k, v in p.items() if k != 'patternPoints'})
    first_pt = p['patternPoints'][0] if p.get('patternPoints') else {}
    stop = first_pt.get('stop') if first_pt else {}
    if stop:
        print('Stop:', stop)
