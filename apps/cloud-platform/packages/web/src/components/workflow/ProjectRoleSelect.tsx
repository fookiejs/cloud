import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ProjectRoleSelectProps = {
  id: string | null;
  label: string;
  value: string;
  roles: string[];
  onChange: (value: string) => void;
  emptyLabel: string | null;
};

export function ProjectRoleSelect(rawProps: Partial<ProjectRoleSelectProps> & Pick<ProjectRoleSelectProps, "label" | "value" | "roles" | "onChange">) {
  let id: string | null = null;
  if ("id" in rawProps) {
    if (rawProps.id === null) {
      id = null;
    } else if (typeof rawProps.id === "string") {
      id = rawProps.id;
    }
  }
  let emptyLabel = "Off";
  if ("emptyLabel" in rawProps && typeof rawProps.emptyLabel === "string") {
    emptyLabel = rawProps.emptyLabel;
  }
  const { label, value, roles, onChange } = rawProps;

  const hasRoles = roles.length > 0;
  return (
    <div className="space-y-2">
      {id !== null ? <Label htmlFor={id}>{label}</Label> : <Label>{label}</Label>}
      <Select
        id={id !== null ? id : ""}
        value={value}
        disabled={!hasRoles}
        onChange={(event) => onChange(event.target.value)}
        className={cn(!hasRoles && "cursor-not-allowed opacity-50")}
      >
        <option value="">{emptyLabel}</option>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </Select>
      {!hasRoles ? (
        <p className="text-xs text-muted-foreground">Add project roles in the Team tab first.</p>
      ) : null}
    </div>
  );
}
