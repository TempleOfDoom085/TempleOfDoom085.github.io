# Brian Temple — Personal Portfolio

**Live site:** [templeofdoom085.github.io](https://templeofdoom085.github.io)

> AI Security Advisor @ Cranium AI · AI Agent Builder · Cybersecurity Student · Cook

Personal portfolio for Brian Temple — AI Security Advisor at [Cranium AI](https://cranium.ai) (Short Hills, NJ), working with CISOs, Chief AI Officers and third-party risk leaders at regulated enterprises on AI visibility, governance and runtime security. Background building and deploying production AI agent systems. SNHU Cyber Security student, based in Towaco, NJ.

Built from scratch in vanilla HTML, CSS and JavaScript. No framework, no build step, no tracking. Hosted on GitHub Pages.

---

## Pages

| Page | What it is |
|---|---|
| [`index.html`](index.html) | Main portfolio — about, experience, skills, projects, certifications, education, contact. Includes a Ctrl+K command palette, an interactive terminal (press `` ` ``), achievements and a few easter eggs. |
| [`career.html`](career.html) | Career timeline — Cranium AI, Unblinded, and a decade of consultative sales. |
| [`tools/`](tools/) | **Temple Tools** — 22 client-side security utilities (hash analyzer, OSINT dashboard, JWT decoder, CIDR calculator, header grader, CVE search, Bluetooth locator, and more). Zero server, zero tracking. Installable as a PWA. |
| [`ctf-writeups.html`](ctf-writeups.html) | CTF challenge writeups with methodology. |
| [`threat-globe.html`](threat-globe.html) | Live 3D threat globe (Three.js / WebGL). |
| [`soc.html`](soc.html) | SOC dashboard — CVE feed, alerts, topology. |
| [`attack-viz.html`](attack-viz.html) | Animated explainers for SQL injection, XSS, buffer overflow. |
| [`pentest-sim.html`](pentest-sim.html) | Pentest simulator. |
| [`hacker-feed.html`](hacker-feed.html) | Live GitHub activity rendered as a security ops console. |
| [`insane-engine.html`](insane-engine.html) | GPU cinematic demo — fluid ink, particles, bloom. |
| [`game.html`](game.html) | **Knights Templar: The Siege of the Undead** — browser RPG that grew out of an SNHU IT 140 Python assignment. |
| [`world.html`](world.html) + [`src/`](src/) | **REALM** — modular open-world 3D sandbox (procedural terrain, day/night, weather, vehicles, quests). |
| [`kitchen.html`](kitchen.html) | Original recipes. |

---

## Repository layout

```
.
├── index.html            # main portfolio (markup only)
├── assets/
│   ├── css/site.css      # all portfolio styles
│   └── js/
│       ├── main.js       # tabs, fade-ins, nav, terminal, achievements, hero
│       ├── particles.js  # hero particle-text explosion
│       └── visitor-intel.js
├── career.html, ctf-writeups.html, soc.html, ...   # standalone pages
├── tools/                # Temple Tools (one self-contained HTML file per tool)
├── src/                  # REALM open-world engine modules (ES modules)
├── vendor/three/         # Three.js post-processing passes
├── docs/                 # design notes (Knights Templar art guide)
├── img/                  # optional .webp room art for game.html (auto-detected)
├── sw.js                 # service worker (offline cache for tools + portfolio)
├── manifest.json         # PWA manifest for Temple Tools
├── 404.html              # GitHub Pages not-found page
├── robots.txt, sitemap.xml
└── README.md
```

---

## Run locally

Everything is static, but the service worker and absolute asset paths need an HTTP origin (not `file://`):

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

---

## Tech stack

```
Markup / styling:  HTML5 · CSS3 (custom properties, no preprocessor)
Scripting:         Vanilla JavaScript (ES6+), ES modules for REALM
3D / graphics:     Three.js (globe, engine, REALM) · hand-coded SVG · Canvas 2D
Audio:             Web Audio API — 100% procedural, no audio files
Data sources:      GitHub API · HIBP · Shodan InternetDB · URLhaus · NVD
Offline:           Service worker + PWA manifest
Hosting:           GitHub Pages
```

---

## Certifications

- Cranium AI: AI Security Certificate · AI Red Team Certificate (Sep 2026)
- Anthropic: AI Fluency, Claude Code in Action, Claude 101, Introduction to Subagents, Introduction to Claude Cowork (2026)
- Mastercard Cybersecurity Job Simulation — Forage (Feb 2024)
- University of Colorado Boulder (2023): DFIR & Threat Hunting · Ethical Hacking · Python for Security · Cybersecurity Infrastructure & Technology · Network Security · Linux Security · Cloud Security · Computer Networking · Microsoft Security
- Oracle Cloud ERP Financials 2021 Sales Specialist

---

## Contact

- Email: btemp085@gmail.com
- LinkedIn: [linkedin.com/in/briantemple1](https://www.linkedin.com/in/briantemple1)
- GitHub: [github.com/TempleOfDoom085](https://github.com/TempleOfDoom085)
