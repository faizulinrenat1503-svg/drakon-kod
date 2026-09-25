// Публикует предпросмотр сайта на GitHub Pages:
// https://faizulinrenat1503-svg.github.io/drakon-kod/
// Сайт собирается в папку _preview (подпапка /drakon-kod/, страницы закрыты
// от поисковиков) и отправляется в ветку gh-pages. Запуск: npm run preview
import { execSync } from "node:child_process";
import fs from "node:fs";
import ghpages from "gh-pages";

const OUT = "_preview";
const env = {
  ...process.env,
  PREVIEW: "1",
  PATH_PREFIX: "/drakon-kod/",
  SITE_URL: "https://faizulinrenat1503-svg.github.io/drakon-kod",
};

fs.rmSync(OUT, { recursive: true, force: true });
execSync(`npx @11ty/eleventy --output=${OUT} --quiet`, { stdio: "inherit", env });
fs.writeFileSync(`${OUT}/.nojekyll`, ""); // GitHub Pages отдаёт файлы как есть

const commit = execSync("git rev-parse --short HEAD").toString().trim();
await ghpages.publish(OUT, {
  branch: "gh-pages",
  dotfiles: true,
  message: `Предпросмотр: сборка из ${commit}`,
});
console.log("[preview] Опубликовано: https://faizulinrenat1503-svg.github.io/drakon-kod/ (обновится через 1–2 минуты)");
