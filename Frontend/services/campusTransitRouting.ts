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
  directionName?: string;
  leaveOriginTimeUtc?: string;
  scheduledBoardTimeUtc?: string;
  scheduledAlightTimeUtc?: string;
  arriveDestinationTimeUtc?: string;
  steps: DirectionStep[];
}

export type TransitTripPreference = 'best' | 'fewer_transfers' | 'less_walking';

export interface TransitPlanBuildOptions {
  preference?: TransitTripPreference;
  preferredRouteKey?: string | null;
  limit?: number;
  plannedTimestamp?: number;
  timingMode?: 'leave_at' | 'arrive_by';
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
  walkingToStopMinutes: number;
  walkingFromStopMinutes: number;
  busMinutes: number;
  estimatedWaitMinutes: number;
  directionName?: string;
  leaveOriginTimeUtc?: string;
  scheduledBoardTimeUtc?: string;
  scheduledAlightTimeUtc?: string;
  arriveDestinationTimeUtc?: string;
};

const WALKING_METERS_PER_MINUTE = 84;
const BUS_METERS_PER_MINUTE = 300;

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

function pinPreferredRoute(
  candidates: PlanCandidate[],
  preferredRouteKey?: string | null,
): PlanCandidate[] {
  if (!preferredRouteKey) {
    return candidates;
  }

  const preferredIndex = candidates.findIndex(
    (candidate) => candidate.route.Key === preferredRouteKey,
  );
  if (preferredIndex <= 0) {
    return candidates;
  }

  const reordered = [...candidates];
  const [preferred] = reordered.splice(preferredIndex, 1);
  reordered.unshift(preferred);
  return reordered;
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
      distanceMeters: candidate.walkingToStopMeters,
      durationMinutes: candidate.walkingToStopMinutes,
      detail: `Board at ${candidate.nearestOrigin.stop.Name}.`,
    },
    {
      id: 2,
      instruction: `Wait for route ${candidate.route.ShortName} ${candidate.route.Name ? `(${candidate.route.Name})` : ''} at ${candidate.nearestOrigin.stop.Name}.`,
      icon: '⏳',
      durationMinutes: candidate.estimatedWaitMinutes,
      detail: nearestVehicleLabel || 'Live arrival estimates update as buses move.',
    },
    {
      id: 3,
      instruction: `Ride to ${candidate.nearestDestination.stop.Name}.`,
      icon: '🚌',
      distanceMeters: candidate.busDistanceMeters,
      durationMinutes: candidate.busMinutes,
      detail: nearestVehicleLabel || `${candidate.route.ShortName} toward ${candidate.nearestDestination.stop.Name}.`,
    },
    {
      id: 4,
      instruction: `Walk from ${candidate.nearestDestination.stop.Name} to ${destinationName}.`,
      icon: '🚶',
      distanceMeters: candidate.walkingFromStopMeters,
      durationMinutes: candidate.walkingFromStopMinutes,
      detail: `Exit at ${candidate.nearestDestination.stop.Name}.`,
    },
    {
      id: 5,
      instruction: `Arrive at ${destinationName}.`,
      icon: '📍',
      detail: 'Destination reached.',
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
    estimatedWaitMinutes: candidate.estimatedWaitMinutes,
    transferCount: 0,
    nearestVehicleLabel,
    directionName: candidate.directionName,
    leaveOriginTimeUtc: candidate.leaveOriginTimeUtc,
    scheduledBoardTimeUtc: candidate.scheduledBoardTimeUtc,
    scheduledAlightTimeUtc: candidate.scheduledAlightTimeUtc,
    arriveDestinationTimeUtc: candidate.arriveDestinationTimeUtc,
    steps: buildSteps(candidate, startName, destinationName, nearestVehicleLabel),
  };
}

async function buildEstimatedCandidate(
  route: any,
  start: Coordinate,
  destination: Coordinate,
): Promise<PlanCandidate | null> {
  const pattern = await transitService.getRoutePattern(route.Key);
  if (!pattern.stops?.length || !pattern.points?.length) {
    return null;
  }

  const nearestOrigin = getNearestStop(pattern.stops, start);
  const nearestDestination = getNearestStop(pattern.stops, destination);
  if (
    !nearestOrigin.stop ||
    !nearestDestination.stop ||
    nearestOrigin.stop.StopCode === nearestDestination.stop.StopCode
  ) {
    return null;
  }

  const segment = sliceRouteSegment(
    pattern.points,
    nearestOrigin.stop,
    nearestDestination.stop,
  );
  const busDistanceMeters = polylineDistance(segment);
  if (busDistanceMeters < 200) {
    return null;
  }

  const walkingToStopMeters = nearestOrigin.distanceMeters;
  const walkingFromStopMeters = nearestDestination.distanceMeters;
  const estimatedWaitMinutes = 5;
  const walkingToStopMinutes = Math.max(
    1,
    Math.round(walkingToStopMeters / WALKING_METERS_PER_MINUTE),
  );
  const walkingFromStopMinutes = Math.max(
    1,
    Math.round(walkingFromStopMeters / WALKING_METERS_PER_MINUTE),
  );
  const busMinutes = Math.max(2, Math.round(busDistanceMeters / BUS_METERS_PER_MINUTE));
  const totalMinutes = Math.max(
    3,
    walkingToStopMinutes + estimatedWaitMinutes + busMinutes + walkingFromStopMinutes,
  );

  return {
    route,
    segment,
    nearestOrigin,
    nearestDestination,
    walkingToStopMeters,
    walkingFromStopMeters,
    busDistanceMeters,
    totalMinutes,
    walkingToStopMinutes,
    walkingFromStopMinutes,
    busMinutes,
    estimatedWaitMinutes,
  };
}

function getTripPlanParams(
  candidate: PlanCandidate,
  plannedTimestamp: number,
  timingMode: 'leave_at' | 'arrive_by',
) {
  const originStopCode = candidate.nearestOrigin.stop?.StopCode;
  const destinationStopCode = candidate.nearestDestination.stop?.StopCode;
  const routeNumber = candidate.route?.ShortName || candidate.route?.Key;

  if (!originStopCode || !destinationStopCode || !routeNumber) {
    return null;
  }

  const searchAnchorTime = new Date(plannedTimestamp);
  if (timingMode === 'leave_at') {
    searchAnchorTime.setMinutes(
      searchAnchorTime.getMinutes() + candidate.walkingToStopMinutes,
    );
  } else {
    searchAnchorTime.setMinutes(
      searchAnchorTime.getMinutes() - candidate.walkingFromStopMinutes,
    );
  }

  const minimumTravelMinutes = Math.max(
    1,
    Math.floor(candidate.busMinutes * 0.5),
  );

  return {
    origin_stop_code: String(originStopCode),
    dest_stop_code: String(destinationStopCode),
    route_number: String(routeNumber),
    departure_time: searchAnchorTime.toISOString(),
    timing_mode: timingMode,
    minimum_travel_minutes: minimumTravelMinutes,
  };
}

function applyTripPlanToCandidate(
  candidate: PlanCandidate,
  plannedTimestamp: number,
  timingMode: 'leave_at' | 'arrive_by',
  dbTrip: any,
): PlanCandidate {
  if (!dbTrip?.origin_time || !dbTrip?.dest_time) {
    return candidate;
  }

  const scheduledBoardTime = new Date(dbTrip.origin_time);
  const scheduledAlightTime = new Date(dbTrip.dest_time);
  const leaveOriginTime =
    timingMode === 'leave_at'
      ? new Date(plannedTimestamp)
      : new Date(
        scheduledBoardTime.getTime() - candidate.walkingToStopMinutes * 60000,
      );
  const arriveDestinationTime = new Date(
    scheduledAlightTime.getTime() + candidate.walkingFromStopMinutes * 60000,
  );
  const totalMinutes = Math.max(
    3,
    Math.round(
      (arriveDestinationTime.getTime() - leaveOriginTime.getTime()) / 60000,
    ),
  );
  const arrivalAtStopTime = new Date(
    leaveOriginTime.getTime() + candidate.walkingToStopMinutes * 60000,
  );
  const estimatedWaitMinutes = Math.max(
    0,
    Math.round(
      (scheduledBoardTime.getTime() - arrivalAtStopTime.getTime()) / 60000,
    ),
  );
  const busMinutes = Math.max(
    1,
    Math.round(
      (scheduledAlightTime.getTime() - scheduledBoardTime.getTime()) / 60000,
    ),
  );

  return {
    ...candidate,
    totalMinutes,
    busMinutes,
    estimatedWaitMinutes,
    directionName: dbTrip.direction,
    leaveOriginTimeUtc: leaveOriginTime.toISOString(),
    scheduledBoardTimeUtc: scheduledBoardTime.toISOString(),
    scheduledAlightTimeUtc: scheduledAlightTime.toISOString(),
    arriveDestinationTimeUtc: arriveDestinationTime.toISOString(),
  };
}

async function enrichCandidateWithSchedule(
  candidate: PlanCandidate,
  plannedTimestamp: number,
  timingMode: 'leave_at' | 'arrive_by',
): Promise<PlanCandidate> {
  const params = getTripPlanParams(candidate, plannedTimestamp, timingMode);
  if (!params) return candidate;

  const dbTrip = await transitService.getTransitTripPlanDb(
    params.origin_stop_code,
    params.dest_stop_code,
    params.route_number,
    params.departure_time,
    params.timing_mode,
    params.minimum_travel_minutes,
  );

  return applyTripPlanToCandidate(candidate, plannedTimestamp, timingMode, dbTrip);
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
    plannedTimestamp = Date.now(),
    timingMode = 'leave_at',
  } = options;

  const { routes: metadata, activeIds } = await transitService.getTransitRoutes();
  const activeRoutes = metadata.filter((route) =>
    activeIds.includes(route.ShortName) ||
    activeIds.includes(route.Key) ||
    activeIds.includes(route.Name),
  );
  const baseCandidates = activeRoutes.length > 0 ? activeRoutes : metadata;
  const orderedRoutes = preferredRouteKey
    ? [
        ...baseCandidates.filter((route) => route.Key === preferredRouteKey),
        ...baseCandidates.filter((route) => route.Key !== preferredRouteKey),
      ]
    : baseCandidates;

  const estimatedCandidates = (
    await Promise.all(
      orderedRoutes.map((route) => buildEstimatedCandidate(route, start, destination)),
    )
  ).filter((candidate): candidate is PlanCandidate => Boolean(candidate));

  if (estimatedCandidates.length === 0) {
    return [];
  }

  let rankedCandidates = pinPreferredRoute(
    sortCandidates(estimatedCandidates, preference),
    preferredRouteKey,
  );

  const enrichCount = Math.min(
    rankedCandidates.length,
    Math.max(limit * 3, preferredRouteKey ? limit * 3 + 1 : 8),
  );
  const candidatesToEnrich = rankedCandidates.slice(0, enrichCount);

  // High Performance Enrichment: Use Bulk trip planning to calculate everything in one request
  const bulkItems = candidatesToEnrich.map(c => getTripPlanParams(c, plannedTimestamp, timingMode)).filter(Boolean);
  const bulkPlans = await transitService.getBulkTransitTripPlanDb(bulkItems);
  
  const enrichedCandidates = candidatesToEnrich.map((candidate, idx) => {
    // If the bulk processor returned a plan for this index, apply it
    return applyTripPlanToCandidate(candidate, plannedTimestamp, timingMode, bulkPlans[idx]);
  });
  const enrichedByRouteKey = new Map(
    enrichedCandidates.map((candidate) => [candidate.route.Key, candidate]),
  );

  rankedCandidates = pinPreferredRoute(
    sortCandidates(
      rankedCandidates.map(
        (candidate) => enrichedByRouteKey.get(candidate.route.Key) || candidate,
      ),
      preference,
    ),
    preferredRouteKey,
  ).slice(0, limit);

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
        .includes((candidate.route.Name || '').toString().toLowerCase()),
    );
    const nearestVehicleLabel = estimateNearestVehicleLabel(
      routeVehicles,
      candidate.nearestOrigin.stop,
    );

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
