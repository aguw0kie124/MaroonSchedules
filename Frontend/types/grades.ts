// Frontend/types/grades.ts
// Canonical TypeScript shape for a single grade-distribution row.
// Matches the GradeRow produced by Backend/scrape_grades.py and
// served by Backend/routers/grades.py → /grades/search.

export type Semester = 'SPRING' | 'SUMMER' | 'FALL';

export interface GradeRow {
    term_code: string;        // e.g. "20241"
    year: number;             // e.g. 2024
    semester: Semester;
    college_code: string;     // e.g. "EN"  (may be empty string)
    subject: string;          // e.g. "CSCE"
    course_number: string;    // e.g. "121"
    section: string;          // e.g. "500"
    instructor: string;       // e.g. "DOE, J"
    a_count: number;
    b_count: number;
    c_count: number;
    d_count: number;
    f_count: number;
    i_count?: number;
    q_count: number;
    s_count?: number;
    u_count?: number;
    x_count?: number;
    avg_gpa: number;          // e.g. 3.45
}

// ──────────────────────────────────────────────────────────────
// Aggregated / derived types (computed by utils/grades.ts)
// ──────────────────────────────────────────────────────────────

export interface CourseStats {
    subject: string;
    course_number: string;
    avgGpa: number;
    totalStudents: number;
    percentA: number;
    percentB: number;
    percentC: number;
    percentD: number;
    percentF: number;
    percentQ: number;
    percentOther: number;
}

export interface InstructorSectionStat {
    instructor: string;
    section: string;
    year: number;
    semester: Semester;
    term_code: string;
    avgGpa: number;
    enrollment: number;
    percentA: number;
    percentB: number;
    percentC: number;
    percentD: number;
    percentF: number;
    percentQ: number;
    // raw counts for the detail view
    a_count: number;
    b_count: number;
    c_count: number;
    d_count: number;
    f_count: number;
    i_count: number;
    q_count: number;
    s_count: number;
    u_count: number;
    x_count: number;
}

export interface GradeSearchResult {
    rows: GradeRow[];
    stats: CourseStats;
    sections: InstructorSectionStat[];
}

/** One entry per unique instructor — aggregated across all their sections for a course */
export interface ProfSummary {
    instructor: string;
    avgGpa: number;
    totalStudents: number;
    sectionCount: number;
    sections: InstructorSectionStat[];
    // Aggregated grade counts
    a_count: number;
    b_count: number;
    c_count: number;
    d_count: number;
    f_count: number;
    i_count: number;
    q_count: number;
    s_count: number;
    u_count: number;
    x_count: number;
    percentA: number;
    percentB: number;
    percentC: number;
    percentD: number;
    percentF: number;
    percentQ: number;
}