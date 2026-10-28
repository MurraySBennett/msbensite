const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.BASE_URL || 'http://127.0.0.1:8303';
let browser;

before(async () => {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
});

after(async () => { await browser?.close(); });

async function startGame(t, powerupIndex = 0, mobile = false) {
  const page = await browser.newPage({
    viewport: { width: mobile ? 390 : 1280, height: 844 },
    ...(mobile ? {
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    } : {}),
  });
  t.after(() => page.close());
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin
    ? route.continue() : route.abort());
  await page.goto(base);
  await page.evaluate((chosenPowerup) => {
    window.__snakeNow = Date.now();
    Date.now = () => window.__snakeNow;
    window.__snakeAdvance = milliseconds => { window.__snakeNow += milliseconds; };
    const timers = [];
    let nextId = 0;
    window.__snakeTimers = timers;
    window.setTimeout = (callback, delay, ...args) => {
      const timer = { id: ++nextId, delay: Number(delay), callback: () => callback(...args), cleared: false };
      timers.push(timer);
      return timer.id;
    };
    window.clearTimeout = id => {
      const timer = timers.find(item => item.id === id);
      if (timer) timer.cleared = true;
    };
    let randomCall = 0;
    Math.random = () => {
      const call = randomCall++;
      const canvas = document.querySelector('#game-area canvas');
      const columns = Math.floor(canvas.width / 16);
      const rows = Math.floor(canvas.height / 16);
      if (call <= 4 || call === 7 || (call >= 9 && call <= 13)) {
        const foodCall = call <= 4 ? call : call === 7 ? 6 : call - 3;
        const emptyCells = columns * rows - (foodCall + 1);
        return (5 * columns + 5.5) / emptyCells;
      }
      if (call === 5) return (chosenPowerup + 0.1) / 9;
      if (call === 6) return (5 * columns + 5.5) / (columns * rows - 6);
      return 0.25;
    };
    window.__snakeRunLoop = () => {
      const timer = timers.find(item => !item.cleared && (item.delay === 100 || item.delay === 70));
      if (!timer) throw new Error('No movement callback is queued');
      timer.cleared = true;
      timer.callback();
    };
    window.__snakeRunPowerupTimer = () => {
      const timer = timers.find(item => !item.cleared && item.delay >= 10000 && item.delay <= 30000);
      if (!timer) throw new Error('No powerup spawn callback is queued');
      timer.cleared = true;
      timer.callback();
      return timer.delay;
    };
    window.__snakeRunExpiry = () => {
      const timer = timers.find(item => !item.cleared && item.delay === 5000);
      if (!timer) throw new Error('No five-second pickup expiry is queued');
      timer.cleared = true;
      timer.callback();
    };
  }, powerupIndex);
  await page.locator('.profile-info h1').click({ force: true });
  await page.locator('#game-area canvas').waitFor();
  return page;
}

async function reachPowerupThreshold(page) {
  for (let move = 0; move < 4; move++) await page.evaluate(() => window.__snakeRunLoop());
}

async function collectAvailablePowerup(page) {
  await page.keyboard.press('ArrowRight');
  await page.evaluate(() => window.__snakeRunLoop());
}

async function tap(page, selector) {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible' });
  const box = await button.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('snake uses the requested colors and gives no unlock hint', async t => {
  const page = await startGame(t);
  const before = await page.evaluate(() => {
    const canvas = document.querySelector('#game-area canvas');
    const ctx = canvas.getContext('2d');
    const snake = [...ctx.getImageData(6 * 16 + 2, 5 * 16 + 2, 1, 1).data];
    const apple = [...ctx.getImageData(7 * 16 + 2, 5 * 16 + 8, 1, 1).data];
    const longTimers = window.__snakeTimers.filter(timer => !timer.cleared && timer.delay > 1000);
    return {
      score: document.querySelector('.score-display').textContent,
      snake,
      apple,
      longTimers,
      status: document.querySelector('.powerup-status').textContent,
    };
  });
  assert.deepEqual(before.snake, [91, 206, 250, 255]);
  assert.deepEqual(before.apple, [245, 169, 184, 255]);
  assert.equal(before.score, 'Score: 1');
  assert.equal(before.longTimers.length, 0);
  assert.equal(before.status, '');
});

test('powerups first appear at five points without a hint and the inventory stays beside the profile', async t => {
  const page = await startGame(t);
  await page.evaluate(() => {
    for (let move = 0; move < 4; move++) window.__snakeRunLoop();
  });
  const state = await page.evaluate(() => ({
    score: document.querySelector('.score-display').textContent,
    status: document.querySelector('.snake-inventory .powerup-status').textContent,
    timer: document.querySelector('.snake-inventory .powerup-timer').textContent,
    game: document.querySelector('#game-area').getBoundingClientRect().toJSON(),
    profile: document.querySelector('#pacman-container').getBoundingClientRect().toJSON(),
    inventory: document.querySelector('.snake-inventory').getBoundingClientRect().toJSON(),
    scoreBox: document.querySelector('.score-display').getBoundingClientRect().toJSON(),
    statusBox: document.querySelector('.snake-inventory .powerup-status').getBoundingClientRect().toJSON(),
    timerBox: document.querySelector('.snake-inventory .powerup-timer').getBoundingClientRect().toJSON(),
  }));
  assert.equal(state.score, 'Score: 5');
  assert.doesNotMatch(state.status, /unlock/i);
  assert.equal(state.timer, '5s');
  assert.ok(state.inventory.left >= state.profile.right - 1);
  assert.ok(state.game.left >= state.inventory.right - 1);
  for (const box of [state.scoreBox, state.statusBox, state.timerBox]) {
    assert.ok(box.left >= state.inventory.left && box.right <= state.inventory.right);
  }
});

test('an uncollected pickup expires after five seconds and starts a new randomized wait', async t => {
  const page = await startGame(t);
  await reachPowerupThreshold(page);
  const expiryDelay = await page.evaluate(() => window.__snakeTimers
    .find(timer => !timer.cleared && timer.delay === 5000)?.delay ?? null);
  assert.equal(expiryDelay, 5000);

  await page.evaluate(() => window.__snakeRunExpiry());
  const nextDelay = await page.evaluate(() => window.__snakeTimers
    .filter(timer => !timer.cleared && timer.delay >= 10000 && timer.delay <= 30000)
    .map(timer => timer.delay));
  assert.equal(nextDelay.length, 1);
});

test('portal pickup pauses for placement and exposes the two countdown phases', async t => {
  const portalIndex = 8;
  const page = await startGame(t, portalIndex);
  await reachPowerupThreshold(page);
  await collectAvailablePowerup(page);
  assert.match(await page.locator('.powerup-slot').nth(portalIndex).getAttribute('aria-label'), /Lemon: Place A \+ B/);
  assert.match(await page.locator('.snake-inventory .powerup-timer').innerText(), /8/);

  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('a');
  assert.match(await page.locator('.snake-inventory .powerup-status').innerText(), /Choose an empty portal tile/);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('a');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('b');
  assert.match(await page.locator('.powerup-slot').nth(portalIndex).getAttribute('aria-label'), /Lemon: Portal pair/);
  assert.equal(await page.locator('.snake-inventory .powerup-timer').innerText(), '');
  await page.keyboard.press('ArrowUp');
  for (let move = 0; move < 3; move++) await page.evaluate(() => window.__snakeRunLoop());
  const exitTileBluePixels = await page.evaluate(() => {
    const canvas = document.querySelector('#game-area canvas');
    const pixels = canvas.getContext('2d').getImageData(12 * 16, 2 * 16, 16, 16).data;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] === 91 && pixels[index + 1] === 206 && pixels[index + 2] === 250) count++;
    }
    return count;
  });
  assert.ok(exitTileBluePixels > 0, `portal exit tile only has ${exitTileBluePixels} snake pixels`);
  await page.evaluate(() => window.__snakeAdvance(60000));
  for (let move = 0; move < 3; move++) await page.evaluate(() => window.__snakeRunLoop());
  assert.match(await page.locator('.powerup-slot').nth(portalIndex).getAttribute('aria-label'), /Lemon: Portal pair/);
});

test('each fruit applies its named effect and the portal placement timeout resumes movement', async t => {
  const expected = [
    /Pepper: Speed boost, 40 remaining/,
    /Peach: Big apple/,
    /Grapes: Tail pass, 1 remaining/,
    /Lime: Wall wrap, 1 remaining/,
    /Pineapple: Tail trim/,
    /Starfruit: Double points, 3 remaining/,
    /Mango: Apple magnet, 40 remaining/,
    /Pomegranate: Bonus apples, 3 remaining/,
    /Lemon: Place A \+ B/,
  ];
  for (let type = 0; type < expected.length; type++) {
    const page = await startGame(t, type);
    await reachPowerupThreshold(page);
    await collectAvailablePowerup(page);
    assert.match(await page.locator('.powerup-slot').nth(type).getAttribute('aria-label'), expected[type], `powerup ${type}`);
    const nextSpawnDelay = await page.evaluate(() => window.__snakeTimers
      .filter(timer => !timer.cleared && timer.delay >= 10000 && timer.delay <= 30000)
      .map(timer => timer.delay));
    assert.equal(nextSpawnDelay.length, 1, `powerup ${type} should restart the randomized wait`);
    if (type === 0) {
      assert.ok(await page.evaluate(() => window.__snakeTimers.some(timer => !timer.cleared && timer.delay === 70)));
    }
    if (type === 2) {
      await page.keyboard.press('ArrowDown');
      await page.evaluate(() => window.__snakeRunLoop());
      await page.keyboard.press('ArrowLeft');
      await page.evaluate(() => window.__snakeRunLoop());
      await page.keyboard.press('ArrowUp');
      await page.evaluate(() => window.__snakeRunLoop());
      assert.doesNotMatch(await page.locator('.powerup-status').innerText(), /Game over/);
      assert.equal(await page.locator('.powerup-slot').nth(type).getAttribute('aria-label'), 'Grapes powerup');
    }
    if (type === 3) {
      for (let move = 0; move < 5; move++) await page.evaluate(() => window.__snakeRunLoop());
      assert.doesNotMatch(await page.locator('.powerup-status').innerText(), /Game over/);
    }
    if (type === 4) {
      const bluePixels = await page.evaluate(() => {
        const canvas = document.querySelector('#game-area canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index] === 91 && pixels[index + 1] === 206 && pixels[index + 2] === 250) count++;
        }
        return count;
      });
      assert.equal(bluePixels, 3 * 15 * 15);
    }
    if (type === 5) {
      await page.keyboard.press('ArrowRight');
      await page.evaluate(() => window.__snakeRunLoop());
      assert.equal(await page.locator('.score-display').innerText(), 'Score: 7');
      assert.match(await page.locator('.powerup-slot').nth(type).getAttribute('aria-label'), /Starfruit: Double points, 2 remaining/);
    }
    if (type === 6) {
      const initialMagnetCell = await page.evaluate(() => {
        const canvas = document.querySelector('#game-area canvas');
        const { width, height } = canvas;
        const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          if (pixels[index] === 245 && pixels[index + 1] === 169 && pixels[index + 2] === 184) {
            return [Math.floor(x / 16), Math.floor(y / 16)];
          }
        }
        return null;
      });
      for (let move = 0; move < 5; move++) {
        await page.keyboard.press('ArrowLeft');
        await page.evaluate(() => window.__snakeRunLoop());
      }
      assert.match(await page.locator('.powerup-slot').nth(type).getAttribute('aria-label'), /Mango: Apple magnet, 35 remaining/);
      const magnetCell = await page.evaluate(() => {
        const canvas = document.querySelector('#game-area canvas');
        const { width, height } = canvas;
        const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          if (pixels[index] === 245 && pixels[index + 1] === 169 && pixels[index + 2] === 184) {
            return [Math.floor(x / 16), Math.floor(y / 16)];
          }
        }
        return null;
      });
      assert.notDeepEqual(magnetCell, initialMagnetCell);
    }
    if (type === 8) {
      await page.evaluate(() => window.__snakeAdvance(8000));
      await page.evaluate(() => window.__snakeRunLoop());
      assert.match(await page.locator('.snake-inventory .powerup-status').innerText(), /timed out/i);
    }
  }
});

test('portal endpoints can be placed with the mobile gamepad without overflowing the screen', async t => {
  const page = await startGame(t, 8, true);
  await reachPowerupThreshold(page);
  await collectAvailablePowerup(page);
  await page.locator('#virtual-gamepad.active').waitFor({ state: 'visible' });
  await page.waitForFunction(() => Number.parseFloat(getComputedStyle(document.querySelector('#virtual-gamepad')).opacity) > 0.95);
  await tap(page, '#a-key');
  await tap(page, '#right-key');
  await tap(page, '#b-key');
  const state = await page.evaluate(() => ({
    timer: document.querySelector('.snake-inventory .powerup-timer').textContent,
    active: document.querySelector('#virtual-gamepad').className,
    a: document.querySelector('#a-key').getBoundingClientRect().toJSON(),
    b: document.querySelector('#b-key').getBoundingClientRect().toJSON(),
  }));
  assert.equal(state.timer, '');
  assert.match(await page.locator('.powerup-slot').nth(8).getAttribute('aria-label'), /Lemon: Portal pair/);
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, view: innerWidth }));
  assert.ok(width.scroll <= width.view, `mobile page overflowed: ${width.scroll}px > ${width.view}px`);
});
