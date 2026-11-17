const {
  requirementTypes, minorTarget, coursesForProgress,
  allCourses, allSemesters, bulkUpdate, countStatuses, courseStatuses, emptyPlan, id, isFailingGrade, key, moveCourse,
  newYear, requirementCourses, sortYears, statuses, suggestMove, unscheduledId, validatePlan, nextWorkNumber
} = PlannerModel;

const paths = {
  logo: 'M2 9l10-5 10 5-10 5L2 9zm4 2v6c3 3 9 3 12 0v-6m4-2v7',
  grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
  chart: 'M3 3v18h18M8 16v-4m5 4V8m5 8V5',
  spark: 'M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z',
  settings: 'M4 7h16M4 17h16M8 4v6m8 4v6',
  plus: 'M12 5v14M5 12h14',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  check: 'M5 12l4 4L19 6',
  clock: 'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  calendar: 'M3 6h18v15H3zM7 3v6m10-6v6M3 11h18',
  note: 'M5 3h14v18H5zM8 8h8m-8 4h8m-8 4h5',
  work: 'M3 8h18v12H3zM9 8V4h6v4M3 13h18',
  sun: 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0z',
  moon: 'M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14z',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  close: 'M6 6l12 12M18 6 6 18'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]}"/></svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[char]);
const button = (label, action, { symbol, cls = '', args = [], title, disabled = false } = {}) =>
  `<button type="button" class="${cls}" data-action="${action}" ${args.map((arg, index) => `data-a${index}="${escape(arg)}"`).join(' ')} ${title ? `aria-label="${escape(title)}" title="${escape(title)}"` : ''} ${disabled ? 'disabled' : ''}>${symbol ? icon(symbol) : ''}${escape(label)}</button>`;
const statusClass = status => ({ 'Completed': 'complete', 'In progress': 'active', 'Planned': 'planned', 'Failed': 'failed' })[status];
const statusBadge = status => `<span class="status ${statusClass(status)}"><i></i>${status}</span>`;
const content = document.querySelector('#content');
const dialog = document.querySelector('#dialog');
const toast = document.querySelector('#toast');
const nav = document.querySelector('#nav');
const theme = document.querySelector('#theme');
const fileInput = document.querySelector('#import-file');
const transcriptInput = document.querySelector('#transcript-file');
let readingTranscript = false;
const pages = [
  ['planner', 'Year planner', 'grid'], ['progress', 'Degree progress', 'chart'],
  ['assistant', 'Planning assistant', 'spark'], ['settings', 'Settings & data', 'settings']
];
let plan;
let loadMessage;
let page = pages.some(([name]) => name === location.hash.slice(1)) ? location.hash.slice(1) : 'planner';
let undo;
let drag;
let dialogTrigger;
const selectedCourses = new Set();
let selectionAnchor;
const profileKey = key + '-profile';
const defaultProgram = 'Business Technology Management';
let profile = { name: '', program: defaultProgram };
try {
  const savedProfile = JSON.parse(localStorage.getItem(profileKey));
  if (typeof savedProfile?.name === 'string' && typeof savedProfile.program === 'string') {
    profile = savedProfile;
  }
} catch {}

try {
  const stored = localStorage.getItem(key);
  plan = stored ? validatePlan(JSON.parse(stored)) : emptyPlan();
} catch {
  plan = emptyPlan();
  loadMessage = 'The saved plan could not be loaded. You can restore a JSON backup in Settings & data.';
}

function notify(message, allowUndo = false) {
  toast.replaceChildren(document.createTextNode(message));
  if (allowUndo) toast.insertAdjacentHTML('beforeend', button('Undo', 'undo', { cls: 'plain' }));
  toast.insertAdjacentHTML('beforeend', button('', 'dismiss', { symbol: 'close', cls: 'plain icon-btn', title: 'Dismiss notification' }));
  toast.hidden = false;
}

function save() {
  sortYears(plan);
  try {
    localStorage.setItem(key, JSON.stringify(plan));
    document.querySelector('#save-status').textContent = 'Saved on this device';
    return true;
  } catch {
    document.querySelector('#save-status').textContent = 'Changes could not save';
    return false;
  }
}

function commit(change, message, reversible = false) {
  undo = reversible ? structuredClone(plan) : null;
  change();
  const saved = save();
  const focused = document.activeElement;
  const focusMarkup = focused?.matches('#content button[data-action]') ? focused.outerHTML : null;
  render();
  if (focusMarkup && !dialog.open) {
    const replacement = [...content.querySelectorAll('button[data-action]')].find(entry => entry.outerHTML === focusMarkup);
    (replacement ?? content.querySelector('h1')).focus({ preventScroll: true });
  }
  notify(saved ? message : `${message} Browser storage is unavailable. Export a backup to keep your changes.`, reversible);
}

function setTheme(dark) {
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  theme.innerHTML = icon(dark ? 'sun' : 'moon') + (dark ? 'Light mode' : 'Dark mode');
}
let dark = false;
try { dark = localStorage.getItem(key + '-theme') === 'dark'; } catch {}
setTheme(dark);
theme.onclick = () => {
  dark = !dark;
  setTheme(dark);
  try { localStorage.setItem(key + '-theme', dark ? 'dark' : 'light'); } catch {}
};
document.querySelector('#brand-icon').innerHTML = icon('logo');

const getSem = semId => semId === unscheduledId ? plan.unscheduled : allSemesters(plan).find(sem => sem.id === semId);
const getYear = yearId => plan.years.find(year => year.id === yearId);
const getReq = reqId => plan.requirements.find(req => req.id === reqId);
const minorLabel = name => /\bminor$/i.test(name.trim()) ? name : `${name} Minor`;
const unscheduledLabel = 'Unscheduled courses';
const semLabel = sem => sem.id === unscheduledId ? unscheduledLabel : `${sem.term} ${sem.calendar}`;
const semesterOptions = () => plan.years.flatMap(year => year.semesters.map(sem => [sem.id, `${semLabel(sem)} · ${year.label}`]));
const courseDestinations = () => [...semesterOptions(), [unscheduledId, unscheduledLabel]];
const workCode = number => `WKT ${number}00`;
const overview = () => countStatuses(allCourses(plan)).map((count, index) => {
  const [symbol, name] = [['check', 'Completed'], ['clock', 'In progress'], ['calendar', 'Planned'], ['close', 'Failed']][index];
  return `<div class="stat"><span class="stat-icon ${statusClass(name)}">${icon(symbol)}</span><div><span>${name}</span><strong>${count}</strong></div></div>`;
}).join('');

function gpaSummary(courses) {
  const grades = courses.map(course => course.gpa).filter(Number.isFinite);
  const average = grades.length ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length : null;
  return { count: grades.length, display: average === null ? '—' : average.toFixed(2) };
}

const defaultBadgeColor = type => type === 'Minor' ? '#ffe68a' : '#edf0ff';

function badgeColorStyle(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color ?? '')) return '';
  const channels = color.slice(1).match(/../g).map(pair => parseInt(pair, 16) / 255);
  const [r, g, b] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const foreground = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? '#000' : '#fff';
  return ` style="background-color:${color};color:${foreground}"`;
}

function courseCard(course, sem) {
  const primary = getReq(course.primary)?.name ?? 'Unclassified';
  const tags = course.tags.map(getReq);
  const minors = tags.filter(tag => tag.type === 'Minor');
  const otherTags = tags.filter(tag => tag.type !== 'Minor');
  const grade = [course.letter, course.gpa === null ? '' : course.gpa.toFixed(2)].filter(Boolean).join(' · ');
  return `<article class="course-card" data-course="${escape(course.id)}" data-sem="${escape(sem.id)}" draggable="true">
    <div class="course-head"><button type="button" class="course-link" data-action="edit-course" data-a0="${escape(sem.id)}" data-a1="${escape(course.id)}"><strong>${escape(course.code)}</strong>${course.name?.trim() ? `<span>${escape(course.name)}</span>` : ''}</button>
    <label class="course-select" title="Select ${escape(course.code)}"><input type="checkbox" data-select-course aria-label="Select ${escape(course.code)}"></label>
    ${button('', 'course-menu', { symbol: 'more', cls: 'plain icon-btn', args: [sem.id, course.id], title: `Actions for ${course.code}` })}</div>
    <div class="course-meta">${statusBadge(course.status)}<span class="classification">${escape(primary)}</span>
      ${minors.map(minor => `<span class="minor-tag"${badgeColorStyle(minor.color)}>${escape(minorLabel(minor.name))}</span>`).join('')}</div>
    ${otherTags.length ? `<div class="tags">${otherTags.map(tag => `<span${badgeColorStyle(tag.color)}>${escape(tag.name)}</span>`).join('')}</div>` : ''}
    ${grade || course.difficulty ? `<div class="course-details">${grade ? `<span class="grade">${escape(grade)}</span>` : ''}
      ${course.difficulty ? `<span role="img" class="stars" aria-label="Difficulty ${course.difficulty} out of 5"><span aria-hidden="true">${'★'.repeat(course.difficulty)}<i>${'☆'.repeat(5 - course.difficulty)}</i></span></span>` : ''}</div>` : ''}
  </article>`;
}

function semesterCard(sem) {
  const courses = sem.courses.map(course => courseCard(course, sem)).join('');
  const addCourse = sem.work ? 'Add optional course' : 'Add course';
  const gpa = gpaSummary(sem.courses);
  return `<section class="semester" data-semester="${escape(sem.id)}" aria-label="${escape(semLabel(sem))}">
    <header class="sem-header"><div><h3>${escape(semLabel(sem))}</h3><span class="sem-count">${sem.courses.length} ${sem.courses.length === 1 ? 'course' : 'courses'}</span>
    ${sem.courses.length > plan.max ? '<span class="over">Over limit</span>' : ''}
    <div class="term-gpa">Term GPA <strong>${gpa.display}</strong></div></div>
    <div class="sem-actions">${button('', 'notes', { symbol: 'note', cls: `plain icon-btn ${sem.notes.trim() ? 'has-note' : ''}`, args: [sem.id], title: `${sem.notes.trim() ? 'Edit existing' : 'Add'} notes for ${semLabel(sem)}` })}
    ${button('', 'semester-menu', { symbol: 'more', cls: 'plain icon-btn', args: [sem.id], title: `Actions for ${semLabel(sem)}` })}</div></header>
    ${sem.work ? `<button type="button" class="work-card" draggable="true" data-work="${escape(sem.id)}" data-action="work" data-a0="${escape(sem.id)}">
      <span class="work-icon">${icon('work')}</span>
      <span class="work-summary"><small>${workCode(sem.work.number)}</small><strong>${escape(sem.work.title)}</strong>
      ${sem.work.employer ? `<span class="work-employer">${escape(sem.work.employer)}</span>` : ''}</span>
      ${statusBadge(sem.work.status)}
    </button>
    <div class="additional-courses">${courses ? `<h4>Additional course</h4><div class="courses">${courses}</div>` : ''}</div>`
    : `<div class="courses">${courses || '<p class="empty-sem">Nothing scheduled</p>'}</div>`}
    ${button(addCourse, 'add-course', { symbol: 'plus', cls: 'add-course', args: [sem.id], title: `${addCourse} to ${semLabel(sem)}` })}
  </section>`;
}

function unscheduledCourses() {
  const section = plan.unscheduled;
  return `<section class="semester unscheduled" data-semester="${unscheduledId}" aria-label="${unscheduledLabel}">
    <header class="section-head"><div><h2>${unscheduledLabel}</h2>
    <p>Keep future courses here until you pick a semester.</p></div>
    ${button('Add course', 'add-course', { symbol: 'plus', cls: 'primary', args: [unscheduledId], title: 'Add unscheduled course' })}</header>
    ${section.courses.length ? `<div class="sem-grid">${section.courses.map(course => courseCard(course, section)).join('')}</div>` : ''}
  </section>`;
}

function yearCard(year) {
  const courses = year.semesters.flatMap(sem => sem.courses);
  const completed = courses.filter(course => course.status === 'Completed').length;
  const work = year.semesters.flatMap(sem => sem.work ? [sem.work] : []);
  const finishedWork = work.filter(term => term.status === 'Completed').length;
  const summary = `${completed}/${courses.length} courses completed${work.length ? ` · ${finishedWork}/${work.length} work terms completed` : ''}`;
  return `<section class="academic-year" data-year="${escape(year.id)}"><header class="year-head">
    <h2><button type="button" class="plain year-toggle" data-action="toggle-year" data-a0="${escape(year.id)}"
      aria-expanded="${!year.collapsed}" aria-controls="terms-${escape(year.id)}"><span class="year-chevron" aria-hidden="true">›</span>
      <span>${escape(year.label)}</span><small>${summary}</small></button></h2>
    ${button('', 'year-menu', { symbol: 'more', cls: 'plain icon-btn', args: [year.id], title: `Actions for academic year ${year.label}` })}</header>
    <div class="sem-grid" id="terms-${escape(year.id)}" ${year.collapsed ? 'hidden' : ''}>${year.semesters.map(semesterCard).join('')}</div></section>`;
}

function planner() {
  const cgpa = gpaSummary(allCourses(plan));
  return `<header class="hero"><div><div class="program">${escape(profile.program.toUpperCase())}</div><h1 tabindex="-1">Year planner</h1>
    <p>${profile.name ? escape(profile.name) : 'Map your courses and work terms, one semester at a time.'}</p></div>
    <div class="cgpa"><span>Est. CGPA</span><strong>${cgpa.display}</strong>
    <small>${cgpa.count ? 'Unweighted · all graded attempts' : 'No numeric grades yet'}</small></div>
    <div class="hero-art" aria-hidden="true"><div class="art-grid"><div class="art-top"></div><div class="art-cells">${'<span></span>'.repeat(6)}</div></div></div></header>
    <div class="stats" aria-label="Course totals">${overview()}</div>
    <div class="import-drop transcript-drop" data-import-drop="transcript">
      <div><strong>Drop a TMU transcript PDF here</strong><p>Review your courses before adding them. The PDF is processed on this device.</p></div>
      ${button('Import transcript', 'import-transcript', { cls: 'primary' })}
    </div>
    <div class="section-head"><div><h2>Academic timeline</h2><p>${plan.years.length} academic ${plan.years.length === 1 ? 'year' : 'years'}${plan.sample ? ' · Sample plan' : ''}</p></div>
      ${button('Add year', 'add-year', { symbol: 'plus', cls: 'primary' })}</div>
    ${plan.sample ? `<div class="sample-banner"><span><strong>Sample plan</strong> · This saved plan contains example entries.</span>${button('Start fresh', 'clear', { cls: 'plain' })}</div>` : ''}
    <div class="selection-bar" hidden><span role="status"></span>
      ${button('Edit classifications', 'classify-selected', { cls: 'primary' })}
      ${button('Clear selection', 'clear-selection')}</div>
    ${plan.years.length ? `<div class="timeline"><div class="term-head" aria-hidden="true"><span>Fall</span><span>Winter</span><span>Summer</span></div>
      ${plan.years.map(yearCard).join('')}</div>`
      : '<div class="empty-state"><h3>No academic years yet</h3><p>Add a year to schedule courses, import a transcript, or add an unscheduled course below.</p></div>'}
    ${unscheduledCourses()}`;
}

const pageTitle = (title, description) => `<header class="page-title"><h1 tabindex="-1">${title}</h1><p>${description}</p></header>`;
const verifyNote = '<p class="fine-print">This is a personal plan. Verify program requirements and double-counting rules with TMU.</p>';

function requirementCard(req) {
  const assigned = requirementCourses(plan, req);
  const courses = coursesForProgress(assigned, req);
  const duplicates = assigned.length - courses.length;
  const [completed, active, planned, failed] = countStatuses(courses);
  const projected = completed + active + planned;
  const scale = Math.max(req.target ?? 0, projected, 1);
  return `<article class="requirement"><div class="req-title"><h3>${escape(req.name)}</h3>
    ${button('Edit', 'requirement', { args: [req.id], title: `Edit ${req.name}` })}</div>
    <p>${req.target === null ? 'No target' : `Target ${req.target}`}</p>
    <div class="progress-bar" aria-hidden="true">${[completed,active,planned].map((count,index) => `<span class="${['complete','active','planned'][index]}" style="width:${100 * count / scale}%"></span>`).join('')}</div>
    <p><strong>${completed}</strong> completed · <strong>${active}</strong> in progress · <strong>${planned}</strong> planned${failed ? ` · <strong>${failed}</strong> failed` : ''}</p>
    <p><strong>${projected}</strong> projected${req.target !== null ? ` of ${req.target}` : ''}${req.target !== null && projected > req.target ? ` <span class="over">${projected - req.target} over target</span>` : ''}</p>
    ${duplicates ? `<p class="over">${duplicates} duplicate ${duplicates === 1 ? 'entry' : 'entries'} excluded</p>` : ''}</article>`;
}

function progress() {
  const gpa = gpaSummary(allCourses(plan));
  return pageTitle('Degree progress', 'Track completed courses and see what your current plan adds up to.') +
    `<div class="stats">${overview()}</div><div class="section-head"><h2>Requirements</h2>${button('Add category', 'requirement', { symbol: 'plus', cls: 'primary' })}</div>
    <p class="fine-print">Each minor requires ${minorTarget} distinct courses in the planner. A course counts only once toward the same minor.</p>
    ${requirementTypes.map(type => {
      const entries = plan.requirements.filter(req => req.type === type);
      return entries.length ? `<section class="req-group"><h3>${{ Primary:'Primary classifications', Minor:'Minors', Specialization:'Specializations', Other:'Other categories' }[type]}</h3><div class="req-grid">${entries.map(requirementCard).join('')}</div></section>` : '';
    }).join('')}
    <section class="panel"><h2>GPA overview</h2><p>${gpa.count ? `<strong class="gpa">${gpa.display}</strong> Simple, unweighted average across ${gpa.count} ${gpa.count === 1 ? 'course' : 'courses'} with numeric GPA.` : 'Enter a numeric GPA on a course to see an unweighted average here.'}</p></section>${verifyNote}`;
}

function assistant() {
  const over = allSemesters(plan).filter(sem => sem.courses.length > plan.max);
  const targeted = plan.requirements.filter(req => req.target !== null);
  const suggestion = suggestMove(plan);
  return pageTitle('Planning assistant', 'Check your course load and see where your plan has gaps.') +
    `<section class="panel"><div class="section-head"><div><h2>Semester course load</h2><p>Preferred maximum of ${plan.max} courses per semester.</p></div>${button('Change limit', 'limit')}</div>
    ${over.length ? `<ul>${over.map(sem => `<li>${escape(semLabel(sem))} · ${sem.courses.length} courses (${sem.courses.length - plan.max} over)</li>`).join('')}</ul>` : '<p>All semesters are within your preferred limit.</p>'}</section>
    <section class="panel"><h2>Outstanding requirements</h2>
    ${targeted.length ? `<div class="table-wrap"><table><thead><tr><th>Requirement</th><th>Remaining to complete</th><th>Still needed in plan</th></tr></thead><tbody>${targeted.map(req => {
      const entries = coursesForProgress(requirementCourses(plan, req), req);
      return `<tr><th scope="row">${escape(req.name)} <small>${req.type}</small></th><td>${Math.max(0, req.target - countStatuses(entries)[0])}</td><td>${Math.max(0, req.target - entries.filter(course => course.status !== 'Failed').length)}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p>Add targets in Settings & data to see outstanding counts.</p>'}</section>
    <section class="panel"><h2>Suggested move</h2>
    ${suggestion ? `<p>Consider moving <strong>${escape(suggestion.course.code)}</strong> from ${escape(semLabel(suggestion.source))} to ${escape(semLabel(suggestion.destination))}. This changes the two course loads from ${suggestion.source.courses.length} and ${suggestion.destination.courses.length} to ${suggestion.source.courses.length - 1} and ${suggestion.destination.courses.length + 1}.${suggestion.known && suggestion.gain[1] > 0 ? ' It also brings their total rated difficulty closer.' : ''}</p>
      ${button('Review move', 'move', { args: [suggestion.source.id, suggestion.course.id, suggestion.destination.id], cls: 'primary' })}` : '<p>No course-count balancing move was found among planned courses in current or future semesters.</p>'}
    <p class="fine-print">Suggestions use your entries. Check prerequisites, availability, and work-term restrictions before moving a course.</p></section>${verifyNote}`;
}

function settings() {
  return pageTitle('Settings & data', 'Customize requirements and manage your plan backups.') +
    `<section class="panel"><div class="section-head"><div><h2>Personal details</h2>
    <p>${profile.name ? escape(profile.name) + ' · ' : ''}${escape(profile.program)}</p></div>
    ${button('Edit profile', 'profile')}</div></section>
    <section class="panel"><div class="section-head"><div><h2>Requirements</h2><p>Each course gets one primary classification and can have multiple additional tags.</p></div>${button('Add category', 'requirement', { symbol: 'plus', cls: 'primary' })}</div>
    <div class="settings-list">${plan.requirements.map(req => `<div><span><strong>${escape(req.name)}</strong><small>${req.type} · ${req.target === null ? 'No target' : `Target ${req.target}`}</small></span>${button('Edit', 'requirement', { args: [req.id], title: `Edit ${req.name}` })}</div>`).join('')}</div>${verifyNote}</section>
    <section class="panel"><h2>Plan data</h2><p>Your plan is saved in this browser on this device. Clearing browser storage can erase it. Export a JSON backup to restore your plan or transfer it to another device.</p>
    <div class="import-drop" data-import-drop="json">
      <span>Drop a JSON backup here</span>${button('Import JSON', 'import')}
    </div>
    <div class="button-row">${button('Export JSON', 'export', { cls: 'primary' })}${button('Clear all data', 'clear', { cls: 'danger-outline' })}</div></section>`;
}

function render() {
  nav.innerHTML = pages.map(([name, label, symbol]) => `<a href="#${name}" ${page === name ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`).join('');
  content.innerHTML = ({ planner, progress, assistant, settings })[page]();
  if (page === 'planner') updateSelection();
}

function onNavigate() {
  const target = location.hash.slice(1);
  page = pages.some(([name]) => name === target) ? target : 'planner';
  render();
  window.scrollTo(0, 0);
  content.querySelector('h1').focus();
}
window.addEventListener('hashchange', onNavigate);
document.querySelector('.skip').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#main').focus();
});
sortYears(plan);
render();
if (loadMessage) {
  document.querySelector('#save-status').textContent = 'Saved plan unavailable';
  notify(loadMessage);
} else {
  save();
}

const input = (label, name, value = '', attributes = '') =>
  `<label>${label}<input name="${name}" value="${escape(value)}" ${attributes}></label>`;
const select = (label, name, value, options) =>
  `<label>${label}<select name="${name}">${options.map(([option, text]) => `<option value="${escape(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escape(text)}</option>`).join('')}</select></label>`;
const textarea = (label, name, value) => `<label>${label}<textarea name="${name}" rows="4">${escape(value)}</textarea></label>`;
const statusField = (value, options = statuses) => select('Status', 'status', value, options.map(status => [status, status]));
const readText = (fields, name) => fields.get(name).trim();
const readNumber = (fields, name) => fields.get(name) === '' ? null : Number(fields.get(name));
const required = 'required pattern=".*\\S.*"';

function openDialog(title, body) {
  if (!dialog.open) dialogTrigger = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${escape(title)}</h2>${button('', 'close', { symbol: 'close', cls: 'plain icon-btn', title: 'Close dialog' })}</div>${body}`;
  if (!dialog.open) dialog.showModal();
  (dialog.querySelector('input:not([type="checkbox"]), select, textarea, .action-list button') ?? dialog.querySelector('button')).focus();
}

function form(title, body, label, submit, extra = '', danger = false) {
  openDialog(title, `<form>${body}<div class="form-actions">${extra}<div>${button('Cancel', 'close')}<button class="${danger ? 'danger' : 'primary'}" type="submit">${label}</button></div></div></form>`);
  const element = dialog.querySelector('form');
  element.onsubmit = event => {
    event.preventDefault();
    const fields = new FormData(element);
    dialog.close();
    submit(fields);
  };
}

function confirm(title, message, label, submit, danger = true) {
  form(title, `<p class="dialog-copy">${escape(message)}</p>`, label, submit, '', danger);
}

dialog.addEventListener('close', () => {
  if (dialog.open) return;
  // Saving rerenders the planner, so the original button may have been replaced.
  let target = dialogTrigger;
  if (target && !target.isConnected) {
    const { action, a0, a1, a2 } = target.dataset;
    target = [...content.querySelectorAll('button[data-action]')].find(({ dataset }) =>
      dataset.action === action && dataset.a0 === a0 && dataset.a1 === a1 && dataset.a2 === a2
    );
  }
  (target ?? content.querySelector('h1'))?.focus({ preventScroll: true });
});

function menu(title, entries) {
  openDialog(title, `<div class="action-list">${entries.join('')}</div>`);
}

function workFields(work = { title: '', employer: '', status: 'Planned', notes: '' }) {
  return `<div class="static-field">Work term code<strong>${workCode(work.number ?? nextWorkNumber(plan))}</strong></div>
    ${input('Role', 'title', work.title, required)}
    ${input('Employer', 'employer', work.employer)}${statusField(work.status)}
    <div class="static-field">Primary classification<strong>Workterm</strong></div>
    ${textarea('Work term notes', 'notes', work.notes)}`;
}

function moveWork(source, destination) {
  commit(() => {
    destination.work = source.work;
    source.work = null;
  }, `Work term moved to ${semLabel(destination)}.`, true);
}

function saveWork(sem, fields) {
  commit(() => {
    sem.work = {
      number: sem.work?.number ?? nextWorkNumber(plan),
      title: readText(fields, 'title'), employer: readText(fields, 'employer'),
      status: fields.get('status'), notes: readText(fields, 'notes')
    };
  }, 'Work term saved.');
}

function primaryField(value) {
  const primary = plan.requirements.filter(req => req.type === 'Primary');
  const emptyLabel = primary.some(req => req.id === 'unclassified') ? 'No classification' : 'Unclassified';
  return select('Primary classification', 'primary', value, [['', emptyLabel], ...primary.map(req => [req.id, req.name])]);
}

function additionalCategoryFields(selected) {
  const categories = plan.requirements.filter(req => req.type !== 'Primary');
  const categoryLabel = req => req.type === 'Minor' ? minorLabel(req.name) : req.name;
  const options = categories.map(req => [`category:${req.id}`, categoryLabel(req)]);
  return `<fieldset><legend>Additional categories</legend>
    ${select('Add category / requirement', 'categoryChoice', '', [['', 'Choose a category'], ...options, ['new', 'New']])}
    <fieldset class="entry-fields" data-new-category hidden disabled>
      ${input('New category name', 'categoryName', '', required)}
      ${input('Badge color', 'categoryColor', defaultBadgeColor('Other'), 'type="color"')}
    </fieldset>
    <div class="check-list">${categories.map(req => `<label ${selected.includes(req.id) ? '' : 'hidden'}>
      <input type="checkbox" name="tags" value="${escape(req.id)}" ${selected.includes(req.id) ? 'checked' : ''}>${escape(categoryLabel(req))}</label>`).join('')}</div>
  </fieldset>`;
}

function courseForm(sem, course) {
  const editing = Boolean(course);
  const values = course ?? {
    code: '', name: '', professor: '', status: 'Planned', primary: plan.requirements.find(req => req.id === 'unclassified')?.id ?? '',
    difficulty: null, letter: '', gpa: null, tags: [], notes: ''
  };
  const canAddWork = !editing && sem.id !== unscheduledId && !sem.work;
  form(editing ? 'Edit course' : 'Add course', `${canAddWork ? '<label class="work-toggle"><input type="checkbox" name="workTerm">Work term</label>' : ''}
    <p class="dialog-copy">${escape(semLabel(sem))}</p><fieldset class="entry-fields" data-course-fields><div class="field-grid">
    ${input('Course code', 'code', values.code, required)}${statusField(values.status, courseStatuses)}</div>
    ${input('Course name (optional)', 'name', values.name)}${input('Professor', 'professor', values.professor)}
    <div class="field-grid">${primaryField(values.primary)}
    ${select('Difficulty', 'difficulty', values.difficulty ?? '', [['', 'Unrated'], ...[1, 2, 3, 4, 5].map(n => [n, `${'★'.repeat(n)} ${n} of 5`])])}
    ${input('Letter grade', 'letter', values.letter)}${input('Numeric GPA', 'gpa', values.gpa, 'type="number" min="0" max="4.33" step="any"')}</div>
    ${additionalCategoryFields(values.tags)}
    ${textarea('Course notes', 'notes', values.notes)}</fieldset>
    ${canAddWork ? `<fieldset class="entry-fields" data-work-fields hidden disabled>${workFields()}</fieldset>` : ''}`, 'Save course', fields => {
      if (fields.has('workTerm')) {
        saveWork(sem, fields);
        return;
      }
      const letter = readText(fields, 'letter');
      const entry = {
        id: course?.id ?? id(), code: readText(fields, 'code').toUpperCase(), name: readText(fields, 'name'),
        professor: readText(fields, 'professor'), status: isFailingGrade(letter) ? 'Failed' : fields.get('status'), primary: fields.get('primary'),
        difficulty: readNumber(fields, 'difficulty'), letter, gpa: readNumber(fields, 'gpa'),
        tags: fields.getAll('tags'), notes: readText(fields, 'notes')
      };
      const newName = fields.get('categoryName')?.trim();
      commit(() => {
        if (newName) {
          let category = plan.requirements.find(req => req.type !== 'Primary' &&
            [req.name, req.type === 'Minor' ? minorLabel(req.name) : req.name].some(name =>
              name.trim().toLowerCase() === newName.toLowerCase()
            )
          );
          if (!category) {
            category = { id: id(), name: newName, type: 'Other', target: null, color: fields.get('categoryColor') };
            plan.requirements.push(category);
          }
          if (!entry.tags.includes(category.id)) entry.tags.push(category.id);
        }
        if (editing) Object.assign(course, entry);
        else sem.courses.push(entry);
      }, editing ? 'Course updated.' : 'Course added.', Boolean(newName));
    });
  const element = dialog.querySelector('form');
  const { categoryChoice, categoryName } = element.elements;
  const categoryFields = element.querySelector('[data-new-category]');
  categoryChoice.addEventListener('change', () => {
    const isNew = categoryChoice.value === 'new';
    categoryFields.hidden = categoryFields.disabled = !isNew;
    if (isNew) {
      categoryName.focus();
    } else if (categoryChoice.value) {
      const categoryId = categoryChoice.value.slice('category:'.length);
      const checkbox = [...element.querySelectorAll('input[name="tags"]')].find(input => input.value === categoryId);
      checkbox.closest('label').hidden = false;
      checkbox.checked = true;
      categoryChoice.value = '';
    }
  });
  if (canAddWork) {
    const toggle = element.elements.workTerm;
    const courseFields = element.querySelector('[data-course-fields]');
    const placementFields = element.querySelector('[data-work-fields]');
    const submit = element.querySelector('[type="submit"]');
    toggle.addEventListener('change', () => {
      const isWork = toggle.checked;
      courseFields.disabled = courseFields.hidden = isWork;
      placementFields.disabled = placementFields.hidden = !isWork;
      submit.textContent = isWork ? 'Save work term' : 'Save course';
    });
  }
}

function requirementForm(reqId) {
  const req = getReq(reqId);
  const isMinor = req?.type === 'Minor';
  form(req ? 'Edit category' : 'Add category', `
    ${input('Name', 'name', req?.name, required)}
    <div class="field-grid">${req ? `<div class="static-field">Type<strong>${req.type}</strong></div>` : select('Type', 'type', 'Primary', requirementTypes.map(type => [type, type]))}
    ${input('Target courses', 'target', isMinor ? minorTarget : req?.target, `type="number" min="0" max="999" step="1" ${isMinor ? 'readonly' : ''}`)}</div>
    ${input('Badge color', 'color', req?.color ?? defaultBadgeColor(req?.type), 'type="color"')}
    <p class="fine-print">Minors have a target of ${minorTarget} courses. Set a target for other categories or leave it blank.</p>`, 'Save category', fields => {
    const type = req?.type ?? fields.get('type');
    const values = { name: readText(fields, 'name'), target: type === 'Minor' ? minorTarget : readNumber(fields, 'target') };
    const color = fields.get('color');
    if (type !== 'Primary' && color !== defaultBadgeColor(type)) values.color = color;
    commit(() => {
      if (req) {
        delete req.color;
        Object.assign(req, values);
        return;
      }
      const category = { ...values, id: id(), type };
      plan.requirements.push(category);
    }, 'Category saved.', true);
  }, req ? button('Remove category', 'delete-requirement', { args: [req.id], cls: 'danger-outline' }) : '');
  const element = dialog.querySelector('form');
  if (!req) bindCategoryTarget(element);
  element.elements.color.closest('label').hidden = !req || req.type === 'Primary';
}

function bindCategoryTarget(formElement) {
  const { type, target, color } = formElement.elements;
  let customTarget = target.readOnly ? '' : target.value;
  color.addEventListener('input', () => { color.dataset.edited = 'true'; });
  type.addEventListener('change', () => {
    if (!target.readOnly) customTarget = target.value;
    target.readOnly = type.value === 'Minor';
    target.value = target.readOnly ? minorTarget : customTarget;
    color.closest('label').hidden = type.value === 'Primary';
    if (!color.dataset.edited) color.value = defaultBadgeColor(type.value);
  });
}

function bulkOptions(type, entryId, semesters) {
  const count = semesters.reduce((total, sem) => total + sem.courses.filter(course => course.status !== 'Failed').length, 0);
  return statuses.map(status => button(`Mark all ${count} ${count === 1 ? 'course' : 'courses'} ${status.toLowerCase()}`, 'bulk', {
    args: [type, entryId, status], disabled: !count
  }));
}

function updateSelection() {
  const cards = [...content.querySelectorAll('[data-course]:not([hidden] *)')];
  const visibleIds = new Set(cards.map(card => card.dataset.course));
  for (const courseId of selectedCourses) {
    if (!visibleIds.has(courseId)) selectedCourses.delete(courseId);
  }
  for (const card of cards) {
    const checked = selectedCourses.has(card.dataset.course);
    card.querySelector('[data-select-course]').checked = checked;
    card.classList.toggle('is-selected', checked);
  }
  const bar = content.querySelector('.selection-bar');
  bar.hidden = selectedCourses.size === 0;
  bar.querySelector('[role="status"]').textContent = `${selectedCourses.size} selected`;
}

const actions = {
  'toggle-year': yearId => {
    const year = getYear(yearId);
    year.collapsed = !year.collapsed;
    const terms = document.getElementById(`terms-${yearId}`);
    terms.hidden = year.collapsed;
    terms.parentElement.querySelector('.year-toggle').setAttribute('aria-expanded', String(!year.collapsed));
    updateSelection();
    if (!save()) notify('Changes could not be saved in this browser.', Boolean(undo));
  },
  'clear-selection': () => {
    selectedCourses.clear();
    selectionAnchor = undefined;
    updateSelection();
    content.querySelector('[data-select-course]')?.focus({ preventScroll: true });
  },
  'classify-selected': () => {
    const courses = allCourses(plan).filter(course => selectedCourses.has(course.id));
    const options = plan.requirements.filter(req => req.type === 'Primary').map(req => [req.id, req.name]);
    form(`Classify ${courses.length} selected ${courses.length === 1 ? 'course' : 'courses'}`,
      select('Primary classification', 'primary', '', [['', 'No classification'], ...options]), 'Apply classification', fields => {
        commit(() => {
          for (const course of courses) course.primary = fields.get('primary');
        }, 'Classifications updated.', true);
      });
  },
  profile: () => {
    form('Edit profile', input('Name', 'name', profile.name) + input('Program', 'program', profile.program), 'Save profile', fields => {
      const updated = { name: readText(fields, 'name'), program: readText(fields, 'program') || defaultProgram };
      try {
        localStorage.setItem(profileKey, JSON.stringify(updated));
      } catch {
        notify('Your profile could not be saved in this browser.', Boolean(undo));
        return;
      }
      profile = updated;
      render();
      notify('Profile saved.', Boolean(undo));
    });
  },
  go: target => { location.hash = target; },
  close: () => dialog.close(),
  dismiss: () => { toast.hidden = true; },
  undo: () => {
    if (!undo) return;
    const snapshot = undo;
    commit(() => { plan = snapshot; }, 'Change undone.');
  },
  'add-year': () => {
    const previous = plan.years.at(-1);
    const start = previous ? Math.min(9998, previous.semesters[0].calendar + 1) : new Date().getFullYear();
    form('Add academic year', input('Starting Fall year', 'start', start, 'required type="number" min="1900" max="9998" step="1"'), 'Add year', fields => {
      commit(() => plan.years.push(newYear(Number(fields.get('start')))), 'Academic year added.');
    });
  },
  'year-menu': yearId => {
    const year = getYear(yearId);
    menu(year.label, [
      button('Rename year', 'rename-year', { args: [yearId] }),
      ...bulkOptions('year', yearId, year.semesters),
      button('Delete year', 'delete-year', { args: [yearId], cls: 'danger-outline' })
    ]);
  },
  'rename-year': yearId => {
    const year = getYear(yearId);
    form('Rename academic year', input('Year label', 'label', year.label, required), 'Save year', fields => {
      commit(() => { year.label = readText(fields, 'label'); }, 'Academic year renamed.');
    });
  },
  'delete-year': yearId => {
    const year = getYear(yearId);
    const remove = () => commit(() => { plan.years = plan.years.filter(entry => entry !== year); }, 'Academic year deleted.', true);
    if (year.semesters.some(sem => sem.courses.length || sem.work || sem.notes.trim())) {
      confirm('Delete academic year?', `This will delete ${year.label} and its courses, work terms, and notes.`, 'Delete year', remove);
    } else {
      dialog.close();
      remove();
    }
  },
  'semester-menu': semId => {
    const sem = getSem(semId);
    menu(semLabel(sem), [
      button('Edit calendar year', 'calendar', { args: [semId] }),
      button(sem.work ? 'Edit work term' : 'Add work term', 'work', { args: [semId] }),
      button('Edit semester notes', 'notes', { args: [semId] }),
      ...bulkOptions('semester', semId, [sem])
    ]);
  },
  calendar: semId => {
    const sem = getSem(semId);
    form(`Edit ${sem.term} calendar year`, input('Calendar year', 'calendar', sem.calendar, 'required type="number" min="1900" max="9999" step="1"'), 'Save semester', fields => {
      commit(() => { sem.calendar = Number(fields.get('calendar')); }, 'Semester updated.');
    });
  },
  bulk: (type, entryId, status) => {
    const entry = type === 'year' ? getYear(entryId) : getSem(entryId);
    const semesters = type === 'year' ? entry.semesters : [entry];
    const label = type === 'year' ? entry.label : semLabel(entry);
    const count = semesters.reduce((total, sem) => total + sem.courses.filter(course => course.status !== 'Failed').length, 0);
    confirm('Update course statuses?', `Set the status of ${count} ${count === 1 ? 'course' : 'courses'} in ${label} to ${status}? Failed attempts keep their status.`, 'Update statuses', () => {
      commit(() => bulkUpdate(semesters, status), `${count} ${count === 1 ? 'course' : 'courses'} marked ${status.toLowerCase()}.`, true);
    }, false);
  },
  work: semId => {
    const sem = getSem(semId);
    form(sem.work ? 'Edit work term' : 'Add work term', workFields(sem.work ?? undefined), 'Save work term',
      fields => saveWork(sem, fields), sem.work ? button('Delete', 'delete-work', { args: [semId], cls: 'danger-outline' }) +
        button('Move', 'move-work', { args: [semId], disabled: allSemesters(plan).every(entry => entry.work) }) : '');
  },
  'move-work': semId => {
    const source = getSem(semId);
    const options = semesterOptions().filter(([destination]) => !getSem(destination).work);
    form('Move work term', select('Destination semester', 'destination', options[0][0], options), 'Move work term',
      fields => moveWork(source, getSem(fields.get('destination'))));
  },
  'delete-work': semId => {
    dialog.close();
    commit(() => { getSem(semId).work = null; }, 'Work term deleted.', true);
  },
  notes: semId => {
    const sem = getSem(semId);
    form(`Notes for ${semLabel(sem)}`, textarea('Semester notes', 'notes', sem.notes), 'Save notes', fields => {
      commit(() => { sem.notes = readText(fields, 'notes'); }, 'Semester notes saved.');
    });
  },
  'course-menu': (semId, courseId) => {
    const course = getSem(semId).courses.find(entry => entry.id === courseId);
    const args = [semId, courseId];
    menu(course.code, [
      button('Edit course', 'edit-course', { args }),
      button('Move course', 'move', { args, disabled: courseDestinations().length < 2 }),
      button('Duplicate course', 'duplicate', { args }),
      button('Delete course', 'delete-course', { args, cls: 'danger-outline' })
    ]);
  },
  'add-course': semId => courseForm(getSem(semId)),
  'edit-course': (semId, courseId) => {
    const sem = getSem(semId);
    courseForm(sem, sem.courses.find(course => course.id === courseId));
  },
  move: (semId, courseId, suggested) => {
    const source = getSem(semId);
    const course = source.courses.find(entry => entry.id === courseId);
    const options = courseDestinations().filter(([destination]) => destination !== semId);
    form(`Move ${course.code}`, select('Destination semester', 'destination', suggested ?? options[0]?.[0], options), 'Move course', fields => {
      const destination = getSem(fields.get('destination'));
      commit(() => moveCourse(source, destination, courseId), `Course moved to ${semLabel(destination)}.`, true);
    });
  },
  duplicate: (semId, courseId) => {
    const source = getSem(semId);
    const course = source.courses.find(entry => entry.id === courseId);
    form(`Duplicate ${course.code}`, select('Destination semester', 'destination', semId, courseDestinations()), 'Duplicate', fields => {
      const destination = getSem(fields.get('destination'));
      commit(() => destination.courses.push({ ...structuredClone(course), id: id() }), 'Course duplicated.', true);
    });
  },
  'delete-course': (semId, courseId) => {
    const sem = getSem(semId);
    dialog.close();
    commit(() => { sem.courses = sem.courses.filter(course => course.id !== courseId); }, 'Course deleted.', true);
  },
  requirement: requirementForm,
  'delete-requirement': reqId => {
    const req = getReq(reqId);
    const count = requirementCourses(plan, req).length;
    confirm('Remove category?', `Delete ${req.name} and remove its assignment from ${count} ${count === 1 ? 'course' : 'courses'}?`, 'Remove category', () => {
      commit(() => {
        for (const course of allCourses(plan)) {
          if (course.primary === reqId) course.primary = plan.requirements.find(entry => entry.id === 'unclassified' && entry.id !== reqId && entry.type === 'Primary')?.id ?? '';
          course.tags = course.tags.filter(tag => tag !== reqId);
        }
        plan.requirements = plan.requirements.filter(entry => entry !== req);
      }, 'Category removed.', true);
    });
  },
  limit: () => {
    form('Preferred course limit', input('Maximum courses per semester', 'max', plan.max, 'required type="number" min="1" max="99" step="1"'), 'Save limit', fields => {
      commit(() => { plan.max = Number(fields.get('max')); }, 'Course limit saved.');
    });
  },
  export: () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tmu-course-plan.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('JSON backup exported.', Boolean(undo));
  },
  import: () => fileInput.click(),
  'import-transcript': () => transcriptInput.click(),
  clear: () => confirm('Clear planner data?', 'This removes every academic year, course, work term, note, and custom requirement. Default classifications and settings will be restored.', 'Clear data', () => {
    commit(() => { plan = emptyPlan(); }, 'Planner cleared.', true);
  })
};

content.addEventListener('change', event => {
  if (!event.target.matches('[data-select-course]')) return;
  const courseId = event.target.closest('[data-course]').dataset.course;
  if (event.target.checked) selectedCourses.add(courseId);
  else selectedCourses.delete(courseId);
  selectionAnchor = courseId;
  updateSelection();
});

content.addEventListener('click', event => {
  const card = event.target.closest('[data-course]');
  if (!event.shiftKey || !card || event.target.closest('[data-action="course-menu"]')) return;
  event.preventDefault();
  event.stopPropagation();
  const ids = [...content.querySelectorAll('[data-course]:not([hidden] *)')].map(entry => entry.dataset.course);
  const end = ids.indexOf(card.dataset.course);
  const start = ids.includes(selectionAnchor) ? ids.indexOf(selectionAnchor) : end;
  for (const courseId of ids.slice(Math.min(start, end), Math.max(start, end) + 1)) {
    selectedCourses.add(courseId);
  }
  selectionAnchor = ids[start];
  // A canceled checkbox click restores its prior checked state after dispatch.
  queueMicrotask(updateSelection);
});

document.addEventListener('click', event => {
  const control = event.target.closest('button[data-action]');
  if (!control) return;
  const { action, a0, a1, a2 } = control.dataset;
  actions[action](a0, a1, a2);
});

const transcriptSeasons = ['Fall', 'Winter', 'Summer'];
const normalizeCourseCode = code => code.trim().toUpperCase().replace(/\s+/g, '');
const sameTranscriptCourse = (course, code) => normalizeCourseCode(course.code) === normalizeCourseCode(code);

function findTranscriptSemester(targetPlan, season, year) {
  return allSemesters(targetPlan).find(sem => sem.term === season && sem.calendar === year);
}

function ensureTranscriptSemester(targetPlan, season, calendar) {
  const existing = findTranscriptSemester(targetPlan, season, calendar);
  if (existing) return existing;
  const start = season === 'Fall' ? calendar : calendar - 1;
  let year = targetPlan.years.find(entry => entry.semesters[0].calendar === start);
  if (!year) {
    year = newYear(start);
    targetPlan.years.push(year);
  }
  const semester = year.semesters.find(entry => entry.term === season);
  if (semester.calendar !== calendar) {
    // A custom calendar year already occupies this slot. Keep that semester intact.
    const added = newYear(start);
    targetPlan.years.push(added);
    return added.semesters.find(entry => entry.term === season);
  }
  return semester;
}

function transcriptReview({ entries, unparsed }) {
  const rows = entries.map((entry, index) => {
    const semester = findTranscriptSemester(plan, entry.season, entry.year);
    const duplicate = semester?.courses.some(course => sameTranscriptCourse(course, entry.code));
    const conflict = entry.work && semester?.work;
    const needsStatus = entry.warnings.some(warning => warning.startsWith('Withdrawn') || warning.startsWith('Special')) &&
      !(entry.work && entry.grade === 'PSD');
    const initial = duplicate || conflict || needsStatus || !entry.season || !entry.grade ? 'skip' : entry.work ? 'work' : 'course';
    const caption = [entry.code, entry.name].filter(Boolean).join(' · ');
    return `<article class="transcript-row" data-transcript-row>
      <div class="section-head"><h3>${escape(caption)}</h3>
        ${select('Import as', 'action', initial, [['skip', 'Skip'], ['course', 'Course'], ...(entry.work ? [['work', 'Work term']] : [])])}
      </div>
      <p class="fine-print">${escape(['PDF page ' + entry.page, ...entry.warnings].join(' · '))}</p>
      <p class="fine-print transcript-conflict" data-transcript-conflict hidden></p>
      <fieldset class="transcript-fields" ${initial === 'skip' ? 'disabled' : ''}>
        <legend class="sr-only">Fields for entry ${index + 1}</legend>
        ${select('Term', 'season', entry.season ?? '', [['', 'Choose a term'], ...transcriptSeasons.map(value => [value, value])])}
        ${input('Year', 'year', entry.year, 'type="number" min="1901" max="9998" step="1" required')}
        ${input('Course code', 'code', entry.code, required)}
        ${input('Course name', 'name', entry.name)}
        ${input('Grade', 'grade', entry.grade)}
        ${input('Grade points', 'gpa', entry.gpa, 'type="number" min="0" max="4.33" step="any"')}
        ${input('Credit earned', 'credit', entry.credit, 'type="number" min="0" step="any"')}
        ${statusField(entry.status, courseStatuses)}
        ${textarea('Transcript notes', 'notes', entry.notes.join('\n'))}
      </fieldset>
    </article>`;
  }).join('');

  openDialog('Review transcript', `<form class="transcript-review">
    <p>Check the extracted fields and choose what to import. Your PDF stays on this device.</p>
    <p class="fine-print">The planner uses a simple GPA average. TMU can apply credits, repeat rules, and other adjustments to its official GPA.</p>
    ${unparsed ? `<p class="transcript-conflict">${unparsed} ${unparsed === 1 ? 'row needs' : 'rows need'} review because some fields could not be read confidently.</p>` : ''}
    <p class="fine-print">Potential duplicates start as Skip. Choose Course to add a separate attempt. If a semester already has a work term, choose Course or Skip.</p>
    <div class="transcript-rows">${rows}</div>
    <p class="transcript-conflict" data-transcript-error role="alert" hidden></p>
    <div class="form-actions"><div>${button('Cancel', 'close')}<button class="primary" type="submit">Import selected entries</button></div></div>
  </form>`);

  const review = dialog.querySelector('form');
  const rowElements = [...review.querySelectorAll('[data-transcript-row]')];
  const field = (row, name) => row.querySelector(`[name="${name}"]`);
  const value = (row, name) => field(row, name).value.trim();
  const error = review.querySelector('[data-transcript-error]');
  const showError = message => {
    error.textContent = message;
    error.hidden = !message;
  };

  function refreshReview(warnOnDuplicateChange = false) {
    const workTermKeys = new Set();
    for (const row of rowElements) {
      const action = field(row, 'action');
      const season = value(row, 'season');
      const year = Number(value(row, 'year'));
      const code = value(row, 'code');
      const semester = findTranscriptSemester(plan, season, year);
      const duplicate = semester?.courses.some(course => sameTranscriptCourse(course, code));
      if (warnOnDuplicateChange && duplicate && row.dataset.duplicate !== 'true') action.value = 'skip';
      row.dataset.duplicate = String(Boolean(duplicate));
      const selectedWork = action.value === 'work';
      const key = `${season} ${year}`;
      const workConflict = selectedWork && (semester?.work || workTermKeys.has(key));
      if (selectedWork) workTermKeys.add(key);
      row.querySelector('fieldset').disabled = action.value === 'skip';
      field(row, 'season').required = true;
      field(row, 'action').setCustomValidity(workConflict ? 'A work term already occupies this semester. Choose Course or Skip.' : '');
      const message = row.querySelector('[data-transcript-conflict]');
      message.textContent = workConflict
        ? 'This semester already has a work term. Choose Course or Skip.'
        : duplicate ? 'Potential duplicate in this semester. Choose Course to add another attempt.' : '';
      if (!message.textContent && field(row, 'action').value === 'skip' && semester?.work &&
          [...action.options].some(option => option.value === 'work')) {
        message.textContent = 'This semester already has a work term. Choose Course or Skip.';
      }
      message.hidden = !message.textContent;
    }
  }

  review.addEventListener('change', event => {
    showError('');
    refreshReview(['season', 'year', 'code'].includes(event.target.name));
  });
  refreshReview();

  review.addEventListener('submit', event => {
    event.preventDefault();
    refreshReview(true);
    if (!review.reportValidity()) return;
    const selected = rowElements.filter(row => value(row, 'action') !== 'skip');
    if (!selected.length) {
      showError('Choose at least one entry to import.');
      return;
    }

    const updated = structuredClone(plan);
    for (const row of selected) {
      const semester = ensureTranscriptSemester(updated, value(row, 'season'), Number(value(row, 'year')));
      const code = value(row, 'code').toUpperCase();
      const name = value(row, 'name');
      const grade = value(row, 'grade');
      const status = isFailingGrade(grade) ? 'Failed' : value(row, 'status');
      const points = value(row, 'gpa');
      const credit = value(row, 'credit');
      const work = value(row, 'action') === 'work';
      if (work && (semester.work || !statuses.includes(status))) {
        showError('A conflicting or failed work term needs to be imported as a course or skipped.');
        return;
      }
      const notes = [
        work ? `Transcript code: ${code}` : '',
        work && grade ? `Transcript grade: ${grade}` : '',
        work && points ? `Entered grade points: ${points}` : '',
        credit ? `Transcript credit earned: ${credit}` : '',
        value(row, 'notes')
      ].filter(Boolean).join('\n');
      if (work) {
        semester.work = { title: name || code, employer: '', status, notes, number: nextWorkNumber(updated) };
      } else {
        semester.courses.push({
          id: id(), code, name, professor: '', status, primary: getReq('unclassified')?.id ?? '',
          difficulty: null, letter: grade, gpa: points ? Number(points) : null, tags: [], notes
        });
      }
      updated.years.find(year => year.semesters.includes(semester)).collapsed = false;
    }
    dialog.close();
    commit(() => { plan = updated; }, `Imported ${selected.length} ${selected.length === 1 ? 'entry' : 'entries'}.`, true);
  });
}

async function importTranscript(file) {
  if (!file || readingTranscript) return;
  if (location.protocol === 'file:') {
    notify('Open the planner on localhost or Vercel to import a PDF. The PDF worker needs an HTTP page.', Boolean(undo));
    return;
  }
  readingTranscript = true;
  notify('Reading transcript on this device…', Boolean(undo));
  try {
    const { readTranscript } = await import('./transcript.mjs?v=1');
    const result = await readTranscript(file);
    toast.hidden = true;
    transcriptReview(result);
  } catch (error) {
    const detail = error instanceof TypeError ? 'Check that the PDF import assets are available and try again.' : error.message;
    notify(`Could not import the transcript. ${detail}`, Boolean(undo));
  } finally {
    readingTranscript = false;
  }
}

async function importPlan(file) {
  if (!file) return;
  let imported;
  try {
    imported = validatePlan(JSON.parse(await file.text()));
  } catch (error) {
    notify(`Could not import this file. ${error instanceof SyntaxError ? 'Choose a valid JSON backup exported by Course Planner.' : error.message}`, Boolean(undo));
    return;
  }
  confirm('Replace your current plan?', `Import ${file.name} and replace the academic years, courses, requirements, and settings currently saved in this browser.`, 'Replace plan', () => {
    commit(() => { plan = imported; }, 'Plan imported.', true);
  });
}

fileInput.addEventListener('change', () => {
  const [file] = fileInput.files;
  fileInput.value = '';
  importPlan(file);
});

transcriptInput.addEventListener('change', () => {
  const [file] = transcriptInput.files;
  transcriptInput.value = '';
  importTranscript(file);
});

content.addEventListener('dragover', event => {
  const zone = event.target.closest('[data-import-drop]');
  if (!zone || !event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  zone.classList.add('is-dragging');
});

content.addEventListener('dragleave', event => {
  const zone = event.target.closest('[data-import-drop]');
  if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('is-dragging');
});

content.addEventListener('drop', event => {
  const zone = event.target.closest('[data-import-drop]');
  if (!zone || !event.dataTransfer.types.includes('Files')) return;
  event.preventDefault();
  zone.classList.remove('is-dragging');
  const files = event.dataTransfer.files;
  if (files.length !== 1) {
    notify('Drop one file at a time.', Boolean(undo));
    return;
  }
  if (zone.dataset.importDrop === 'transcript') importTranscript(files[0]);
  else importPlan(files[0]);
});

content.addEventListener('contextmenu', event => {
  const card = event.target.closest('[data-course]');
  const semester = event.target.closest('[data-semester]');
  const year = event.target.closest('[data-year]');
  if (!year && !card) return;
  event.preventDefault();
  if (card) actions['course-menu'](card.dataset.sem, card.dataset.course);
  else if (semester) actions['semester-menu'](semester.dataset.semester);
  else actions['year-menu'](year.dataset.year);
});

content.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-course], [data-work]');
  if (!card) return;
  const { work, sem, course } = card.dataset;
  drag = { semId: work ?? sem, courseId: course, isWork: work !== undefined };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', course ?? work);
});

function dropDestination(event) {
  const target = event.target.closest('[data-semester]');
  if (!drag || !target || target.dataset.semester === drag.semId) return;
  const destination = getSem(target.dataset.semester);
  if (drag.isWork && (destination.id === unscheduledId || destination.work)) return;
  return target;
}

content.addEventListener('dragover', event => {
  const target = dropDestination(event);
  if (!target) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  target.classList.add('drop-target');
});
content.addEventListener('dragleave', event => {
  const sem = event.target.closest('[data-semester]');
  if (sem && !sem.contains(event.relatedTarget)) sem.classList.remove('drop-target');
});
content.addEventListener('dragend', () => {
  drag = null;
  content.querySelectorAll('.drop-target').forEach(sem => sem.classList.remove('drop-target'));
});
content.addEventListener('drop', event => {
  const target = dropDestination(event);
  if (!target) return;
  event.preventDefault();
  const { semId, courseId, isWork } = drag;
  drag = null;
  const source = getSem(semId);
  const destination = getSem(target.dataset.semester);
  if (isWork) {
    moveWork(source, destination);
  } else {
    commit(() => moveCourse(source, destination, courseId), `Course moved to ${semLabel(destination)}.`, true);
  }
});
