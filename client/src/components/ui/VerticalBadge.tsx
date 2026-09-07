import type { Vertical } from '../../lib/vertical';
import { verticalLabels } from '../../lib/vertical';

interface VerticalBadgeProps {
  vertical: Vertical | null;
}

/** A neutral chip naming the request/quote's vertical (AVAC vs. Caixilharia). Renders nothing
 * when the vertical is not yet known (e.g. an optimistic row before the pipeline has parsed it). */
export function VerticalBadge({ vertical }: VerticalBadgeProps) {
  if (!vertical) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
      {verticalLabels[vertical]}
    </span>
  );
}
