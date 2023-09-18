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
import { bbox as bboxStrategy, tile as tileStrategy } from 'ol/loadingstrategy';
import VectorLayer from 'ol/layer/Vector';
import { Stroke, Style, Fill } from 'ol/style';
import materiaux_mur from './dmatgm.json';
import materiaux_toit from './dmatto.json';

// Infobulle
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var closer = document.getElementById('popup-closer');
const toPrint = ["altitude_maximale_sol", "altitude_maximale_toit",
  "altitude_minimale_sol", "altitude_minimale_toit",
  "construction_legere", "date_d_apparition", "etat_de_l_objet",
  "hauteur", "materiaux_de_la_toiture", "materiaux_des_murs",
  "nature", "nombre_d_etages", "nombre_de_logements", "usage_1", "usage_2"
]

var overlay = new Overlay({
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
var resolutions = [];
var matrixIds = [];
var proj3857 = getProjection('EPSG:3857');
var maxResolution = getWidth(proj3857.getExtent()) / 256;

for (var i = 0; i < 19; i++) {
  matrixIds[i] = i.toString();
  resolutions[i] = maxResolution / Math.pow(2, i);
};

var tileGrid = new WMTSTileGrid({
  origin: [-20037508, 20037508],
  resolutions: resolutions,
  matrixIds: matrixIds,
});

// Objets WFS Batiments
var vectorSource = new VectorSource({
  format: new GeoJSON(),
  url: function (extent) {
    return (
      'https://wxs.ign.fr/essentiels/geoportail/wfs?service=WFS&' +
      'version=1.1.0&request=GetFeature&typename=BDTOPO_V3:batiment&' +
      'outputFormat=application/json&srsname=EPSG:3857&' +
      'bbox=' +
      extent.join(',') +
      ',EPSG:3857'
    );
  },
  strategy: tileStrategy(tileGrid),
});

var wfs = new VectorLayer({
  source: vectorSource,
  style: new Style({
    stroke: new Stroke({
      color: 'rgba(0, 0, 255, 1.0)',
      width: 2,
    }),
    fill: new Fill({
      color: 'rgba(0, 0, 255, 0.2)'
    }),
  }),
});

// Couche WMTS PLAN IGN v2
var rasterSource = new WMTS({
  url: 'https://wxs.ign.fr/essentiels/geoportail/wmts',
  //layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2',
  //format: 'image/png'
  layer: 'ORTHOIMAGERY.ORTHOPHOTOS',
  format: 'image/jpeg',
  matrixSet: 'PM',
  projection: 'EPSG:3857',
  tileGrid: tileGrid,
  style: 'normal',
  attributions:
    '<a href="http://www.ign.fr" target="_blank">' +
    '<img src="https://wxs.ign.fr/static/logos/IGN/IGN.gif" title="Institut national de l\'' +
    'information géographique et forestière" alt="IGN"></a>',
});

var wmts = new TileLayer({
  source: rasterSource,
});

// Map OpenLayers
var map = new Map({
  layers: [wmts, wfs],
  overlays: [overlay],
  target: document.getElementById('map'),
  view: new View({
    center: fromLonLat([3.280578, 47.368489]),
    minZoom: 16,
    maxZoom: 20,
    zoom: 19,
  }),
});

// Ouverture infobulle
map.on('singleclick', function (evt) {
  var coordinate = evt.coordinate;
  var feature = map.forEachFeatureAtPixel(evt.pixel,
    function (feature, layer) {
      return feature;
    });
  if (feature) {
    var props = feature.getProperties();
    var id = feature.getId().replace("batiment.", "");
    var liste = "<center><b>" + id + "</b></center>"
    liste += "<ul>";
    for (const p in props) {
      if (props[p] != null && props[p] != "" && toPrint.includes(p)) {
        var value = props[p]
        if (p == "materiaux_des_murs") value = materiaux_mur[props[p]];
        if (p == "materiaux_de_la_toiture") value = materiaux_toit[props[p]];
        if (value == "INDETERMINE" || value == false) continue;
        liste += "<li><b>" + p + "</b> : " + value + "</li>";
      }
    }
    liste += "</ul>";
    content.innerHTML = liste;
    overlay.setPosition(coordinate);
  }
});
