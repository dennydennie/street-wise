# Briefings: what a driver hears, and why

`GET /briefings?lat&lng[&radiusM=2000][&at=ISO][&limit=10]` returns the areas
around a driver, most urgent first, each with a one-line headline and one line
of advice. The rules live in `apps/api/src/modules/areas/briefing-engine.ts`
(pure functions, unit-tested) and the wording in `briefing-writer.ts`.

## Areas

Every published report belongs to an **area**: the nearest area within
**200 m**, otherwise a new area at the report's position. A new area is named by
the reverse geocoder (`GEOCODER=mapbox`), else the nearest camera within 300 m,
else `Near <lat>, <lng>`. `pnpm db:seed` creates one area per camera
intersection and backfills reports that have none.

## Time of day

Hours are **Africa/Harare** local time, in four bands:

| Band | Hours | Share of day |
| --- | --- | --- |
| morning | 05:00–10:00 | 5/24 |
| midday | 10:00–16:00 | 6/24 |
| evening | 16:00–20:00 | 4/24 |
| night | 20:00–05:00 | 9/24 |

`at` (default now) only chooses the band being briefed for. What is *live* and
how old a report is are always measured from the real current time, so you can
ask "what would 22:00 look like tonight?".

## Per area and report type

From the area's reports **captured** in the last 90 days (every status except
`draft` and `removed`; `capturedAt` is when the driver saw it, which may be
before it was posted):

- `hourly` — a 24-hour histogram.
- `peakHours` — the narrowest run of hours holding ≥60 % of reports
  (e.g. `19:00–23:00`); wider than 8 hours reads as "at all hours".
- `peakBand` — the band with the most reports per hour.
- `shareInCurrentBand` — raw share of reports in the current band.

An item is **relevant now** when either:

1. it has a **live** report on the map (always relevant, whatever the hour), or
2. its history clusters in the current band: the smoothed share of reports in
   the band is at least **1.25 ×** the band's share of the day, **and** there
   are at least **3** reports in 90 days.

Smoothing adds 4 pseudo-reports spread over the day in proportion to band
length: `(inBand + 4 × bandShare) / (total + 4)`. A handful of reports cannot
swing it, and an evenly spread history (potholes "anytime") never qualifies on
history alone.

So smash-and-grabs reported mostly 19:00–23:00 are **not** relevant at 13:00
but **are** at 22:00.

## Score, priority, alert

```
score    = Σ over relevant items of  weight × (live × 3 + decayed history + confirmations × 0.5)
weight   = crime_hotspot 5, flooding 4, robot_out 3, pothole 2, kombi_stop 2, camera 2
history  = Σ 0.5^(age in days / 30) over reports not currently live
priority = high ≥ 12, medium ≥ 5, otherwise low
alert    = priority ≥ medium and at least one relevant item
```

Areas are sorted by alert, priority, score (all descending), then distance.
Areas with history but nothing relevant still appear (`alert: false`,
`priority: low`) so the map can say "mostly at night".

## Wording

The default `BRIEFING_WRITER=template` leads with the most dangerous relevant
item and names the others in one line:

> **Crime hotspot — don't stop at the robot**
> 14 smash-and-grabs reported, mostly 20:00–23:00. Windows up, doors locked,
> valuables out of sight. Also: robot out.

With nothing relevant now: "Crime hotspot — mostly at night / Nothing pressing
right now. …". `BRIEFING_WRITER=claude` asks Claude for the same two lines from
the aggregates only (cached 10 minutes per area and band; any failure falls back
to the template). Briefings never contain reporter identity or transcripts;
signed-in viewers do not see reports from reporters they blocked.
