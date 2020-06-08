import { CronJob } from 'cron';
import populateDatabase from './dbPopulation';
import { refreshVehicles, resetVehicles } from './vehicles';

async function dbPopulation() {
  console.log('Populating database...');
  await populateDatabase();
  console.log('Database population finished');
}

dbPopulation();
new CronJob('0 0,8,16 * * *', dbPopulation).start();

new CronJob('*/30 * * * * *', refreshVehicles).start();

new CronJob('0 4 * * *', resetVehicles).start();
