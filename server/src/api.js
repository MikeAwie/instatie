import app from './app';
import db, { gis } from './db';

app.get('/stations', async (req, res) => {
  try {
    const stations = await db.select('id', 'external_id', 'name', gis.asGeoJSON('geom')).from('station');
    if (!stations) res.send('No stations found', 404);
    res.send(stations.map((station) => ({ ...station, geom: JSON.parse(station.geom) })));
  } catch (err) {
    res.send('Error fetching stations: ' + err, 500);
  }
});

app.get('/routes', async (req, res) => {
  try {
    const routes = await db
      .select('id', 'external_id', 'type', 'name', 'short_name', 'vehicle_type', gis.asGeoJSON('geom'))
      .from('route');
    if (!routes) res.send('No routes found', 404);
    res.send(routes.map((route) => ({ ...route, geom: JSON.parse(route.geom) })));
  } catch (err) {
    res.send('Error fetching routes: ' + err, 500);
  }
});
