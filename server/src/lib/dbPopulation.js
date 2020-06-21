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
  const html = await request('https://www.sctpiasi.ro/trasee/', false);
  const routePaths = html.match(/(?<=href=")\/trasee\/\d.*(?=")/g);
  routeIds = await Promise.all(
    routePaths.map(async (path) => {
      try {
        return await getRouteId(path);
      } catch (err) {
        console.error('Error retrieving route id: ', path, err);
      }
    }),
  );
  return routeIds.filter((id) => id);
};

const getRoutes = async () => {
  const routeIds = await getRouteIds();
  let routes = [];
  routes = await Promise.all(
    routeIds.map(async (id) => {
      try {
        return await request(`https://m-go-iasi.wink.ro/apiPublic/route/byId/${id}`);
      } catch (err) {
        console.error('Error retrieving route: ', id, err);
      }
    }),
  );
  return routes.filter((route) => route).map(({ data }) => data);
};

const saveRouteAndStations = async (routeData, trx) => {
  const routes = [];
  if (
    routeData.routeRoundWaypoints &&
    routeData.routeRoundWaypoints.length > 0 &&
    routeData.routeRoundWayCoordinates &&
    routeData.routeRoundWayCoordinates.length > 0
  ) {
    routes.push({
      externalId: routeData.routeId,
      type: routeTypes.DUS,
      name: routeData.routeName + ' Dus',
      shortName: routeData.routeShortname,
      vehicleType: routeData.routeType,
      coordinates: routeData.routeWayCoordinates,
      stations: routeData.routeWaypoints,
    });
    routes.push({
      externalId: routeData.routeId,
      type: routeTypes.INTORS,
      name: routeData.routeName + ' Intors',
      shortName: routeData.routeShortname,
      vehicleType: routeData.routeType,
      coordinates: routeData.routeRoundWayCoordinates,
      stations: routeData.routeRoundWaypoints,
    });
  } else {
    routes.push({
      externalId: routeData.routeId,
      type: routeTypes.DUS_INTORS,
      name: routeData.routeName,
      shortName: routeData.routeShortname,
      vehicleType: routeData.routeType,
      coordinates: routeData.routeWayCoordinates,
      stations: routeData.routeWaypoints,
    });
  }
  return await Promise.all(
    routes.map(async ({ externalId, type, name, shortName, vehicleType, coordinates, stations }) => {
      const {
        rows: [{ id: routeId }],
      } = await insertOrUpdate(
        trx,
        tableNames.route,
        { externalId, type },
        {
          name,
          shortName,
          vehicleType,
          geom: createLineString(coordinates),
        },
        ['id'],
      );
      await Promise.all(
        stations
          .filter((station) => station.name)
          .map(async (station, sequence) => {
            const {
              rows: [{ id: stationId }],
            } = await insertOrUpdate(
              trx,
              tableNames.station,
              { externalId: station.stationID },
              {
                name: station.name,
                geom: createPoint(station.lng, station.lat),
              },
              ['id'],
            );
            await insertOrUpdate(trx, tableNames.route_stations, { routeId, stationId, sequence }, {});
          }),
      );
    }),
  );
};

const populateRoutesAndStations = async (trx) => {
  const routes = await getRoutes();
  return await Promise.all(routes.map((route) => saveRouteAndStations(route, trx)));
};

const getNewsUrls = async () => {
  const html = await request('https://www.sctpiasi.ro/stiri/', false);
  return html
    .match(/(?<=<a\shref=")\/stiri\/.*(?="\sclass="readmore">citește\stot<\/a>)/g)
    .map((url) => `https://www.sctpiasi.ro${url}`)
    .reverse();
};

const getNews = async () => {
  const urls = await getNewsUrls();
  return (
    await Promise.all(
      urls.map(async (url, id) => {
        try {
          const html = await request(url, false);
          const [title] = html.match(
            /(?<=<a\sclass="close_news"\shref="\/stiri"><span><\/span><span><\/span><\/a>(.|\n)*<h1>).*(?=<\/h1>)/g,
          );
          const [date] = html.match(/(?<=<p class="data-stirii">).*(?=<\/p>)/g);
          const [body] = html.match(
            /(?<=<a\sclass="close_news"\shref="\/stiri"><span><\/span><span><\/span><\/a>)(.|\n)*(?=<div\sstyle="clear:both"><\/div>)/g,
          );
          return { id: id + 1, title, date, body };
        } catch (err) {
          console.error('Error retrieving news: ', url, err);
        }
      }),
    )
  ).filter((news) => news);
};

const populateNews = async (trx) => {
  const news = await getNews();
  return await Promise.all(news.map(({ id, ...newsItem }) => insertOrUpdate(trx, tableNames.news, { id }, newsItem)));
};

export default async () => {
  try {
    await db.transaction(async (trx) => {
      for (const tableName in tableNames) {
        await db(tableNames[tableName]).del();
      }
      await Promise.all([populateRoutesAndStations(trx), populateNews(trx)]);
    });
  } catch (err) {
    console.error('Error populating database: ', err);
  }
};
