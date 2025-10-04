import { VncScreen } from "react-vnc";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { javascript } from "@codemirror/lang-javascript";
import { keymap } from "@codemirror/view";
import { useState, useCallback, useMemo, useEffect } from "react";
import { duotoneDark, duotoneLight } from "@uiw/codemirror-theme-duotone";
import { githubLight } from "@uiw/codemirror-theme-github";
import { nord } from "@uiw/codemirror-theme-nord";
import { tokyoNight } from "@uiw/codemirror-theme-tokyo-night";
import { tokyoNightStorm } from "@uiw/codemirror-theme-tokyo-night-storm";
import { tokyoNightDay } from "@uiw/codemirror-theme-tokyo-night-day";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { aura } from "@uiw/codemirror-theme-aura";
import { andromeda } from "@uiw/codemirror-theme-andromeda";
import { atomone } from "@uiw/codemirror-theme-atomone";
import { bespin } from "@uiw/codemirror-theme-bespin";
import { darcula } from "@uiw/codemirror-theme-darcula";
import { monokai } from "@uiw/codemirror-theme-monokai";
import { monokaiDimmed } from "@uiw/codemirror-theme-monokai-dimmed";
import { quietlight } from "@uiw/codemirror-theme-quietlight";
import { sublime } from "@uiw/codemirror-theme-sublime";
import { xcodeDark, xcodeLight } from "@uiw/codemirror-theme-xcode";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { solarizedDark, solarizedLight } from "@uiw/codemirror-theme-solarized";
import examples from "../examples";
import ScreenshotsViewer from "./ScreenshotsViewer";
import Terminal from "./Terminal";
import { API_ENDPOINTS } from "../config";
import { useAllPreferences } from "../hooks/usePreferences";
import {
  PlayIcon,
  StopIcon,
  DocumentDuplicateIcon,
  SunIcon,
  MoonIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  ArrowsPointingOutIcon,
  XMarkIcon,
  PhotoIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";

function Playground() {
  const boilerplate = `framework: puppeteer
browser: 
  mode: connect
  connect:
    wsUrl: "ws://browser:9222"
steps:
  - goto:
      url: "https://example.com"
  - screenshot:
      path: "screenshots/screenshot.png"
      fullPage: true
  - close: true`;

  const [value, setValue] = useState(() => {
    // Try to load from sessionStorage first, fallback to boilerplate
    const savedCode = sessionStorage.getItem('playground-code');
    return savedCode || boilerplate;
  });
  
  // Use preferences hook for persistent state
  const {
    isDarkMode,
    setIsDarkMode,
    selectedThemeId,
    setSelectedThemeId,
    showVNC,
    setShowVNC,
    showScreenshots,
    setShowScreenshots,
    showTerminal,
    setShowTerminal,
    isVncZoomed,
    setIsVncZoomed,
    activeTab,
    setActiveTab,
  } = useAllPreferences();


  // Ensure activeTab is always set to a valid value
  const currentActiveTab = activeTab || 'script';
  const availableThemes = useMemo(
    () => [
      { id: "dracula", label: "Dracula", theme: dracula, appearance: "dark" },
      { id: "aura", label: "Aura", theme: aura, appearance: "dark" },
      { id: "andromeda", label: "Andromeda", theme: andromeda, appearance: "dark" },
      { id: "atomone", label: "Atom One", theme: atomone, appearance: "dark" },
      { id: "bespin", label: "Bespin", theme: bespin, appearance: "dark" },
      { id: "darcula", label: "Darcula", theme: darcula, appearance: "dark" },
      { id: "monokai", label: "Monokai", theme: monokai, appearance: "dark" },
      { id: "monokaiDimmed", label: "Monokai Dimmed", theme: monokaiDimmed, appearance: "dark" },
      { id: "tokyoNight", label: "Tokyo Night", theme: tokyoNight, appearance: "dark" },
      { id: "tokyoNightStorm", label: "Tokyo Night Storm", theme: tokyoNightStorm, appearance: "dark" },
      { id: "tokyoNightDay", label: "Tokyo Night Day", theme: tokyoNightDay, appearance: "light" },
      { id: "nord", label: "Nord", theme: nord, appearance: "dark" },
      { id: "solarizedDark", label: "Solarized Dark", theme: solarizedDark, appearance: "dark" },
      { id: "solarizedLight", label: "Solarized Light", theme: solarizedLight, appearance: "light" },
      { id: "duotoneDark", label: "Duotone Dark", theme: duotoneDark, appearance: "dark" },
      { id: "duotoneLight", label: "Duotone Light", theme: duotoneLight, appearance: "light" },
      { id: "githubLight", label: "GitHub Light", theme: githubLight, appearance: "light" },
      { id: "quietlight", label: "Quiet Light", theme: quietlight, appearance: "light" },
      { id: "sublime", label: "Sublime", theme: sublime, appearance: "dark" },
      { id: "vscodeDark", label: "VSCode Dark", theme: vscodeDark, appearance: "dark" },
      { id: "vscodeLight", label: "VSCode Light", theme: vscodeLight, appearance: "light" },
      { id: "xcodeDark", label: "Xcode Dark", theme: xcodeDark, appearance: "dark" },
      { id: "xcodeLight", label: "Xcode Light", theme: xcodeLight, appearance: "light" },
    ],
    []
  );

  const selectedTheme = useMemo(
    () => availableThemes.find((item) => item.id === selectedThemeId) ?? availableThemes[0],
    [availableThemes, selectedThemeId]
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setExecutionResult] = useState(null);
  const [, setExecutionError] = useState(null);
  const [compiledCode, setCompiledCode] = useState("");


  // ESC key closes zoom
  useEffect(() => {
    if (!isVncZoomed) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsVncZoomed(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isVncZoomed, setIsVncZoomed]);

  const onChange = useCallback((val) => {
    setValue(val);
    // Save to sessionStorage for persistence
    sessionStorage.setItem('playground-code', val);
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    setExecutionResult(null);
    setExecutionError(null);

    // Auto-zoom VNC when starting execution
    if (showVNC) {
      setIsVncZoomed(true);
    }

    try {
      const response = await fetch(API_ENDPOINTS.RUN, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          Accept: "text/plain",
        },
        body: value,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const result = await response.text();
      setExecutionResult(result);
      setCompiledCode(result);
      setActiveTab("compiled"); // Switch to compiled code tab
      console.log("Script execution successful:", result);
    } catch (error) {
      console.error("Error running script:", error);
      setExecutionError(error.message);
    } finally {
      setIsRunning(false);
      // Auto-exit zoom after execution completes
      if (isVncZoomed) {
        setTimeout(() => {
          setIsVncZoomed(false);
        }, 2000); // Wait 2 seconds before exiting zoom
      }
    }
  };

  const handleStop = () => {
    setIsRunning(false);
    // TODO: Implement script stopping
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
    }
  };

  const loadExample = (example) => {
    if (examples[example]) {
      const exampleCode = examples[example];
      setValue(exampleCode);
      // Save the loaded example to sessionStorage
      sessionStorage.setItem('playground-code', exampleCode);
    }
  };

  const editorTheme = useMemo(() => selectedTheme.theme, [selectedTheme]);

  const themeClasses = isDarkMode
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    : "bg-gradient-to-br from-slate-50 via-white to-slate-100";

  const glassPanelClasses = isDarkMode
    ? "backdrop-blur-xl bg-slate-900/70 border border-slate-800/70 shadow-xl"
    : "backdrop-blur-xl bg-white/85 border border-slate-200/70 shadow-lg";

  const accentTextGradient = isDarkMode
    ? "from-sky-300 via-cyan-200 to-emerald-200"
    : "from-sky-600 via-cyan-500 to-emerald-500";

  const secondaryTextColor = isDarkMode ? "text-slate-300" : "text-slate-600";
  const tertiaryTextColor = isDarkMode ? "text-slate-400" : "text-slate-500";
  const primaryTextColor = isDarkMode ? "text-slate-100" : "text-slate-900";
  const mutedBorderColor = isDarkMode ? "border-slate-800/60" : "border-slate-200/70";
  const overlayGradient = isDarkMode
    ? "from-cyan-500/15"
    : "from-sky-400/15";
  const overlayGradientSecondary = isDarkMode
    ? "from-emerald-500/10"
    : "from-cyan-400/10";

  const backgroundGridPattern =
    "data:image/svg+xml,%3Csvg width='400' height='400' viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-opacity='0.04'%3E%3Cpath d='M20 0H0v20H20V0ZM40 0H20v20H40V0ZM60 0H40v20H60V0ZM80 0H60v20H80V0ZM100 0H80v20H100V0ZM120 0H100v20H120V0ZM140 0H120v20H140V0ZM160 0H140v20H160V0ZM180 0H160v20H180V0ZM200 0H180v20H200V0ZM220 0H200v20H220V0ZM240 0H220v20H240V0ZM260 0H240v20H260V0ZM280 0H260v20H280V0ZM300 0H280v20H300V0ZM320 0H300v20H320V0ZM340 0H320v20H340V0ZM360 0H340v20H360V0ZM380 0H360v20H380V0ZM400 0H380v20H400V0Z'/%3E%3C/g%3E%3C/svg%3E";

  return (
    <div className={`flex flex-col h-screen ${themeClasses}`}>
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial ${overlayGradient} to-transparent animate-pulse`}
        ></div>
        <div
          className={`absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial ${overlayGradientSecondary} to-transparent animate-pulse delay-1000`}
        ></div>
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{ backgroundImage: `url(${backgroundGridPattern})` }}
        ></div>
      </div>

      {/* Glass Header */}
      <div className={`relative z-10 flex items-center justify-between px-8 py-4 ${glassPanelClasses} ${primaryTextColor}`}>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">BS</span>
            </div>
            <div>
              <h1
                className={`text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent ${accentTextGradient}`}
              >
                BaseScript Playground
              </h1>
              <p className={`text-sm mt-0.5 ${secondaryTextColor}`}>
                Browser automation made simple
              </p>
            </div>
          </div>

          <div
            className={`flex items-center space-x-2 px-4 py-2 rounded-full border ${mutedBorderColor} ${glassPanelClasses} ${
              isConnected
                ? isDarkMode
                  ? "text-green-400"
                  : "text-green-600"
                : isDarkMode
                ? "text-red-400"
                : "text-red-600"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            ></div>
            <span className="text-sm font-medium">{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

          <div className="flex items-center space-x-4">
          {/* Example Scripts Dropdown */}
          <select
            onChange={(e) => loadExample(e.target.value)}
            className={`px-3 py-2.5 text-sm rounded-lg ${
              isDarkMode 
                ? "bg-slate-800/80 text-slate-200 border-slate-700" 
                : "bg-white/80 text-slate-700 border-slate-300"
            } border focus:ring-2 focus:ring-sky-500 outline-none transition-all min-w-[120px]`}
            defaultValue=""
            title="Load Example"
          >
            <option 
              value="" 
              disabled
              className={isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}
            >
              📚 Examples
            </option>
            <option 
              value="basic"
              className={isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}
            >
              🚀 Basic
            </option>
            <option 
              value="form"
              className={isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}
            >
              📝 Form
            </option>
            <option 
              value="testing"
              className={isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}
            >
              🧪 Test
            </option>
          </select>


          {/* Control Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={copyToClipboard}
              className={`p-3 rounded-lg ${glassPanelClasses} ${
                isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"
              } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              title="Copy to clipboard"
            >
              {copied ? (
                <CheckIcon className="w-5 h-5 text-green-500" />
              ) : (
                <DocumentDuplicateIcon className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setShowScreenshots(true)}
              className={`p-3 rounded-lg ${glassPanelClasses} ${
                isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"
              } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              title="View Screenshots"
            >
              <PhotoIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowTerminal(true)}
              className={`p-3 rounded-lg ${glassPanelClasses} ${
                isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"
              } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              title="Open Terminal"
            >
              <CommandLineIcon className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowVNC(!showVNC)}
              className={`p-3 rounded-lg ${glassPanelClasses} ${
                isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"
              } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              title={showVNC ? "Hide VNC" : "Show VNC"}
            >
              {showVNC ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
            </button>

            <div className={`relative group z-40 ${glassPanelClasses} rounded-lg`}>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`p-3 ${
                  isDarkMode
                    ? "text-slate-200 hover:text-sky-300"
                    : "text-slate-700 hover:text-sky-600"
                } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                title="Toggle theme"
              >
                {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {!isRunning ? (
            <button
              onClick={handleRun}
              className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-500 text-white rounded-lg hover:from-sky-500/90 hover:via-cyan-500/90 hover:to-emerald-500/90 transition-all transform hover:scale-105 active:scale-95 shadow-lg ml-2 cursor-pointer"
              title="Run Script"
            >
              <PlayIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center space-x-2 px-4 py-3 bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 text-white rounded-lg hover:from-rose-500/90 hover:via-orange-500/90 hover:to-amber-500/90 transition-all transform hover:scale-105 active:scale-95 shadow-lg ml-2 cursor-pointer"
              title="Stop"
            >
              <StopIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative z-10 p-6 gap-6">
        {/* VNC Panel */}
        {showVNC && (
          <div className={`flex-1 ${glassPanelClasses} rounded-xl overflow-hidden shadow-xl`}>
          <div className={`px-6 py-4 border-b ${isDarkMode ? "border-slate-800/60" : "border-slate-200/70"}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`text-lg font-semibold ${primaryTextColor}`}>
                  Browser Preview
                </h3>
                <p className={`text-sm mt-1 ${tertiaryTextColor}`}>
                  Live view of your automation
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setIsVncZoomed(true)}
                  className={`p-2 rounded-lg ${glassPanelClasses} ${isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"} transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
                  title="Zoom VNC"
                >
                  <ArrowsPointingOutIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
            <div className={`h-full ${isDarkMode ? "bg-slate-900/40" : "bg-white/70"} backdrop-blur-sm p-4`}>
              {!isVncZoomed && (
                <VncScreen
                url="ws://localhost:7900/websockify"
                scaleViewport
                background="rgba(0, 0, 0, 0.1)"
                style={{
                  width: "100%",
                  height: "calc(100% - 120px)",
                  borderRadius: "8px",
                  overflow: "hidden",
                }}
                rfbOptions={{
                  credentials: {
                    password: "secret",
                  },
                }}
                onConnect={() => setIsConnected(true)}
                onDisconnect={() => setIsConnected(false)}
                loadingUI={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin mb-6 mx-auto"></div>
                      <p className={`text-xl font-semibold mb-2 ${primaryTextColor}`}>
                        Establishing Connection
                      </p>
                      <p className={`text-sm ${tertiaryTextColor}`}>
                        Connecting to browser instance...
                      </p>
                    </div>
                  </div>
                }
                  debug={false}
                />
              )}
            </div>
          </div>
        )}

        {/* Editor Panel */}
        <div
          className={`${showVNC ? "flex-1" : "w-full"} flex flex-col ${glassPanelClasses} rounded-xl overflow-hidden shadow-xl`}
        >
          {/* Tab Header */}
          <div className={`px-6 py-4 border-b ${isDarkMode ? "border-slate-800/60" : "border-slate-200/70"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div>
                  <h3 className={`text-lg font-semibold ${primaryTextColor}`}>
                    Code Editor
                  </h3>
                  <p className={`text-sm mt-1 ${tertiaryTextColor}`}>
                    Write and view your automation scripts
                  </p>
                </div>
                
                {/* Tab Navigation */}
                <div className={`flex items-center space-x-1 rounded-lg p-1 ${
                  isDarkMode ? "bg-slate-800/50" : "bg-slate-200/20"
                }`}>
                  <button
                    onClick={() => setActiveTab("script")}
                    className={`p-3 rounded-md transition-all cursor-pointer ${
                      currentActiveTab === "script"
                        ? isDarkMode
                          ? "bg-slate-700 text-white shadow-sm"
                          : "bg-white text-slate-900 shadow-sm"
                        : isDarkMode
                        ? "text-slate-300 hover:text-slate-100"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Script Editor"
                  >
                    📝
                  </button>
                  <button
                    onClick={() => setActiveTab("compiled")}
                    disabled={!compiledCode}
                    className={`p-3 rounded-md transition-all relative ${
                      !compiledCode
                        ? "opacity-50 cursor-not-allowed"
                        : currentActiveTab === "compiled"
                        ? isDarkMode
                          ? "bg-slate-700 text-white shadow-sm"
                          : "bg-white text-slate-900 shadow-sm"
                        : isDarkMode
                        ? "text-slate-300 hover:text-slate-100"
                        : "text-slate-600 hover:text-slate-900"
                    } ${compiledCode ? 'cursor-pointer' : ''}`}
                    title="Compiled Code"
                  >
                    🔧
                    {compiledCode && (
                      <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                        isDarkMode ? "bg-emerald-500" : "bg-emerald-600"
                      }`}></span>
                    )}
                  </button>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div
                  className={`p-2 rounded-full ${
                    isRunning
                      ? isDarkMode
                        ? "bg-yellow-900/50 text-yellow-200"
                        : "bg-yellow-100 text-yellow-800"
                      : isDarkMode
                      ? "bg-green-900/50 text-green-200"
                      : "bg-green-100 text-green-800"
                  }`}
                  title={isRunning ? "Executing" : "Ready"}
                >
                  {isRunning ? "⚡" : "✅"}
                </div>
                <select
                  value={selectedThemeId}
                  onChange={(e) => setSelectedThemeId(e.target.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${
                    isDarkMode 
                      ? "bg-slate-800/80 text-slate-200 border-slate-700" 
                      : "bg-white/80 text-slate-700 border-slate-300"
                  } border focus:ring-2 focus:ring-sky-500 outline-none transition-all min-w-[160px]`}
                  title="Editor theme"
                >
                  {availableThemes.map((theme) => (
                    <option 
                      key={theme.id} 
                      value={theme.id}
                      className={isDarkMode ? "bg-slate-800 text-slate-200" : "bg-white text-slate-700"}
                    >
                      {theme.label} {theme.appearance === "dark" ? "(Dark)" : "(Light)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Editor Content */}
          <div className={`flex-1 overflow-hidden ${primaryTextColor}`}>
            {currentActiveTab === "script" ? (
              <div className="h-full overflow-auto">
                <CodeMirror
                  value={value}
                  height="100%"
                  extensions={[yaml()]}
                  onChange={onChange}
                  theme={editorTheme}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightSelectionMatches: false,
                  }}
                />
              </div>
            ) : (
              <div className="h-full overflow-auto relative">
                <CodeMirror
                  value={compiledCode}
                  height="auto"
                  minHeight="100%"
                  extensions={[javascript()]}
                  onChange={(val) => setCompiledCode(val)}
                  theme={editorTheme}
                  editable={true}
                  basicSetup={{
                    lineNumbers: true,
                    foldGutter: true,
                    dropCursor: false,
                    allowMultipleSelections: false,
                    indentOnInput: true,
                    bracketMatching: true,
                    closeBrackets: true,
                    autocompletion: true,
                    highlightSelectionMatches: false,
                  }}
                />
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className={`px-6 py-3 border-t ${isDarkMode ? "border-slate-800/60" : "border-slate-200/70"} text-sm ${
            isDarkMode ? "text-slate-300" : "text-slate-500"
          }`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-6">
                <span className="flex items-center space-x-1" title="Lines">
                  <span>📝</span>
                  <span>
                    {currentActiveTab === "script" 
                      ? value.split("\n").length 
                      : compiledCode.split("\n").length
                    }
                  </span>
                </span>
                <span className="flex items-center space-x-1" title="Characters">
                  <span>💭</span>
                  <span>
                    {currentActiveTab === "script" 
                      ? value.length 
                      : compiledCode.length
                    }
                  </span>
                </span>
                <span className="flex items-center space-x-1" title={currentActiveTab === "script" ? "YAML" : "JavaScript"}>
                  <span>🔧</span>
                  <span>{currentActiveTab === "script" ? "YAML" : "JS"}</span>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {isRunning && (
                  <div className="flex items-center space-x-2" title="Processing">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-lg">⚡</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

      </div>
      {/* VNC Zoom Modal */}
      {isVncZoomed && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIsVncZoomed(false)}></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className={`${glassPanelClasses} w-[92vw] h-[85vh] rounded-2xl overflow-hidden shadow-2xl relative`}>
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isDarkMode ? "border-slate-800/60" : "border-slate-200/70"}`}>
                <h3 className={`text-lg font-semibold ${primaryTextColor}`}>VNC Zoom</h3>
                <button
                  onClick={() => setIsVncZoomed(false)}
                  className={`p-2 rounded-lg ${glassPanelClasses} ${isDarkMode ? "text-slate-300 hover:text-sky-300" : "text-slate-600 hover:text-sky-600"} cursor-pointer`}
                  title="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className={`${isDarkMode ? "bg-slate-900/40" : "bg-white/70"} backdrop-blur-sm w-full h-[calc(100%-48px)] p-3`}>
                <VncScreen
                  url="ws://localhost:7900/websockify"
                  scaleViewport
                  background="rgba(0, 0, 0, 0.1)"
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "10px",
                    overflow: "hidden",
                  }}
                  rfbOptions={{
                    credentials: { password: "secret" },
                  }}
                  onConnect={() => setIsConnected(true)}
                  onDisconnect={() => setIsConnected(false)}
                  loadingUI={
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin mb-6 mx-auto"></div>
                        <p className={`text-xl font-semibold mb-2 ${primaryTextColor}`}>Establishing Connection</p>
                        <p className={`text-sm ${tertiaryTextColor}`}>Connecting to browser instance...</p>
                      </div>
                    </div>
                  }
                  debug={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshots Viewer Modal */}
      <ScreenshotsViewer
        isOpen={showScreenshots}
        onClose={() => setShowScreenshots(false)}
        isDarkMode={isDarkMode}
      />

      {/* Terminal Modal */}
      <Terminal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default Playground;

