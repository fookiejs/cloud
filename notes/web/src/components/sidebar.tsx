import { Inbox } from "lucide-react";
import { FookieCloudMark } from "@/components/fookie-cloud-mark";
import { clearSession, getUser, isCloudHost } from "@/lib/auth";
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

      <div className="border-t px-3 py-3 flex flex-col gap-2">
        <FookieCloudMark size="sm" />
        <a
          href={FOOKIE_PROFILE}
          className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-secondary/60 transition-colors"
        >
          <span className="text-xs font-medium truncate">{displayName}</span>
          {displayEmail ? (
            <span className="text-[11px] text-muted-foreground truncate">{displayEmail}</span>
          ) : null}
        </a>
        {cloud ? (
          <button
            type="button"
            className="text-left text-[11px] text-muted-foreground hover:text-foreground px-2"
            onClick={() => {
              clearSession();
              location.href = "/";
            }}
          >
            Sign out
          </button>
        ) : null}
      </div>
    </aside>
  );
}
