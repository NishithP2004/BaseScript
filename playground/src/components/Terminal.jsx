import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  TrashIcon, 
  ArrowDownIcon, 
  ArrowUpIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLock,
  faLockOpen,
  faFlagCheckered,
  faPaperPlane,
  faTerminal,
  faCircleExclamation,
  faCircleCheck,
  faBroom
} from '@fortawesome/free-solid-svg-icons';

// Global socket instance for persistent connection
let globalSocket = null;
let socketListeners = new Map();

// Initialize global socket connection
const initializeSocket = () => {
  if (!globalSocket) {
    console.log('Terminal: Initializing global socket connection...');
    globalSocket = io(window.location.href, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: "/api/socket.io"
    });

    globalSocket.on('connect', () => {
      console.log('Terminal: Global socket connected');
      // Notify all listeners
      if (socketListeners.has('connect')) {
        socketListeners.get('connect').forEach(callback => callback());
      }
    });

    globalSocket.on('disconnect', (reason) => {
      console.log('Terminal: Global socket disconnected:', reason);
      // Notify all listeners
      if (socketListeners.has('disconnect')) {
        socketListeners.get('disconnect').forEach(callback => callback(reason));
      }
    });

    // Forward all other events to listeners
    globalSocket.onAny((eventName, ...args) => {
      if (socketListeners.has(eventName)) {
        socketListeners.get(eventName).forEach(callback => {
          try {
            callback(...args);
          } catch (error) {
            console.error('Terminal: Error in socket listener:', error);
          }
        });
      }
    });
  }
  return globalSocket;
};

// Add listener to global socket
const addSocketListener = (event, callback) => {
  if (!socketListeners.has(event)) {
    socketListeners.set(event, new Set());
  }
  socketListeners.get(event).add(callback);
};

// Remove listener from global socket
const removeSocketListener = (event, callback) => {
  if (socketListeners.has(event)) {
    socketListeners.get(event).delete(callback);
  }
};

const Terminal = ({ isDarkMode, isOpen, onClose }) => {
  const [output, setOutput] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const terminalRef = useRef(null);

  // Initialize persistent Socket.IO connection
  useEffect(() => {
    // Initialize global socket if not already done
    const socket = initializeSocket();
    
    // Set initial connection status
    setIsConnected(socket.connected);

    // Define event handlers
    const handleConnect = () => {
      console.log('Terminal: Connected to server');
      setIsConnected(true);
    };

    const handleDisconnect = (reason) => {
      console.log('Terminal: Disconnected from server:', reason);
      setIsConnected(false);
    };

    const handleOutput = (data) => {
      const timestamp = new Date().toLocaleTimeString();
      setOutput(prev => [...prev, {
        id: Date.now() + Math.random(),
        content: data.toString(),
        timestamp,
        type: 'output'
      }]);
    };

    const handleError = (data) => {
      const timestamp = new Date().toLocaleTimeString();
      setOutput(prev => [...prev, {
        id: Date.now() + Math.random(),
        content: data.toString(),
        timestamp,
        type: 'error'
      }]);
    };

    const handleExit = (data) => {
      const timestamp = new Date().toLocaleTimeString();
      setOutput(prev => [...prev, {
        id: Date.now() + Math.random(),
        content: `Process exited with code: ${data.code}`,
        timestamp,
        type: 'exit'
      }]);
      setIsRunning(false);
    };

    // Add listeners to global socket
    addSocketListener('connect', handleConnect);
    addSocketListener('disconnect', handleDisconnect);
    addSocketListener('output', handleOutput);
    addSocketListener('error-stream', handleError);
    addSocketListener('process-exit', handleExit);

    // Cleanup listeners when component unmounts
    return () => {
      removeSocketListener('connect', handleConnect);
      removeSocketListener('disconnect', handleDisconnect);
      removeSocketListener('output', handleOutput);
      removeSocketListener('error-stream', handleError);
      removeSocketListener('process-exit', handleExit);
    };
  }, []); // Empty dependency array - only run once

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (isAutoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output, isAutoScroll]);

  const clearTerminal = () => {
    setOutput([]);
  };

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const scrollToTop = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = 0;
    }
  };

  const formatOutput = (content) => {
    // Handle ANSI escape codes for colors
    /* eslint-disable no-control-regex */
    return content
      .replace(/\x1b\[31m/g, '<span class="text-red-400">') // Red
      .replace(/\x1b\[32m/g, '<span class="text-green-400">') // Green
      .replace(/\x1b\[33m/g, '<span class="text-yellow-400">') // Yellow
      .replace(/\x1b\[34m/g, '<span class="text-blue-400">') // Blue
      .replace(/\x1b\[35m/g, '<span class="text-purple-400">') // Magenta
      .replace(/\x1b\[36m/g, '<span class="text-cyan-400">') // Cyan
      .replace(/\x1b\[37m/g, '<span class="text-gray-300">') // White
      .replace(/\x1b\[0m/g, '</span>') // Reset
      .replace(/\x1b\[1m/g, '<span class="font-bold">') // Bold
      .replace(/\x1b\[4m/g, '<span class="underline">') // Underline
      .replace(/\n/g, '<br/>');
    /* eslint-enable no-control-regex */
  };

  const getOutputTypeStyles = (type) => {
    switch (type) {
      case 'error':
        return isDarkMode ? 'text-red-400' : 'text-red-600';
      case 'exit':
        return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
      default:
        return isDarkMode ? 'text-green-400' : 'text-green-600';
    }
  };

  const primaryTextColor = isDarkMode ? "text-slate-100" : "text-slate-900";
  const tertiaryTextColor = isDarkMode ? "text-slate-400" : "text-slate-500";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 app-modal-backdrop" onClick={onClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className={`${isDarkMode ? "app-modal-dark" : "app-modal-light"} w-[min(1180px,94vw)] h-[78vh] rounded-2xl overflow-hidden relative flex flex-col`}>
          {/* Terminal Header */}
          <div className={`flex items-center justify-between gap-4 px-5 py-4 border-b shrink-0 ${isDarkMode ? "border-indigo-500/20" : "border-slate-200/70"}`}>
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-400/25 flex items-center justify-center text-cyan-300">
                <FontAwesomeIcon icon={faTerminal} />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${primaryTextColor}`}>
                  Terminal Output
                </h3>
                <p className={`text-sm ${tertiaryTextColor}`}>
                  Live process output stream
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm ${
                isConnected 
                  ? isDarkMode ? "bg-green-900/50 text-green-200" : "bg-green-100 text-green-800"
                  : isDarkMode ? "bg-red-900/50 text-red-200" : "bg-red-100 text-red-800"
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                <span>{isConnected ? "Connected" : "Disconnected"}</span>
              </div>

              {/* Terminal Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={clearTerminal}
                  className="icon-button hover:!text-rose-300"
                  title="Clear Terminal"
                >
                  <FontAwesomeIcon icon={faBroom} />
                </button>
                
                <button
                  onClick={scrollToTop}
                  className="icon-button"
                  title="Scroll to Top"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
                
                <button
                  onClick={scrollToBottom}
                  className="icon-button"
                  title="Scroll to Bottom"
                >
                  <ArrowDownIcon className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsAutoScroll(!isAutoScroll)}
                  className={`icon-button ${isAutoScroll ? "!text-emerald-300 !border-emerald-500/40" : ""}`}
                  title={isAutoScroll ? "Auto-scroll On" : "Auto-scroll Off"}
                >
                  <FontAwesomeIcon icon={isAutoScroll ? faLock : faLockOpen} />
                </button>

                <button
                  onClick={onClose}
                  className="icon-button hover:!text-rose-300"
                  title="Close Terminal"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Terminal Body */}
          <div className={`flex-1 min-h-0 ${isDarkMode ? "bg-[#030611]" : "bg-slate-50"} p-3`}>
            <div 
              ref={terminalRef}
              data-testid="terminal-scroll-region"
              className={`terminal-scroll h-full overflow-y-auto rounded-xl border p-2 font-mono text-[13px] ${
                isDarkMode ? "text-green-400" : "text-green-600"
              } ${isDarkMode ? "border-slate-800/80 bg-slate-950/70" : "border-slate-200 bg-white"} leading-relaxed`}
              style={{ 
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                lineHeight: '1.5'
              }}
            >
              {output.length === 0 ? (
                <div className={`flex items-center justify-center h-full ${tertiaryTextColor}`}>
                  <div className="text-center">
                    <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto mb-5 text-2xl ${isDarkMode ? "bg-slate-900 border-slate-800 text-cyan-300" : "bg-blue-50 border-blue-100 text-blue-600"}`}>
                      <FontAwesomeIcon icon={faTerminal} />
                    </div>
                    <p className="text-lg font-medium mb-2">Terminal Ready</p>
                    <p className="text-sm">Waiting for process output...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {output.map((line) => (
                    <div
                      key={line.id} 
                      className={`group grid grid-cols-[74px_22px_1fr] gap-2 items-start px-3 py-2 rounded-lg border border-transparent ${isDarkMode ? "hover:border-slate-700/50 hover:bg-slate-900/70" : "hover:border-slate-200 hover:bg-slate-50"} ${
                        line.type === 'error' 
                          ? isDarkMode ? "bg-red-900/20" : "bg-red-50"
                          : line.type === 'exit'
                          ? isDarkMode ? "bg-yellow-900/20" : "bg-yellow-50"
                          : ""
                      }`}
                    >
                      <span className={`text-xs ${tertiaryTextColor} mt-0.5 flex-shrink-0`}>
                        {line.timestamp}
                      </span>
                      <span className={`text-xs ${getOutputTypeStyles(line.type)} flex-shrink-0 text-center`}>
                        <FontAwesomeIcon icon={line.type === 'error' ? faCircleExclamation : line.type === 'exit' ? faFlagCheckered : line.content.toLowerCase().includes('success') ? faCircleCheck : faPaperPlane} />
                      </span>
                      <div 
                        className="flex-1 break-words"
                        dangerouslySetInnerHTML={{ 
                          __html: formatOutput(line.content) 
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Terminal Footer */}
          <div className={`px-5 py-3 border-t shrink-0 ${isDarkMode ? "border-indigo-500/20 bg-slate-950/45" : "border-slate-200/70"} text-xs ${tertiaryTextColor}`}>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <span>Lines: {output.length}</span>
                <span>Status: {isRunning ? "Running" : "Idle"}</span>
                <span>Auto-scroll: {isAutoScroll ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Socket.IO</span>
                <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terminal;

