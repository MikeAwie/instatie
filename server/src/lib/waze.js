import url from 'url';
import randomUseragent from 'random-useragent';
import request from './request';

export const getRouteTime = async (originLng, originLat, destLng, destLat, index) => {
  const headers = {
    'User-Agent': randomUseragent.getRandom(),
    referer: 'https://www.waze.com/',
  };
  const options = {
    from: `x:${originLng} y:${originLat}`,
    to: `x:${destLng} y:${destLat}`,
    at: 0,
    returnJSON: true,
    returnGeometries: true,
    returnInstructions: true,
    timeout: 60000,
    nPaths: 1,
    options: 'AVOID_TOLL_ROADS:t',
  };
  const requestUrl = url.parse(
    url.format({
      protocol: 'https',
      hostname: 'www.waze.com',
      pathname: '/row-RoutingManager/routingRequest',
      query: options,
    }),
  );
  try {
    const { response } = await request(requestUrl.href, true, 'GET', headers);
    if (response) {
      const { results } = response;
      let time = 0;
      results.forEach(({ crossTime }) => (time += crossTime));
      time = parseInt(time / 60 + (index + 1) * 0.3);
      return time > 0 ? time : null;
    }
  } catch (err) {
    console.error('Failed to get route time ', err);
  }
  return null;
};
