import { useState, useEffect } from "react";
import {
  PhotoIcon,
  ArrowDownTrayIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { API_ENDPOINTS } from "../config";

function ScreenshotsViewer({ isOpen, onClose, isDarkMode }) {
  const [screenshots, setScreenshots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const glassPanelClasses = isDarkMode
    ? "backdrop-blur-xl bg-slate-900/70 border border-slate-800/70 shadow-xl"
    : "backdrop-blur-xl bg-white/85 border border-slate-200/70 shadow-lg";

  const primaryTextColor = isDarkMode ? "text-slate-100" : "text-slate-900";
  const secondaryTextColor = isDarkMode ? "text-slate-300" : "text-slate-600";
  const tertiaryTextColor = isDarkMode ? "text-slate-400" : "text-slate-500";

  const fetchScreenshots = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ENDPOINTS.SCREENSHOTS);
      if (!response.ok) {
        throw new Error(`Failed to fetch screenshots: ${response.status}`);
      }
      const data = await response.json();
      setScreenshots(data.files || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchScreenshots();
    }
  }, [isOpen]);

  const downloadScreenshot = (filename) => {
    const link = document.createElement("a");
    link.href = API_ENDPOINTS.SCREENSHOT_FILE(filename);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteScreenshot = async (filename) => {
    setDeleting(true);
    try {
      const response = await fetch(API_ENDPOINTS.DELETE_SCREENSHOT(filename), {
        method: "DELETE",
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete screenshot: ${response.status}`);
      }
      
      // Remove from local state
      setScreenshots(prev => prev.filter(file => file !== filename));
      
      // Close preview if it was the deleted image
      if (selectedImage === filename) {
        setSelectedImage(null);
      }
      
      // Close confirmation dialog
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting screenshot:", err);
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteClick = (filename, e) => {
    e.stopPropagation();
    setDeleteConfirm(filename);
  };

  const filteredScreenshots = screenshots.filter((filename) =>
    filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          className={`${glassPanelClasses} w-[90vw] h-[85vh] rounded-2xl overflow-hidden shadow-2xl relative`}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b ${
              isDarkMode ? "border-slate-800/60" : "border-slate-200/70"
            }`}
          >
            <div className="flex items-center space-x-3">
              <PhotoIcon className="w-6 h-6 text-sky-500" />
              <h3 className={`text-xl font-semibold ${primaryTextColor}`}>
                Screenshots Gallery
              </h3>
              <span
                className={`px-2 py-1 text-xs rounded-full ${
                  isDarkMode
                    ? "bg-slate-800 text-slate-300"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {screenshots.length} files
              </span>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${glassPanelClasses} ${
                isDarkMode
                  ? "text-slate-300 hover:text-sky-300"
                  : "text-slate-600 hover:text-sky-600"
              } transition-all transform hover:scale-105 active:scale-95 cursor-pointer`}
              title="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-6 py-4">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search screenshots..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-lg ${glassPanelClasses} ${
                  isDarkMode
                    ? "text-slate-200 placeholder-slate-400"
                    : "text-slate-700 placeholder-slate-500"
                } focus:ring-2 focus:ring-sky-500 outline-none transition-all`}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden px-6 pb-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-4 border-sky-500/20 border-t-sky-500 animate-spin mb-4 mx-auto"></div>
                  <p className={`text-lg font-medium ${primaryTextColor}`}>
                    Loading screenshots...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
                    <XMarkIcon className="w-8 h-8 text-red-500" />
                  </div>
                  <p className={`text-lg font-medium ${primaryTextColor} mb-2`}>
                    Error loading screenshots
                  </p>
                  <p className={`text-sm ${tertiaryTextColor} mb-4`}>{error}</p>
                  <button
                    onClick={fetchScreenshots}
                    className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-all cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : filteredScreenshots.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <PhotoIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className={`text-lg font-medium ${primaryTextColor} mb-2`}>
                    {searchTerm ? "No screenshots found" : "No screenshots available"}
                  </p>
                  <p className={`text-sm ${tertiaryTextColor}`}>
                    {searchTerm
                      ? "Try adjusting your search terms"
                      : "Run a script with screenshot steps to generate screenshots"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto h-full">
                {filteredScreenshots.map((filename) => (
                  <div
                    key={filename}
                    className={`${glassPanelClasses} rounded-lg overflow-hidden group cursor-pointer transition-all transform hover:scale-105`}
                    onClick={() => setSelectedImage(filename)}
                  >
                    <div className="aspect-square relative">
                      <img
                        src={API_ENDPOINTS.SCREENSHOT_FILE(filename)}
                        alt={filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                      <div
                        className="absolute inset-0 bg-slate-200 flex items-center justify-center hidden"
                        style={{ display: "none" }}
                      >
                        <PhotoIcon className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadScreenshot(filename);
                          }}
                          className="p-2 bg-white/20 backdrop-blur-sm rounded-full text-white hover:bg-white/30 transition-all cursor-pointer"
                          title="Download"
                        >
                          <ArrowDownTrayIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(filename, e)}
                          className="p-2 bg-red-500/80 backdrop-blur-sm rounded-full text-white hover:bg-red-600/90 transition-all cursor-pointer"
                          title="Delete"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <p
                        className={`text-sm font-medium ${primaryTextColor} truncate`}
                        title={filename}
                      >
                        {filename}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-60">
          <div
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedImage(null)}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className={`${glassPanelClasses} max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden`}>
              <div
                className={`flex items-center justify-between px-4 py-3 border-b ${
                  isDarkMode ? "border-slate-800/60" : "border-slate-200/70"
                }`}
              >
                <h3 className={`text-lg font-semibold ${primaryTextColor}`}>
                  {selectedImage}
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => downloadScreenshot(selectedImage)}
                    className={`p-2 rounded-lg ${glassPanelClasses} ${
                      isDarkMode
                        ? "text-slate-300 hover:text-sky-300"
                        : "text-slate-600 hover:text-sky-600"
                    } transition-all cursor-pointer`}
                    title="Download"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(selectedImage)}
                    className={`p-2 rounded-lg ${glassPanelClasses} ${
                      isDarkMode
                        ? "text-red-300 hover:text-red-200"
                        : "text-red-600 hover:text-red-700"
                    } transition-all cursor-pointer`}
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className={`p-2 rounded-lg ${glassPanelClasses} ${
                      isDarkMode
                        ? "text-slate-300 hover:text-sky-300"
                        : "text-slate-600 hover:text-sky-600"
                    } transition-all cursor-pointer`}
                    title="Close"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <img
                  src={API_ENDPOINTS.SCREENSHOT_FILE(selectedImage)}
                  alt={selectedImage}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-70">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDeleteConfirm(null)}
          ></div>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className={`${glassPanelClasses} max-w-md w-full rounded-2xl overflow-hidden shadow-2xl`}
            >
              <div
                className={`px-6 py-4 border-b ${
                  isDarkMode ? "border-slate-800/60" : "border-slate-200/70"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                    <TrashIcon className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${primaryTextColor}`}>
                      Delete Screenshot
                    </h3>
                    <p className={`text-sm ${tertiaryTextColor}`}>
                      This action cannot be undone
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="px-6 py-4">
                <p className={`text-sm ${secondaryTextColor} mb-2`}>
                  Are you sure you want to delete:
                </p>
                <p className={`font-medium ${primaryTextColor} mb-4 break-all`}>
                  {deleteConfirm}
                </p>
                
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className={`px-4 py-2 rounded-lg ${
                      isDarkMode
                        ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                        : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    } transition-all cursor-pointer`}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteScreenshot(deleteConfirm)}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center space-x-2"
                  >
                    {deleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4" />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ScreenshotsViewer;
