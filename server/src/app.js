import server from './server';
import db, { gis } from './db';

const app = server();

app.get('/stations', async () => {
  try {
    const stations = await db.select('id', 'external_id', 'name', gis.asGeoJSON('geom')).from('station');
    if (!stations) return ['No stations found', 404];
    return stations.map((station) => ({ ...station, geom: JSON.parse(station.geom) }));
  } catch (err) {
    return ['Error fetching stations: ' + err, 500];
  }
});

app.get('/routes', async () => {
  try {
    const routes = await db
      .select('id', 'external_id', 'type', 'name', 'short_name', 'vehicle_type', gis.asGeoJSON('geom'))
      .from('route');
    if (!routes) return ['No routes found', 404];
    return routes.map((route) => ({ ...route, geom: JSON.parse(route.geom) }));
  } catch (err) {
    return ['Error fetching routes: ' + err, 500];
  }
});

export default app;
