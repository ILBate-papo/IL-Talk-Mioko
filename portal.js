(() => {
  const main = document.querySelector('#app main');
  if (!main) return;
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const lesson = node('div'); lesson.id = 'lessonContent';
  while (main.firstChild) lesson.append(main.firstChild);
  const student = node('section', undefined, 'portal'); student.id = 'studentPage'; student.hidden = true;
  const teacher = node('section', undefined, 'portal'); teacher.id = 'teacherPage'; teacher.hidden = true;
  main.append(student, teacher, lesson);
  const languages = ['Português', 'Japonês', 'Inglês', 'Espanhol', 'Francês', 'Coreano', 'Italiano'];
  const levels = {beginner:'Iniciante', intermediate:'Intermediário', advanced:'Avançado'};
  let current = 'aula';
  const user = () => window.MiokoAuth?.userId?.();
  const storageKey = name => 'ilMiokoPortal:' + user() + ':' + name;
  const read = (name, fallback) => { try { return JSON.parse(localStorage.getItem(storageKey(name)) || 'null') ?? fallback; } catch { return fallback; } };
  const save = (name, value, status) => {
    try { localStorage.setItem(storageKey(name), JSON.stringify(value)); status.textContent = 'Salvo neste dispositivo.'; return true; }
    catch { status.textContent = 'Não foi possível salvar. Verifique o armazenamento do navegador.'; return false; }
  };
  const button = (text, action) => { const b = node('button', text, 'nb'); b.type = 'button'; b.onclick = action; return b; };
  const statusNode = () => { const s = node('p'); s.setAttribute('role', 'status'); return s; };
  function field(parent, title, tag, id, value = '') {
    const label = node('label', title); label.htmlFor = id;
    const input = node(tag); input.id = id; input.value = value;
    parent.append(label, input); return input;
  }
  function summary(parent, entries) { const row = node('div', undefined, 'portalSummary'); entries.forEach(s => row.append(node('span', s))); parent.append(row); }
  function goToLesson(prompt) {
    open('aula');
    if (prompt) { document.querySelector('#text').value = prompt; document.querySelector('#text').focus(); }
    document.querySelector('#videoRoom').scrollIntoView({block:'start'});
  }
  function renderStudent() {
    student.replaceChildren(node('small', 'SEU ESPAÇO DE ESTUDO'), node('h1', 'Página do aluno'));
    student.append(node('p', 'Continue sua conversa, organize seus objetivos e consulte o que ficou salvo neste aparelho.'));
    let history = [], course = {};
    try { history = JSON.parse(localStorage.getItem('ilMiokoHistory:' + user()) || '[]'); if (!Array.isArray(history)) history = []; } catch {}
    try { course = JSON.parse(localStorage.getItem('ilMiokoCourseLevels:' + user()) || '{}') || {}; } catch {}
    const language = localStorage.ilLang || 'Português';
    summary(student, ['Idioma atual: ' + language, 'Nível: ' + (levels[course[language]] || 'Iniciante'), history.length + ' mensagens guardadas']);
    const tools = node('div', undefined, 'tools');
    tools.append(button('📚 Continuar minha aula', () => goToLesson()), button('🗣️ Praticar conversação', () => goToLesson('Quero praticar conversação em ' + language + '. Respeite meu nível e faça uma pergunta de cada vez.')));
    const studies = node('a', '📖 Materiais e estudos', 'nb'); studies.href = 'estudos.html'; tools.append(studies); student.append(tools);
    const grid = node('div', undefined, 'portalGrid'); grid.style.marginTop = '22px';
    const goals = node('section', undefined, 'panel'); goals.append(node('h2', 'Meu plano de estudo'));
    const data = read('student', {});
    const goal = field(goals, 'O que quero aprender', 'textarea', 'studentGoal', data.goal || ''); goal.maxLength = 2000;
    const notes = field(goals, 'Minhas anotações', 'textarea', 'studentNotes', data.notes || ''); notes.maxLength = 10000;
    const status = statusNode(); const actions = node('div', undefined, 'tools');
    actions.append(button('Salvar meu plano', () => save('student', {goal:goal.value, notes:notes.value}, status)), button('Estudar meu objetivo', () => { if (!goal.value.trim()) { status.textContent = 'Escreva primeiro seu objetivo.'; goal.focus(); return; } goToLesson('Meu objetivo é: ' + goal.value.trim() + '. Ajude-me a praticar no meu nível.'); }));
    goals.append(actions, status, node('small', 'Plano, anotações e histórico são pessoais desta conta e ficam neste dispositivo.'));
    const recent = node('section', undefined, 'panel'); recent.append(node('h2', 'Últimas conversas'));
    if (!history.length) recent.append(node('p', 'Você ainda não tem mensagens guardadas neste dispositivo. Comece uma aula com a Mioko.'));
    const list = node('ul', undefined, 'portalList');
    history.slice(-6).forEach(item => { const li = node('li'); li.append(node('b', item.role === 'user' ? 'Você' : 'Mioko'), node('p', String(item.content || ''))); list.append(li); });
    recent.append(list); grid.append(goals, recent); student.append(grid);
  }
  function renderTeacher() {
    teacher.replaceChildren(node('small', 'PLANEJAMENTO DE AULAS'), node('h1', 'Página do professor'));
    teacher.append(node('p', 'Prepare atividades, guarde seus planos e leve uma proposta para a sala da Mioko.'));
    const grid = node('div', undefined, 'portalGrid'), editor = node('section', undefined, 'panel'), saved = node('section', undefined, 'panel');
    editor.append(node('h2', 'Preparar aula')); saved.append(node('h2', 'Meus planos salvos'));
    let editing = null;
    const title = field(editor, 'Tema da aula', 'input', 'teacherTitle'); title.maxLength = 160;
    const language = field(editor, 'Idioma', 'select', 'teacherLanguage'); languages.forEach(x => language.append(new Option(x, x)));
    const level = field(editor, 'Nível', 'select', 'teacherLevel'); Object.entries(levels).forEach(([v,t]) => level.append(new Option(t, v)));
    const activity = field(editor, 'Objetivos e atividades', 'textarea', 'teacherActivity'); activity.maxLength = 10000;
    const status = statusNode(), actions = node('div', undefined, 'tools');
    const plans = () => { const value = read('plans', []); return Array.isArray(value) ? value : []; };
    const clear = () => { editing = null; title.value = activity.value = ''; language.value = 'Português'; level.value = 'beginner'; };
    const valid = () => { if (!title.value.trim() || !activity.value.trim()) { status.textContent = 'Preencha o tema e as atividades da aula.'; return false; } return true; };
    actions.append(button('Salvar plano', () => {
      if (!valid()) return;
      const all = plans(); const plan = {id:editing || crypto.randomUUID(), title:title.value.trim(), language:language.value, level:level.value, activity:activity.value.trim()};
      const index = all.findIndex(p => p.id === editing);
      if (index < 0) all.unshift(plan); else all[index] = plan;
      if (save('plans', all, status)) { editing = plan.id; renderList(); }
    }), button('Preparar na sala da Mioko', () => {
      if (!valid()) return;
      document.querySelectorAll('[data-lang]').forEach(b => { if (b.dataset.lang === language.value) b.click(); });
      const select = document.querySelector('select[aria-label="Seu nível no idioma"]');
      if (select) { select.value = level.value; select.dispatchEvent(new Event('change')); }
      goToLesson('Ajude-me a preparar uma aula de ' + language.value + ' para nível ' + levels[level.value] + '. Tema: ' + title.value.trim() + '. Objetivos e atividades: ' + activity.value.trim());
    }), button('Novo plano', () => { clear(); status.textContent = ''; }));
    editor.append(actions, status, node('small', 'Os planos ficam salvos nesta conta e neste dispositivo. A proposta na sala só será enviada quando você tocar em ENVIAR.'));
    const list = node('ul', undefined, 'portalList'); saved.append(list);
    function renderList() {
      list.replaceChildren(); const all = plans();
      if (!all.length) { list.append(node('li', 'Nenhum plano salvo. Prepare sua primeira aula ao lado.')); return; }
      all.forEach(plan => {
        const li = node('li'); li.append(node('h3', plan.title), node('p', plan.language + ' · ' + (levels[plan.level] || 'Iniciante')));
        const row = node('div', undefined, 'tools');
        row.append(button('Abrir plano', () => { editing = plan.id; title.value = plan.title; language.value = plan.language; level.value = plan.level; activity.value = plan.activity; status.textContent = 'Plano aberto para edição.'; title.focus(); }), button('Excluir plano', () => {
          if (!confirm('Excluir o plano “' + plan.title + '”?')) return;
          if (save('plans', plans().filter(p => p.id !== plan.id), status)) { if (editing === plan.id) clear(); renderList(); }
        }));
        li.append(row); list.append(li);
      });
    }
    renderList(); grid.append(editor, saved); teacher.append(grid);
  }
  function open(page) {
    if (!window.MiokoAuth?.hasAccess?.() || !user()) return false;
    if (['professor','admin'].includes(page) && window.MiokoAuth.role() !== 'admin') return false;
    if (page === 'admin') { location.href = 'admin.html?from=curso'; return true; }
    page = ['aluno','professor','aula'].includes(page) ? page : 'aluno';
    if (page !== 'aula') window.dispatchEvent(new Event('mioko-leave-lesson'));
    current = page;
    student.hidden = page !== 'aluno'; teacher.hidden = page !== 'professor'; lesson.hidden = page !== 'aula';
    if (page === 'aluno') renderStudent(); if (page === 'professor') renderTeacher();
    document.querySelectorAll('[data-mode]').forEach(b => { const selected = b.dataset.mode === (page === 'professor' ? 'Professor' : 'Aluno'); b.classList.toggle('active', selected); b.setAttribute('aria-current', selected ? 'page' : 'false'); });
    history.replaceState(null, '', '#' + page);
    main.scrollIntoView({block:'start'}); return true;
  }
  window.MiokoPortal = {open, reset() {student.replaceChildren(); teacher.replaceChildren(); student.hidden = teacher.hidden = true; lesson.hidden = false; current = 'aula';}};
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
})();
