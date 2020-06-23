import app from './app';
import db, { gis } from './db';
import tableNames from './constants/tableNames';
import { addSubscription } from './lib/notifier';

app.get('/stations', async (req, res) => {
  try {
    const stations = await db.select('id', 'external_id', 'name', gis.asGeoJSON('geom')).from(tableNames.station);
    if (!stations) res.send('No stations found', 404);
    res.send(
      await Promise.all(
        stations.map(async (station) => {
          const routes = (
            await db
              .distinct('shortName')
              .from(tableNames.route_stations)
              .join(tableNames.route, 'route.id', 'route_stations.route_id')
              .where('station_id', station.id)
          ).map(({ shortName }) => shortName);
          return { ...station, geom: JSON.parse(station.geom), routes };
        }),
      ),
    );
  } catch (err) {
    res.send('Error fetching stations: ' + err, 500);
  }
});

app.get('/routes', async (req, res) => {
  try {
    const routes = await db
      .select('id', 'external_id', 'type', 'name', 'short_name', 'vehicle_type', gis.asGeoJSON('geom'))
      .from(tableNames.route);
    if (!routes) res.send('No routes found', 404);
    res.send(routes.map((route) => ({ ...route, geom: JSON.parse(route.geom) })));
  } catch (err) {
    res.send('Error fetching routes: ' + err, 500);
  }
});

app.get('/news', async (req, res) => {
  try {
    const news = await db.select('id', 'title', 'date', 'body').from(tableNames.news).orderBy('id', 'desc');
    if (!news) res.send('No news found', 404);
    res.send(news);
  } catch (err) {
    res.send('Error fetching news: ' + err, 500);
  }
});

app.post('/notify', (req, res) => {
  if (
    !req.body ||
    !req.body.subscription ||
    !req.body.subscription.endpoint ||
    !req.body.subscription.keys ||
    !req.body.subscription.keys.p256dh ||
    !req.body.subscription.keys.auth ||
    !req.body.stationId ||
    !req.body.route
  ) {
    res.send('Bad Request', 400);
    return;
  }
  addSubscription(req.body.subscription, req.body.stationId, req.body.route);
  res.send('OK');
});
