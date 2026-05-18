import axios from 'axios';

/**
 * Query the local Ollama LLM for a completion.
 * @param prompt The prompt/question to send to the LLM.
 * @param model The model to use (default: 'llama3')
 * @returns The full response string from the LLM.
 */
export async function queryOllama(prompt: string, model = 'llama3.2:latest') {
  const response = await axios.post('http://127.0.0.1:11434/api/generate', {
    model,
    prompt,
    stream: false
  });
  // Ollama returns { response: string, ... }
  return response.data.response;
}

/**
 * Get an embedding vector from Ollama's local embedding model.
 * @param text The text to embed
 * @param model The embedding model to use (default: 'mxbai-embed-large')
 * @returns The embedding vector (float[])
 */
export async function getOllamaEmbedding(text: string, model = 'mxbai-embed-large:latest') {
  const response = await axios.post('http://127.0.0.1:11434/api/embeddings', {
    model,
    prompt: text
  });
  return response.data.embedding;
} 