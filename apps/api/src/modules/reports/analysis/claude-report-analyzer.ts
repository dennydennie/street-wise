import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';
import {
  REPORT_SEVERITY_MAX,
  REPORT_SEVERITY_MIN,
  REPORT_SUMMARY_MAX_LENGTH,
  REPORT_TYPES,
  type ReportAnalysis,
} from '@streetwise/shared';
import { z } from 'zod';
import { redactText, toPublicSummary } from './redact';
import type { ReportAnalyzer } from './report-analyzer';
import { analyzeWithRules } from './rule-based-report-analyzer';

export const CLAUDE_TIMEOUT_MS = 4_000;

/** Kept flat and constraint-free so it maps cleanly onto structured outputs; bounds are enforced after parsing. */
const ClaudeAnalysis = z.object({
  type: z.enum([...REPORT_TYPES, 'none']),
  confidence: z.number(),
  summary: z.string(),
  severity: z.number(),
  tags: z.array(z.string()),
});

const SYSTEM_PROMPT = `You classify short spoken road reports from drivers in Harare, Zimbabwe. Reports may mix English, Shona, Ndebele and Harare slang ("robot" = traffic light, "kombi" = minibus taxi, "mushikashika" = unlicensed pirate taxi, "gomba"/"mgodi" = pothole, "mvura" = water, "mbavha" = thief, "marobhoti" = traffic lights).

Return:
- type: one of pothole, robot_out (traffic lights not working), kombi_stop (kombis/ZUPCO/mushikashika stopping or loading in the road), flooding, crime_hotspot (smash-and-grab, robbery, theft, snatching, hijacking), camera (traffic camera, speed trap or police roadblock), or "none" if the report is not about any of these.
- confidence: 0 to 1.
- summary: one plain English sentence of at most ${REPORT_SUMMARY_MAX_LENGTH} characters describing the hazard and place. Community rule: name places, never people or vehicles. Replace any number plate with [plate], any phone number with [number] and any person's name with [person].
- severity: integer 1 (minor) to 5 (danger to life). Weapons, deep potholes and fast water raise it.
- tags: short snake_case tags such as smash_and_grab, hijack, roadblock, speed_trap, zupco, mushikashika, weapon, night, morning, rush_hour.`;

/**
 * REPORT_ANALYZER=claude. Uses structured outputs so the reply is always the
 * schema above; any error, timeout or refusal falls back to the rule analyzer.
 * The public summary is redacted again locally whatever the model returned.
 */
export class ClaudeReportAnalyzer implements ReportAnalyzer {
  private readonly logger = new Logger('ClaudeReportAnalyzer');
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey, timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 });
  }

  async analyze(transcript: string): Promise<ReportAnalysis> {
    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 512,
        thinking: { type: 'disabled' },
        output_config: { effort: 'low', format: zodOutputFormat(ClaudeAnalysis) },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Driver's report:\n${transcript}` }],
      });
      const parsed = response.parsed_output;
      if (response.stop_reason === 'refusal' || !parsed) throw new Error(`no parsed output (stop_reason=${response.stop_reason})`);
      return this.normalise(transcript, parsed);
    } catch (error) {
      this.logger.warn(`Falling back to rule analyzer: ${(error as Error).message}`);
      return analyzeWithRules(transcript);
    }
  }

  private normalise(transcript: string, parsed: z.infer<typeof ClaudeAnalysis>): ReportAnalysis {
    const rules = analyzeWithRules(transcript);
    const modelSummary = parsed.summary.trim();
    const local = modelSummary ? toPublicSummary(redactText(modelSummary).text) : null;
    const summary = local?.summary || rules.summary;
    const type = parsed.type === 'none' ? null : parsed.type;
    return {
      type,
      confidence: type ? clamp(parsed.confidence, 0, 1) : 0,
      summary,
      severity: Math.round(clamp(parsed.severity, REPORT_SEVERITY_MIN, REPORT_SEVERITY_MAX)),
      tags: [...new Set(parsed.tags.map((tag) => tag.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')).filter(Boolean))].slice(0, 8),
      // The model was told to redact; the raw transcript tells us whether there was anything to redact.
      redacted: rules.redacted || /\[(plate|number|person)\]/.test(summary),
    };
  }
}

const clamp = (value: number, min: number, max: number) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min);
