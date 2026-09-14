/**
 * Streaming simulation utilities for ZeroCharts
 * 
 * Rules:
 * - 1 play = 10.875 million streams (10,875,000 streams)
 * - If streams >= 1 Billion (1,000,000,000), format with 'B'
 * - If streams < 1 Billion, format with 'M'
 * - Streams are purely an engagement metric and DO NOT count towards units sold.
 * - Certifications (Gold, Platinum, Diamond) are strictly based on units sold.
 */

export const DEFAULT_STREAM_FACTOR_PER_PLAY = 10875000; // 1 play = 10.875M streams

/**
 * Formats a raw number of streams into a human-readable string.
 * Uses "B" if >= 1 Billion (e.g. 1.09B, 2.5B), otherwise "M" (e.g. 10.875M, 21.75M).
 */
export function formatStreams(streams: number | undefined | null): string {
  if (streams === undefined || streams === null || isNaN(streams) || streams <= 0) {
    return '0M';
  }

  if (streams >= 1_000_000_000) {
    const b = streams / 1_000_000_000;
    const formatted = b.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    return `${formatted}B`;
  }

  const m = streams / 1_000_000;
  const formatted = m.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${formatted}M`;
}

/**
 * Calculates raw stream count from plays using the configured or default stream multiplier.
 */
export function calculateStreams(
  plays: number | undefined | null,
  factor: number = DEFAULT_STREAM_FACTOR_PER_PLAY
): number {
  return Math.round((plays || 0) * (factor || DEFAULT_STREAM_FACTOR_PER_PLAY));
}

/**
 * Convenience helper to format streams directly from a play count.
 */
export function formatStreamsFromPlays(
  plays: number | undefined | null,
  factor: number = DEFAULT_STREAM_FACTOR_PER_PLAY
): string {
  return formatStreams(calculateStreams(plays, factor));
}
