// Uses Open-Meteo (free, no API key)
// Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=...
// Weather: https://api.open-meteo.com/v1/forecast?latitude=...&longitude=...&current_weather=true&hourly=relativehumidity_2m&timezone=auto

async function geocode(city) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding fallito');

  const js = await res.json();
  if (!js.results || js.results.length === 0) throw new Error('Località non trovata');
  return js.results[0];
}

function weatherCodeToDesc(code) {
  const map = {
    0: 'Sereno',
    1: 'Parzialmente nuvoloso',
    2: 'Parzialmente nuvoloso',
    3: 'Coperto',
    45: 'Nebbia',
    48: 'Nebbia gelata',
    51: 'Pioggia leggera',
    53: 'Pioggia moderata',
    55: 'Pioggia forte',
    61: 'Pioggia',
    63: 'Pioggia moderata',
    65: 'Pioggia intensa',
    71: 'Neve leggera',
    73: 'Neve',
    75: 'Neve intensa',
    80: 'Pioggia a rovesci',
    81: 'Pioggia a rovesci',
    82: 'Forti rovesci'
  };

  return map[code] || 'Condizioni variabili';
}

export async function fetchWeatherByCity(city, units = 'metric') {
  const place = await geocode(city);
  return await fetchWeatherByCoords(place.latitude, place.longitude, units, place);
}

export async function fetchWeatherByCoords(lat, lon, units = 'metric', placeInfo = null) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Meteo non trovato');

  const js = await res.json();
  const cw = js.current_weather || {};

  let humidity = null;
  try {
    if (js.hourly && js.hourly.time && js.hourly.relativehumidity_2m) {
      const times = js.hourly.time;
      const now = new Date();
      let idx = times.findIndex((t) => t.startsWith(now.toISOString().slice(0, 13)));
      if (idx === -1) idx = 0;
      humidity = js.hourly.relativehumidity_2m[idx];
    }
  } catch (err) {
    // Ignore humidity parsing issues.
  }

  const forecast = [];
  try {
    if (js.daily && js.daily.time) {
      const times = js.daily.time;
      const codes = js.daily.weathercode || [];
      const tmax = js.daily.temperature_2m_max || [];
      const tmin = js.daily.temperature_2m_min || [];
      const precip = js.daily.precipitation_sum || [];

      for (let index = 1; index < Math.min(6, times.length); index += 1) {
        forecast.push({
          date: times[index],
          code: codes[index],
          tempMax: tmax[index],
          tempMin: tmin[index],
          precipitation: precip[index],
          description: weatherCodeToDesc(codes[index])
        });
      }
    }
  } catch (err) {
    // Ignore forecast parsing issues.
  }

  return {
    name: placeInfo?.name || '',
    country: placeInfo?.country || '',
    temp: cw.temperature,
    wind_speed: cw.windspeed,
    weathercode: cw.weathercode,
    humidity,
    description: weatherCodeToDesc(cw.weathercode),
    forecast
  };
}
