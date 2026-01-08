#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import puppeteer, { Browser, Page } from "puppeteer";

// Browser and page state
let browser: Browser | null = null;
let currentPage: Page | null = null;
const pages: Map<string, Page> = new Map();

// Tool definitions
const tools: Tool[] = [
  {
    name: "puppeteer_launch",
    description: "브라우저를 실행합니다. headless 모드 또는 실제 브라우저 창을 열 수 있습니다.",
    inputSchema: {
      type: "object",
      properties: {
        headless: {
          type: "boolean",
          description: "헤드리스 모드 여부 (기본값: true)",
          default: true,
        },
        width: {
          type: "number",
          description: "브라우저 창 너비 (기본값: 1280)",
          default: 1280,
        },
        height: {
          type: "number",
          description: "브라우저 창 높이 (기본값: 720)",
          default: 720,
        },
      },
    },
  },
  {
    name: "puppeteer_navigate",
    description: "지정된 URL로 이동합니다.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "이동할 URL",
        },
        waitUntil: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle0", "networkidle2"],
          description: "대기 조건 (기본값: domcontentloaded)",
          default: "domcontentloaded",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "puppeteer_click",
    description: "지정된 셀렉터의 요소를 클릭합니다.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "클릭할 요소의 CSS 셀렉터",
        },
        waitForSelector: {
          type: "boolean",
          description: "셀렉터가 나타날 때까지 대기 (기본값: true)",
          default: true,
        },
        timeout: {
          type: "number",
          description: "대기 타임아웃 (ms, 기본값: 30000)",
          default: 30000,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "puppeteer_fill",
    description: "입력 필드에 텍스트를 입력합니다.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "입력할 요소의 CSS 셀렉터",
        },
        value: {
          type: "string",
          description: "입력할 텍스트",
        },
        clear: {
          type: "boolean",
          description: "입력 전 기존 값 삭제 여부 (기본값: true)",
          default: true,
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "puppeteer_screenshot",
    description: "현재 페이지의 스크린샷을 캡처합니다.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "저장할 파일 경로 (미지정 시 base64 반환)",
        },
        fullPage: {
          type: "boolean",
          description: "전체 페이지 캡처 여부 (기본값: false)",
          default: false,
        },
        selector: {
          type: "string",
          description: "특정 요소만 캡처할 경우 셀렉터",
        },
      },
    },
  },
  {
    name: "puppeteer_evaluate",
    description: "브라우저 컨텍스트에서 JavaScript를 실행합니다.",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "실행할 JavaScript 코드",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "puppeteer_wait_for_selector",
    description: "특정 셀렉터가 나타날 때까지 대기합니다.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "대기할 요소의 CSS 셀렉터",
        },
        timeout: {
          type: "number",
          description: "타임아웃 (ms, 기본값: 30000)",
          default: 30000,
        },
        visible: {
          type: "boolean",
          description: "요소가 보일 때까지 대기 (기본값: true)",
          default: true,
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "puppeteer_get_content",
    description: "페이지의 HTML 콘텐츠 또는 특정 요소의 텍스트를 가져옵니다.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "요소의 CSS 셀렉터 (미지정 시 전체 페이지)",
        },
        type: {
          type: "string",
          enum: ["text", "html", "value"],
          description: "가져올 콘텐츠 타입 (기본값: text)",
          default: "text",
        },
      },
    },
  },
  {
    name: "puppeteer_select",
    description: "드롭다운/셀렉트 박스에서 옵션을 선택합니다.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "셀렉트 요소의 CSS 셀렉터",
        },
        value: {
          type: "string",
          description: "선택할 옵션의 value",
        },
      },
      required: ["selector", "value"],
    },
  },
  {
    name: "puppeteer_close",
    description: "브라우저를 종료합니다.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

// Ensure browser is launched
async function ensureBrowser(): Promise<Page> {
  if (!browser) {
    throw new Error("브라우저가 실행되지 않았습니다. puppeteer_launch를 먼저 실행하세요.");
  }
  if (!currentPage) {
    currentPage = await browser.newPage();
  }
  return currentPage;
}

// Tool handlers
async function handleLaunch(args: {
  headless?: boolean;
  width?: number;
  height?: number;
}): Promise<string> {
  if (browser) {
    return "브라우저가 이미 실행 중입니다.";
  }

  const headless = args.headless ?? true;
  const width = args.width ?? 1280;
  const height = args.height ?? 720;

  browser = await puppeteer.launch({
    headless: headless,
    args: [`--window-size=${width},${height}`],
  });

  currentPage = await browser.newPage();
  await currentPage.setViewport({ width, height });

  return `브라우저가 실행되었습니다. (headless: ${headless}, ${width}x${height})`;
}

async function handleNavigate(args: {
  url: string;
  waitUntil?: "load" | "domcontentloaded" | "networkidle0" | "networkidle2";
}): Promise<string> {
  const page = await ensureBrowser();
  const waitUntil = args.waitUntil ?? "domcontentloaded";

  await page.goto(args.url, { waitUntil });

  const title = await page.title();
  return `페이지 이동 완료: ${args.url}\n제목: ${title}`;
}

async function handleClick(args: {
  selector: string;
  waitForSelector?: boolean;
  timeout?: number;
}): Promise<string> {
  const page = await ensureBrowser();
  const timeout = args.timeout ?? 30000;

  if (args.waitForSelector !== false) {
    await page.waitForSelector(args.selector, { timeout, visible: true });
  }

  await page.click(args.selector);
  return `클릭 완료: ${args.selector}`;
}

async function handleFill(args: {
  selector: string;
  value: string;
  clear?: boolean;
}): Promise<string> {
  const page = await ensureBrowser();

  await page.waitForSelector(args.selector, { visible: true });

  if (args.clear !== false) {
    await page.click(args.selector, { clickCount: 3 });
  }

  await page.type(args.selector, args.value);
  return `입력 완료: ${args.selector} = "${args.value}"`;
}

async function handleScreenshot(args: {
  path?: string;
  fullPage?: boolean;
  selector?: string;
}): Promise<string> {
  const page = await ensureBrowser();

  const screenshotOptions = {
    fullPage: args.fullPage ?? false,
    path: args.path,
  };

  let screenshotData: Uint8Array;

  if (args.selector) {
    const element = await page.$(args.selector);
    if (!element) {
      throw new Error(`셀렉터를 찾을 수 없습니다: ${args.selector}`);
    }
    screenshotData = await element.screenshot(screenshotOptions);
  } else {
    screenshotData = await page.screenshot(screenshotOptions);
  }

  if (args.path) {
    return `스크린샷 저장됨: ${args.path}`;
  } else {
    const base64 = Buffer.from(screenshotData).toString("base64");
    return `스크린샷 캡처됨 (base64):\ndata:image/png;base64,${base64}`;
  }
}

async function handleEvaluate(args: { script: string }): Promise<string> {
  const page = await ensureBrowser();

  const result = await page.evaluate(args.script);
  return `실행 결과:\n${JSON.stringify(result, null, 2)}`;
}

async function handleWaitForSelector(args: {
  selector: string;
  timeout?: number;
  visible?: boolean;
}): Promise<string> {
  const page = await ensureBrowser();
  const timeout = args.timeout ?? 30000;
  const visible = args.visible ?? true;

  await page.waitForSelector(args.selector, { timeout, visible });
  return `셀렉터 발견: ${args.selector}`;
}

async function handleGetContent(args: {
  selector?: string;
  type?: "text" | "html" | "value";
}): Promise<string> {
  const page = await ensureBrowser();
  const type = args.type ?? "text";

  if (args.selector) {
    const element = await page.$(args.selector);
    if (!element) {
      throw new Error(`셀렉터를 찾을 수 없습니다: ${args.selector}`);
    }

    let content: string;
    switch (type) {
      case "html":
        content = await page.evaluate(
          (el) => el.innerHTML,
          element
        );
        break;
      case "value":
        content = await page.evaluate(
          (el) => (el as HTMLInputElement).value,
          element
        );
        break;
      default:
        content = await page.evaluate(
          (el) => el.textContent || "",
          element
        );
    }
    return content;
  } else {
    if (type === "html") {
      return await page.content();
    } else {
      return await page.evaluate(() => document.body.innerText);
    }
  }
}

async function handleSelect(args: {
  selector: string;
  value: string;
}): Promise<string> {
  const page = await ensureBrowser();

  await page.waitForSelector(args.selector, { visible: true });
  await page.select(args.selector, args.value);

  return `선택 완료: ${args.selector} = "${args.value}"`;
}

async function handleClose(): Promise<string> {
  if (browser) {
    await browser.close();
    browser = null;
    currentPage = null;
    pages.clear();
    return "브라우저가 종료되었습니다.";
  }
  return "실행 중인 브라우저가 없습니다.";
}

// Create server
const server = new Server(
  {
    name: "puppeteer-browser",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: string;

    switch (name) {
      case "puppeteer_launch":
        result = await handleLaunch(args as Parameters<typeof handleLaunch>[0]);
        break;
      case "puppeteer_navigate":
        result = await handleNavigate(args as Parameters<typeof handleNavigate>[0]);
        break;
      case "puppeteer_click":
        result = await handleClick(args as Parameters<typeof handleClick>[0]);
        break;
      case "puppeteer_fill":
        result = await handleFill(args as Parameters<typeof handleFill>[0]);
        break;
      case "puppeteer_screenshot":
        result = await handleScreenshot(args as Parameters<typeof handleScreenshot>[0]);
        break;
      case "puppeteer_evaluate":
        result = await handleEvaluate(args as Parameters<typeof handleEvaluate>[0]);
        break;
      case "puppeteer_wait_for_selector":
        result = await handleWaitForSelector(args as Parameters<typeof handleWaitForSelector>[0]);
        break;
      case "puppeteer_get_content":
        result = await handleGetContent(args as Parameters<typeof handleGetContent>[0]);
        break;
      case "puppeteer_select":
        result = await handleSelect(args as Parameters<typeof handleSelect>[0]);
        break;
      case "puppeteer_close":
        result = await handleClose();
        break;
      default:
        throw new Error(`알 수 없는 도구: ${name}`);
    }

    return {
      content: [{ type: "text", text: result }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `오류: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on("SIGINT", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Puppeteer MCP Server running on stdio");
}

main().catch(console.error);
