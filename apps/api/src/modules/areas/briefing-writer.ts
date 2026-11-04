import type { ReportType, TimeBand } from '@streetwise/shared';
import type { ItemStats } from './briefing-engine';

export const BRIEFING_WRITER = Symbol('BRIEFING_WRITER');

/** What a writer may see: aggregates only, never reporters or transcripts. */
export type BriefingDraft = {
  areaId: string;
  areaName: string;
  timeBand: TimeBand;
  items: ItemStats[];
};

export type BriefingText = { headline: string; advice: string };

export interface BriefingWriter {
  write(draft: BriefingDraft): Promise<BriefingText>;
}

const HEADLINES: Record<ReportType, string> = {
  crime_hotspot: "Crime hotspot — don't stop at the robot",
  flooding: 'Flooding — avoid this road',
  robot_out: 'Robot not working',
  pothole: 'Potholes — slow down',
  kombi_stop: 'Kombis stopping in the road',
  camera: 'Camera or roadblock ahead',
};

export const TYPE_ADVICE: Record<ReportType, string> = {
  crime_hotspot: 'Windows up, doors locked, valuables out of sight.',
  flooding: 'Avoid; find another route.',
  robot_out: 'Treat as a 4-way stop.',
  pothole: 'Keep left lane clear, slow down.',
  kombi_stop: 'Expect kombis stopping mid-road.',
  camera: 'Keep to the limit and stop behind the line.',
};

const NOUNS: Record<ReportType, [string, string]> = {
  crime_hotspot: ['crime', 'crimes'],
  flooding: ['flood', 'floods'],
  robot_out: ['robot outage', 'robot outages'],
  pothole: ['pothole', 'potholes'],
  kombi_stop: ['kombi stop', 'kombi stops'],
  camera: ['camera or roadblock', 'cameras or roadblocks'],
};
const TAG_NOUNS: Record<string, [string, string]> = {
  smash_and_grab: ['smash-and-grab', 'smash-and-grabs'],
  hijack: ['hijacking', 'hijackings'],
  snatch: ['snatching', 'snatchings'],
  roadblock: ['roadblock', 'roadblocks'],
  speed_trap: ['speed trap', 'speed traps'],
};
const BAND_PHRASES: Record<TimeBand, string> = {
  morning: 'in the morning',
  midday: 'around midday',
  evening: 'in the evening',
  night: 'at night',
};

const nounFor = (item: ItemStats): [string, string] => (item.dominantTag && TAG_NOUNS[item.dominantTag]) || NOUNS[item.type];

const factsFor = (item: ItemStats): string => {
  const [one, many] = nounFor(item);
  const count = `${item.reportsLast90d} ${item.reportsLast90d === 1 ? one : many} reported`;
  const when = item.concentrated ? `, mostly ${item.peakHours}` : '';
  const live = item.liveCount > 0 ? `${item.liveCount === 1 ? 'Reported' : `${item.liveCount} reports`} live now. ` : '';
  return `${live}${count}${when}.`;
};

/**
 * BRIEFING_WRITER=template (default): short, plain and actionable. Leads with
 * the most dangerous relevant item and names the others in one line.
 */
export class TemplateBriefingWriter implements BriefingWriter {
  async write(draft: BriefingDraft): Promise<BriefingText> {
    return writeTemplateBriefing(draft);
  }
}

export const writeTemplateBriefing = (draft: BriefingDraft): BriefingText => {
  const relevant = draft.items.filter((item) => item.relevantNow);
  const lead = relevant[0];
  if (!lead) {
    const top = draft.items[0];
    if (!top) return { headline: draft.areaName, advice: 'Nothing reported here recently.' };
    const when = top.concentrated ? `mostly ${BAND_PHRASES[top.peakBand]}` : 'quiet right now';
    return {
      headline: `${top.label} — ${when}`,
      advice: `Nothing pressing right now. ${factsFor(top)}`,
    };
  }
  const others = relevant.slice(1).map((item) => item.label.toLowerCase());
  const also = others.length > 0 ? ` Also: ${others.join(', ')}.` : '';
  return {
    headline: HEADLINES[lead.type],
    advice: `${factsFor(lead)} ${TYPE_ADVICE[lead.type]}${also}`,
  };
};
