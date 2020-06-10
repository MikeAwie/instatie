import app from './app';
import vehicleChannel from './channels/vehicleChannel';
import stationChannels from './channels/stationChannels';

app.get('/stream/vehicles', (req, res) => vehicleChannel.subscribe(req, res));

app.get('/stream/station', (req, res) => {
  const { id } = req.query;
  if (!id) res.send('Station id not provided', 400);
  else {
    if (stationChannels[id]) {
      stationChannels[id].subscribe(req, res);
    } else {
      res.send(`Station with id ${id} not found`, 404);
    }
  }
});
