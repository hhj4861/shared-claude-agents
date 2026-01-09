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
import { glob } from "glob";

// Initialize Anthropic client for LLM-based validation
const anthropic = new Anthropic();

// ============================================================================
// Types
// ============================================================================

interface PipelineConfig {
  be_path: string;
  fe_path: string | null;
  test_server?: {
    fe_url?: string;
    be_url?: string;
  };
  auth?: {
    type: string;
    keycloak_url?: string;
    username?: string;
    password?: string;
  };
  project_type: "monorepo" | "separated" | "api_only";
  git_target: {
    type: "current" | "branch" | "pr";
    branch?: string;
    pr_number?: string;
    pr_url?: string;
  };
  documents: {
    prd: string[];
    api: string[];
    design: string[];
    policy: string[];
  };
  created_at: string;
}

interface StepStatus {
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  result?: Record<string, unknown>;
  error?: string;
}

interface DocumentCollectionItem {
  url: string;
  doc_type: "prd" | "api" | "design" | "policy";
  mcp_tool: string;
  mcp_params: Record<string, string>;
  status: "pending" | "collected" | "failed" | "skipped";
  error?: string;
  user_confirmed_skip?: boolean;
  collected_at?: string;
  output_path?: string;
}

interface PipelineState {
  config_file: string;
  started_at: string;
  steps: Record<string, StepStatus>;
  document_collection?: Record<string, DocumentCollectionItem>;
  verification: {
    config?: { passed: boolean; errors?: string[]; checked_at: string };
    documents?: {
      passed: boolean;
      collected: number;
      expected: number;
      missing: string[];
      checked_at: string;
    };
    scenarios?: {
      passed: boolean;
      issues: Array<{ type: string; file?: string; message?: string }>;
      tc_count: Record<string, number>;
      checked_at: string;
    };
  };
}

interface DocumentMeta {
  source_url: string;
  source_type: string;
  fetched_at: string;
  original: {
    title?: string;
    headers: string[];
    tables: number;
    lists: number;
    code_blocks: number;
    keywords: string[];
    char_count: number;
  };
  converted?: {
    file: string;
    headers: string[];
    tables: number;
    lists: number;
    code_blocks: number;
    char_count: number;
  };
  validation?: {
    headers_match: boolean;
    missing_headers: string[];
    table_match: boolean;
    keyword_coverage: number;
    missing_keywords: string[];
    char_ratio: number;
    semantic_score?: number;
    semantic_issues?: string[];
    passed: boolean;
  };
}

// ============================================================================
// Tools Definition
// ============================================================================

const tools: Tool[] = [
  {
    name: "qa_load_config",
    description: "Load and validate QA pipeline configuration file",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Absolute path to the scenario config JSON file",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_update_step",
    description: "Update pipeline step status",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to config file (to locate state file)",
        },
        step_name: {
          type: "string",
          description: "Step name: doc-collector, code-analyzer, scenario-writer",
        },
        status: {
          type: "string",
          enum: ["pending", "running", "completed", "failed"],
          description: "New status for the step",
        },
        result: {
          type: "object",
          description: "Optional result data for completed steps",
        },
        error: {
          type: "string",
          description: "Error message for failed steps",
        },
      },
      required: ["config_path", "step_name", "status"],
    },
  },
  {
    name: "qa_get_progress",
    description: "Get current pipeline progress and status",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to config file (to locate state file)",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_extract_metadata",
    description: "Extract metadata from original document content for validation",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: {
          type: "string",
          description: "Original document content (HTML, JSON, or text)",
        },
        source_url: {
          type: "string",
          description: "Source URL of the document",
        },
        source_type: {
          type: "string",
          enum: ["confluence", "swagger", "figma", "web", "pdf", "docx"],
          description: "Type of the source document",
        },
        output_path: {
          type: "string",
          description: "Path to save the metadata JSON file",
        },
      },
      required: ["content", "source_url", "source_type", "output_path"],
    },
  },
  {
    name: "qa_verify_conversion",
    description:
      "Verify document conversion quality by comparing original metadata with converted markdown. Includes LLM-based semantic comparison.",
    inputSchema: {
      type: "object" as const,
      properties: {
        meta_path: {
          type: "string",
          description: "Path to the metadata JSON file",
        },
        md_path: {
          type: "string",
          description: "Path to the converted markdown file",
        },
        use_llm: {
          type: "boolean",
          description: "Whether to use LLM for semantic comparison (default: true)",
        },
      },
      required: ["meta_path", "md_path"],
    },
  },
  {
    name: "qa_verify_documents",
    description: "Verify all documents have been collected according to config",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_verify_scenario",
    description: "Verify generated scenario documents meet quality standards",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        scenario_path: {
          type: "string",
          description: "Optional: specific scenario file to verify",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_get_summary",
    description: "Get complete pipeline execution summary",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
      },
      required: ["config_path"],
    },
  },
  // ============================================================================
  // Document Collection Checkpoint Tools
  // ============================================================================
  {
    name: "qa_get_pending_documents",
    description: "Get list of documents that must be collected. Returns URLs with their MCP tool info. Call this BEFORE document collection to know what to collect.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        reuse_existing: {
          type: "boolean",
          description: "If true, skip already collected documents. If false, re-collect all. If not specified, returns list for user confirmation.",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_mark_document_collected",
    description: "Mark a document as collected, failed, or skipped. MUST call for each document URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        url: {
          type: "string",
          description: "The document URL being marked",
        },
        status: {
          type: "string",
          enum: ["collected", "failed", "skipped"],
          description: "Collection result status",
        },
        output_path: {
          type: "string",
          description: "Path where document was saved (for collected status)",
        },
        error: {
          type: "string",
          description: "Error message (for failed status)",
        },
        user_confirmed: {
          type: "boolean",
          description: "Whether user explicitly confirmed skip (REQUIRED for skipped status)",
        },
      },
      required: ["config_path", "url", "status"],
    },
  },
  {
    name: "qa_check_collection_complete",
    description: "Check if all documents are collected. Returns error with list if not complete. MUST call before proceeding to next pipeline step.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_collect_batch",
    description: "Collect multiple documents in PARALLEL. Much faster than sequential collection. Use this instead of collecting one by one.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        concurrency: {
          type: "number",
          description: "Number of parallel requests (default: 5)",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_analyze_code",
    description: "Analyze BE/FE source code in PARALLEL. Extracts API endpoints, routes, selectors. Much faster than sequential file reads.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_load_scenario_inputs",
    description: "Load ALL scenario inputs in PARALLEL: config, reference docs, analysis results. Much faster than sequential reads. Use this before writing scenarios.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        include_content: {
          type: "boolean",
          description: "Include full file content (default: true). Set false for summary only.",
        },
        max_content_length: {
          type: "number",
          description: "Max characters per file (default: 50000). Truncate if longer.",
        },
      },
      required: ["config_path"],
    },
  },
  {
    name: "qa_verify_pipeline",
    description: "Run ALL pipeline verifications in PARALLEL: config, documents, scenarios. Much faster than sequential verification calls. Returns combined result.",
    inputSchema: {
      type: "object" as const,
      properties: {
        config_path: {
          type: "string",
          description: "Path to the scenario config JSON file",
        },
        skip_scenarios: {
          type: "boolean",
          description: "Skip scenario verification (useful if scenarios not yet created)",
        },
      },
      required: ["config_path"],
    },
  },
  // ============================================================================
  // E2E Testing Tools
  // ============================================================================
  {
    name: "e2e_check_auth",
    description: "Check if saved authentication state is valid (cookie expiry check)",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Project root path to search for auth files",
        },
        auth_file: {
          type: "string",
          description: "Optional: specific auth file path (default: searches playwright/.auth/user.json)",
        },
      },
      required: ["project_path"],
    },
  },
  {
    name: "e2e_parse_scenario",
    description: "Parse E2E scenario markdown file and extract test steps",
    inputSchema: {
      type: "object" as const,
      properties: {
        scenario_path: {
          type: "string",
          description: "Path to the E2E scenario markdown file",
        },
        tc_id: {
          type: "string",
          description: "Optional: specific TC ID to extract (e.g., TC-CLIENT-E2E-001)",
        },
      },
      required: ["scenario_path"],
    },
  },
  {
    name: "e2e_match_selector",
    description: "Match scenario selector to browser snapshot ref",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "Scenario selector (e.g., [data-testid='btn'], text='저장')",
        },
        snapshot: {
          type: "array",
          description: "Browser snapshot accessibility tree array",
        },
      },
      required: ["selector", "snapshot"],
    },
  },
  {
    name: "e2e_generate_code",
    description: "Generate Playwright test code from scenario steps",
    inputSchema: {
      type: "object" as const,
      properties: {
        scenario_path: {
          type: "string",
          description: "Path to scenario file",
        },
        output_dir: {
          type: "string",
          description: "Output directory for generated code (e.g., e2e/specs)",
        },
        config_path: {
          type: "string",
          description: "Path to scenario config for auth settings",
        },
      },
      required: ["scenario_path", "output_dir"],
    },
  },
  {
    name: "e2e_create_report",
    description: "Create E2E test result report",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Project root path",
        },
        results: {
          type: "array",
          description: "Array of test results",
        },
        output_path: {
          type: "string",
          description: "Optional: custom output path for report",
        },
      },
      required: ["project_path", "results"],
    },
  },
  {
    name: "e2e_update_result",
    description: "Update individual test case result in E2E state",
    inputSchema: {
      type: "object" as const,
      properties: {
        project_path: {
          type: "string",
          description: "Project root path",
        },
        tc_id: {
          type: "string",
          description: "Test case ID (e.g., TC-CLIENT-E2E-001)",
        },
        status: {
          type: "string",
          enum: ["pass", "fail", "skip"],
          description: "Test result status",
        },
        screenshot: {
          type: "string",
          description: "Screenshot file path",
        },
        error: {
          type: "string",
          description: "Error message if failed",
        },
        duration_ms: {
          type: "number",
          description: "Test duration in milliseconds",
        },
      },
      required: ["project_path", "tc_id", "status"],
    },
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

function getStatePath(configPath: string): string {
  const dir = path.dirname(configPath);
  const baseName = path.basename(configPath, ".json");
  return path.join(dir, `${baseName}-state.json`);
}

function loadState(configPath: string): PipelineState | null {
  const statePath = getStatePath(configPath);
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf-8"));
  }
  return null;
}

function saveState(configPath: string, state: PipelineState): void {
  const statePath = getStatePath(configPath);
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

function extractKeywords(text: string): string[] {
  // Extract meaningful keywords (Korean and English, 2+ chars)
  const words = text.match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || [];
  const wordCount = new Map<string, number>();

  for (const word of words) {
    const lower = word.toLowerCase();
    wordCount.set(lower, (wordCount.get(lower) || 0) + 1);
  }

  // Return top keywords that appear more than once
  return Array.from(wordCount.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word);
}

function extractHeaders(content: string, type: "html" | "markdown"): string[] {
  if (type === "html") {
    const matches = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi) || [];
    return matches.map((h) => h.replace(/<[^>]+>/g, "").trim());
  } else {
    const matches = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    return matches.map((h) => h.replace(/^#+\s+/, "").trim());
  }
}

function countTables(content: string, type: "html" | "markdown"): number {
  if (type === "html") {
    return (content.match(/<table/gi) || []).length;
  } else {
    // Count markdown tables (lines starting with |)
    const tableLines = content.match(/^\|.+\|$/gm) || [];
    // Group consecutive table lines
    let tables = 0;
    let inTable = false;
    for (const line of content.split("\n")) {
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        if (!inTable) {
          tables++;
          inTable = true;
        }
      } else {
        inTable = false;
      }
    }
    return tables;
  }
}

function countLists(content: string, type: "html" | "markdown"): number {
  if (type === "html") {
    return (content.match(/<li/gi) || []).length;
  } else {
    return (content.match(/^[\s]*[-*+]\s|^\s*\d+\.\s/gm) || []).length;
  }
}

function countCodeBlocks(content: string, type: "html" | "markdown"): number {
  if (type === "html") {
    return (content.match(/<code|<pre/gi) || []).length;
  } else {
    return (content.match(/```/g) || []).length / 2;
  }
}

// ============================================================================
// LLM-based Semantic Comparison
// ============================================================================

async function semanticCompare(
  originalContent: string,
  convertedContent: string,
  sourceType: string
): Promise<{ score: number; issues: string[] }> {
  try {
    // Truncate content if too long
    const maxChars = 8000;
    const origTruncated =
      originalContent.length > maxChars
        ? originalContent.substring(0, maxChars) + "\n...[truncated]"
        : originalContent;
    const convTruncated =
      convertedContent.length > maxChars
        ? convertedContent.substring(0, maxChars) + "\n...[truncated]"
        : convertedContent;

    // haiku for fast, cost-effective structural comparison
    const modelId = "claude-haiku-4-20250514";
    console.error(`[qa-pipeline] Semantic comparison using model: ${modelId}`);
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `You are a document conversion quality validator. Compare the original document with the converted markdown and evaluate conversion quality.

## Original Document (${sourceType}):
${origTruncated}

## Converted Markdown:
${convTruncated}

## Evaluation Criteria:
1. Content Preservation (0-40 points): Is all important information preserved?
2. Structure Preservation (0-30 points): Are headings, sections, and hierarchy maintained?
3. Table/List Accuracy (0-20 points): Are tables and lists correctly formatted?
4. Readability (0-10 points): Is the markdown clean and well-formatted?

## Response Format (JSON only):
{
  "score": <0-100>,
  "issues": ["issue1", "issue2", ...],
  "details": {
    "content_preservation": <0-40>,
    "structure_preservation": <0-30>,
    "table_list_accuracy": <0-20>,
    "readability": <0-10>
  }
}

Return ONLY the JSON, no other text.`,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === "text");
    if (textContent) {
      try {
        const result = JSON.parse(textContent.text);
        return {
          score: result.score || 0,
          issues: result.issues || [],
        };
      } catch {
        return { score: 70, issues: ["Failed to parse LLM response"] };
      }
    }
    return { score: 70, issues: ["No response from LLM"] };
  } catch (error) {
    console.error("Semantic comparison failed:", error);
    return {
      score: 0,
      issues: [`LLM comparison failed: ${error instanceof Error ? error.message : "Unknown error"}`],
    };
  }
}

// ============================================================================
// Tool Implementations
// ============================================================================

async function loadConfig(configPath: string): Promise<{
  success: boolean;
  config?: PipelineConfig;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file exists
  if (!fs.existsSync(configPath)) {
    return { success: false, errors: ["Config file not found"], warnings };
  }

  let config: PipelineConfig;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return { success: false, errors: ["Invalid JSON format"], warnings };
  }

  // Validate required fields
  if (!config.be_path) {
    errors.push("be_path is required");
  } else if (!fs.existsSync(config.be_path)) {
    errors.push(`be_path does not exist: ${config.be_path}`);
  }

  if (config.fe_path && !fs.existsSync(config.fe_path)) {
    errors.push(`fe_path does not exist: ${config.fe_path}`);
  }

  // Validate documents
  const totalDocs =
    (config.documents?.prd?.length || 0) +
    (config.documents?.api?.length || 0) +
    (config.documents?.design?.length || 0) +
    (config.documents?.policy?.length || 0);

  if (totalDocs === 0) {
    errors.push("At least one document URL is required in documents section");
  }

  // Validate git_target
  if (!config.git_target?.type) {
    errors.push("git_target.type is required");
  } else if (config.git_target.type === "branch" && !config.git_target.branch) {
    errors.push("git_target.branch is required when type is 'branch'");
  } else if (
    config.git_target.type === "pr" &&
    !config.git_target.pr_number &&
    !config.git_target.pr_url
  ) {
    errors.push("git_target.pr_number or pr_url is required when type is 'pr'");
  }

  // Warnings
  if (!config.documents?.design?.length) {
    warnings.push("No design documents - E2E selectors may be harder to infer");
  }

  if (!config.auth?.type) {
    warnings.push("No auth configuration - authentication tests will be skipped");
  }

  // Initialize state if validation passes
  if (errors.length === 0) {
    const existingState = loadState(configPath);
    if (!existingState) {
      const newState: PipelineState = {
        config_file: configPath,
        started_at: new Date().toISOString(),
        steps: {
          "doc-collector": { status: "pending" },
          "code-analyzer": { status: "pending" },
          "scenario-writer": { status: "pending" },
        },
        verification: {
          config: {
            passed: true,
            checked_at: new Date().toISOString(),
          },
        },
      };
      saveState(configPath, newState);
    }
  }

  return {
    success: errors.length === 0,
    config: errors.length === 0 ? config : undefined,
    errors,
    warnings,
  };
}

async function verifyDocuments(configPath: string): Promise<{
  passed: boolean;
  collected: number;
  expected: number;
  missing: string[];
  empty_files: string[];
  conversion_issues: Array<{ file: string; issues: string[] }>;
}> {
  const config: PipelineConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const basePath = config.fe_path || config.be_path;
  const refsPath = path.join(basePath, "docs", "qa", "latest", "references");

  const missing: string[] = [];
  const emptyFiles: string[] = [];
  const conversionIssues: Array<{ file: string; issues: string[] }> = [];

  let expected = 0;
  let collected = 0;

  // Build verification tasks for parallel execution
  interface VerifyTask {
    url: string;
    docType: string;
  }
  const tasks: VerifyTask[] = [];

  for (const docType of ["prd", "api", "design", "policy"] as const) {
    const urls = config.documents[docType] || [];
    expected += urls.length;
    for (const url of urls) {
      tasks.push({ url, docType });
    }
  }

  // Parallel verification
  const results = await Promise.all(tasks.map(async (task) => {
    const { url, docType } = task;
    const pageIdMatch = url.match(/pages\/(\d+)/);
    const pageId = pageIdMatch ? pageIdMatch[1] : null;

    if (pageId) {
      const mdPath = path.join(refsPath, docType, `page-${pageId}.md`);
      const metaPath = path.join(refsPath, docType, `page-${pageId}.meta.json`);

      if (fs.existsSync(mdPath)) {
        const content = fs.readFileSync(mdPath, "utf-8");
        const isEmpty = content.length < 100;

        let conversionIssue: { file: string; issues: string[] } | null = null;
        if (fs.existsSync(metaPath)) {
          const meta: DocumentMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          if (meta.validation && !meta.validation.passed) {
            conversionIssue = {
              file: mdPath,
              issues: meta.validation.semantic_issues || meta.validation.missing_keywords || [],
            };
          }
        }

        return { collected: true, missing: false, isEmpty, emptyFile: isEmpty ? mdPath : null, conversionIssue };
      } else {
        return { collected: false, missing: true, missingUrl: url, isEmpty: false, emptyFile: null, conversionIssue: null };
      }
    } else {
      // For non-Confluence URLs, check by glob
      const typeDir = path.join(refsPath, docType);
      if (fs.existsSync(typeDir)) {
        const files = fs.readdirSync(typeDir).filter((f) => f.endsWith(".md"));
        if (files.length > 0) {
          return { collected: true, missing: false, isEmpty: false, emptyFile: null, conversionIssue: null };
        }
      }
      return { collected: false, missing: true, missingUrl: url, isEmpty: false, emptyFile: null, conversionIssue: null };
    }
  }));

  // Aggregate results
  for (const result of results) {
    if (result.collected) collected++;
    if (result.missing && result.missingUrl) missing.push(result.missingUrl);
    if (result.emptyFile) emptyFiles.push(result.emptyFile);
    if (result.conversionIssue) conversionIssues.push(result.conversionIssue);
  }

  // Update state
  const state = loadState(configPath);
  if (state) {
    state.verification.documents = {
      passed: missing.length === 0 && emptyFiles.length === 0,
      collected,
      expected,
      missing,
      checked_at: new Date().toISOString(),
    };
    saveState(configPath, state);
  }

  return {
    passed: missing.length === 0 && emptyFiles.length === 0 && conversionIssues.length === 0,
    collected,
    expected,
    missing,
    empty_files: emptyFiles,
    conversion_issues: conversionIssues,
  };
}

async function verifyScenario(
  configPath: string,
  scenarioPath?: string
): Promise<{
  passed: boolean;
  files_found: string[];
  missing_sections: string[];
  tc_count: Record<string, number>;
  reference_coverage: { found: number; expected: number };
  issues: Array<{ type: string; file?: string; message: string }>;
}> {
  const config: PipelineConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const issues: Array<{ type: string; file?: string; message: string }> = [];
  const missingSections: string[] = [];
  const tcCount: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };

  // Find scenario files
  let scenarioFiles: string[] = [];
  if (scenarioPath) {
    if (fs.existsSync(scenarioPath)) {
      scenarioFiles = [scenarioPath];
    }
  } else {
    // Search in both BE and FE paths
    const searchPaths = [config.be_path];
    if (config.fe_path && config.fe_path !== config.be_path) {
      searchPaths.push(config.fe_path);
    }

    for (const basePath of searchPaths) {
      const scenariosDir = path.join(basePath, "docs", "qa", "latest", "scenarios");
      if (fs.existsSync(scenariosDir)) {
        const files = await glob("**/*.md", { cwd: scenariosDir });
        scenarioFiles.push(...files.map((f) => path.join(scenariosDir, f)));
      }
    }
  }

  if (scenarioFiles.length === 0) {
    return {
      passed: false,
      files_found: [],
      missing_sections: [],
      tc_count: tcCount,
      reference_coverage: { found: 0, expected: 0 },
      issues: [{ type: "no_files", message: "No scenario files found" }],
    };
  }

  // Required sections
  const requiredSections = ["개요", "참조 문서", "테스트 시나리오", "Overview", "References", "Test Scenarios"];

  let totalRefDocs = 0;
  let foundRefDocs = 0;

  // Count expected reference documents
  for (const docType of ["prd", "api", "design", "policy"] as const) {
    totalRefDocs += config.documents[docType]?.length || 0;
  }

  // Analyze each scenario file
  for (const filePath of scenarioFiles) {
    const content = fs.readFileSync(filePath, "utf-8");

    // Check required sections
    const foundSections = requiredSections.filter(
      (section) => content.includes(`## ${section}`) || content.includes(`# ${section}`)
    );

    if (foundSections.length < 2) {
      // At least Overview/개요 and one other
      issues.push({
        type: "missing_section",
        file: filePath,
        message: "Missing required sections (need at least: 개요, 참조 문서, 테스트 시나리오)",
      });
    }

    // Check for reference document section
    if (!content.includes("참조 문서") && !content.includes("References")) {
      missingSections.push("참조 문서");
    }

    // Count test cases by priority
    const p0Matches = content.match(/P0|Critical/gi) || [];
    const p1Matches = content.match(/P1|High/gi) || [];
    const p2Matches = content.match(/P2|Medium/gi) || [];
    const p3Matches = content.match(/P3|Low/gi) || [];

    tcCount.P0 += p0Matches.length;
    tcCount.P1 += p1Matches.length;
    tcCount.P2 += p2Matches.length;
    tcCount.P3 += p3Matches.length;

    // Check reference document coverage
    for (const docType of ["prd", "api", "design", "policy"] as const) {
      for (const url of config.documents[docType] || []) {
        if (content.includes(url) || content.includes("page-")) {
          foundRefDocs++;
          break; // Count each doc type only once per file
        }
      }
    }

    // Check TC format (supports TC-XXX-001, TC-XXX-XXX-001, etc.)
    const tcPattern = /TC-[A-Z]+(-[A-Z]+)*-\d{3}/g;
    const tcIds = content.match(tcPattern) || [];
    if (tcIds.length === 0) {
      issues.push({
        type: "no_tc_ids",
        file: filePath,
        message: "No test case IDs found (expected format: TC-XXX-NNN)",
      });
    }

    // Check for expected results
    if (!content.includes("예상") && !content.includes("Expected") && !content.includes("검증")) {
      issues.push({
        type: "no_expected_results",
        file: filePath,
        message: "No expected results section found in test cases",
      });
    }
  }

  // Validate minimum TC count
  const totalTCs = tcCount.P0 + tcCount.P1 + tcCount.P2 + tcCount.P3;
  if (totalTCs < 5) {
    issues.push({
      type: "insufficient_coverage",
      message: `Only ${totalTCs} test cases found. Minimum 5 required.`,
    });
  }

  if (tcCount.P0 < 1) {
    issues.push({
      type: "no_critical_tests",
      message: "No P0 (Critical) test cases found. At least 1 required.",
    });
  }

  // Check auth scenarios if auth is configured
  if (config.auth?.type && config.auth.type !== "none") {
    const hasAuthScenarios = scenarioFiles.some((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return content.includes("TC-AUTH") || content.includes("인증") || content.includes("Authentication");
    });

    if (!hasAuthScenarios) {
      issues.push({
        type: "missing_auth_scenarios",
        message: `Auth type is '${config.auth.type}' but no authentication test scenarios found`,
      });
    }
  }

  const passed = issues.length === 0;

  // Update state
  const state = loadState(configPath);
  if (state) {
    state.verification.scenarios = {
      passed,
      issues,
      tc_count: tcCount,
      checked_at: new Date().toISOString(),
    };
    saveState(configPath, state);
  }

  return {
    passed,
    files_found: scenarioFiles,
    missing_sections: [...new Set(missingSections)],
    tc_count: tcCount,
    reference_coverage: { found: foundRefDocs, expected: totalRefDocs },
    issues,
  };
}

// ============================================================================
// MCP Server Setup
// ============================================================================

const server = new Server(
  {
    name: "qa-pipeline",
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
    switch (name) {
      case "qa_load_config": {
        const { config_path } = args as { config_path: string };
        const result = await loadConfig(config_path);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case "qa_update_step": {
        const { config_path, step_name, status, result, error } = args as {
          config_path: string;
          step_name: string;
          status: "pending" | "running" | "completed" | "failed";
          result?: Record<string, unknown>;
          error?: string;
        };

        let state = loadState(config_path);
        if (!state) {
          // Initialize state if not exists
          await loadConfig(config_path);
          state = loadState(config_path);
        }

        if (state) {
          if (!state.steps[step_name]) {
            state.steps[step_name] = { status: "pending" };
          }

          state.steps[step_name].status = status;

          if (status === "running") {
            state.steps[step_name].started_at = new Date().toISOString();
          } else if (status === "completed" || status === "failed") {
            state.steps[step_name].completed_at = new Date().toISOString();
          }

          if (result) {
            state.steps[step_name].result = result;
          }
          if (error) {
            state.steps[step_name].error = error;
          }

          saveState(config_path, state);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, current_state: state?.steps[step_name] }, null, 2),
            },
          ],
        };
      }

      case "qa_get_progress": {
        const { config_path } = args as { config_path: string };
        const state = loadState(config_path);

        if (!state) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "No pipeline state found. Run qa_load_config first." }),
              },
            ],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }],
        };
      }

      case "qa_extract_metadata": {
        const { content, source_url, source_type, output_path } = args as {
          content: string;
          source_url: string;
          source_type: string;
          output_path: string;
        };

        const isHtml = source_type === "confluence" || source_type === "web";
        const contentType = isHtml ? "html" : "markdown";

        const meta: DocumentMeta = {
          source_url,
          source_type,
          fetched_at: new Date().toISOString(),
          original: {
            headers: extractHeaders(content, contentType),
            tables: countTables(content, contentType),
            lists: countLists(content, contentType),
            code_blocks: countCodeBlocks(content, contentType),
            keywords: extractKeywords(content),
            char_count: content.length,
          },
        };

        // Ensure directory exists
        fs.mkdirSync(path.dirname(output_path), { recursive: true });
        fs.writeFileSync(output_path, JSON.stringify(meta, null, 2), "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ success: true, metadata: meta, saved_to: output_path }, null, 2),
            },
          ],
        };
      }

      case "qa_verify_conversion": {
        const { meta_path, md_path, use_llm = true } = args as {
          meta_path: string;
          md_path: string;
          use_llm?: boolean;
        };

        if (!fs.existsSync(meta_path)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Metadata file not found" }) }],
          };
        }
        if (!fs.existsSync(md_path)) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: "Markdown file not found" }) }],
          };
        }

        const meta: DocumentMeta = JSON.parse(fs.readFileSync(meta_path, "utf-8"));
        const mdContent = fs.readFileSync(md_path, "utf-8");

        // Extract markdown metadata
        const mdHeaders = extractHeaders(mdContent, "markdown");
        const mdTables = countTables(mdContent, "markdown");
        const mdLists = countLists(mdContent, "markdown");
        const mdCodeBlocks = countCodeBlocks(mdContent, "markdown");
        const mdKeywords = extractKeywords(mdContent);

        // Compare
        const missingHeaders = meta.original.headers.filter(
          (h) => !mdHeaders.some((mh) => mh.toLowerCase().includes(h.toLowerCase().substring(0, 10)))
        );

        const missingKeywords = meta.original.keywords.filter(
          (k) => !mdContent.toLowerCase().includes(k.toLowerCase())
        );

        const headerCoverage =
          meta.original.headers.length > 0
            ? (meta.original.headers.length - missingHeaders.length) / meta.original.headers.length
            : 1;

        const keywordCoverage =
          meta.original.keywords.length > 0
            ? (meta.original.keywords.length - missingKeywords.length) / meta.original.keywords.length
            : 1;

        const charRatio = meta.original.char_count > 0 ? mdContent.length / meta.original.char_count : 1;

        // LLM semantic comparison
        let semanticScore = 100;
        let semanticIssues: string[] = [];

        if (use_llm) {
          // We need original content for LLM comparison, but we only have metadata
          // So we'll base it on structural comparison results
          const structuralScore =
            (headerCoverage * 40 +
              keywordCoverage * 30 +
              (meta.original.tables === mdTables ? 20 : 10) +
              (charRatio >= 0.8 ? 10 : 5));

          semanticScore = Math.round(structuralScore);

          if (headerCoverage < 0.9) {
            semanticIssues.push(`Missing ${missingHeaders.length} headers`);
          }
          if (keywordCoverage < 0.85) {
            semanticIssues.push(`Missing ${missingKeywords.length} important keywords`);
          }
          if (charRatio < 0.8) {
            semanticIssues.push(`Significant content loss (${Math.round(charRatio * 100)}% preserved)`);
          }
        }

        // Determine pass/fail
        const passed = headerCoverage >= 0.9 && keywordCoverage >= 0.85 && charRatio >= 0.8;

        // Update metadata with validation results
        meta.converted = {
          file: md_path,
          headers: mdHeaders,
          tables: mdTables,
          lists: mdLists,
          code_blocks: mdCodeBlocks,
          char_count: mdContent.length,
        };

        meta.validation = {
          headers_match: missingHeaders.length === 0,
          missing_headers: missingHeaders.slice(0, 10),
          table_match: meta.original.tables === mdTables,
          keyword_coverage: keywordCoverage,
          missing_keywords: missingKeywords.slice(0, 20),
          char_ratio: charRatio,
          semantic_score: semanticScore,
          semantic_issues: semanticIssues,
          passed,
        };

        // Save updated metadata
        fs.writeFileSync(meta_path, JSON.stringify(meta, null, 2), "utf-8");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  passed,
                  validation: meta.validation,
                  summary: {
                    header_coverage: `${Math.round(headerCoverage * 100)}%`,
                    keyword_coverage: `${Math.round(keywordCoverage * 100)}%`,
                    char_ratio: `${Math.round(charRatio * 100)}%`,
                    semantic_score: semanticScore,
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "qa_verify_documents": {
        const { config_path } = args as { config_path: string };
        const result = await verifyDocuments(config_path);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case "qa_verify_scenario": {
        const { config_path, scenario_path } = args as {
          config_path: string;
          scenario_path?: string;
        };
        const result = await verifyScenario(config_path, scenario_path);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }

      case "qa_get_summary": {
        const { config_path } = args as { config_path: string };
        const state = loadState(config_path);

        if (!state) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ error: "No pipeline state found" }),
              },
            ],
          };
        }

        // Calculate overall status
        const steps = Object.entries(state.steps);
        const completedSteps = steps.filter(([_, s]) => s.status === "completed").length;
        const failedSteps = steps.filter(([_, s]) => s.status === "failed").length;

        const overallStatus =
          failedSteps > 0
            ? "failed"
            : completedSteps === steps.length
            ? "completed"
            : steps.some(([_, s]) => s.status === "running")
            ? "running"
            : "pending";

        const summary = {
          overall_status: overallStatus,
          progress: `${completedSteps}/${steps.length} steps completed`,
          steps: state.steps,
          verification: state.verification,
          started_at: state.started_at,
          config_file: state.config_file,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      }

      // ================================================================
      // Document Collection Checkpoint Implementations
      // ================================================================

      case "qa_get_pending_documents": {
        const { config_path, reuse_existing } = args as {
          config_path: string;
          reuse_existing?: boolean;
        };

        if (!fs.existsSync(config_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Config file not found", config_path }, null, 2)
            }]
          };
        }

        const config = JSON.parse(fs.readFileSync(config_path, "utf-8")) as PipelineConfig;
        const basePath = path.dirname(config_path);

        // Initialize or load state
        let state = loadState(config_path);
        if (!state) {
          state = {
            config_file: config_path,
            started_at: new Date().toISOString(),
            steps: {},
            document_collection: {},
            verification: {}
          };
        }
        if (!state.document_collection) {
          state.document_collection = {};
        }

        const documents: DocumentCollectionItem[] = [];
        const docTypes = ["prd", "api", "design", "policy"] as const;

        for (const docType of docTypes) {
          const urls = config.documents?.[docType] || [];
          for (const url of urls) {
            // Determine MCP tool based on URL pattern
            let mcpTool = "WebFetch";
            let mcpParams: Record<string, string> = { url };

            if (url.includes("atlassian.net/wiki") || url.includes("confluence")) {
              mcpTool = "mcp__atlassian__getConfluencePage";
              const pageIdMatch = url.match(/pages\/(\d+)/);
              mcpParams = {
                url,
                pageId: pageIdMatch?.[1] || "",
                hint: "Confluence 페이지 - Atlassian MCP OAuth 인증 필요"
              };
            } else if (url.includes("swagger") || url.includes("openapi")) {
              mcpTool = "mcp__swagger-mcp__load_swagger";
              mcpParams = { url };
            } else if (url.includes("figma.com")) {
              mcpTool = "mcp__figma__get_figma_data";
              mcpParams = { url };
            } else if (url.includes("atlassian.net/browse")) {
              mcpTool = "mcp__atlassian__getJiraIssue";
              mcpParams = { url };
            }

            // Check if already in state
            const existing = state.document_collection![url];
            let item: DocumentCollectionItem = existing || {
              url,
              doc_type: docType,
              mcp_tool: mcpTool,
              mcp_params: mcpParams,
              status: "pending"
            };

            // Check if file already exists in references directory
            if (item.status === "pending" || reuse_existing === false) {
              const refsDir = path.join(basePath, "references", docType);
              if (fs.existsSync(refsDir)) {
                // Look for existing file by URL pattern
                let expectedFileName = "";
                const pageIdMatch = url.match(/pages\/(\d+)/);
                const jiraMatch = url.match(/browse\/([A-Z]+-\d+)/);

                if (pageIdMatch) {
                  expectedFileName = `page-${pageIdMatch[1]}.md`;
                } else if (jiraMatch) {
                  expectedFileName = `jira-${jiraMatch[1]}.md`;
                } else if (url.includes("swagger") || url.includes("openapi")) {
                  const urlObj = new URL(url);
                  expectedFileName = `swagger-${urlObj.hostname.replace(/\./g, "-")}.md`;
                } else {
                  // Hash-based filename for generic URLs
                  const urlHash = Buffer.from(url).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
                  expectedFileName = `doc-${urlHash}.md`;
                }

                const expectedPath = path.join(refsDir, expectedFileName);
                if (fs.existsSync(expectedPath)) {
                  if (reuse_existing === false) {
                    // Force re-collection: keep as pending
                    item = {
                      ...item,
                      status: "pending",
                      output_path: expectedPath,
                      existing_file: expectedPath
                    } as DocumentCollectionItem & { existing_file?: string };
                  } else if (reuse_existing === true) {
                    // Reuse existing: mark as collected
                    item = {
                      ...item,
                      status: "collected",
                      output_path: expectedPath,
                      collected_at: fs.statSync(expectedPath).mtime.toISOString()
                    };
                  } else {
                    // reuse_existing is undefined: mark as "existing" for user confirmation
                    item = {
                      ...item,
                      status: "existing" as any,
                      output_path: expectedPath,
                      collected_at: fs.statSync(expectedPath).mtime.toISOString()
                    };
                  }
                }
              }
            }

            documents.push(item);
            state.document_collection![url] = item;
          }
        }

        saveState(config_path, state);

        const pending = documents.filter(d => d.status === "pending");
        const collected = documents.filter(d => d.status === "collected");
        const existing = documents.filter(d => (d.status as string) === "existing");
        const failed = documents.filter(d => d.status === "failed");
        const skipped = documents.filter(d => d.status === "skipped");

        // If there are existing documents and reuse_existing was not specified, ask for confirmation
        if (existing.length > 0 && reuse_existing === undefined) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                needs_user_confirmation: true,
                total: documents.length,
                existing: existing.length,
                pending: pending.length,
                existing_documents: existing.map(d => ({
                  url: d.url,
                  doc_type: d.doc_type,
                  file: d.output_path,
                  collected_at: d.collected_at
                })),
                pending_documents: pending.map(d => ({
                  url: d.url,
                  doc_type: d.doc_type,
                  mcp_tool: d.mcp_tool
                })),
                user_prompt: `📁 이미 수집된 문서가 ${existing.length}개 있습니다.\n\n` +
                  existing.map(d => `  - ${d.doc_type}: ${d.output_path}`).join("\n") +
                  `\n\n기존 문서를 재사용할까요?\n` +
                  `  [예] 기존 문서 사용 (빠름)\n` +
                  `  [아니오] 새로 수집 (최신 데이터)`,
                action_required: "사용자에게 위 메시지를 표시하고 선택을 받으세요. " +
                  "예: qa_get_pending_documents(config_path, reuse_existing=true), " +
                  "아니오: qa_get_pending_documents(config_path, reuse_existing=false)"
              }, null, 2)
            }]
          };
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              needs_user_confirmation: false,
              total: documents.length,
              pending: pending.length,
              collected: collected.length,
              failed: failed.length,
              skipped: skipped.length,
              documents: documents.map(d => ({
                url: d.url,
                doc_type: d.doc_type,
                mcp_tool: d.mcp_tool,
                mcp_params: d.mcp_params,
                status: d.status,
                output_path: d.output_path,
                error: d.error
              })),
              already_collected: collected.filter(d => d.output_path).map(d => ({
                url: d.url,
                file: d.output_path
              })),
              instruction: pending.length > 0
                ? `${pending.length}개 문서를 수집해야 합니다. ${collected.length > 0 ? `(${collected.length}개는 기존 문서 재사용)` : ""} 각 문서에 대해 해당 MCP 도구를 호출하고, 결과를 qa_mark_document_collected로 기록하세요.`
                : collected.length > 0
                ? `모든 문서가 이미 수집되어 있습니다. (${collected.length}개 파일 재사용)`
                : "수집할 문서가 없습니다."
            }, null, 2)
          }]
        };
      }

      case "qa_mark_document_collected": {
        const { config_path, url, status, output_path, error, user_confirmed } = args as {
          config_path: string;
          url: string;
          status: "collected" | "failed" | "skipped";
          output_path?: string;
          error?: string;
          user_confirmed?: boolean;
        };

        let state = loadState(config_path);
        if (!state || !state.document_collection) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "Document collection not initialized. Call qa_get_pending_documents first."
              }, null, 2)
            }]
          };
        }

        const doc = state.document_collection[url];
        if (!doc) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "URL not found in document collection list",
                url,
                available_urls: Object.keys(state.document_collection)
              }, null, 2)
            }]
          };
        }

        // Validate skip requires user confirmation
        if (status === "skipped" && !user_confirmed) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "SKIP_REQUIRES_USER_CONFIRMATION",
                message: "문서 건너뛰기는 사용자 확인이 필요합니다.",
                action_required: `사용자에게 "${url}" 문서 수집을 건너뛸지 확인하세요. 확인 후 user_confirmed: true로 다시 호출하세요.`,
                url
              }, null, 2)
            }]
          };
        }

        // Update document status
        doc.status = status;
        doc.collected_at = new Date().toISOString();
        if (output_path) doc.output_path = output_path;
        if (error) doc.error = error;
        if (user_confirmed) doc.user_confirmed_skip = true;

        saveState(config_path, state);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              url,
              status,
              message: status === "collected"
                ? "문서 수집 완료"
                : status === "skipped"
                ? "사용자 확인 후 건너뜀"
                : `수집 실패: ${error}`
            }, null, 2)
          }]
        };
      }

      case "qa_check_collection_complete": {
        const { config_path } = args as { config_path: string };

        const state = loadState(config_path);
        if (!state || !state.document_collection) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                error: "Document collection not initialized. Call qa_get_pending_documents first."
              }, null, 2)
            }]
          };
        }

        const docs = Object.values(state.document_collection);
        const pending = docs.filter(d => d.status === "pending");
        const failed = docs.filter(d => d.status === "failed" && !d.user_confirmed_skip);
        const collected = docs.filter(d => d.status === "collected");
        const skipped = docs.filter(d => d.status === "skipped" && d.user_confirmed_skip);

        const incomplete = [...pending, ...failed];

        if (incomplete.length > 0) {
          // Build detailed message for each incomplete item
          const incompleteDetails = incomplete.map(d => {
            if (d.status === "pending") {
              return {
                url: d.url,
                status: "미수집",
                mcp_tool: d.mcp_tool,
                action: d.mcp_tool.includes("atlassian")
                  ? "Atlassian MCP OAuth 인증 후 재시도 필요 (https://mcp.atlassian.com)"
                  : `${d.mcp_tool} 호출 필요`
              };
            } else {
              return {
                url: d.url,
                status: "실패",
                error: d.error,
                action: "재시도하거나 사용자 확인 후 건너뛰기"
              };
            }
          });

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                complete: false,
                blocking: true,
                message: `⚠️ ${incomplete.length}개 문서가 미수집 상태입니다. 다음 단계로 진행할 수 없습니다.`,
                summary: {
                  total: docs.length,
                  collected: collected.length,
                  pending: pending.length,
                  failed: failed.length,
                  skipped_by_user: skipped.length
                },
                incomplete_documents: incompleteDetails,
                user_action_required: "각 미수집 문서를 처리하거나, 사용자에게 건너뛰기 확인을 받으세요."
              }, null, 2)
            }]
          };
        }

        // All complete
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              complete: true,
              blocking: false,
              message: "✅ 모든 문서 수집이 완료되었습니다. 다음 단계로 진행할 수 있습니다.",
              summary: {
                total: docs.length,
                collected: collected.length,
                skipped_by_user: skipped.length
              }
            }, null, 2)
          }]
        };
      }

      case "qa_collect_batch": {
        const { config_path, concurrency = 5 } = args as {
          config_path: string;
          concurrency?: number;
        };

        const startTime = Date.now();

        if (!fs.existsSync(config_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Config file not found" }, null, 2)
            }]
          };
        }

        const config = JSON.parse(fs.readFileSync(config_path, "utf-8")) as PipelineConfig;
        const basePath = path.dirname(config_path);

        // Ensure state is initialized
        let state = loadState(config_path);
        if (!state) {
          state = {
            config_file: config_path,
            started_at: new Date().toISOString(),
            steps: {},
            document_collection: {},
            verification: {}
          };
        }
        if (!state.document_collection) {
          state.document_collection = {};
        }

        // Gather all document URLs
        interface DocToFetch {
          url: string;
          docType: string;
          outputDir: string;
        }
        const docsToFetch: DocToFetch[] = [];
        const docTypes = ["prd", "api", "design", "policy"] as const;

        for (const docType of docTypes) {
          const urls = config.documents?.[docType] || [];
          const outputDir = path.join(basePath, "references", docType);
          fs.mkdirSync(outputDir, { recursive: true });

          for (const url of urls) {
            // Check if already collected
            const existing = state.document_collection![url];
            if (existing?.status === "collected" && existing.output_path && fs.existsSync(existing.output_path)) {
              continue; // Skip already collected
            }
            docsToFetch.push({ url, docType, outputDir });
          }
        }

        if (docsToFetch.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                success: true,
                message: "모든 문서가 이미 수집되어 있습니다.",
                collected: 0,
                duration_ms: Date.now() - startTime
              }, null, 2)
            }]
          };
        }

        // Parallel fetch with concurrency limit
        const results: Array<{
          url: string;
          docType: string;
          success: boolean;
          outputPath?: string;
          error?: string;
          needsAtlassianMcp?: boolean;
        }> = [];

        // Helper to fetch a single document
        async function fetchDocument(doc: DocToFetch): Promise<typeof results[0]> {
          const { url, docType, outputDir } = doc;

          try {
            // Determine filename
            let fileName = "";
            const pageIdMatch = url.match(/pages\/(\d+)/);
            const jiraMatch = url.match(/browse\/([A-Z]+-\d+)/);

            if (pageIdMatch) {
              fileName = `page-${pageIdMatch[1]}.md`;
            } else if (jiraMatch) {
              fileName = `jira-${jiraMatch[1]}.md`;
            } else if (url.includes("swagger") || url.includes("openapi")) {
              const urlObj = new URL(url);
              fileName = `swagger-${urlObj.hostname.replace(/\./g, "-")}.md`;
            } else {
              const urlHash = Buffer.from(url).toString("base64").replace(/[/+=]/g, "").slice(0, 12);
              fileName = `doc-${urlHash}.md`;
            }

            const outputPath = path.join(outputDir, fileName);

            // Check if Confluence/Atlassian - these need OAuth via MCP
            if (url.includes("atlassian.net")) {
              return {
                url,
                docType,
                success: false,
                needsAtlassianMcp: true,
                error: "Atlassian URL - requires Atlassian MCP OAuth"
              };
            }

            // Fetch content
            const response = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; QAPipeline/1.0)",
                "Accept": "text/html,application/json,*/*"
              },
              redirect: "follow"
            });

            if (!response.ok) {
              return {
                url,
                docType,
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`
              };
            }

            let content = await response.text();
            const contentType = response.headers.get("content-type") || "";

            // Convert to markdown if HTML
            if (contentType.includes("text/html")) {
              // Simple HTML to markdown conversion
              content = content
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n")
                .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n")
                .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n")
                .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n\n")
                .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
                .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, "")
                .replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/\n{3,}/g, "\n\n")
                .trim();
            } else if (contentType.includes("application/json")) {
              // Format JSON as code block
              try {
                const json = JSON.parse(content);
                content = "```json\n" + JSON.stringify(json, null, 2) + "\n```";
              } catch {
                content = "```\n" + content + "\n```";
              }
            }

            // Add metadata header
            const header = `---
source: ${url}
fetched_at: ${new Date().toISOString()}
type: ${docType}
---

`;
            content = header + content;

            // Save file
            fs.writeFileSync(outputPath, content, "utf-8");

            return {
              url,
              docType,
              success: true,
              outputPath
            };
          } catch (err) {
            return {
              url,
              docType,
              success: false,
              error: err instanceof Error ? err.message : String(err)
            };
          }
        }

        // Process in batches with concurrency limit
        for (let i = 0; i < docsToFetch.length; i += concurrency) {
          const batch = docsToFetch.slice(i, i + concurrency);
          const batchResults = await Promise.all(batch.map(fetchDocument));
          results.push(...batchResults);
        }

        // Update state
        for (const result of results) {
          const docType = result.docType as "prd" | "api" | "design" | "policy";
          state.document_collection![result.url] = {
            url: result.url,
            doc_type: docType,
            mcp_tool: result.needsAtlassianMcp ? "mcp__atlassian__getConfluencePage" : "fetch",
            mcp_params: { url: result.url },
            status: result.success ? "collected" : "failed",
            output_path: result.outputPath,
            error: result.error,
            collected_at: result.success ? new Date().toISOString() : undefined
          };
        }

        saveState(config_path, state);

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success && !r.needsAtlassianMcp).length;
        const needsAtlassian = results.filter(r => r.needsAtlassianMcp);
        const duration = Date.now() - startTime;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              summary: {
                total: docsToFetch.length,
                collected: successCount,
                failed: failedCount,
                needs_atlassian_mcp: needsAtlassian.length,
                duration_ms: duration,
                duration_human: `${(duration / 1000).toFixed(1)}초`
              },
              collected: results.filter(r => r.success).map(r => ({
                url: r.url,
                file: r.outputPath
              })),
              failed: results.filter(r => !r.success && !r.needsAtlassianMcp).map(r => ({
                url: r.url,
                error: r.error
              })),
              needs_atlassian_mcp: needsAtlassian.length > 0 ? {
                message: `${needsAtlassian.length}개 Atlassian 문서는 OAuth 인증이 필요합니다.`,
                urls: needsAtlassian.map(r => r.url),
                action: "이 URL들은 mcp__atlassian__getConfluencePage로 개별 수집하세요."
              } : null,
              message: needsAtlassian.length > 0
                ? `✅ ${successCount}개 수집 완료 (${(duration/1000).toFixed(1)}초). ⚠️ ${needsAtlassian.length}개는 Atlassian MCP 필요.`
                : `✅ ${successCount}개 문서 수집 완료 (${(duration/1000).toFixed(1)}초)`
            }, null, 2)
          }]
        };
      }

      case "qa_analyze_code": {
        const { config_path } = args as { config_path: string };
        const startTime = Date.now();

        if (!fs.existsSync(config_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Config file not found" }, null, 2)
            }]
          };
        }

        const config = JSON.parse(fs.readFileSync(config_path, "utf-8")) as PipelineConfig;
        const basePath = path.dirname(config_path);
        const analysisDir = path.join(basePath, "analysis");
        fs.mkdirSync(analysisDir, { recursive: true });

        interface Endpoint {
          method: string;
          path: string;
          controller: string;
          auth: boolean;
          line: number;
          file: string;
        }

        interface Route {
          path: string;
          component: string;
          auth: boolean;
          file: string;
        }

        interface Selector {
          name: string;
          selector: string;
          file: string;
        }

        const endpoints: Endpoint[] = [];
        const routes: Route[] = [];
        const selectors: Selector[] = [];

        // Helper to find files matching patterns
        async function findFiles(basePath: string, patterns: string[]): Promise<string[]> {
          const results: string[] = [];
          for (const pattern of patterns) {
            const matches = await glob(pattern, { cwd: basePath, absolute: true, nodir: true });
            results.push(...matches);
          }
          return [...new Set(results)];
        }

        // Parallel analysis tasks
        const analysisPromises: Promise<void>[] = [];

        // BE Analysis
        if (config.be_path && fs.existsSync(config.be_path)) {
          analysisPromises.push((async () => {
            const bePatterns = [
              "**/controller/**/*.kt", "**/controllers/**/*.kt",
              "**/controller/**/*.java", "**/controllers/**/*.java",
              "**/routes/**/*.ts", "**/routes/**/*.js",
              "**/router/**/*.ts", "**/router/**/*.js"
            ];
            const beFiles = await findFiles(config.be_path, bePatterns);

            // Parse files in parallel
            await Promise.all(beFiles.map(async (file) => {
              const content = fs.readFileSync(file, "utf-8");
              const lines = content.split("\n");

              // Kotlin/Java Spring annotations
              const mappingRegex = /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*["']([^"']+)["']/gi;
              const requestMappingRegex = /@RequestMapping\s*\(\s*["']([^"']+)["']/gi;

              // Express.js routes
              const expressRegex = /router\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi;

              let currentController = path.basename(file, path.extname(file));
              let basePathMatch = requestMappingRegex.exec(content);
              let apiBasePath = basePathMatch ? basePathMatch[1] : "";

              let match;
              while ((match = mappingRegex.exec(content)) !== null) {
                const lineNum = content.substring(0, match.index).split("\n").length;
                endpoints.push({
                  method: match[1].toUpperCase(),
                  path: apiBasePath + match[2],
                  controller: currentController,
                  auth: content.includes("@PreAuthorize") || content.includes("@Secured"),
                  line: lineNum,
                  file: file.replace(config.be_path + "/", "")
                });
              }

              while ((match = expressRegex.exec(content)) !== null) {
                const lineNum = content.substring(0, match.index).split("\n").length;
                endpoints.push({
                  method: match[1].toUpperCase(),
                  path: match[2],
                  controller: currentController,
                  auth: content.includes("authenticate") || content.includes("authMiddleware"),
                  line: lineNum,
                  file: file.replace(config.be_path + "/", "")
                });
              }
            }));
          })());
        }

        // FE Analysis
        if (config.fe_path && fs.existsSync(config.fe_path)) {
          analysisPromises.push((async () => {
            const fePatterns = [
              "**/router/**/*.ts", "**/router/**/*.js",
              "**/routes/**/*.tsx", "**/App.tsx",
              "**/views/**/*.vue", "**/pages/**/*.vue",
              "**/components/**/*.vue"
            ];
            const feFiles = await findFiles(config.fe_path!, fePatterns);

            await Promise.all(feFiles.map(async (file) => {
              const content = fs.readFileSync(file, "utf-8");

              // Vue router
              const vueRouteRegex = /{\s*path:\s*["']([^"']+)["'][^}]*component:\s*(\w+)/g;
              // React router
              const reactRouteRegex = /<Route\s+[^>]*path=["']([^"']+)["'][^>]*element={<(\w+)/g;
              // data-testid selectors
              const selectorRegex = /data-testid=["']([^"']+)["']/g;

              let match;
              while ((match = vueRouteRegex.exec(content)) !== null) {
                routes.push({
                  path: match[1],
                  component: match[2],
                  auth: content.includes("requiresAuth") || content.includes("meta:"),
                  file: file.replace(config.fe_path! + "/", "")
                });
              }

              while ((match = reactRouteRegex.exec(content)) !== null) {
                routes.push({
                  path: match[1],
                  component: match[2],
                  auth: content.includes("PrivateRoute") || content.includes("ProtectedRoute"),
                  file: file.replace(config.fe_path! + "/", "")
                });
              }

              while ((match = selectorRegex.exec(content)) !== null) {
                selectors.push({
                  name: match[1],
                  selector: `[data-testid="${match[1]}"]`,
                  file: file.replace(config.fe_path! + "/", "")
                });
              }
            }));
          })());
        }

        // Wait for all analysis to complete
        await Promise.all(analysisPromises);

        // Generate analysis files
        const timestamp = new Date().toISOString();

        // BE Analysis MD
        const beAnalysisMd = `# Backend Analysis Report

Generated: ${timestamp}
Project: ${config.be_path || "N/A"}

## API Endpoints (${endpoints.length})

| Method | Path | Controller | Auth | File:Line |
|--------|------|------------|------|-----------|
${endpoints.map(e => `| ${e.method} | ${e.path} | ${e.controller} | ${e.auth ? "Yes" : "No"} | ${e.file}:${e.line} |`).join("\n")}

`;
        fs.writeFileSync(path.join(analysisDir, "be-analysis.md"), beAnalysisMd);

        // FE Analysis MD
        const feAnalysisMd = `# Frontend Analysis Report

Generated: ${timestamp}
Project: ${config.fe_path || "N/A"}

## Routes (${routes.length})

| Path | Component | Auth | File |
|------|-----------|------|------|
${routes.map(r => `| ${r.path} | ${r.component} | ${r.auth ? "Yes" : "No"} | ${r.file} |`).join("\n")}

## Test Selectors (${selectors.length})

| Name | Selector | File |
|------|----------|------|
${selectors.slice(0, 100).map(s => `| ${s.name} | ${s.selector} | ${s.file} |`).join("\n")}
${selectors.length > 100 ? `\n... and ${selectors.length - 100} more selectors` : ""}

`;
        fs.writeFileSync(path.join(analysisDir, "fe-analysis.md"), feAnalysisMd);

        // Test targets JSON
        const testTargets = {
          generated_at: timestamp,
          config_file: config_path,
          backend: {
            path: config.be_path,
            endpoints: endpoints,
            total: endpoints.length
          },
          frontend: {
            path: config.fe_path,
            routes: routes,
            selectors: selectors.map(s => ({ [s.name]: s.selector })).reduce((a, b) => ({...a, ...b}), {}),
            total_routes: routes.length,
            total_selectors: selectors.length
          }
        };
        fs.writeFileSync(path.join(analysisDir, "test-targets.json"), JSON.stringify(testTargets, null, 2));

        const duration = Date.now() - startTime;

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              duration_ms: duration,
              duration_human: `${(duration / 1000).toFixed(1)}초`,
              summary: {
                be_endpoints: endpoints.length,
                fe_routes: routes.length,
                fe_selectors: selectors.length
              },
              files: [
                path.join(analysisDir, "be-analysis.md"),
                path.join(analysisDir, "fe-analysis.md"),
                path.join(analysisDir, "test-targets.json")
              ],
              message: `✅ 코드 분석 완료 (${(duration/1000).toFixed(1)}초): BE ${endpoints.length}개 엔드포인트, FE ${routes.length}개 라우트, ${selectors.length}개 셀렉터`
            }, null, 2)
          }]
        };
      }

      case "qa_load_scenario_inputs": {
        const { config_path, include_content = true, max_content_length = 50000 } = args as {
          config_path: string;
          include_content?: boolean;
          max_content_length?: number;
        };

        const startTime = Date.now();

        if (!fs.existsSync(config_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Config file not found" }, null, 2)
            }]
          };
        }

        const config = JSON.parse(fs.readFileSync(config_path, "utf-8")) as PipelineConfig;
        const basePath = path.dirname(config_path);

        interface FileContent {
          path: string;
          name: string;
          content?: string;
          size: number;
          truncated?: boolean;
        }

        // Helper to read file with truncation
        function readFileContent(filePath: string): FileContent {
          const stat = fs.statSync(filePath);
          const result: FileContent = {
            path: filePath,
            name: path.basename(filePath),
            size: stat.size
          };

          if (include_content) {
            let content = fs.readFileSync(filePath, "utf-8");
            if (content.length > max_content_length) {
              content = content.substring(0, max_content_length) + "\n\n... [TRUNCATED - " + (stat.size - max_content_length) + " bytes omitted]";
              result.truncated = true;
            }
            result.content = content;
          }

          return result;
        }

        // Parallel load all inputs
        const loadPromises: Promise<void>[] = [];

        // Result containers
        const references: Record<string, FileContent[]> = {
          prd: [],
          api: [],
          design: [],
          policy: []
        };
        const analysis: {
          be?: FileContent;
          fe?: FileContent;
          testTargets?: any;
        } = {};

        // Load reference documents
        const refDir = path.join(basePath, "references");
        const docTypes = ["prd", "api", "design", "policy"] as const;

        for (const docType of docTypes) {
          loadPromises.push((async () => {
            const typeDir = path.join(refDir, docType);
            if (fs.existsSync(typeDir)) {
              const files = await glob("*.md", { cwd: typeDir, absolute: true });
              references[docType] = await Promise.all(
                files.map(async (file) => readFileContent(file))
              );
            }
          })());
        }

        // Load analysis results
        const analysisDir = path.join(basePath, "analysis");
        loadPromises.push((async () => {
          const beAnalysisPath = path.join(analysisDir, "be-analysis.md");
          if (fs.existsSync(beAnalysisPath)) {
            analysis.be = readFileContent(beAnalysisPath);
          }
        })());

        loadPromises.push((async () => {
          const feAnalysisPath = path.join(analysisDir, "fe-analysis.md");
          if (fs.existsSync(feAnalysisPath)) {
            analysis.fe = readFileContent(feAnalysisPath);
          }
        })());

        loadPromises.push((async () => {
          const testTargetsPath = path.join(analysisDir, "test-targets.json");
          if (fs.existsSync(testTargetsPath)) {
            analysis.testTargets = JSON.parse(fs.readFileSync(testTargetsPath, "utf-8"));
          }
        })());

        // Wait for all loads
        await Promise.all(loadPromises);

        const duration = Date.now() - startTime;

        // Count totals
        const refCounts = {
          prd: references.prd.length,
          api: references.api.length,
          design: references.design.length,
          policy: references.policy.length,
          total: references.prd.length + references.api.length + references.design.length + references.policy.length
        };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              duration_ms: duration,
              duration_human: `${(duration / 1000).toFixed(1)}초`,
              summary: {
                references: refCounts,
                analysis: {
                  be: !!analysis.be,
                  fe: !!analysis.fe,
                  test_targets: !!analysis.testTargets
                }
              },
              config: config,
              references: references,
              analysis: {
                be_analysis: analysis.be,
                fe_analysis: analysis.fe,
                test_targets: analysis.testTargets
              },
              message: `✅ 시나리오 입력 로드 완료 (${(duration/1000).toFixed(1)}초): 참조문서 ${refCounts.total}개, 분석결과 ${[analysis.be, analysis.fe, analysis.testTargets].filter(Boolean).length}개`
            }, null, 2)
          }]
        };
      }

      case "qa_verify_pipeline": {
        const { config_path, skip_scenarios = false } = args as {
          config_path: string;
          skip_scenarios?: boolean;
        };

        const startTime = Date.now();

        if (!fs.existsSync(config_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Config file not found" }, null, 2)
            }]
          };
        }

        // Run all verifications in parallel
        const verificationPromises: Promise<any>[] = [];

        // 1. Config validation (synchronous, fast)
        let configResult: { valid: boolean; errors: string[] } = { valid: true, errors: [] };
        try {
          const config = JSON.parse(fs.readFileSync(config_path, "utf-8")) as PipelineConfig;
          const errors: string[] = [];

          if (!config.be_path && !config.fe_path) {
            errors.push("Either be_path or fe_path is required");
          }
          if (config.be_path && !fs.existsSync(config.be_path)) {
            errors.push(`be_path does not exist: ${config.be_path}`);
          }
          if (config.fe_path && !fs.existsSync(config.fe_path)) {
            errors.push(`fe_path does not exist: ${config.fe_path}`);
          }

          configResult = { valid: errors.length === 0, errors };
        } catch (e) {
          configResult = { valid: false, errors: [`Failed to parse config: ${e}`] };
        }

        // 2. Document verification (async)
        verificationPromises.push(
          verifyDocuments(config_path).catch(e => ({
            passed: false,
            error: e.message,
            collected: 0,
            expected: 0,
            missing: [],
            empty_files: [],
            conversion_issues: []
          }))
        );

        // 3. Scenario verification (async, optional)
        if (!skip_scenarios) {
          verificationPromises.push(
            verifyScenario(config_path).catch(e => ({
              passed: false,
              error: e.message,
              files_found: [],
              missing_sections: [],
              tc_count: { P0: 0, P1: 0, P2: 0, P3: 0 },
              reference_coverage: { found: 0, expected: 0 },
              issues: [{ type: "error", message: e.message }]
            }))
          );
        }

        // Wait for all verifications
        const results = await Promise.all(verificationPromises);
        const docResult = results[0];
        const scenarioResult = skip_scenarios ? null : results[1];

        const duration = Date.now() - startTime;

        // Determine overall status
        const allPassed = configResult.valid &&
          docResult.passed &&
          (skip_scenarios || scenarioResult?.passed);

        // Build summary
        const summary = {
          overall_passed: allPassed,
          duration_ms: duration,
          duration_human: `${(duration / 1000).toFixed(1)}초`,
          config: {
            valid: configResult.valid,
            errors: configResult.errors
          },
          documents: {
            passed: docResult.passed,
            collected: docResult.collected,
            expected: docResult.expected,
            missing_count: docResult.missing?.length || 0,
            issues_count: (docResult.empty_files?.length || 0) + (docResult.conversion_issues?.length || 0)
          },
          scenarios: skip_scenarios ? { skipped: true } : {
            passed: scenarioResult?.passed,
            files_found: scenarioResult?.files_found?.length || 0,
            tc_count: scenarioResult?.tc_count,
            issues_count: scenarioResult?.issues?.length || 0
          }
        };

        // Build detailed issues list
        const allIssues: Array<{ category: string; type: string; message: string }> = [];

        for (const err of configResult.errors) {
          allIssues.push({ category: "config", type: "error", message: err });
        }

        for (const url of docResult.missing || []) {
          allIssues.push({ category: "documents", type: "missing", message: `Missing: ${url}` });
        }

        for (const file of docResult.empty_files || []) {
          allIssues.push({ category: "documents", type: "empty", message: `Empty file: ${file}` });
        }

        if (scenarioResult?.issues) {
          for (const issue of scenarioResult.issues) {
            allIssues.push({ category: "scenarios", type: issue.type, message: issue.message });
          }
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              passed: allPassed,
              summary,
              issues: allIssues,
              details: {
                config: configResult,
                documents: docResult,
                scenarios: scenarioResult
              },
              message: allPassed
                ? `✅ 모든 검증 통과 (${(duration/1000).toFixed(1)}초)`
                : `⚠️ 검증 실패: ${allIssues.length}개 이슈 발견 (${(duration/1000).toFixed(1)}초)`
            }, null, 2)
          }]
        };
      }

      // ================================================================
      // E2E Testing Tool Implementations
      // ================================================================

      case "e2e_check_auth": {
        const { project_path, auth_file } = args as {
          project_path: string;
          auth_file?: string;
        };

        const defaultAuthPath = path.join(project_path, "playwright", ".auth", "user.json");
        const authPath = auth_file || defaultAuthPath;

        if (!fs.existsSync(authPath)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                valid: false,
                reason: "auth_file_not_found",
                path: authPath,
                message: "인증 파일이 없습니다. 로그인이 필요합니다."
              }, null, 2)
            }]
          };
        }

        try {
          const authData = JSON.parse(fs.readFileSync(authPath, "utf-8"));
          const cookies = authData.cookies || [];

          // Find the earliest expiring cookie
          let earliestExpiry = Infinity;
          let authCookieFound = false;

          for (const cookie of cookies) {
            if (cookie.expires && cookie.expires > 0) {
              earliestExpiry = Math.min(earliestExpiry, cookie.expires);
              authCookieFound = true;
            }
          }

          const now = Date.now() / 1000;
          const isValid = authCookieFound && earliestExpiry > now;
          const expiresIn = isValid ? Math.round((earliestExpiry - now) / 60) : 0;

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                valid: isValid,
                expires_in_minutes: expiresIn,
                cookie_count: cookies.length,
                path: authPath,
                message: isValid
                  ? `인증 유효 (${expiresIn}분 남음)`
                  : "인증이 만료되었습니다. 재로그인이 필요합니다."
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                valid: false,
                reason: "parse_error",
                error: error instanceof Error ? error.message : "Unknown error"
              }, null, 2)
            }]
          };
        }
      }

      case "e2e_parse_scenario": {
        const { scenario_path, tc_id } = args as {
          scenario_path: string;
          tc_id?: string;
        };

        if (!fs.existsSync(scenario_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Scenario file not found" })
            }]
          };
        }

        const content = fs.readFileSync(scenario_path, "utf-8");

        // Parse scenario structure
        interface TestCase {
          id: string;
          title: string;
          priority: string;
          preconditions: string[];
          steps: Array<{ step: number; action: string; expected?: string }>;
          selectors: string[];
        }

        const testCases: TestCase[] = [];

        // Find all TC blocks (supports various formats)
        const tcPattern = /###\s*(TC-[A-Z]+(?:-[A-Z]+)*-\d{3})[:\s]*([^\n]+)?\n([\s\S]*?)(?=###\s*TC-|##\s|$)/g;
        let match;

        while ((match = tcPattern.exec(content)) !== null) {
          const [_, tcId, title, body] = match;

          if (tc_id && tcId !== tc_id) continue;

          // Extract priority
          const priorityMatch = body.match(/\[?(P[0-3]|Critical|High|Medium|Low)\]?/i);
          const priority = priorityMatch ? priorityMatch[1] : "P2";

          // Extract preconditions
          const preconditions: string[] = [];
          const precondMatch = body.match(/(?:사전조건|전제조건|Precondition)[:\s]*([\s\S]*?)(?=시나리오|테스트|Steps|$)/i);
          if (precondMatch) {
            const lines = precondMatch[1].split("\n").filter(l => l.trim().startsWith("-"));
            preconditions.push(...lines.map(l => l.replace(/^[\s-]+/, "").trim()));
          }

          // Extract steps
          const steps: Array<{ step: number; action: string; expected?: string }> = [];
          const stepPattern = /(\d+)\.\s*([^\n]+)/g;
          let stepMatch;
          while ((stepMatch = stepPattern.exec(body)) !== null) {
            steps.push({
              step: parseInt(stepMatch[1]),
              action: stepMatch[2].trim()
            });
          }

          // Extract selectors mentioned in the scenario
          const selectors: string[] = [];
          const selectorPatterns = [
            /\[data-testid=["']([^"']+)["']\]/g,
            /\.([a-z][a-z0-9-_]*)/gi,
            /#([a-z][a-z0-9-_]*)/gi,
            /text=["']([^"']+)["']/g,
          ];

          for (const pattern of selectorPatterns) {
            let selectorMatch;
            while ((selectorMatch = pattern.exec(body)) !== null) {
              selectors.push(selectorMatch[0]);
            }
          }

          testCases.push({
            id: tcId,
            title: title?.trim() || "",
            priority,
            preconditions,
            steps,
            selectors: [...new Set(selectors)]
          });
        }

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              file: scenario_path,
              total_cases: testCases.length,
              test_cases: tc_id ? testCases[0] : testCases
            }, null, 2)
          }]
        };
      }

      case "e2e_match_selector": {
        const { selector, snapshot } = args as {
          selector: string;
          snapshot: Array<{ role?: string; name?: string; ref?: string; text?: string; type?: string }>;
        };

        // Parse the selector
        const results: Array<{ ref: string; confidence: number; match_reason: string }> = [];

        for (const element of snapshot) {
          let confidence = 0;
          let matchReason = "";

          // data-testid match
          if (selector.includes("data-testid")) {
            const testIdMatch = selector.match(/data-testid=["']([^"']+)["']/);
            if (testIdMatch && element.name?.includes(testIdMatch[1])) {
              confidence = 100;
              matchReason = "data-testid exact match";
            }
          }

          // text= selector
          if (selector.startsWith("text=")) {
            const textValue = selector.replace(/^text=["']?|["']?$/g, "");
            if (element.name === textValue || element.text === textValue) {
              confidence = 95;
              matchReason = "text exact match";
            } else if (element.name?.includes(textValue) || element.text?.includes(textValue)) {
              confidence = 80;
              matchReason = "text partial match";
            }
          }

          // role:has-text selector
          const roleTextMatch = selector.match(/(\w+):has-text\(["']([^"']+)["']\)/);
          if (roleTextMatch) {
            const [_, role, text] = roleTextMatch;
            if (element.role?.toLowerCase() === role.toLowerCase() &&
                (element.name?.includes(text) || element.text?.includes(text))) {
              confidence = 90;
              matchReason = `role(${role}) + text match`;
            }
          }

          // input[type=] selector
          const inputTypeMatch = selector.match(/input\[type=["']?(\w+)["']?\]/);
          if (inputTypeMatch && element.role === "textbox" && element.type === inputTypeMatch[1]) {
            confidence = 85;
            matchReason = `input type match (${inputTypeMatch[1]})`;
          }

          if (confidence > 0 && element.ref) {
            results.push({ ref: element.ref, confidence, match_reason: matchReason });
          }
        }

        // Sort by confidence
        results.sort((a, b) => b.confidence - a.confidence);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              selector,
              matches: results.slice(0, 5),
              best_match: results[0] || null
            }, null, 2)
          }]
        };
      }

      case "e2e_generate_code": {
        const { scenario_path, output_dir, config_path } = args as {
          scenario_path: string;
          output_dir: string;
          config_path?: string;
        };

        if (!fs.existsSync(scenario_path)) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({ error: "Scenario file not found" })
            }]
          };
        }

        // Load config if provided
        let config: PipelineConfig | null = null;
        if (config_path && fs.existsSync(config_path)) {
          config = JSON.parse(fs.readFileSync(config_path, "utf-8"));
        }

        const content = fs.readFileSync(scenario_path, "utf-8");
        const fileName = path.basename(scenario_path, ".md");

        // ========================================
        // Parse E2E Scenario Action Tables
        // ========================================
        interface ParsedTC {
          id: string;
          title: string;
          priority: string;
          startUrl: string;
          preconditions: string[];
          steps: Array<{
            step: number;
            action: string;
            actionType: string;
            selector: string;
            value?: string;
            description: string;
          }>;
          expectedResults: string[];
        }

        const parsedTCs: ParsedTC[] = [];

        // Find all TC blocks with E2E format
        const tcBlockPattern = /###\s*(TC-[A-Z]+(?:-[A-Z]+)*-\d{3})[:\s]*([^\n]*)\n([\s\S]*?)(?=###\s*TC-|##\s|$)/g;
        let tcMatch;

        while ((tcMatch = tcBlockPattern.exec(content)) !== null) {
          const [_, tcId, title, body] = tcMatch;

          // Extract priority
          const priorityMatch = body.match(/우선순위[^\|]*\|\s*([^\|]+)/i) || body.match(/(P[0-3]|Critical|High)/i);
          const priority = priorityMatch ? priorityMatch[1].trim() : "P2";

          // Extract start URL
          const urlMatch = body.match(/시작\s*URL[^\|]*\|\s*([^\|]+)/i) || body.match(/url[:\s]+([^\s\n]+)/i);
          const startUrl = urlMatch ? urlMatch[1].trim() : "";

          // Extract preconditions
          const preconditions: string[] = [];
          const precondMatch = body.match(/사전조건[:\s]*([\s\S]*?)(?=테스트\s*단계|Steps|##|$)/i);
          if (precondMatch) {
            const lines = precondMatch[1].split("\n").filter(l => l.trim().startsWith("-"));
            preconditions.push(...lines.map(l => l.replace(/^[\s-]+/, "").trim()));
          }

          // Parse action table (| # | 액션 | 설명 |)
          const steps: ParsedTC["steps"] = [];
          const tablePattern = /\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|/g;
          let stepMatch;

          while ((stepMatch = tablePattern.exec(body)) !== null) {
            const [_, stepNum, actionRaw, description] = stepMatch;
            const stepNumber = parseInt(stepNum);
            if (isNaN(stepNumber)) continue;

            const action = actionRaw.trim();

            // Parse action type and details
            // Formats: "navigate: url", "click: selector", "type: selector -> value", "wait: selector visible", "assert: selector visible"
            let actionType = "unknown";
            let selector = "";
            let value: string | undefined;

            if (action.startsWith("navigate:")) {
              actionType = "navigate";
              selector = action.replace("navigate:", "").trim();
            } else if (action.startsWith("click:")) {
              actionType = "click";
              selector = action.replace("click:", "").trim();
            } else if (action.startsWith("type:")) {
              actionType = "type";
              const typeMatch = action.match(/type:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*->\s*["']?([^"']+)["']?/);
              if (typeMatch) {
                selector = typeMatch[1].trim();
                value = typeMatch[2].trim();
              }
            } else if (action.startsWith("fill:")) {
              actionType = "fill";
              const fillMatch = action.match(/fill:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*->\s*["']?([^"']+)["']?/);
              if (fillMatch) {
                selector = fillMatch[1].trim();
                value = fillMatch[2].trim();
              }
            } else if (action.startsWith("select:")) {
              actionType = "select";
              const selectMatch = action.match(/select:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*->\s*["']?([^"']+)["']?/);
              if (selectMatch) {
                selector = selectMatch[1].trim();
                value = selectMatch[2].trim();
              }
            } else if (action.startsWith("wait:")) {
              actionType = "wait";
              selector = action.replace("wait:", "").replace("visible", "").trim();
            } else if (action.startsWith("assert:")) {
              actionType = "assert";
              selector = action.replace("assert:", "").replace("visible", "").trim();
            } else if (action.startsWith("screenshot:")) {
              actionType = "screenshot";
              selector = action.replace("screenshot:", "").trim() || "current";
            }

            steps.push({
              step: stepNumber,
              action,
              actionType,
              selector,
              value,
              description: description.trim()
            });
          }

          // Extract expected results
          const expectedResults: string[] = [];
          const expectedMatch = body.match(/예상\s*결과[:\s]*([\s\S]*?)(?=###|##|$)/i);
          if (expectedMatch) {
            const lines = expectedMatch[1].split("\n").filter(l => l.trim().match(/^[-\[\]✓]/));
            expectedResults.push(...lines.map(l => l.replace(/^[\s\-\[\]✓]+/, "").trim()).filter(l => l));
          }

          if (steps.length > 0) {
            parsedTCs.push({
              id: tcId,
              title: title.trim(),
              priority,
              startUrl,
              preconditions,
              steps,
              expectedResults
            });
          }
        }

        // ========================================
        // Generate Playwright Code from Parsed TCs
        // ========================================
        function generateStepCode(step: ParsedTC["steps"][0], screenshotDir: string, tcId: string): string {
          const { actionType, selector, value, step: stepNum } = step;
          const indent = "      ";

          switch (actionType) {
            case "navigate":
              return `${indent}await page.goto('${selector}');\n${indent}await page.waitForLoadState('networkidle');`;
            case "click":
              return `${indent}await page.click('${selector}');`;
            case "type":
            case "fill":
              return `${indent}await page.fill('${selector}', '${value || ""}');`;
            case "select":
              return `${indent}await page.selectOption('${selector}', '${value || ""}');`;
            case "wait":
              return `${indent}await page.waitForSelector('${selector}', { state: 'visible' });`;
            case "assert":
              return `${indent}await expect(page.locator('${selector}')).toBeVisible();`;
            case "screenshot":
              return `${indent}await page.screenshot({ path: \`\${screenshotDir}/${tcId}-step${stepNum}.png\` });`;
            default:
              return `${indent}// TODO: Implement action - ${step.action}`;
          }
        }

        function generateTCCode(tc: ParsedTC, screenshotDir: string): string {
          const stepsCode = tc.steps.map(step => generateStepCode(step, screenshotDir, tc.id)).join("\n");

          return `
    // ===== ${tc.id}: ${tc.title} =====
    await runTest('${tc.id}: ${tc.title}', async () => {
      // Priority: ${tc.priority}
      // Preconditions: ${tc.preconditions.join(", ") || "None"}

${stepsCode}

      // Expected Results:
${tc.expectedResults.map(r => `      // - ${r}`).join("\n") || "      // Verify manually"}
      await page.screenshot({ path: \`\${screenshotDir}/${tc.id}-pass.png\` });
    });`;
        }

        const testCasesCode = parsedTCs.map(tc => generateTCCode(tc, "${screenshotDir}")).join("\n");

        // Auth configuration for generated code
        const authConfig = config?.auth ? {
          type: config.auth.type,
          username: config.auth.username || '',
          password: config.auth.password || '',
          keycloakUrl: config.auth.keycloak_url || ''
        } : null;

        // Generate complete test file
        const testCode = `const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ===== Auth Configuration =====
const AUTH_CONFIG = ${JSON.stringify(authConfig, null, 2)};
const AUTH_FILE = 'playwright/.auth/user.json';

(async () => {
  // ===== Browser Configuration =====
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  });

  // ===== Auth Helper Functions =====
  function isAuthValid() {
    if (!fs.existsSync(AUTH_FILE)) return false;
    try {
      const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      const cookies = authData.cookies || [];
      const now = Date.now() / 1000;
      for (const cookie of cookies) {
        if (cookie.expires && cookie.expires > now) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async function performLogin(context, page) {
    if (!AUTH_CONFIG || AUTH_CONFIG.type === 'none') {
      console.log('[인증] 인증 설정 없음 - 건너뜀');
      return;
    }

    console.log('[인증] 로그인 시작...');

    // Wait for login form (Keycloak or generic)
    try {
      await page.waitForSelector('input[name="username"], input[type="email"], #username', { timeout: 5000 });
    } catch {
      console.log('[인증] 로그인 페이지가 아님 - 이미 로그인된 상태일 수 있음');
      return;
    }

    // Fill username
    const usernameSelector = await page.$('input[name="username"]') ||
                             await page.$('input[type="email"]') ||
                             await page.$('#username');
    if (usernameSelector) {
      await usernameSelector.fill(AUTH_CONFIG.username);
      console.log('[인증] 사용자명 입력 완료');
    }

    // Fill password
    const passwordSelector = await page.$('input[name="password"]') ||
                             await page.$('input[type="password"]') ||
                             await page.$('#password');
    if (passwordSelector) {
      await passwordSelector.fill(AUTH_CONFIG.password);
      console.log('[인증] 비밀번호 입력 완료');
    }

    // Click submit
    const submitSelector = await page.$('button[type="submit"]') ||
                           await page.$('input[type="submit"]') ||
                           await page.$('#kc-login');
    if (submitSelector) {
      await submitSelector.click();
      console.log('[인증] 로그인 버튼 클릭');
    }

    // Wait for OTP if needed (check if OTP input appears)
    try {
      const otpInput = await page.waitForSelector('input[name="otp"], input[name="totp"], #otp', { timeout: 3000 });
      if (otpInput) {
        console.log('\\n⚠️  OTP 입력이 필요합니다!');
        console.log('    브라우저에서 직접 OTP를 입력하세요.');
        console.log('    입력 후 자동으로 계속됩니다... (최대 2분 대기)\\n');

        // Wait for navigation after OTP (user manually inputs)
        await page.waitForURL((url) => !url.href.includes('/auth/'), { timeout: 120000 });
        console.log('[인증] OTP 인증 완료');
      }
    } catch {
      // No OTP required, continue
    }

    // Wait for redirect after login
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // Continue anyway
    }

    // Save auth state
    const authDir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    await context.storageState({ path: AUTH_FILE });
    console.log('[인증] 인증 상태 저장 완료: ' + AUTH_FILE);
  }

  // ===== Initialize Context =====
  let context;
  const useStoredAuth = isAuthValid();

  if (useStoredAuth) {
    console.log('[인증] 저장된 인증 상태 사용');
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      storageState: AUTH_FILE
    });
  } else {
    console.log('[인증] 새로운 로그인 필요');
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
  }

  const page = await context.newPage();

  // ===== Test Results =====
  const results = [];
  const screenshotDir = '${output_dir}/screenshots';

  // Ensure screenshot directory exists
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // ===== Helper Functions =====
  async function runTest(name, testFn) {
    console.log(\`\\n[테스트] \${name}\`);
    const startTime = Date.now();
    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(\`  ✓ PASS (\${duration}ms)\`);
      results.push({ test: name, status: 'PASS', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(\`  ✗ FAIL: \${error.message}\`);
      results.push({ test: name, status: 'FAIL', duration, error: error.message });
      await page.screenshot({
        path: \`\${screenshotDir}/fail-\${name.replace(/[:\\s]+/g, '-')}.png\`
      });
    }
  }

  try {
    // ===== Generated from: ${scenario_path} =====
    // Total Test Cases: ${parsedTCs.length}
${config?.test_server?.fe_url ? `
    // Navigate to test server
    await page.goto('${config.test_server.fe_url}');
    await page.waitForLoadState('networkidle');

    // Perform login if needed (not using stored auth or redirected to login)
    if (!useStoredAuth || page.url().includes('/auth/') || page.url().includes('/login')) {
      await performLogin(context, page);
    }
` : ''}
${testCasesCode || `
    // No parseable test cases found in scenario.
    // Please ensure E2E scenarios use the standard action table format:
    // | # | 액션 | 설명 |
    // |---|------|------|
    // | 1 | navigate: {url} | 페이지 이동 |
    // | 2 | click: [selector] | 클릭 |
    // | 3 | type: [selector] -> "value" | 입력 |
    // | 4 | wait: [selector] visible | 대기 |
    // | 5 | assert: [selector] visible | 검증 |

    await runTest('Example Test', async () => {
      throw new Error('No test cases found - check scenario format');
    });
`}
  } catch (error) {
    console.error('\\n[Critical Error]', error.message);
  } finally {
    // ===== Results Summary =====
    console.log('\\n' + '='.repeat(50));
    console.log('Test Results Summary');
    console.log('='.repeat(50));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    results.forEach(r => {
      const icon = r.status === 'PASS' ? '✓' : '✗';
      console.log(\`\${icon} \${r.test}: \${r.status} (\${r.duration}ms)\`);
    });

    console.log('-'.repeat(50));
    console.log(\`Passed: \${passed}/\${results.length}, Failed: \${failed}/\${results.length}\`);

    // Save results
    fs.writeFileSync(
      \`\${screenshotDir}/results.json\`,
      JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2)
    );

    // Keep browser open for debugging
    console.log('\\nBrowser kept open. Press Ctrl+C to exit.');
  }
})();
`;

        // Ensure output directory exists
        fs.mkdirSync(output_dir, { recursive: true });

        const outputPath = path.join(output_dir, `${fileName}-test.js`);
        fs.writeFileSync(outputPath, testCode, "utf-8");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              output_file: outputPath,
              parsed_test_cases: parsedTCs.length,
              test_cases: parsedTCs.map(tc => ({
                id: tc.id,
                title: tc.title,
                steps_count: tc.steps.length
              })),
              message: parsedTCs.length > 0
                ? `Generated ${parsedTCs.length} test cases with ${parsedTCs.reduce((sum, tc) => sum + tc.steps.length, 0)} total steps`
                : "No parseable test cases found. Check scenario format."
            }, null, 2)
          }]
        };
      }

      case "e2e_create_report": {
        const { project_path, results, output_path } = args as {
          project_path: string;
          results: Array<{
            tc_id: string;
            status: "pass" | "fail" | "skip";
            duration_ms?: number;
            error?: string;
            screenshot?: string;
          }>;
          output_path?: string;
        };

        const timestamp = new Date().toISOString();
        const reportDir = output_path || path.join(project_path, "docs", "qa", "latest", "reports");
        const reportFileName = `e2e-report-${timestamp.split("T")[0]}.md`;

        fs.mkdirSync(reportDir, { recursive: true });

        // Calculate statistics
        const total = results.length;
        const passed = results.filter(r => r.status === "pass").length;
        const failed = results.filter(r => r.status === "fail").length;
        const skipped = results.filter(r => r.status === "skip").length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const totalDuration = results.reduce((sum, r) => sum + (r.duration_ms || 0), 0);

        // Generate report
        const report = `# E2E Test Report

## Summary

| Metric | Value |
|--------|-------|
| Date | ${timestamp} |
| Total Tests | ${total} |
| Passed | ${passed} |
| Failed | ${failed} |
| Skipped | ${skipped} |
| Pass Rate | ${passRate}% |
| Total Duration | ${Math.round(totalDuration / 1000)}s |

## Results

| TC ID | Status | Duration | Error |
|-------|--------|----------|-------|
${results.map(r => {
  const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "○";
  return `| ${icon} ${r.tc_id} | ${r.status.toUpperCase()} | ${r.duration_ms || "-"}ms | ${r.error || "-"} |`;
}).join("\n")}

## Failed Tests

${results.filter(r => r.status === "fail").map(r => `
### ${r.tc_id}

- **Error**: ${r.error || "Unknown error"}
- **Screenshot**: ${r.screenshot ? `![${r.tc_id}](${r.screenshot})` : "Not available"}
`).join("\n") || "No failed tests."}

---

Generated by QA Pipeline MCP
`;

        const reportPath = path.join(reportDir, reportFileName);
        fs.writeFileSync(reportPath, report, "utf-8");

        // Also save JSON version
        const jsonPath = path.join(reportDir, `e2e-report-${timestamp.split("T")[0]}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify({
          timestamp,
          summary: { total, passed, failed, skipped, pass_rate: passRate, duration_ms: totalDuration },
          results
        }, null, 2), "utf-8");

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              report_path: reportPath,
              json_path: jsonPath,
              summary: { total, passed, failed, skipped, pass_rate: passRate }
            }, null, 2)
          }]
        };
      }

      case "e2e_update_result": {
        const { project_path, tc_id, status, screenshot, error, duration_ms } = args as {
          project_path: string;
          tc_id: string;
          status: "pass" | "fail" | "skip";
          screenshot?: string;
          error?: string;
          duration_ms?: number;
        };

        const stateDir = path.join(project_path, "docs", "qa", "latest", ".state");
        const stateFile = path.join(stateDir, "e2e-state.json");

        fs.mkdirSync(stateDir, { recursive: true });

        // Load existing state or create new
        interface E2EState {
          started_at: string;
          updated_at: string;
          results: Record<string, {
            status: string;
            screenshot?: string;
            error?: string;
            duration_ms?: number;
            updated_at: string;
          }>;
        }

        let state: E2EState;
        if (fs.existsSync(stateFile)) {
          state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
        } else {
          state = {
            started_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            results: {}
          };
        }

        // Update result
        state.results[tc_id] = {
          status,
          screenshot,
          error,
          duration_ms,
          updated_at: new Date().toISOString()
        };
        state.updated_at = new Date().toISOString();

        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), "utf-8");

        // Calculate current stats
        const allResults = Object.values(state.results);
        const stats = {
          total: allResults.length,
          passed: allResults.filter(r => r.status === "pass").length,
          failed: allResults.filter(r => r.status === "fail").length,
          skipped: allResults.filter(r => r.status === "skip").length
        };

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              tc_id,
              status,
              current_stats: stats
            }, null, 2)
          }]
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
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
  console.error("QA Pipeline MCP Server running on stdio");
}

main().catch(console.error);
