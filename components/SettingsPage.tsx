'use client';

import { ArrowLeft, RotateCcw, Volume2 } from 'lucide-react';
import { DEFAULT_CCT_SETTINGS } from '@/lib/constants';
import { playErrorBeep, speakDigit } from '@/lib/audio-engine';
import type { CctSettings, EnvironmentConfig } from '@/lib/types';

interface SettingsPageProps {
  settings: CctSettings;
  env: EnvironmentConfig;
  onUpdateSettings: (patch: Partial<CctSettings>) => void;
  onResetSettings: () => void;
  onUpdateEnv: (patch: Partial<EnvironmentConfig>) => void;
  onBack: () => void;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between gap-4 py-3 cursor-pointer"
    >
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        {description && (
          <div className="text-xs text-slate-400 mt-0.5">{description}</div>
        )}
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded accent-emerald-400 cursor-pointer shrink-0"
      />
    </label>
  );
}

export default function SettingsPage({
  settings,
  env,
  onUpdateSettings,
  onResetSettings,
  onUpdateEnv,
  onBack,
}: SettingsPageProps) {
  return (
    <section
      aria-labelledby="settings-page-title"
      className="max-w-3xl mx-auto space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Training</span>
          </button>
          <h1
            id="settings-page-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            CCT Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            All changes save automatically for your next session.
          </p>
        </div>

        <button
          type="button"
          onClick={onResetSettings}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Session & N-Back */}
      <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Session &amp; Memory
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="session-mode"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Session Mode
            </label>
            <select
              id="session-mode"
              value={settings.sessionMode}
              onChange={(e) =>
                onUpdateSettings({
                  sessionMode:
                    e.target.value === 'correct' ? 'correct' : 'timer',
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm text-white focus:outline-none focus:border-emerald-400"
            >
              <option value="timer">Timer based (minutes)</option>
              <option value="correct">Correct answers target</option>
            </select>
          </div>

          {settings.sessionMode === 'timer' ? (
            <div>
              <label
                htmlFor="duration-minutes"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Session Length (minutes)
              </label>
              <input
                id="duration-minutes"
                type="number"
                min={1}
                max={120}
                step={1}
                value={settings.durationMinutes}
                onChange={(e) =>
                  onUpdateSettings({
                    durationMinutes: Math.max(1, Number(e.target.value) || 1),
                  })
                }
                className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          ) : (
            <div>
              <label
                htmlFor="correct-target"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Correct Answers Target
              </label>
              <input
                id="correct-target"
                type="number"
                min={1}
                max={500}
                step={1}
                value={settings.correctTarget}
                onChange={(e) =>
                  onUpdateSettings({
                    correctTarget: Math.max(1, Number(e.target.value) || 20),
                  })
                }
                className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="nback-level"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              N-Back Level (sum current + N steps ago)
            </label>
            <select
              id="nback-level"
              value={settings.nBack}
              onChange={(e) =>
                onUpdateSettings({ nBack: Number(e.target.value) })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm text-white focus:outline-none focus:border-emerald-400"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}-back {n === 1 ? '(Standard PASAT)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                speakDigit(
                  Math.floor(Math.random() * 9) + 1,
                  settings.startIntervalMs
                )
              }
              className="w-full h-11 px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-100 inline-flex items-center justify-center gap-2"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Test Digit Voice</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80 pt-2">
          <ToggleRow
            id="show-timer"
            label="Show Timer"
            description="Display countdown time or remaining answers during training."
            checked={settings.showTimer}
            onChange={(checked) => onUpdateSettings({ showTimer: checked })}
          />
          <ToggleRow
            id="show-interval-stats"
            label="Show Interval Readout"
            description="Show the current speed (ms) during a session."
            checked={settings.showIntervalStats}
            onChange={(checked) =>
              onUpdateSettings({ showIntervalStats: checked })
            }
          />
          <ToggleRow
            id="show-visual-digit"
            label="Show Spoken Digit on Screen"
            description="Optional visual cue alongside the spoken audio digit."
            checked={settings.showVisualDigit}
            onChange={(checked) =>
              onUpdateSettings({ showVisualDigit: checked })
            }
          />
          <ToggleRow
            id="button-mode"
            label="Use Answer Buttons (2–18)"
            description="Tap sum buttons instead of typing numbers on your keyboard."
            checked={settings.buttonMode}
            onChange={(checked) => onUpdateSettings({ buttonMode: checked })}
          />
        </div>
      </div>

      {/* Adaptive Timing (ms) */}
      <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Speed &amp; Adaptive Pacing (ms)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="start-isi"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Starting Interval (ms)
            </label>
            <input
              id="start-isi"
              type="number"
              min={100}
              max={10000}
              step={50}
              value={settings.startIntervalMs}
              onChange={(e) =>
                onUpdateSettings({
                  startIntervalMs:
                    Number(e.target.value) ||
                    DEFAULT_CCT_SETTINGS.startIntervalMs,
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="min-isi"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Minimum Interval (ms)
            </label>
            <input
              id="min-isi"
              type="number"
              min={50}
              max={5000}
              step={50}
              value={settings.minIntervalMs}
              onChange={(e) =>
                onUpdateSettings({
                  minIntervalMs:
                    Number(e.target.value) || DEFAULT_CCT_SETTINGS.minIntervalMs,
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="max-isi"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Maximum Interval (ms)
            </label>
            <input
              id="max-isi"
              type="number"
              min={100}
              max={10000}
              step={50}
              value={settings.maxIntervalMs}
              onChange={(e) =>
                onUpdateSettings({
                  maxIntervalMs:
                    Number(e.target.value) || DEFAULT_CCT_SETTINGS.maxIntervalMs,
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="step-down"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Speed Up Step (ms)
            </label>
            <input
              id="step-down"
              type="number"
              min={10}
              max={1000}
              step={10}
              value={settings.stepDownMs}
              onChange={(e) =>
                onUpdateSettings({
                  stepDownMs:
                    Number(e.target.value) || DEFAULT_CCT_SETTINGS.stepDownMs,
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="step-up"
              className="block text-xs font-semibold text-slate-300 mb-1.5"
            >
              Slow Down Step (ms)
            </label>
            <input
              id="step-up"
              type="number"
              min={10}
              max={1000}
              step={10}
              value={settings.stepUpMs}
              onChange={(e) =>
                onUpdateSettings({
                  stepUpMs:
                    Number(e.target.value) || DEFAULT_CCT_SETTINGS.stepUpMs,
                })
              }
              className="w-full h-11 px-3 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="correct-threshold"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Correct streak
              </label>
              <input
                id="correct-threshold"
                type="number"
                min={1}
                max={20}
                value={settings.correctThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    correctThreshold: Math.max(1, Number(e.target.value) || 4),
                  })
                }
                className="w-full h-11 px-2.5 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label
                htmlFor="wrong-threshold"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Wrong streak
              </label>
              <input
                id="wrong-threshold"
                type="number"
                min={1}
                max={20}
                value={settings.wrongThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    wrongThreshold: Math.max(1, Number(e.target.value) || 4),
                  })
                }
                className="w-full h-11 px-2.5 rounded-lg border border-slate-700 bg-[#090D16] text-sm font-mono text-white focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Beep & Video Visibility */}
      <div className="rounded-xl border border-slate-800 bg-[#0F1522] p-5 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Error Beep &amp; Background Visibility
        </h2>

        <ToggleRow
          id="beep-toggle"
          label="Enable Beep on Error"
          description="Play a short tone whenever an answer is wrong or missed."
          checked={settings.beepEnabled}
          onChange={(checked) => onUpdateSettings({ beepEnabled: checked })}
        />

        <div className="flex flex-wrap items-center gap-4 pt-1">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-300 font-medium">Beep Volume</span>
              <span className="font-mono text-slate-400">
                {Math.round(settings.beepVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.beepVolume}
              onChange={(e) =>
                onUpdateSettings({ beepVolume: Number(e.target.value) })
              }
              aria-label="Beep volume"
              className="w-full accent-emerald-400"
            />
          </div>

          <button
            type="button"
            onClick={() => playErrorBeep(settings.beepVolume)}
            className="h-10 px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-100"
          >
            Test Beep
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-300 font-medium">
              YouTube Video Dimmer (0% = full bright video)
            </span>
            <span className="font-mono text-slate-400">
              {env.youtubeScrimOpacity}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={60}
            step={5}
            value={env.youtubeScrimOpacity}
            onChange={(e) =>
              onUpdateEnv({ youtubeScrimOpacity: Number(e.target.value) })
            }
            aria-label="YouTube background dimmer"
            className="w-full accent-emerald-400"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onBack}
          className="h-11 px-6 rounded-xl bg-emerald-400 text-[#061A12] text-sm font-bold hover:bg-emerald-300 transition-colors"
        >
          Done — Go to Training
        </button>
      </div>
    </section>
  );
}
