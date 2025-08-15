// script.js — управление формой и EmailJS
(function () {
  // ====== Настройки EmailJS (вставьте ваши реальные значения) ======
  const EMAILJS_PUBLIC_KEY = 'rVeuQA5n-kyNN_y-_'; // <- ваш Public Key / User ID из EmailJS Integration
  const EMAILJS_SERVICE_ID = 'service_ys1dbdu';     // ваш Service ID
  const EMAILJS_TEMPLATE_ID = 'template_j8lqisd';  // ваш Template ID
  // =================================================================

  // Вспомогательная функция для статуса
  function setStatus(msg, isError = false) {
    const statusEl = document.getElementById('formStatus');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#b00000' : '#0a0a0a';
  }

  // Функция fallback: открывает mailto если EmailJS не сработал / не настроен
  function openMailtoFallback(values) {
    const subject = encodeURIComponent('Заявка с сайта IndexAA');
    const body = encodeURIComponent(
      `Имя: ${values.name || '-'}\nEmail: ${values.email || '-'}\nТелефон: ${values.phone || '-'}\n\n${values.message || '-'}`
    );
    window.location.href = `mailto:artem-agafon@rambler.ru?subject=${subject}&body=${body}`;
  }

  // Отправка через EmailJS
  async function sendWithEmailJS(formEl) {
    if (!window.emailjs) {
      throw new Error('EmailJS SDK не загружен.');
    }
    if (!EMAILJS_PUBLIC_KEY || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID) {
      throw new Error('EmailJS параметры пусты (PUBLIC/SERVICE/TEMPLATE).');
    }

    // Инициализация один раз
    if (!window.__emailjs_init_done) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      window.__emailjs_init_done = true;
      console.log('EmailJS инициализирован.');
    }

    // sendForm принимает селектор формы или сам элемент
    return emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, formEl);
  }

  // Навешиваем обработчики после загрузки DOM
  window.addEventListener('DOMContentLoaded', () => {
    // Инициализация проверки SDK (опционально)
    if (!window.emailjs) {
      console.warn('EmailJS SDK не найден. Убедитесь, что CDN-скрипт подключен перед script.js.');
    }

    const leadForm = document.getElementById('leadForm');
    const submitBtn = document.getElementById('formSubmit');

    if (!leadForm) {
      console.warn('Форма leadForm не найдена на странице.');
      return;
    }

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setStatus('');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';

      const formData = new FormData(leadForm);
      const values = Object.fromEntries(formData.entries());

      // Простая валидация
      if (!values.name || !values.email || !values.message) {
        setStatus('Заполните обязательные поля: имя, email и сообщение.', true);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
        return;
      }

      // Попытка EmailJS -> fallback mailto
      try {
        await sendWithEmailJS('#leadForm'); // можно передать селектор или element
        console.log('EmailJS: отправлено успешно');
        setStatus('Спасибо! Ваша заявка отправлена. Я свяжусь с вами в ближайшее время.');
        leadForm.reset();
      } catch (err) {
        console.error('Ошибка EmailJS:', err);
        setStatus('Ошибка отправки через EmailJS — открою почтовый клиент (fallback).', true);
        // fallback
        try {
          openMailtoFallback(values);
        } catch (fallbackErr) {
          console.error('Mailto fallback не сработал', fallbackErr);
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить заявку';
      }
    });
  });
})();
