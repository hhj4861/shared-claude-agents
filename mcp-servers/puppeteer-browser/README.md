# Puppeteer MCP Server

브라우저 자동화 및 테스트를 위한 MCP(Model Context Protocol) 서버입니다.

## 설치

### 1. 의존성 설치

```bash
cd mcp-servers/puppeteer-browser
npm install
```

### 2. 빌드

```bash
npm run build
```

### 3. Claude Code 설정

`~/.claude/settings.json`에 MCP 서버 추가:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["~/.claude/shared-agents/mcp-servers/puppeteer-browser/dist/index.js"]
    }
  }
}
```

또는 프로젝트별 설정 (`.claude/settings.local.json`):

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["/path/to/shared-agents/mcp-servers/puppeteer-browser/dist/index.js"]
    }
  }
}
```

## 사용 가능한 도구

| 도구명 | 설명 |
|--------|------|
| `puppeteer_launch` | 브라우저 실행 |
| `puppeteer_navigate` | URL로 이동 |
| `puppeteer_click` | 요소 클릭 |
| `puppeteer_fill` | 입력 필드에 텍스트 입력 |
| `puppeteer_screenshot` | 스크린샷 캡처 |
| `puppeteer_evaluate` | JavaScript 실행 |
| `puppeteer_wait_for_selector` | 셀렉터 대기 |
| `puppeteer_get_content` | 페이지/요소 콘텐츠 가져오기 |
| `puppeteer_select` | 드롭다운 선택 |
| `puppeteer_close` | 브라우저 종료 |

## 도구 상세

### puppeteer_launch

브라우저를 실행합니다.

```json
{
  "headless": true,
  "width": 1280,
  "height": 720
}
```

### puppeteer_navigate

지정된 URL로 이동합니다.

```json
{
  "url": "https://example.com",
  "waitUntil": "domcontentloaded"
}
```

**waitUntil 옵션:**
- `load`: 페이지 로드 완료
- `domcontentloaded`: DOM 로드 완료
- `networkidle0`: 네트워크 요청 0개
- `networkidle2`: 네트워크 요청 2개 이하

### puppeteer_click

요소를 클릭합니다.

```json
{
  "selector": "button.submit",
  "waitForSelector": true,
  "timeout": 30000
}
```

### puppeteer_fill

입력 필드에 텍스트를 입력합니다.

```json
{
  "selector": "input[name='email']",
  "value": "test@example.com",
  "clear": true
}
```

### puppeteer_screenshot

스크린샷을 캡처합니다.

```json
{
  "path": "./screenshot.png",
  "fullPage": false,
  "selector": "#content"
}
```

### puppeteer_evaluate

브라우저에서 JavaScript를 실행합니다.

```json
{
  "script": "document.title"
}
```

### puppeteer_wait_for_selector

특정 셀렉터가 나타날 때까지 대기합니다.

```json
{
  "selector": ".loaded",
  "timeout": 30000,
  "visible": true
}
```

### puppeteer_get_content

페이지나 요소의 콘텐츠를 가져옵니다.

```json
{
  "selector": ".article",
  "type": "text"
}
```

**type 옵션:**
- `text`: 텍스트 콘텐츠
- `html`: HTML 콘텐츠
- `value`: input 값

### puppeteer_select

드롭다운에서 옵션을 선택합니다.

```json
{
  "selector": "select#country",
  "value": "KR"
}
```

### puppeteer_close

브라우저를 종료합니다.

```json
{}
```

## 사용 예시

### 로그인 테스트

```
1. puppeteer_launch (headless: false)
2. puppeteer_navigate (url: "https://example.com/login")
3. puppeteer_fill (selector: "#email", value: "test@example.com")
4. puppeteer_fill (selector: "#password", value: "password123")
5. puppeteer_click (selector: "button[type='submit']")
6. puppeteer_wait_for_selector (selector: ".dashboard")
7. puppeteer_screenshot (path: "./login-success.png")
8. puppeteer_close
```

### E2E 테스트

```
1. puppeteer_launch (headless: true)
2. puppeteer_navigate (url: "https://example.com")
3. puppeteer_get_content (selector: "h1") -> 제목 확인
4. puppeteer_click (selector: "a.cta")
5. puppeteer_wait_for_selector (selector: ".product-list")
6. puppeteer_screenshot (fullPage: true)
7. puppeteer_close
```

## browser-tester 에이전트와 함께 사용

`agents/qa/browser-tester.md` 에이전트가 이 MCP 서버를 사용합니다.

```bash
# Claude Code에서
> 브라우저 테스트해줘
> 로그인 플로우 테스트해줘
```

## 문제 해결

### 브라우저가 실행되지 않는 경우

```bash
# Chromium 의존성 설치
npx puppeteer install chrome
```

### headless 모드에서 문제가 있는 경우

```json
{
  "headless": false
}
```

실제 브라우저 창을 열어 디버깅할 수 있습니다.

### 타임아웃 오류

`timeout` 값을 늘려보세요:

```json
{
  "selector": ".slow-element",
  "timeout": 60000
}
```

## 개발

```bash
# 개발 모드 (watch)
npm run dev

# 타입 체크
npm run typecheck
```

## 라이선스

ISC
