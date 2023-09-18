import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import Overlay from 'ol/Overlay';
import WMTS from 'ol/source/WMTS';
import { fromLonLat, get as getProjection } from 'ol/proj';
import WMTSTileGrid from 'ol/tilegrid/WMTS';
import { getWidth } from 'ol/extent';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { tile as tileStrategy } from 'ol/loadingstrategy';
import VectorLayer from 'ol/layer/Vector';
import { Stroke, Style, Fill } from 'ol/style';
import materiaux_mur from './dmatgm.json';
import materiaux_toit from './dmatto.json';
import { Services, olExtended } from 'geoportal-extensions-openlayers';

function createMap() {
  // Infobulle
  const container = document.getElementById('popup');
  const content = document.getElementById('popup-content');
  const closer = document.getElementById('popup-closer');
  const toPrint = [
    'altitude_maximale_sol', 'altitude_maximale_toit',
    'altitude_minimale_sol', 'altitude_minimale_toit',
    'construction_legere', 'date_d_apparition', 'etat_de_l_objet',
    'hauteur', 'materiaux_de_la_toiture', 'materiaux_des_murs',
    'nature', 'nombre_d_etages', 'nombre_de_logements', 'usage_1', 'usage_2',
  ];

  const overlay = new Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: {
      duration: 250,
    },
  });

  closer.onclick = function () {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
  };

  // Définition de la pyramide de résolution Géoportail
  const resolutions = [];
  const matrixIds = [];
  const proj3857 = getProjection('EPSG:3857');
  const maxResolution = getWidth(proj3857.getExtent()) / 256;

  for (let i = 0; i < 19; i++) {
    matrixIds[i] = i.toString();
    resolutions[i] = maxResolution / Math.pow(2, i);
  }

  const tileGrid = new WMTSTileGrid({
    origin: [ -20037508, 20037508 ],
    resolutions: resolutions,
    matrixIds: matrixIds,
  });

  // Objets WFS Batiments
  const vectorSource = new VectorSource({
    format: new GeoJSON(),
    url: function (extent) {
      return (
        'https://wxs.ign.fr/essentiels/geoportail/wfs?service=WFS&' +
        'version=1.1.0&request=GetFeature&typename=BDTOPO_V3:batiment&' +
        'outputFormat=application/json&srsname=EPSG:3857&' +
        'bbox=' + extent.join(',') + ',EPSG:3857'
      );
    },
    strategy: tileStrategy(tileGrid),
  });

  const wfs = new VectorLayer({
    source: vectorSource,
    style: new Style({
      stroke: new Stroke({
        color: 'rgba(0, 0, 255, 1.0)',
        width: 2,
      }),
      fill: new Fill({
        color: 'rgba(0, 0, 255, 0.2)',
      }),
    }),
    minZoom: 16,
  });

  // Couche WMTS PLAN IGN v2
  const rasterSource1 = new WMTS({
    url: 'https://wxs.ign.fr/essentiels/geoportail/wmts',
    layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
    format: 'image/png',
    matrixSet: 'PM',
    projection: 'EPSG:3857',
    tileGrid: tileGrid,
    style: 'normal',
    attributions:
      '<a href="https://www.ign.fr" target="_blank">' +
      '<img src="https://wxs.ign.fr/static/logos/IGN/IGN.gif" title="Institut national de l\'' +
      'information géographique et forestière" alt="IGN"></a>',
  });

  const wmts1 = new TileLayer({
    source: rasterSource1,
    maxZoom: 16,
  });

  // Couche WMTS ORTHO PHOTO
  const rasterSource2 = new WMTS({
    url: 'https://wxs.ign.fr/essentiels/geoportail/wmts',
    layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
    format: 'image/jpeg',
    matrixSet: 'PM',
    projection: 'EPSG:3857',
    tileGrid: tileGrid,
    style: 'normal',
    attributions:
      '<a href="https://www.ign.fr" target="_blank">' +
      '<img src="https://wxs.ign.fr/static/logos/IGN/IGN.gif" title="Institut national de l\'' +
      'information géographique et forestière" alt="IGN"></a>',
  });

  const wmts2 = new TileLayer({
    source: rasterSource2,
    minZoom: 16,
  });

  // Map OpenLayers
  const map = new Map({
    layers: [ wmts1, wmts2, wfs ],
    overlays: [ overlay ],
    target: document.getElementById('map'),
    view: new View({
      center: fromLonLat([ 3.280578, 47.368489 ]),
      maxZoom: 20,
      zoom: 19,
    }),
  });

  const search = new olExtended.control.SearchEngine({
    collapsed: false,
    displayAdvancedSearch: false
  });
  map.addControl(search);

  // Ouverture infobulle
  map.on('singleclick', function (evt) {
    const coordinate = evt.coordinate;
    const feature = map.forEachFeatureAtPixel(evt.pixel,
      function (feature) {
        return feature;
      });
    if (feature) {
      const props = feature.getProperties();
      const id = feature.getId().replace('batiment.', '');
      let liste = '<center><b>' + id + '</b></center>';
      liste += '<ul>';
      for (const p in props) {
        if (props[p] && toPrint.includes(p)) {
          let value = props[p];
          if (p === 'materiaux_des_murs') value = materiaux_mur[props[p]];
          if (p === 'materiaux_de_la_toiture') value = materiaux_toit[props[p]];
          if (value === 'INDETERMINE' || value === false) continue;
          liste += '<li><b>' + p + '</b> : ' + value + '</li>';
        }
      }
      liste += '</ul>';
      content.innerHTML = liste;
      overlay.setPosition(coordinate);
    }
  });
}

Services.getConfig({
  apiKey : 'essentiels',
  timeOut : 20000,
  onSuccess : createMap,
  serverUrl: 'autoconf-https.json',
  callbackSuffix : '',
});
