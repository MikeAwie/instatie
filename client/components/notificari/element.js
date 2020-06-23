import BaseElement from '../base.js';
import '../../db-helpers.js';

class MyNotificari extends BaseElement {
  constructor() {
    super('/components/notificari/template.html', '/components/notificari/styles.css');
    this.selectedStationId = null;
    this.selectedRoute = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.fetchData();
  }

  async fetchData() {
    const [data] = await Promise.all([
      fetch('http://localhost:3000/stations').then((res) => res.json()),
      this.readyPromise,
    ]);
    const stationsContainer = this._root.querySelector('.container');
    const stationsSearch = this._root.querySelector('#search');
    stationsSearch.addEventListener('keyup', () => this.filterStations());
    data.forEach(({ name, routes = [], id }) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'stationId';
      radio.value = id;
      radio.addEventListener('change', () => {
        this.selectedStationId = id;
        this.showRoutes(routes);
      });
      label.appendChild(radio);
      const span = document.createElement('span');
      span.className = 'radio';
      label.appendChild(span);
      const text = document.createTextNode(`${name} - ${routes.join(',')}`);
      label.appendChild(text);
      li.appendChild(label);
      stationsContainer.appendChild(li);
    });
  }

  filterStations() {
    const input = this._root.querySelector('#search');
    const filter = input.value.toUpperCase();
    const ul = this._root.querySelector('.container');
    const li = ul.getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
      const label = li[i].getElementsByTagName('label')[0];
      const txtValue = label.textContent || label.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        li[i].style.display = '';
      } else {
        li[i].style.display = 'none';
      }
    }
  }

  showRoutes(routes) {
    const div = this._root.querySelector('#routes');
    div.innerHTML = '';
    const h3 = document.createElement('h3');
    h3.innerText = 'Selecteaza o ruta:';
    div.appendChild(h3);
    const routesContainer = document.createElement('ul');
    routesContainer.className = 'container';
    div.appendChild(routesContainer);
    routes.forEach((route) => {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'route';
      radio.value = route;
      radio.addEventListener('change', () => {
        this.selectedRoute = route;
        const buttonContainer = this._root.querySelector('#button');
        buttonContainer.innerText = '';
        const button = document.createElement('button');
        button.id = 'post-button';
        button.innerText = 'Creaza Notificare!';
        button.addEventListener('click', () => {
          this.postToServer(this.selectedStationId, this.selectedRoute);
          buttonContainer.innerHTML = '';
        });
        buttonContainer.appendChild(button);
      });
      label.appendChild(radio);
      const span = document.createElement('span');
      span.className = 'radio';
      label.appendChild(span);
      const text = document.createTextNode(route);
      label.appendChild(text);
      li.appendChild(label);
      routesContainer.appendChild(li);
    });
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async postToServer(stationId, route) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    if (!registration) {
      return;
    }
    const pushSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(
        'BOLjYqdQinruB6uuBhSeoAPgZj5MeBhobY8ZpSy-XIvAIPYosnN0xjaRDnqzYhEZj9aLJlZUQORD1RQNsKrVZCw',
      ),
    });
    if (Notification.permission !== 'granted' || !pushSubscription) {
      return;
    }
    if (!navigator.serviceWorker.controller) {
      return;
    }
    await self.putIntoDB('fetch-queue', {
      url: 'http://localhost:3000/notify',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stationId,
        route,
        subscription: pushSubscription.toJSON(),
      }),
    });
    await registration.sync.register('fetch');
  }
}

customElements.define('my-notificari', MyNotificari);
export default MyNotificari;
