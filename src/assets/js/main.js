/* Дракон.Код — скрипты сайта. Без библиотек. */
(function () {
  "use strict";

  var CFG = window.DK_CONFIG || {};

  // Цель Яндекс Метрики (срабатывает, только если посетитель разрешил Метрику)
  function goal(name) {
    if (window.ym && CFG.metrikaId) window.ym(Number(CFG.metrikaId), "reachGoal", name);
  }
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Шапка и мобильное меню ---------- */
  var header = document.getElementById("siteHeader");
  var toggle = document.getElementById("navToggle");

  function onScroll() { header.classList.toggle("is-scrolled", window.scrollY > 8); }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function setMenu(open) {
    header.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    document.body.style.overflow = open ? "hidden" : "";
  }
  toggle.addEventListener("click", function () { setMenu(!header.classList.contains("nav-open")); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && header.classList.contains("nav-open")) { setMenu(false); toggle.focus(); }
  });
  document.querySelectorAll("#mobileNav a").forEach(function (a) {
    a.addEventListener("click", function () { setMenu(false); });
  });

  /* ---------- Появление блоков при прокрутке ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (!reduceMotion && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Модальное окно с формой ---------- */
  var modal = document.getElementById("leadModal");
  var canModal = modal && typeof modal.showModal === "function";

  function prefillForm(form, groupSlug, comment) {
    if (!form) return;
    if (groupSlug) {
      var opt = form.querySelector('select[name="product_group"] option[data-slug="' + groupSlug + '"]');
      if (opt) opt.selected = true;
    }
    if (comment) form.elements.comment.value = comment;
  }

  function openLead(groupSlug, comment) {
    var box = modal.querySelector(".lead-box");
    box.classList.remove("is-sent");
    prefillForm(box.querySelector("form"), groupSlug, comment);
    setMenu(false);
    modal.showModal();
  }

  if (canModal) {
    document.addEventListener("click", function (e) {
      var trigger = e.target.closest("[data-lead]");
      if (!trigger) return;
      e.preventDefault();
      openLead(trigger.getAttribute("data-lead-group"), trigger.getAttribute("data-lead-comment"));
    });
    modal.querySelector("[data-modal-close]").addEventListener("click", function () { modal.close(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.close(); });
  }

  /* ---------- Закреплённая кнопка на мобильном ---------- */
  var sticky = document.getElementById("stickyCta");
  var leadBlock = document.getElementById("zayavka");
  var footer = document.querySelector(".footer");
  if (sticky && "IntersectionObserver" in window) {
    var visible = new Set();
    var stickyIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.isIntersecting ? visible.add(en.target) : visible.delete(en.target); });
      sticky.classList.toggle("is-hidden", visible.size > 0);
    });
    [leadBlock, footer].forEach(function (el) { if (el) stickyIo.observe(el); });
  }

  /* ---------- Форма заявки ---------- */
  var MESSAGES = {
    nameEmpty: "Укажите, как к вам обращаться",
    phoneEmpty: "Укажите телефон, чтобы мы могли перезвонить",
    phoneBad: "Проверьте номер: нужно не меньше 10 цифр, например +7 900 000-00-00",
    groupEmpty: "Выберите товарную группу или «Другое»",
    consent: "Без согласия на обработку персональных данных мы не сможем принять заявку"
  };

  function setError(input, message) {
    var field = input.closest(".field");
    var err = field.querySelector(".field__error");
    field.classList.toggle("is-invalid", !!message);
    input.setAttribute("aria-invalid", message ? "true" : "false");
    if (err) err.textContent = message || "";
  }

  function validate(form) {
    var el = form.elements;
    var firstBad = null;
    var checks = [
      [el.name, el.name.value.trim().length < 2 ? MESSAGES.nameEmpty : ""],
      [el.phone, (function () {
        var v = el.phone.value.trim();
        if (!v) return MESSAGES.phoneEmpty;
        var digits = v.replace(/\D/g, "");
        if (!/^[0-9+()\-\s]+$/.test(v) || digits.length < 10 || digits.length > 15) return MESSAGES.phoneBad;
        return "";
      })()],
      [el.product_group, el.product_group.value ? "" : MESSAGES.groupEmpty],
      [el.consent, el.consent.checked ? "" : MESSAGES.consent]
    ];
    checks.forEach(function (c) {
      setError(c[0], c[1]);
      if (c[1] && !firstBad) firstBad = c[0];
    });
    return firstBad;
  }

  function phoneHtml() {
    if (CFG.phoneHref) return '<a href="tel:' + CFG.phoneHref + '">' + CFG.phone + "</a>";
    return CFG.phone || "";
  }

  function send(payload) {
    if (CFG.mock) {
      // Локальный просмотр (npm run dev): заявка не уходит на сервер.
      console.info("[Дракон.Код] Тестовая отправка заявки:", payload);
      return new Promise(function (resolve) { setTimeout(function () { resolve({ success: true }); }, 700); });
    }
    return fetch(CFG.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  document.querySelectorAll("[data-lead-form]").forEach(function (form) {
    var box = form.closest(".lead-box");
    var status = form.querySelector(".lead-form__status");
    var btn = form.querySelector('button[type="submit"]');

    // Снимаем ошибку, как только пользователь исправил поле
    form.addEventListener("input", function (e) {
      if (e.target.getAttribute("aria-invalid") === "true") setError(e.target, "");
    });
    form.addEventListener("change", function (e) {
      if (e.target.getAttribute("aria-invalid") === "true") setError(e.target, "");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.textContent = "";
      status.classList.remove("is-error");

      // Спам-бот заполнил скрытое поле — делаем вид, что всё хорошо
      if (form.elements.website.value) { box.classList.add("is-sent"); return; }

      var bad = validate(form);
      if (bad) { bad.focus(); return; }

      var el = form.elements;
      var payload = {
        name: el.name.value.trim(),
        phone: el.phone.value.trim(),
        product_group: el.product_group.value,
        comment: el.comment.value.trim(),
        page: window.location.href,
        page_title: document.title,
        website: el.website.value
      };

      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");

      send(payload)
        .then(function (res) {
          if (!res || !res.success) throw new Error((res && res.error) || "send failed");
          form.reset();
          box.classList.add("is-sent");
          goal("lead_sent");
          var ok = box.querySelector(".lead-success");
          if (ok) ok.focus();
        })
        .catch(function () {
          status.classList.add("is-error");
          status.innerHTML = "Не удалось отправить заявку. Попробуйте ещё раз через минуту или позвоните нам: " + phoneHtml();
        })
        .then(function () {
          btn.disabled = false;
          btn.removeAttribute("aria-busy");
        });
    });
  });

  /* ---------- Калькулятор ---------- */
  document.querySelectorAll("[data-calc]").forEach(function (calc) {
    var cfg = JSON.parse(calc.querySelector("[data-calc-config]").textContent);
    var sumEl = calc.querySelector("[data-calc-sum]");
    var el = calc.elements;

    function num(input) {
      var n = parseInt(input.value, 10);
      return isFinite(n) && n > 0 ? n : 0;
    }

    function update() {
      if (!cfg.showNumbers) return; // пока коэффициенты — заглушки, показываем «от [N] ₽»
      var base = (cfg.groupBase && cfg.groupBase[el.group.value || "other"]) || 0;
      var total = base + num(el.sku) * cfg.perSku + num(el.units) * cfg.perUnit;
      if (el.china.checked) total += num(el.units) * cfg.chinaPerUnit;
      total = Math.max(total, cfg.min || 0);
      sumEl.textContent = "от " + Math.round(total).toLocaleString("ru-RU") + " ₽";
    }

    // Ссылка вида /ceny/?group=igrushki&china=1#kalkulyator — подставляем выбор
    var params = new URLSearchParams(window.location.search);
    var presetGroup = params.get("group");
    if (presetGroup && el.group.querySelector('option[value="' + presetGroup + '"]')) el.group.value = presetGroup;
    if (params.get("china") === "1") el.china.checked = true;

    calc.addEventListener("input", update);
    calc.addEventListener("change", update);
    update();

    calc.querySelector("[data-calc-submit]").addEventListener("click", function () {
      goal("calc_request");
      var groupOpt = el.group.options[el.group.selectedIndex];
      var parts = [
        "Расчёт из калькулятора:",
        "группа — " + (el.group.value ? groupOpt.text : "не выбрана"),
        "артикулов — " + num(el.sku),
        "единиц — " + num(el.units),
        "маркировка в Китае — " + (el.china.checked ? "да" : "нет")
      ];
      if (cfg.showNumbers) parts.push("предварительно — " + sumEl.textContent);
      var comment = parts[0] + " " + parts.slice(1).join("; ");
      if (canModal) {
        openLead(el.group.value, comment);
      } else if (leadBlock) {
        prefillForm(leadBlock.querySelector("form"), el.group.value, comment);
        leadBlock.scrollIntoView();
      }
    });
  });

  /* ---------- Cookie и Яндекс Метрика (как на dragon-trade) ----------
     Счётчик загружается только после «Принять всё». Выбор хранится
     в браузере посетителя; если хранилище недоступно — спросим снова. */
  var COOKIE_KEY = "dk_cookie_consent"; // "all" | "necessary"

  function loadMetrika() {
    if (!CFG.metrikaId || window.ym) return;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    window.ym(Number(CFG.metrikaId), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true });
  }

  var banner = document.getElementById("cookieBanner");
  var consent = null;
  try { consent = localStorage.getItem(COOKIE_KEY); } catch (e) {}
  if (consent === "all") loadMetrika();
  if (banner && consent !== "all" && consent !== "necessary") {
    banner.hidden = false;
    document.body.classList.add("has-cookie-banner");
    banner.addEventListener("click", function (e) {
      var choice = e.target.getAttribute("data-cookie");
      if (!choice) return;
      try { localStorage.setItem(COOKIE_KEY, choice); } catch (err) {}
      banner.hidden = true;
      document.body.classList.remove("has-cookie-banner");
      if (choice === "all") loadMetrika();
    });
  }
})();
