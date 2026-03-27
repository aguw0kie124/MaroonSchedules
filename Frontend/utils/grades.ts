// Frontend/utils/grades.ts
// Pure utility functions for grade-distribution data.
// No side-effects, no React, no API calls — fully unit-testable.

import {
    GradeRow,
    CourseStats,
    InstructorSectionStat,
    Semester,
} from '../types/grades';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function pct(part: number, total: number): number {
    if (total === 0) return 0;
    return round2((part / total) * 100);
}

function rowEnrollment(row: GradeRow): number {
    return (
        (row.a_count ?? 0) +
        (row.b_count ?? 0) +
        (row.c_count ?? 0) +
        (row.d_count ?? 0) +
        (row.f_count ?? 0) +
        (row.i_count ?? 0) +
        (row.q_count ?? 0) +
        (row.s_count ?? 0) +
        (row.u_count ?? 0) +
        (row.x_count ?? 0)
    );
}

// ──────────────────────────────────────────────────────────────
// aggregateCourseStats
// ──────────────────────────────────────────────────────────────

/**
 * Compute overall course-level stats from an array of GradeRows.
 * Uses weighted average for GPA (weighted by section enrollment).
 */
export function aggregateCourseStats(rows: GradeRow[]): CourseStats {
    if (rows.length === 0) {
        return {
            subject: '',
            course_number: '',
            avgGpa: 0,
            totalStudents: 0,
            percentA: 0,
            percentB: 0,
            percentC: 0,
            percentD: 0,
            percentF: 0,
            percentQ: 0,
            percentOther: 0,
        };
    }

    let totalStudents = 0;
    let sumA = 0, sumB = 0, sumC = 0, sumD = 0, sumF = 0, sumQ = 0;
    let gpaWeightedSum = 0;

    for (const row of rows) {
        const n = rowEnrollment(row);
        totalStudents += n;
        sumA += row.a_count ?? 0;
        sumB += row.b_count ?? 0;
        sumC += row.c_count ?? 0;
        sumD += row.d_count ?? 0;
        sumF += row.f_count ?? 0;
        sumQ += row.q_count ?? 0;
        gpaWeightedSum += row.avg_gpa * n;
    }

    const avgGpa = totalStudents > 0 ? round2(gpaWeightedSum / totalStudents) : 0;
    const graded = sumA + sumB + sumC + sumD + sumF; // excludes Q/S/U/X for grade %
    const other = totalStudents - graded - sumQ;

    return {
        subject: rows[0].subject,
        course_number: rows[0].course_number,
        avgGpa,
        totalStudents,
        percentA: pct(sumA, totalStudents),
        percentB: pct(sumB, totalStudents),
        percentC: pct(sumC, totalStudents),
        percentD: pct(sumD, totalStudents),
        percentF: pct(sumF, totalStudents),
        percentQ: pct(sumQ, totalStudents),
        percentOther: pct(other, totalStudents),
    };
}

// ──────────────────────────────────────────────────────────────
// groupByInstructorAndSection
// ──────────────────────────────────────────────────────────────

/**
 * One result per row (section×instructor×term).
 * Rows are sorted by most-recent year desc, then by avg_gpa desc.
 */
export function groupByInstructorAndSection(
    rows: GradeRow[],
): InstructorSectionStat[] {
    const stats: InstructorSectionStat[] = rows.map((row) => {
        const enrollment = rowEnrollment(row);
        return {
            instructor: row.instructor,
            section: row.section,
            year: row.year,
            semester: row.semester as Semester,
            term_code: row.term_code,
            avgGpa: row.avg_gpa,
            enrollment,
            percentA: pct(row.a_count ?? 0, enrollment),
            percentB: pct(row.b_count ?? 0, enrollment),
            percentC: pct(row.c_count ?? 0, enrollment),
            percentD: pct(row.d_count ?? 0, enrollment),
            percentF: pct(row.f_count ?? 0, enrollment),
            percentQ: pct(row.q_count ?? 0, enrollment),
            a_count: row.a_count ?? 0,
            b_count: row.b_count ?? 0,
            c_count: row.c_count ?? 0,
            d_count: row.d_count ?? 0,
            f_count: row.f_count ?? 0,
            i_count: row.i_count ?? 0,
            q_count: row.q_count ?? 0,
            s_count: row.s_count ?? 0,
            u_count: row.u_count ?? 0,
            x_count: row.x_count ?? 0,
        };
    });

    // Sort: most recent first, then best GPA first within same term
    return stats.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const semOrder: Record<string, number> = { FALL: 3, SUMMER: 2, SPRING: 1 };
        const semDiff = (semOrder[b.semester] ?? 0) - (semOrder[a.semester] ?? 0);
        if (semDiff !== 0) return semDiff;
        return b.avgGpa - a.avgGpa;
    });
}

// ──────────────────────────────────────────────────────────────
// GPA colour coding helper
// ──────────────────────────────────────────────────────────────

export function gpaColor(gpa: number): string {
    if (gpa >= 3.5) return '#30D158'; // green
    if (gpa >= 3.0) return '#64D2FF'; // blue
    if (gpa >= 2.5) return '#FF9F0A'; // orange
    return '#FF453A';                  // red
}