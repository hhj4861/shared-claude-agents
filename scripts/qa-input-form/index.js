#!/usr/bin/env node
/**
 * QA 시나리오 입력 폼 서버
 *
 * qa-scenario-writer 서브에이전트가 이 스크립트를 실행하면:
 * 1. localhost:3456 에 웹서버 시작
 * 2. 브라우저 자동 열림
 * 3. 사용자가 폼 입력 후 제출
 * 4. JSON을 파일로 저장하고 stdout으로 출력 후 종료
 */

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, writeFileSync, existsSync, renameSync, readdirSync } from 'fs';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3456;

// JSON body parser
app.use(express.json());

// 정적 파일 서빙
app.use(express.static(join(__dirname, 'public')));

// 폼 제출 처리
app.post('/submit', (req, res) => {
  const config = req.body;

  // 파일 저장 경로 생성
  const bePath = config.be_path;
  const fePath = config.fe_path;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 저장할 경로 목록 (be_path 필수, fe_path는 있고 be_path와 다를 때만)
  const savePaths = [bePath];
  if (fePath && fePath !== bePath) {
    savePaths.push(fePath);
  }

  // 저장된 파일 경로를 config에 추가
  const savedFiles = [];
  config.created_at = new Date().toISOString();
  config.run_id = timestamp;

  // 각 경로에 저장 (latest/ 구조 사용)
  for (const basePath of savePaths) {
    const qaDir = join(basePath, 'docs', 'qa');
    const latestDir = join(qaDir, 'latest');
    const historyDir = join(qaDir, 'history');

    try {
      // 1. 기존 latest가 있으면 history로 이동
      if (existsSync(latestDir)) {
        // 기존 latest의 config에서 run_id 읽기
        const oldConfigPath = join(latestDir, 'config.json');
        let oldRunId = 'unknown';
        if (existsSync(oldConfigPath)) {
          try {
            const oldConfig = JSON.parse(require('fs').readFileSync(oldConfigPath, 'utf-8'));
            oldRunId = oldConfig.run_id || oldConfig.created_at?.replace(/[:.]/g, '-').slice(0, 19) || 'unknown';
          } catch (e) {
            oldRunId = `backup-${Date.now()}`;
          }
        }

        // history 디렉토리 생성 및 이동
        const archiveDir = join(historyDir, oldRunId);
        mkdirSync(historyDir, { recursive: true });
        if (!existsSync(archiveDir)) {
          renameSync(latestDir, archiveDir);
          console.error(`이전 결과 보관됨: ${archiveDir}`);
        }
      }

      // 2. 새 latest 디렉토리 구조 생성
      mkdirSync(join(latestDir, 'references', 'prd'), { recursive: true });
      mkdirSync(join(latestDir, 'references', 'api'), { recursive: true });
      mkdirSync(join(latestDir, 'references', 'design'), { recursive: true });
      mkdirSync(join(latestDir, 'references', 'policy'), { recursive: true });
      mkdirSync(join(latestDir, 'analysis'), { recursive: true });
      mkdirSync(join(latestDir, 'scenarios'), { recursive: true });

      // 3. config.json 저장
      const configFile = join(latestDir, 'config.json');
      writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf-8');
      savedFiles.push(configFile);
      console.error(`설정 파일 저장됨: ${configFile}`);
    } catch (err) {
      console.error(`파일 저장 실패 (${basePath}): ${err.message}`);
    }
  }

  // 첫 번째 저장 경로를 대표로 설정
  config.config_file = savedFiles[0] || null;
  config.config_files = savedFiles;
  config.latest_dir = savePaths[0] ? join(savePaths[0], 'docs', 'qa', 'latest') : null;

  // stdout으로 JSON 출력 (qa-scenario-writer가 읽음)
  console.log(JSON.stringify(config, null, 2));

  // 응답 보내고 서버 종료
  res.json({ success: true, message: '설정이 저장되었습니다. 이 창을 닫아도 됩니다.' });

  // 잠시 후 서버 종료
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// 서버 시작
const server = app.listen(PORT, async () => {
  // stderr로 상태 메시지 출력 (stdout은 JSON 결과용)
  console.error(`QA 입력 폼 서버가 http://localhost:${PORT} 에서 실행 중...`);
  console.error('브라우저에서 폼을 작성하고 "시나리오 생성 시작" 버튼을 클릭하세요.');

  // 브라우저 자동 열기
  try {
    await open(`http://localhost:${PORT}`);
  } catch (err) {
    console.error(`브라우저를 자동으로 열 수 없습니다. http://localhost:${PORT} 를 직접 열어주세요.`);
  }
});

// 타임아웃 설정 (10분)
setTimeout(() => {
  console.error('타임아웃: 10분 동안 입력이 없어 서버를 종료합니다.');
  process.exit(1);
}, 10 * 60 * 1000);

// 종료 시그널 처리
process.on('SIGINT', () => {
  console.error('서버가 종료되었습니다.');
  process.exit(0);
});
