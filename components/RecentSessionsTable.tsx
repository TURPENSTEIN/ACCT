'use client';

import type { SessionRecord } from '@/lib/types';

interface RecentSessionsTableProps {
  sessions: SessionRecord[];
  maxHeightClass?: string;
}

function formatShortTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const monthDay = d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${monthDay}, ${time}`;
}

export default function RecentSessionsTable({
  sessions,
  maxHeightClass = 'max-h-[380px]',
}: RecentSessionsTableProps) {
  return (
    <section aria-labelledby="recent-sessions-heading" className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2
          id="recent-sessions-heading"
          className="text-xs font-bold tracking-[0.14em] uppercase text-slate-400"
        >
          Session History
        </h2>
        <span className="text-xs font-mono tabular-nums text-slate-500">
          {sessions.length} {sessions.length === 1 ? 'run' : 'runs'}
        </span>
      </div>

      {!sessions.length ? (
        <div className="rounded-2xl border border-slate-800/80 bg-[#0E1420] px-6 py-9 text-center text-xs text-slate-400">
          No completed runs yet. Finish a session to see your accuracy and speed
          progression here.
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-1 ${maxHeightClass}`}
        >
          {sessions.map((s) => (
            <article
              key={s.id}
              className="rounded-xl border border-slate-800/90 bg-[#0E1420] p-4 flex flex-col justify-between gap-3.5 hover:border-slate-700 transition-colors"
            >
              {/* Header: Accuracy + Timestamp */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-2xl font-mono font-bold tabular-nums text-white leading-none">
                    {s.accuracy}%
                  </div>
                  <div className="mt-1.5 text-xs text-slate-400">
                    <span className="text-emerald-300 font-medium">
                      {s.modeLabel}
                    </span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span>{s.nBack}-back</span>
                  </div>
                </div>

                <div className="text-[11px] font-mono tabular-nums text-slate-500 text-right">
                  {formatShortTimestamp(s.startedAt)}
                </div>
              </div>

              {/* Bottom 3-Column Metrics */}
              <div className="grid grid-cols-3 divide-x divide-slate-800/90 pt-2.5 border-t border-slate-800/80 text-center">
                <div className="pr-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Turns
                  </div>
                  <div className="mt-0.5 text-xs font-mono font-semibold tabular-nums text-slate-200">
                    {s.correctCount}/{s.questions}
                  </div>
                </div>

                <div className="px-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Min ISI
                  </div>
                  <div className="mt-0.5 text-xs font-mono font-semibold tabular-nums text-slate-200">
                    {s.lowestIsiMs} ms
                  </div>
                </div>

                <div className="pl-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    Avg RT
                  </div>
                  <div className="mt-0.5 text-xs font-mono font-semibold tabular-nums text-slate-200">
                    {s.avgResponseMs != null ? `${s.avgResponseMs} ms` : '—'}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
