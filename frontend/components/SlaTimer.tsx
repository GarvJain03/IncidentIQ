'use client';
import { useEffect, useState } from 'react';
import { Priority, IncidentStatus } from '@/lib/types';

interface SlaTimerProps {
  deadline: string | undefined;
  priority?: Priority;
  violated: boolean;
  status?: IncidentStatus | string;
}

export default function SlaTimer({ deadline, violated, status }: SlaTimerProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const isCompleted = status === 'RESOLVED' || status === 'CLOSED';

  useEffect(() => {
    if (!deadline || isCompleted) return;
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      setRemaining(diff);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [deadline, isCompleted]);

  // If incident is already resolved or closed, SLA clock has stopped
  if (isCompleted) {
    if (violated) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold">
          ⚠ SLA Breached
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold">
        ✓ SLA Met
      </span>
    );
  }

  // Active incident: check if marked violated or time expired
  if (violated || (remaining !== null && remaining <= 0)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold animate-pulse">
        ⚠ SLA VIOLATED
      </span>
    );
  }

  if (!deadline || remaining === null) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  let colorClass = 'text-green-600 bg-green-50';
  let pulse = '';
  if (remaining < 5 * 60 * 1000) {
    colorClass = 'text-red-600 bg-red-50';
    pulse = 'animate-pulse';
  } else if (remaining < 10 * 60 * 1000) {
    colorClass = 'text-yellow-600 bg-yellow-50';
  }

  const display = hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono font-semibold ${colorClass} ${pulse}`}>
      ⏱ SLA {display}
    </span>
  );
}
