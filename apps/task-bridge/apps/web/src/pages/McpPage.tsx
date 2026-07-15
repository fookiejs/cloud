import { McpSetup } from "@/components/McpSetup";
import { PageHeader } from "@/components/layout/PageHeader";

export function McpPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-8 py-6">
      <PageHeader
        title="MCP"
        subtitle="Connect Cursor to Task Bridge with the Model Context Protocol."
      />
      <McpSetup />
    </div>
  );
}
