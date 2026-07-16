import { Inbox } from "lucide-react";
import { FookieCloudMark } from "@/components/fookie-cloud-mark";
import { getUser, isCloudHost } from "@/lib/auth";
import { cn } from "@/lib/utils";

const FOOKIE_PROFILE = "https://fookiecloud.com/profile";

export function Sidebar(props: { unread: number }): React.JSX.Element {
  const cloud = isCloudHost();
  const user = cloud ? getUser() : null;
  let displayName = "Profile";
  let displayEmail = "";
  if (user !== null) {
    if (user.name) displayName = user.name;
    else if (user.email) displayName = user.email;
    if (user.email) displayEmail = user.email;
  }

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-card/40 border-r flex flex-col">
      <div className="flex items-center px-4 h-14 border-b w-full text-left">
        <span className="text-sm font-semibold tracking-tight">Notes</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="px-2 h-6 flex items-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Inbox
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 h-9 px-2.5 rounded-md text-sm font-medium bg-secondary text-foreground",
            )}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            <span className="flex-1 truncate">Gelen</span>
            {props.unread > 0 ? (
              <span className="text-[10px] font-semibold rounded-md bg-warn/15 text-warn px-1.5 py-0.5">
                {props.unread}
              </span>
            ) : null}
          </div>
        </div>
      </nav>

      {cloud ? (
        <div className="shrink-0">
          <div className="border-t px-2 py-2">
            <div className="px-2.5 py-2">
              <FookieCloudMark size="sm" />
            </div>
          </div>
          <div className="border-t px-2 py-2">
            <a
              href={FOOKIE_PROFILE}
              className="flex w-full items-center rounded-md px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-none text-foreground">
                  {displayName}
                </p>
                {displayEmail.length > 0 ? (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{displayEmail}</p>
                ) : (
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Fookie Cloud</p>
                )}
              </div>
            </a>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
