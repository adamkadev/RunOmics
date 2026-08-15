#!/usr/bin/env node
/**
 * Pre-publication check: scans the git-tracked tree for the shapes of things that
 * must never ship in a public repository. Not a DLP system - structural and
 * pattern checks meant to run right before a repo built from this codebase is
 * made public, and in CI afterwards.
 *
 * Deliberately contains no real private values. This file is itself public, so
 * encoding an actual coordinate, activity id, gear id or address here would
 * publish the very thing it is meant to catch. Every check below is structural
 * (a path, a file shape) or a generic credential pattern.
 *
 * Exits non-zero if anything CRITICAL is found.
 *
 *   node scripts/verify_no_private_data.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf-8' }).trim().split('\n').filter(Boolean)
}

function trackedUnder(files, prefix) {
  return files.filter((f) => f === prefix || f.startsWith(prefix.endsWith('/') ? prefix : prefix + '/'))
}

function grepTracked(files, pattern, { exclude = [] } = {}) {
  const hits = []
  for (const f of files) {
    if (exclude.some((ex) => f === ex)) continue
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) continue
    let content
    try {
      content = fs.readFileSync(f, 'utf-8')
    } catch {
      continue // binary or unreadable - not a text-secret risk
    }
    const lines = content.split('\n')
    lines.forEach((line, i) => {
      if (pattern.test(line)) hits.push({ file: f, line: i + 1, text: line.trim().slice(0, 120) })
    })
  }
  return hits
}

const findings = []

function critical(title, detail) {
  findings.push({ severity: 'CRITICAL', title, detail })
}
function warn(title, detail) {
  findings.push({ severity: 'WARN', title, detail })
}

const files = trackedFiles()

// --- Structural: directories that must never ship in a public repo -------
for (const prefix of ['data', 'public/data']) {
  const dataFiles = trackedUnder(files, prefix)
  if (dataFiles.length) {
    critical(
      `${prefix}/ is tracked`,
      `${dataFiles.length} file(s) - the real dataset belongs in the private data repo, not here. ` +
        `First hit: ${dataFiles[0]}`
    )
  }
}

// Untracked is not enough here: Next.js serves everything under public/ as a
// static asset, so a copy left in a deployed tree republishes the dataset.
if (fs.existsSync('public/data')) {
  critical(
    'public/data/ exists on disk',
    'Everything under public/ is served as a static asset. The app reads data/ - ' +
      'scripts/prepare-data.mjs moves a leftover public/data/ there on the next dev/build.'
  )
}

const fitFiles = trackedUnder(files, 'public/fit')
if (fitFiles.length) critical('public/fit/ is tracked', `${fitFiles.length} file(s) - raw FIT binaries must never be committed.`)

if (fs.existsSync('public/fit') && fs.readdirSync('public/fit').length) {
  warn('public/fit/ exists on disk with content', 'Untracked, but everything under public/ is served statically once deployed.')
}

const eventFiles = trackedUnder(files, 'public/events')
if (eventFiles.length) critical('public/events/ is tracked', `${eventFiles.length} file(s) - race-day photos are personal and must not ship.`)

// --- Structural: env/credential files -------------------------------------
const ALLOWED_ENV = new Set(['.env.e2e', '.env.example'])
for (const f of files) {
  const base = f.split('/').pop() ?? f
  if (/^\.env(\..+)?$/.test(base) && !ALLOWED_ENV.has(f)) {
    critical('An env file beyond .env.e2e/.env.example is tracked', f)
  }
  if (/serviceAccountKey.*\.json$/i.test(f) || /firebase-adminsdk-.*\.json$/i.test(f)) {
    critical('A Firebase service-account key file is tracked', f)
  }
  if (/\.(pem|p12|pfx|key|keystore|jks)$/i.test(f)) {
    critical('A key/certificate file is tracked', f)
  }
  if (/\.(fit|tcx|gpx)$/i.test(f)) {
    critical('A raw activity file is tracked', `${f} - FIT/TCX/GPX carry full GPS traces.`)
  }
  if (/(^|\/)\.npmrc$|(^|\/)\.netrc$|(^|\/)id_(rsa|ed25519)$/.test(f)) {
    critical('A credential file is tracked', f)
  }
}

// --- Pattern: common secret/key shapes in tracked file contents ----------
const secretChecks = [
  { name: 'Google/Firebase API key (AIza...)', pattern: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'GitHub token (ghp_/gho_/ghs_/ghr_)', pattern: /\bgh[porsu]_[0-9A-Za-z]{30,}/ },
  { name: 'GitHub fine-grained PAT', pattern: /\bgithub_pat_[0-9A-Za-z_]{50,}/ },
  { name: 'AWS access key (AKIA...)', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'Slack token', pattern: /\bxox[baprs]-[0-9A-Za-z-]{10,}/ },
  { name: 'OpenAI-style key', pattern: /\bsk-[A-Za-z0-9]{32,}/ },
  { name: 'PEM private key header', pattern: /BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY/, exclude: ['.env.example', 'README.md'] },
  { name: 'Firebase service-account JSON shape', pattern: /"type"\s*:\s*"service_account"/ },
  { name: 'Garmin OAuth blob assigned inline', pattern: /GARMIN_SECRET\s*[:=]\s*["']?eyJ[A-Za-z0-9_-]{20,}/ },
  // A token pasted into a git remote is the classic way a PAT leaks into a log.
  { name: 'Credentials embedded in an https URL', pattern: /https:\/\/[^/\s'"]*:[^/@\s'"]+@/ },
]
for (const { name, pattern, exclude } of secretChecks) {
  const hits = grepTracked(files, pattern, { exclude: exclude ?? [] })
  for (const hit of hits) critical(`Possible ${name}`, `${hit.file}:${hit.line}`)
}

// --- Pattern: private infrastructure named in the tracked tree -----------
// The public copy documents the architecture generically; a concrete private
// repository name would point an attacker straight at the dataset.
const PRIVATE_REPO_HINT = /\b[\w.-]+\/(runomics[-_]?(data|private))\b/i
for (const hit of grepTracked(files, PRIVATE_REPO_HINT, { exclude: ['scripts/verify_no_private_data.mjs'] })) {
  if (/your-username|your-org|example|<[^>]+>/i.test(hit.text)) continue // documented placeholder
  critical('A concrete private data/private repository name is referenced', `${hit.file}:${hit.line}`)
}

// --- Pattern: privacy-zone configuration committed with real coordinates -
// PRIVACY_ZONES is where a home address would live. Any tracked assignment that
// is not the obviously-synthetic [[0,0],...] placeholder is worth a human look.
for (const hit of grepTracked(files, /PRIVACY_ZONES\s*=\s*\[\[/)) {
  if (/\[\[\s*0(\.0+)?\s*,\s*0(\.0+)?\s*\]/.test(hit.text)) continue
  critical('PRIVACY_ZONES is assigned a non-placeholder coordinate', `${hit.file}:${hit.line}`)
}

// --- .gitignore sanity: the protections this project relies on -----------
const gitignore = fs.existsSync('.gitignore') ? fs.readFileSync('.gitignore', 'utf-8') : ''
const expectedPatterns = ['/public/fit/', '/public/data/', '/data/', '/public/events/', '.env*']
for (const pattern of expectedPatterns) {
  if (!gitignore.includes(pattern)) warn('.gitignore is missing an expected pattern', pattern)
}

// --- Workflow sanity: nothing scheduled that needs secrets a fork lacks ---
for (const f of files.filter((p) => p.startsWith('.github/workflows/'))) {
  const content = fs.readFileSync(f, 'utf-8')
  const scheduled = /^\s*schedule:/m.test(content)
  const needsSecrets = /secrets\.(GARMIN_SECRET|APP_URL|RUNOMICS_DATA_REPO_|INTERNAL_NOTIFY_SECRET|PRIVACY_ZONES)/.test(content)
  if (scheduled && needsSecrets) {
    warn('A scheduled workflow depends on deployment secrets', `${f} - it will fail on every run in a clone that has none.`)
  }
}

// --- Report ----------------------------------------------------------------
const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length
const warnCount = findings.filter((f) => f.severity === 'WARN').length

if (!findings.length) {
  console.log(`OK - ${files.length} tracked files checked, nothing flagged.`)
  process.exit(0)
}

for (const f of findings) {
  console.log(`[${f.severity}] ${f.title}\n    ${f.detail}`)
}
console.log(`\n${criticalCount} critical, ${warnCount} warning(s).`)
process.exit(criticalCount > 0 ? 1 : 0)
