// Собирает все заглушки [ЗАПОЛНИТЬ…], [ПРОВЕРИТЬ…], [АДРЕС], [N] по файлам
// в ZAGLUSHKI.md — что нужно дописать и проверить перед запуском.
// Запуск: npm run stubs
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "backend"];
const EXT = new Set([".njk", ".md", ".json", ".js", ".php", ".css", ".svg"]);
const RE = /\[(?:ЗАПОЛНИТЬ|ПРОВЕРИТЬ|АДРЕС|N)[^\]]*\]/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return EXT.has(path.extname(e.name)) ? [p] : [];
  });
}

const groups = { "ЗАПОЛНИТЬ": [], "ПРОВЕРИТЬ": [], "N / АДРЕС": [] };
let total = 0;
const byFile = [];

for (const file of ROOTS.flatMap(walk).sort()) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const hits = [];
  lines.forEach((line, i) => {
    const found = line.match(RE);
    if (!found) return;
    const text = line.trim().replace(/\s+/g, " ").slice(0, 160);
    hits.push({ line: i + 1, marks: [...new Set(found)], text });
    total += found.length;
  });
  if (hits.length) byFile.push({ file: file.replace(/\\/g, "/"), hits });
}

let md = `# Заглушки перед запуском\n\nСгенерировано командой \`npm run stubs\`. Всего меток: ${total}.\n\n`;
md += `- **[ЗАПОЛНИТЬ]** — наши данные (контакты, реквизиты, цены, сроки, тексты).\n`;
md += `- **[ПРОВЕРИТЬ]** — факты о маркировке, сверить с официальными источниками.\n`;
md += `- **[N]**, **[АДРЕС]** — числа и адрес.\n\n`;
for (const { file, hits } of byFile) {
  md += `## ${file}\n\n`;
  for (const h of hits) md += `- стр. ${h.line}: ${h.marks.join(", ")} — \`${h.text.replace(/`/g, "'")}\`\n`;
  md += "\n";
}
fs.writeFileSync("ZAGLUSHKI.md", md);
console.log(`[stubs] ${total} меток в ${byFile.length} файлах → ZAGLUSHKI.md`);
