// Builds Shadow Keep into a single HTML page.
//   node build.mjs github  -> dist/github/index.html  (standalone page, team leaderboard via Supabase)
//   node build.mjs claude  -> dist/claude/shadow-keep.html (claude.ai artifact, leaderboard via artifact db)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const src = (f) => readFileSync(join(root, "src", f), "utf8");

const TARGETS = {
  github: {
    out: "index.html",
    standalone: true,
    config: {
      target: "github",
      supabase: {
        url: "https://ckrtnunhbdtirftwwozw.supabase.co",
        // Publishable key: designed to be public. Row-level security limits it to
        // reading/adding scores and adding (never reading) leads.
        key: "sb_publishable_YuPko5Wl3ClziZ_ERlqEbg_0kcV2QDG",
      },
    },
  },
  claude: {
    out: "dist/claude/shadow-keep.html",
    standalone: false,
    config: { target: "claude", supabase: { url: "", key: "" } },
  },
};

const target = TARGETS[process.argv[2] || "github"];
if (!target) throw new Error("Unknown target. Use: github | claude");

const order = src("ORDER").split("\n").filter(Boolean);
const js = order.map((f) => `// ---- ${f} ----\n${src(f)}`).join("\n");
const script =
  `<script>\n(() => {\n"use strict";\nconst CONFIG = ${JSON.stringify(target.config)};\n` +
  js +
  `\n})();\n</script>\n`;
const page = src("head.html") + `<style>\n${src("styles.css")}</style>\n` + src("body.html") + script;

const html = target.standalone
  ? `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' https://ckrtnunhbdtirftwwozw.supabase.co">
<meta name="description" content="Shadow Keep: a 16-bit style AI security quest by Brian Temple. Find the shadow AI, validate the supply chain, red team the Rogue Model.">
<style>:root{color-scheme:dark;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
${page}
</body>
</html>
`
  : page;

const out = join(root, target.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`built ${target.out} (${(html.length / 1024).toFixed(0)} KB)`);
