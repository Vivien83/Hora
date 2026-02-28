---
name: hora-browser
description: Debug-first browser automation — persistent session with always-on console/network capture, screenshots, visual diffs, a11y audit, link checking. Use when user says browser, debug, screenshot, capture, visual test, check links, test page, verify deploy, a11y audit, responsive test, console errors, network errors. Do NOT use for design methodology — use hora-design. Do NOT use for screenshot analysis — use hora-vision.
metadata:
  author: HORA
  version: 2.0.0
compatibility: Claude Code. Requires Playwright (auto-installed if missing). Cross-platform macOS/Linux/Windows. Node.js 18+.
---

# Skill: hora-browser v2

> Debug-first browser automation with persistent session and always-on event capture.

Architecture: a persistent Playwright server (`browser-server.ts`) runs in background. A unified CLI (`hora-browser.mjs`) sends commands via HTTP. Console logs, network requests, and page errors are captured automatically from the moment the session starts.

## Single entry point

```bash
node hora-browser.mjs <command> [args...]
```

The bootstrap script handles tsx path resolution (including paths with spaces). The server starts automatically on first use. No manual setup required.

Every command outputs **step-by-step progress on stderr** so you can follow exactly what is happening in Claude Code. Structured data goes to stdout.

---

## WHAT it does

1. **Navigate + auto-diagnose** — go to a URL and immediately get screenshot, console errors, failed requests, network stats
2. **Live event capture** — console logs, network activity, and page errors are captured continuously (always-on)
3. **Multi-viewport capture** — screenshots at 4 breakpoints (mobile 375, tablet 768, desktop 1280, wide 1536)
4. **Visual diff** — pixel-level comparison between two screenshots (pixelmatch)
5. **Accessibility audit** — axe-core injection for WCAG violations
6. **Link checker** — crawl and verify all links on a page (native fetch, no browser needed)
7. **Page interaction** — click, fill, type, eval JavaScript, resize viewport

## WHEN to use it

- Debug a page that shows blank / errors / broken layout
- Verify a deploy before/after
- Check responsive behavior across breakpoints
- Find broken links on a site
- Run accessibility audit (WCAG 2.2)
- Test form submissions
- Compare visual state before/after a CSS change

## WHEN NOT to use it

- Designing UI from scratch → use `/hora-design`
- Analyzing a screenshot visually → use `/hora-vision`
- Full end-to-end test suites → use Playwright Test directly

---

## Prerequisites

Playwright must be installed:

```bash
npm install -D playwright
npx playwright install chromium
```

For visual diff mode, also install:

```bash
npm install -D pixelmatch pngjs
```

---

## Commands reference

### Navigation & Diagnostics

| Command | Description |
|---------|-------------|
| `hora-browser.mjs <url>` | Navigate + full diagnostics (screenshot + errors + network) |
| `hora-browser.mjs errors` | Console errors only |
| `hora-browser.mjs warnings` | Console warnings only |
| `hora-browser.mjs console` | All console output |
| `hora-browser.mjs network` | Network activity (all responses) |
| `hora-browser.mjs failed` | Failed requests only (4xx, 5xx) |

### Interaction

| Command | Description |
|---------|-------------|
| `hora-browser.mjs screenshot [path]` | Take screenshot |
| `hora-browser.mjs click <selector>` | Click element |
| `hora-browser.mjs fill <selector> <value>` | Fill input field |
| `hora-browser.mjs eval "<javascript>"` | Execute JS in page context |

### Testing

| Command | Description |
|---------|-------------|
| `hora-browser.mjs capture <url>` | Multi-viewport screenshots (4 viewports) |
| `hora-browser.mjs diff <img1> <img2>` | Visual diff with pixelmatch |
| `hora-browser.mjs a11y <url>` | Accessibility audit with axe-core |
| `hora-browser.mjs links <url>` | Link checker (native fetch) |

### Session management

| Command | Description |
|---------|-------------|
| `hora-browser.mjs status` | Session info (pid, port, uptime, current url) |
| `hora-browser.mjs restart` | Stop + start fresh session |
| `hora-browser.mjs stop` | Stop server |

---

## Protocol

### Phase 1 — NAVIGATE + DIAGNOSE

```bash
node hora-browser.mjs http://localhost:3000
```

This single command:
1. Starts the server if not running
2. Navigates to the URL
3. Waits for page load + JS rendering
4. Takes a screenshot
5. Reports console errors, failed requests, and network stats

Progress output (stderr — visible in Claude Code):
```
[hora-browser] -- navigate --
  [1/5] Ensure server...
  > Server already running
  [1/5] Ensure server OK
  [2/5] Navigate to URL...
  [2/5] Navigate to http://localhost:3000 OK
  [3/5] Wait for page render...
  [3/5] Page render complete OK
  [4/5] Collect diagnostics...
  [4/5] Diagnostics collected OK
  [5/5] Analyze results...
  > Screenshot: /tmp/hora-browse-1709164800000.png
  > WARN: 2 console error(s)
  > WARN: 1 failed request(s)
  > Network: 34 requests | 1.2MB | avg 120ms
  > Page: "Dashboard"
  [5/5] Analysis complete (3 issue(s)) OK
[hora-browser] -- 3 issue(s) found -- http://localhost:3000 --
```

Structured output (stdout):
```
Console Errors (2):
   * TypeError: Cannot read property 'map' of undefined
   * ReferenceError: foo is not defined

Failed Requests (1):
   * GET /api/users -> 500 Internal Server Error

Network: 34 requests | 1.2MB | avg 120ms
Page: "Dashboard" loaded successfully
```

### Phase 2 — INVESTIGATE

Based on diagnostics, drill into specific areas:

```bash
# See all console output
node hora-browser.mjs console

# See detailed network responses
node hora-browser.mjs network

# Execute JS to inspect state
node hora-browser.mjs eval "document.querySelectorAll('.error').length"
```

### Phase 3 — INTERACT

Test user interactions:

```bash
node hora-browser.mjs fill '#email' 'test@example.com'
node hora-browser.mjs fill '#password' 'SecurePass123'
node hora-browser.mjs click 'button[type="submit"]'

# Check for new errors after interaction
node hora-browser.mjs errors
```

### Phase 4 — VALIDATE

Run comprehensive checks:

```bash
# Visual regression
node hora-browser.mjs capture http://localhost:3000
node hora-browser.mjs diff before.png after.png

# Accessibility
node hora-browser.mjs a11y http://localhost:3000

# Broken links
node hora-browser.mjs links http://localhost:3000
```

---

## Debugging workflow

When a user reports "the page is broken" or "something doesn't work":

1. **Navigate** — `hora-browser.mjs <url>` — get the full picture immediately
2. **Read errors** — check console errors and failed network requests
3. **Inspect state** — use `eval` to check DOM, global variables, component state
4. **Test interactions** — reproduce the user's steps with click/fill/type
5. **Check after fix** — navigate again to verify the fix worked
6. **Compare** — use capture + diff to verify visual regression

The persistent session means all events accumulate. After navigating, you can check `errors` or `network` at any time to see everything that happened since last navigation.

---

## Examples

### Example 1 — Debug a broken page

```
User: "My dashboard shows a blank page"

# Step 1: navigate and diagnose
node hora-browser.mjs http://localhost:3000/dashboard

# Output reveals:
# Console Errors (1): TypeError: Cannot read property 'data' of null
# Failed Requests (1): GET /api/dashboard -> 500

# Step 2: check the API response
node hora-browser.mjs eval "fetch('/api/dashboard').then(r => r.text()).then(t => t)"

# Step 3: after fixing the API, verify
node hora-browser.mjs http://localhost:3000/dashboard
# No errors, page loads correctly
```

### Example 2 — Visual regression after CSS change

```
User: "Check if my CSS change broke anything"

# Capture before (on main branch)
node hora-browser.mjs capture http://localhost:3000

# Switch branch, capture after
node hora-browser.mjs capture http://localhost:3000

# Compare desktop screenshots
node hora-browser.mjs diff .hora/screenshots/2026-02-28/143022_desktop.png .hora/screenshots/2026-02-28/143055_desktop.png
# Output: 0.3% different — minimal change, looks safe
```

### Example 3 — Accessibility audit before deploy

```
User: "Run a11y check on my landing page"

node hora-browser.mjs a11y https://staging.mysite.com

# Output:
# [CRITICAL] — 1 violation
#   image-alt: Images must have alternate text
# [SERIOUS] — 3 violations
#   color-contrast: Elements must have sufficient color contrast
#   link-name: Links must have discernible text
```

### Example 4 — Form testing

```
User: "Test the signup form"

node hora-browser.mjs http://localhost:3000/signup
node hora-browser.mjs fill '#name' 'Jane Doe'
node hora-browser.mjs fill '#email' 'jane@example.com'
node hora-browser.mjs fill '#password' 'SecurePass123!'
node hora-browser.mjs click 'button[type="submit"]'

# Check for errors after submission
node hora-browser.mjs errors
node hora-browser.mjs network
```

---

## Architecture

```
browse.ts (CLI)  ──HTTP──>  browser-server.ts (persistent Playwright)
                              │
                              ├── Chromium (headless)
                              ├── Console capture (always-on)
                              ├── Network capture (always-on)
                              └── Page error capture (always-on)
```

- **Server** runs on `127.0.0.1:9222` (configurable via `HORA_BROWSER_PORT`)
- **Auto-start**: CLI spawns server as detached process if not running
- **Auto-shutdown**: 30min idle timeout
- **State file**: `/tmp/hora-browser-session.json` (PID, port, start time)
- **Headless by default**: set `HORA_BROWSER_HEADLESS=false` to see the browser

---

## Troubleshooting

### Server won't start

```
ERROR: Server failed to start within timeout.
```

Check if port 9222 is already in use: `lsof -i :9222`. Use `HORA_BROWSER_PORT=9333 node hora-browser.mjs <url>` to use a different port.

### Playwright not installed

```
Playwright is not installed. Install it with:
  npm install -D playwright
  npx playwright install chromium
```

Run the install commands. Playwright requires Chromium binaries to be downloaded separately.

### Page loads blank

The server waits for `load` event + 1.5s delay. If the page relies on heavy JS:
- Use `hora-browser.mjs eval "document.readyState"` to check load state
- Use `hora-browser.mjs eval "document.body.innerHTML.length"` to check if content rendered
- The page might have a runtime error — check `hora-browser.mjs errors`

### pixelmatch not found (diff mode)

```
pixelmatch is not installed. Install it with:
  npm install -D pixelmatch
```

Visual diff requires `pixelmatch` and `pngjs` as optional dependencies.

### axe-core won't load (a11y mode)

The page might be offline or blocking external scripts (CSP). axe-core is loaded from CDN (`cdnjs.cloudflare.com`). If the page has a strict Content-Security-Policy, the injection will fail.

---

## What this skill does NOT do

- Does not modify project files (read-only + generates screenshots/reports)
- Does not replace `/hora-vision` — it captures, hora-vision analyzes
- Does not replace `/hora-design` — it detects problems, hora-design solves them
- Does not manage full E2E test suites — use Playwright Test for that
