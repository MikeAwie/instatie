import webPush from 'web-push';

webPush.setGCMAPIKey(process.env.GCM_SERVER_KEY);
webPush.setVapidDetails(process.env.MAILTO, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const subscriptions = {};

export const addSubscription = (subscription, stationId, route) => {
  if (subscriptions[stationId]) {
    if (subscriptions[stationId][route]) {
      subscriptions[stationId][route].push(subscription);
    } else {
      subscriptions[stationId][route] = [subscription];
    }
  } else {
    subscriptions[stationId] = { [route]: [subscription] };
  }
};

export const sendNotifications = (stationId, route, time) => {
  if (subscriptions[stationId] && subscriptions[stationId][route]) {
    subscriptions[stationId][route].forEach((subscription) =>
      webPush.sendNotification(
        subscription,
        JSON.stringify({
          title: 'Alerta vehicul',
          body: `Vehiculul cu numarul ${route} va ajunge in ${time} minute!`,
          actions: [
            {
              action: 'dismiss',
              title: 'Inchide',
            },
          ],
        }),
      ),
    );
    delete subscriptions[stationId][route];
  }
};
