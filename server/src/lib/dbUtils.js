import { gis } from '../db';

export const createPoint = (lng, lat) => {
  return gis.geomFromText(`POINT(${`${lng} ${lat}`})`, 4326);
};

export const createLineString = (coords) => {
  return gis.geomFromText(`LINESTRING(${coords.map(({ lng, lat }) => `${lng} ${lat}`).join(',')})`, 4326);
};

export const insertOrUpdate = async (db, table, keys, fields, returnFields = []) => {
  const update = Object.keys(fields)
    .map((key) => db.raw('?? = EXCLUDED.??', [key, key]))
    .join(', ');

  const constraint = Object.keys(keys)
    .map((key) => db.raw('??', key))
    .join(', ');

  const returning = returnFields.map((field) => db.raw('RETURNING ??', field)).join(', ');

  const sql = `? ON CONFLICT (${constraint})
               DO ${(update && `UPDATE SET ${update}`) || 'NOTHING'} ${returning};`;
  return db.raw(sql, [
    db
      .insert({
        ...keys,
        ...fields,
      })
      .into(table),
  ]);
};
