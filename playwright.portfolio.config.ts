import fs from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const PROVISIONED_CHROMIUM = '/opt/pw-browsers/chromium'
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (fs.existsSync(PROVISIONED_CHROMIUM) ? PROVISIONED_CHROMIUM : undefined)
const baseURL = process.env.SCREENSHOT_BASE_URL ?? 'http://127.0.0.1:3100'

// The app is an iPhone PWA run from the home screen, so the viewport is the phone's whole screen.
const phone = devices['iPhone 16 Pro']
const PHONE_SCREEN = { width: 402, height: 874 }

export default defineConfig({
  testDir: './screenshots',
  testMatch: 'portfolio.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  outputDir: './screenshots/.pw-artifacts',
  use: {
    ...phone,
    baseURL,
    viewport: PHONE_SCREEN,
    deviceScaleFactor: 2,
    defaultBrowserType: 'chromium',
    browserName: 'chromium',
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
