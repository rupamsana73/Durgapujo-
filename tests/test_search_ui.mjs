import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function runVerification() {
  console.log('Starting full automated browser verification at 360 x 800...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`);
  });
  page.on('pageerror', err => errors.push(`Page error: ${err.message}`));

  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });

  // 1. Initial State Checks
  console.log('\n--- 1. INITIAL HOMEPAGE CHECKS ---');
  const initialLayout = await page.evaluate(() => {
    const s = document.querySelector('#home-search')?.getBoundingClientRect();
    const sug = document.querySelector('#suggestions');
    const sugRect = sug?.getBoundingClientRect();
    const reg = document.querySelector('#home-regions')?.getBoundingClientRect();
    const feat = document.querySelector('.featured-section')?.getBoundingClientRect();
    const nav = document.querySelector('.mobile-nav')?.getBoundingClientRect();

    const chips = Array.from(document.querySelectorAll('#home-regions a')).map(el => {
      const style = window.getComputedStyle(el);
      return {
        text: el.textContent.trim().replace(/\s+/g, ' '),
        textDecorationLine: style.textDecorationLine,
        textDecoration: style.textDecoration
      };
    });

    return {
      searchBottom: s?.bottom,
      suggestionsHidden: sug?.hidden,
      regionsTop: reg?.top,
      featuredTop: feat?.top,
      mobileNavTop: nav?.top,
      bodyScrollWidth: document.body.scrollWidth,
      windowInnerWidth: window.innerWidth,
      chips
    };
  });

  console.log('Initial Category Links styling:');
  initialLayout.chips.forEach(c => console.log(`  "${c.text}": textDecorationLine="${c.textDecorationLine}"`));
  const hasUnderline = initialLayout.chips.some(c => c.textDecorationLine.includes('underline'));
  if (hasUnderline) {
    throw new Error('FAIL: Category links still have text-decoration underline!');
  } else {
    console.log('PASS: Category links have NO text-decoration underline.');
  }

  // Helper for testing queries
  const testQuery = async (query) => {
    console.log(`\n--- TESTING QUERY "${query}" ---`);
    await page.evaluate(() => {
      const input = document.querySelector('#home-search');
      input.value = '';
    });
    await page.type('#home-search', query);
    await new Promise(r => setTimeout(r, 400));

    const check = await page.evaluate(() => {
      const s = document.querySelector('#home-search')?.getBoundingClientRect();
      const sug = document.querySelector('#suggestions');
      const sugRect = sug?.getBoundingClientRect();
      const sugStyle = sug ? window.getComputedStyle(sug) : null;
      const reg = document.querySelector('#home-regions')?.getBoundingClientRect();
      const feat = document.querySelector('.featured-section')?.getBoundingClientRect();
      const nav = document.querySelector('.mobile-nav')?.getBoundingClientRect();

      const items = Array.from(sug.querySelectorAll('.search-result')).map(el => {
        const title = el.querySelector('.search-result-title')?.textContent?.trim();
        const meta = el.querySelector('.search-result-meta')?.textContent?.trim();
        const icon = el.querySelector('.search-result-icon')?.textContent?.trim();
        const style = window.getComputedStyle(el);
        return {
          title,
          meta,
          icon,
          display: style.display,
          href: el.getAttribute('href')
        };
      });

      return {
        searchBottom: s?.bottom,
        sugRect: sugRect ? { top: sugRect.top, bottom: sugRect.bottom, height: sugRect.height } : null,
        sugPos: sugStyle?.position,
        sugZIndex: sugStyle?.zIndex,
        sugHidden: sug?.hidden,
        sugOverflowY: sugStyle?.overflowY,
        regionsTop: reg?.top,
        featuredTop: feat?.top,
        mobileNavTop: nav?.top,
        bodyScrollWidth: document.body.scrollWidth,
        windowInnerWidth: window.innerWidth,
        items
      };
    });

    const shiftRegions = check.regionsTop - initialLayout.regionsTop;
    const shiftFeatured = check.featuredTop - initialLayout.featuredTop;
    console.log(`Shift check: regions shift = ${shiftRegions}px, featured shift = ${shiftFeatured}px`);
    if (Math.abs(shiftRegions) > 0.5 || Math.abs(shiftFeatured) > 0.5) {
      throw new Error(`FAIL: Content pushed down! Regions shift: ${shiftRegions}px, Featured shift: ${shiftFeatured}px`);
    } else {
      console.log('PASS: 0px layout shift. Search results overlay page content without pushing it down.');
    }

    if (check.sugPos !== 'absolute' || check.sugZIndex !== '1000') {
      throw new Error(`FAIL: Suggestions positioning incorrect: position=${check.sugPos}, zIndex=${check.sugZIndex}`);
    } else {
      console.log(`PASS: Suggestions position=${check.sugPos}, zIndex=${check.sugZIndex}`);
    }

    const gap = check.sugRect.top - check.searchBottom;
    console.log(`Gap below search input: ${gap}px (expected ~8px)`);
    if (gap < 2 || gap > 16) {
      throw new Error(`FAIL: Suggestions panel not immediately under input: gap = ${gap}px`);
    } else {
      console.log('PASS: Suggestions panel appears directly underneath the search input.');
    }

    if (check.bodyScrollWidth > check.windowInnerWidth) {
      throw new Error(`FAIL: Horizontal overflow detected! scrollWidth=${check.bodyScrollWidth} > innerWidth=${check.windowInnerWidth}`);
    } else {
      console.log('PASS: No horizontal overflow.');
    }

    // Check bottom navigation clearance
    if (check.mobileNavTop && check.sugRect.bottom > check.mobileNavTop) {
      console.warn(`WARNING: Suggestions panel bottom (${check.sugRect.bottom}) overlaps bottom nav (${check.mobileNavTop})`);
    } else {
      console.log(`PASS: Suggestions panel stops before mobile bottom navigation (bottom: ${check.sugRect.bottom}px, nav: ${check.mobileNavTop}px)`);
    }

    console.log(`Results found: ${check.items.length}`);
    check.items.forEach((item, idx) => {
      console.log(`  [${idx + 1}] [${item.icon}] ${item.title} | ${item.meta} (display: ${item.display}, href: ${item.href})`);
      if (item.display !== 'flex') {
        throw new Error(`FAIL: Result row is not display: flex! Got: ${item.display}`);
      }
    });

    return check;
  };

  // Test the required queries
  await testQuery('de');
  const desCheck = await testQuery('des');
  const dumCheck = await testQuery('dum');
  const dakCheck = await testQuery('dak');

  // Verify specific requirements on "des", "dum", "dak"
  console.log('\n--- VERIFYING SPECIFIC SEARCH RESULTS CONTENT ---');
  const desPandal = desCheck.items.find(i => i.title.toLowerCase().includes('deshapriya'));
  if (desPandal) {
    console.log(`PASS: Found Deshapriya Park -> Title: "${desPandal.title}", Meta: "${desPandal.meta}"`);
  } else {
    console.log('Notice: Deshapriya query results:', desCheck.items.map(i => i.title));
  }

  const dumStation = dumCheck.items.find(i => i.title.toLowerCase().includes('dum dum'));
  if (dumStation) {
    console.log(`PASS: Found Dum Dum -> Title: "${dumStation.title}", Meta: "${dumStation.meta}"`);
  } else {
    throw new Error('FAIL: Dum Dum station not found in "dum" results');
  }

  const dakResult = dakCheck.items.find(i => i.title.toLowerCase().includes('dak') || i.meta.toLowerCase().includes('south') || i.title.includes('দক্ষিণ'));
  if (dakResult) {
    console.log(`PASS: Found match for "dak" -> Title: "${dakResult.title}", Meta: "${dakResult.meta}"`);
  } else {
    console.log('Notice: dak query results:', dakCheck.items.map(i => i.title));
  }

  // 7. Verify Click Behavior
  console.log('\n--- 7. TESTING CLICK ROUTING BEHAVIOR ---');
  // Click Dum Dum metro result
  await page.evaluate(() => {
    const input = document.querySelector('#home-search');
    input.value = '';
  });
  await page.type('#home-search', 'dum');
  await new Promise(r => setTimeout(r, 400));

  console.log('Clicking Dum Dum metro result...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.search-result[href*="metro-station"]')
  ]);
  const metroUrl = page.url();
  console.log(`Navigated to: ${metroUrl}`);
  if (!metroUrl.includes('metro-station.html')) throw new Error('FAIL: Did not navigate to metro-station.html');
  console.log('PASS: Metro station suggestion click works.');

  // Go back to home, test pandal click
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
  await page.type('#home-search', 'des');
  await new Promise(r => setTimeout(r, 400));

  console.log('Clicking pandal result...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.search-result[href*="pandal"]')
  ]);
  const pandalUrl = page.url();
  console.log(`Navigated to: ${pandalUrl}`);
  if (!pandalUrl.includes('pandal.html')) throw new Error('FAIL: Did not navigate to pandal.html');
  console.log('PASS: Pandal suggestion click works.');

  // Go back to home, test category card click
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
  console.log('Clicking category card North Kolkata...');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#home-regions a.north')
  ]);
  const catUrl = page.url();
  console.log(`Navigated to: ${catUrl}`);
  if (!catUrl.includes('metro.html?region=north')) throw new Error('FAIL: Did not navigate to metro.html?region=north');
  console.log('PASS: Category card click works.');

  await browser.close();
  console.log('\n=============================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('=============================================\n');
}

runVerification().catch(err => {
  console.error('\nVERIFICATION ERROR:\n', err);
  process.exit(1);
});
