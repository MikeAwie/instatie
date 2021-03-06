import Knex from 'knex';
import tableNames from '../../src/constants/tableNames';

/**
 * @param {Knex} knex
 */
exports.up = async (knex) => {
  await knex.schema.createTable(tableNames.station, (table) => {
    table.increments().notNullable();
    table.integer('external_id').notNullable().unique();
    table.string('name', 50).notNullable();
    table.specificType('geom', 'geometry(point, 4326)').notNullable();
  });

  await knex.schema.createTable(tableNames.route, (table) => {
    table.increments().notNullable();
    table.integer('external_id').notNullable();
    table.integer('type').unsigned().notNullable();
    table.unique(['external_id', 'type']);
    table.string('name', 50).notNullable();
    table.string('short_name', 20).notNullable();
    table.integer('vehicle_type').unsigned().notNullable();
    table.specificType('geom', 'geometry(linestring, 4326)').notNullable();
  });

  await knex.schema.createTable(tableNames.route_stations, (table) => {
    table.integer('route_id').unsigned().references('id').inTable(tableNames.route).onDelete('cascade').notNullable();
    table
      .integer('station_id')
      .unsigned()
      .references('id')
      .inTable(tableNames.station)
      .onDelete('cascade')
      .notNullable();
    table.integer('sequence').unsigned().notNullable();
    table.unique(['route_id', 'station_id', 'sequence']);
  });

  await knex.schema.createTable(tableNames.news, (table) => {
    table.increments().notNullable();
    table.string('title');
    table.string('date', 15);
    table.text('body');
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists(tableNames.news);
  await knex.schema.dropTableIfExists(tableNames.route_stations);
  await knex.schema.dropTableIfExists(tableNames.route);
  await knex.schema.dropTableIfExists(tableNames.station);
};
