import request from './request';
import VEHICLE_TYPES from '../constants/vehicleType';
import db from '../db';
import { createPoint } from './dbUtils';
import vehicleChannel from '../channels/vehicleChannel';

let vehicles = {};
let vehiclePossibleRoutes = {};

const getVehicleType = (vehicleName) => {
  return vehicleName.length === 3 ? VEHICLE_TYPES.TRAM : VEHICLE_TYPES.BUS;
};

const getPossibleRoutes = async (lng, lat, vehicleType) => {
  const possibleRoutes = await db
    .distinct('shortName as possibleRoute')
    .from('route')
    .whereRaw('st_dwithin(geom::geometry, ?::geometry, ?) and vehicle_type = ? ', [
      createPoint(lng, lat),
      0.00008,
      vehicleType,
    ]);
  return possibleRoutes.map(({ possibleRoute }) => possibleRoute);
};

const evaluatePossibleRoutes = async (name, possibleRoutes) => {
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
              await evaluatePossibleRoutes(name, possibleRoutes);
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
};
