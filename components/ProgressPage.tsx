'use client';

import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import RecentSessionsTable from './RecentSessionsTable';
import type { SessionRecord } from '@/lib/types';

interface ProgressPageProps {
  sessions: SessionRecord[];
  onClearLogs: () => Promise<void>;
  onToast: (msg: string) => void;
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export default function ProgressPage({
  sessions,
  onClearLogs,
  onToast,
}: ProgressPageProps) {
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = sessions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

  const totalQuestions = sorted.reduce((sum, s) => sum + s.questions, 0);
  const totalCorrect = sorted.reduce((sum, s) => sum + s.correctCount, 0);
  const overallAccuracy = totalQuestions
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : null;
  const bestIsi = sorted.length
    ? Math.min(...sorted.map((s) => s.lowestIsiMs))
    : null;

  function handleExportCsv() {
    if (!sorted.length) {
      onToast('No sessions to export yet');
      return;
    }
    const headers = [
      'Date',
      'Mode',
      'N-Back',
      'Accuracy (%)',
      'Questions',
      'Correct',
      'Lowest ISI (ms)',
      'Avg Response (ms)',
      'Duration (s)',
      'YouTube ID',
      'Affective Audio',
    ];
    const lines = [
      headers.map(csvCell).join(','),
      ...sorted.map((s) =>
        [
          s.startedAt,
          s.modeLabel,
          s.nBack,
          s.accuracy,
          s.questions,
          s.correctCount,
          s.lowestIsiMs,
          s.avgResponseMs ?? '',
          s.durationSeconds,
          s.youtubeVideoId ?? '',
          s.affectiveAudioSummary,
        ]
          .map(csvCell)
          .join(',')
      ),
    ];
    const blob = new Blob(['\uFEFF', lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'acct-sessions.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="progress-page-title" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1
            id="progress-page-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            Training Progress
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Review your accuracy, lowest inter-stimulus interval, and response
            speed across sessions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!sorted.length}
            onClick={handleExportCsv}
            className="h-10 px-3.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-100 inline-flex items-center gap-1.5 disabled:opacity-35"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {confirmClear ? (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await onClearLogs();
                  setConfirmClear(false);
                }}
                className="h-10 px-3.5 rounded-lg bg-rose-500 text-white text-xs font-bold hover:bg-rose-400"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="h-10 px-3 rounded-lg border border-slate-700 text-xs text-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={!sorted.length}
              onClick={() => setConfirmClear(true)}
              className="h-10 px-3.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-rose-500/20 disabled:opacity-35"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Sessions
          </div>
          <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-white">
            {sorted.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Total Questions
          </div>
          <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-white">
            {totalQuestions}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Overall Accuracy
          </div>
          <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-emerald-400">
            {overallAccuracy != null ? `${overallAccuracy}%` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Best Lowest ISI
          </div>
          <div className="mt-1.5 text-2xl font-mono font-bold tabular-nums text-cyan-300">
            {bestIsi != null ? `${bestIsi} ms` : '—'}
          </div>
        </div>
      </div>

      <RecentSessionsTable
        sessions={sorted}
        maxHeightClass="max-h-[520px]"
      />
    </section>
  );
}
