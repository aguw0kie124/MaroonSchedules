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
  transferCount: number;
  nearestVehicleLabel?: string;
  steps: DirectionStep[];
}

export type TransitTripPreference = 'best' | 'fewer_transfers' | 'less_walking';

export interface TransitPlanBuildOptions {
  preference?: TransitTripPreference;
  preferredRouteKey?: string | null;
  limit?: number;
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

function sortCandidates(candidates: PlanCandidate[], preference: TransitTripPreference) {
  const getWalkingTotal = (candidate: PlanCandidate) =>
    candidate.walkingToStopMeters + candidate.walkingFromStopMeters;

  return [...candidates].sort((left, right) => {
    if (preference === 'less_walking') {
      const walkingDelta = getWalkingTotal(left) - getWalkingTotal(right);
      if (walkingDelta !== 0) return walkingDelta;
      return left.totalMinutes - right.totalMinutes;
    }

    if (preference === 'fewer_transfers') {
      const timeDelta = left.totalMinutes - right.totalMinutes;
      if (timeDelta !== 0) return timeDelta;
      return getWalkingTotal(left) - getWalkingTotal(right);
    }

    const totalDelta = left.totalMinutes - right.totalMinutes;
    if (totalDelta !== 0) return totalDelta;
    return getWalkingTotal(left) - getWalkingTotal(right);
  });
}

function buildSteps(
  candidate: PlanCandidate,
  startName: string,
  destinationName: string,
  nearestVehicleLabel?: string,
): DirectionStep[] {
  return [
    {
      id: 1,
      instruction: `Walk from ${startName} to ${candidate.nearestOrigin.stop.Name}.`,
      icon: '🚶',
    },
    {
      id: 2,
      instruction: `Board route ${candidate.route.ShortName} ${candidate.route.Name ? `(${candidate.route.Name})` : ''} at ${candidate.nearestOrigin.stop.Name}.`,
      icon: '🚌',
    },
    {
      id: 3,
      instruction: `Ride to ${candidate.nearestDestination.stop.Name}${nearestVehicleLabel ? `, ${nearestVehicleLabel}.` : '.'}`,
      icon: '🎟️',
    },
    {
      id: 4,
      instruction: `Walk from ${candidate.nearestDestination.stop.Name} to ${destinationName}.`,
      icon: '🚶',
    },
  ];
}

function toTransitPlan(
  candidate: PlanCandidate,
  start: Coordinate,
  destination: Coordinate,
  startName: string,
  destinationName: string,
  nearestVehicleLabel?: string,
): CampusTransitPlan {
  return {
    mode: 'bus',
    distanceMeters:
      candidate.walkingToStopMeters +
      candidate.busDistanceMeters +
      candidate.walkingFromStopMeters,
    estimatedTimeMinutes: candidate.totalMinutes,
    polyline: [
      start,
      {
        latitude: candidate.nearestOrigin.stop.Latitude,
        longitude: candidate.nearestOrigin.stop.Longitude,
      },
      ...candidate.segment,
      {
        latitude: candidate.nearestDestination.stop.Latitude,
        longitude: candidate.nearestDestination.stop.Longitude,
      },
      destination,
    ],
    routeKey: candidate.route.Key,
    routeName: candidate.route.Name,
    routeShortName: candidate.route.ShortName,
    routeColor: candidate.route.Color || transitService.getRouteColor(candidate.route.Key),
    originStop: candidate.nearestOrigin.stop,
    destinationStop: candidate.nearestDestination.stop,
    walkingToStopMeters: candidate.walkingToStopMeters,
    walkingFromStopMeters: candidate.walkingFromStopMeters,
    busDistanceMeters: candidate.busDistanceMeters,
    estimatedWaitMinutes: 5,
    transferCount: 0,
    nearestVehicleLabel,
    steps: buildSteps(candidate, startName, destinationName, nearestVehicleLabel),
  };
}

export async function buildTransitPlanOptions(
  start: Coordinate,
  destination: Coordinate,
  startName: string,
  destinationName: string,
  options: TransitPlanBuildOptions = {},
): Promise<CampusTransitPlan[]> {
  const {
    preference = 'best',
    preferredRouteKey,
    limit = 4,
  } = options;
  const metadata = await transitService.getRoutesMetadata();
  const activeIds = await transitService.getActiveRoutes();
  const routes = metadata.filter((route) =>
    activeIds.includes(route.ShortName) || activeIds.includes(route.Key) || activeIds.includes(route.Name),
  );
  const baseCandidates = routes.length > 0 ? routes : metadata;
  const orderedRoutes = preferredRouteKey
    ? [
        ...baseCandidates.filter((route) => route.Key === preferredRouteKey),
        ...baseCandidates.filter((route) => route.Key !== preferredRouteKey),
      ]
    : baseCandidates;
  const planCandidates: PlanCandidate[] = [];

  for (const route of orderedRoutes) {
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

    planCandidates.push({
      route,
      segment,
      nearestOrigin,
      nearestDestination,
      walkingToStopMeters,
      walkingFromStopMeters,
      busDistanceMeters,
      totalMinutes,
    });
  }

  if (planCandidates.length === 0) {
    return [];
  }

  const rankedCandidates = sortCandidates(planCandidates, preference).slice(0, limit);
  const liveVehicles = await transitService.getVehicles();

  return rankedCandidates.map((candidate) => {
    const routeVehicles = liveVehicles.filter((vehicle) =>
      [vehicle.RouteKey, vehicle.RouteShortName, vehicle.RouteName]
        .map((value: string) => (value || '').toString().toLowerCase())
        .includes((candidate.route.Key || '').toString().toLowerCase()) ||
      [vehicle.RouteKey, vehicle.RouteShortName, vehicle.RouteName]
        .map((value: string) => (value || '').toString().toLowerCase())
        .includes((candidate.route.ShortName || '').toString().toLowerCase()) ||
      [vehicle.RouteKey, vehicle.RouteShortName, vehicle.RouteName]
        .map((value: string) => (value || '').toString().toLowerCase())
        .includes((candidate.route.Name || '').toString().toLowerCase())
    );
    const nearestVehicleLabel = estimateNearestVehicleLabel(routeVehicles, candidate.nearestOrigin.stop);

    return toTransitPlan(
      candidate,
      start,
      destination,
      startName,
      destinationName,
      nearestVehicleLabel,
    );
  });
}

export async function buildTransitPlan(
  start: Coordinate,
  destination: Coordinate,
  startName: string,
  destinationName: string,
  options: TransitPlanBuildOptions = {},
): Promise<CampusTransitPlan | null> {
  const [bestPlan] = await buildTransitPlanOptions(
    start,
    destination,
    startName,
    destinationName,
    {
      ...options,
      limit: 1,
    },
  );
  return bestPlan || null;
}
