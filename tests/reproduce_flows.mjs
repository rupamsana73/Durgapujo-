import puppeteer from 'puppeteer-core';

async function testAll() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const errors = [];
  const logError = (msg) => { console.error('FAIL: ' + msg); errors.push(msg); };
  const logPass = (msg) => { console.log('PASS: ' + msg); };

  try {
    const page = await browser.newPage();
    page.on('console', msg => {
      console.log(`[CONSOLE ${msg.type()}]`, msg.text());
      if (msg.type() === 'error') {
        errors.push(`Console error: ${msg.text()}`);
      }
    });
    page.on('requestfailed', req => {
      console.error('[REQUEST FAILED]', req.url(), req.failure()?.errorText);
      errors.push(`Request failed: ${req.url()}`);
    });
    page.on('response', res => {
      if (res.status() >= 400) {
        console.error('[HTTP ERROR]', res.status(), res.url());
        errors.push(`HTTP ${res.status()}: ${res.url()}`);
      }
    });
    page.on('pageerror', err => {
      console.error('PAGE ERROR:', err.message);
      errors.push(`Page error: ${err.message}`);
    });

    console.log('--- TESTING FLOW A: HOME SEARCH ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-search', { timeout: 5000 });
    
    // Type in search box
    const searchInput = await page.$('#home-search');
    if (!searchInput) logError('No #home-search found on home page');
    else {
      await searchInput.type('Baghbazar');
      await new Promise(r => setTimeout(r, 400));
      const suggestions = await page.$('#suggestions');
      const isHidden = await page.evaluate(el => el.hidden || window.getComputedStyle(el).display === 'none', suggestions);
      console.log('Suggestions hidden?', isHidden);
      const resultsCount = await page.evaluate(el => el.querySelectorAll('.search-result').length, suggestions);
      console.log('Found search suggestions:', resultsCount);
      if (isHidden || resultsCount === 0) {
        logError('Suggestions did not appear for "Baghbazar"');
      } else {
        logPass('Suggestions appeared');
      }

      // Click first pandal suggestion
      const firstPandal = await page.$('.search-result[href*="pandal"]');
      if (firstPandal) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
          firstPandal.click()
        ]);
        console.log('Navigated to:', page.url());
      } else {
        logError('No pandal suggestion found to click');
      }
    }

    console.log('--- TESTING FLOW B: PANDAL DETAILS ---');
    // Check if pandal details rendered
    const detailView = await page.$('#detail-view');
    const detailHtml = await page.evaluate(el => el ? el.innerHTML : '', detailView);
    if (!detailHtml || detailHtml.includes('not found')) {
      logError(`Pandal details view is blank or not found. Content: ${detailHtml.slice(0, 100)}`);
    } else {
      logPass('Pandal details rendered');
      // Check required buttons
      const favBtn = await page.$('[data-action="fav"]');
      const planBtn = await page.$('[data-action="add"], [data-action="remove"]');
      const mapBtn = await page.$('[data-action="view-map"]');
      const gmapsLink = await page.$('a[href*="google.com/maps"]');
      console.log('Buttons:', { fav: !!favBtn, plan: !!planBtn, map: !!mapBtn, gmaps: !!gmapsLink });
      
      const dirWalk = await page.$('a[href*="travelmode=walking"]');
      const dirDrive = await page.$('a[href*="travelmode=driving"]');
      const dirTransit = await page.$('a[href*="travelmode=transit"]');
      console.log('Direction links:', { walk: !!dirWalk, drive: !!dirDrive, transit: !!dirTransit });
    }

    console.log('--- TESTING FLOW C: VIEW DIRECTIONS ---');
    const directionsLink = await page.$('a[href*="google.com/maps/dir"]');
    if (!directionsLink) {
      logError('No Google Maps Directions link found on pandal details');
    } else {
      const href = await page.evaluate(el => el.href, directionsLink);
      console.log('Directions href:', href);
      if (!href.includes('destination=')) logError('Directions URL missing destination parameter');
      else logPass('Directions URL has destination: ' + href);
    }

    console.log('--- TESTING FLOW D: VIEW ON MAP ---');
    const mapBtn = await page.$('[data-action="view-map"]');
    if (mapBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
        mapBtn.click()
      ]);
      console.log('After view on map click, URL:', page.url());
      const mapEl = await page.$('#map');
      if (!mapEl) logError('Map element #map missing on map.html');
      else {
        const hasLeaflet = await page.evaluate(el => el.classList.contains('leaflet-container'), mapEl);
        console.log('Map has leaflet container?', hasLeaflet);
        if (!hasLeaflet) logError('Leaflet did not initialize on map page');
        else logPass('Leaflet map initialized on map page');
      }
    }

    console.log('--- TESTING METRO FLOW: North -> Shyambazar -> Station Details -> Pandals ---');
    await page.goto('http://localhost:3000/pages/metro.html?region=north', { waitUntil: 'domcontentloaded' });
    const stationCards = await page.$$('.station-card');
    console.log('Found north station cards:', stationCards.length);
    if (stationCards.length === 0) {
      logError('No station cards found on metro.html?region=north');
    } else {
      // Find Shyambazar
      const shyambazar = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a[href*="metro-station"]')];
        const match = links.find(l => l.textContent.includes('Shyambazar'));
        return match ? match.href : null;
      });
      console.log('Shyambazar link:', shyambazar);
      if (!shyambazar) {
        logError('No Shyambazar station link found on metro.html?region=north');
      } else {
        await page.goto(shyambazar, { waitUntil: 'domcontentloaded' });
        console.log('Station page URL:', page.url());
        const stationDetail = await page.$('#station-detail-view');
        const stationText = await page.evaluate(el => el ? el.textContent : '', stationDetail);
        console.log('Station page text preview:', stationText.slice(0, 150));
        if (!stationText || stationText.includes('not found')) {
          logError('Metro station page is blank or not found');
        } else {
          logPass('Station page rendered: ' + stationText.slice(0, 50));
        }

        const nearbyItems = await page.$$('.nearby-item, .nearby-card, .discovery-card');
        console.log('Nearby pandals count on station page:', nearbyItems.length);
        if (nearbyItems.length === 0) {
          logError('No nearby pandals listed on station page');
        } else {
          logPass(`Found ${nearbyItems.length} nearby pandals on station page`);
        }
      }
    }

    console.log('--- TESTING MOBILE VIEWPORT (360x800) ---');
    await page.setViewport({ width: 360, height: 800 });
    await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#home-search', { timeout: 5000 });
    const mobileSearch = await page.$('#home-search');
    const isMobileSearchVisible = await page.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none';
    }, mobileSearch);
    console.log('Mobile search visible?', isMobileSearchVisible);

    const mobileNav = await page.$('.mobile-nav');
    const isMobileNavVisible = await page.evaluate(el => el && window.getComputedStyle(el).display !== 'none', mobileNav);
    console.log('Mobile nav visible?', isMobileNavVisible);

    // Check horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);
    console.log('Body scroll width vs window inner width:', bodyScrollWidth, windowInnerWidth);
    if (bodyScrollWidth > windowInnerWidth) {
      logError(`Horizontal overflow detected! scrollWidth=${bodyScrollWidth} > innerWidth=${windowInnerWidth}`);
    } else {
      logPass('No horizontal overflow on mobile 360x800');
    }

  } finally {
    await browser.close();
  }

  console.log('\n--- SUMMARY ---');
  console.log('Total errors:', errors.length);
  if (errors.length) {
    errors.forEach(e => console.error('-', e));
  } else {
    console.log('ALL FLOWS PASSED!');
  }
}

testAll().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
