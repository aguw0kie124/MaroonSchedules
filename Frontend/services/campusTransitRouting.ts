import { computeDistanceMeters, Coordinate, DirectionStep } from './campusDirections';
import { transitService } from './transitService';

export interface CampusTransitPlan {
  mode: 'bus';
  distanceMeters: number;
  estimatedTimeMinutes: number;
  polyline: Coordinate[];
  routeKey: string;
  routeName: string;
  routeShortName: string;
  routeColor: string;
  originStop: any;
  destinationStop: any;
  walkingToStopMeters: number;
  walkingFromStopMeters: number;
  busDistanceMeters: number;
  estimatedWaitMinutes: number;
  nearestVehicleLabel?: string;
  steps: DirectionStep[];
}

type PlanCandidate = {
  route: any;
  segment: Coordinate[];
  nearestOrigin: { stop: any; distanceMeters: number; index: number };
  nearestDestination: { stop: any; distanceMeters: number; index: number };
  walkingToStopMeters: number;
  walkingFromStopMeters: number;
  busDistanceMeters: number;
  totalMinutes: number;
};

function polylineDistance(points: Coordinate[]): number {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += computeDistanceMeters(points[index], points[index + 1]);
  }
  return total;
}

function getNearestStop(stops: any[], point: Coordinate) {
  let best: any = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestIndex = -1;
  stops.forEach((stop, index) => {
    const distance = computeDistanceMeters(point, {
      latitude: stop.Latitude,
      longitude: stop.Longitude,
    });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = stop;
      bestIndex = index;
    }
  });
  return { stop: best, distanceMeters: bestDistance, index: bestIndex };
}

function getNearestPointIndex(points: Coordinate[], point: Coordinate) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  points.forEach((entry, index) => {
    const distance = computeDistanceMeters(point, entry);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function sliceRouteSegment(points: Coordinate[], startStop: any, endStop: any): Coordinate[] {
  if (points.length < 2) return points;

  const startIndex = getNearestPointIndex(points, {
    latitude: startStop.Latitude,
    longitude: startStop.Longitude,
  });
  const endIndex = getNearestPointIndex(points, {
    latitude: endStop.Latitude,
    longitude: endStop.Longitude,
  });

  if (startIndex <= endIndex) {
    return points.slice(startIndex, endIndex + 1);
  }

  return [...points.slice(startIndex), ...points.slice(0, endIndex + 1)];
}

function estimateNearestVehicleLabel(vehicles: any[], stop: any) {
  if (!vehicles.length) return undefined;
  let best: any = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  vehicles.forEach((vehicle) => {
    const distance = computeDistanceMeters(
      { latitude: vehicle.Latitude, longitude: vehicle.Longitude },
      { latitude: stop.Latitude, longitude: stop.Longitude },
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = vehicle;
    }
  });
  if (!best) return undefined;
  const label = best.RouteShortName || best.RouteName || 'Bus';
  const minutes = Math.max(1, Math.round(bestDistance / 220));
  return `${label} nearby · ~${minutes} min`;
}

export async function buildTransitPlan(
  start: Coordinate,
  destination: Coordinate,
  startName: string,
  destinationName: string,
): Promise<CampusTransitPlan | null> {
  const metadata = await transitService.getRoutesMetadata();
  const activeIds = await transitService.getActiveRoutes();
  const routes = metadata.filter((route) =>
    activeIds.includes(route.ShortName) || activeIds.includes(route.Key) || activeIds.includes(route.Name),
  );
  const candidates = routes.length > 0 ? routes : metadata;

  let bestCandidate: PlanCandidate | null = null;

  for (const route of candidates) {
    const pattern = await transitService.getRoutePattern(route.Key);
    if (!pattern.stops?.length || !pattern.points?.length) continue;

    const nearestOrigin = getNearestStop(pattern.stops, start);
    const nearestDestination = getNearestStop(pattern.stops, destination);
    if (!nearestOrigin.stop || !nearestDestination.stop || nearestOrigin.stop.StopCode === nearestDestination.stop.StopCode) {
      continue;
    }

    const segment = sliceRouteSegment(pattern.points, nearestOrigin.stop, nearestDestination.stop);
    const busDistanceMeters = polylineDistance(segment);
    if (busDistanceMeters < 200) continue;

    const walkingToStopMeters = nearestOrigin.distanceMeters;
    const walkingFromStopMeters = nearestDestination.distanceMeters;
    const estimatedWaitMinutes = 5;
    const busMinutes = Math.max(2, Math.round(busDistanceMeters / 300));
    const totalMinutes = Math.max(
      3,
      Math.round(walkingToStopMeters / 84) + estimatedWaitMinutes + busMinutes + Math.round(walkingFromStopMeters / 84),
    );

    const candidate: PlanCandidate = {
      route,
      segment,
      nearestOrigin,
      nearestDestination,
      walkingToStopMeters,
      walkingFromStopMeters,
      busDistanceMeters,
      totalMinutes,
    };

    if (!bestCandidate || candidate.totalMinutes < bestCandidate.totalMinutes) {
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return null;
  }

  const vehicles = await transitService.getVehicles(bestCandidate.route.Key);
  const nearestVehicleLabel = estimateNearestVehicleLabel(vehicles, bestCandidate.nearestOrigin.stop);

  const steps: DirectionStep[] = [
    {
      id: 1,
      instruction: `Walk from ${startName} to ${bestCandidate.nearestOrigin.stop.Name}.`,
      icon: '🚶',
    },
    {
      id: 2,
      instruction: `Board route ${bestCandidate.route.ShortName} ${bestCandidate.route.Name ? `(${bestCandidate.route.Name})` : ''} at ${bestCandidate.nearestOrigin.stop.Name}.`,
      icon: '🚌',
    },
    {
      id: 3,
      instruction: `Ride to ${bestCandidate.nearestDestination.stop.Name}${nearestVehicleLabel ? `, ${nearestVehicleLabel}.` : '.'}`,
      icon: '🎟️',
    },
    {
      id: 4,
      instruction: `Walk from ${bestCandidate.nearestDestination.stop.Name} to ${destinationName}.`,
      icon: '🚶',
    },
  ];

  return {
    mode: 'bus',
    distanceMeters: bestCandidate.walkingToStopMeters + bestCandidate.busDistanceMeters + bestCandidate.walkingFromStopMeters,
    estimatedTimeMinutes: bestCandidate.totalMinutes,
    polyline: [
      start,
      { latitude: bestCandidate.nearestOrigin.stop.Latitude, longitude: bestCandidate.nearestOrigin.stop.Longitude },
      ...bestCandidate.segment,
      { latitude: bestCandidate.nearestDestination.stop.Latitude, longitude: bestCandidate.nearestDestination.stop.Longitude },
      destination,
    ],
    routeKey: bestCandidate.route.Key,
    routeName: bestCandidate.route.Name,
    routeShortName: bestCandidate.route.ShortName,
    routeColor: bestCandidate.route.Color || transitService.getRouteColor(bestCandidate.route.Key),
    originStop: bestCandidate.nearestOrigin.stop,
    destinationStop: bestCandidate.nearestDestination.stop,
    walkingToStopMeters: bestCandidate.walkingToStopMeters,
    walkingFromStopMeters: bestCandidate.walkingFromStopMeters,
    busDistanceMeters: bestCandidate.busDistanceMeters,
    estimatedWaitMinutes: 5,
    nearestVehicleLabel,
    steps,
  };
}
