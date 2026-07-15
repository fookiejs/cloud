import { listProjectMemberRows, listWorkflowStageRows } from "../db/workflow-db.js";

function pickRandomMember(members: { name: string }[]): string {
  if (members.length === 0) return "";
  const index = Math.floor(Math.random() * members.length);
  const member = members[index];
  if (!member) return "";
  return member.name;
}

export function pickMemberByProjectRole(projectId: string, _roleName: string): string {
  const members = listProjectMemberRows({ projectId, id: "" });
  if (members.length === 0) return "";
  return pickRandomMember(members);
}

export function resolveTaskAssignee(input: {
  projectId: string;
  assignee: string | null;
  assigneeRole: string | null;
  stageId: string | null;
}): { assignee: string; assigneeRole: string | null } {
  let explicit = "";
  if (input.assignee !== null) {
    explicit = input.assignee.trim();
  }
  if (explicit) {
    return { assignee: explicit, assigneeRole: input.assigneeRole };
  }

  let role = "";
  if (input.assigneeRole !== null) {
    role = input.assigneeRole.trim();
  }
  if (!role && input.stageId) {
    const stageRows = listWorkflowStageRows({
      projectId: input.projectId,
      stageId: input.stageId,
    });
    const stage = stageRows[0];
    if (stage) {
      role = stage.auto_assign_role.trim();
    }
  }

  if (!role) {
    return { assignee: "", assigneeRole: input.assigneeRole };
  }

  const assignee = pickMemberByProjectRole(input.projectId, role);
  return { assignee, assigneeRole: role || input.assigneeRole };
}
