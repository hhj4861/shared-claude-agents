const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = path.join(__dirname, '../docs/qa/screenshots/current');
const TARGET_URL = 'http://localhost:3001';

async function runBrowserTest() {
  const results = {
    url: TARGET_URL,
    timestamp: new Date().toISOString(),
    screenshots: [],
    domAnalysis: null,
    interactiveElements: [],
    interactions: [],
    errors: [],
    pageInfo: {}
  };

  let browser;

  try {
    // 1. 브라우저 시작 (headless: false)
    console.log('1. 브라우저 시작 중...');
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1440, height: 900 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('   브라우저 시작 완료');

    const page = await browser.newPage();

    // 콘솔 로그 캡처
    page.on('console', msg => {
      console.log('   [Browser Console]', msg.type(), msg.text());
    });

    // 에러 캡처
    page.on('pageerror', error => {
      results.errors.push({ type: 'pageerror', message: error.message });
    });

    // 2. localhost:3001로 이동
    console.log('\n2. 페이지 이동 중...');
    const response = await page.goto(TARGET_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    results.pageInfo.status = response.status();
    results.pageInfo.statusText = response.statusText();
    console.log(`   페이지 로드 완료 (Status: ${response.status()})`);

    // 페이지 타이틀 가져오기
    results.pageInfo.title = await page.title();
    results.pageInfo.url = page.url();
    console.log(`   페이지 타이틀: ${results.pageInfo.title}`);

    // 3. 메인 페이지 스크린샷 캡처
    console.log('\n3. 스크린샷 캡처 중...');
    const screenshotPath = path.join(SCREENSHOT_DIR, `main-page-${Date.now()}.png`);
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    results.screenshots.push(screenshotPath);
    console.log(`   스크린샷 저장: ${screenshotPath}`);

    // 4. DOM 분석
    console.log('\n4. DOM 요소 분석 중...');
    results.domAnalysis = await page.evaluate(() => {
      const analysis = {
        totalElements: document.querySelectorAll('*').length,
        headings: [],
        images: [],
        forms: [],
        inputs: [],
        buttons: [],
        links: [],
        textContent: ''
      };

      // 헤딩 요소
      ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
        document.querySelectorAll(tag).forEach(el => {
          analysis.headings.push({ tag: tag.toUpperCase(), text: el.textContent.trim() });
        });
      });

      // 이미지
      document.querySelectorAll('img').forEach(img => {
        analysis.images.push({ src: img.src, alt: img.alt || '(no alt)' });
      });

      // 폼
      document.querySelectorAll('form').forEach((form, i) => {
        analysis.forms.push({
          id: form.id || `form-${i}`,
          action: form.action,
          method: form.method
        });
      });

      // 입력 필드
      document.querySelectorAll('input, textarea, select').forEach(input => {
        analysis.inputs.push({
          type: input.type || input.tagName.toLowerCase(),
          name: input.name || input.id || '(unnamed)',
          placeholder: input.placeholder || ''
        });
      });

      // 버튼
      document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(btn => {
        analysis.buttons.push({
          type: btn.type || 'button',
          text: btn.textContent?.trim() || btn.value || '(no text)',
          id: btn.id || '',
          className: btn.className || ''
        });
      });

      // 링크
      document.querySelectorAll('a[href]').forEach(link => {
        analysis.links.push({
          href: link.href,
          text: link.textContent?.trim() || '(no text)',
          target: link.target || '_self'
        });
      });

      // 주요 텍스트 컨텐츠 (body의 첫 1000자)
      analysis.textContent = document.body?.innerText?.substring(0, 1000) || '';

      return analysis;
    });

    console.log(`   총 DOM 요소: ${results.domAnalysis.totalElements}`);
    console.log(`   헤딩: ${results.domAnalysis.headings.length}개`);
    console.log(`   이미지: ${results.domAnalysis.images.length}개`);
    console.log(`   폼: ${results.domAnalysis.forms.length}개`);
    console.log(`   입력 필드: ${results.domAnalysis.inputs.length}개`);
    console.log(`   버튼: ${results.domAnalysis.buttons.length}개`);
    console.log(`   링크: ${results.domAnalysis.links.length}개`);

    // 5. 클릭 가능한 요소 수집
    console.log('\n5. 클릭 가능한 요소 확인 중...');
    results.interactiveElements = await page.evaluate(() => {
      const interactive = [];

      // 버튼
      document.querySelectorAll('button').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          interactive.push({
            type: 'button',
            selector: el.id ? `#${el.id}` : `button:nth-of-type(${i + 1})`,
            text: el.textContent?.trim(),
            visible: true
          });
        }
      });

      // 링크
      document.querySelectorAll('a[href]').forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          interactive.push({
            type: 'link',
            selector: el.id ? `#${el.id}` : `a[href="${el.getAttribute('href')}"]`,
            text: el.textContent?.trim(),
            href: el.href,
            visible: true
          });
        }
      });

      return interactive;
    });

    console.log(`   클릭 가능한 요소: ${results.interactiveElements.length}개`);

    // 6. 인터랙션 테스트 (첫 번째 버튼 또는 링크 클릭)
    console.log('\n6. 인터랙션 테스트 중...');

    // 버튼 클릭 테스트
    const buttons = results.interactiveElements.filter(el => el.type === 'button');
    if (buttons.length > 0) {
      try {
        const firstButton = buttons[0];
        console.log(`   버튼 클릭 시도: "${firstButton.text}"`);

        // 클릭 전 스크린샷
        const beforeClickPath = path.join(SCREENSHOT_DIR, `before-click-${Date.now()}.png`);
        await page.screenshot({ path: beforeClickPath });
        results.screenshots.push(beforeClickPath);

        await page.click(firstButton.selector);
        await page.waitForTimeout(1000);

        // 클릭 후 스크린샷
        const afterClickPath = path.join(SCREENSHOT_DIR, `after-click-${Date.now()}.png`);
        await page.screenshot({ path: afterClickPath });
        results.screenshots.push(afterClickPath);

        results.interactions.push({
          action: 'click',
          target: firstButton.selector,
          targetText: firstButton.text,
          success: true
        });
        console.log(`   버튼 클릭 성공`);
      } catch (err) {
        results.interactions.push({
          action: 'click',
          target: buttons[0].selector,
          success: false,
          error: err.message
        });
        console.log(`   버튼 클릭 실패: ${err.message}`);
      }
    }

    // 내부 링크 테스트 (같은 도메인 링크만)
    const internalLinks = results.interactiveElements.filter(
      el => el.type === 'link' && el.href && el.href.includes('localhost:3001')
    );

    if (internalLinks.length > 0) {
      const linkToTest = internalLinks[0];
      try {
        console.log(`   링크 클릭 시도: "${linkToTest.text}" -> ${linkToTest.href}`);

        await page.click(linkToTest.selector);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // 링크 이동 후 스크린샷
        const linkScreenshotPath = path.join(SCREENSHOT_DIR, `after-navigation-${Date.now()}.png`);
        await page.screenshot({ path: linkScreenshotPath, fullPage: true });
        results.screenshots.push(linkScreenshotPath);

        results.interactions.push({
          action: 'navigate',
          target: linkToTest.href,
          targetText: linkToTest.text,
          resultUrl: page.url(),
          success: true
        });
        console.log(`   링크 이동 성공: ${page.url()}`);
      } catch (err) {
        results.interactions.push({
          action: 'navigate',
          target: linkToTest.href,
          success: false,
          error: err.message
        });
        console.log(`   링크 이동 실패: ${err.message}`);
      }
    }

    // 최종 결과 저장
    console.log('\n7. 테스트 결과 저장 중...');
    const resultPath = path.join(SCREENSHOT_DIR, `test-results-${Date.now()}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    console.log(`   결과 저장: ${resultPath}`);

    // 브라우저 잠시 유지 (확인용)
    console.log('\n   브라우저를 5초간 유지합니다...');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('테스트 중 오류 발생:', error.message);
    results.errors.push({ type: 'fatal', message: error.message });
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n브라우저 종료');
    }
  }

  return results;
}

// 실행
runBrowserTest()
  .then(results => {
    console.log('\n========================================');
    console.log('테스트 완료!');
    console.log('========================================');
    console.log(JSON.stringify(results, null, 2));
  })
  .catch(err => {
    console.error('테스트 실패:', err);
    process.exit(1);
  });
