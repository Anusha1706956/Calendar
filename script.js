
const SESS_KEY = 'stm_session_user';
const EVENTS_KEY = u => `stm_events_${u}`;
const NOTIFS_KEY = u => `stm_notifs_${u}`;

let currentUser = sessionStorage.getItem(SESS_KEY) || null;
let events = [];        
let notifs = [];        
let timersMap = {};     
let currentView = new Date();

const audio = document.getElementById('audioNotify');
const loginModal = document.getElementById('loginModal');
const eventModal = document.getElementById('eventModal');
const eventDetailModal = document.getElementById('eventDetailModal');
const popup = document.getElementById('popup');
const popupCard = document.getElementById('popupCard');

document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('logoutBtn').addEventListener('click', doLogout);
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', navClick));
document.getElementById('toggleNotifBar').addEventListener('click', toggleNotifBar);
document.getElementById('openAdd').addEventListener('click', openAddModal);
document.getElementById('saveEvent').addEventListener('click', onSaveEvent);
document.getElementById('cancelEvent').addEventListener('click', () => closeModal('eventModal'));
document.getElementById('closeDetailBtn').addEventListener('click', () => closeModal('eventDetailModal'));
document.getElementById('markDoneBtn').addEventListener('click', onMarkDone);
document.getElementById('clearAllNotifs').addEventListener('click', clearAllNotifs);
document.getElementById('closeNotifBar').addEventListener('click', () => document.getElementById('notificationBar').style.display='none');
document.getElementById('prevMonth').addEventListener('click', ()=> changeMonth(-1));
document.getElementById('nextMonth').addEventListener('click', ()=> changeMonth(1));
document.getElementById('openAdd').addEventListener('click', openAddModal);

if(currentUser){
  afterLogin();
} else {
  openModal('loginModal');
}
renderTodayInfo();


function doLogin(){
  const name = document.getElementById('loginName').value?.trim();
  if(!name) return alert('Please enter name');
  currentUser = name;
  sessionStorage.setItem(SESS_KEY, currentUser);

  if(!localStorage.getItem(EVENTS_KEY(currentUser))) localStorage.setItem(EVENTS_KEY(currentUser), JSON.stringify([]));
  if(!localStorage.getItem(NOTIFS_KEY(currentUser))) localStorage.setItem(NOTIFS_KEY(currentUser), JSON.stringify([]));
  closeModal('loginModal');
  afterLogin();
}

function afterLogin(){

  events = JSON.parse(localStorage.getItem(EVENTS_KEY(currentUser)) || '[]');
  notifs  = JSON.parse(localStorage.getItem(NOTIFS_KEY(currentUser)) || '[]');
  document.getElementById('userLabel').innerText = currentUser;
  document.getElementById('welcomeTitle').innerText = `Welcome, ${currentUser}`;

  renderStats();
  renderCalendar();
  renderNotifList();
  scheduleAllReminders();
}

function doLogout(){
  if(!confirm('Logout?')) return;
  for(const k in timersMap){
    (timersMap[k]||[]).forEach(id=>clearTimeout(id));
  }
  timersMap = {};
  sessionStorage.removeItem(SESS_KEY);
  currentUser = null;
  events = [];
  notifs = [];

  document.getElementById('dashboard').classList.add('active');
  document.getElementById('calendar').classList.remove('active');
  document.getElementById('notificationBar').style.display='none';
  openModal('loginModal');
}

function navClick(e){
  const page = e.currentTarget.dataset.page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById(page);
  if(el) el.classList.add('active');
}

function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }


function renderCalendar(){
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';
  const ym = new Date(currentView.getFullYear(), currentView.getMonth(), 1);
  const monthName = ym.toLocaleString(undefined,{month:'long', year:'numeric'});
  document.getElementById('calMonthYear').innerText = monthName;
  document.getElementById('calToday').innerText = new Date().toLocaleDateString();

  const firstDay = new Date(ym.getFullYear(), ym.getMonth(), 1).getDay(); // 0..6
  const daysInMonth = new Date(ym.getFullYear(), ym.getMonth()+1, 0).getDate();

  
  for(let i=0;i<firstDay;i++){
    const el = document.createElement('div'); el.className='day-card empty'; grid.appendChild(el);
  }

  for(let d=1; d<=daysInMonth; d++){
    const el = document.createElement('div'); el.className='day-card';
    el.innerHTML = `<div class="day-num">${d}</div>`;
    
    const dateKey = makeDateKey(ym.getFullYear(), ym.getMonth()+1, d);
    const dayEvents = events.filter(ev => ev.date === dateKey);
    dayEvents.forEach(ev=>{
      const evWrap = document.createElement('div'); evWrap.className='event-item';
      const emoji = categoryEmoji(ev.category);
      evWrap.innerHTML = `<div class="event-emoji">${emoji}</div><div class="event-title">${shortText(ev.title,20)}</div>`;
      el.appendChild(evWrap);
    });
    el.addEventListener('click', ()=> onDayClick(ym.getFullYear(), ym.getMonth()+1, d));
    grid.appendChild(el);
  }

  renderStats();
}


function makeDateKey(y,m,d){
  m = String(m).padStart(2,'0'); d = String(d).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function categoryEmoji(cat){
  if(cat==='birthday') return '🎂';
  if(cat==='marriage') return '💍';
  if(cat==='work') return '📂';
  return '🔔';
}
function shortText(s,len){ return s.length>len ? s.slice(0,len-1)+'…' : s; }

function onDayClick(y,m,d){

  const dateKey = makeDateKey(y,m,d);
  const dayEvents = events.filter(ev=>ev.date===dateKey);
  
  const title = dayEvents.length ? `Events on ${dateKey}` : `No events on ${dateKey}`;
  document.getElementById('detailTitle').innerText = title;
  const when = dayEvents.length ? dayEvents.map(e=>`${e.time} • ${e.title}`).join('\n') : 'Click Add to create one';
  document.getElementById('detailWhen').innerText = when;
  
  if(dayEvents.length) {
    const ev = dayEvents[0];
    document.getElementById('markDoneBtn').dataset.evId = ev.id;
    document.getElementById('detailPerson').innerText = ev.person ? `Person: ${ev.person}` : '';
    document.getElementById('detailCategory').innerText = `Category: ${ev.category}`;
  } else {
    document.getElementById('markDoneBtn').dataset.evId = '';
    document.getElementById('detailPerson').innerText = '';
    document.getElementById('detailCategory').innerText = '';
  }
  openModal('eventDetailModal');
}


function openAddModal(){
  const today = new Date();
  document.getElementById('evTitle').value = '';
  document.getElementById('evPerson').value = '';
  document.getElementById('evDate').value = today.toISOString().slice(0,10);
  // set time to next hour rounded
  const nextH = new Date(Math.ceil((Date.now()+15*60*1000)/(60*60*1000))*(60*60*1000));
  document.getElementById('evTime').value = nextH.toISOString().slice(11,16);
  document.getElementById('evCategory').value = 'birthday';
  openModal('eventModal');
}


function onSaveEvent(){
  const title = document.getElementById('evTitle').value.trim();
  const person = document.getElementById('evPerson').value.trim();
  const date = document.getElementById('evDate').value;
  const time = document.getElementById('evTime').value;
  const category = document.getElementById('evCategory').value;
  if(!title || !date || !time) return alert('Fill title, date and time');

  const id = 'ev_' + Date.now() + '_' + Math.floor(Math.random()*999);
  const dtISO = date + 'T' + time + ':00';
  const ev = { id, title, person, date, time, datetime: dtISO, category, createdAt: new Date().toISOString(), completed:false };
  events.push(ev);
  saveEvents();
  scheduleRemindersForEvent(ev);
  renderCalendar();
  closeModal('eventModal');
  addNotif(`${categoryEmoji(category)} ${title} added for ${date} ${time}`, categoryEmoji(category));
}

/* Save events to localStorage */
function saveEvents(){
  if(!currentUser) return;
  localStorage.setItem(EVENTS_KEY(currentUser), JSON.stringify(events));
}

/* ---------- Notifications ---------- */

function loadNotifs(){
  if(!currentUser) return;
  notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY(currentUser)) || '[]');
}
function saveNotifs(){
  if(!currentUser) return;
  localStorage.setItem(NOTIFS_KEY(currentUser), JSON.stringify(notifs));
}
function addNotif(message, emoji='🔔', type='reminder', eventId=null){
  const n = { id:'n_'+Date.now()+'_'+Math.floor(Math.random()*999), message, emoji, time:new Date().toISOString(), type, eventId };
  notifs.unshift(n); // newest first
  saveNotifs();
  renderNotifList();
  // show popup + sound + browser notif
  showPopup(`${emoji} ${message}`);
  tryPlaySound();
  if(Notification.permission==='granted'){
    new Notification('Planner', { body: message, tag: n.id });
  }
}

/* Render notification bar list */
function renderNotifList(){
  loadNotifs();
  document.getElementById('notifList').innerHTML = '';
  document.getElementById('statNotifs').innerText = notifs.length || 0;
  notifs.forEach(n => {
    const div = document.createElement('div'); div.className='notif-item';
    div.innerHTML = `<div class="notif-left"><div class="notif-emoji">${n.emoji}</div><div class="notif-msg">${n.message}</div></div>
                     <div><button class="btn small" onclick="removeNotif('${n.id}')">✖</button></div>`;
    document.getElementById('notifList').appendChild(div);
  });
}

/* Remove single notification */
function removeNotif(id){
  notifs = notifs.filter(n=>n.id!==id);
  saveNotifs(); renderNotifList();
}
function clearAllNotifs(){
  if(!confirm('Clear all notifications history?')) return;
  notifs = []; saveNotifs(); renderNotifList();
}

/* Toggle notification bar (right panel) */
function toggleNotifBar(){
  const bar = document.getElementById('notificationBar');
  bar.style.display = (bar.style.display==='block' ? 'none' : 'block');
}

/* Show small popup near bottom-right */
let popupTimeout = null;
function showPopup(html){
  popupCard.innerHTML = html;
  popupCard.style.display = 'flex';
  if(popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(()=> popupCard.style.display='none', 5000);
}

/* Sound */
function tryPlaySound(){
  if(audio) {
    audio.currentTime = 0;
    audio.play().catch(()=>{/* autoplay blocked possibly */});
  }
}

/* ---------- Reminder scheduling ---------- */

/* Cancel timers for an event */
function cancelTimersForEvent(eventId){
  if(timersMap[eventId]){
    timersMap[eventId].forEach(id=>clearTimeout(id));
    delete timersMap[eventId];
  }
}

/* Schedule reminders for a given event:
   offsets: 60min, 30min, 0min before event
   also schedule missed-check at eventTime + 24h
*/
function scheduleRemindersForEvent(ev){
  if(!ev || !ev.datetime) return;
  cancelTimersForEvent(ev.id);
  const eventTime = new Date(ev.datetime).getTime();
  const now = Date.now();
  const offsets = [60*60*1000, 30*60*1000, 0]; // ms
  timersMap[ev.id] = [];

  offsets.forEach((offset, idx)=>{
    const t = eventTime - offset;
    if(t > now){
      const delay = t - now;
      const tid = setTimeout(()=>{
        // If already completed, skip
        const fresh = events.find(e=>e.id===ev.id);
        if(!fresh || fresh.completed) return;
        // prepare message
        const emoji = categoryEmoji(ev.category);
        let msg = '';
        if(offset===0){
          if(ev.category==='birthday') msg = `🎂 Today is ${ev.person || ev.title}'s birthday — wish them!`;
          else if(ev.category==='marriage') msg = `💍 ${ev.person || ev.title}'s marriage is now — celebrate!`;
          else msg = `${emoji} ${ev.title} is happening now`;
        } else {
          // offsets before: show as "in 1 hour / 30 minutes"
          const label = offset===60*60*1000 ? '1 hour before' : '30 minutes before';
          msg = `${emoji} Reminder (${label}): ${ev.title}${ev.person ? ' — ' + ev.person : ''}`;
        }
        addNotif(msg, emoji, 'reminder', ev.id);
      }, delay);
      timersMap[ev.id].push(tid);
    }
  });

  // missed check after 24 hours
  const missedAt = eventTime + 24*60*60*1000;
  if(missedAt > now){
    const tidMiss = setTimeout(()=>{
      const fresh = events.find(e=>e.id===ev.id);
      if(fresh && !fresh.completed){
        const emoji = categoryEmoji(ev.category);
        addNotif(`⚠️ You missed: ${ev.title}${ev.person ? ' ('+ev.person+')' : ''}`, '⚠️', 'missed', ev.id);
      }
    }, missedAt - now);
    timersMap[ev.id].push(tidMiss);
  }

  // persist timers info not needed (we reconstruct on load)
}

/* Schedule reminders for all events (on load) */
function scheduleAllReminders(){
  // clear existing timers
  for(const k in timersMap) (timersMap[k]||[]).forEach(id=>clearTimeout(id));
  timersMap = {};
  // schedule for each event
  events.forEach(ev => {
    if(!ev.completed) scheduleRemindersForEvent(ev);
  });
}

/* Mark event done */
function onMarkDone(){
  const evId = document.getElementById('markDoneBtn').dataset.evId;
  if(!evId) return;
  const ev = events.find(e=>e.id===evId);
  if(!ev) return;
  ev.completed = true;
  saveEvents();
  cancelTimersForEvent(evId);
  addNotif(`✅ Completed: ${ev.title}`, '✅', 'completed', evId);
  closeModal('eventDetailModal');
  // motivational popup
  showPopup('✅ Great job! Keep the streak going 🚀');
  renderCalendar();
}

/* When user clicks 'Mark Done' from detail modal, we call onMarkDone via button handler bound earlier. */

/* When day clicked 'Mark Done' button has ev id set, earlier in onDayClick set dataset. */

/* ---------- Persistence & load ---------- */

function loadEventsAndNotifs(){
  if(!currentUser) return;
  events = JSON.parse(localStorage.getItem(EVENTS_KEY(currentUser)) || '[]');
  notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY(currentUser)) || '[]');
  renderNotifList();
  renderCalendar();
}

/* Save notifications and events when arrays change */
function saveAll(){
  if(!currentUser) return;
  localStorage.setItem(EVENTS_KEY(currentUser), JSON.stringify(events));
  localStorage.setItem(NOTIFS_KEY(currentUser), JSON.stringify(notifs));
}

/* Add notification helper wrapper */
function addNotif(message, emoji='🔔', type='info', eventId=null){
  // create notif entry
  const n = { id:'n_'+Date.now()+'_'+Math.floor(Math.random()*999), message, emoji, time:new Date().toISOString(), type, eventId };
  notifs.unshift(n);
  saveNotifsToStorage();
  renderNotifList();
  // show in UI
  showPopup(`${emoji} ${message}`);
  try{ audio.currentTime = 0; audio.play(); }catch(e){}
  if(Notification.permission==='granted'){
    new Notification('Planner', { body: message });
  }
}

/* Save notifs to storage */
function saveNotifsToStorage(){
  if(!currentUser) return;
  localStorage.setItem(NOTIFS_KEY(currentUser), JSON.stringify(notifs));
}

/* Render notif list (bar) */
function renderNotifList(){
  const list = document.getElementById('notifList');
  list.innerHTML = '';
  notifs.forEach(n=>{
    const div = document.createElement('div'); div.className='notif-item';
    const left = document.createElement('div'); left.className='notif-left';
    left.innerHTML = `<div class="notif-emoji">${n.emoji}</div><div class="notif-msg">${n.message}<div class="muted" style="font-size:11px">${new Date(n.time).toLocaleString()}</div></div>`;
    const right = document.createElement('div');
    right.innerHTML = `<button class="small" onclick="dismissNotif('${n.id}')">✖</button>`;
    div.appendChild(left); div.appendChild(right);
    list.appendChild(div);
  });
  document.getElementById('statNotifs').innerText = notifs.length;
}

/* Dismiss individual notif */
function dismissNotif(id){
  notifs = notifs.filter(n=>n.id!==id);
  saveNotifsToStorage();
  renderNotifList();
}

/* Save events on change */
function saveEvents(){
  if(!currentUser) return;
  localStorage.setItem(EVENTS_KEY(currentUser), JSON.stringify(events));
  saveNotifsToStorage();
}

/* Show popup UI wrapper */
function showPopup(html){
  popupCard.innerHTML = html;
  popupCard.style.display = 'flex';
  setTimeout(()=> popupCard.style.display = 'none', 5000);
}

/* Render dashboard stats */
function renderStats(){
  const upcoming = events.filter(e=> !e.completed && (new Date(e.datetime).getTime() > Date.now())).length;
  const todayCount = events.filter(e => {
    const evDate = new Date(e.datetime);
    const today = new Date();
    return evDate.getFullYear()===today.getFullYear() && evDate.getMonth()===today.getMonth() && evDate.getDate()===today.getDate();
  }).length;
  document.getElementById('statUpcoming').innerText = upcoming;
  document.getElementById('statToday').innerText = todayCount;
}

/* Change month for calendar */
function changeMonth(delta){
  currentView.setMonth(currentView.getMonth()+delta);
  renderCalendar();
}

/* Mark done exposed (also used by event detail modal) */
function onMarkDoneButton(evId){
  const ev = events.find(x=>x.id===evId);
  if(!ev) return;
  ev.completed = true;
  saveEvents();
  cancelTimersForEvent(evId);
  addNotif(`✅ Completed: ${ev.title}`, '✅','completed',evId);
  showPopup('✅ Great job! Keep going 🚀');
  renderCalendar();
}

/* Mark done button handler earlier uses data-evId; we already bound onMarkDone to markDoneBtn which reads dataset; that works */

/* Utility: request notification permission */
if('Notification' in window && Notification.permission !== 'granted'){
  Notification.requestPermission().catch(()=>{});
}

/* ---------- On-load: load user data and schedule ---------- */
function renderTodayInfo(){
  document.getElementById('calToday').innerText = new Date().toLocaleDateString();
}

/* load persisted data on session resume */
if(currentUser){
  events = JSON.parse(localStorage.getItem(EVENTS_KEY(currentUser)) || '[]');
  notifs = JSON.parse(localStorage.getItem(NOTIFS_KEY(currentUser)) || '[]');
  renderNotifList();
  scheduleAllReminders();
  renderCalendar();
}

/* Expose some functions to buttons used in DOM attributes */
window.openModal = openModal;
window.closeModal = closeModal;
window.addNotif = addNotif;
window.dismissNotif = dismissNotif;
window.renderCalendar = renderCalendar;
window.onMarkDone = onMarkDoneButton;
window.saveEvents = saveEvents;
