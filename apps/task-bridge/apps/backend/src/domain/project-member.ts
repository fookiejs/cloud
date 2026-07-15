import { listProjectMemberRows } from "../db/workflow-db.js";

export type ProjectMemberProfile = {
  name: string;
  role: string;
};

export function findProjectMember(
  projectId: string,
  memberName: string,
): ProjectMemberProfile | null {
  const name = memberName;
  if (name === "") {
    return null;
  }
  const row = listProjectMemberRows({ projectId, id: "" }).find((entry) => entry.name === name);
  if (!row) {
    return null;
  }
  return {
    name: row.name,
    role: row.role,
  };
}
