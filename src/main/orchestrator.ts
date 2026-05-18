import { queryOllama } from '../ai/llm';
import { semanticSearch } from '../ai/indexer';
import fs from 'fs';
import path from 'path';
import pdfParse from 'pdf-parse';
import archiver from 'archiver';

export type QueryType = 'semantic_search' | 'qa' | 'summarization' | 'file_operation';

export interface OrchestratorResult {
  type: QueryType;
  result: string;
}

// Enhanced keyword-based classifier for better Q&A detection
export function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase();
  
  // File operations
  if (q.includes('zip') || q.includes('move') || q.includes('delete') || q.includes('rename')) return 'file_operation';
  
  // Summarization
  if (q.includes('summarize') || q.includes('summary')) return 'summarization';
  
  // Q&A questions - more comprehensive detection
  const qaKeywords = [
    'when', 'where', 'who', 'what', 'how', 'why', 'which', 'whom',
    'is my', 'are my', 'do i have', 'does my', 'can i', 'will i',
    'flight', 'payment', 'receipt', 'confirmation', 'date', 'time',
    'amount', 'price', 'cost', 'total', 'departure', 'arrival',
    'booking', 'reservation', 'ticket', 'order', 'purchase'
  ];
  
  if (qaKeywords.some(keyword => q.includes(keyword))) return 'qa';
  
  // General search terms
  if (q.includes('find') || q.includes('search') || q.includes('show me') || q.includes('list')) return 'semantic_search';
  
  // Default to Q&A for natural language questions
  if (q.includes('?') || q.endsWith('?') || q.includes('tell me') || q.includes('explain')) return 'qa';
  
  // Default to semantic search
  return 'semantic_search';
}

// Stubs for each workflow
export async function handleSemanticSearch(query: string): Promise<string> {
  // Perform semantic search in Qdrant
  const results = await semanticSearch(query, 5);
  if (!results.length) return 'No relevant files found.';
  return results.map((r: any, i: number) => `${i + 1}. ${r.name} (${r.ext})\nPath: ${r.path}\nScore: ${r.score.toFixed(3)}`).join('\n\n');
}
export async function handleQA(query: string, file?: string): Promise<string> {
  if (file) {
    // Extract file content (support PDF and text)
    const ext = path.extname(file).toLowerCase();
    let fileText = '';
    try {
      if (ext === '.pdf') {
        const data = await pdfParse(fs.readFileSync(file));
        fileText = data.text;
      } else {
        fileText = fs.readFileSync(file, 'utf-8');
      }
    } catch (e) {
      return `Failed to read file: ${file}`;
    }
    if (!fileText.trim()) return 'No text extracted from file.';
    // Prepend file content as context
    const prompt = `Given the following file content:\n\n"""\n${fileText.slice(0, 4000)}\n"""\n\nAnswer the following question based on the file above:\n${query}`;
    console.log('LLM prompt for file Q&A:', prompt);
    return await queryOllama(prompt);
  }
  
  // No file provided - perform semantic search to find relevant files
  console.log('No file provided, performing semantic search for Q&A');
  const searchResults = await semanticSearch(query, 3); // Get top 3 most relevant files
  
  if (!searchResults.length) {
    return 'No relevant files found to answer your question.';
  }
  
  // Try to answer using the most relevant file
  const mostRelevantFile = searchResults[0];
  console.log('Using most relevant file for Q&A:', mostRelevantFile.path);
  
  try {
    const ext = path.extname(mostRelevantFile.path).toLowerCase();
    let fileText = '';
    
    if (ext === '.pdf') {
      const data = await pdfParse(fs.readFileSync(mostRelevantFile.path));
      fileText = data.text;
    } else {
      fileText = fs.readFileSync(mostRelevantFile.path, 'utf-8');
    }
    
    if (!fileText.trim()) {
      return 'No text could be extracted from the most relevant file.';
    }
    
    // Create a comprehensive prompt with file context
    const prompt = `Given the following file content from "${mostRelevantFile.name}":\n\n"""\n${fileText.slice(0, 4000)}\n"""\n\nAnswer the following question based on the file content above. If the answer is not in this file, say so clearly:\n${query}`;
    
    console.log('LLM prompt for semantic Q&A:', prompt);
    const answer = await queryOllama(prompt);
    
    // Add file reference to the answer
    return `${answer}\n\n(Answer based on: ${mostRelevantFile.name})`;
    
  } catch (e) {
    return `Found relevant file "${mostRelevantFile.name}" but couldn't read it: ${e}`;
  }
}
export async function handleSummarization(query: string, file?: string): Promise<string> {
  if (file) {
    // Extract file content (support PDF and text)
    const ext = path.extname(file).toLowerCase();
    let fileText = '';
    try {
      if (ext === '.pdf') {
        const data = await pdfParse(fs.readFileSync(file));
        fileText = data.text;
      } else {
        fileText = fs.readFileSync(file, 'utf-8');
      }
    } catch (e) {
      return `Failed to read file: ${file}`;
    }
    if (!fileText.trim()) return 'No text extracted from file.';
    // Summarization prompt
    const prompt = `Summarize the following file content:\n\n"""\n${fileText.slice(0, 4000)}\n"""\n\nSummary:`;
    console.log('LLM prompt for file summarization:', prompt);
    return await queryOllama(prompt);
  }
  // No file, just summarize the query (fallback)
  return `Summarization for: ${query}`;
}

function parseFileOperation(query: string): { op: string, dest?: string, newName?: string, zipName?: string } {
  const q = query.toLowerCase();
  if (q.includes('delete')) return { op: 'delete' };
  if (q.includes('move')) {
    // e.g. "move this file to /path/to/dest"
    const match = q.match(/move.*to ([^\s]+)/);
    return { op: 'move', dest: match ? match[1] : undefined };
  }
  if (q.includes('rename')) {
    // e.g. "rename this file to newname.txt"
    const match = q.match(/rename.*to ([^\s]+)/);
    return { op: 'rename', newName: match ? match[1] : undefined };
  }
  if (q.includes('zip')) {
    // e.g. "zip this folder into a.zip"
    const match = q.match(/zip.*into ([^\s]+)/);
    return { op: 'zip', zipName: match ? match[1] : undefined };
  }
  return { op: 'unknown' };
}

export async function handleFileOperation(query: string, fileOrFolder?: string): Promise<string> {
  if (!fileOrFolder) return 'No file or folder selected.';
  const { op, dest, newName, zipName } = parseFileOperation(query);
  try {
    if (op === 'delete') {
      const stat = fs.statSync(fileOrFolder);
      if (stat.isDirectory()) {
        fs.rmSync(fileOrFolder, { recursive: true, force: true });
      } else {
        fs.unlinkSync(fileOrFolder);
      }
      return `Deleted: ${fileOrFolder}`;
    }
    if (op === 'move') {
      if (!dest) return 'Destination path not specified.';
      fs.renameSync(fileOrFolder, dest);
      return `Moved ${fileOrFolder} to ${dest}`;
    }
    if (op === 'rename') {
      if (!newName) return 'New name not specified.';
      const dir = path.dirname(fileOrFolder);
      const newPath = path.join(dir, newName);
      fs.renameSync(fileOrFolder, newPath);
      return `Renamed to: ${newPath}`;
    }
    if (op === 'zip') {
      if (!zipName) return 'Zip file name not specified.';
      const dir = fs.statSync(fileOrFolder).isDirectory() ? fileOrFolder : path.dirname(fileOrFolder);
      const zipPath = path.join(dir, zipName);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(output);
      if (fs.statSync(fileOrFolder).isDirectory()) {
        archive.directory(fileOrFolder, false);
      } else {
        archive.file(fileOrFolder, { name: path.basename(fileOrFolder) });
      }
      await archive.finalize();
      return `Zipped to: ${zipPath}`;
    }
    return 'Unknown or unsupported file operation.';
  } catch (e: any) {
    return `File operation failed: ${e.message}`;
  }
}

// Use LLM to parse a file operation query into a structured operation
export async function parseFileOperationWithLLM(query: string, fileOrFolder?: string): Promise<{ op: string, dest?: string, newName?: string, zipName?: string, summary: string }> {
  // Prompt the LLM to extract the operation, destination, etc. from the query
  const prompt = `You are an assistant that extracts file operation instructions from user queries.\n\nGiven the following user query and the selected file or folder, extract:\n- operation (delete, move, rename, zip, etc.)\n- destination path (if any)\n- new name (if any)\n- zip file name (if any)\n\nReturn a JSON object with keys: op, dest, newName, zipName.\nAlso, provide a one-line summary of the operation for user confirmation.\n\nUser query: "${query}"\nSelected: "${fileOrFolder || ''}"\n\nJSON:`;
  const llmResult = await queryOllama(prompt);
  try {
    const match = llmResult.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (!parsed.summary) parsed.summary = `Operation: ${parsed.op}`;
      return parsed;
    }
    return { op: 'unknown', summary: 'Could not parse operation.' };
  } catch (e) {
    return { op: 'unknown', summary: 'Failed to parse LLM output.' };
  }
}

export async function orchestrate(query: string, file?: string): Promise<OrchestratorResult> {
  const type = classifyQuery(query);
  let result = '';
  switch (type) {
    case 'semantic_search':
      result = await handleSemanticSearch(query);
      break;
    case 'qa':
      result = await handleQA(query, file);
      break;
    case 'summarization':
      result = await handleSummarization(query, file);
      break;
    case 'file_operation':
      result = await handleFileOperation(query, file);
      break;
  }
  return { type, result };
} 