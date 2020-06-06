import app from './app';
import vehicleChannel from './channels/vehicleChannel';

app.get('/stream/vehicles', (req, res) => vehicleChannel.subscribe(req, res));
