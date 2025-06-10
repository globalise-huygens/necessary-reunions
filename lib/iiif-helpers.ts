export function getLocalizedValue(languageMap: any, preferredLanguage = 'en') {
  if (!languageMap) return null;

  if (typeof languageMap === 'string') return languageMap;

  if (Array.isArray(languageMap)) return languageMap.join(', ');

  if (languageMap[preferredLanguage]) {
    return Array.isArray(languageMap[preferredLanguage])
      ? languageMap[preferredLanguage].join(', ')
      : languageMap[preferredLanguage];
  }

  const firstLang = Object.keys(languageMap)[0];
  if (firstLang) {
    return Array.isArray(languageMap[firstLang])
      ? languageMap[firstLang].join(', ')
      : languageMap[firstLang];
  }

  return null;
}

export function extractGeoData(canvas: any) {
  if (!canvas) return null;

  const geoData = {
    coordinates: null,
    projection: null,
    boundingBox: null,
  };

  if (canvas.annotations) {
    for (const annoPage of canvas.annotations) {
      if (annoPage.items) {
        for (const anno of annoPage.items) {
          if (
            anno.motivation === 'georeferencing' ||
            (anno.body && anno.body.type === 'GeoJSON') ||
            (anno.target &&
              anno.target.selector &&
              anno.target.selector.type === 'GeoJSON')
          ) {
            if (anno.body && anno.body.value) {
              try {
                const geoJson =
                  typeof anno.body.value === 'string'
                    ? JSON.parse(anno.body.value)
                    : anno.body.value;

                if (geoJson.coordinates) {
                  geoData.coordinates = geoJson.coordinates;
                }
                if (geoJson.properties && geoJson.properties.projection) {
                  geoData.projection = geoJson.properties.projection;
                }
                if (geoJson.bbox) {
                  geoData.boundingBox = geoJson.bbox;
                }
              } catch (e) {}
            }

            if (anno.body && anno.body.projection) {
              geoData.projection = anno.body.projection;
            }
          }
        }
      }
    }
  }

  return geoData.coordinates || geoData.projection || geoData.boundingBox
    ? geoData
    : null;
}

export function extractAnnotations(canvas: any) {
  if (!canvas || !canvas.annotations) return [];

  const result = [];

  for (const annoPage of canvas.annotations) {
    if (annoPage.items) {
      for (const anno of annoPage.items) {
        if (!anno.motivation || !anno.body) continue;

        if (anno.body.service && anno.motivation === 'painting') continue;

        result.push({
          id: anno.id || anno['@id'],
          motivation: Array.isArray(anno.motivation)
            ? anno.motivation
            : [anno.motivation],
          label: anno.label ? getLocalizedValue(anno.label) : null,
          body: anno.body,
          target: anno.target,
          created: anno.created,
          creator: anno.creator
            ? anno.creator.name ||
              (anno.creator.label && getLocalizedValue(anno.creator.label)) ||
              anno.creator.id ||
              anno.creator['@id']
            : null,
        });
      }
    }
  }

  return result;
}
