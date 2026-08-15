import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'
import { ACCENT_STORAGE_KEY } from '@/lib/accent'

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots')
const THEME_STORAGE_KEY = 'theme'
const SAMPLE_ACTIVITY_ID = '90000256'

interface PortfolioShot {
  name: string
  path: string
  focus?: string
  ready?: string
}

const SHOTS: PortfolioShot[] = [
  { name: 'dashboard', path: '/' },
  {
    name: 'activity-detail',
    path: `/activities/${SAMPLE_ACTIVITY_ID}`,
    focus: '[data-route-preview]',
    ready: '[data-route-preview="ready"]',
  },
  { name: 'analytics', path: '/analytics' },
  { name: 'map', path: '/map', ready: '[data-route-preview="ready"]' },
  { name: 'plan', path: '/plan' },
  { name: 'records', path: '/records' },
]

async function preparePage(page: Page, shot: PortfolioShot) {
  await page.addInitScript(
    (entries) => entries.forEach(([key, value]) => localStorage.setItem(key, value)),
    [
      [THEME_STORAGE_KEY, 'dark'],
      [ACCENT_STORAGE_KEY, 'nature'],
      ['ro-onboarding-seen', '1'],
    ] as const,
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(shot.path, { waitUntil: 'domcontentloaded' })
  await page.locator('main').waitFor({ state: 'visible' })
  if (shot.ready) await page.locator(shot.ready).waitFor({ state: 'visible', timeout: 15_000 })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts?.ready)
  await page.waitForTimeout(800)

  if (shot.focus) {
    await page.locator(shot.focus).scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy({ top: -160, behavior: 'instant' }))
  } else {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  }

  await page.waitForTimeout(300)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

for (const shot of SHOTS) {
  test(shot.name, async ({ page }) => {
    await preparePage(page, shot)
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${shot.name}.png`) })
  })
}
