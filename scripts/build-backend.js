// Собирает папку _backend/ для загрузки на сервер обработчика формы:
// копирует backend/*.php и создаёт origins.php — список разрешённых
// адресов сайта из src/_data/site.js (единое место настройки домена).
import fs from "node:fs";
import path from "node:path";
import site from "../src/_data/site.js";

const SRC = path.resolve("backend");
const OUT = path.resolve("_backend");

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const file of ["submit.php", "config.example.php"]) {
  fs.copyFileSync(path.join(SRC, file), path.join(OUT, file));
}

const phpString = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const origins = site.form.allowedOrigins.map((o) => `    ${phpString(o)},`).join("\n");
fs.writeFileSync(
  path.join(OUT, "origins.php"),
  `<?php\n// Сгенерировано scripts/build-backend.js из src/_data/site.js — не править вручную.\nreturn [\n${origins}\n];\n`
);

console.log(`[backend] Готово: ${path.relative(process.cwd(), OUT)}/ (разрешённые адреса: ${site.form.allowedOrigins.join(", ")})`);
