import fs from 'node:fs'
import path from 'node:path'
import { test, type Page } from '@playwright/test'

const OUTPUT_DIR = path.join(__dirname, '..', 'docs', 'screenshots')
const SAMPLE_ACTIVITY_ID = '90000256'

interface PortfolioShot {
  name: string
  path: string
  scrollY?: number
}

const SHOTS: PortfolioShot[] = [
  { name: 'dashboard', path: '/' },
  { name: 'activity-detail', path: `/activities/${SAMPLE_ACTIVITY_ID}`, scrollY: 280 },
  { name: 'analytics', path: '/analytics' },
  { name: 'plan', path: '/plan' },
  { name: 'race', path: '/race' },
  { name: 'records', path: '/records' },
]

async function preparePage(page: Page, shot: PortfolioShot) {
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(shot.path, { waitUntil: 'networkidle' })
  await page.locator('main').waitFor({ state: 'visible' })
  await page.evaluate(() => (document as unknown as { fonts: FontFaceSet }).fonts?.ready)
  await page.waitForTimeout(800)

  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), shot.scrollY ?? 0)

  await page.waitForTimeout(300)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

for (const shot of SHOTS) {
  test(shot.name, async ({ page }) => {
    await preparePage(page, shot)
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${shot.name}.png`) })
  })
}
