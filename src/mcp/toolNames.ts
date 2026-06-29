export const MCP_TOOL_NAMES = {
  auditSite: "shipready.audit_site",
  searchConsoleStatus: "shipready.search_console_status",
  inspectRepo: "shipready.inspect_repo",
  planFixes: "shipready.plan_fixes",
  previewFixes: "shipready.preview_fixes",
  writeSafeCrawlFiles: "shipready.write_safe_crawl_files",
  getUiReport: "shipready.get_ui_report",
  getContractFixture: "shipready.get_contract_fixture",
  getPolicyDoc: "shipready.get_policy_doc",
} as const;

export const MCP_READ_ONLY_TOOL_NAMES = [
  MCP_TOOL_NAMES.auditSite,
  MCP_TOOL_NAMES.searchConsoleStatus,
  MCP_TOOL_NAMES.inspectRepo,
  MCP_TOOL_NAMES.planFixes,
  MCP_TOOL_NAMES.previewFixes,
  MCP_TOOL_NAMES.getUiReport,
  MCP_TOOL_NAMES.getContractFixture,
  MCP_TOOL_NAMES.getPolicyDoc,
] as const;

export const MCP_WRITE_TOOL_NAMES = [MCP_TOOL_NAMES.writeSafeCrawlFiles] as const;

export const TOOL_NAMES = [
  MCP_TOOL_NAMES.auditSite,
  MCP_TOOL_NAMES.searchConsoleStatus,
  MCP_TOOL_NAMES.inspectRepo,
  MCP_TOOL_NAMES.planFixes,
  MCP_TOOL_NAMES.previewFixes,
  MCP_TOOL_NAMES.writeSafeCrawlFiles,
  MCP_TOOL_NAMES.getUiReport,
  MCP_TOOL_NAMES.getContractFixture,
  MCP_TOOL_NAMES.getPolicyDoc,
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
