import { auth, db } from '/auth.js';
import { fetchWeatherByCity, fetchWeatherByCoords } from './weather.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const ui = {
  cityInput: () => document.getElementById('cityInput'),
  searchBtn: () => document.getElementById('searchBtn'),
  geoBtn: () => document.getElementById('geoBtn'),
  weatherCard: () => document.getElementById('weatherCard'),
  forecastSection: () => document.getElementById('forecastSection'),
  forecastGrid: () => document.getElementById('forecastGrid'),
  place: () => document.getElementById('place'),
  temp: () => document.getElementById('temp'),
  desc: () => document.getElementById('desc'),
  details: () => document.getElementById('details'),
  loading: () => document.getElementById('loading')
};

let currentUnits = 'metric';

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  return `${days[date.getUTCDay()]} ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

async function renderForecast(forecast) {
  const section = ui.forecastSection();
  const grid = ui.forecastGrid();
  
  if (!forecast || forecast.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  grid.innerHTML = '';
  forecast.forEach(day => {
    const card = document.createElement('div');
    card.className = 'forecast-day';
    card.innerHTML = `
      <div class="forecast-date">${formatDate(day.date)}</div>
      <div class="forecast-desc">${day.description}</div>
      <div class="forecast-temps">
        <span class="temp-max">${Math.round(day.tempMax)}°</span>
        <span class="temp-min">${Math.round(day.tempMin)}°</span>
      </div>
      <div class="forecast-precip">🌧 ${(day.precipitation || 0).toFixed(1)}mm</div>
    `;
    grid.appendChild(card);
  });
  
  section.style.display = 'block';
}

async function renderWeather(data){
  ui.loading().style.display = 'none';
  const w = ui.weatherCard();
  ui.place().textContent = `${data.name || ''}${data.country?(', ' + data.country):''}`;
  ui.temp().textContent = `${Math.round(data.temp)}° ${currentUnits==='metric'?'C':'F'}`;
  ui.desc().textContent = data.description || '';
  ui.details().textContent = `Umidità ${data.humidity ?? '—'}% • Vento ${data.wind_speed ?? '—'} m/s`;
  ui.weatherCard().querySelector('#weather').style.display = 'block';
  
  // render forecast if available
  if (data.forecast) {
    await renderForecast(data.forecast);
  }
}

async function loadPrefsAndWeather(user){
  try{
    const prefsRef = doc(db, 'users', user.uid);
    const snap = await getDoc(prefsRef);
    if (snap.exists()){
      const data = snap.data();
      if (data.prefCity){
        ui.cityInput().value = data.prefCity;
        currentUnits = data.prefUnits || 'metric';
        const weather = await fetchWeatherByCity(data.prefCity, currentUnits);
        await renderWeather(weather);
      }
    }
  }catch(err){
    console.error(err);
  }
}

function hookUI(){
  const profileBtn = document.getElementById('profileBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (profileBtn) profileBtn.onclick = () => window.location.href = '/pages/profile.html';
  if (logoutBtn) logoutBtn.onclick = async () => { if(confirm('Vuoi uscire?')){ await signOut(auth); window.location.href='/pages/login.html'; }};

  ui.searchBtn()?.addEventListener('click', async ()=>{
    const city = ui.cityInput().value.trim();
    if (!city) return alert('Inserisci una città');
    ui.loading().style.display = 'block';
    try{
      const data = await fetchWeatherByCity(city, currentUnits);
      await renderWeather(data);
    }catch(e){ alert(e.message); ui.loading().style.display = 'none'; }
  });

  ui.geoBtn()?.addEventListener('click', ()=>{
    if (!navigator.geolocation) return alert('Geolocalizzazione non supportata');
    ui.loading().style.display = 'block';
    navigator.geolocation.getCurrentPosition(async pos =>{
      try{
        const data = await fetchWeatherByCoords(pos.coords.latitude,pos.coords.longitude,currentUnits);
        await renderWeather(data);
      }catch(e){ alert(e.message); ui.loading().style.display = 'none'; }
    }, err => { alert('Permesso geolocalizzazione negato'); ui.loading().style.display = 'none'; });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  hookUI();
  // wait for firebase auth state
  onAuthStateChanged(auth, async user => {
    if (user) {
      await loadPrefsAndWeather(user);
    } else {
      if (!window.location.pathname.includes('/pages/login.html')) window.location.href = '/pages/login.html';
    }
  });
});

// Expose helpers for profile page
export async function saveUserPrefs(userId, prefs){
  try{
    await setDoc(doc(db,'users',userId), prefs, {merge:true});
    return true;
  }catch(e){console.error(e);throw e}
}

export async function loadUserPrefs(userId){
  const prefsRef = doc(db,'users',userId);
  const snap = await getDoc(prefsRef);
  return snap.exists()?snap.data():null;
}
