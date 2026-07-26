import { translations } from './content.js';

const STORAGE_KEY = 'sillyclient-language';

function preferredLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && translations[saved]) return saved;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function createI18n() {
  let language = preferredLanguage();

  function apply(nextLanguage = language) {
    language = translations[nextLanguage] ? nextLanguage : 'zh';
    const copy = translations[language];
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = copy.documentTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', copy.metaDescription);

    document.querySelectorAll('[data-mobile-i18n]').forEach((element) => {
      const value = copy[element.dataset.mobileI18n];
      if (value) element.textContent = value;
    });
    document.querySelectorAll('[data-mobile-i18n-aria]').forEach((element) => {
      const value = copy[element.dataset.mobileI18nAria];
      if (value) element.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-mobile-i18n-alt]').forEach((element) => {
      const value = copy[element.dataset.mobileI18nAlt];
      if (value) element.setAttribute('alt', value);
    });
    document.querySelectorAll('[data-mobile-language]').forEach((button) => {
      const active = button.dataset.mobileLanguage === language;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem(STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent('mobile-language-change', { detail: { language } }));
  }

  document.querySelectorAll('[data-mobile-language]').forEach((button) => {
    button.addEventListener('click', () => apply(button.dataset.mobileLanguage));
  });

  apply(language);
  return { apply, get language() { return language; } };
}
