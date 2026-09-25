// Главный конфиг сайта «Дракон.Код».
// Домен, адрес обработчика формы и список разрешённых адресов (CORS)
// задаются ТОЛЬКО здесь. Этот же файл читает scripts/build-backend.js,
// чтобы собрать список разрешённых адресов для submit.php.

// [ЗАПОЛНИТЬ] Домен сайта без https:// и без слеша на конце, например "drakon-kod.ru".
const DOMAIN = "[ЗАПОЛНИТЬ-домен]";

// Для предпросмотра на GitHub Pages адрес сайта и режим PREVIEW задаются
// в .github/workflows/pages.yml. Боевой сайт собирается без них.
const SITE_URL = process.env.SITE_URL || `https://${DOMAIN}`;

export default {
  brand: "Дракон.Код",
  domain: DOMAIN,
  url: SITE_URL,
  // Предпросмотр: страницы закрыты от поисковиков (noindex, robots.txt Disallow).
  preview: process.env.PREVIEW === "1",
  locale: "ru_RU",
  defaultDescription:
    "Центр маркировки товаров для селлеров Wildberries, Ozon, Яндекс Маркета и импортёров из Китая: подключение, карточки, коды и этикетки, ввод в оборот.",

  form: {
    // Куда отправляется заявка. Обработчик лежит в папке backend/.
    // [ЗАПОЛНИТЬ] Поменяйте, если обработчик будет по другому адресу.
    endpoint: `https://form.${DOMAIN}/submit.php`,
    // С каких адресов обработчик принимает заявки (CORS).
    allowedOrigins: [SITE_URL, `https://www.${DOMAIN}`],
  },

  contacts: {
    phone: "[ЗАПОЛНИТЬ: телефон]",
    // Телефон для ссылки tel: — только цифры и «+», например "+79001234567".
    phoneHref: "",
    email: "[ЗАПОЛНИТЬ: почта]",
    hours: "[ЗАПОЛНИТЬ: режим работы]",
  },

  legal: {
    company: "ООО «[ЗАПОЛНИТЬ]»",
    inn: "[ЗАПОЛНИТЬ]",
    ogrn: "[ЗАПОЛНИТЬ]",
    address: "[АДРЕС]",
  },

  // Показатели на первом экране главной.
  stats: [
    { value: "[N]+", label: "селлеров" },
    { value: "[N]", label: "кодов оформлено" },
    { value: "от [N] дней", label: "до первых кодов" },
  ],

  features: {
    // Блок отзывов. Включить, когда появятся настоящие отзывы (src/_data/reviews.json).
    reviews: false,
  },

  // Яндекс Метрика — как на dragon-trade: счётчик загружается только после того,
  // как посетитель нажал «Принять всё» в плашке про cookie.
  // [ЗАПОЛНИТЬ] Номер счётчика (цифры) — создать новый счётчик для домена Дракон.Код
  // на metrika.yandex.ru. Пока пусто — Метрика и плашка не выводятся.
  // Цели для настройки в Метрике (тип «JavaScript-событие»):
  //   lead_sent    — заявка отправлена;
  //   calc_request — нажата «Получить точный расчёт» в калькуляторе.
  metrika: {
    id: "",
  },

  // Яндекс Вебмастер: код подтверждения прав из мета-тега
  // <meta name="yandex-verification" content="…"> — вписать только content.
  // [ЗАПОЛНИТЬ] при подключении сайта в webmaster.yandex.ru.
  yandexVerification: "",

  nav: [
    { title: "Услуги", url: "/uslugi/" },
    { title: "Товарные группы", url: "/tovarnye-gruppy/" },
    { title: "Маркировка в Китае", url: "/markirovka-v-kitae/" },
    { title: "Цены", url: "/ceny/" },
    { title: "Вопросы", url: "/voprosy/" },
  ],

  footerNav: [
    { title: "Услуги", url: "/uslugi/" },
    { title: "Товарные группы", url: "/tovarnye-gruppy/" },
    { title: "Маркировка в Китае", url: "/markirovka-v-kitae/" },
    { title: "Цены", url: "/ceny/" },
    { title: "Вопросы", url: "/voprosy/" },
    { title: "Новости", url: "/novosti/" },
    { title: "О компании", url: "/o-kompanii/" },
    { title: "Контакты", url: "/kontakty/" },
  ],
};
