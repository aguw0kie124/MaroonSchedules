// Frontend/services/grades.ts
// Data-access layer for grade distribution.
//
// searchCourseGrades() hits the real backend endpoint (GET /grades/search).
// If the backend isn't reachable it falls back to the local mock JSON so
// the frontend always has data to display during dev.

import { requestJson } from '../api/client';
import { GradeRow, GradeSearchResult } from '../types/grades';
import {
    aggregateCourseStats,
    groupByInstructorAndSection,
} from '../utils/grades';

async function fetchFromBackend(
    subject: string,
    course: string,
    instructor?: string,
    semester?: string,
    year?: number,
): Promise<GradeRow[]> {
    const params = new URLSearchParams({
        subject: subject.toUpperCase(),
        course,
    });
    if (instructor) params.append('instructor', instructor);
    if (semester) params.append('semester', semester);
    if (year) params.append('year', String(year));

    const path = `/grades/search?${params.toString()}`;
    console.log('[grades] fetching:', path);
    return requestJson(path) as Promise<GradeRow[]>;
}

/**
 * Search for grade-distribution data for a given course.
 *
 * @param subject      e.g. "CSCE"
 * @param course       e.g. "121"
 * @param instructor   optional partial match (case-insensitive)
 * @param semester     optional "SPRING" | "SUMMER" | "FALL"
 * @param year         optional year filter
 */
export async function searchCourseGrades(
    subject: string,
    course: string,
    instructor?: string,
    semester?: string,
    year?: number,
): Promise<GradeSearchResult> {
    let rows: GradeRow[] = [];

    try {
        rows = await fetchFromBackend(subject, course, instructor, semester, year);
    } catch (err) {
        console.warn('[grades service] backend fetch failed:', err);
        throw err;
    }

    const stats = aggregateCourseStats(rows);
    const sections = groupByInstructorAndSection(rows);

    return { rows, stats, sections };
}
