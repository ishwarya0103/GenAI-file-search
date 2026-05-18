# GenAI File System Search
AI-powered Spotlight alternative for macOS and Windows

fsAI is an intelligent file system assistant that provides semantic search, Q&A capabilities, and natural language file operations. Think of it as Mac's Spotlight, but with AI superpowers.

## Features

-  **Semantic Search** - Find files by meaning, not just filename
-  **Q&A** - Ask questions about your files and get AI-powered answers
-  **File Operations** - Perform file operations using natural language
-  **Multi-format Support** - Works with PDFs, text files, code, and more
-  **Real-time Indexing** - Automatically indexes files as you work
-  **Global Hotkey** - Quick access with Alt+L (Option+L on Mac)

## Prerequisites

Before running fsAI, you need to install and configure the following services:

### 1. Node.js
```bash
# Install Node.js (if not already installed)
brew install node  # macOS
# or download from https://nodejs.org
```

### 2. Ollama (Local LLM)
```bash
# Install Ollama
brew install ollama

# Start Ollama service
ollama serve

# In another terminal, pull required models
ollama pull llama3.2:latest
ollama pull mxbai-embed-large:latest
```

### 3. Qdrant (Vector Database)
```bash
# Install Docker (if not already installed)
brew install docker

# Start Qdrant using Docker
docker run -d -p 6333:6333 -p 6334:6334 --name qdrant qdrant/qdrant
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd fsAI
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile TypeScript**
   ```bash
   npx tsc
   ```

4. **Run the application**
   ```bash
   npm run dev
   ```

## Usage

### Global Hotkey
- **macOS**: Press `Option+L` to open fsAI
- **Windows**: Press `Alt+L` to open fsAI

### Supported Operations

#### 1. Semantic Search
Type natural language queries to find files:
- "find documents about machine learning"
- "show me Python files"
- "search for presentation slides"

#### 2. Q&A
Ask questions about your files:
- **With selected file**: Select a file using the File button, then ask: "what is this document about?"
- **Semantic Q&A**: Ask questions without selecting files: "when is my flight to Kentucky?" or "what's the total amount on my receipt?"
- Get AI-powered answers based on file content

#### 3. File Operations
Perform file operations using natural language:
- "delete this file"
- "move this to desktop"
- "rename this to newname.txt"
- "zip this folder"

### File Format Support
- **Documents**: PDF, TXT, MD
- **Code**: JS, TS, PY, Java
- **More formats can be added by modifying `SUPPORTED_EXTS` in `src/ai/indexer.ts`**

## Configuration

### Change Watched Directory
By default, fsAI monitors your Documents folder. To change this:

1. Edit `src/main/index.ts`
2. Modify line 78:
   ```typescript
   startFileWatcher(path.join(os.homedir(), 'Documents')); // Change 'Documents' to your preferred folder
   ```
3. Recompile: `npx tsc`

### Add More File Types
1. Edit `src/ai/indexer.ts`
2. Add extensions to the `SUPPORTED_EXTS` array:
   ```typescript
   const SUPPORTED_EXTS = ['.pdf', '.txt', '.md', '.js', '.ts', '.py', '.java', '.docx', '.xlsx'];
   ```

## Troubleshooting

### Services Not Running
- **Ollama**: Check if `ollama serve` is running and models are downloaded
- **Qdrant**: Verify Docker container is running with `docker ps`
- **Port conflicts**: Ensure ports 6333 (Qdrant) and 11434 (Ollama) are available

### Application Issues
- **Hotkey not working**: Check if another application is using Alt+L/Option+L
- **No search results**: Ensure files are being indexed (check terminal logs)
- **Build errors**: Run `npx tsc` to check for TypeScript compilation errors

### Performance
- **Slow indexing**: Large files may take time to process
- **Memory usage**: Ollama models require significant RAM (3GB+ for llama3.2)

## Development

### Project Structure
```
fsAI/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React frontend
│   ├── ai/            # AI services (Ollama, Qdrant)
│   └── types/         # TypeScript definitions
├── dist/              # Compiled output
└── package.json       # Dependencies and scripts
```

### Available Scripts
- `npm run dev` - Start development mode
- `npm run build` - Build for production
- `npx tsc` - Compile TypeScript only

