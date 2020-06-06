import { CronJob } from 'cron';
import populateDatabase from './dbPopulation';
import request from './request';
import vehicleChannel from '../channels/vehicleChannel';

async function dbPopulation() {
  console.log('Populating database...');
  populateDatabase().then(() => console.log('Database population finished'));
}

async function publishVehicles() {
  const vehicles = await request('https://gps.sctpiasi.ro/json');
  vehicleChannel.publish(vehicles, 'data');
}

dbPopulation();
new CronJob('0 0,8,16 * * *', dbPopulation).start();

new CronJob('*/30 * * * * *', publishVehicles).start();
