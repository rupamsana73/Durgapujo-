import puppeteer from 'puppeteer-core';

async function runBrowserTests() {
  console.log('--- STARTING AUTOMATED BROWSER CHATBOT INTERACTION TESTS ---');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Browser console error:', msg.text());
  });

  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });

  // Hook window.open to track URLs opened by buttons
  await page.evaluate(() => {
    window.__openedUrls = [];
    window.open = function(url) {
      window.__openedUrls.push(url);
      return { closed: false, location: { href: url } };
    };
  });

  // 1. Check FAB visibility
  console.log('\n1. Verifying Puja AI FAB presence and position...');
  const fab = await page.$('#puja-ai-fab');
  if (!fab) throw new Error('FAIL: #puja-ai-fab not found');

  const fabBox = await fab.boundingBox();
  console.log(`✔ FAB found at: x=${fabBox.x}, y=${fabBox.y}, w=${fabBox.width}, h=${fabBox.height}`);

  // 2. Open chat panel
  console.log('\n2. Opening Puja AI chatbot panel...');
  await fab.click();
  await new Promise(r => setTimeout(r, 400));

  const isPanelOpen = await page.evaluate(() => {
    const p = document.getElementById('puja-ai-panel');
    return p && p.classList.contains('is-open');
  });
  if (!isPanelOpen) throw new Error('FAIL: Chat panel did not open');
  console.log('✔ Chat panel successfully opened (is-open)');

  // 3. Test Quick Action: 🚇 মেট্রো খুঁজুন
  console.log('\n3. Testing Quick Action: 🚇 মেট্রো খুঁজুন...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-quick-id="find-metro"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const metroChipsCount = await page.evaluate(() => {
    return document.querySelectorAll('.puja-ai-metro-chip').length;
  });
  console.log(`✔ Metro chips rendered: ${metroChipsCount} (Expected: 28)`);
  if (metroChipsCount < 20) throw new Error(`FAIL: Expected at least 20 metro chips, got ${metroChipsCount}`);

  // 4. Test clicking a metro chip (e.g. Dum Dum)
  console.log('\n4. Testing click on Dum Dum station chip...');
  await page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll('.puja-ai-metro-chip'));
    const dd = chips.find(c => c.textContent.trim().toLowerCase().includes('dum dum'));
    if (dd) dd.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasDumDumCard = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.puja-ai-action-card'));
    const lastCard = cards[cards.length - 1];
    if (!lastCard) return false;
    const hasTitle = lastCard.textContent.includes('Dum Dum');
    const hasDetails = !!lastCard.querySelector('[data-action="view-station"]');
    const hasMap = !!lastCard.querySelector('[data-action="station-map"]');
    const hasDir = !!lastCard.querySelector('[data-action="station-directions"]');
    return hasTitle && hasDetails && hasMap && hasDir;
  });
  if (!hasDumDumCard) throw new Error('FAIL: Dum Dum station interaction card not rendered or missing buttons');
  console.log('✔ Dum Dum station card rendered with Station Details, View Map, and Directions buttons');

  // Test [Station Details] click
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="view-station"][data-station-id="dumdum"]');
    if (btn) btn.click();
  });
  const openedUrls1 = await page.evaluate(() => window.__openedUrls);
  console.log('✔ Station Details window.open triggered:', openedUrls1[openedUrls1.length - 1]);
  if (!openedUrls1.some(u => u && u.includes('pages/metro-station.html?id=dumdum'))) {
    throw new Error('FAIL: Station Details did not open metro-station.html?id=dumdum');
  }

  // 5. Test Destination Query: "দেশপ্রিয় পার্ক যেতে চাই"
  console.log('\n5. Testing query: "দেশপ্রিয় পার্ক যেতে চাই"...');
  await page.evaluate(() => {
    const inp = document.getElementById('puja-ai-input');
    inp.value = 'দেশপ্রিয় পার্ক যেতে চাই';
    inp.dispatchEvent(new Event('input'));
    document.getElementById('puja-ai-send').click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasDeshapriyaCard = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.puja-ai-action-card'));
    const match = cards.find(c => c.textContent.includes('Deshapriya Park'));
    if (!match) return false;
    const hasDir = !!match.querySelector('[data-action="directions"]');
    const hasMap = !!match.querySelector('[data-action="open-map"]');
    const hasMetro = !!match.querySelector('[data-action="dest-metro"]');
    const hasPandals = !!match.querySelector('[data-action="dest-nearby-pandals"]');
    return hasDir && hasMap && hasMetro && hasPandals;
  });
  if (!hasDeshapriyaCard) throw new Error('FAIL: Deshapriya Park destination card missing or incomplete');
  console.log('✔ Deshapriya Park destination card rendered with Directions, Open in Maps, Metro, and Nearby Pandals buttons');

  // Test [🗺️ Open in Maps] on Deshapriya Park
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="open-map"][data-dest-name*="Deshapriya"]');
    if (btn) btn.click();
  });
  const openedUrls2 = await page.evaluate(() => window.__openedUrls);
  console.log('✔ Open in Maps window.open triggered:', openedUrls2[openedUrls2.length - 1]);
  if (!openedUrls2.some(u => u && u.includes('google.com/maps/search/?api=1'))) {
    throw new Error('FAIL: Open in Maps did not open Google Maps search');
  }

  // 6. Test clicking [🎪 Nearby Pandals] on Deshapriya Park card
  console.log('\n6. Testing click on [🎪 Nearby Pandals] button...');
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="dest-nearby-pandals"][data-dest-name*="Deshapriya"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const pandalCardsCount = await page.evaluate(() => {
    return document.querySelectorAll('[data-action="view-pandal"]').length;
  });
  console.log(`✔ Nearby pandal cards rendered: ${pandalCardsCount}`);
  if (pandalCardsCount === 0) throw new Error('FAIL: No pandal cards rendered on Nearby Pandals click');

  // 7. Test Save pandal toggle
  console.log('\n7. Testing Save button on pandal card...');
  const saveResult = await page.evaluate(() => {
    const saveBtn = document.querySelector('[data-action="save-pandal"]');
    if (!saveBtn) return null;
    const initialText = saveBtn.textContent.trim();
    saveBtn.click();
    const afterFirstClick = saveBtn.textContent.trim();
    const favsStored = JSON.parse(localStorage.getItem('pujoPlanner.favourites') || '[]');
    saveBtn.click();
    const afterSecondClick = saveBtn.textContent.trim();
    return { initialText, afterFirstClick, favsCount: favsStored.length, afterSecondClick };
  });
  console.log('✔ Save button toggle result:', saveResult);
  if (saveResult.afterFirstClick !== '♥ Saved' || saveResult.afterSecondClick !== '♡ Save') {
    throw new Error('FAIL: Save button toggle failed');
  }

  // 8. Test clicking [View Details] on pandal card
  console.log('\n8. Testing View Details button on pandal card...');
  await page.evaluate(() => {
    const btn = document.querySelector('[data-action="view-pandal"]');
    if (btn) btn.click();
  });
  const openedUrls3 = await page.evaluate(() => window.__openedUrls);
  console.log('✔ View Details triggered:', openedUrls3[openedUrls3.length - 1]);
  if (!openedUrls3.some(u => u && u.includes('pages/pandal.html?id='))) {
    throw new Error('FAIL: View Details did not open pandal.html');
  }

  // 9. Test Destination Query: "কালিঘাট যেতে চাই"
  console.log('\n9. Testing query: "কালিঘাট যেতে চাই"...');
  await page.evaluate(() => {
    const inp = document.getElementById('puja-ai-input');
    inp.value = 'কালিঘাট যেতে চাই';
    inp.dispatchEvent(new Event('input'));
    document.getElementById('puja-ai-send').click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasKalighat = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.puja-ai-action-card'));
    return cards.some(c => c.textContent.includes('Kalighat'));
  });
  if (!hasKalighat) throw new Error('FAIL: Kalighat destination card not found');
  console.log('✔ Kalighat destination card verified');

  // 10. Test Query: "Show me pandals near Dum Dum"
  console.log('\n10. Testing query: "Show me pandals near Dum Dum"...');
  await page.evaluate(() => {
    const inp = document.getElementById('puja-ai-input');
    inp.value = 'Show me pandals near Dum Dum';
    inp.dispatchEvent(new Event('input'));
    document.getElementById('puja-ai-send').click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasDumDumPandals = await page.evaluate(() => {
    const msgs = Array.from(document.querySelectorAll('.puja-ai-message.bot'));
    const lastMsg = msgs[msgs.length - 1];
    return lastMsg && (lastMsg.textContent.includes('Dum Dum') || lastMsg.textContent.includes('প্যান্ডেল তালিকা'));
  });
  if (!hasDumDumPandals) throw new Error('FAIL: Dum Dum pandals not found');
  console.log('✔ Pandals near Dum Dum rendered successfully');

  // 11. Test Quick Action: 🗺️ পুজো প্ল্যান
  console.log('\n11. Testing Quick Action: 🗺️ পুজো প্ল্যান...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-quick-id="puja-plan"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasPlannerCard = await page.evaluate(() => {
    const hasPlannerBtn = !!document.querySelector('[data-action="planner"]');
    const hasMapBtn = !!document.querySelector('[data-action="full-map"]');
    return hasPlannerBtn && hasMapBtn;
  });
  if (!hasPlannerCard) throw new Error('FAIL: Planner action card not rendered or missing buttons');
  console.log('✔ Planner action card rendered with [📋 প্ল্যানার খুলুন] and [🗺️ ফুল ম্যাপ] buttons');

  // 12. Test Quick Action: 🪔 পুজোর গাইড
  console.log('\n12. Testing Quick Action: 🪔 পুজোর গাইড...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-quick-id="puja-guide"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const guideCardsCount = await page.evaluate(() => {
    return document.querySelectorAll('.puja-ai-guide-card').length;
  });
  console.log(`✔ Guide section cards rendered: ${guideCardsCount}`);
  if (guideCardsCount === 0) throw new Error('FAIL: No guide cards rendered');

  // 13. Test Quick Action: 📍 কোথায় যাব?
  console.log('\n13. Testing Quick Action: 📍 কোথায় যাব?...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[data-quick-id="go-somewhere"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const suggestionChipsCount = await page.evaluate(() => {
    return document.querySelectorAll('.puja-ai-suggestion-chip').length;
  });
  console.log(`✔ Suggestion chips rendered: ${suggestionChipsCount}`);
  if (suggestionChipsCount === 0) throw new Error('FAIL: No suggestion chips rendered');

  // 14. Test clicking suggestion chip
  console.log('\n14. Testing click on suggestion chip...');
  await page.evaluate(() => {
    const chip = document.querySelector('.puja-ai-suggestion-chip');
    if (chip) chip.click();
  });
  await new Promise(r => setTimeout(r, 600));

  const hasDestCardFromChip = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.puja-ai-action-card'));
    return cards.length > 0;
  });
  if (!hasDestCardFromChip) throw new Error('FAIL: Suggestion chip click did not produce a destination card');
  console.log('✔ Suggestion chip triggered destination flow successfully');

  // 15. Check for page errors
  if (pageErrors.length > 0) {
    console.error('Page errors encountered:', pageErrors);
    throw new Error('FAIL: Uncaught errors on page');
  }

  console.log('\n==================================================');
  console.log('ALL 14 BROWSER INTERACTION FLOWS PASSED (14/14)!');
  console.log('==================================================\n');

  await browser.close();
}

runBrowserTests().catch(err => {
  console.error('\n❌ BROWSER TEST FAILED:', err);
  process.exit(1);
});
