import { getLocalDateString } from './dateUtils';

type DiningHistoryDay = {
  date: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

function parseLocalDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function diffCalendarDays(left: string, right: string) {
  const leftDate = parseLocalDate(left);
  const rightDate = parseLocalDate(right);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((rightDate.getTime() - leftDate.getTime()) / msPerDay);
}

export function didHitDiningGoal(
  day: DiningHistoryDay,
  targetCalories: number,
  mode: string,
) {
  const ratio = (day.calories || 0) / (targetCalories || 1);
  if (mode === 'cut') return ratio >= 0.5 && ratio <= 1.15;
  if (mode === 'bulk') return ratio >= 0.85;
  return ratio >= 0.8 && ratio <= 1.2;
}

export function computeDiningStreakStats(
  history: DiningHistoryDay[],
  targetCalories: number,
  mode: string,
  today = getLocalDateString(),
) {
  const sortedHistory = [...history].sort((left, right) => left.date.localeCompare(right.date));
  let longestStreak = 0;
  let activeRun = 0;
  let daysHit = 0;
  let previousDate: string | null = null;

  sortedHistory.forEach((day) => {
    const hitGoal = didHitDiningGoal(day, targetCalories, mode);
    if (hitGoal) {
      daysHit += 1;
      if (previousDate && diffCalendarDays(previousDate, day.date) === 1) {
        activeRun += 1;
      } else {
        activeRun = 1;
      }
      longestStreak = Math.max(longestStreak, activeRun);
    } else {
      activeRun = 0;
    }
    previousDate = day.date;
  });

  let currentStreak = 0;
  let nextExpectedDate = today;

  for (let index = sortedHistory.length - 1; index >= 0; index -= 1) {
    const day = sortedHistory[index];
    const gapToExpected = diffCalendarDays(day.date, nextExpectedDate);
    if (gapToExpected > 1) {
      break;
    }
    if (!didHitDiningGoal(day, targetCalories, mode)) {
      break;
    }

    currentStreak += 1;
    nextExpectedDate = day.date;
  }

  return {
    currentStreak,
    longestStreak,
    daysHit,
  };
}
