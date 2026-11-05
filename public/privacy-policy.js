      (function () {
        var LANGS = {
          ar: {
            dir: 'rtl',
            title: 'سياسة الخصوصية — المصحف السليماني',
            h1: 'سياسة الخصوصية',
            updated: 'المصحف السليماني — آخر تحديث: 25 سبتمبر 2026',
            back: 'فتح التطبيق',
          },
          en: {
            dir: 'ltr',
            title: 'Privacy Policy — Al-Mushaf As-Sulaimani',
            h1: 'Privacy Policy',
            updated: 'Al-Mushaf As-Sulaimani — last updated: 25 September 2026',
            back: 'Open the app',
          },
          tr: {
            dir: 'ltr',
            title: 'Gizlilik Politikası — El-Mushaf Es-Süleymani',
            h1: 'Gizlilik Politikası',
            updated: 'El-Mushaf Es-Süleymani — son güncelleme: 25 Eylül 2026',
            back: 'Uygulamayı aç',
          },
          ms: {
            dir: 'ltr',
            title: 'Dasar Privasi — Al-Mushaf As-Sulaimani',
            h1: 'Dasar Privasi',
            updated: 'Al-Mushaf As-Sulaimani — kemas kini terakhir: 25 September 2026',
            back: 'Buka aplikasi',
          },
          id: {
            dir: 'ltr',
            title: 'Kebijakan Privasi — Al-Mushaf As-Sulaimani',
            h1: 'Kebijakan Privasi',
            updated: 'Al-Mushaf As-Sulaimani — terakhir diperbarui: 25 September 2026',
            back: 'Buka aplikasi',
          },
          fr: {
            dir: 'ltr',
            title: 'Politique de confidentialité — Al-Mushaf As-Sulaimani',
            h1: 'Politique de confidentialité',
            updated: 'Al-Mushaf As-Sulaimani — dernière mise à jour : 25 septembre 2026',
            back: "Ouvrir l'application",
          },
          de: {
            dir: 'ltr',
            title: 'Datenschutzerklärung — Al-Mushaf As-Sulaimani',
            h1: 'Datenschutzerklärung',
            updated: 'Al-Mushaf As-Sulaimani — zuletzt aktualisiert: 25. September 2026',
            back: 'App öffnen',
          },
          ru: {
            dir: 'ltr',
            title: 'Политика конфиденциальности — Al-Mushaf As-Sulaimani',
            h1: 'Политика конфиденциальности',
            updated: 'Al-Mushaf As-Sulaimani — последнее обновление: 25 сентября 2026 г.',
            back: 'Открыть приложение',
          },
          ur: {
            dir: 'rtl',
            title: 'رازداری کی پالیسی — المصحف السلیمانی',
            h1: 'رازداری کی پالیسی',
            updated: 'المصحف السلیمانی — آخری اپ ڈیٹ: 25 ستمبر 2026',
            back: 'ایپ کھولیں',
          },
        };
        var requested = new URLSearchParams(location.search).get('lang');
        var lang = requested && Object.prototype.hasOwnProperty.call(LANGS, requested) ? requested : 'ar';
        var conf = LANGS[lang];
        for (var code in LANGS) {
          var section = document.getElementById(code);
          if (section) {
            section.hidden = code !== lang;
          }
        }
        document.documentElement.lang = lang;
        document.documentElement.dir = conf.dir;
        document.title = conf.title;
        document.querySelector('h1').textContent = conf.h1;
        document.querySelector('.updated').textContent = conf.updated;
        document.querySelector('.back').textContent = conf.back;
        document.querySelectorAll('.lang-switch a').forEach(function (link) {
          var active = link.getAttribute('lang') === lang;
          link.classList.toggle('active', active);
          if (active) {
            link.setAttribute('aria-current', 'page');
          }
        });
      })();
