function formatTimeAgo(value) {
    if (!value) return "just now";
  
    const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  
    if (!Number.isFinite(seconds) || seconds < 60) return "just now";
  
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
  
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
  
    return `${Math.floor(hours / 24)}d ago`;
  }
  
  export default function WorkerOperationsFeed({ events = [] }) {
    if (events.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-zinc-700 p-5 text-center text-sm text-zinc-500">
          Waiting for worker operations events...
        </div>
      );
    }
  
    return (
      <div className="space-y-3">
        {events.slice(0, 8).map((event, index) => (
          <div
            key={`${event.type}-${event.issueId || index}`}
            className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {event.type?.replaceAll("_", " ") || "Realtime Event"}
              </p>
              <span className="text-xs text-zinc-500">
                {formatTimeAgo(event.timestamp)}
              </span>
            </div>
  
            <p className="mt-2 text-sm text-zinc-300">
              {event.title || event.message || "Worker queue updated"}
            </p>
          </div>
        ))}
      </div>
    );
  }
  