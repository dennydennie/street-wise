import { Injectable } from '@nestjs/common';
import { REPORT_SEVERITY_MAX, REPORT_SEVERITY_MIN, type ReportAnalysis, type ReportType } from '@streetwise/shared';
import { toPublicSummary } from './redact';
import type { ReportAnalyzer } from './report-analyzer';

type Phrase = { text: string; tag?: string };

/**
 * English plus common Shona / Ndebele / Harare street words. Phrases are
 * matched on word boundaries; a longer phrase counts for more than a single word.
 */
export const REPORT_PHRASES: Record<ReportType, Phrase[]> = {
  crime_hotspot: [
    { text: 'smash and grab', tag: 'smash_and_grab' },
    { text: 'smash-and-grab', tag: 'smash_and_grab' },
    { text: 'smash n grab', tag: 'smash_and_grab' },
    { text: 'hijack', tag: 'hijack' },
    { text: 'hijacked', tag: 'hijack' },
    { text: 'hijacking', tag: 'hijack' },
    { text: 'robbery' },
    { text: 'robbed' },
    { text: 'robbers' },
    { text: 'mugging' },
    { text: 'mugged' },
    { text: 'thieves' },
    { text: 'thief' },
    { text: 'snatch', tag: 'snatch' },
    { text: 'snatched', tag: 'snatch' },
    { text: 'phone snatching', tag: 'snatch' },
    { text: 'mbavha' },
    { text: 'mbava' },
    { text: 'dzimbavha' },
    { text: 'amasela' },
    { text: 'isela' },
    { text: 'armed' },
  ],
  flooding: [
    { text: 'flood' },
    { text: 'floods' },
    { text: 'flooded' },
    { text: 'flooding' },
    { text: 'water on the road' },
    { text: 'road under water' },
    { text: 'waterlogged' },
    { text: 'burst pipe', tag: 'burst_pipe' },
    { text: 'mvura' },
    { text: 'mvura yakawanda' },
    { text: 'amanzi' },
  ],
  robot_out: [
    { text: 'robot not working' },
    { text: 'robots not working' },
    { text: 'robot is not working' },
    { text: 'robot out' },
    { text: 'robots out' },
    { text: 'robot is out' },
    { text: 'robot down' },
    { text: 'robot off' },
    { text: 'robots off' },
    { text: 'robot dead' },
    { text: 'traffic lights off' },
    { text: 'traffic lights out' },
    { text: 'traffic light not working' },
    { text: 'traffic lights not working' },
    { text: 'lights not working' },
    { text: 'marobhoti' },
    { text: 'marobhoti haashande' },
    { text: 'robhoti' },
    { text: 'amarobhothi' },
  ],
  pothole: [
    { text: 'pothole' },
    { text: 'potholes' },
    { text: 'pot hole' },
    { text: 'pot holes' },
    { text: 'hole in the road' },
    { text: 'crater' },
    { text: 'sinkhole' },
    { text: 'gomba' },
    { text: 'makomba' },
    { text: 'mgodi' },
    { text: 'imigodi' },
  ],
  kombi_stop: [
    { text: 'kombi' },
    { text: 'kombis' },
    { text: 'combi' },
    { text: 'combis' },
    { text: 'mushikashika', tag: 'mushikashika' },
    { text: 'mushika-shika', tag: 'mushikashika' },
    { text: 'mshikashika', tag: 'mushikashika' },
    { text: 'zupco stopping', tag: 'zupco' },
    { text: 'zupco', tag: 'zupco' },
    { text: 'hwindi' },
    { text: 'touts' },
    { text: 'picking up passengers' },
  ],
  camera: [
    { text: 'camera' },
    { text: 'cameras' },
    { text: 'speed camera', tag: 'speed_trap' },
    { text: 'speed trap', tag: 'speed_trap' },
    { text: 'police roadblock', tag: 'roadblock' },
    { text: 'roadblock', tag: 'roadblock' },
    { text: 'road block', tag: 'roadblock' },
    { text: 'checkpoint', tag: 'roadblock' },
    { text: 'spikes', tag: 'roadblock' },
    { text: 'mapurisa', tag: 'roadblock' },
    { text: 'amapholisa', tag: 'roadblock' },
  ],
};

/** On ties the more dangerous type wins. */
const TYPE_ORDER: ReportType[] = ['crime_hotspot', 'flooding', 'robot_out', 'pothole', 'kombi_stop', 'camera'];

export const BASE_SEVERITY: Record<ReportType, number> = {
  crime_hotspot: 4,
  flooding: 3,
  robot_out: 3,
  pothole: 2,
  kombi_stop: 2,
  camera: 1,
};

const INTENSIFIERS: Phrase[] = [
  { text: 'big' },
  { text: 'huge' },
  { text: 'massive' },
  { text: 'deep' },
  { text: 'dangerous' },
  { text: 'very' },
  { text: 'gun', tag: 'weapon' },
  { text: 'guns', tag: 'weapon' },
  { text: 'knife', tag: 'weapon' },
  { text: 'knives', tag: 'weapon' },
  { text: 'pfuti', tag: 'weapon' },
  { text: 'banga', tag: 'weapon' },
  { text: 'hombe' },
  { text: 'yakadzika' },
  { text: 'injured', tag: 'injury' },
  { text: 'accident', tag: 'accident' },
];

const TIME_HINTS: Phrase[] = [
  { text: 'at night', tag: 'night' },
  { text: 'tonight', tag: 'night' },
  { text: 'usiku', tag: 'night' },
  { text: 'ebusuku', tag: 'night' },
  { text: 'morning', tag: 'morning' },
  { text: 'mangwanani', tag: 'morning' },
  { text: 'rush hour', tag: 'rush_hour' },
];

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matcherCache = new Map<string, RegExp>();
const matches = (text: string, phrase: string): boolean => {
  let regex = matcherCache.get(phrase);
  if (!regex) {
    regex = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(phrase).replace(/ /g, '\\s+')}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    matcherCache.set(phrase, regex);
  }
  return regex.test(text);
};

export const severityFor = (type: ReportType | null, intensifierCount: number): number =>
  Math.min(REPORT_SEVERITY_MAX, Math.max(REPORT_SEVERITY_MIN, (type ? BASE_SEVERITY[type] : 2) + Math.min(2, intensifierCount)));

/** Deterministic keyword analyzer; the default and the fallback for the Claude analyzer. */
@Injectable()
export class RuleBasedReportAnalyzer implements ReportAnalyzer {
  async analyze(transcript: string): Promise<ReportAnalysis> {
    return analyzeWithRules(transcript);
  }
}

export const analyzeWithRules = (transcript: string): ReportAnalysis => {
  const text = transcript.replace(/\s+/g, ' ').trim();
  const tags = new Set<string>();
  let bestType: ReportType | null = null;
  let bestScore = 0;
  let totalScore = 0;

  for (const type of TYPE_ORDER) {
    let score = 0;
    for (const phrase of REPORT_PHRASES[type]) {
      if (!matches(text, phrase.text)) continue;
      score += phrase.text.includes(' ') ? 2 : 1;
      if (phrase.tag) tags.add(phrase.tag);
    }
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      bestType = type;
    }
  }

  let intensifiers = 0;
  for (const phrase of INTENSIFIERS) {
    if (!matches(text, phrase.text)) continue;
    intensifiers += 1;
    if (phrase.tag) tags.add(phrase.tag);
  }
  for (const hint of TIME_HINTS) if (hint.tag && matches(text, hint.text)) tags.add(hint.tag);

  // Confident when one type clearly dominates; less so when several types are mentioned.
  const confidence = bestType ? Math.min(0.95, 0.55 + 0.15 * bestScore) * (bestScore / totalScore) : 0;
  const { summary, redacted } = toPublicSummary(text);
  return {
    type: bestType,
    confidence: Math.round(confidence * 100) / 100,
    summary,
    severity: severityFor(bestType, intensifiers),
    tags: [...tags].sort(),
    redacted,
  };
};
