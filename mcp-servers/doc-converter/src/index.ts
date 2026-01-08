#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

// Initialize Anthropic client for table formatting assistance
const anthropic = new Anthropic();

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
turndownService.use(gfm);

// Define MCP tools
const tools: Tool[] = [
  {
    name: "convert_pdf_to_md",
    description:
      "Convert a PDF file to Markdown format. Preserves table structures accurately using AI assistance.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to the PDF file",
        },
        output_path: {
          type: "string",
          description:
            "Optional: Output path for the Markdown file. If not provided, returns the content.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "convert_docx_to_md",
    description:
      "Convert a DOCX file to Markdown format. Preserves table structures accurately.",
    inputSchema: {
      type: "object" as const,
      properties: {
        file_path: {
          type: "string",
          description: "Absolute path to the DOCX file",
        },
        output_path: {
          type: "string",
          description:
            "Optional: Output path for the Markdown file. If not provided, returns the content.",
        },
      },
      required: ["file_path"],
    },
  },
  {
    name: "check_spec_files",
    description:
      "Check for specification files (md/pdf/docx) in a project's docs/qa/specs directory",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to the project root directory",
        },
        feature_name: {
          type: "string",
          description:
            "Optional: Specific feature name to search for (e.g., 'login', 'checkout')",
        },
      },
      required: ["project_path"],
    },
  },
];

// Helper function to format tables using Claude
async function formatTablesWithAI(rawText: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: `다음 텍스트에서 표(table)가 있다면 마크다운 표 형식으로 정확하게 변환해주세요.
표가 아닌 일반 텍스트는 그대로 유지하고, 표만 마크다운 형식으로 변환해주세요.

입력 텍스트:
${rawText}

규칙:
1. 표의 헤더와 데이터를 정확하게 구분하세요
2. 열 정렬을 유지하세요
3. 빈 셀은 공백으로 표시하세요
4. 표가 아닌 내용은 변경하지 마세요

마크다운으로 변환된 결과만 출력하세요:`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    return textContent ? textContent.text : rawText;
  } catch (error) {
    console.error("AI table formatting failed, returning raw text:", error);
    return rawText;
  }
}

// Convert PDF to Markdown
async function convertPdfToMarkdown(
  filePath: string
): Promise<{ content: string; success: boolean; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { content: "", success: false, error: "File not found" };
    }

    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);

    // Use AI to format tables properly
    const formattedContent = await formatTablesWithAI(pdfData.text);

    return { content: formattedContent, success: true };
  } catch (error) {
    return {
      content: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Convert DOCX to Markdown
async function convertDocxToMarkdown(
  filePath: string
): Promise<{ content: string; success: boolean; error?: string }> {
  try {
    if (!fs.existsSync(filePath)) {
      return { content: "", success: false, error: "File not found" };
    }

    const result = await mammoth.convertToHtml({ path: filePath });
    const markdown = turndownService.turndown(result.value);

    // Use AI to verify and fix table formatting if needed
    const formattedContent = await formatTablesWithAI(markdown);

    return { content: formattedContent, success: true };
  } catch (error) {
    return {
      content: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Check for spec files in project
interface SpecFiles {
  markdown: string[];
  pdf: string[];
  docx: string[];
}

function checkSpecFiles(
  projectPath: string,
  featureName?: string
): {
  found: boolean;
  files: SpecFiles;
  recommendation: string;
} {
  const specsPath = path.join(projectPath, "docs", "qa", "specs");
  const result: SpecFiles = {
    markdown: [],
    pdf: [],
    docx: [],
  };

  const searchDirs = ["features", "system"];

  for (const dir of searchDirs) {
    const dirPath = path.join(specsPath, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);

      // If feature name is specified, filter by it
      if (featureName && !file.toLowerCase().includes(featureName.toLowerCase())) {
        continue;
      }

      const ext = path.extname(file).toLowerCase();
      const relativePath = path.join("docs/qa/specs", dir, file);

      if (ext === ".md") {
        result.markdown.push(relativePath);
      } else if (ext === ".pdf") {
        result.pdf.push(relativePath);
      } else if (ext === ".docx") {
        result.docx.push(relativePath);
      }
    }
  }

  const hasMarkdown = result.markdown.length > 0;
  const hasPdfOrDocx = result.pdf.length > 0 || result.docx.length > 0;

  let recommendation: string;
  if (hasMarkdown) {
    recommendation = "Markdown 파일이 존재합니다. 바로 테스트 시나리오를 생성할 수 있습니다.";
  } else if (hasPdfOrDocx) {
    recommendation =
      "PDF/DOCX 파일이 존재합니다. Markdown으로 변환 후 테스트 시나리오를 생성할 수 있습니다.";
  } else {
    recommendation =
      "문서 파일이 없습니다. docs/qa/specs/features/ 또는 docs/qa/specs/system/ 폴더에 기능정의서나 시스템 설계서를 추가해주세요.";
  }

  return {
    found: hasMarkdown || hasPdfOrDocx,
    files: result,
    recommendation,
  };
}

// Create MCP server
const server = new Server(
  {
    name: "doc-converter",
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

  switch (name) {
    case "convert_pdf_to_md": {
      const { file_path, output_path } = args as {
        file_path: string;
        output_path?: string;
      };
      const result = await convertPdfToMarkdown(file_path);

      if (result.success && output_path) {
        fs.writeFileSync(output_path, result.content, "utf-8");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Converted and saved to ${output_path}`,
                preview: result.content.substring(0, 500) + "...",
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }

    case "convert_docx_to_md": {
      const { file_path, output_path } = args as {
        file_path: string;
        output_path?: string;
      };
      const result = await convertDocxToMarkdown(file_path);

      if (result.success && output_path) {
        fs.writeFileSync(output_path, result.content, "utf-8");
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: `Converted and saved to ${output_path}`,
                preview: result.content.substring(0, 500) + "...",
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }

    case "check_spec_files": {
      const { project_path, feature_name } = args as {
        project_path: string;
        feature_name?: string;
      };
      const result = checkSpecFiles(project_path, feature_name);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${name}`,
          },
        ],
        isError: true,
      };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Doc Converter MCP Server running on stdio");
}

main().catch(console.error);
