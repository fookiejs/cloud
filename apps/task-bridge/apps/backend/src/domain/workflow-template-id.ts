export const DEFAULT_WORKFLOW_TEMPLATE_ID = "plan-build-deliver";

export function normalizeWorkflowTemplateId(value: string): string {
  if (value === "" || value === "empty") return DEFAULT_WORKFLOW_TEMPLATE_ID;
  return value;
}
