import request from './request';
import db from '../db';
import tableNames from '../constants/tableNames';
import routeTypes from '../constants/routeTypes';
import { insertOrUpdate, createLineString, createPoint } from './dbUtils';

const getRouteId = async (path) => {
  const html = await request(`https://www.sctpiasi.ro${path}`, false);
  const [id] = html.match(/(?<=fleetTrackId\s=\s)\d{1,4}/) || path.match(/(?<=\/trasee\/)\d{1,4}(?=\/)/);
  return id;
};

const getRouteIds = async () => {
  let routeIds = [];
  try {
    const html = await request('https://www.sctpiasi.ro/trasee/', false);
    const routePaths = html.match(/(?<=href=")\/trasee\/\d.*(?=")/g);
    routeIds = await Promise.all(routePaths.map((path) => getRouteId(path)));
  } catch (err) {
    console.error('Error retrieving route ids: ', err);
  }
  return routeIds;
};

const getRoutes = async (routeIds) => {
  let routes = [];
  try {
    routes = await Promise.all(
      routeIds.map(async (id) => await request(`https://m-go-iasi.wink.ro/apiPublic/route/byId/${id}`)),
    );
  } catch (err) {
    console.error('Error retrieving routes: ', err);
  }
  return routes.filter((route) => route).map(({ data }) => data);
};

export default async () => {
  const routeIds = await getRouteIds();
  const routes = await getRoutes(routeIds);
  try {
    await db.transaction(async (trx) => {
      return await Promise.all(
        routes.map(async (route) => {
          if (route.routeRoundWaypoints.length > 0 && route.routeRoundWayCoordinates.length > 0) {
            const {
              rows: [{ id: routeIdDus }],
            } = await insertOrUpdate(
              trx,
              tableNames.route,
              { external_id: route.routeId, type: routeTypes.DUS },
              {
                name: route.routeName + ' Dus',
                short_name: route.routeShortname,
                vehicle_type: route.routeType,
                geom: createLineString(route.routeWayCoordinates),
              },
              ['id'],
            );
            await Promise.all(
              route.routeWaypoints
                .filter((station) => station.name)
                .map(async (station, sequence) => {
                  const {
                    rows: [{ id: stationId }],
                  } = await insertOrUpdate(
                    trx,
                    tableNames.station,
                    { external_id: station.stationID },
                    {
                      name: station.name,
                      geom: createPoint(station.lng, station.lat),
                    },
                    ['id'],
                  );
                  await insertOrUpdate(
                    trx,
                    tableNames.route_stations,
                    { route_id: routeIdDus, station_id: stationId, sequence },
                    {},
                  );
                }),
            );
            const {
              rows: [{ id: routeIdIntors }],
            } = await insertOrUpdate(
              trx,
              tableNames.route,
              { external_id: route.routeId, type: routeTypes.INTORS },
              {
                name: route.routeName + ' Intors',
                short_name: route.routeShortname,
                vehicle_type: route.routeType,
                geom: createLineString(route.routeRoundWayCoordinates),
              },
              ['id'],
            );
            await Promise.all(
              route.routeRoundWaypoints
                .filter((station) => station.name)
                .map(async (station, sequence) => {
                  const {
                    rows: [{ id: stationId }],
                  } = await insertOrUpdate(
                    trx,
                    tableNames.station,
                    { external_id: station.stationID },
                    {
                      name: station.name,
                      geom: createPoint(station.lng, station.lat),
                    },
                    ['id'],
                  );
                  await insertOrUpdate(
                    trx,
                    tableNames.route_stations,
                    { route_id: routeIdIntors, station_id: stationId, sequence },
                    {},
                  );
                }),
            );
          } else {
            const {
              rows: [{ id: routeId }],
            } = await insertOrUpdate(
              trx,
              tableNames.route,
              { external_id: route.routeId, type: routeTypes.DUS_INTORS },
              {
                name: route.routeName,
                short_name: route.routeShortname,
                vehicle_type: route.routeType,
                geom: createLineString(route.routeWayCoordinates),
              },
              ['id'],
            );
            await Promise.all(
              route.routeRoundWaypoints
                .filter((station) => station.name)
                .map(async (station, sequence) => {
                  const {
                    rows: [{ id: stationId }],
                  } = await insertOrUpdate(
                    trx,
                    tableNames.station,
                    { external_id: station.stationID },
                    {
                      name: station.name,
                      geom: createPoint(station.lng, station.lat),
                    },
                    ['id'],
                  );
                  await insertOrUpdate(
                    trx,
                    tableNames.route_stations,
                    { route_id: routeId, station_id: stationId, sequence },
                    {},
                  );
                }),
            );
          }
        }),
      );
    });
  } catch (err) {
    console.error('Error populating database: ', err);
  }
};
