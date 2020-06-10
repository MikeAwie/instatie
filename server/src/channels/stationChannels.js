import db from '../db';
import tableNames from '../constants/tableNames';
import SSEChannel from '../lib/SSEChannel';

const stationChannels = {};

export default stationChannels;

export const createStationChannels = async () => {
  const stations = (await db.select('id').from(tableNames.station)).map(({ id }) => id);
  for (const id in stationChannels) {
    if (!stations.includes(id)) delete stationChannels[id];
  }
  for (const id of stations) {
    if (!stationChannels[id]) stationChannels[id] = new SSEChannel();
  }
};
