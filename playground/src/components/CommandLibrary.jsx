import { useMemo, useState } from "react";
import {
  ArrowRightIcon, CameraIcon, CheckCircleIcon, ClockIcon, CodeBracketIcon,
  CursorArrowRaysIcon, MagnifyingGlassIcon, PowerIcon, RocketLaunchIcon,
  WrenchScrewdriverIcon, XMarkIcon,
} from "@heroicons/react/24/outline";

const categories = [
  { id: "setup", label: "Setup", icon: WrenchScrewdriverIcon, color: "text-blue-300", lightColor: "text-blue-700" },
  { id: "navigation", label: "Navigation", icon: RocketLaunchIcon, color: "text-violet-300", lightColor: "text-violet-700" },
  { id: "synchronization", label: "Synchronization", icon: ClockIcon, color: "text-amber-300", lightColor: "text-amber-700" },
  { id: "interaction", label: "Interaction", icon: CursorArrowRaysIcon, color: "text-cyan-300", lightColor: "text-cyan-700" },
  { id: "capture", label: "Capture", icon: CameraIcon, color: "text-pink-300", lightColor: "text-pink-700" },
  { id: "validation", label: "Validation", icon: CheckCircleIcon, color: "text-emerald-300", lightColor: "text-emerald-700" },
  { id: "lifecycle", label: "Lifecycle", icon: PowerIcon, color: "text-rose-300", lightColor: "text-rose-700" },
];

const commands = [
  { name: "framework", category: "setup", description: "Choose Puppeteer, Playwright, or Selenium", snippet: 'framework: puppeteer' },
  { name: "browser", category: "setup", description: "Launch or connect to a browser", snippet: 'browser:\n  mode: connect\n  connect:\n    wsUrl: "ws://browser:9222"' },
  { name: "goto", category: "navigation", description: "Navigate to a URL", snippet: '  - goto:\n      url: "https://example.com"\n      waitUntil: "load"' },
  { name: "newPage", category: "navigation", description: "Open a new browser page", snippet: "  - newPage: true" },
  { name: "emulate", category: "navigation", description: "Emulate a known device", snippet: '  - emulate:\n      device: "iPhone X"' },
  { name: "wait", category: "synchronization", description: "Pause for a fixed duration", snippet: '  - wait:\n      timeout: "1s"' },
  { name: "waitForSelector", category: "synchronization", description: "Wait for an element to appear", snippet: '  - waitForSelector:\n      selector: "#content"' },
  { name: "click", category: "interaction", description: "Click an element or coordinates", snippet: '  - click:\n      selector: "button"' },
  { name: "type", category: "interaction", description: "Type into an input", snippet: '  - type:\n      selector: "input"\n      text: "Hello"\n      delay: "25ms"' },
  { name: "press", category: "interaction", description: "Press a keyboard key", snippet: '  - press:\n      key: "Enter"' },
  { name: "focus", category: "interaction", description: "Focus an element", snippet: '  - focus:\n      selector: "input"' },
  { name: "hover", category: "interaction", description: "Hover over an element", snippet: '  - hover:\n      selector: ".menu-item"' },
  { name: "scroll", category: "interaction", description: "Scroll to or by a position", snippet: "  - scroll:\n      by:\n        dx: 0\n        dy: 500" },
  { name: "screenshot", category: "capture", description: "Capture the current page", snippet: '  - screenshot:\n      path: "screenshots/page.png"\n      fullPage: true' },
  { name: "assert", category: "validation", description: "Validate content, existence, or visibility", snippet: '  - assert:\n      selector: "h1"\n      visible: true\n      throwOnFail: true' },
  { name: "baseline_scan", category: "validation", description: "Scan web feature compatibility", snippet: '  - baseline_scan:\n      availability: ["high", "low"]\n      year: 2024' },
  { name: "close", category: "lifecycle", description: "Close the current page", snippet: "  - close: true" },
];

export default function CommandLibrary({ isOpen, onClose, onInsert, isDarkMode }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const visible = useMemo(() => commands.filter((command) =>
    (activeCategory === "all" || command.category === activeCategory) &&
    `${command.name} ${command.description}`.toLowerCase().includes(query.toLowerCase())
  ), [activeCategory, query]);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 app-modal-backdrop" onClick={onClose} />
      <aside className={`absolute right-0 top-0 h-full w-[min(760px,96vw)] border-l shadow-2xl flex flex-col ${isDarkMode ? "bg-[#0b1120] border-blue-400/25" : "bg-white border-slate-200"}`} aria-label="Command library">
        <header className={`px-6 py-5 border-b flex items-center justify-between ${isDarkMode ? "border-slate-700/50" : "border-slate-200"}`}>
          <div><h2 className={`text-xl font-semibold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Command library</h2><p className="text-sm text-slate-400 mt-1">All 17 supported commands, ready to insert.</p></div>
          <button type="button" onClick={onClose} className="icon-button" aria-label="Close command library"><XMarkIcon className="w-5 h-5" /></button>
        </header>
        <div className={`p-4 border-b ${isDarkMode ? "border-slate-700/50" : "border-slate-200"}`}>
          <div className="relative"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search commands" className={`w-full pl-11 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500/40 ${isDarkMode ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" : "bg-slate-50 border-slate-200"}`} /></div>
        </div>
        <div className="flex flex-1 min-h-0">
          <nav className={`w-52 shrink-0 p-3 border-r overflow-y-auto ${isDarkMode ? "border-slate-800" : "border-slate-200"}`}>
            <button type="button" onClick={() => setActiveCategory("all")} className={`w-full flex gap-3 items-center px-3 py-2.5 rounded-xl text-sm ${activeCategory === "all" ? (isDarkMode ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700") : (isDarkMode ? "text-slate-400 hover:bg-slate-800/60" : "text-slate-600 hover:bg-slate-100")}`}><CodeBracketIcon className="w-5 h-5" />All commands</button>
            {categories.map((category) => {
              const CategoryIcon = category.icon;
              return <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} className={`w-full flex gap-3 items-center px-3 py-2.5 rounded-xl text-sm mt-1 ${activeCategory === category.id ? (isDarkMode ? "bg-blue-500/15 text-blue-300" : "bg-blue-50 text-blue-700") : (isDarkMode ? "text-slate-400 hover:bg-slate-800/60" : "text-slate-600 hover:bg-slate-100")}`}><CategoryIcon className={`w-5 h-5 ${isDarkMode ? category.color : category.lightColor}`} />{category.label}</button>;
            })}
          </nav>
          <div className="flex-1 overflow-y-auto p-5 terminal-scroll">
            {categories.map((category) => {
              const group = visible.filter((command) => command.category === category.id);
              if (!group.length) return null;
              return <section key={category.id} className="mb-6"><h3 className={`text-xs font-semibold uppercase tracking-[.14em] mb-2 ${isDarkMode ? category.color : category.lightColor}`}>{category.label}</h3><div className={`rounded-xl border divide-y ${isDarkMode ? "border-slate-800 divide-slate-800" : "border-slate-200 divide-slate-200"}`}>{group.map((command) => <div key={command.name} className={`flex items-center gap-4 px-4 py-3 ${isDarkMode ? "hover:bg-slate-900/80" : "hover:bg-slate-50"}`}><div className="min-w-0 flex-1"><code className={`text-sm ${isDarkMode ? "text-blue-300" : "text-blue-700"}`}>{command.name}</code><p className={`text-xs mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>{command.description}</p></div><button type="button" onClick={() => onInsert(command)} className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg ${isDarkMode ? "text-blue-300 hover:text-blue-200 hover:bg-blue-500/10" : "text-blue-700 hover:text-blue-800 hover:bg-blue-50"}`}>Insert <ArrowRightIcon className="w-3.5 h-3.5" /></button></div>)}</div></section>;
            })}
            {!visible.length && <p className="text-sm text-slate-400 text-center py-16">No commands match “{query}”.</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
