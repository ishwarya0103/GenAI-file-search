import chokidar from 'chokidar';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import * as glob from 'glob';
import { v5 as uuidv5 } from 'uuid';
import { getOllamaEmbedding } from './llm';
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // constant namespace for deterministic UUIDs

const QDRANT_URL = 'http://127.0.0.1:6333';
const COLLECTION = 'files';
const SUPPORTED_EXTS = ['.pdf', '.txt', '.md', '.js', '.ts', '.py', '.java'];
const failedFiles = new Set<string>();

// --- Ensure Collection Exists ---
async function ensureCollection() {
  try {
    console.log('ensureCollection: trying to create collection if not exists');
    await axios.put(`${QDRANT_URL}/collections/${COLLECTION}`, {
      vectors: { size: 1024, distance: 'Cosine' }
    });
    console.log('ensureCollection: collection ensured');
  } catch (e) {
    console.error('Error ensuring collection:', e);
  }
}

// --- Embedding Placeholder ---
function fakeEmbedding(text: string): number[] {
  return Array(384).fill(0).map((_, i) => (text.charCodeAt(i % text.length) % 10) / 10);
}

// --- Text Extraction ---
async function extractText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (!SUPPORTED_EXTS.includes(ext)) return '';
  if (ext === '.pdf') {
    try {
      const data = await pdfParse(fs.readFileSync(filePath));
      return data.text;
    } catch (e) {
      console.warn('PDF parse failed for', filePath, e);
      failedFiles.add(filePath);
      return '';
    }
  } else {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
      console.warn('Text file read failed for', filePath, e);
      failedFiles.add(filePath);
      return '';
    }
  }
}

// --- Qdrant Upsert/Delete ---
async function upsertFile(filePath: string) {
  if (failedFiles.has(filePath)) return;
  try {
    const text = await extractText(filePath);
    if (!text.trim()) {
      console.log('No text extracted from', filePath);
      return;
    }
    const embedding = await getOllamaEmbedding(text); // Use real embedding
    const pointId = uuidv5(filePath, UUID_NAMESPACE);
    console.log('Upserting to Qdrant:', filePath, 'with pointId:', pointId);
    const response = await axios.put(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
      points: [
        {
          id: pointId,
          vector: embedding,
          payload: {
            path: filePath,
            name: path.basename(filePath),
            ext: path.extname(filePath),
          },
        },
      ],
    });
    console.log('Upserted:', filePath, 'Response:', response.data);
  } catch (e) {
    const err = e as any;
    if (err && err.response) {
      console.error('Failed to upsert', filePath, 'Qdrant response:', err.response.data);
    } else {
      console.error('Failed to upsert', filePath, err);
    }
    failedFiles.add(filePath);
  }
}

async function deleteFile(filePath: string) {
  failedFiles.delete(filePath);
  try {
    console.log('Deleting from Qdrant:', filePath);
    await axios.post(`${QDRANT_URL}/collections/${COLLECTION}/points/delete`, {
      points: [filePath]
    });
    console.log('Deleted from Qdrant:', filePath);
  } catch (e) {
    console.error('Failed to delete', filePath, e);
  }
}

// Add this function to index all existing files before starting the watcher
async function indexExistingFiles(targetDir: string) {
  const pattern = `${targetDir.replace(/\\/g, '/')}/**/*.{pdf,txt,md,js,ts,py,java}`;
  const files = glob.sync(pattern, { nodir: true });
  for (const file of files) {
    await upsertFile(file);
  }
}

/**
 * Perform a semantic search in Qdrant for the given query string.
 * @param query The user's search query
 * @param topK Number of results to return
 * @returns Array of { path, name, ext, score }
 */
export async function semanticSearch(query: string, topK = 5) {
  const embedding = await getOllamaEmbedding(query); // Use real embedding
  const response = await axios.post(`${QDRANT_URL}/collections/${COLLECTION}/points/search`, {
    vector: embedding,
    limit: topK,
    with_payload: true
  });
  // Each result: { id, score, payload: { path, name, ext } }
  return response.data.result.map((item: any) => ({
    path: item.payload?.path,
    name: item.payload?.name,
    ext: item.payload?.ext,
    score: item.score
  }));
}

// --- File Watcher ---
export async function startFileWatcher(targetDir: string) {
  console.log('startFileWatcher called for', targetDir);
  await ensureCollection();
  console.log('ensureCollection finished');
  // Index all existing files before starting the watcher
  await indexExistingFiles(targetDir);
  console.log('Initial indexing complete');
  const watcher = chokidar.watch(targetDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false,
    depth: 10,
    awaitWriteFinish: true,
  });

  watcher
    .on('add', async filePath => {
      if (SUPPORTED_EXTS.includes(path.extname(filePath).toLowerCase())) {
        console.log('File added:', filePath);
        await upsertFile(filePath);
      }
    })
    .on('change', async filePath => {
      if (SUPPORTED_EXTS.includes(path.extname(filePath).toLowerCase())) {
        console.log('File changed:', filePath);
        await upsertFile(filePath);
      }
    })
    .on('unlink', async filePath => {
      if (SUPPORTED_EXTS.includes(path.extname(filePath).toLowerCase())) {
        console.log('File deleted:', filePath);
        await deleteFile(filePath);
      }
    });

  console.log('Watching for file changes in', targetDir);
} 