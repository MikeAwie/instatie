import request from './request';
import { Sema } from 'async-sema';
import VEHICLE_TYPES from '../constants/vehicleType';
import db, { gis } from '../db';
import tableNames from '../constants/tableNames';
import { createPoint } from './dbUtils';
import vehicleChannel from '../channels/vehicleChannel';
import stationChannels from '../channels/stationChannels';
import { getRouteTime } from './waze';

let vehicles = {};
let vehiclePossibleRoutes = {};
let stations = {};

const sema = new Sema(1, {
  capacity: 300,
});

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
  if (!vehiclePossibleRoutes[name]) {
    if (possibleRoutes.length) {
      vehiclePossibleRoutes[name] = possibleRoutes;
    }
  } else if (!vehiclePossibleRoutes[name].length) {
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

const findNearestStations = async (routeId, lng, lat) =>
  db
    .select(
      db.raw(
        `station.id as station_id,
          route.id as route_id,
          sequence,
          ST_AsGeoJSON(station.geom) as geom,
          ST_DistanceSphere(station.geom, ?) as distance`,
        [createPoint(lng, lat)],
      ),
    )
    .from(tableNames.station)
    .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
    .where('route_stations.route_id', routeId)
    .join(tableNames.route, 'route.id', 'route_stations.route_id')
    .orderBy(
      db.raw(
        `ST_Length(ST_LineSubstring(
            route.geom::geometry,
            least(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)),
            greatest(ST_LineLocatePoint(route.geom::geometry, station.geom::geometry), ST_LineLocatePoint(route.geom::geometry, :vehicleLocation::geometry)))::geography)`,
        { vehicleLocation: createPoint(lng, lat) },
      ),
    )
    .limit(2);

const findNextStations = async (shortName, oldLng, oldLat, lng, lat) => {
  const routeIds = (await db.select('id').from(tableNames.route).where('shortName', shortName)).map(({ id }) => id);
  if (routeIds.length === 1) {
    const nearestStations = await findNearestStations(routeIds[0], oldLng, oldLat);
    if (nearestStations.length === 2) {
      const [{ stDistancesphere: newDistance0 }] = await db.select(
        gis.distanceSphere(gis.geomFromGeoJSON(nearestStations[0].geom, 4326), createPoint(lng, lat)),
      );
      const [{ stDistancesphere: newDistance1 }] = await db.select(
        gis.distanceSphere(gis.geomFromGeoJSON(nearestStations[1].geom, 4326), createPoint(lng, lat)),
      );
      if (nearestStations[0].distance > newDistance0 && nearestStations[1].distance < newDistance1) {
        const minSequence =
          nearestStations[0].sequence > nearestStations[1].sequence
            ? nearestStations[0].sequence
            : nearestStations[0].sequence - 2;
        const maxSequence =
          nearestStations[0].sequence > nearestStations[1].sequence
            ? nearestStations[0].sequence + 2
            : nearestStations[0];
        return db
          .select('id', gis.asGeoJSON('geom'))
          .from(tableNames.station)
          .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
          .where('route_stations.route_id', routeIds[0])
          .andWhere('sequence', '>=', minSequence)
          .andWhere('sequence', '<=', maxSequence);
      } else if (nearestStations[1].distance > newDistance1 && nearestStations[0].distance < newDistance0) {
        const minSequence =
          nearestStations[1].sequence > nearestStations[0].sequence
            ? nearestStations[1].sequence
            : nearestStations[1].sequence - 2;
        const maxSequence =
          nearestStations[1].sequence > nearestStations[0].sequence
            ? nearestStations[1].sequence + 2
            : nearestStations[1];
        return db
          .select('id', gis.asGeoJSON('geom'))
          .from(tableNames.station)
          .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
          .where('route_stations.route_id', routeIds[0])
          .andWhere('sequence', '>=', minSequence)
          .andWhere('sequence', '<=', maxSequence);
      }
    }
  } else if (routeIds.length === 2) {
    const nearestStations = await findNearestStations(routeIds[0], oldLng, oldLat);
    if (nearestStations.length === 2) {
      const [{ stDistancesphere: newDistance0 }] = await db.select(
        gis.distanceSphere(gis.geomFromGeoJSON(nearestStations[0].geom, 4326), createPoint(lng, lat)),
      );
      const [{ stDistancesphere: newDistance1 }] = await db.select(
        gis.distanceSphere(gis.geomFromGeoJSON(nearestStations[1].geom, 4326), createPoint(lng, lat)),
      );
      if (nearestStations[0].distance > newDistance0 && nearestStations[1].distance < newDistance1) {
        if (nearestStations[0].sequence > nearestStations[1].sequence) {
          const minSequence = nearestStations[0].sequence;
          const maxSequence = nearestStations[0].sequence + 2;
          return db
            .select('id', gis.asGeoJSON('geom'))
            .from(tableNames.station)
            .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
            .where('route_stations.route_id', nearestStations[0].routeId)
            .andWhere('sequence', '>=', minSequence)
            .andWhere('sequence', '<=', maxSequence);
        }
      } else if (nearestStations[1].distance > newDistance1 && nearestStations[0].distance < newDistance0) {
        if (nearestStations[1].sequence > nearestStations[0].sequence) {
          const minSequence = nearestStations[1].sequence;
          const maxSequence = nearestStations[1].sequence + 2;
          return db
            .select('id', gis.asGeoJSON('geom'))
            .from(tableNames.station)
            .join(tableNames.route_stations, 'station.id', 'route_stations.station_id')
            .where('route_stations.route_id', nearestStations[1].routeId)
            .andWhere('sequence', '>=', minSequence)
            .andWhere('sequence', '<=', maxSequence);
        }
      }
    }
  }
  return [];
};

const calculateTimeToNextStation = async (nextStationLng, nextStationLat, lng, lat, index) => {
  await sema.acquire();
  const time = await getRouteTime(nextStationLng, nextStationLat, lng, lat, index);
  setTimeout(() => sema.release(), 1000);
  return time;
};

export const refreshVehicles = async () => {
  await Promise.all(
    (await request('https://gps.sctpiasi.ro/json')).map(async ({ vehicleName, vehicleLong: lng, vehicleLat: lat }) => {
      try {
        const name = vehicleName.trim();
        if (lng && lat) {
          const type = getVehicleType(name);
          if (!vehicles[name]) {
            vehicles[name] = { type };
          }
          if (!vehiclePossibleRoutes[name]) {
            vehiclePossibleRoutes[name] = {};
          }
          if (vehicles[name].lng !== lng || vehicles[name].lat !== lat) {
            const possibleRoutes = await getPossibleRoutes(lng, lat, type);
            if (!vehicles[name].route || !possibleRoutes.includes(vehicles[name].route)) {
              delete vehicles[name].route;
              evaluatePossibleRoutes(name, possibleRoutes);
            } else {
              const nextStations = await findNextStations(
                vehicles[name].route,
                vehicles[name].lng,
                vehicles[name].lat,
                lng,
                lat,
              );
              Promise.all(
                nextStations.map(async (nextStation, index) => {
                  const {
                    coordinates: [nextStationLng, nextStationLat],
                  } = JSON.parse(nextStation.geom);
                  if (!(stations[nextStation.id] && stations[nextStation.id][name])) {
                    const time = await calculateTimeToNextStation(nextStationLng, nextStationLat, lng, lat, index);
                    if (time && vehicles[name].route) {
                      if (stations[nextStation.id]) {
                        stations[nextStation.id][name] = { route: vehicles[name].route, time };
                      } else {
                        stations[nextStation.id] = { [name]: { route: vehicles[name].route, time } };
                      }
                      if (stationChannels[nextStation.id])
                        stationChannels[nextStation.id].publish(stations[nextStation.id]);
                      const decreasePerMinute = setInterval(() => {
                        if (stations[nextStation.id][name]) {
                          stations[nextStation.id][name].time--;
                          if (stations[nextStation.id][name].time === 0) {
                            delete stations[nextStation.id][name];
                            clearInterval(decreasePerMinute);
                          }
                          console.log(stations);
                          if (stationChannels[nextStation.id])
                            stationChannels[nextStation.id].publish(stations[nextStation.id]);
                        } else {
                          clearInterval(decreasePerMinute);
                        }
                      }, 60000);
                    }
                  }
                }),
              );
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
};

export const resetVehicles = async () => {
  vehicles = {};
  vehiclePossibleRoutes = {};
  stations = {};
};
