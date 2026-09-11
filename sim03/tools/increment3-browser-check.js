'use strict';
// Real standalone handlers and rendered UI. No outcome or allocation-rule mocks.
// CI supplies Playwright through NODE_PATH; no production dependency is added.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const engine = require('../lib/scenario');
process.env.ACCESS_CODE = 'midland-increment3-browser-test';
delete process.env.PLATFORM_URL;
delete process.env.LAUNCH_SECRET;
const handlers = Object.fromEntries(['config','outcome','finish'].map(k => [k, require('../api/' + k)]));
const artifactDir = path.resolve(process.env.BROWSER_ARTIFACT_DIR || 'browser-artifacts/increment3');
fs.mkdirSync(artifactDir, { recursive: true });
const calls = [], errors = [], results = [];
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const action = pathname.match(/^\/sim03\/api\/(config|outcome|finish)$/)?.[1];
    if (action) {
      let raw = ''; for await (const part of req) raw += part;
      req.body = raw ? JSON.parse(raw) : {};
      calls.push({ action, body: req.body });
      res.status = n => { res.statusCode = n; return res; };
      res.json = value => { res.setHeader('content-type','application/json'); res.end(JSON.stringify(value)); return res; };
      return await handlers[action](req, res);
    }
    if (pathname === '/sim03/' || pathname === '/sim03/index.html') {
      res.setHeader('content-type','text/html');
      return res.end(fs.readFileSync(path.join(__dirname,'../public/index.html')));
    }
    if (pathname === '/favicon.ico') { res.statusCode = 204; return res.end(); }
    res.statusCode = 404; res.end('Not found');
  } catch (e) { errors.push(String(e.stack || e)); res.statusCode = 500; res.end('Test server error'); }
});
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/sim03/`;
  let browser;
  try {
    browser = await chromium.launch({ headless:true, ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}), args:['--no-sandbox'] });
    for (const viewport of [{width:1366,height:768},{width:1280,height:720},{width:390,height:844}]) {
      const context = await browser.newContext({viewport});
      await context.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await context.addInitScript(code => sessionStorage.setItem('m03-access',code), process.env.ACCESS_CODE);
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(e.message));
      const dialogs = [];
      page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
      if (process.env.OFFLINE_RENDER === '1') {
        // Restricted local preview: render source offline and bridge only the test
        // server's three handlers through Node. CI uses normal browser HTTP above.
        await page.exposeFunction('__localRequest', async (route, payload, method) => {
          assert.match(route, /^\/api\/(config|outcome|finish)$/);
          const response = await fetch(new URL(route.slice(1), base), {
            method, headers:{'content-type':'application/json','x-access-code':process.env.ACCESS_CODE},
            ...(method === 'GET' ? {} : {body:JSON.stringify(payload || {})})
          });
          if(!response.ok) throw new Error(`Test handler status ${response.status}`);
          return response.json();
        });
        const bootstrap = `<script>
          for(const key of ['localStorage','sessionStorage']) {
            const values = new Map();
            if(key==='sessionStorage') values.set('m03-access','midland-increment3-browser-test');
            Object.defineProperty(window,key,{value:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}});
          }
          history.replaceState=()=>{};
        </script>`;
        const source = fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8')
          .replace(/@import url\([^)]*\);/,'')
          .replace('init();', "request=(route,payload,method='POST')=>window.__localRequest(route,payload,method);init();");
        await page.setContent(bootstrap + source);
      } else await page.goto(base);
      await page.waitForSelector('.brief-page #nextBtn');
      assert.ok((await page.locator('body').innerText()).length > 200);
      const inViewport = async selector => {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height + 1, `${viewport.width}: ${selector} outside viewport: ${JSON.stringify(box)}`);
      };
      if (viewport.width > 1000) await inViewport('#nextBtn');
      await page.screenshot({path:path.join(artifactDir,`brief-${viewport.width}.png`)});
      // Business description stays contiguous, followed by emphasis then takeover.
      assert.equal(await page.locator('.copy > *').nth(2).getAttribute('class'),'brief-profit');
      await page.locator('.briefing-prep button').click();
      await page.waitForSelector('#briefingPacketModal.open');
      const packet = await page.locator('#briefingPacketModal').innerText();
      assert.doesNotMatch(packet, /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|semester|eighty minutes|your team)\b/i);
      for (const c of engine.publicConfig().room.cast) assert.ok(packet.includes(c.name) && packet.includes(c.quote));
      await page.keyboard.press('Escape');
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.room-tour');
      assert.equal(await page.locator('.room-card').count(),4);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.line-guide');
      assert.equal(await page.locator('.line-guide .advocate-reminder').count(),5);
      assert.equal(await page.locator('.line-guide .unrepresented').count(),1);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('#viewText');
      await page.locator('#viewText').fill('Midland should hear its machines before sending a truck.');
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.allocation-page');
      await page.evaluate(() => scrollTo(0,0));
      assert.equal(await page.locator('.allocs .alloc').count(),5);
      assert.equal(await page.locator('.allocation-controls .advocate-reminder').count(),5);
      assert.equal(await page.locator('.allocation-controls .constraint, .allocation-controls .alloc-rule').count(),0);
      if (viewport.width > 1000) {
        await inViewport('.allocs .alloc:last-child'); await inViewport('#nextBtn');
      } else {
        await page.locator('[data-line="features"][data-delta="1"]').scrollIntoViewIfNeeded();
        await inViewport('.allocation-footer .budget');
      }
      await page.screenshot({path:path.join(artifactDir,`allocator-year1-${viewport.width}.png`)});
      // Actual clicks update total/caps, keep focus and permit the last row to work.
      for (const [line,n] of [['uptime',3],['capacity',1],['features',2]]) {
        for(let i=0;i<n;i++) await page.locator(`[data-line="${line}"][data-delta="1"]`).click();
      }
      assert.equal(await page.locator('.budget .n').innerText(),'0');
      assert.equal(await page.locator('.step[data-delta="1"]:enabled').count(),0);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.outcome-note');
      assert.ok((await page.locator('.outcome-note').innerText()).includes('$0M'));
      assert.ok(await page.evaluate(() => document.querySelector('.outcome').getBoundingClientRect().bottom <= document.querySelector('.running').getBoundingClientRect().top));
      await page.locator('#nextBtn').click();
      await page.waitForSelector('#allocationSplit');
      assert.equal(await page.locator('#allocationSplit').getAttribute('open'),null);
      assert.equal(await page.locator('.allocation-controls .advocate-reminder').count(),5);
      assert.ok((await page.locator('.allocation-controls').innerText()).length < 1200);
      await page.evaluate(() => scrollTo(0,0));
      if (viewport.width > 1000) { await inViewport('.allocs .alloc:last-child'); await inViewport('#nextBtn'); }
      await page.screenshot({path:path.join(artifactDir,`allocator-year2-${viewport.width}.png`)});
      await page.locator('#allocationSplit > summary').click();
      await page.waitForFunction(() => S.breakdownOpen);
      for (const [line,n] of [['uptime',3],['capacity',1],['features',2]]) {
        for(let i=0;i<n;i++) await page.locator(`[data-line="${line}"][data-delta="1"]`).click();
      }
      assert.notEqual(await page.locator('#allocationSplit').getAttribute('open'),null);
      const uptime = await page.locator('.year2-breakdown-row').nth(2).innerText();
      assert.ok(uptime.includes('$3M') && uptime.includes('$6M'));
      assert.equal(await page.locator('.year2-breakdown-head > div').count(),4);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.outcome-note');
      assert.match(await page.locator('.outcome-note').innerText(), /\$6M.*\$3M.*\$3M/);
      assert.ok(await page.evaluate(() => document.querySelector('.events').getBoundingClientRect().bottom <= document.querySelector('.running').getBoundingClientRect().top));
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.events .outcome:nth-child(2)');
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.year3-status');
      assert.match(await page.locator('.year3-status').innerText(), /no allocation/);
      assert.equal(await page.locator('.stepper').count(),0);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('.buyer-room-link');
      assert.equal(await page.locator('.buyer-room-link').count(),3);
      await page.locator('#nextBtn').click();
      await page.waitForSelector('#r1followup');
      assert.equal(await page.locator('textarea').count(),3);
      await page.locator('#r1').fill('Sam: I overruled the argument for connection.');
      await page.locator('#r1followup').fill('No. I would move excess Uptime to Connect.');
      await page.locator('#r2').fill('From Uptime to Connect in Year 1.');
      await page.evaluate(() => render());
      assert.equal(await page.locator('#r1followup').inputValue(),'No. I would move excess Uptime to Connect.');
      if (viewport.width === 1366) {
        await page.locator('#r1').fill('A'.repeat(1490));
        const finishes = calls.filter(x => x.action==='finish').length;
        await page.locator('#finishBtn').click();
        assert.equal(calls.filter(x=>x.action==='finish').length,finishes);
        assert.match(dialogs.at(-1), /1,500/);
        await page.locator('#r1').fill('Sam: I overruled the argument for connection.');
      }
      await page.locator('#finishBtn').click();
      await page.waitForSelector('.run-complete');
      const last = calls.filter(x=>x.action==='finish').at(-1).body;
      assert.match(last.reflection1,/Sam:.*\n\nAfter Year 3 — same call\?\nNo\./s);
      assert.equal(last.reflection2,'From Uptime to Connect in Year 1.');
      const lesson = await page.locator('.closing-lesson').innerText();
      assert.ok(lesson.includes('twice what this heat wave needed') && lesson.includes('Sam'));
      assert.equal(await page.locator('.closing-lesson details[open]').count(),0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      results.push({viewport,fullRun:'PASS',remainingCounter:'PASS',reflectionStorage:'PASS'});
      await context.close();
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(artifactDir,'results.json'),JSON.stringify({status:'PASS',results,errors},null,2));
    console.log(`Increment 3 browser checks passed: 1366x768, 1280x720, 390x844; three complete runs; real handlers; transport=${process.env.OFFLINE_RENDER==='1'?'Node bridge':'browser HTTP'}.`);
  } finally { if(browser) await browser.close(); await new Promise(r=>server.close(r)); }
}
main().catch(e=>{ console.error(e); fs.writeFileSync(path.join(artifactDir,'failure.txt'),e.stack||String(e)); process.exitCode=1; });
