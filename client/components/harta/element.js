import BaseElement from '../base.js';

class MyHarta extends BaseElement {
  constructor() {
    super('/components/harta/template.html', '/components/harta/styles.css');
  }

  connectedCallback() {
    super.connectedCallback();
    this.renderMap();
  }

  async renderMap() {
    await this.readyPromise;
    const mapElement = this._root.querySelector('#map');
    const map = L.map(mapElement, {
      zoomSnap: 0,
      maxZoom: 22,
      zoomControl: false,
      renderer: L.canvas({
        padding: 0.5,
        tolerance: 10,
      }),
    }).fitWorld();
    map.setView(new L.LatLng(47.160381, 27.592186), 13);

    map.once('locationfound', function (e) {
      map.fitBounds(e.bounds, { maxZoom: 18 });
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.@2xpng', {
      maxNativeZoom: 18,
      maxZoom: map.getMaxZoom(),
      attribution:
        '© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, © <a href="https://carto.com/attribution">CARTO</a>',
    }).addTo(map);

    const locate = L.control
      .locate({
        icon: 'iconClass',
        setView: 'untilPan',
        cacheLocation: false,
        position: 'topleft',
        flyTo: false,
        keepCurrentZoomLevel: false,
        drawCircle: false,
        circleStyle: {
          interactive: false,
        },
        markerStyle: {
          interactive: false,
        },
        locateOptions: {
          enableHighAccuracy: true,
          maxZoom: 18,
        },
        onLocationError: function (e) {
          alert(e.message);
        },
      })
      .addTo(map);
    this._root.querySelector('.iconClass').innerText = '📌';
    locate.start();

    const stations = await fetch('http://localhost:3000/stations').then((res) => res.json());
    const stationsFeature = stations.map(({ geom: geometry, ...properties }) => ({
      type: 'Feature',
      properties,
      geometry,
    }));
    const stationsLayer = L.geoJson(stationsFeature, {
      pointToLayer: (feature, latlng) => {
        return L.circleMarker(latlng, {
          radius: 8,
          fillColor: '#2e7d32',
          color: '#000',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8,
        });
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties && feature.properties.name) {
          layer.bindPopup(feature.properties.name);
        }
      },
    });
    stationsLayer.addTo(map);

    let vehiclesLayer;
    const es = new EventSource('http://localhost:3000/stream/vehicles');
    es.addEventListener('data', ({ data: vehicles }) => {
      if (vehiclesLayer) {
        map.removeLayer(vehiclesLayer);
      }
      const vehicleFeature = Object.values(JSON.parse(vehicles)).map(({ lng, lat, route }) => ({
        type: 'Feature',
        properties: { route },
        geometry: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      }));
      vehiclesLayer = L.geoJson(vehicleFeature, {
        pointToLayer: (feature, latlng) => {
          const icon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style='background-color:#4838cc;' class='marker-pin'></div><span>${
              feature.properties.route || '?'
            }</span>`,
            iconSize: [30, 42],
            iconAnchor: [15, 42],
          });
          return L.marker(latlng, {
            icon: icon,
          });
        },
      });
      vehiclesLayer.addTo(map);
    });
  }
}

customElements.define('my-harta', MyHarta);
export default MyHarta;
