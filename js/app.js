import { auth, db } from '/auth.js';
import { fetchWeatherByCity } from './weather.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ui = {
  cityInput: () => document.getElementById('cityInput'),
  searchBtn: () => document.getElementById('searchBtn'),
  weatherCard: () => document.getElementById('weatherCard'),
  forecastSection: () => document.getElementById('forecastSection'),
  forecastGrid: () => document.getElementById('forecastGrid'),
  place: () => document.getElementById('place'),
  temp: () => document.getElementById('temp'),
  desc: () => document.getElementById('desc'),
  details: () => document.getElementById('details'),
  loading: () => document.getElementById('loading'),
  weather: () => document.getElementById('weather')
};

let currentUnits = 'metric';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  return `${days[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

function toDisplayTemp(value) {
  if (value == null) return '—';
  return currentUnits === 'imperial' ? `${Math.round((value * 9) / 5 + 32)}°F` : `${Math.round(value)}°C`;
}

function toDisplayWind(value) {
  if (value == null) return '—';
  return currentUnits === 'imperial' ? `${Math.round(value * 0.621371)} mph` : `${Math.round(value)} km/h`;
}

function toDisplayPrecipitation(value) {
  if (value == null) return '0';
  return currentUnits === 'imperial' ? (value * 0.0393701).toFixed(1) : value.toFixed(1);
}

async function renderForecast(forecast) {
  const section = ui.forecastSection();
  const grid = ui.forecastGrid();

  if (!section || !grid) return;

  if (!forecast || forecast.length === 0) {
    section.style.display = 'none';
    return;
  }

  grid.innerHTML = '';
  forecast.forEach((day) => {
    const card = document.createElement('div');
    card.className = 'forecast-day';
    card.innerHTML = `
      <div class="forecast-date">${formatDate(day.date)}</div>
      <div class="forecast-desc">${day.description}</div>
      <div class="forecast-temps">
        <span class="temp-max">${toDisplayTemp(day.tempMax)}</span>
        <span class="temp-min">${toDisplayTemp(day.tempMin)}</span>
      </div>
      <div class="forecast-precip">🌧 ${toDisplayPrecipitation(day.precipitation)} ${currentUnits === 'imperial' ? 'in' : 'mm'}</div>
    `;
    grid.appendChild(card);
  });

  section.style.display = 'block';
}

async function renderWeather(data) {
  if (ui.loading()) ui.loading().style.display = 'none';
  if (ui.weather()) ui.weather().style.display = 'block';

  if (ui.place()) ui.place().textContent = `${data.name || ''}${data.country ? `, ${data.country}` : ''}`;
  if (ui.temp()) ui.temp().textContent = toDisplayTemp(data.temp);
  if (ui.desc()) ui.desc().textContent = data.description || '';
  if (ui.details()) {
    ui.details().textContent = `Umidità ${data.humidity ?? '—'}% • Vento ${toDisplayWind(data.wind_speed)}`;
  }

  if (data.forecast) {
    await renderForecast(data.forecast);
  }
}

async function loadPrefsAndWeather(user) {
  try {
    const prefsRef = doc(db, 'users', user.uid);
    const snap = await getDoc(prefsRef);
    if (!snap.exists()) return;

    const data = snap.data();
    currentUnits = data.prefUnits || 'metric';

    if (data.prefCity) {
      if (ui.cityInput()) ui.cityInput().value = data.prefCity;
      const weather = await fetchWeatherByCity(data.prefCity, currentUnits);
      await renderWeather(weather);
    }
  } catch (err) {
    console.error(err);
  }
}

function hookUI() {
  const profileBtn = document.getElementById('profileBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  if (profileBtn) profileBtn.onclick = () => window.location.href = '/pages/profile.html';
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      if (confirm('Vuoi uscire?')) {
        await signOut(auth);
        window.location.href = '/pages/login.html';
      }
    };
  }

  ui.searchBtn()?.addEventListener('click', async () => {
    const city = ui.cityInput()?.value.trim();
    if (!city) return alert('Inserisci una città');

    if (ui.loading()) ui.loading().style.display = 'block';
    try {
      const data = await fetchWeatherByCity(city, currentUnits);
      await renderWeather(data);
    } catch (err) {
      alert(err.message);
      if (ui.loading()) ui.loading().style.display = 'none';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  hookUI();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await loadPrefsAndWeather(user);
    } else if (!window.location.pathname.includes('/pages/login.html')) {
      window.location.href = '/pages/login.html';
    }
  });
});

export async function saveUserPrefs(userId, prefs) {
  try {
    await setDoc(doc(db, 'users', userId), prefs, { merge: true });
    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function loadUserPrefs(userId) {
  const prefsRef = doc(db, 'users', userId);
  const snap = await getDoc(prefsRef);
  return snap.exists() ? snap.data() : null;
}
