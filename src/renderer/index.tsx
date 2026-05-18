import React from "react";
import { createRoot } from "react-dom/client";
import ReactDOM from "react-dom";

const { ipcRenderer, shell } = window.require
  ? window.require("electron")
  : (window as any).electron;

const SPOTLIGHT_WIDTH = 128;
const SPOTLIGHT_BAR_HEIGHT = 64;

function PlusIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#222"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function ArrowIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#222"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// At the top level, before SpotlightApp definition, ensure modal-root exists
if (typeof window !== "undefined" && !document.getElementById("modal-root")) {
  const modalRoot = document.createElement("div");
  modalRoot.id = "modal-root";
  document.body.appendChild(modalRoot);
}

const SpotlightApp = () => {
  console.log("SpotlightApp render");
  const [input, setInput] = React.useState("");
  const [result, setResult] = React.useState<string | null>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [highlightedFile, setHighlightedFile] = React.useState<string | null>(
    null
  );
  // Remove showModal, modalPos, modalSize, dragging, dragStart, resizeStart, resizing, and all modal handlers/effects

  let fileInputEl: HTMLInputElement | null = null;
  let folderInputEl: HTMLInputElement | null = null;

  const handleSubmit = async (e?: React.FormEvent) => {
    console.log("handleSubmit called", { input, selectedFile });
    if (e) e.preventDefault();
    if (!input.trim() && !selectedFile) return;
    setShowDropdown(false);
    let res = await ipcRenderer.invoke("user-query", {
      query: input,
      file: selectedFile,
    });
    setResult(res.result);
    console.log("setResult called", res.result);
    setShowDropdown(true); // keep for legacy, but not used for modal
  };

  const handleBrowseFile = () => {
    if (fileInputEl) {
      fileInputEl.value = "";
      fileInputEl.click();
    }
  };
  const handleBrowseFolder = () => {
    if (folderInputEl) {
      folderInputEl.value = "";
      folderInputEl.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file.path || file.name);
      setHighlightedFile(file.path || file.name);
    }
  };
  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file.path || file.name);
      setHighlightedFile(file.path || file.name);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setHighlightedFile(null);
    if (fileInputEl) fileInputEl.value = "";
  };

  // Add summarize handler
  const handleSummarize = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile) return;
    setShowDropdown(false);
    // Send a summarization request with the file
    let res = await ipcRenderer.invoke("user-query", {
      query: "summarize this file",
      file: selectedFile,
    });
    setResult(res.result);
    setShowDropdown(true);
  };

  // Helper: detect if result is a file list (semantic search)
  function parseFileList(result: string | null) {
    if (!result) return null;
    // crude: if result has numbered lines, treat as file list
    const lines = result.split(/\n+/).filter(Boolean);
    if (lines.length > 1 && /^1\./.test(lines[0])) {
      // group every 3 lines (file, path, score)
      const files = [];
      for (let i = 0; i < lines.length; i += 3) {
        files.push({
          name: lines[i]?.replace(/^\d+\.\s*/, "") || "",
          path: lines[i + 1]?.replace(/^Path:\s*/, "") || "",
          score: lines[i + 2]?.replace(/^Score:\s*/, "") || "",
        });
      }
      return files;
    }
    return null;
  }

  const fileList = parseFileList(result);

  // Open file in OS
  const handleOpenFile = (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (shell && shell.openPath) {
      shell.openPath(filePath);
    }
    // No fallback to window.electron to avoid linter errors
  };

  // When a file row is clicked, highlight and set as selected
  const handleFileRowClick = (file: any) => {
    setHighlightedFile(file.path);
    setSelectedFile(file.path);
  };

  // Debug: log dropdown state before rendering
  console.log("render dropdown", { showDropdown, result });
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f0f0f0",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: "12vh",
      }}
    >
      {/* Spotlight Bar */}
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
          width: 520,
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          zIndex: 100,
          padding: "0 18px",
          marginBottom: 32,
        }}
      >
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", alignItems: "center", width: "100%" }}
        >
          {/* File tag/chip if selected */}
          {selectedFile && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                background: "#f3f3f3",
                borderRadius: 10,
                padding: "4px 12px",
                marginRight: 10,
                fontSize: 16,
                fontWeight: 500,
                color: "#333",
                maxWidth: 200,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedFile.split(/[\\/]/).pop()}
              <button
                onClick={handleClearFile}
                style={{
                  marginLeft: 8,
                  background: "none",
                  border: "none",
                  color: "#007aff",
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: 700,
                  verticalAlign: "middle",
                }}
                title="Clear file"
                type="button"
              >
                ×
              </button>
            </span>
          )}
          <input
            type="text"
            placeholder={
              selectedFile ? "Ask about this file..." : "Ask something..."
            }
            style={{
              flex: 1,
              fontSize: 22,
              padding: "12px 16px",
              borderRadius: 14,
              border: "1.5px solid #e0e0e0",
              outline: "none",
              background: "#fafbfc",
              fontFamily: "inherit",
              marginRight: 12,
            }}
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="button"
            onClick={handleBrowseFile}
            style={{
              marginRight: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
            title="Add file"
          >
            <PlusIcon /> File
          </button>
          <button
            type="button"
            onClick={handleBrowseFolder}
            style={{
              marginRight: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
            title="Add folder"
          >
            <PlusIcon /> Folder
          </button>
          {selectedFile && (
            <button
              type="button"
              onClick={handleSummarize}
              style={{
                marginRight: 10,
                background: "#f7f7f7",
                border: "1.5px solid #e0e0e0",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                padding: "6px 14px",
                fontSize: 16,
                fontWeight: 500,
                color: "#333",
              }}
              title="Summarize file"
            >
              Summarize
            </button>
          )}
          <button
            type="submit"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: 0,
            }}
            title="Enter"
          >
            <ArrowIcon />
          </button>
        </form>
        <input
          type="file"
          ref={(el) => {
            fileInputEl = el;
          }}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <input
          type="file"
          ref={(el) => {
            folderInputEl = el;
            if (el) {
              el.setAttribute("webkitdirectory", "");
              el.setAttribute("directory", "");
            }
          }}
          style={{ display: "none" }}
          onChange={handleFolderChange}
        />
      </div>
      {/* Results/Answers Box */}
      {showDropdown && result && (
        <div
          style={{
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
            width: 520,
            marginTop: 0,
            fontSize: 20,
            color: "#222",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            zIndex: 99,
            overflowY: "auto",
            borderTop: "1.5px solid #eee",
            padding: "24px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minHeight: 64,
          }}
        >
          {fileList ? (
            fileList.map((file, idx) => (
              <div
                key={idx}
                style={{
                  padding: "14px 24px",
                  borderBottom:
                    idx !== fileList.length - 1
                      ? "1px solid #f0f0f0"
                      : undefined,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  background:
                    highlightedFile === file.path ? "#e6f0ff" : "transparent",
                }}
                title={file.path}
                onClick={() => handleFileRowClick(file)}
              >
                <div style={{ fontWeight: 500 }}>{file.name}</div>
                <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                  <span
                    style={{
                      textDecoration: "underline",
                      color: "#007aff",
                      cursor: "pointer",
                    }}
                    onClick={(e) => handleOpenFile(file.path, e)}
                  >
                    {file.path}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                  {file.score}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontFamily: "inherit" }}>{result}</div>
          )}
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<SpotlightApp />);
