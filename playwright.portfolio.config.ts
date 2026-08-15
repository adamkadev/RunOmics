import fs from 'node:fs'
import { defineConfig } from '@playwright/test'

const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)
const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3100'

export default defineConfig({
  testDir: './screenshots',
  testMatch: 'portfolio.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './screenshots/.pw-artifacts',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    locale: 'en-US',
    launchOptions: { executablePath },
  },
  ...(process.env.SCREENSHOT_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'npm run e2e:build && npm run e2e:start -- -p 3100',
          url: baseURL,
          reuseExistingServer: false,
          timeout: 300_000,
        },
      }),
})
