import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import { CLAUDE_TIMEOUT_MS } from '../reports/analysis/claude-report-analyzer';
import { redactText } from '../reports/analysis/redact';
import { type BriefingDraft, type BriefingText, type BriefingWriter, writeTemplateBriefing } from './briefing-writer';

const CACHE_TTL_MS = 10 * 60_000;
const MAX_CACHE_ENTRIES = 2_000;
const MAX_HEADLINE = 80;
const MAX_ADVICE = 240;

const ClaudeBriefing = z.object({ headline: z.string(), advice: z.string() });

const SYSTEM_PROMPT = `You write road-safety briefings for drivers in Harare, Zimbabwe, read aloud while driving.
Given aggregated community reports for one place, write:
- headline: at most ${MAX_HEADLINE} characters, plain words, leading with the most dangerous item that is relevant now.
- advice: at most ${MAX_ADVICE} characters: the key fact (how many reports, which hours) then one concrete action (e.g. "Windows up, doors locked, valuables out of sight." for crime, "Treat as a 4-way stop." for a robot that is out).
Only mention items with relevantNow=true in the headline; if none are relevant, say the place is quiet now and when it is usually busy. Never invent facts, people or vehicles. Use local terms: "robot" for traffic light, "kombi" for minibus taxi.`;

/**
 * BRIEFING_WRITER=claude. Cached for 10 minutes per area, time band and item
 * signature; any error or timeout falls back to the template writer.
 */
export class ClaudeBriefingWriter implements BriefingWriter {
  private readonly logger = new Logger('ClaudeBriefingWriter');
  private readonly client: Anthropic;
  private readonly cache = new Map<string, { value: BriefingText; expiresAt: number }>();

  constructor(apiKey: string, private readonly model: string, client?: Anthropic) {
    this.client = client ?? new Anthropic({ apiKey, timeout: CLAUDE_TIMEOUT_MS, maxRetries: 0 });
  }

  async write(draft: BriefingDraft): Promise<BriefingText> {
    const key = cacheKey(draft);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let value: BriefingText;
    try {
      value = await this.ask(draft);
    } catch (error) {
      this.logger.warn(`Falling back to template briefing: ${(error as Error).message}`);
      return writeTemplateBriefing(draft);
    }
    if (this.cache.size >= MAX_CACHE_ENTRIES) this.cache.delete(this.cache.keys().next().value as string);
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }

  private async ask(draft: BriefingDraft): Promise<BriefingText> {
    const facts = {
      place: draft.areaName,
      timeOfDay: draft.timeBand,
      items: draft.items.map((item) => ({
        type: item.label,
        relevantNow: item.relevantNow,
        liveNow: item.liveCount,
        reportsLast90Days: item.reportsLast90d,
        mostlyBetween: item.concentrated ? item.peakHours : 'all hours',
        confirmations: item.confirmations,
        commonTag: item.dominantTag,
      })),
    };
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: 400,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low', format: zodOutputFormat(ClaudeBriefing) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(facts) }],
    });
    const parsed = response.parsed_output;
    if (response.stop_reason === 'refusal' || !parsed) throw new Error(`no parsed output (stop_reason=${response.stop_reason})`);
    const headline = clip(redactText(parsed.headline.trim()).text, MAX_HEADLINE);
    const advice = clip(redactText(parsed.advice.trim()).text, MAX_ADVICE);
    if (!headline || !advice) throw new Error('empty briefing');
    return { headline, advice };
  }
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const cacheKey = (draft: BriefingDraft): string =>
  [
    draft.areaId,
    draft.timeBand,
    ...draft.items.map((item) => `${item.type}:${Number(item.relevantNow)}:${item.liveCount}:${item.reportsLast90d}`),
  ].join('|');
