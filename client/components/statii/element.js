import BaseElement from '../base.js';

class MyStatii extends BaseElement {
  constructor() {
    super('/components/statii/template.html', '/components/statii/styles.css');
    this.es = null;
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
    const stationsContainer = this._root.querySelector('#stations-container');
    const stationsSearch = this._root.querySelector('#stations-search');
    stationsSearch.addEventListener('keyup', () => this.filterStations());
    const bodyDialog = this._root.querySelector('#body-dialog');
    bodyDialog.addEventListener('click', () => {
      this.toggleStation();
    });
    data.forEach(({ name, routes, id }) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = `${name} - ${routes.join(',')}`;
      button.id = id;
      button.addEventListener('click', (event) => this.toggleStation(event.target.innerText, id));
      li.appendChild(button);
      stationsContainer.appendChild(li);
    });
  }

  filterStations() {
    const input = this._root.querySelector('#stations-search');
    const filter = input.value.toUpperCase();
    const ul = this._root.querySelector('#stations-container');
    const li = ul.getElementsByTagName('li');
    for (let i = 0; i < li.length; i++) {
      const button = li[i].getElementsByTagName('button')[0];
      const txtValue = button.textContent || button.innerText;
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        li[i].style.display = '';
      } else {
        li[i].style.display = 'none';
      }
    }
  }

  toggleStation(name, id, state) {
    const bodyDialog = this._root.querySelector('#body-dialog');
    const modal = this._root.querySelector('.modal');
    const shouldShow = typeof state === 'undefined' ? !bodyDialog.className : state;
    bodyDialog.className = shouldShow ? 'active' : '';
    if (shouldShow) {
      const nameElement = document.createElement('h3');
      nameElement.innerText = name;
      modal.appendChild(nameElement);
      this.es = new EventSource(`http://localhost:3000/stream/station?id=${id}`);
      this.es.addEventListener('data', ({ data: vehicles }) => {
        modal.innerHTML = '';
        modal.appendChild(nameElement);
        Object.values(JSON.parse(vehicles))
          .sort((a, b) => a.time - b.time)
          .forEach(({ route, time }) => {
            const div = document.createElement('div');
            const routeElement = document.createElement('p');
            routeElement.innerText = `${route || '?'}`;
            const dots = document.createElement('span');
            dots.className = 'dots';
            const timeElement = document.createElement('p');
            timeElement.innerText = `${time || '?'} min(s)`;
            div.appendChild(routeElement);
            div.appendChild(dots);
            div.appendChild(timeElement);
            modal.appendChild(div);
          });
      });
    } else {
      if (this.es) this.es.close();
      modal.innerHTML = '';
    }
  }
}

customElements.define('my-statii', MyStatii);
export default MyStatii;
