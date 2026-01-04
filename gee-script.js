// ------------------------------
// Kolleru Lake Bounding Box
// ------------------------------
var kolleru = ee.Geometry.Rectangle([80.0682, 16.5528, 81.4076, 16.7956]);

Map.centerObject(kolleru, 10);

// ------------------------------
// Cloud masking for Landsat 8 C2 SR
// ------------------------------
function maskL8sr(image) {
  var qa = image.select('QA_PIXEL');
  var cloudShadowBitMask = 1 << 3;
  var cloudsBitMask = 1 << 5;
  var mask = qa.bitwiseAnd(cloudShadowBitMask).eq(0)
                .and(qa.bitwiseAnd(cloudsBitMask).eq(0));
  return image.updateMask(mask)
              .select(['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'])
              .multiply(0.0000275).add(-0.2); // scale factor
}

// ------------------------------
// Cloud masking for Sentinel-2 SR
// ------------------------------
function maskS2(image) {
  var qa = image.select('QA60');
  var cloudBitMask = (1 << 10);
  var cirrusBitMask = (1 << 11);
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
                .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000)
              .select(['B2','B3','B4','B8','B11','B12']);
}

// ------------------------------
// Load Baseline (2019–2020) Landsat 8 C2 SR
// ------------------------------
var l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
            .filterBounds(kolleru)
            .filterDate('2019-01-01', '2020-12-31')
            .map(maskL8sr);

var baseline = l8.median();

// ------------------------------
// Load Recent (2023–2024) Sentinel-2 SR
// ------------------------------
var s2 = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterBounds(kolleru)
            .filterDate('2023-01-01', '2024-12-31')
            .map(maskS2);

var recent = s2.median();

// ------------------------------
// NDWI Calculation
// ------------------------------
// Landsat 8: Green (SR_B3), NIR (SR_B5)
var ndwi_baseline = baseline.normalizedDifference(['SR_B3','SR_B5']).rename('NDWI');

// Sentinel-2: Green (B3), NIR (B8)
var ndwi_recent = recent.normalizedDifference(['B3','B8']).rename('NDWI');

// ------------------------------
// Visualization
// ------------------------------
var rgbVisL8 = {bands: ['SR_B4','SR_B3','SR_B2'], min: 0, max: 0.3};
var rgbVisS2 = {bands: ['B4','B3','B2'], min: 0, max: 0.3};
var ndwiVis = {min: -1, max: 1, palette: ['brown','white','blue']};

Map.addLayer(baseline, rgbVisL8, "Baseline (2019–2020) RGB");
Map.addLayer(ndwi_baseline, ndwiVis, "Baseline NDWI");
Map.addLayer(recent, rgbVisS2, "Recent (2023–2024) RGB");
Map.addLayer(ndwi_recent, ndwiVis, "Recent NDWI");

// ------------------------------
// Export as GeoTIFF
// ------------------------------
Export.image.toDrive({
  image: ndwi_baseline,
  description: 'Kolleru_NDWI_Baseline_2019_2020',
  region: kolleru,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ndwi_recent,
  description: 'Kolleru_NDWI_Recent_2023_2024',
  region: kolleru,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// Baseline RGB
Export.image.toDrive({
  image: baseline.select(['SR_B4','SR_B3','SR_B2']),
  description: 'Kolleru_RGB_Baseline',
  region: kolleru,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});

// Recent RGB
Export.image.toDrive({
  image: recent.select(['B4','B3','B2']),
  description: 'Kolleru_RGB_Recent',
  region: kolleru,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e13
});
