import knex from 'knex';
import knexPostgis from 'knex-postgis';
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const connectionConfig = knexConfig[environment];

const connection = knex(connectionConfig);

export const gis = knexPostgis(connection);

export default connection;
