import fs from 'node:fs';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;
const TRANSCRIPT_HARD_CAP = 120_000; // chars; defends against pathological inputs

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

let _systemCache: string | null = null;
function loadSystemPrompt(): string {
  if (_systemCache) return _systemCache;
  const dir =
    process.env.PROMPTS_DIR ?? path.resolve(process.cwd(), '..', 'prompts');
  const filePath = path.join(dir, 'analyze_system.md');
  if (!fs.existsSync(filePath)) {
    throw new Error(`analyze_system.md not found at ${filePath}`);
  }
  _systemCache = fs.readFileSync(filePath, 'utf8');
  return _systemCache;
}

export type AnalysisInput = {
  videoUrl: string;
  videoId: string;
  transcript: string;
};

export type AnalysisResult = {
  markdown: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
  truncated: boolean;
};

export async function analyzeTranscript(input: AnalysisInput): Promise<AnalysisResult> {
  const start = Date.now();
  const model = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const system = loadSystemPrompt();

  const truncated = input.transcript.length > TRANSCRIPT_HARD_CAP;
  const transcript = truncated
    ? input.transcript.slice(0, TRANSCRIPT_HARD_CAP) + '\n…[truncated]'
    : input.transcript;

  const userMessage = [
    `# Source`,
    `- URL: ${input.videoUrl}`,
    `- video_id: ${input.videoId}`,
    truncated ? `- 注意：字幕过长，已截断到前 ${TRANSCRIPT_HARD_CAP} 字符` : '',
    ``,
    `# Transcript`,
    transcript
  ]
    .filter(Boolean)
    .join('\n');

  const resp = await client().messages.create({
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userMessage }]
  });

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n');

  return {
    markdown: text,
    model,
    inputTokens: resp.usage.input_tokens,
    outputTokens: resp.usage.output_tokens,
    ms: Date.now() - start,
    truncated
  };
}
