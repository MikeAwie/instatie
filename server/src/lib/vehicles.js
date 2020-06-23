import request from './request';
import { sendNotifications } from './notifier';
import VEHICLE_TYPES from '../constants/vehicleType';
import db, { gis } from '../db';
import tableNames from '../constants/tableNames';
import { createPoint } from './dbUtils';
import vehicleChannel from '../channels/vehicleChannel';
import stationChannels from '../channels/stationChannels';
import { AVERAGE_SPEED, MIN_SPEED, MAX_SPEED } from '../constants/speed';

let vehicles = {};
let vehiclePossibleRoutes = {};
let stations = {};
let oldStations = {};

const getVehicleType = (vehicleName) => {
  return vehicleName.length === 3 ? VEHICLE_TYPES.TRAM : VEHICLE_TYPES.BUS;
};

const getPossibleRoutes = async (lng, lat, vehicleType) => {
  const possibleRoutes = await db
    .distinct('shortName as possibleRoute')
    .from(tableNames.route)
    .where(gis.dwithin('geom', createPoint(lng, lat), 0.00008))
    .andWhere('vehicleType', vehicleType);
  return possibleRoutes.map(({ possibleRoute }) => possibleRoute);
};

const evaluatePossibleRoutes = (name, possibleRoutes) => {
  delete vehicles[name].route;
  if (!vehiclePossibleRoutes[name] || !vehiclePossibleRoutes[name].length) {
    vehiclePossibleRoutes[name] = possibleRoutes;
  } else {
    const commonPossibleRoutes = possibleRoutes.filter((possibleRoute) =>
      vehiclePossibleRoutes[name].includes(possibleRoute),
    );
    vehiclePossibleRoutes[name] = commonPossibleRoutes.length ? commonPossibleRoutes : possibleRoutes;
  }

  if (vehiclePossibleRoutes[name] && vehiclePossibleRoutes[name].length === 1) {
    vehicles[name].route = vehiclePossibleRoutes[name][0];
    delete vehiclePossibleRoutes[name];
  }
};

const findNextStations = (routeId, oldLng, oldLat, lng, lat) =>
  db
    .select(
      db.raw(
        `station.id as station_id,
          sequence,
          ? as old_distance,
          ? as new_distance`,
        [
          db.raw(
            `ST_Length(ST_LineSubstring(
                route.geom::geometry,
                least(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)),
                greatest(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)))::geography)`,
            { vehicleLocation: createPoint(oldLng, oldLat) },
          ),
          db.raw(
            `ST_Length(ST_LineSubstring(
                route.geom::geometry,
                least(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)),
                greatest(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)))::geography)`,
            { vehicleLocation: createPoint(lng, lat) },
          ),
        ],
      ),
    )
    .from(tableNames.station)
    .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
    .where('route_stations.route_id', routeId)
    .join(tableNames.route, 'route.id', 'route_stations.route_id')
    .where(
      db.raw(
        `ST_Length(ST_LineSubstring(
            route.geom::geometry,
            least(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)),
            greatest(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)))::geography)`,
        { vehicleLocation: createPoint(oldLng, oldLat) },
      ),
      '>',
      db.raw(
        `ST_Length(ST_LineSubstring(
            route.geom::geometry,
            least(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)),
            greatest(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)))::geography)`,
        { vehicleLocation: createPoint(lng, lat) },
      ),
    )
    .orderBy('new_distance')
    .limit(5);

const calcSpeed = async (routeId, oldLng, oldLat, lng, lat) => {
  const [{ distance }] = await db
    .select(
      db.raw(
        `ST_Length(ST_LineSubstring(
        geom::geometry,
        least(ST_LineLocatePoint(geom::geometry, :oldLocation::geometry), ST_LineLocatePoint(geom::geometry, :newLocation::geometry)),
        greatest(ST_LineLocatePoint(geom::geometry, :oldLocation::geometry), ST_LineLocatePoint(geom::geometry, :newLocation::geometry)))::geography) as distance`,
        { oldLocation: createPoint(oldLng, oldLat), newLocation: createPoint(lng, lat) },
      ),
    )
    .from(tableNames.route)
    .where('id', routeId);
  if (distance) {
    const speed = distance * 2;
    if (speed >= MIN_SPEED && speed <= MAX_SPEED) {
      return speed;
    }
    return AVERAGE_SPEED;
  }
};

const calcTime = (distance, speed, index) => {
  return parseInt(distance / speed + 0.4 * index);
};

const evaluateTimeToNextStations = async (name, oldLng, oldLat, lng, lat) => {
  const shortName = vehicles[name].route;
  const routeIds = (await db.select('id').from(tableNames.route).where('shortName', shortName)).map(({ id }) => id);
  let speed = AVERAGE_SPEED;
  let nextStations = [];
  if (routeIds.length === 1) {
    speed = await calcSpeed(routeIds[0], oldLng, oldLat, lng, lat);
    nextStations = await findNextStations(routeIds[0], oldLng, oldLat, lng, lat);
  } else if (routeIds.length === 2) {
    const possibleNextStations = await findNextStations(routeIds[0], oldLng, oldLat, lng, lat);
    if (possibleNextStations.length > 1 && possibleNextStations[0].sequence < possibleNextStations[1].sequence) {
      speed = await calcSpeed(routeIds[0], oldLng, oldLat, lng, lat);
      nextStations = possibleNextStations;
    } else {
      speed = await calcSpeed(routeIds[1], oldLng, oldLat, lng, lat);
      nextStations = await findNextStations(routeIds[1], oldLng, oldLat, lng, lat);
    }
  }
  nextStations.forEach(({ stationId: id, newDistance: distance }, index) => {
    let time = calcTime(distance, speed, index);
    if (oldStations[id] && oldStations[id][name]) time = Math.min(oldStations[id][name].time, time);
    if (time > 0) {
      if (stations[id]) {
        stations[id][name] = { route: shortName, time };
      } else {
        stations[id] = { [name]: { route: shortName, time } };
      }
      sendNotifications(id, shortName, time);
    }
  });
};

export const refreshVehicles = async () => {
  oldStations = stations;
  await Promise.all(
    (await request('https://gps.sctpiasi.ro/json')).map(async ({ vehicleName, vehicleLong: lng, vehicleLat: lat }) => {
      try {
        if (lng && lat) {
          const name = vehicleName.trim();
          const type = getVehicleType(name);
          if (!vehicles[name]) {
            vehicles[name] = { type };
          }
          if (vehicles[name].lng !== lng || vehicles[name].lat !== lat) {
            const possibleRoutes = await getPossibleRoutes(lng, lat, type);
            for (const stationId of Object.keys(stations)) {
              if (name in stations[stationId]) {
                delete stations[stationId][name];
              }
            }
            if (vehicles[name].route && possibleRoutes.includes(vehicles[name].route)) {
              await evaluateTimeToNextStations(name, vehicles[name].lng, vehicles[name].lat, lng, lat);
            } else if (possibleRoutes.length) {
              evaluatePossibleRoutes(name, possibleRoutes);
            }
            vehicles[name].lng = lng;
            vehicles[name].lat = lat;
          }
        }
      } catch (err) {
        console.error('Error refreshing vehicle ', vehicleName, err);
      }
    }),
  );
  vehicleChannel.publish(vehicles, 'data');
  for (const [id, data] of Object.entries(stations)) {
    if (stationChannels[id]) stationChannels[id].publish(data, 'data');
  }
};

export const resetVehicles = async () => {
  vehicles = {};
  vehiclePossibleRoutes = {};
  stations = {};
  oldStations = {};
};
