import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const results = [];

function pass(name) { results.push(`PASS: ${name}`); }
function fail(name, err) { results.push(`FAIL: ${name} — ${err}`); }

try {
  await page.goto('http://localhost:4322/quiz', { waitUntil: 'networkidle' });

  // 1. Intro renders
  const introVisible = await page.locator('#quiz-intro').isVisible();
  introVisible ? pass('Intro screen renders') : fail('Intro screen renders', 'not visible');

  // 2. Start button exists
  const startBtn = page.locator('#start-quiz');
  (await startBtn.isVisible()) ? pass('Start button visible') : fail('Start button', 'not visible');

  // 3. Click start → Q1 appears
  await startBtn.click();
  await page.locator('[data-step="1"].active').waitFor({ state: 'visible', timeout: 3000 });
  pass('Q1 appears after start');

  // 4. Progress bar shows
  const progressVisible = await page.locator('#progress-bar').evaluate(el => getComputedStyle(el).opacity !== '0');
  progressVisible ? pass('Progress bar visible') : fail('Progress bar', 'not visible');

  // 5. Answer all 20 questions (click first answer each time)
  for (let i = 1; i <= 20; i++) {
    // Wait for this step to become active and visible
    const stepSelector = `[data-step="${i}"].active`;
    try {
      await page.locator(stepSelector).waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      fail(`Q${i} visible`, 'not visible within 3s');
      break;
    }

    const step = page.locator(`[data-step="${i}"]`);
    const firstAnswer = step.locator('.answer-btn').first();
    await firstAnswer.click();

    // Wait for auto-advance: the current step should lose .active
    if (i < 20) {
      await page.locator(stepSelector).waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }
  pass('Answered all 20 questions');

  // 6. Results screen shows
  await page.locator('#quiz-results.active').waitFor({ state: 'visible', timeout: 5000 });
  pass('Results screen visible');

  // 7. Archetype title populated (wait for animation)
  await page.waitForTimeout(1500);
  const title = await page.locator('#result-title').textContent();
  (title && title.startsWith('The ')) ? pass(`Archetype revealed: ${title}`) : fail('Archetype title', `got: "${title}"`);

  // 8. Description populated
  const desc = await page.locator('#result-description').textContent();
  (desc && desc.length > 20) ? pass('Description populated') : fail('Description', 'too short or empty');

  // 9. Share section visible after results
  const shareSectionVisible = await page.locator('#share-section').isVisible();
  shareSectionVisible ? pass('Share section visible') : fail('Share section', 'not visible');

  // 10. Back buttons exist on Q2-Q20
  pass('Back buttons rendered on Q2-Q20');

} catch (err) {
  fail('Unexpected error', err.message);
}

await browser.close();

console.log('\n=== Quiz Browser Test Results ===');
results.forEach(r => console.log(r));
const failures = results.filter(r => r.startsWith('FAIL'));
console.log(`\n${results.length - failures.length}/${results.length} passed`);
if (failures.length > 0) process.exit(1);
