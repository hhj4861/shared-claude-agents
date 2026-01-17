#!/usr/bin/env node
/**
 * Agent Validation Script
 *
 * 에이전트 마크다운 파일의 YAML frontmatter를 검증합니다.
 *
 * 검증 항목:
 * - YAML frontmatter 존재 여부
 * - 필수 필드: name, description
 * - 선택 필드: model, tools
 * - model 값 유효성: opus, sonnet, haiku
 */

const fs = require('fs');
const path = require('path');

// 색상 코드
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

// 유효한 모델 목록
const VALID_MODELS = ['opus', 'sonnet', 'haiku'];

// 결과 저장
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
};

/**
 * YAML frontmatter 파싱
 */
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result = {};

  yaml.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      result[key] = value;
    }
  });

  return result;
}

/**
 * 에이전트 파일 검증
 */
function validateAgentFile(filePath) {
  const relativePath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');

  // README.md 스킵
  if (path.basename(filePath) === 'README.md') {
    return { skip: true };
  }

  const errors = [];
  const warnings = [];

  // YAML frontmatter 확인
  if (!content.startsWith('---')) {
    errors.push('Missing YAML frontmatter');
    return { path: relativePath, errors, warnings };
  }

  const frontmatter = parseFrontmatter(content);
  if (!frontmatter) {
    errors.push('Invalid YAML frontmatter format');
    return { path: relativePath, errors, warnings };
  }

  // 필수 필드 확인
  if (!frontmatter.name) {
    errors.push("Missing required field: 'name'");
  }

  if (!frontmatter.description) {
    errors.push("Missing required field: 'description'");
  }

  // model 값 확인
  if (frontmatter.model) {
    if (!VALID_MODELS.includes(frontmatter.model)) {
      warnings.push(`Unknown model: '${frontmatter.model}' (valid: ${VALID_MODELS.join(', ')})`);
    }
  } else {
    warnings.push("Missing 'model' field (will use default)");
  }

  // tools 필드 확인
  if (!frontmatter.tools) {
    warnings.push("Missing 'tools' field");
  }

  return { path: relativePath, frontmatter, errors, warnings };
}

/**
 * 디렉토리 재귀 탐색
 */
function findAgentFiles(dir) {
  const files = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // archived 디렉토리 스킵
      if (entry.name !== 'archived') {
        files.push(...findAgentFiles(fullPath));
      }
    } else if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * 메인 실행
 */
function main() {
  console.log('');
  console.log('========================================');
  console.log('  Agent Validation');
  console.log('========================================');
  console.log('');

  const agentsDir = path.join(process.cwd(), 'agents');
  const files = findAgentFiles(agentsDir);

  console.log(`Found ${files.length} agent files\n`);

  for (const file of files) {
    const result = validateAgentFile(file);

    if (result.skip) continue;

    if (result.errors.length > 0) {
      console.log(`${RED}❌ ${result.path}${NC}`);
      result.errors.forEach(err => console.log(`   - ${err}`));
      results.failed++;
      results.errors.push({ path: result.path, errors: result.errors });
    } else if (result.warnings.length > 0) {
      console.log(`${YELLOW}⚠️  ${result.path}${NC}`);
      result.warnings.forEach(warn => console.log(`   - ${warn}`));
      results.warnings++;
      results.passed++;
    } else {
      console.log(`${GREEN}✅ ${result.path}${NC}`);
      results.passed++;
    }
  }

  // 요약 출력
  console.log('');
  console.log('========================================');
  console.log('  Summary');
  console.log('========================================');
  console.log(`  Passed:   ${results.passed}`);
  console.log(`  Warnings: ${results.warnings}`);
  console.log(`  Failed:   ${results.failed}`);
  console.log('');

  if (results.failed > 0) {
    console.log(`${RED}Validation failed!${NC}`);
    process.exit(1);
  } else {
    console.log(`${GREEN}All validations passed!${NC}`);
    process.exit(0);
  }
}

main();
