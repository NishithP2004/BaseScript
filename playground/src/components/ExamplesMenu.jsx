import { useEffect, useRef, useState } from "react";
import {
  ArrowTopRightOnSquareIcon, CheckBadgeIcon, CursorArrowRaysIcon,
  DevicePhoneMobileIcon, DocumentTextIcon, MagnifyingGlassIcon,
  RectangleStackIcon, RocketLaunchIcon, SparklesIcon,
} from "@heroicons/react/24/outline";
import { exampleCatalog } from "../examples";

const icons = {
  rocket: RocketLaunchIcon, search: MagnifyingGlassIcon, form: DocumentTextIcon,
  device: DevicePhoneMobileIcon, pointer: CursorArrowRaysIcon, check: CheckBadgeIcon,
  sparkles: SparklesIcon, pages: RectangleStackIcon,
};

const colors = {
  blue: "text-blue-300 bg-blue-500/12 border-blue-400/20",
  green: "text-emerald-300 bg-emerald-500/12 border-emerald-400/20",
  violet: "text-violet-300 bg-violet-500/12 border-violet-400/20",
  yellow: "text-amber-300 bg-amber-500/12 border-amber-400/20",
  cyan: "text-cyan-300 bg-cyan-500/12 border-cyan-400/20",
  red: "text-rose-300 bg-rose-500/12 border-rose-400/20",
  pink: "text-pink-300 bg-pink-500/12 border-pink-400/20",
};

export default function ExamplesMenu({ onSelect, isDarkMode }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative z-50">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${isDarkMode ? "bg-slate-900/80 border-slate-700/80 text-slate-200 hover:border-blue-400/50" : "bg-white border-slate-200 text-slate-700 hover:border-blue-400"}`}>
        <SparklesIcon className="w-4 h-4 text-blue-400" /> Examples
        <ArrowTopRightOnSquareIcon className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : "rotate-45"}`} />
      </button>
      {open && (
        <div className={`absolute right-0 mt-2 w-[390px] max-h-[min(620px,75vh)] overflow-y-auto rounded-2xl border p-2 shadow-2xl terminal-scroll ${isDarkMode ? "bg-[#101729] border-slate-700/80 shadow-black/50" : "bg-white border-slate-200 shadow-slate-400/30"}`}>
          <div className="px-3 py-2">
            <p className={`text-sm font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Start from a workflow</p>
            <p className="text-xs text-slate-400 mt-0.5">Every example uses supported BaseScript commands.</p>
          </div>
          {exampleCatalog.map((example) => {
            const Icon = icons[example.icon];
            return (
              <button key={example.id} type="button" onClick={() => { onSelect(example.id); setOpen(false); }}
                className={`w-full flex items-center gap-3 rounded-xl p-3 text-left transition-colors ${isDarkMode ? "hover:bg-slate-800/80" : "hover:bg-blue-50"}`}>
                <span className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center ${colors[example.color]}`}><Icon className="w-5 h-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>{example.title}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">{example.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
