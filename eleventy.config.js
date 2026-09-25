import fs from "node:fs";
import path from "node:path";
import { HtmlBasePlugin } from "@11ty/eleventy";

// Предпросмотр на GitHub Pages: сайт лежит в подпапке /drakon-kod/.
// PATH_PREFIX задаётся в .github/workflows/pages.yml; для боевого сайта — не задаётся ("/").
const PATH_PREFIX = process.env.PATH_PREFIX || "/";

const ICON_DIR = path.resolve("node_modules/@tabler/icons/icons/outline");
const iconCache = new Map();

// Иконки Tabler (outline) встраиваются в HTML при сборке — в браузер
// не уходит ни одной JS-библиотеки. Использование: {% icon "shirt" %}
function icon(name, className = "") {
  if (!iconCache.has(name)) {
    const file = path.join(ICON_DIR, `${name}.svg`);
    if (!fs.existsSync(file)) throw new Error(`Иконка не найдена: ${name}`);
    const inner = fs
      .readFileSync(file, "utf8")
      .replace(/^[\s\S]*?<svg[^>]*>/, "")
      .replace(/<\/svg>\s*$/, "")
      .replace(/<path stroke="none" d="M0 0h24v24H0z" fill="none"\s*\/>/, "")
      .replace(/\s*\n\s*/g, "");
    iconCache.set(name, inner);
  }
  const cls = ["icon", className].filter(Boolean).join(" ");
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconCache.get(name)}</svg>`;
}

// Декоративный код в стиле DataMatrix: «L»-рамка, пунктирная граница
// и случайное (но стабильное) заполнение. Каждый модуль — квадратик,
// скруглённый снизу, как чешуйка. Это рисунок, а не настоящий код.
function datamatrix(size = 18, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const k = 0.9; // размер модуля (зазор между «чешуйками»)
  const r = 0.34; // радиус скругления снизу
  const o = (1 - k) / 2;
  let d = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let on;
      if (x === 0 || y === size - 1) on = true;
      else if (y === 0) on = x % 2 === 0;
      else if (x === size - 1) on = (size - 1 - y) % 2 === 0;
      else on = rnd() > 0.5;
      if (!on) continue;
      const px = +(x + 1 + o).toFixed(2);
      const py = +(y + 1 + o).toFixed(2);
      d += `M${px} ${py}h${k}v${+(k - r).toFixed(2)}a${r} ${r} 0 0 1-${r} ${r}h-${+(k - 2 * r).toFixed(2)}a${r} ${r} 0 0 1-${r}-${r}z`;
    }
  }
  const vb = size + 2;
  return `<svg class="datamatrix" viewBox="0 0 ${vb} ${vb}" aria-hidden="true" focusable="false"><path d="${d}" fill="currentColor"/></svg>`;
}

const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Подсвечивает заглушки [ЗАПОЛНИТЬ…], [ПРОВЕРИТЬ…], [АДРЕС], [N] в тексте,
// чтобы их было видно на странице до запуска.
const STUB_RE = /\[(?:ЗАПОЛНИТЬ|ПРОВЕРИТЬ|АДРЕС|N)[^\]]*\]/g;
function stub(str) {
  return escapeHtml(str).replace(STUB_RE, (m) => `<span class="stub">${m}</span>`);
}

export default function (eleventyConfig) {
  // Дописывает PATH_PREFIX ко всем ссылкам вида "/..." в готовом HTML.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/favicon.svg": "favicon.svg" });

  eleventyConfig.addShortcode("icon", icon);
  eleventyConfig.addShortcode("datamatrix", datamatrix);

  eleventyConfig.addFilter("stub", (str) => stub(str));
  eleventyConfig.addFilter("isActive", (itemUrl, pageUrl) =>
    itemUrl === "/" ? pageUrl === "/" : String(pageUrl || "").startsWith(itemUrl)
  );
  eleventyConfig.addFilter("json", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c")
  );
  eleventyConfig.addFilter("stripStubs", (str) =>
    String(str ?? "").replace(STUB_RE, "").replace(/\s{2,}/g, " ").trim()
  );
  // Подсветка заглушек в уже готовом HTML (текст новостей из Markdown)
  eleventyConfig.addFilter("stubHtml", (html) =>
    String(html ?? "").replace(STUB_RE, (m) => `<span class="stub">${m}</span>`)
  );
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  eleventyConfig.addFilter("ruDate", (d) => {
    const date = new Date(d);
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("bySlug", (list, slug) => (list || []).find((i) => i.slug === slug));

  eleventyConfig.addWatchTarget("src/assets/");

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX,
  };
}
