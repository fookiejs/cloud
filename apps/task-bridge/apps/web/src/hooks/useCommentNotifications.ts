import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchAllInbox, type InboxItem } from "@/lib/api";
import { markCommentNotified, wasCommentNotified } from "@/lib/read-tasks";
import type { Session } from "@/lib/session";

export function useCommentNotifications(session: Session | null, projectId: string | null) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (!session || !projectId) return;
    if (!silent) setLoading(true);
    try {
      const commentItems = await fetchAllInbox(session, {
        projectId,
        commentsOnly: true,
        epicsOnly: null,
        limit: 100,
      });

      for (const item of commentItems) {
        if (!initializedRef.current) {
          markCommentNotified(item.taskId);
          continue;
        }
        if (!wasCommentNotified(item.taskId)) {
          markCommentNotified(item.taskId);
          toast.message("A comment was added to your task", {
            description: item.title || `Task #${item.taskId}`,
          });
        }
      }
      initializedRef.current = true;

      const all = await fetchAllInbox(session, {
        projectId,
        commentsOnly: null,
        epicsOnly: null,
        limit: 100,
      });
      setItems(all);
    } finally {
      setLoading(false);
    }
  }, [session, projectId]);

  useEffect(() => {
    void refresh(false);
    const timer = window.setInterval(() => void refresh(true), 10000);
    const onRead = () => void refresh(true);
    window.addEventListener("task-bridge:read", onRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("task-bridge:read", onRead);
    };
  }, [refresh]);

  const commentItems = items.filter((item) => item.commentCount > 0);
  const openItems = items.filter((item) => item.status === "sent");

  return { items, commentItems, openItems, loading, refresh };
}
