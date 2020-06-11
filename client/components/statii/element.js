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
    bodyDialog.addEventListener('click', (event) => {
      this.toggleStation(event.target.id);
    });
    data.forEach(({ name, id }) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = name;
      button.id = id;
      button.addEventListener('click', (event) => {
        this.toggleStation(event.target.id);
      });
      li.appendChild(button);
      stationsContainer.appendChild(li);
    });
  }

  filterStations() {
    console.log('filtering');
    const input = this._root.querySelector('#stations-search');
    const filter = input.value.toUpperCase();
    const ul = this._root.querySelector('#stations-container');
    const li = ul.getElementsByTagName('li');
    console.log(li);
    for (let i = 0; i < li.length; i++) {
      const button = li[i].getElementsByTagName('button')[0];
      const txtValue = button.textContent || button.innerText;
      console.log(txtValue);
      if (txtValue.toUpperCase().indexOf(filter) > -1) {
        li[i].style.display = '';
      } else {
        li[i].style.display = 'none';
      }
    }
  }

  toggleStation(id, state) {
    const bodyDialog = this._root.querySelector('#body-dialog');
    const modal = this._root.querySelector('.modal');
    const shouldShow = typeof state === 'undefined' ? !bodyDialog.className : state;
    bodyDialog.className = shouldShow ? 'active' : '';
    if (shouldShow) {
      this.es = new EventSource(`http://localhost:3000/stream/station?id=${id}`);
      this.es.addEventListener('data', ({ data: vehicles }) => {
        Object.values(JSON.parse(vehicles)).forEach(({ route, time }) => {
          const span = document.createElement('span');
          span.innerText = `${route || '?'} __________ ${time || '?'}`;
          modal.appendChild(span);
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
