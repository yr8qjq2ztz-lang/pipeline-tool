import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const chunksDir = path.join(root, ".next", "static", "chunks");

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function main() {
  if (!fs.existsSync(chunksDir)) {
    console.error(`[sizes] Missing ${chunksDir}. Run \`npm run build\` first.`);
    process.exitCode = 1;
    return;
  }

  const files = listFilesRecursive(chunksDir)
    .filter((f) => f.endsWith(".js") || f.endsWith(".css"))
    .map((f) => {
      const st = fs.statSync(f);
      return { file: path.relative(root, f).replaceAll("\\\\", "/"), bytes: st.size };
    })
    .sort((a, b) => b.bytes - a.bytes);

  const top = files.slice(0, 20);
  const total = files.reduce((sum, x) => sum + x.bytes, 0);

  console.log(`[sizes] Top ${top.length} chunks/assets by raw size (total in .next/static/chunks: ${formatBytes(total)})`);
  for (const x of top) {
    console.log(`- ${formatBytes(x.bytes).padStart(9)}  ${x.file}`);
  }
}

main();
