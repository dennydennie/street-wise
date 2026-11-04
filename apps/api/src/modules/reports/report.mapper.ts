import type { Report as ReportResponse } from '@streetwise/shared';
import type { Report } from './entities/report.entity';

/** Public shape of a report. The transcript (raw speech) is only included for its reporter. */
export const toReportResponse = (row: Report, viewerId?: string): ReportResponse => {
  const isMine = viewerId !== undefined && row.reporterId === viewerId;
  return {
    id: row.id,
    type: row.type,
    lat: row.lat,
    lng: row.lng,
    note: row.note,
    areaId: row.areaId ?? null,
    locationName: row.locationName ?? null,
    summary: row.summary ?? null,
    severity: row.severity,
    tags: row.tags ?? [],
    heading: row.heading ?? null,
    capturedAt: (row.capturedAt ?? row.createdAt).toISOString(),
    status: row.status,
    stillThereCount: row.stillThereCount,
    goneCount: row.goneCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    isMine,
    ...(isMine ? { transcript: row.transcript ?? null } : {}),
  };
};
