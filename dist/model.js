const PlannerModel = (() => {
  const terms = ['Fall', 'Winter', 'Summer'];
  const statuses = ['Completed', 'In progress', 'Planned'];
  const courseStatuses = [...statuses, 'Failed'];
  const requirementTypes = ['Primary', 'Minor', 'Specialization', 'Other'];
  const minorTarget = 6;
  const isFailingGrade = letter => letter.trim().toUpperCase() === 'F';
  const unscheduledId = 'unscheduled';
  const key = 'tmu-course-planner-v1';
  const id = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16)).join('-');

  function newYear(start) {
    return {
      id: id(), label: `${start}–${start + 1}`,
      semesters: terms.map((term, index) => ({
        id: id(), term, calendar: start + Number(index > 0), notes: '', work: null, courses: []
      }))
    };
  }

  function addDefaultLawMinor(plan, requirementId = 'law') {
    plan.requirements.push({ id: requirementId, name: 'Law', target: minorTarget, type: 'Minor' });
  }

  function emptyPlan() {
    const plan = {
      version: 1, max: 5, sample: false, years: [], unscheduled: { id: unscheduledId, courses: [] },
      requirements: [
        ['core', 'Core course', null], ['lower', 'Lower liberal', 3], ['upper', 'Upper liberal', 3],
        ['core-elective', 'Core elective', 4], ['open', 'Open elective', 4], ['unclassified', 'Unclassified', null]
      ].map(([id, name, target]) => ({ id, name, target, type: 'Primary' }))
    };
    addDefaultLawMinor(plan);
    plan.lawMinorInitialized = true;
    plan.requirements.push({ id: 'slp', name: 'SLP', target: null, type: 'Other' });
    plan.slpInitialized = true;
    return plan;
  }

  function samplePlan() {
    const plan = emptyPlan();
    plan.sample = true;
    plan.years = [newYear(2025), newYear(2026)];
    const add = (y, s, code, name, primary, status, difficulty, letter = '', gpa = null, tags = []) => {
      plan.years[y].semesters[s].courses.push({ id: id(), code, name, primary, status, difficulty, letter, gpa, tags, professor: '', notes: '' });
    };
    add(0, 0, 'ITM 100', 'Foundations of Information Systems', 'core', 'Completed', 3, 'A−', 3.67);
    add(0, 0, 'MHR 405', 'Organizational Behaviour', 'core', 'Completed', 2, 'A', 4);
    add(0, 0, 'PSY 102', 'Introduction to Psychology I', 'lower', 'Completed', null, 'B+', 3.33);
    add(0, 1, 'ITM 207', 'Computer-Enabled Problem Solving', 'core', 'Completed', 4, 'A−', 3.67);
    add(0, 1, 'ACC 100', 'Introductory Financial Accounting', 'core', 'Completed', 3, 'B+', 3.33);
    add(0, 1, 'LAW 122', 'Business Law', 'core', 'Completed', 3, 'A', 4);
    add(1, 0, 'ITM 305', 'Systems Analysis and Design', 'core', 'In progress', 4);
    add(1, 0, 'ITM 410', 'Business Process Management', 'core', 'In progress', 3);
    add(1, 1, 'LAW 525', 'The Law of the Marketplace', 'open', 'Planned', null, '', null, ['law']);
    add(1, 1, 'ITM 500', 'Data and Information Management', 'core', 'Planned', 4);
    add(1, 2, 'PHL 214', 'Critical Thinking', 'lower', 'Planned', 2);
    plan.years[1].semesters[2].work = { title: 'Co-op work term', employer: '', status: 'Planned', notes: '', number: 1 };
    plan.years[0].semesters[1].notes = 'Example note: attended the campus technology club.';
    return plan;
  }

  function sortYears(plan) {
    plan.years.sort((a, b) => a.semesters[0].calendar - b.semesters[0].calendar);
  }

  const allSemesters = plan => plan.years.flatMap(year => year.semesters);
  function nextWorkNumber(plan) {
    const numbers = allSemesters(plan).filter(sem => sem.work).map(sem => sem.work.number);
    let next = numbers.length + 1;
    while (numbers.includes(next)) next++;
    return next;
  }
  const allCourses = plan => [...allSemesters(plan).flatMap(semester => semester.courses), ...plan.unscheduled.courses];
  const countStatuses = courses => courseStatuses.map(status => courses.filter(course => course.status === status).length);
  const requirementCourses = (plan, req) => allCourses(plan).filter(course =>
    req.type === 'Primary' ? course.primary === req.id : course.tags.includes(req.id)
  );
  function coursesForProgress(courses, requirement) {
    if (requirement.type !== 'Minor') return courses;
    const unique = new Map();
    for (const course of courses) {
      const code = course.code.replace(/\s+/g, '').toUpperCase();
      const previous = unique.get(code);
      if (!previous || courseStatuses.indexOf(course.status) < courseStatuses.indexOf(previous.status)) {
        unique.set(code, course);
      }
    }
    return [...unique.values()];
  }

  function moveCourse(source, destination, courseId) {
    if (source === destination) return;
    const index = source.courses.findIndex(course => course.id === courseId);
    if (index >= 0) destination.courses.push(...source.courses.splice(index, 1));
  }

  function bulkUpdate(semesters, status) {
    for (const semester of semesters) {
      for (const course of semester.courses) if (course.status !== 'Failed') course.status = status;
    }
  }

  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const string = value => typeof value === 'string';
  const strings = (value, fields) => object(value) && fields.every(field => string(value[field]));
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const validStatus = status => statuses.includes(status);

  function validatePlan(plan) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    check(object(plan) && plan.version === 1, 'Choose a version 1 Course Planner JSON backup.');
    check(integer(plan.max, 1, 99) && typeof plan.sample === 'boolean', 'Planner settings are invalid.');
    check(Array.isArray(plan.requirements) && Array.isArray(plan.years), 'The backup needs requirements and years arrays.');
    if (plan.unscheduled === undefined) plan.unscheduled = { id: unscheduledId, courses: [] };
    check(object(plan.unscheduled) && plan.unscheduled.id === unscheduledId && Array.isArray(plan.unscheduled.courses),
      'The unscheduled course list is invalid.');
    const seen = new Set([unscheduledId]);
    const checkId = entry => {
      check(string(entry.id) && entry.id.trim() && !seen.has(entry.id), 'An entry ID is missing or duplicated.');
      seen.add(entry.id);
    };
    const requirements = new Map();
    for (const req of plan.requirements) {
      if (req?.type === 'SLP') req.type = 'Other';
      check(strings(req, ['name', 'type']) && req.name.trim() && requirementTypes.includes(req.type) &&
        (req.target === null || integer(req.target, 0, 999)) &&
        (req.color === undefined || (string(req.color) && /^#[0-9a-f]{6}$/i.test(req.color))), 'A requirement has invalid fields.');
      checkId(req);
      requirements.set(req.id, req.type);
      if (req.type === 'Minor') req.target = minorTarget;
    }
    for (const year of plan.years) {
      check(strings(year, ['label']) && year.label.trim() && (year.collapsed === undefined || typeof year.collapsed === 'boolean') && Array.isArray(year.semesters) && year.semesters.length === terms.length,
        'Each academic year needs a label and three semesters.');
      checkId(year);
      for (const [index, sem] of year.semesters.entries()) {
        check(strings(sem, ['notes']) && sem.term === terms[index] && integer(sem.calendar, 1900, 9999) &&
          Array.isArray(sem.courses), 'A semester has invalid fields.');
        checkId(sem);
        check(sem.work === null || (strings(sem.work, ['title', 'employer', 'notes']) && sem.work.title.trim() && validStatus(sem.work.status)),
          'A work term has invalid fields.');
      }
    }
    for (const course of allCourses(plan)) {
      check(strings(course, ['code', 'professor', 'letter', 'notes']) && course.code.trim() &&
        (course.name === undefined || string(course.name)) &&
        courseStatuses.includes(course.status) && (course.difficulty === null || integer(course.difficulty, 1, 5)) &&
        (course.gpa === null || (Number.isFinite(course.gpa) && course.gpa >= 0 && course.gpa <= 4.33)) &&
        (course.primary === '' || requirements.get(course.primary) === 'Primary') &&
        Array.isArray(course.tags) && new Set(course.tags).size === course.tags.length &&
        course.tags.every(tag => requirements.has(tag) && requirements.get(tag) !== 'Primary'), 'A course has invalid fields or requirement references.');
      checkId(course);
      if (isFailingGrade(course.letter)) course.status = 'Failed';
    }
    if (plan.lawMinorInitialized !== true) {
      const existing = plan.requirements.some(req => req.type === 'Minor' && /^law(?: minor)?$/i.test(req.name.trim()));
      if (!existing) addDefaultLawMinor(plan, seen.has('law') ? id() : 'law');
      plan.lawMinorInitialized = true;
    }
    if (plan.slpInitialized !== true) {
      const existing = plan.requirements.some(req => req.type !== 'Primary' && req.name.trim().toUpperCase() === 'SLP');
      if (!existing) plan.requirements.push({ id: seen.has('slp') ? id() : 'slp', name: 'SLP', target: null, type: 'Other' });
      plan.slpInitialized = true;
    }
    const termOrder = ['Winter', 'Summer', 'Fall'];
    const workTerms = allSemesters(plan).filter(sem => sem.work).sort((a, b) =>
      a.calendar - b.calendar || termOrder.indexOf(a.term) - termOrder.indexOf(b.term)
    );
    const usedNumbers = new Set();
    for (const { work } of workTerms) {
      if (Number.isSafeInteger(work.number) && work.number > 0) usedNumbers.add(work.number);
    }
    let number = 1;
    for (const { work } of workTerms) {
      if (Number.isSafeInteger(work.number) && work.number > 0) continue;
      while (usedNumbers.has(number)) number++;
      work.number = number++;
    }
    return plan;
  }

  function suggestMove(plan, now = new Date()) {
    const currentTerm = now.getMonth() < 4 ? 'Winter' : now.getMonth() < 8 ? 'Summer' : 'Fall';
    const chronological = ['Winter', 'Summer', 'Fall'];
    const dateKey = sem => sem.calendar * 3 + chronological.indexOf(sem.term);
    const current = dateKey({ calendar: now.getFullYear(), term: currentTerm });
    const future = allSemesters(plan).filter(sem => dateKey(sem) >= current).sort((a, b) => dateKey(a) - dateKey(b));
    const load = sem => sem.courses.reduce((total, course) => total + course.difficulty, 0);
    let best;
    for (const source of future) {
      for (const destination of future) {
        const difference = source.courses.length - destination.courses.length;
        if (difference < 2 || destination.courses.length >= plan.max) continue;
        for (const course of source.courses.filter(entry => entry.status === 'Planned')) {
          const known = course.difficulty !== null && [...source.courses, ...destination.courses].every(entry => entry.difficulty !== null);
          const before = known ? Math.abs(load(source) - load(destination)) : 0;
          const after = known ? Math.abs(load(source) - load(destination) - 2 * course.difficulty) : 0;
          const gain = [difference, before - after];
          if (!best || gain[0] > best.gain[0] || (gain[0] === best.gain[0] && gain[1] > best.gain[1])) {
            best = { source, destination, course, gain, known };
          }
        }
      }
    }
    return best;
  }

  return {
    requirementTypes, minorTarget, coursesForProgress,
    statuses, courseStatuses, isFailingGrade, unscheduledId, key, id, newYear, emptyPlan, samplePlan, sortYears,
    allSemesters, allCourses, countStatuses, requirementCourses, moveCourse, bulkUpdate, validatePlan, suggestMove, nextWorkNumber
  };
})();
