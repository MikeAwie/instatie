import { CronJob } from 'cron';
import populateDatabase from './dbPopulation';
import { refreshVehicles, resetVehicles } from './vehicles';
import { createStationChannels } from '../channels/stationChannels';

async function dbPopulation() {
  console.log('Populating database...');
  await populateDatabase();
  await createStationChannels();
  console.log('Database population finished');
}

dbPopulation();
new CronJob('55 3 * * *', dbPopulation).start();

new CronJob('*/30 * * * * *', refreshVehicles).start();

new CronJob('0 4 * * *', resetVehicles).start();
