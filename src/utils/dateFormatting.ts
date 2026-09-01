/**
 * Formats a date or ISO string into a human-readable relative time format
 * (e.g., "Just now", "2m ago", "Today at 2:41 PM", "Yesterday at 9:15 AM", "Mar 1, 2:30 PM").
 */
export function formatSmartRelativeTime(isoOrDate: string | number | Date | null | undefined): string {
  if (!isoOrDate) return 'Never';

  const d = typeof isoOrDate === 'object' && isoOrDate instanceof Date 
    ? isoOrDate 
    : new Date(isoOrDate);

  if (isNaN(d.getTime())) return 'Never';

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    // If today, show "Today at 2:45 PM" or "X hours ago"
    const isSameDay = now.toDateString() === d.toDateString();
    if (isSameDay) {
      return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    return `${hours}h ago`;
  }

  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (isYesterday) {
    return `Yesterday, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}
