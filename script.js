const STORAGE_KEY = 'roam-kyoto-tasks-v1';
const PLACES = {
  station: { name: '京都站', path: 'M298 467' },
  nishiki: { name: '锦市场', path: 'M298 467 C308 426 300 378 275 304' },
  kiyomizu: { name: '清水寺', path: 'M298 467 C352 445 395 401 403 335 S463 268 502 268' },
  fushimi: { name: '伏见稻荷', path: 'M298 467 C314 502 337 537 372 571' },
  arashiyama: { name: '岚山', path: 'M298 467 C243 444 185 381 173 313 S137 207 106 163' }
};
const $ = id => document.getElementById(id);
const localToday = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
const addDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };

let tasks = loadTasks();
let selectedId = null;
let animationFrame = null;

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.filter(t => t && typeof t.id === 'string' && typeof t.title === 'string' && typeof t.date === 'string' && PLACES[t.place]);
    }
  } catch (_) { /* Storage may be unavailable; the page remains usable in memory. */ }
  return [
    { id: crypto.randomUUID(), title: '在京都站领取交通卡', date: addDays(1), place: 'station', done: false },
    { id: crypto.randomUUID(), title: '逛锦市场，记下想吃的小店', date: addDays(2), place: 'nishiki', done: false },
    { id: crypto.randomUUID(), title: '预约清水寺周边的和服体验', date: addDays(3), place: 'kiyomizu', done: false }
  ];
}
function saveTasks() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }
  catch (_) { $('form-error').textContent = '浏览器未允许本地保存；刷新后新改动可能丢失。'; }
}
function render() {
  const list = $('task-list');
  list.replaceChildren();
  for (const task of tasks) {
    const item = document.createElement('li');
    item.className = 'task-item' + (task.done ? ' done' : '') + (task.id === selectedId ? ' active' : '');
    item.dataset.id = task.id;
    item.tabIndex = 0;
    item.setAttribute('aria-label', `${task.title}，${task.done ? '已完成' : '未完成'}，${task.date}，${PLACES[task.place].name}。按回车查看路线`);
    const check = document.createElement('input');
    check.type = 'checkbox'; check.className = 'check'; check.checked = !!task.done;
    check.setAttribute('aria-label', `标记「${task.title}」${task.done ? '未完成' : '已完成'}`);
    check.addEventListener('click', e => e.stopPropagation());
    check.addEventListener('change', () => { task.done = check.checked; saveTasks(); render(); });
    const main = document.createElement('div'); main.className = 'task-main';
    const title = document.createElement('div'); title.className = 'task-title'; title.textContent = task.title;
    const meta = document.createElement('div'); meta.className = 'task-meta'; meta.textContent = `${task.date}  ·  ${PLACES[task.place].name}`;
    main.append(title, meta);
    const del = document.createElement('button'); del.type = 'button'; del.className = 'delete-button'; del.textContent = '×'; del.title = '删除待办'; del.setAttribute('aria-label', `删除「${task.title}」`);
    del.addEventListener('click', e => { e.stopPropagation(); tasks = tasks.filter(t => t.id !== task.id); if (selectedId === task.id) clearRoute(); saveTasks(); render(); });
    const arrow = document.createElement('span'); arrow.className = 'task-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
    item.append(check, main, arrow, del);
    item.addEventListener('click', () => selectTask(task.id));
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTask(task.id); } });
    list.append(item);
  }
  $('task-count').textContent = tasks.length;
  const completed = tasks.filter(t => t.done).length;
  $('progress-text').textContent = `${completed} / ${tasks.length} 已完成`;
  $('progress-fill').style.width = tasks.length ? `${100*completed/tasks.length}%` : '0%';
  $('empty-state').hidden = tasks.length !== 0;
  $('export-button').disabled = tasks.length === 0;
}
function clearRoute() {
  selectedId = null;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  for (const id of ['route-line','route-halo']) { const path = $(id); path.setAttribute('d',''); path.classList.remove('animate'); }
  $('traveler').style.opacity = '0';
  $('route-name').textContent = '选择左侧任务，查看对应路线';
  document.querySelectorAll('.place').forEach(p => p.classList.remove('active'));
}
function selectTask(id) {
  const task = tasks.find(t => t.id === id); if (!task) return;
  selectedId = id;
  document.querySelectorAll('.task-item').forEach(item => item.classList.toggle('active', item.dataset.id === id));
  document.querySelectorAll('.place').forEach(p => p.classList.toggle('active', p.dataset.place === task.place));
  $('route-name').textContent = `京都站 → ${PLACES[task.place].name}`;
  if (animationFrame) cancelAnimationFrame(animationFrame);
  const line = $('route-line'), halo = $('route-halo'), traveler = $('traveler');
  for (const path of [line,halo]) { path.classList.remove('animate'); path.setAttribute('d', PLACES[task.place].path); }
  const length = line.getTotalLength();
  if (!length) { traveler.style.opacity = '0'; return; }
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const path of [line,halo]) { path.style.setProperty('--length', length); path.style.strokeDasharray = length; path.style.strokeDashoffset = reduceMotion ? 0 : length; }
  void line.getBoundingClientRect();
  if (!reduceMotion) { line.classList.add('animate'); halo.classList.add('animate'); }
  const start = performance.now();
  const tick = now => {
    const t = reduceMotion ? 1 : Math.min((now-start)/1250,1);
    const eased = t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
    const point = line.getPointAtLength(length*eased);
    traveler.setAttribute('cx',point.x); traveler.setAttribute('cy',point.y); traveler.style.opacity='1';
    if (t<1) animationFrame=requestAnimationFrame(tick);
  };
  animationFrame=requestAnimationFrame(tick);
}
function escapeMarkdown(s) { return s.replace(/[\\\[\]`*_]/g, '\\$&').replace(/[\r\n]+/g,' '); }
function exportMarkdown() {
  const rows = [...tasks].sort((a,b) => a.date.localeCompare(b.date));
  const content = ['# 京都行程清单', '', `导出日期：${localToday()}`, '', ...rows.map(t => `- [${t.done ? 'x' : ' '}] ${escapeMarkdown(t.title)} · ${t.date} · ${PLACES[t.place].name}`), ''].join('\n');
  const url = URL.createObjectURL(new Blob([content], {type:'text/markdown;charset=utf-8'}));
  const link = document.createElement('a'); link.href=url; link.download=`京都行程清单-${localToday()}.md`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('task-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('task-title').value.trim(), date = $('task-date').value, place = $('task-place').value;
  $('form-error').textContent = '';
  if (!title) { $('form-error').textContent='请填写待办事项。'; $('task-title').focus(); return; }
  if (!date) { $('form-error').textContent='请选择执行日期。'; $('task-date').focus(); return; }
  if (date < localToday()) { $('form-error').textContent='执行日期不能早于今天。'; $('task-date').focus(); return; }
  if (!PLACES[place]) { $('form-error').textContent='请选择有效地点。'; return; }
  tasks.unshift({id:crypto.randomUUID(),title,date,place,done:false}); saveTasks(); render();
  $('task-title').value=''; $('task-title').focus();
});
$('task-date').min = localToday(); $('task-date').value = localToday();
$('export-button').addEventListener('click', exportMarkdown);
render();
