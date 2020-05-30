import knex from 'knex';
import knexPostgis from 'knex-postgis';
import knexStringcase from 'knex-stringcase';
const knexConfig = require('../knexfile');

const environment = process.env.NODE_ENV || 'development';
const connectionConfig = knexConfig[environment];
const options = knexStringcase(connectionConfig);
const connection = knex(options);

export const gis = knexPostgis(connection);

export default connection;
