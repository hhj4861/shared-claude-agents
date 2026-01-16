#!/usr/bin/env node
/**
 * E2E 테스트 스텝 완료율 검증 스크립트
 *
 * 사용법:
 *   node validate-steps.js                    # 모든 TC 검증
 *   node validate-steps.js TC-UI-E2E-004     # 특정 TC 검증
 *   node validate-steps.js --incomplete      # 미완료만 표시
 */

const fs = require('fs');
const path = require('path');

// 색상 코드
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function color(text, colorName) {
  return `${colors[colorName]}${text}${colors.reset}`;
}

// 최신 히스토리 파일 찾기
function getLatestHistory() {
  const historyDir = path.join(__dirname, 'history');
  if (!fs.existsSync(historyDir)) {
    console.error(color('Error: history 디렉토리가 없습니다.', 'red'));
    process.exit(1);
  }

  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    console.error(color('Error: 히스토리 파일이 없습니다.', 'red'));
    process.exit(1);
  }

  return path.join(historyDir, files[files.length - 1]);
}

// 스텝 완료율 분석
function analyzeSteps(data, targetTcId, incompleteOnly) {
  const results = {
    total: 0,
    complete: 0,
    incomplete: [],
    passed: 0,
    failed: 0,
    pending: 0,
    skip: 0
  };

  console.log('\n' + color('=== E2E 테스트 스텝 완료율 분석 ===', 'cyan') + '\n');
  console.log(color(`분석 파일: ${path.basename(getLatestHistory())}`, 'gray'));
  console.log(color(`분석 시간: ${new Date().toLocaleString('ko-KR')}`, 'gray') + '\n');

  for (const scenario of data.scenarios) {
    // 특정 TC만 분석
    if (targetTcId && scenario.tcId !== targetTcId) continue;

    const result = data.results[scenario.tcId];
    if (!result) continue;

    results.total++;

    const definedSteps = scenario.steps.length;
    const executedSteps = result.steps?.filter(s => s !== null).length || 0;
    const rate = definedSteps > 0 ? Math.round((executedSteps / definedSteps) * 100) : 100;

    // 상태별 카운트
    if (result.status === 'passed') results.passed++;
    else if (result.status === 'failed') results.failed++;
    else if (result.status === 'pending') results.pending++;
    else if (result.status === 'skip') results.skip++;

    // 완료/미완료 분류
    const isComplete = executedSteps >= definedSteps || result.status === 'skip' || result.status === 'pending';
    if (isComplete) {
      results.complete++;
    } else {
      results.incomplete.push({
        tcId: scenario.tcId,
        name: scenario.name,
        defined: definedSteps,
        executed: executedSteps,
        rate,
        status: result.status,
        message: result.message
      });
    }

    // 미완료만 표시하는 경우 스킵
    if (incompleteOnly && isComplete) continue;

    // 개별 TC 출력
    let statusIcon, statusColor;
    switch (result.status) {
      case 'passed': statusIcon = '✅'; statusColor = 'green'; break;
      case 'failed': statusIcon = '❌'; statusColor = 'red'; break;
      case 'pending': statusIcon = '⚠️'; statusColor = 'yellow'; break;
      case 'skip': statusIcon = '⏭️'; statusColor = 'gray'; break;
      default: statusIcon = '❓'; statusColor = 'gray';
    }

    const rateIcon = rate >= 100 ? '✓' : rate >= 50 ? '△' : '✗';
    const rateColor = rate >= 100 ? 'green' : rate >= 50 ? 'yellow' : 'red';

    console.log(
      `${statusIcon} ${color(scenario.tcId, 'blue')}: ` +
      `${color(scenario.name, 'gray')} ` +
      `[${color(rateIcon + ' ' + executedSteps + '/' + definedSteps, rateColor)}]`
    );

    // 미완료 상태인데 passed인 경우 경고
    if (result.status === 'passed' && executedSteps < definedSteps) {
      console.log(
        color(`   └─ ⚠️ 경고: ${definedSteps - executedSteps}개 스텝 미수행`, 'red')
      );
    }
  }

  return results;
}

// 요약 출력
function printSummary(results) {
  console.log('\n' + color('=== 요약 ===', 'cyan') + '\n');

  console.log(color(`전체 TC: ${results.total}개`, 'blue'));
  console.log(`  ✅ Passed: ${color(results.passed, 'green')}개`);
  console.log(`  ❌ Failed: ${color(results.failed, 'red')}개`);
  console.log(`  ⚠️ Pending: ${color(results.pending, 'yellow')}개`);
  console.log(`  ⏭️ Skip: ${color(results.skip, 'gray')}개`);

  console.log('\n' + color('스텝 완료율:', 'blue'));
  console.log(`  ✓ 완료: ${color(results.complete, 'green')}개`);
  console.log(`  ✗ 미완료: ${color(results.incomplete.length, 'red')}개`);

  if (results.incomplete.length > 0) {
    console.log('\n' + color('=== 스텝 미완료 TC 목록 ===', 'red') + '\n');

    // 미완료 정도에 따라 정렬 (완료율 낮은 순)
    results.incomplete.sort((a, b) => a.rate - b.rate);

    console.log(color('| TC ID              | 정의 | 수행 | 완료율 | 상태    |', 'gray'));
    console.log(color('|--------------------|------|------|--------|---------|', 'gray'));

    for (const tc of results.incomplete) {
      const statusLabel = tc.status === 'passed' ? '⚠️ PASSED' : tc.status;
      console.log(
        `| ${tc.tcId.padEnd(18)} | ${String(tc.defined).padStart(4)} | ${String(tc.executed).padStart(4)} | ${String(tc.rate + '%').padStart(6)} | ${statusLabel.padEnd(7)} |`
      );
    }

    console.log('\n' + color('🔴 위 TC들은 스텝이 모두 수행되지 않았습니다.', 'red'));
    console.log(color('   passed로 처리하기 전에 모든 스텝을 완료하세요.', 'yellow'));
  } else {
    console.log('\n' + color('✅ 모든 TC가 스텝을 완료했습니다!', 'green'));
  }
}

// 메인 실행
function main() {
  const args = process.argv.slice(2);
  const targetTcId = args.find(a => a.startsWith('TC-'));
  const incompleteOnly = args.includes('--incomplete') || args.includes('-i');

  const historyPath = getLatestHistory();
  const data = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

  const results = analyzeSteps(data, targetTcId, incompleteOnly);
  printSummary(results);

  // 미완료 TC가 있으면 exit code 1
  if (results.incomplete.length > 0) {
    process.exit(1);
  }
}

main();
