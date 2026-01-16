const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');

// Auto-open browser option (default: true, set NO_OPEN=1 to disable)
const AUTO_OPEN = process.env.NO_OPEN !== '1';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Store connected clients
const clients = new Set();

// Store current test state
let testState = {
  scenarios: [],
  currentTC: null,
  currentTCIndex: -1,  // 현재 TC의 인덱스 (순서 검증용)
  currentStep: null,
  results: {},
  projectName: '',  // 프로젝트명
  triggerPending: false,  // 테스트 트리거 대기 상태
  triggerTime: null  // 트리거 요청 시간
};

// ===== 파일 기반 이력 저장 기능 =====
const HISTORY_DIR = path.join(__dirname, 'history');

// history 디렉토리 생성
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  console.log('[HISTORY] Created history directory:', HISTORY_DIR);
}

/**
 * 현재 테스트 상태를 파일로 저장
 * @param {string} reason - 저장 이유 (tc-complete, manual 등)
 */
function saveState(reason = 'auto') {
  if (testState.scenarios.length === 0) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const projectSlug = (testState.projectName || 'unknown').replace(/[^a-zA-Z0-9가-힣]/g, '-');
  const filename = `${timestamp}_${projectSlug}.json`;
  const filepath = path.join(HISTORY_DIR, filename);

  // 상태별 TC 분류
  const allTcIds = testState.scenarios.map(s => s.tcId);
  const testedTcIds = Object.keys(testState.results);
  const waitingTcIds = allTcIds.filter(id => !testedTcIds.includes(id));
  const pendingTcIds = Object.entries(testState.results)
    .filter(([_, r]) => r.status === 'pending')
    .map(([id, _]) => id);
  const skipTcIds = Object.entries(testState.results)
    .filter(([_, r]) => r.status === 'skip')
    .map(([id, _]) => id);

  const stateToSave = {
    savedAt: new Date().toISOString(),
    reason,
    projectName: testState.projectName,
    scenarioPath: SCENARIO_PATH,
    scenarios: testState.scenarios,
    results: testState.results,
    groupNames: dynamicGroupNames,
    summary: {
      total: testState.scenarios.length,
      passed: Object.values(testState.results).filter(r => r.status === 'passed').length,
      failed: Object.values(testState.results).filter(r => r.status === 'failed').length,
      pending: pendingTcIds.length,
      skip: skipTcIds.length,
      waiting: waitingTcIds.length,
      running: Object.values(testState.results).filter(r => r.status === 'running').length
    },
    // 미진행 TC 목록 (테스트 재개 시 참조용)
    waitingTCs: waitingTcIds,
    pendingTCs: pendingTcIds,
    skipTCs: skipTcIds
  };

  try {
    fs.writeFileSync(filepath, JSON.stringify(stateToSave, null, 2), 'utf8');
    console.log(`[HISTORY] State saved: ${filename} (${reason})`);

    // 오래된 파일 정리 (최근 20개만 유지)
    cleanupOldHistory();
    return filepath;
  } catch (err) {
    console.error('[HISTORY] Failed to save state:', err.message);
    return null;
  }
}

/**
 * 가장 최근 이력 파일 로드
 * @param {string} scenarioPath - 특정 시나리오 경로와 매칭되는 이력만 로드 (선택)
 */
function loadLatestState(scenarioPath = null) {
  try {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log('[HISTORY] No history files found');
      return null;
    }

    // 시나리오 경로가 지정되면 해당 경로와 매칭되는 이력 찾기
    for (const file of files) {
      const filepath = path.join(HISTORY_DIR, file);
      const content = fs.readFileSync(filepath, 'utf8');
      const state = JSON.parse(content);

      // 시나리오 경로 매칭 체크
      if (scenarioPath && state.scenarioPath !== scenarioPath) {
        continue;
      }

      console.log(`[HISTORY] Loaded state from: ${file}`);
      console.log(`  - Project: ${state.projectName}`);
      console.log(`  - Saved at: ${state.savedAt}`);
      console.log(`  - Summary: ${state.summary.passed}P/${state.summary.failed}F/${state.summary.total}T`);
      return state;
    }

    console.log('[HISTORY] No matching history found for:', scenarioPath);
    return null;
  } catch (err) {
    console.error('[HISTORY] Failed to load state:', err.message);
    return null;
  }
}

/**
 * 오래된 이력 파일 정리 (최근 20개만 유지)
 */
function cleanupOldHistory() {
  try {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    const toDelete = files.slice(20);
    toDelete.forEach(file => {
      fs.unlinkSync(path.join(HISTORY_DIR, file));
      console.log(`[HISTORY] Cleaned up old file: ${file}`);
    });
  } catch (err) {
    console.error('[HISTORY] Cleanup error:', err.message);
  }
}

/**
 * 특정 이력 파일 로드
 * @param {string} filename - 이력 파일명 (확장자 포함)
 */
function loadFromHistoryFile(filename) {
  try {
    // 파일명만 주어진 경우 history 디렉토리에서 찾기
    let filepath = filename;
    if (!path.isAbsolute(filename)) {
      filepath = path.join(HISTORY_DIR, filename);
    }

    if (!fs.existsSync(filepath)) {
      console.log(`[HISTORY] Specified history file not found: ${filename}`);
      return null;
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const state = JSON.parse(content);

    console.log(`[HISTORY] Loaded specified history: ${filename}`);
    console.log(`  - Project: ${state.projectName}`);
    console.log(`  - Saved at: ${state.savedAt}`);
    console.log(`  - Summary: ${state.summary?.passed || 0}P/${state.summary?.failed || 0}F/${state.summary?.total || 0}T`);
    return state;
  } catch (err) {
    console.error(`[HISTORY] Failed to load specified history: ${err.message}`);
    return null;
  }
}

/**
 * 이력에서 상태 복원
 */
function restoreFromHistory(historyState) {
  if (!historyState) return false;

  testState.scenarios = historyState.scenarios || [];
  testState.results = historyState.results || {};
  testState.projectName = historyState.projectName || '';
  testState.currentTC = null;
  testState.currentTCIndex = -1;
  testState.currentStep = null;

  if (historyState.groupNames) {
    dynamicGroupNames = historyState.groupNames;
  }

  return true;
}

// config.json에서 프로젝트명 로드
function loadProjectName(scenarioPath) {
  try {
    // scenarios/ 디렉토리의 상위인 latest/ 디렉토리에서 config.json 찾기
    // 예: /path/docs/qa/latest/scenarios/e2e-scenarios.md -> /path/docs/qa/latest/config.json
    const scenarioDir = path.dirname(scenarioPath);
    const latestDir = path.dirname(scenarioDir);  // scenarios의 상위
    const configPath = path.join(latestDir, 'config.json');

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.project_name || config.projectName || path.basename(latestDir);
    }

    // config.json이 없으면 디렉토리명 사용
    return path.basename(latestDir);
  } catch (err) {
    console.log('Could not load project name:', err.message);
    return '';
  }
}

// Auto-load scenario from environment variable or command line argument
const SCENARIO_PATH = process.env.SCENARIO_PATH || process.argv[2];

// 특정 이력 파일 지정 (환경변수)
// 지정하면 해당 이력으로 복원, 없으면 최신 이력 자동 복원
const HISTORY_FILE = process.env.HISTORY_FILE;

function autoLoadScenarios() {
  if (!SCENARIO_PATH) {
    console.log('No scenario path provided. Use SCENARIO_PATH env or pass as argument.');
    console.log('Example: SCENARIO_PATH=/path/to/scenarios.md npm start');
    console.log('     or: npm start /path/to/scenarios.md');
    return;
  }

  if (!fs.existsSync(SCENARIO_PATH)) {
    console.log(`Scenario file not found: ${SCENARIO_PATH}`);
    return;
  }

  try {
    const content = fs.readFileSync(SCENARIO_PATH, 'utf-8');
    const scenarios = parseScenarios(content);
    testState.projectName = loadProjectName(SCENARIO_PATH);

    // 이전 이력 확인 및 복원
    // HISTORY_FILE이 지정되면 해당 파일, 없으면 최신 이력 자동 복원
    let historyState = null;
    if (HISTORY_FILE) {
      console.log(`[HISTORY] Using specified history file: ${HISTORY_FILE}`);
      historyState = loadFromHistoryFile(HISTORY_FILE);
    } else {
      historyState = loadLatestState(SCENARIO_PATH);
    }
    if (historyState && historyState.results && Object.keys(historyState.results).length > 0) {
      // 시나리오 ID 매칭 확인
      const historyTcIds = new Set(historyState.scenarios.map(s => s.tcId));
      const currentTcIds = new Set(scenarios.map(s => s.tcId));
      const isMatching = scenarios.every(s => historyTcIds.has(s.tcId));

      if (isMatching) {
        console.log('[HISTORY] Restoring previous test results...');
        testState.scenarios = scenarios;
        testState.results = historyState.results;
        if (historyState.groupNames) {
          dynamicGroupNames = historyState.groupNames;
        }

        // 상태별 카운트
        const passed = Object.values(testState.results).filter(r => r.status === 'passed').length;
        const failed = Object.values(testState.results).filter(r => r.status === 'failed').length;
        const pendingHold = Object.values(testState.results).filter(r => r.status === 'pending').length;
        const skip = Object.values(testState.results).filter(r => r.status === 'skip').length;
        const testedTcIds = Object.keys(testState.results);
        const waitingTCs = scenarios.filter(tc => !testedTcIds.includes(tc.tcId));
        const waiting = waitingTCs.length;

        console.log(`  - Restored: ${passed}P/${failed}F/${pendingHold}H/${skip}S/${waiting}W (총 ${scenarios.length})`);
        console.log(`    [P]assed=${passed}, [F]ailed=${failed}, [H]old(보류)=${pendingHold}, [S]kip=${skip}, [W]aiting(미진행)=${waiting}`);

        // 미진행 TC 목록 출력
        if (waiting > 0) {
          console.log(`  - 미진행 TC (${waiting}개):`);
          waitingTCs.slice(0, 5).forEach((tc, i) => {
            console.log(`    ${i + 1}. ${tc.tcId}: ${tc.name}`);
          });
          if (waiting > 5) {
            console.log(`    ... 외 ${waiting - 5}개`);
          }
          console.log(`  - 다음 미진행 TC: ${waitingTCs[0].tcId} - ${waitingTCs[0].name}`);
        }

        // 보류 TC도 출력
        if (pendingHold > 0) {
          const holdTCs = scenarios.filter(tc => testState.results[tc.tcId]?.status === 'pending');
          console.log(`  - 보류 TC (${pendingHold}개):`);
          holdTCs.slice(0, 3).forEach((tc, i) => {
            const msg = testState.results[tc.tcId]?.message || '';
            console.log(`    ${i + 1}. ${tc.tcId}: ${msg.substring(0, 50)}...`);
          });
        }
      } else {
        console.log('[HISTORY] Scenario structure changed, starting fresh');
        testState.scenarios = scenarios;
        testState.results = {};
      }
    } else {
      console.log('[HISTORY] No previous results found, starting fresh');
      testState.scenarios = scenarios;
      testState.results = {};
    }

    console.log(`Auto-loaded ${scenarios.length} scenarios from: ${SCENARIO_PATH}`);
    console.log(`Project name: ${testState.projectName}`);

    // Broadcast to any connected clients
    broadcast({ type: 'scenarios-loaded', data: scenarios, groupNames: dynamicGroupNames, projectName: testState.projectName });
  } catch (err) {
    console.error('Failed to auto-load scenarios:', err.message);
  }
}

// WebSocket connection
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Dashboard client connected');

  // Send current state with dynamic group names and project name
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      ...testState,
      groupNames: dynamicGroupNames,  // 동적 그룹명 포함
      projectName: testState.projectName  // 프로젝트명 포함
    }
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Dashboard client disconnected');
  });
});

// Broadcast to all clients
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  });
}

// API endpoints for MCP integration

// Load scenarios from file
app.post('/api/load-scenarios', (req, res) => {
  const { scenarioPath } = req.body;

  try {
    if (scenarioPath && fs.existsSync(scenarioPath)) {
      const content = fs.readFileSync(scenarioPath, 'utf-8');
      const scenarios = parseScenarios(content);
      testState.scenarios = scenarios;
      testState.results = {};
      testState.projectName = loadProjectName(scenarioPath);

      broadcast({ type: 'scenarios-loaded', data: scenarios, groupNames: dynamicGroupNames, projectName: testState.projectName });
      res.json({ success: true, count: scenarios.length, groupNames: dynamicGroupNames, projectName: testState.projectName });
    } else {
      res.status(400).json({ error: 'Scenario file not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start a test case
app.post('/api/tc/start', (req, res) => {
  const { tcId, name } = req.body;

  // TC 순서 검증
  const tcIndex = testState.scenarios.findIndex(s => s.tcId === tcId);

  if (tcIndex === -1) {
    console.warn(`[WARN] Unknown TC: ${tcId}`);
  } else if (testState.currentTCIndex >= 0 && tcIndex !== testState.currentTCIndex + 1 && tcIndex !== 0) {
    // 이전 TC가 완료되지 않았거나 순서가 맞지 않음
    const expectedTC = testState.scenarios[testState.currentTCIndex + 1]?.tcId || 'N/A';
    console.warn(`[WARN] TC 순서 위반! 현재: ${testState.currentTC}, 요청: ${tcId}, 기대: ${expectedTC}`);
    // 경고만 하고 진행 허용 (엄격 모드에서는 에러 반환 가능)
  }

  testState.currentTC = tcId;
  testState.currentTCIndex = tcIndex;
  testState.currentStep = -1;  // 스텝 시작 전
  testState.results[tcId] = { status: 'running', steps: [] };

  broadcast({
    type: 'tc-start',
    data: { tcId, name }
  });

  console.log(`[TC START] ${tcId}: ${name}`);
  res.json({ success: true, tcIndex });
});

// Update step progress
app.post('/api/tc/step', (req, res) => {
  const { tcId, stepIndex, stepName, status, message, improvements } = req.body;

  // TC 일치 검증
  if (testState.currentTC !== tcId) {
    console.warn(`[WARN] TC 불일치! 현재 TC: ${testState.currentTC}, 요청 TC: ${tcId}`);
  }

  // 스텝 순서 검증
  if (testState.currentStep >= 0 && stepIndex !== testState.currentStep + 1 && stepIndex !== 0) {
    console.warn(`[WARN] 스텝 순서 위반! 현재: ${testState.currentStep}, 요청: ${stepIndex}, 기대: ${testState.currentStep + 1}`);
  }

  // 시나리오에서 로드된 스텝 설명 사용 (동기화)
  const scenario = testState.scenarios.find(s => s.tcId === tcId);
  const actualStepName = (scenario && scenario.steps[stepIndex]) || stepName || `Step ${stepIndex + 1}`;

  if (testState.results[tcId]) {
    testState.results[tcId].steps[stepIndex] = { name: actualStepName, status, message, improvements };
    testState.currentStep = stepIndex;
  }

  broadcast({
    type: 'tc-step',
    data: { tcId, stepIndex, stepName: actualStepName, status, message, improvements }
  });

  console.log(`[STEP ${stepIndex}] ${tcId}: ${actualStepName} - ${status}`);
  res.json({ success: true, stepName: actualStepName });
});

// Complete a test case
app.post('/api/tc/complete', (req, res) => {
  let { tcId, status, message, screenshot, improvements, videoPath } = req.body;

  // "실패 예상" TC 설명:
  // - 사용자의 잘못된 액션을 시스템이 차단해야 하는 시나리오
  // - 시스템이 정상적으로 차단하면 = 테스트 PASS ✅
  // - 시스템이 차단하지 못하면 = 테스트 FAIL ❌
  // - 따라서 자동 상태 변환 불필요 (테스터가 직접 판단)
  const tc = testState.scenarios.find(s => s.tcId === tcId);

  // ===== 스텝 완료율 검증 (MANDATORY) =====
  let stepWarning = null;
  if (tc && status === 'passed') {
    const definedSteps = tc.steps?.length || 0;
    const executedSteps = testState.results[tcId]?.steps?.filter(s => s !== null).length || 0;
    const completionRate = definedSteps > 0 ? Math.round((executedSteps / definedSteps) * 100) : 100;

    if (executedSteps < definedSteps) {
      stepWarning = {
        defined: definedSteps,
        executed: executedSteps,
        rate: completionRate,
        missing: definedSteps - executedSteps
      };

      // 100% 미완료면 강제로 pending 처리 (모든 스텝 완료 필수)
      status = 'pending';
      message = `[스텝 미완료] ${executedSteps}/${definedSteps} 스텝만 수행됨 (${completionRate}%). ${message || ''}`;
      console.log(`[STEP-INCOMPLETE] ${tcId}: passed → pending (${completionRate}% 완료, 100% 필요)`);
      console.warn(`[STEP-BLOCKED] ${tcId}: 모든 스텝 완료 전까지 PASS 불가`);
    }
  }

  if (testState.results[tcId]) {
    testState.results[tcId].status = status;
    testState.results[tcId].message = message;
    testState.results[tcId].screenshot = screenshot;
    testState.results[tcId].improvements = improvements;  // TC 전체 개선 방안
    if (stepWarning) {
      testState.results[tcId].stepWarning = stepWarning;  // 스텝 경고 정보 저장
    }
    if (videoPath) {
      testState.results[tcId].videoPath = videoPath;  // 실패 영상 경로
    }
  }

  broadcast({
    type: 'tc-complete',
    data: { tcId, status, message, screenshot, improvements, stepWarning, videoPath }
  });

  const icon = status === 'passed' ? '✅' : status === 'pending' ? '⚠️' : '❌';
  console.log(`[TC COMPLETE] ${icon} ${tcId}: ${status}`);

  // 상태 자동 저장 (파일 기반 이력)
  saveState('tc-complete');

  // 다음 TC 정보 안내
  const nextTC = testState.scenarios[testState.currentTCIndex + 1];
  if (nextTC) {
    console.log(`[NEXT] 다음 TC: ${nextTC.tcId} - ${nextTC.name}`);
  } else {
    console.log(`[DONE] 모든 TC 완료!`);
    // 모든 TC 완료 시 최종 상태 저장
    saveState('all-complete');
  }

  res.json({ success: true });
});

// Get current state
app.get('/api/state', (req, res) => {
  res.json(testState);
});

// Get grouped scenarios with stats
app.get('/api/groups', (req, res) => {
  const groups = getGroupedScenarios(testState.scenarios);
  updateGroupStats(groups, testState.results);
  res.json(groups);
});

// Get summary stats for charts
app.get('/api/summary', (req, res) => {
  const groups = getGroupedScenarios(testState.scenarios);
  updateGroupStats(groups, testState.results);

  // Overall stats
  let total = 0, passed = 0, failed = 0, running = 0, pending_hold = 0, skip_count = 0;
  Object.values(testState.results).forEach(r => {
    if (r.status === 'passed') passed++;
    else if (r.status === 'failed') failed++;
    else if (r.status === 'running') running++;
    else if (r.status === 'pending') pending_hold++;
    else if (r.status === 'skip') skip_count++;
  });
  total = testState.scenarios.length;
  const waiting = total - passed - failed - running - pending_hold - skip_count;

  // Group stats for chart
  const groupStats = Object.entries(groups).map(([key, group]) => ({
    key,
    name: group.name,
    ...group.stats
  }));

  // Failed TCs with reasons
  const failedTCs = testState.scenarios
    .filter(tc => testState.results[tc.tcId]?.status === 'failed')
    .map(tc => ({
      tcId: tc.tcId,
      name: tc.name,
      group: tc.group,
      message: testState.results[tc.tcId]?.message || '알 수 없는 오류',
      failedSteps: testState.results[tc.tcId]?.steps
        ?.filter(s => s?.status === 'failed')
        .map(s => ({ name: s.name, message: s.message })) || []
    }));

  // Pending (보류) TCs with reasons
  const pendingTCs = testState.scenarios
    .filter(tc => testState.results[tc.tcId]?.status === 'pending')
    .map(tc => ({
      tcId: tc.tcId,
      name: tc.name,
      group: tc.group,
      message: testState.results[tc.tcId]?.message || '사유 미기재'
    }));

  // Waiting (미진행) TCs - 아직 테스트 시도하지 않은 TC
  const waitingTCs = testState.scenarios
    .filter(tc => !testState.results[tc.tcId])
    .map(tc => ({
      tcId: tc.tcId,
      name: tc.name,
      group: tc.group,
      priority: tc.priority || 'P2'
    }));

  // Skip (건너뜀) TCs
  const skipTCs = testState.scenarios
    .filter(tc => testState.results[tc.tcId]?.status === 'skip')
    .map(tc => ({
      tcId: tc.tcId,
      name: tc.name,
      group: tc.group,
      message: testState.results[tc.tcId]?.message || ''
    }));

  res.json({
    total,
    passed,
    failed,
    running,
    pending_hold,  // 보류
    waiting,       // 대기 (미진행)
    skip: skipTCs.length,  // 건너뜀
    pending: waiting,  // 레거시 호환
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    groupStats,
    failedTCs,
    pendingTCs,
    waitingTCs,    // 미진행 TC 목록
    skipTCs,       // 건너뜀 TC 목록
    nextWaitingTC: waitingTCs[0] || null,  // 다음 미진행 TC
    timestamp: new Date().toISOString()
  });
});

// Reset state
app.post('/api/reset', (req, res) => {
  testState = {
    scenarios: [],
    currentTC: null,
    currentTCIndex: -1,
    currentStep: null,
    results: {},
    projectName: ''
  };

  broadcast({ type: 'reset' });
  console.log('[RESET] 테스트 상태 초기화됨');
  res.json({ success: true });
});

// Restore results from dashboard history (이어서 테스트)
app.post('/api/restore-results', (req, res) => {
  const { scenarios, results, groupNames, projectName } = req.body;

  if (!scenarios || !results) {
    return res.status(400).json({ error: 'scenarios and results are required' });
  }

  // 기존 상태 복원
  testState.scenarios = scenarios;
  testState.results = results;
  testState.projectName = projectName || '';
  testState.currentTC = null;
  testState.currentTCIndex = -1;
  testState.currentStep = null;

  // 그룹 이름 복원
  if (groupNames) {
    dynamicGroupNames = groupNames;
  }

  // 미완료 TC 찾기
  const pendingTCs = scenarios.filter(tc => {
    const result = results[tc.tcId];
    return !result || (result.status !== 'passed' && result.status !== 'failed');
  });

  // 완료된 TC 수
  const completedCount = scenarios.length - pendingTCs.length;
  const completionRate = scenarios.length > 0
    ? Math.round((completedCount / scenarios.length) * 100)
    : 0;

  // 모든 클라이언트에 복원 상태 브로드캐스트
  broadcast({
    type: 'init',
    data: {
      ...testState,
      groupNames: dynamicGroupNames
    }
  });

  console.log(`[RESTORE] 이전 테스트 결과 복원됨`);
  console.log(`  - 프로젝트: ${projectName || 'N/A'}`);
  console.log(`  - 전체 TC: ${scenarios.length}개`);
  console.log(`  - 완료: ${completedCount}개 (${completionRate}%)`);
  console.log(`  - 미완료: ${pendingTCs.length}개`);

  if (pendingTCs.length > 0) {
    console.log(`  - 다음 실행할 TC: ${pendingTCs[0].tcId} - ${pendingTCs[0].name}`);
  }

  res.json({
    success: true,
    restored: {
      totalTCs: scenarios.length,
      completedTCs: completedCount,
      pendingTCs: pendingTCs.length,
      completionRate,
      nextTC: pendingTCs[0] || null
    }
  });
});

// Trigger E2E test from dashboard (자동 실행 버튼)
app.post('/api/trigger-e2e-test', (req, res) => {
  // 미완료 TC 확인
  const pendingTCs = testState.scenarios.filter(tc => {
    const result = testState.results[tc.tcId];
    return !result || (result.status !== 'passed' && result.status !== 'failed');
  });

  if (pendingTCs.length === 0) {
    return res.json({
      success: false,
      message: '실행할 미완료 TC가 없습니다.'
    });
  }

  // 트리거 상태 설정
  testState.triggerPending = true;
  testState.triggerTime = new Date().toISOString();

  // 모든 클라이언트에 트리거 알림
  broadcast({
    type: 'test-triggered',
    data: {
      pendingTCs: pendingTCs.length,
      nextTC: pendingTCs[0],
      triggerTime: testState.triggerTime
    }
  });

  console.log(`[TRIGGER] E2E 테스트 트리거됨`);
  console.log(`  - 미완료 TC: ${pendingTCs.length}개`);
  console.log(`  - 다음 TC: ${pendingTCs[0].tcId} - ${pendingTCs[0].name}`);

  res.json({
    success: true,
    message: '테스트가 트리거되었습니다. CLI에서 /e2e-test를 실행하거나 대기중인 에이전트가 시작합니다.',
    pendingTCs: pendingTCs.length,
    nextTC: pendingTCs[0]
  });
});

// Check if test trigger is pending (e2e-tester가 조회)
app.get('/api/check-trigger', (req, res) => {
  if (!testState.triggerPending) {
    return res.json({
      triggered: false,
      message: '대기중인 테스트 트리거가 없습니다.'
    });
  }

  // 미완료 TC 목록
  const pendingTCs = testState.scenarios.filter(tc => {
    const result = testState.results[tc.tcId];
    return !result || (result.status !== 'passed' && result.status !== 'failed');
  });

  res.json({
    triggered: true,
    triggerTime: testState.triggerTime,
    scenarios: testState.scenarios,
    results: testState.results,
    pendingTCs: pendingTCs.map(tc => tc.tcId),
    nextTC: pendingTCs[0] || null,
    projectName: testState.projectName
  });
});

// Clear trigger (테스트 시작 시 호출)
app.post('/api/clear-trigger', (req, res) => {
  testState.triggerPending = false;
  testState.triggerTime = null;

  console.log('[TRIGGER] 테스트 트리거 해제됨');

  res.json({ success: true });
});

// ===== 이력 관리 API =====

// 이력 목록 조회
app.get('/api/history', (req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 20);

    const histories = files.map(file => {
      const filepath = path.join(HISTORY_DIR, file);
      const content = fs.readFileSync(filepath, 'utf8');
      const state = JSON.parse(content);

      // completionRate 계산 (없는 경우)
      let completionRate = state.completionRate || 0;
      if (!completionRate && state.scenarios && state.results) {
        const total = state.scenarios.length;
        const completed = Object.values(state.results).filter(r =>
          r.status === 'passed' || r.status === 'failed' || r.status === 'skip'
        ).length;
        completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      }

      return {
        id: state.id || file.replace('.json', ''),
        filename: file,
        savedAt: state.savedAt || state.timestamp,
        timestamp: state.timestamp || state.savedAt,
        reason: state.reason,
        projectName: state.projectName,
        scenarios: state.scenarios,
        results: state.results,
        groupNames: state.groupNames,
        completionRate: completionRate,
        summary: state.summary
      };
    });

    res.json({ histories });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 특정 이력 파일에서 복원 (현재 시나리오 유지, 결과만 복원)
app.post('/api/history/restore', (req, res) => {
  const { filename } = req.body;

  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }

  try {
    const filepath = path.join(HISTORY_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'History file not found' });
    }

    const content = fs.readFileSync(filepath, 'utf8');
    const historyState = JSON.parse(content);

    // 현재 시나리오 유지, 결과만 복원
    const currentScenarios = testState.scenarios;
    const currentTcIds = new Set(currentScenarios.map(s => s.tcId));

    // 이력의 결과 중 현재 시나리오에 있는 TC만 복원
    const restoredResults = {};
    let restoredCount = 0;

    if (historyState.results) {
      for (const [tcId, result] of Object.entries(historyState.results)) {
        if (currentTcIds.has(tcId)) {
          restoredResults[tcId] = result;
          if (result.status === 'passed' || result.status === 'failed' || result.status === 'skip') {
            restoredCount++;
          }
        }
      }
    }

    testState.results = restoredResults;
    testState.currentTC = null;
    testState.currentTCIndex = -1;
    testState.currentStep = null;

    // groupNames 복원
    if (historyState.groupNames) {
      dynamicGroupNames = { ...dynamicGroupNames, ...historyState.groupNames };
    }

    broadcast({
      type: 'init',
      data: {
        ...testState,
        groupNames: dynamicGroupNames
      }
    });

    const pending = currentScenarios.filter(tc => {
      const result = testState.results[tc.tcId];
      return !result || (result.status !== 'passed' && result.status !== 'failed' && result.status !== 'skip');
    });

    console.log(`[HISTORY] Restored from: ${filename} (${restoredCount} results for ${currentScenarios.length} TCs)`);
    res.json({
      success: true,
      restored: {
        totalTCs: currentScenarios.length,
        completedTCs: restoredCount,
        pendingTCs: pending.length,
        nextTC: pending[0] || null
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 수동으로 현재 상태 저장
app.post('/api/history/save', (req, res) => {
  const filepath = saveState('manual');
  if (filepath) {
    res.json({ success: true, filepath });
  } else {
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// 특정 이력 파일 삭제
app.delete('/api/history/:filename', (req, res) => {
  const { filename } = req.params;

  if (!filename) {
    return res.status(400).json({ error: 'filename is required' });
  }

  try {
    const filepath = path.join(HISTORY_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`[HISTORY] Deleted: ${filename}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 모든 이력 파일 삭제
app.delete('/api/history', (req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
    files.forEach(file => {
      fs.unlinkSync(path.join(HISTORY_DIR, file));
    });
    console.log(`[HISTORY] Deleted all ${files.length} files`);
    res.json({ success: true, deletedCount: files.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inject sample test data for testing dashboard features
app.post('/api/inject-sample', (req, res) => {
  const { group, passCount = 3, failCount = 1 } = req.body;

  // Find TCs in the specified group
  const groupTCs = testState.scenarios.filter(tc => {
    const tcGroup = extractGroup(tc.tcId);
    return !group || tcGroup === group.toUpperCase();
  });

  if (groupTCs.length === 0) {
    return res.status(400).json({ error: 'No TCs found for the specified group' });
  }

  let injected = { passed: 0, failed: 0, pending: 0 };
  const total = passCount + failCount;

  groupTCs.forEach((tc, idx) => {
    if (idx >= total) {
      injected.pending++;
      return; // Leave as pending
    }

    const shouldPass = idx < passCount;
    const status = shouldPass ? 'passed' : 'failed';

    // Generate step results
    const steps = tc.steps.map((step, stepIdx) => {
      if (shouldPass) {
        return { name: step, status: 'passed' };
      } else if (stepIdx === tc.steps.length - 1) {
        return {
          name: step,
          status: 'failed',
          message: '테스트 실패 (샘플 데이터)',
          improvements: [
            '셀렉터를 더 구체적으로 수정하세요 (예: data-testid 사용)',
            'waitForSelector로 요소 로딩 대기 시간을 추가하세요',
            'browser_snapshot()으로 현재 페이지 상태를 확인하세요'
          ]
        };
      } else {
        return { name: step, status: 'passed' };
      }
    });

    testState.results[tc.tcId] = {
      status,
      steps,
      message: shouldPass ? null : `${tc.name} 실패 - 샘플 테스트 데이터`,
      improvements: shouldPass ? null : [
        '테스트 환경이 올바르게 설정되었는지 확인하세요',
        '선행 조건이 모두 충족되었는지 확인하세요',
        '에러 로그를 확인하고 근본 원인을 파악하세요'
      ]
    };

    if (shouldPass) injected.passed++;
    else injected.failed++;
  });

  // Broadcast updates
  broadcast({
    type: 'init',
    data: {
      ...testState,
      groupNames: dynamicGroupNames
    }
  });

  console.log(`[INJECT] 샘플 데이터 주입: ${group || 'ALL'} (passed: ${injected.passed}, failed: ${injected.failed}, pending: ${injected.pending})`);
  res.json({ success: true, injected, total: groupTCs.length });
});

// Get available groups for test injection
app.get('/api/groups/list', (req, res) => {
  const groups = {};
  testState.scenarios.forEach(tc => {
    const group = extractGroup(tc.tcId);
    if (!groups[group]) {
      groups[group] = {
        key: group,
        name: dynamicGroupNames[group] || group,
        count: 0
      };
    }
    groups[group].count++;
  });
  res.json(Object.values(groups));
});

// LLM-based improvement suggestions using Claude CLI
const suggestionCache = new Map();

/**
 * Run Claude CLI query using temp file for multiline prompts
 * @param {string} prompt - The prompt to send
 * @param {string} model - Model to use (haiku, sonnet, opus)
 * @returns {Promise<string>} - Response text
 */
async function runClaudeQuery(prompt, model = 'haiku') {
  const tmpFile = `/tmp/claude-prompt-${Date.now()}.txt`;

  return new Promise((resolve, reject) => {
    // Write prompt to temp file
    fs.writeFileSync(tmpFile, prompt, 'utf8');

    // Use cat to pipe the prompt to claude
    const cmd = `cat "${tmpFile}" | claude -p --model ${model} --output-format text`;

    exec(cmd, { maxBuffer: 1024 * 1024, timeout: 60000 }, (error, stdout, stderr) => {
      // Clean up temp file
      try { fs.unlinkSync(tmpFile); } catch (e) {}

      if (error) {
        console.error('[Claude CLI] Error:', error.message);
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

app.post('/api/suggest-improvement', async (req, res) => {
  const { errorMessage, stepName, tcId, tcName } = req.body;

  if (!errorMessage) {
    return res.status(400).json({ error: 'errorMessage is required' });
  }

  // Check cache (5 minute TTL)
  const cacheKey = `${tcId}:${stepName}:${errorMessage}`;
  const cached = suggestionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return res.json({ suggestions: cached.suggestions, cached: true });
  }

  try {
    const prompt = `당신은 E2E 테스트 자동화 전문가입니다. 다음 테스트 실패에 대한 구체적인 개선 방안을 제시해주세요.

테스트 정보:
- TC ID: ${tcId || 'N/A'}
- 테스트명: ${tcName || 'N/A'}
- 실패 단계: ${stepName || 'N/A'}
- 오류 메시지: ${errorMessage}

다음 관점에서 3-5개의 구체적인 개선 방안을 제시해주세요:
1. 셀렉터/요소 관련 문제라면: 더 안정적인 셀렉터 전략
2. 타이밍 관련 문제라면: 대기 전략 개선
3. 데이터/상태 관련 문제라면: 테스트 데이터 관리
4. 페이지 구조 관련 문제라면: DOM 구조 확인 방법

각 제안은 실제로 바로 적용할 수 있는 구체적인 액션이어야 합니다.
JSON 배열 형식으로만 응답하세요: ["제안1", "제안2", "제안3"]`;

    const responseText = await runClaudeQuery(prompt, 'haiku');
    let suggestions = [];

    // Try to parse JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      try {
        suggestions = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Fallback: split by newlines and clean up
        suggestions = responseText.split('\n')
          .filter(line => line.trim().match(/^[\d\-\*]|^"/))
          .map(line => line.replace(/^[\d\.\-\*\s"]+/, '').replace(/"[,\s]*$/, '').trim())
          .filter(line => line.length > 10);
      }
    }

    // If still no suggestions, try line parsing
    if (suggestions.length === 0) {
      suggestions = responseText.split('\n')
        .filter(line => line.trim().length > 10)
        .slice(0, 5);
    }

    // Cache the result
    suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now()
    });

    console.log(`[LLM] Generated ${suggestions.length} suggestions for ${tcId}`);
    res.json({ suggestions });

  } catch (err) {
    console.error('[LLM] Error generating suggestions:', err.message);
    res.status(500).json({
      error: 'Failed to generate suggestions',
      fallback: getFallbackSuggestions(errorMessage)
    });
  }
});

// Fallback suggestions when LLM is unavailable
function getFallbackSuggestions(message) {
  const msg = message.toLowerCase();
  const suggestions = [];

  if (msg.includes('ref') || msg.includes('매칭') || msg.includes('찾을 수 없')) {
    suggestions.push('셀렉터 설명을 더 구체적으로 수정');
    suggestions.push('browser_snapshot()으로 실제 요소 확인');
  }
  if (msg.includes('timeout') || msg.includes('시간')) {
    suggestions.push('대기 시간 증가 (browser_wait_for)');
  }
  if (suggestions.length === 0) {
    suggestions.push('브라우저 스냅샷으로 현재 상태 확인');
    suggestions.push('수동으로 시나리오 재현하여 원인 파악');
  }
  return suggestions;
}

// Extract group from TC ID (e.g., TC-AUTH-E2E-001 -> AUTH, TC-CLIENT-E2E-002 -> CLIENT)
// 동적 추출: 모든 프로젝트에서 TC-{GROUP}-E2E-### 패턴 사용
function extractGroup(tcId) {
  const match = tcId.match(/TC-([A-Z]+)-(?:[A-Z]+-)?E2E-\d{3}/);
  return match ? match[1] : 'OTHER';
}

// 동적 그룹명 저장 (시나리오 파싱 시 자동 추출)
let dynamicGroupNames = {};

// Parse scenario markdown to extract TCs
// 동적 그룹핑: 섹션 헤더에서 그룹명 추출
function parseScenarios(content) {
  const scenarios = [];

  // 1단계: 섹션 헤더에서 그룹명 추출 (## 1. 인증 시나리오 → AUTH: 인증 시나리오)
  dynamicGroupNames = {}; // 초기화
  const sectionPattern = /^##\s*\d+\.\s*(.+?)(?:\s*시나리오|\s*\(.*?\))?\s*$/gm;
  const tcHeaderPattern = /###?\s*(TC-([A-Z]+)-(?:[A-Z]+-)?E2E-\d{3})/;

  let currentSection = null;
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 섹션 헤더 체크 (## 1. 인증 시나리오)
    const sectionMatch = line.match(/^##\s*\d+\.\s*(.+?)(?:\s*시나리오|\s*관리|\s*\(.*?\))?\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    // 서브섹션 헤더 체크 (### 3.1 메뉴 관리 (MENU))
    // 서브섹션이 있으면 currentSection을 덮어씀
    const subSectionMatch = line.match(/^###\s*\d+\.\d+\s*(.+?)\s*\(([A-Z]+)\)\s*$/);
    if (subSectionMatch) {
      const subSectionName = subSectionMatch[1].trim();
      const groupCode = subSectionMatch[2]; // MENU, CLIENT 등
      dynamicGroupNames[groupCode] = subSectionName;
      continue;
    }

    // TC 헤더 체크 (### TC-AUTH-E2E-001: ...)
    const tcMatch = line.match(tcHeaderPattern);
    if (tcMatch && currentSection) {
      const groupKey = tcMatch[2]; // AUTH, CLIENT 등
      if (!dynamicGroupNames[groupKey]) {
        dynamicGroupNames[groupKey] = currentSection;
      }
    }
  }

  console.log('[PARSE] 동적 그룹명:', dynamicGroupNames);

  // 2단계: TC 파싱
  const tcPattern = /###?\s*(TC-[A-Z]+-(?:[A-Z]+-)?E2E-\d{3})[:：]?\s*(.+)/g;

  let match;
  while ((match = tcPattern.exec(content)) !== null) {
    const tcId = match[1];
    const rawName = match[2].trim();
    // "(실패 예상)" 또는 "(실패 케이스)" 여부 확인
    const expectFail = rawName.includes('실패 예상') || rawName.includes('실패 케이스');
    const name = rawName;  // 이름은 그대로 유지 (UI 표시용)
    const group = extractGroup(tcId);

    // Find steps after this TC
    const startIdx = match.index + match[0].length;
    const nextTcMatch = tcPattern.exec(content);
    const endIdx = nextTcMatch ? nextTcMatch.index : content.length;
    tcPattern.lastIndex = match.index + match[0].length; // Reset for next iteration

    const tcSection = content.substring(startIdx, endIdx);
    const steps = [];

    // 형식 1: 테이블 형식 (| # | 액션 | 설명 |)
    const tableRowRegex = /^\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/gm;
    let stepMatch;
    while ((stepMatch = tableRowRegex.exec(tcSection)) !== null) {
      const action = stepMatch[2].trim();
      const desc = stepMatch[3].trim();
      // "액션: 설명" 또는 "설명" 형식으로 저장
      steps.push(desc || action);
    }

    // 형식 2: 번호 목록 형식 (1. 단계 내용) - 테이블에서 못 찾은 경우
    if (steps.length === 0) {
      const listRegex = /^\d+\.\s+(.+)/gm;
      while ((stepMatch = listRegex.exec(tcSection)) !== null) {
        steps.push(stepMatch[1].trim());
      }
    }

    scenarios.push({ tcId, name, group, steps, expectFail });
  }

  return scenarios;
}

// Get grouped scenarios (동적 그룹명 사용)
function getGroupedScenarios(scenarios) {
  const groups = {};

  scenarios.forEach(tc => {
    if (!groups[tc.group]) {
      groups[tc.group] = {
        // 동적 그룹명 우선, 없으면 그룹 코드 사용
        name: dynamicGroupNames[tc.group] || tc.group,
        scenarios: [],
        stats: { total: 0, passed: 0, failed: 0, running: 0, pending: 0 }
      };
    }
    groups[tc.group].scenarios.push(tc);
    groups[tc.group].stats.total++;
  });

  return groups;
}

// Update group stats based on results
function updateGroupStats(groups, results) {
  Object.values(groups).forEach(group => {
    group.stats = { total: group.scenarios.length, passed: 0, failed: 0, running: 0, pending: 0, pending_hold: 0, waiting: 0 };
    group.scenarios.forEach(tc => {
      const result = results[tc.tcId];
      if (result) {
        if (result.status === 'passed') group.stats.passed++;
        else if (result.status === 'failed') group.stats.failed++;
        else if (result.status === 'running') group.stats.running++;
        else if (result.status === 'pending') {
          group.stats.pending_hold++;  // 보류
          group.stats.pending++;
        }
        else {
          group.stats.waiting++;  // 대기
          group.stats.pending++;
        }
      } else {
        group.stats.waiting++;  // 대기
        group.stats.pending++;
      }
    });
  });
  return groups;
}

const PORT = process.env.PORT || 3847;
const DEMO_PORT = process.env.DEMO_PORT || 3848;

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`E2E Dashboard running at ${url}`);
  console.log('Waiting for test events...');

  // Auto-load scenarios on startup
  autoLoadScenarios();

  // Auto-open browser
  if (AUTO_OPEN) {
    const platform = process.platform;
    const openCmd = platform === 'darwin' ? 'open' :
                    platform === 'win32' ? 'start' : 'xdg-open';

    exec(`${openCmd} ${url}`, (err) => {
      if (err) {
        console.log(`Could not open browser automatically. Please open: ${url}`);
      } else {
        console.log('Browser opened automatically');
      }
    });
  }
});

// Demo server with sample data on port 3848
const demoApp = express();
const demoServer = http.createServer(demoApp);
const demoWss = new WebSocketServer({ server: demoServer });

// Demo state with sample data
let demoState = {
  scenarios: [],
  currentTC: null,
  currentTCIndex: -1,
  currentStep: null,
  results: {}
};

// Demo WebSocket connections
const demoClients = new Set();

demoWss.on('connection', (ws) => {
  demoClients.add(ws);
  console.log('[DEMO] Client connected');

  ws.send(JSON.stringify({
    type: 'init',
    data: {
      ...demoState,
      groupNames: dynamicGroupNames
    }
  }));

  ws.on('close', () => {
    demoClients.delete(ws);
  });
});

function demoBroadcast(message) {
  const data = JSON.stringify(message);
  demoClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

// Serve same static files
demoApp.use(express.static(path.join(__dirname, 'public')));
demoApp.use(express.json());

// Demo API endpoints (read-only, returns demo state)
demoApp.get('/api/state', (req, res) => res.json(demoState));
demoApp.get('/api/summary', (req, res) => {
  const groups = {};
  demoState.scenarios.forEach(tc => {
    const group = extractGroup(tc.tcId);
    if (!groups[group]) {
      groups[group] = {
        name: dynamicGroupNames[group] || group,
        scenarios: [],
        stats: { total: 0, passed: 0, failed: 0, running: 0, pending: 0 }
      };
    }
    groups[group].scenarios.push(tc);
    groups[group].stats.total++;

    const result = demoState.results[tc.tcId];
    if (result) {
      if (result.status === 'passed') groups[group].stats.passed++;
      else if (result.status === 'failed') groups[group].stats.failed++;
      else groups[group].stats.pending++;
    } else {
      groups[group].stats.pending++;
    }
  });

  let total = demoState.scenarios.length;
  let passed = 0, failed = 0;
  Object.values(demoState.results).forEach(r => {
    if (r.status === 'passed') passed++;
    else if (r.status === 'failed') failed++;
  });

  res.json({
    total,
    passed,
    failed,
    running: 0,
    pending: total - passed - failed,
    passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
    groupStats: Object.entries(groups).map(([key, g]) => ({ key, name: g.name, ...g.stats })),
    failedTCs: demoState.scenarios
      .filter(tc => demoState.results[tc.tcId]?.status === 'failed')
      .map(tc => ({
        tcId: tc.tcId,
        name: tc.name,
        group: tc.group,
        message: demoState.results[tc.tcId]?.message,
        failedSteps: demoState.results[tc.tcId]?.steps?.filter(s => s?.status === 'failed') || []
      })),
    timestamp: new Date().toISOString()
  });
});

// Load demo scenarios and inject sample data
function loadDemoData() {
  if (!SCENARIO_PATH || !fs.existsSync(SCENARIO_PATH)) {
    console.log('[DEMO] No scenario path, demo server disabled');
    return false;
  }

  const content = fs.readFileSync(SCENARIO_PATH, 'utf-8');
  demoState.scenarios = parseScenarios(content);
  demoState.results = {};

  // Inject mixed sample data (70% pass, 20% fail, 10% pending)
  demoState.scenarios.forEach((tc, idx) => {
    const rand = Math.random();
    if (rand < 0.7) {
      // Passed
      demoState.results[tc.tcId] = {
        status: 'passed',
        steps: tc.steps.map(step => ({ name: step, status: 'passed' }))
      };
    } else if (rand < 0.9) {
      // Failed
      const failedStepIdx = Math.floor(Math.random() * tc.steps.length);
      demoState.results[tc.tcId] = {
        status: 'failed',
        message: `${tc.name} - 테스트 실패 (데모 데이터)`,
        improvements: [
          '셀렉터를 data-testid 기반으로 변경하세요',
          'waitForSelector 대기 시간을 늘려보세요',
          'browser_snapshot()으로 현재 UI 상태를 확인하세요'
        ],
        steps: tc.steps.map((step, i) => {
          if (i < failedStepIdx) {
            return { name: step, status: 'passed' };
          } else if (i === failedStepIdx) {
            return {
              name: step,
              status: 'failed',
              message: '요소를 찾을 수 없음 (ref 매칭 실패)',
              improvements: [
                '셀렉터 설명을 더 구체적으로 수정하세요',
                '페이지 로딩 완료 후 요소 검색하세요',
                'DOM 구조 변경 여부를 확인하세요'
              ]
            };
          }
          return { name: step, status: 'pending' };
        })
      };
    }
    // else: pending (no result)
  });

  console.log(`[DEMO] Loaded ${demoState.scenarios.length} scenarios with sample data`);
  return true;
}

demoServer.listen(DEMO_PORT, () => {
  console.log(`[DEMO] Demo server running at http://localhost:${DEMO_PORT}`);
  loadDemoData();
});
