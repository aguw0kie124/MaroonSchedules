function haversineDistanceMeters(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) *
      Math.cos(toRad(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Suppose GPS drift places us exactly at Zachry building center
const driftLat = 30.621;
const driftLng = -96.340;
// Same coords
console.log(haversineDistanceMeters(driftLat, driftLng, driftLat, driftLng));
