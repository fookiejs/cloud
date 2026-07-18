import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { ProjectMember } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";

type TeamPanelProps = {
  members: ProjectMember[];
  onCreateMember: (input: { name: string; role: string }) => Promise<void>;
  onDeleteMember: (memberId: string, name: string) => Promise<void>;
};

export function TeamPanel({
  members,
  onCreateMember,
  onDeleteMember,
}: TeamPanelProps) {
  const { confirmDestructive } = useConfirm();
  const [name, setName] = useState("");

  async function submitMember() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await onCreateMember({ name: trimmed, role: "" });
    setName("");
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-8 py-5">
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white">Members</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone on the team can claim and update any task.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-wrap gap-2 pt-6">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Member name"
              className="min-w-[10rem] flex-1"
              onKeyDown={(event) => {
                if (event.key === "Enter" && name.trim()) {
                  event.preventDefault();
                  void submitMember();
                }
              }}
            />
            <Button disabled={!name.trim()} onClick={() => void submitMember()}>
              Add
            </Button>
          </CardContent>
        </Card>

        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <Card key={member.id}>
                <CardContent className="flex flex-wrap items-center gap-4 pt-6 sm:flex-nowrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.openTasks} open tasks</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      void (async () => {
                        if (!(await confirmDestructive(`Delete member "${member.name}"?`, null))) {
                          return;
                        }
                        await onDeleteMember(member.id, member.name);
                      })();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
