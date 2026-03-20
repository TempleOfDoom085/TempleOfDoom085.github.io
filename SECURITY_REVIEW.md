# Security Code Review — TempleOfDoom085.github.io

**Date:** 2026-03-20
**Reviewer:** Automated Security Review (Claude)
**Scope:** Full static-site codebase (`index.html`, `game.html`)
**Hosting:** GitHub Pages (HTTPS, CDN)
**Status:** All low-severity findings remediated — see Fixes Applied section.

---

## Executive Summary

This is a **client-side-only static website** with no backend, no database, and no user authentication. That architecture eliminates entire categories of server-side vulnerabilities. No critical or high-severity vulnerabilities were found. Three low-severity findings and one informational note are documented below.

---

## Vulnerability Findings

### FINDING 1 — LOW | innerHTML Used with State Values (Potential Self-XSS)

**Files / Lines:**
- `game.html:1631` — `combatLogMsg()` uses `el.innerHTML += text + '<br>'`
- `game.html:1976` — `updateStats()` uses `el.innerHTML = \`..LVL ${STATE.level}..ATK ${stats.atk}..\``
- `game.html:3107` — Win screen uses `innerHTML` with multiple STATE values
- `game.html:3398` — Death screen uses `innerHTML` with multiple STATE values

**Description:**
Several locations insert STATE values (e.g. `STATE.level`, `STATE.xp`, `STATE.battlesWon`) directly into `innerHTML`. The `loadGame()` function (line 1220) deserializes these values from `localStorage` with `JSON.parse()` but applies no type validation or sanitization before storing them into STATE. A user who manually edits their own `localStorage` (e.g. via browser DevTools) could set `STATE.level` to a string like `<img src=x onerror=alert(1)>`, which would be rendered as HTML when the win/death screens or stats bar are updated.

**Classification:** Self-XSS — this only affects the user who modifies their own browser storage. There is no mechanism for one user's data to reach another user.

**Recommended Fix:**

Option A — Use `textContent` instead of `innerHTML` wherever user-derived values appear:
```javascript
// Before (vulnerable pattern):
el.innerHTML = `<span>LVL ${STATE.level}</span>`;

// After (safe):
const span = document.createElement('span');
span.textContent = `LVL ${STATE.level}`;
el.appendChild(span);
```

Option B — Validate STATE after deserialization in `loadGame()`:
```javascript
const data = JSON.parse(raw);
// Validate types before accepting
if (typeof data.state.level !== 'number' || !Number.isInteger(data.state.level)) {
  addLog('Corrupted save data.', 'system');
  return false;
}
```

Option C — Escape values before inserting into `innerHTML`:
```javascript
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
el.innerHTML = `<span>LVL ${escapeHTML(STATE.level)}</span>`;
```

---

### FINDING 2 — LOW | No Type/Bounds Validation on Loaded Save Data

**File / Lines:** `game.html:1220–1260`

**Description:**
`loadGame()` parses a JSON blob from `localStorage` and directly assigns its fields to STATE without validating types or bounds:

```javascript
STATE.hp = s.hp;          // Could be Infinity, NaN, or a string
STATE.level = s.level;    // Could be 9999 or a non-integer
STATE.inventory = s.inventory || [];  // Could be a non-array
```

While this cannot harm other users (localStorage is per-origin, per-browser), it means users can trivially cheat by editing their save. More importantly, invalid types could cause unexpected JavaScript errors or render garbage into the UI, which is a robustness concern.

**Recommended Fix:**
Add type guards after deserialization:
```javascript
function clampInt(val, min, max) {
  const n = parseInt(val, 10);
  return isNaN(n) ? min : Math.max(min, Math.min(max, n));
}

STATE.hp = clampInt(s.hp, 1, 9999);
STATE.level = clampInt(s.level, 1, 99);
STATE.inventory = Array.isArray(s.inventory) ? s.inventory : [];
```

---

### FINDING 3 — LOW | `combatLogMsg()` Uses `innerHTML +=` Accumulation

**File / Lines:** `game.html:1628–1633`

```javascript
function combatLogMsg(text) {
  const el = document.getElementById('combatLog');
  if (!el) return;
  el.innerHTML += text + '<br>';
  el.scrollTop = 999999;
}
```

**Description:**
All current callers pass hardcoded developer-controlled string literals, so there is no active XSS. However, `innerHTML +=` is a dangerous pattern for two reasons:

1. **Future risk:** If `combatLogMsg()` is ever called with a user-derived or externally-sourced string, it becomes an XSS sink.
2. **Performance:** `innerHTML +=` re-serializes and re-parses the entire DOM subtree on every call. In a long combat session this causes unnecessary work.

**Recommended Fix:**
```javascript
function combatLogMsg(text) {
  const el = document.getElementById('combatLog');
  if (!el) return;
  const line = document.createElement('span');
  line.textContent = text;
  el.appendChild(line);
  el.appendChild(document.createElement('br'));
  el.scrollTop = 999999;
}
```

---

### FINDING 4 — INFORMATIONAL | Google Fonts CDN Dependency

**File / Lines:** `index.html` CSS `@import` (line ~15)

**Description:**
The portfolio page loads fonts from `fonts.googleapis.com` via a CSS `@import`. This is a standard and widely-accepted practice, but it creates a minor third-party dependency:

- If Google's CDN is unavailable, the font degrades to the system fallback (acceptable).
- The CDN can in theory observe which pages request these fonts (a privacy consideration for visitors).
- Subresource Integrity (SRI) cannot be applied to CSS `@import` URLs.

**Recommended Fix (optional):**
Self-host the font files (download from Google Fonts and serve them from the repo). This eliminates the third-party dependency entirely and is fully supported by GitHub Pages.

---

## Strengths (What Is Done Well)

| Practice | Assessment |
|---|---|
| No server-side code | Eliminates server-side injection, RCE, auth bypass |
| No external APIs or secrets | No credential leakage, no SSRF surface |
| No npm dependencies | Zero supply-chain risk from third-party packages |
| `addLog()` uses `textContent` | Main game log is XSS-safe |
| No `eval()` / `Function()` | No dynamic code execution |
| No free-form text input fields | Eliminates most injection vectors |
| localStorage wrapped in try/catch | Handles storage quota errors gracefully |
| Image loading with `onerror` fallback | Robust fallback to SVG art |
| HTTPS via GitHub Pages | Transport security enforced by host |

---

## OWASP Top 10 Mapping

| Category | Status |
|---|---|
| A01 Broken Access Control | N/A — no accounts, no access control |
| A02 Cryptographic Failures | N/A — no sensitive data transmitted or stored |
| A03 Injection (XSS) | LOW — self-XSS only via localStorage (Findings 1, 3) |
| A04 Insecure Design | LOW — missing save-data validation (Finding 2) |
| A05 Security Misconfiguration | N/A — static hosting with no configuration surface |
| A06 Vulnerable Components | INFO — Google Fonts CDN (Finding 4) |
| A07 Auth & Session Failures | N/A — no authentication |
| A08 Software/Data Integrity | LOW — no integrity check on save data (Finding 2) |
| A09 Logging & Monitoring | N/A — client-side only, no server logs needed |
| A10 SSRF | N/A — no server-side requests |

---

## Fixes Applied

All three low-severity findings were remediated:

| Finding | Fix |
|---|---|
| Finding 1 — Self-XSS via innerHTML | Win/death stats use `textContent`; stats bar uses `createElement`+`textContent` |
| Finding 2 — No save data validation | `loadGame()` validates types with `clampInt`, `safeBool`, `safeStr`, `safeArr`, `safeObj` helpers |
| Finding 3 — `innerHTML +=` in combatLogMsg | Replaced with `createElement('span')` + `textContent` + `createElement('br')` |

---

## Overall Rating

**A+ (Secure)** — No vulnerabilities remain. All previous low-severity findings have been remediated. The codebase now validates all deserialized save data and uses `textContent` / `createElement` throughout for dynamic content.

---

## Remediation Priority

| Finding | Severity | Effort | Priority |
|---|---|---|---|
| Finding 1 — Self-XSS via innerHTML | Low | Low | Address in next update |
| Finding 2 — No save data validation | Low | Low | Address in next update |
| Finding 3 — `innerHTML +=` pattern | Low | Low | Address in next update |
| Finding 4 — Google Fonts CDN | Info | Medium | Optional / low priority |
