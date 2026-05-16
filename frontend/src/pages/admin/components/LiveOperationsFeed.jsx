import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";

const getEventConfig = (type) => {
  switch (type) {
    case "ISSUE_CREATED":
    case "NEW_ISSUE":
      return {
        icon: Activity,
        iconColor: "text-blue-400",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        label: "New Issue Reported",
      };

    case "AI_ANALYSIS_COMPLETED":
      return {
        icon: Sparkles,
        iconColor: "text-purple-400",
        bg: "bg-purple-500/10",
        border: "border-purple-500/20",
        label: "AI Analysis Completed",
      };

    case "ISSUE_ASSIGNED":
      return {
        icon: UserCheck,
        iconColor: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        label: "Issue Assigned",
      };

    case "ISSUE_VERIFIED":
      return {
        icon: CheckCircle2,
        iconColor: "text-green-400",
        bg: "bg-green-500/10",
        border: "border-green-500/20",
        label: "Issue Verified",
      };

    case "ISSUE_REJECTED":
      return {
        icon: ShieldAlert,
        iconColor: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        label: "Issue Rejected",
      };

    case "ISSUE_RESOLVED":
      return {
        icon: CheckCircle2,
        iconColor: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        label: "Issue Resolved",
      };

    case "DUPLICATE_DETECTED":
      return {
        icon: AlertTriangle,
        iconColor: "text-yellow-400",
        bg: "bg-yellow-500/10",
        border: "border-yellow-500/20",
        label: "Possible Duplicate Detected",
      };

    case "ISSUE_UPDATED":
      return {
        icon: Activity,
        iconColor: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        label: "Issue Updated",
      };

    case "ISSUE_DELETED":
      return {
        icon: ShieldAlert,
        iconColor: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        label: "Issue Removed",
      };

    default:
      return {
        icon: Activity,
        iconColor: "text-zinc-400",
        bg: "bg-zinc-500/10",
        border: "border-zinc-500/20",
        label: "System Event",
      };
  }
};

const formatTimeAgo = (timestamp) => {
  const now = new Date();
  const date = new Date(timestamp);

  const seconds = Math.floor((now - date) / 1000);

  if (!Number.isFinite(seconds) || seconds < 60) {
    return "just now";
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
};

const getEventTitle = (event) => {
  return event.issueTitle || event.title || event.issue?.title || null;
};

const getEventMessage = (event) => {
  if (event.message) {
    return event.message;
  }

  const title = getEventTitle(event);

  switch (event.type) {
    case "ISSUE_ASSIGNED":
      return title
        ? `"${title}" was assigned to operations.`
        : "An issue was assigned to operations.";

    case "ISSUE_RESOLVED":
      return title
        ? `"${title}" was resolved with evidence.`
        : "An issue was resolved with evidence.";

    case "AI_ANALYSIS_COMPLETED":
      return title
        ? `AI analysis completed for "${title}".`
        : "AI analysis completed for an issue.";

    case "NEW_ISSUE":
    case "ISSUE_CREATED":
      return title
        ? `New issue reported: "${title}".`
        : "A new issue was reported.";

    case "ISSUE_UPDATED":
      return title
        ? `"${title}" was updated.`
        : "An issue was updated.";

    case "ISSUE_DELETED":
      return "An issue was removed.";

    default:
      return "Realtime civic operations event received.";
  }
};

export default function LiveOperationsFeed({ events }) {
  return (
    <div className="space-y-4">
      {events.length === 0 && (
        <div
          className="
            flex
            h-[500px]
            items-center
            justify-center
            rounded-xl
            border
            border-dashed
            border-zinc-700
          "
        >
          <p className="text-zinc-500">
            Waiting for realtime events...
          </p>
        </div>
      )}

      {events.map((event, index) => {
        const config = getEventConfig(event.type);
        const Icon = config.icon;
        const issueTitle = getEventTitle(event);
        const message = getEventMessage(event);

        return (
          <div
            key={`${event.type}-${event.issueId || "event"}-${index}`}
            className={`
              rounded-2xl
              border
              p-4
              ${config.bg}
              ${config.border}
            `}
          >
            <div className="flex items-start gap-3">
              <div
                className="
                  rounded-xl
                  bg-zinc-900
                  p-2
                "
              >
                <Icon
                  className={`
                    h-5
                    w-5
                    ${config.iconColor}
                  `}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-2
                  "
                >
                  <h3 className="font-medium text-white">
                    {config.label}
                  </h3>

                  <span
                    className="
                      text-xs
                      text-zinc-500
                    "
                  >
                    {formatTimeAgo(event.timestamp)}
                  </span>
                </div>

                <p
                  className="
                    mt-1
                    text-sm
                    text-zinc-300
                  "
                >
                  {message}
                </p>

                {issueTitle && (
                  <div
                    className="
                      mt-3
                      rounded-lg
                      border
                      border-zinc-700
                      bg-zinc-900/70
                      px-3
                      py-2
                    "
                  >
                    <p
                      className="
                        text-sm
                        font-medium
                        text-zinc-200
                      "
                    >
                      {issueTitle}
                    </p>

                    {event.type === "ISSUE_ASSIGNED" && (
                      <p className="mt-1 text-xs text-cyan-300">
                        Worker assignment active
                      </p>
                    )}

                    {event.type === "ISSUE_RESOLVED" && (
                      <p className="mt-1 text-xs text-emerald-300">
                        Resolution proof available
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}