// script.js — калькулятор воронки, заявки, посты из канала, аналитика.
(function () {
  const CFG = window.SITE_CONFIG || {};
  const DATA = window.AUDIT_DATA || {};
  const WORKER = (CFG.WORKER_URL || '').replace(/\/+$/, '');
  const $ = (sel) => document.querySelector(sel);

  const rub = (n) => Math.round(n).toLocaleString('ru-RU') + ' ₽';
  const pct = (n) => (Math.round(n * 10) / 10).toLocaleString('ru-RU') + '%';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let currentNiche = 'services';
  let lastAudit = null; // текст результата для заявки

  // ---------- Яндекс.Метрика ----------
  function initMetrika() {
    const id = String(CFG.YANDEX_METRIKA_ID || '').trim();
    if (!/^\d+$/.test(id)) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(Number(id), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }
  function goal(name) {
    const id = Number(CFG.YANDEX_METRIKA_ID);
    if (id && typeof window.ym === 'function') window.ym(id, 'reachGoal', name);
  }

  // ---------- Калькулятор ----------
  function renderNiches() {
    const box = $('#nicheOptions');
    box.innerHTML = Object.entries(DATA).map(([key, n]) => `
      <label class="chip">
        <input type="radio" name="niche" value="${key}" ${key === currentNiche ? 'checked' : ''} />
        <span>${esc(n.label)}</span>
      </label>`).join('');
    box.addEventListener('change', (e) => {
      if (e.target.name !== 'niche') return;
      currentNiche = e.target.value;
      applyNiche(true);
    });
  }

  function applyNiche(resetValues) {
    const n = DATA[currentNiche];
    $('#l-c1').textContent = n.c1Label;
    $('#l-c2').textContent = n.c2Label;
    $('#h-c1').textContent = 'Норма по нише: около ' + pct(n.norms.c1);
    $('#h-c2').textContent = 'Норма по нише: около ' + pct(n.norms.c2);
    $('#h-repeat').textContent = 'Норма по нише: около ' + pct(n.norms.repeat);
    if (resetValues) {
      const d = n.defaults;
      $('#f-visitors').value = d.visitors;
      $('#f-c1').value = d.c1;
      $('#f-c2').value = d.c2;
      $('#f-check').value = d.check;
      $('#f-repeat').value = d.repeat;
    }
  }

  function revenue(v) {
    return v.visitors * (v.c1 / 100) * (v.c2 / 100) * v.check * (1 + v.repeat / 100);
  }

  function calculate(v, norms) {
    const current = revenue(v);
    const stages = ['c1', 'c2', 'repeat'].map((key) => {
      const fixed = Object.assign({}, v, { [key]: Math.max(v[key], norms[key]) });
      return { key, value: v[key], norm: norms[key], gain: revenue(fixed) - current };
    });
    const best = Object.assign({}, v);
    stages.forEach((s) => { best[s.key] = Math.max(s.value, s.norm); });
    const potential = revenue(best);
    return { current, potential, loss: potential - current, stages };
  }

  function stageName(key, n) {
    if (key === 'c1') return n.c1Label.replace(/, %$/, '');
    if (key === 'c2') return n.c2Label.replace(/, %$/, '');
    return 'Повторные покупки';
  }

  function readForm() {
    const num = (id) => parseFloat(String($(id).value).replace(',', '.'));
    const v = { visitors: num('#f-visitors'), c1: num('#f-c1'), c2: num('#f-c2'), check: num('#f-check'), repeat: num('#f-repeat') };
    const bad = Object.values(v).some((x) => !isFinite(x) || x < 0) || v.c1 > 100 || v.c2 > 100 || v.repeat > 100;
    return bad ? null : v;
  }

  function renderResult(v) {
    const n = DATA[currentNiche];
    const r = calculate(v, n.norms);
    const weak = r.stages.filter((s) => s.gain > 0.5).sort((a, b) => b.gain - a.gain);

    const bars = r.stages.map((s) => {
      const max = Math.max(s.value, s.norm) * 1.15 || 1;
      const ok = s.value >= s.norm;
      return `
        <div class="bar-row">
          <div class="bar-head">
            <span>${esc(stageName(s.key, n))}</span>
            <span class="${ok ? 'ok' : 'bad'}">${pct(s.value)} <small>/ норма ${pct(s.norm)}</small></span>
          </div>
          <div class="bar"><div class="bar-fill ${ok ? 'ok' : 'bad'}" style="width:${(s.value / max) * 100}%"></div>
            <div class="bar-norm" style="left:${(s.norm / max) * 100}%" title="Норма"></div></div>
        </div>`;
    }).join('');

    let body;
    if (!weak.length) {
      body = `
        <p class="result-label">Воронка в норме</p>
        <p class="result-big ok">Все этапы не хуже рынка 👏</p>
        <p>Выручка сейчас — примерно <b>${rub(r.current)}</b> в месяц. Следующий рост — за счёт трафика: новые каналы и масштабирование рекламы, которая уже окупается.</p>
        ${bars}`;
    } else {
      const top = weak[0];
      const tips = weak.map((s, i) => {
        const t = n.tips[s.key];
        return `
          <div class="tip ${i === 0 ? 'tip-main' : ''}">
            <p class="tip-title">${i === 0 ? 'Главное слабое место: ' : ''}${esc(t.title)}
              <span class="tip-gain">+${rub(s.gain)}/мес</span></p>
            <ul>${t.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>`;
      }).join('');
      body = `
        <p class="result-label">Упущенная выручка</p>
        <p class="result-big">≈ ${rub(r.loss)} <small>в месяц</small></p>
        <div class="result-sums">
          <div><span>Сейчас</span><b>${rub(r.current)}</b></div>
          <div><span>Если выйти на норму</span><b>${rub(r.potential)}</b></div>
        </div>
        ${bars}
        <h3 class="result-h">Что сделать</h3>
        ${tips}`;

      lastAudit = [
        'Ниша: ' + n.label,
        'Посетителей: ' + v.visitors + ', ' + stageName('c1', n) + ': ' + pct(v.c1) + ', ' + stageName('c2', n) + ': ' + pct(v.c2),
        'Средний чек: ' + rub(v.check) + ', повторные: ' + pct(v.repeat),
        'Выручка ≈ ' + rub(r.current) + ', потенциал ≈ ' + rub(r.potential) + ', упущено ≈ ' + rub(r.loss),
        'Слабое место: ' + stageName(top.key, n)
      ].join('\n');
    }
    if (!weak.length) {
      lastAudit = 'Ниша: ' + n.label + '\nВоронка в норме, выручка ≈ ' + rub(r.current) + '/мес';
    }

    $('#auditResult').innerHTML = body + `
      <div class="result-actions">
        <a href="#contact" class="btn" data-goal="result_contact">Разобрать результат на созвоне</a>
        <button type="button" class="btn btn-ghost" id="printBtn">Сохранить в PDF</button>
      </div>`;
    $('#auditResult').classList.add('has-result');
    $('#printBtn').addEventListener('click', () => { goal('audit_pdf'); window.print(); });
    $('#attachedAudit').hidden = false;
    if (window.innerWidth < 900) $('#auditResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initAudit() {
    renderNiches();
    applyNiche(false);
    $('#auditForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = readForm();
      if (!v) { $('#auditError').textContent = 'Проверьте цифры: проценты от 0 до 100, остальное — не меньше нуля.'; return; }
      $('#auditError').textContent = '';
      renderResult(v);
      goal('audit_done');
    });
  }

  // ---------- Услуги и кейсы ----------
  function renderPackages() {
    $('#packages').innerHTML = (CFG.PACKAGES || []).map((p) => `
      <article class="card package ${p.featured ? 'featured' : ''}">
        ${p.featured ? '<span class="badge">Чаще всего начинают с этого</span>' : ''}
        <h3>${esc(p.title)}</h3>
        <p class="price">${esc(p.price)}</p>
        <p class="term">${esc(p.term)}</p>
        <p class="package-result">${esc(p.result)}</p>
        <ul>${(p.items || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <a href="#contact" class="btn btn-ghost btn-block" data-goal="package_click">Обсудить</a>
      </article>`).join('');
  }

  function renderCases() {
    $('#cases-list').innerHTML = (CFG.CASES || []).map((c) => `
      <article class="card case">
        ${c.example ? '<span class="badge badge-muted">пример</span>' : ''}
        <h3>${esc(c.client)}</h3>
        <dl>
          <dt>Было</dt><dd>${esc(c.before)}</dd>
          <dt>Сделали</dt><dd>${esc(c.did)}</dd>
          <dt>Стало</dt><dd class="after">${esc(c.after)}</dd>
        </dl>
      </article>`).join('');
  }

  // ---------- Посты из Telegram-канала ----------
  function channelFallback() {
    const ch = CFG.CONTACTS && CFG.CONTACTS.channel;
    $('#posts-list').innerHTML = `
      <a class="card post post-cta" href="https://t.me/${esc(ch)}" target="_blank" rel="noopener">
        <p class="post-title">Читать канал t.me/${esc(ch)} →</p>
        <p>Разборы воронок, рекламы и CRM на реальных примерах.</p>
      </a>`;
  }

  async function loadPosts() {
    if (!WORKER) return channelFallback();
    try {
      const res = await fetch(WORKER + '/posts');
      if (!res.ok) throw new Error(res.status);
      const posts = (await res.json()).slice(0, 3);
      if (!posts.length) return channelFallback();
      $('#posts-list').innerHTML = posts.map((p) => {
        const text = p.text.length > 260 ? p.text.slice(0, 260).trim() + '…' : p.text;
        const date = p.date ? new Date(p.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
        return `
          <a class="card post" href="${esc(p.url)}" target="_blank" rel="noopener">
            <p class="post-date">${esc(date)}</p>
            <p>${esc(text)}</p>
            <span class="post-more">Читать в Telegram →</span>
          </a>`;
      }).join('');
    } catch (err) {
      console.warn('Посты канала не загрузились:', err);
      channelFallback();
    }
  }

  // ---------- Контакты ----------
  function renderContacts() {
    const c = CFG.CONTACTS || {};
    const set = (id, href, text) => { const a = $(id); a.href = href; a.textContent = text; };
    set('#c-tg', 'https://t.me/' + c.telegram, '@' + c.telegram);
    set('#c-channel', 'https://t.me/' + c.channel, 't.me/' + c.channel);
    set('#c-ig', 'https://instagram.com/' + c.instagram, '@' + c.instagram);
    set('#c-email', 'mailto:' + c.email, c.email);
    const cal = $('#calendarBtn');
    if (CFG.CALENDAR_URL) {
      cal.href = CFG.CALENDAR_URL;
    } else {
      cal.href = 'https://t.me/' + c.telegram;
      cal.textContent = 'Написать в Telegram';
    }
  }

  // ---------- Заявка ----------
  function setStatus(msg, isError) {
    const el = $('#formStatus');
    el.textContent = msg;
    el.className = 'form-status' + (isError ? ' error' : ' success');
  }

  async function sendLead(values) {
    if (WORKER) {
      const res = await fetch(WORKER + '/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      if (!res.ok) throw new Error('Worker ответил ' + res.status);
      return;
    }
    const ej = CFG.EMAILJS || {};
    if (!window.emailjs || !ej.PUBLIC_KEY) throw new Error('EmailJS недоступен');
    const message = (values.message || '-') + (values.audit ? '\n\n--- Результат аудита ---\n' + values.audit : '');
    await window.emailjs.send(ej.SERVICE_ID, ej.TEMPLATE_ID, {
      name: values.name, email: values.contact, phone: values.contact, message, source: 'IndexAA'
    }, { publicKey: ej.PUBLIC_KEY });
  }

  function mailtoFallback(values) {
    const body = `Имя: ${values.name}\nКонтакт: ${values.contact}\n\n${values.message || ''}\n\n${values.audit || ''}`;
    window.location.href = `mailto:${CFG.CONTACTS.email}?subject=${encodeURIComponent('Заявка с сайта IndexAA')}&body=${encodeURIComponent(body)}`;
  }

  function initLeadForm() {
    const form = $('#leadForm');
    const btn = $('#formSubmit');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.website) return; // бот
      delete values.website;
      if (!values.name.trim() || !values.contact.trim()) {
        setStatus('Укажите имя и как с вами связаться.', true);
        return;
      }
      values.audit = lastAudit || '';
      btn.disabled = true;
      btn.textContent = 'Отправляю…';
      setStatus('');
      try {
        await sendLead(values);
        setStatus('Готово! Заявка у меня в Telegram — скоро напишу.', false);
        goal('lead_sent');
        form.reset();
      } catch (err) {
        console.error('Заявка не отправилась:', err);
        setStatus('Не получилось отправить — открываю почту, письмо уже заполнено.', true);
        mailtoFallback(values);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Отправить заявку';
      }
    });
  }

  // ---------- Старт ----------
  document.addEventListener('DOMContentLoaded', () => {
    initMetrika();
    renderContacts();
    initAudit();
    renderPackages();
    renderCases();
    loadPosts();
    initLeadForm();
    $('#year').textContent = new Date().getFullYear();
    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-goal]');
      if (t && t.dataset.goal !== 'audit_done') goal(t.dataset.goal);
    });
  });
})();
