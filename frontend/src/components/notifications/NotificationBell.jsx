import {
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import API from "@/services/api";
import {
  connectNotificationSocket,
  disconnectNotificationSocket,
} from "@/services/realtime";
import { useAuthStore } from "@/store/useAuthStore";

function formatNotificationTime(value) {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getNotificationDestination(notification, role) {
  if (notification?.actionUrl) {
    return notification.actionUrl;
  }

  const issueId = notification?.issueId;
  const query = issueId ? `?issueId=${issueId}` : "";

  switch (role) {
    case "ADMIN":
      return `/admin${query}`;
    case "SUPERVISOR":
      return `/supervisor${query}`;
    case "WORKER":
    case "OFFICER":
      return `/worker${query}`;
    case "CITIZEN":
      return issueId ? `/dashboard?tab=my-reports&reportId=${issueId}` : "/dashboard?tab=my-reports";
    default:
      return "/";
  }
}

function getNotificationTypeMeta(type) {
  switch (type) {
    case "ISSUE_ESCALATED":
      return {
        label: "Escalation",
        icon: ShieldAlert,
        className:
          "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
      };

    case "CLOSURE_SUBMITTED":
    case "ISSUE_RESOLVED":
      return {
        label: "Resolution",
        icon: CheckCheck,
        className:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
      };

    case "FEEDBACK_SUBMITTED":
    case "SUPERVISOR_NOTE":
      return {
        label: "Update",
        icon: MessageSquare,
        className:
          "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
      };

    default:
      return {
        label: "Issue",
        icon: Bell,
        className:
          "border-slate-200 bg-slate-50 text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
      };
  }
}

function getUserId(user) {
  return user?.id || user?.userId || user?.uuid;
}

export default function NotificationBell({ variant = "dark" }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [isOpen, setIsOpen] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const panelRef = useRef(null);

  const isLight = variant === "light";
  const userId = getUserId(user);

  const {
    data: notifications = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await API.get("/api/notifications");
      return response.data || [];
    },
    enabled: Boolean(user),
    refetchInterval: isSocketConnected ? false : 30000,
    staleTime: 1000 * 20,
    refetchOnWindowFocus: true,
  });

  const { data: unreadData } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      const response = await API.get("/api/notifications/unread-count");
      return response.data || { count: 0 };
    },
    enabled: Boolean(user),
    refetchInterval: isSocketConnected ? false : 30000,
    staleTime: 1000 * 20,
    refetchOnWindowFocus: true,
  });

  const unreadCount = Number(unreadData?.count || 0);

  const unreadLabel = useMemo(() => {
    if (unreadCount > 99) return "99+";
    return String(unreadCount);
  }, [unreadCount]);

  
  const hasReadNotifications = notifications.some(
    (notification) => notification.read
  );

const invalidateNotifications = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] }),
    ]);
  };

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    connectNotificationSocket({
      userId,
      onConnect: () => setIsSocketConnected(true),
      onDisconnect: () => setIsSocketConnected(false),
      onNotificationEvent: async (notification) => {
        await invalidateNotifications();

        toast.info(notification?.title || "New notification", {
          description: notification?.message || "CivicSense notification received.",
        });
      },
    });

    return () => {
      setIsSocketConnected(false);
      disconnectNotificationSocket();
    };
  }, [queryClient, userId]);

  const markOneReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      const response = await API.patch(`/api/notifications/${notificationId}/read`);
      return response.data;
    },
    onSuccess: invalidateNotifications,
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const response = await API.patch("/api/notifications/read-all");
      return response.data;
    },
    onSuccess: invalidateNotifications,
  });

  
  const clearReadMutation = useMutation({
    mutationFn: async () => {
      const response = await API.patch("/api/notifications/clear-read");
      return response.data;
    },
    onSuccess: async (data) => {
      await invalidateNotifications();

      toast.success("Read notifications cleared", {
        description: `${data?.deletedCount || 0} read notification(s) removed.`,
      });
    },
  });

const handleNotificationClick = async (notification) => {
    if (!notification?.read && notification?.id) {
      await markOneReadMutation.mutateAsync(notification.id);
    }

    setIsOpen(false);
    navigate(getNotificationDestination(notification, user?.role));
  };

  const buttonClass = isLight
    ? "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-800 transition hover:bg-slate-50"
    : "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800";

  const panelClass = isLight
    ? "absolute right-0 z-[3000] mt-2 w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
    : "absolute right-0 z-[3000] mt-2 w-[calc(100vw-2rem)] max-w-96 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl";

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={buttonClass}
        aria-label="Open notifications"
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div className={panelClass}>
          <div
            className={`flex items-center justify-between border-b px-4 py-3 ${
              isLight ? "border-slate-200" : "border-zinc-800"
            }`}
          >
            <div>
              <p className={isLight ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-white"}>
                Notifications
              </p>
              <p className={isLight ? "text-xs text-slate-500" : "text-xs text-zinc-500"}>
                {unreadCount} unread · {isSocketConnected ? "Live" : "Polling"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={markAllReadMutation.isPending || unreadCount === 0}
                onClick={() => markAllReadMutation.mutate()}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLight
                    ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark read
              </button>

              <button
                type="button"
                disabled={clearReadMutation.isPending || !hasReadNotifications}
                onClick={() => clearReadMutation.mutate()}
                className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLight
                    ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                    : "border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear read
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className={`flex items-center justify-center gap-2 px-4 py-8 text-sm ${
                isLight ? "text-slate-500" : "text-zinc-500"
              }`}>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className={`px-4 py-8 text-center text-sm ${isLight ? "text-slate-500" : "text-zinc-500"}`}>
                No alerts right now. No alerts right now. You’re all caught up.
              </div>
            ) : (
              notifications.map((notification) => {
                const meta = getNotificationTypeMeta(notification.type);
                const Icon = meta.icon;

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`block w-full border-b px-4 py-3 text-left transition last:border-b-0 ${
                      isLight
                        ? "border-slate-100 hover:bg-slate-50"
                        : "border-zinc-900 hover:bg-zinc-900"
                    } ${notification.read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                          notification.read ? "bg-transparent" : "bg-blue-500"
                        }`}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </span>

                          {notification.issueId && (
                            <span className={isLight ? "text-[10px] text-slate-400" : "text-[10px] text-zinc-600"}>
                              Linked issue
                            </span>
                          )}
                        </div>

                        <p className={isLight ? "text-sm font-semibold text-slate-900" : "text-sm font-semibold text-zinc-100"}>
                          {notification.title}
                        </p>

                        <p className={isLight ? "mt-1 text-xs leading-5 text-slate-600" : "mt-1 text-xs leading-5 text-zinc-400"}>
                          {notification.message}
                        </p>

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className={isLight ? "text-[11px] text-slate-400" : "text-[11px] text-zinc-600"}>
                            {formatNotificationTime(notification.createdAt)}
                          </p>

                          {notification.issueId && (
                            <span className={isLight ? "inline-flex items-center gap-1 text-[11px] font-medium text-slate-500" : "inline-flex items-center gap-1 text-[11px] font-medium text-zinc-500"}>
                              View issue
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {isFetching && !isLoading && (
            <div className={`border-t px-4 py-2 text-center text-[11px] ${
              isLight ? "border-slate-100 text-slate-400" : "border-zinc-900 text-zinc-600"
            }`}>
              Syncing...
            </div>
          )}
        </div>
      )}
    </div>
  );
}