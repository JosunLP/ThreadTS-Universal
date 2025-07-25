/**
 * Playwright Global Setup
 * Detektiert die Umgebungskapazitäten vor den Tests
 */

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🔍 Detecting browser capabilities...');

  // Test Worker support in each browser
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const capabilities = await page.evaluate(() => {
      return {
        hasWorker: typeof Worker !== 'undefined',
        hasBlob: typeof Blob !== 'undefined',
        hasURL: typeof URL !== 'undefined',
        hasSharedWorker: typeof SharedWorker !== 'undefined',
        hasServiceWorker: 'serviceWorker' in navigator,
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || 1,
      };
    });

    console.log('🌐 Browser Capabilities:', capabilities);

    // Speichere Capabilities für Tests
    process.env.BROWSER_WORKER_SUPPORT = capabilities.hasWorker
      ? 'true'
      : 'false';
    process.env.BROWSER_BLOB_SUPPORT = capabilities.hasBlob ? 'true' : 'false';
    process.env.BROWSER_URL_SUPPORT = capabilities.hasURL ? 'true' : 'false';

    if (!capabilities.hasWorker) {
      console.log(
        '⚠️  Workers not supported - tests will use fallback mechanisms'
      );
    } else {
      console.log('✅ Workers supported - testing full functionality');
    }
  } catch (error) {
    console.log('❌ Error detecting capabilities:', error);
    // Set fallback environment variables
    process.env.BROWSER_WORKER_SUPPORT = 'false';
    process.env.BROWSER_BLOB_SUPPORT = 'false';
    process.env.BROWSER_URL_SUPPORT = 'false';
  }

  await browser.close();
}

export default globalSetup;
