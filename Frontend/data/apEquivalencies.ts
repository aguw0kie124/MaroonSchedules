// Frontend/data/apEquivalencies.ts
// Static TAMU AP Credit Equivalency table.
// Source: Texas A&M University AP Credit Chart (public, static policy)
// Each entry maps an AP Exam + minimum score to one or more TAMU course equivalents.

export interface APEquivalency {
    apExam: string;
    apScore: number;
    tamuCourses: string[];   // e.g. ["MATH 151"] or ["PHYS 218", "PHYS 221"]
    credits: number;
    notes?: string;
}

export const AP_EQUIVALENCIES: APEquivalency[] = [
    // ── Other / Newer AP Exams ───────────────────────────────────
    { apExam: 'African American Studies', apScore: 3, tamuCourses: ['AFST 289'], credits: 3 },
    { apExam: 'African American Studies', apScore: 4, tamuCourses: ['AFST 289'], credits: 3 },
    { apExam: 'African American Studies', apScore: 5, tamuCourses: ['AFST 289'], credits: 3 },
    { apExam: 'AP Pre-Calculus', apScore: 3, tamuCourses: ['MATH 102'], credits: 3 },
    { apExam: 'AP Pre-Calculus', apScore: 4, tamuCourses: ['MATH 102'], credits: 3 },
    { apExam: 'AP Pre-Calculus', apScore: 5, tamuCourses: ['MATH 102'], credits: 3 },
    { apExam: 'AP Research', apScore: 3, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },
    { apExam: 'AP Research', apScore: 4, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },
    { apExam: 'AP Research', apScore: 5, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },
    { apExam: 'AP Seminar', apScore: 3, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },
    { apExam: 'AP Seminar', apScore: 4, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },
    { apExam: 'AP Seminar', apScore: 5, tamuCourses: [], credits: 3, notes: 'See academic advisor — up to 3 hours' },

    // ── Mathematics ──────────────────────────────────────────────
    { apExam: 'Calculus AB', apScore: 3, tamuCourses: ['MATH 142'], credits: 3 },
    { apExam: 'Calculus AB', apScore: 4, tamuCourses: ['MATH 151'], credits: 4 },
    { apExam: 'Calculus AB', apScore: 5, tamuCourses: ['MATH 151'], credits: 4 },
    { apExam: 'Calculus BC', apScore: 3, tamuCourses: ['MATH 151'], credits: 4 },
    { apExam: 'Calculus BC', apScore: 4, tamuCourses: ['MATH 151', 'MATH 152'], credits: 8 },
    { apExam: 'Calculus BC', apScore: 5, tamuCourses: ['MATH 151', 'MATH 152'], credits: 8 },
    { apExam: 'Statistics', apScore: 3, tamuCourses: ['STAT 201'], credits: 3 },
    { apExam: 'Statistics', apScore: 4, tamuCourses: ['STAT 201'], credits: 3 },
    { apExam: 'Statistics', apScore: 5, tamuCourses: ['STAT 201'], credits: 3 },

    // ── Sciences ─────────────────────────────────────────────────
    { apExam: 'Biology', apScore: 3, tamuCourses: ['BIOL 113'], credits: 3 },
    { apExam: 'Biology', apScore: 4, tamuCourses: ['BIOL 111', 'BIOL 112'], credits: 8 },
    { apExam: 'Biology', apScore: 5, tamuCourses: ['BIOL 111', 'BIOL 112'], credits: 8 },
    { apExam: 'Chemistry', apScore: 3, tamuCourses: ['CHEM 119'], credits: 4 },
    { apExam: 'Chemistry', apScore: 4, tamuCourses: ['CHEM 119', 'CHEM 120'], credits: 8 },
    { apExam: 'Chemistry', apScore: 5, tamuCourses: ['CHEM 119', 'CHEM 120'], credits: 8 },
    { apExam: 'Environmental Science', apScore: 3, tamuCourses: ['ENSS 105'], credits: 3 },
    { apExam: 'Environmental Science', apScore: 4, tamuCourses: ['ENSS 105'], credits: 3 },
    { apExam: 'Environmental Science', apScore: 5, tamuCourses: ['ENSS 105'], credits: 3 },
    { apExam: 'Physics 1', apScore: 3, tamuCourses: ['PHYS 201'], credits: 4 },
    { apExam: 'Physics 1', apScore: 4, tamuCourses: ['PHYS 201'], credits: 4 },
    { apExam: 'Physics 1', apScore: 5, tamuCourses: ['PHYS 201'], credits: 4 },
    { apExam: 'Physics 2', apScore: 3, tamuCourses: ['PHYS 202'], credits: 4 },
    { apExam: 'Physics 2', apScore: 4, tamuCourses: ['PHYS 202'], credits: 4 },
    { apExam: 'Physics 2', apScore: 5, tamuCourses: ['PHYS 202'], credits: 4 },
    { apExam: 'Physics C: Electricity and Magnetism', apScore: 3, tamuCourses: ['PHYS 207', 'PHYS 227'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 207 only, not PHYS 227.' },
    { apExam: 'Physics C: Electricity and Magnetism', apScore: 4, tamuCourses: ['PHYS 207', 'PHYS 227'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 207 only, not PHYS 227.' },
    { apExam: 'Physics C: Electricity and Magnetism', apScore: 5, tamuCourses: ['PHYS 207', 'PHYS 227'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 207 only, not PHYS 227.' },
    { apExam: 'Physics C: Mechanics', apScore: 3, tamuCourses: ['PHYS 206', 'PHYS 226'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 206 only, not PHYS 226.' },
    { apExam: 'Physics C: Mechanics', apScore: 4, tamuCourses: ['PHYS 206', 'PHYS 226'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 206 only, not PHYS 226.' },
    { apExam: 'Physics C: Mechanics', apScore: 5, tamuCourses: ['PHYS 206', 'PHYS 226'], credits: 4, notes: 'Official credit is 3 or 4 hours. Engineering majors should accept PHYS 206 only, not PHYS 226.' },

    // ── Computer Science ──────────────────────────────────────────
    { apExam: 'Computer Science A', apScore: 3, tamuCourses: ['CSCE 110'], credits: 4 },
    { apExam: 'Computer Science A', apScore: 4, tamuCourses: ['CSCE 110'], credits: 4 },
    { apExam: 'Computer Science A', apScore: 5, tamuCourses: ['CSCE 110'], credits: 4 },
    { apExam: 'Computer Science Principles', apScore: 3, tamuCourses: ['CSCE 110'], credits: 4 },
    { apExam: 'Computer Science Principles', apScore: 4, tamuCourses: ['CSCE 110'], credits: 4 },
    { apExam: 'Computer Science Principles', apScore: 5, tamuCourses: ['CSCE 110'], credits: 4 },

    // ── English ───────────────────────────────────────────────────
    { apExam: 'English Language and Composition', apScore: 3, tamuCourses: ['ENGL 104'], credits: 3 },
    { apExam: 'English Language and Composition', apScore: 4, tamuCourses: ['ENGL 104', 'ENGL 241'], credits: 6 },
    { apExam: 'English Language and Composition', apScore: 5, tamuCourses: ['ENGL 104', 'ENGL 241'], credits: 6 },
    { apExam: 'English Literature and Composition', apScore: 3, tamuCourses: ['ENGL 104'], credits: 3 },
    { apExam: 'English Literature and Composition', apScore: 4, tamuCourses: ['ENGL 104', 'ENGL 203'], credits: 6 },
    { apExam: 'English Literature and Composition', apScore: 5, tamuCourses: ['ENGL 104', 'ENGL 203'], credits: 6 },

    // ── History & Social Sciences ─────────────────────────────────
    { apExam: 'U.S. History', apScore: 3, tamuCourses: ['HIST 105', 'HIST 106'], credits: 6 },
    { apExam: 'U.S. History', apScore: 4, tamuCourses: ['HIST 105', 'HIST 106'], credits: 6 },
    { apExam: 'U.S. History', apScore: 5, tamuCourses: ['HIST 105', 'HIST 106'], credits: 6 },
    { apExam: 'World History: Modern', apScore: 3, tamuCourses: ['HIST 104'], credits: 3 },
    { apExam: 'World History: Modern', apScore: 4, tamuCourses: ['HIST 104'], credits: 3 },
    { apExam: 'World History: Modern', apScore: 5, tamuCourses: ['HIST 104'], credits: 3 },
    { apExam: 'European History', apScore: 3, tamuCourses: ['HIST 102'], credits: 3 },
    { apExam: 'European History', apScore: 4, tamuCourses: ['HIST 102'], credits: 3 },
    { apExam: 'European History', apScore: 5, tamuCourses: ['HIST 102'], credits: 3 },
    { apExam: 'Government & Politics: U.S.', apScore: 3, tamuCourses: ['POLS 206'], credits: 3 },
    { apExam: 'Government & Politics: U.S.', apScore: 4, tamuCourses: ['POLS 206'], credits: 3 },
    { apExam: 'Government & Politics: U.S.', apScore: 5, tamuCourses: ['POLS 206'], credits: 3 },
    { apExam: 'Government & Politics: Comparative', apScore: 3, tamuCourses: ['POLS 229'], credits: 3 },
    { apExam: 'Government & Politics: Comparative', apScore: 4, tamuCourses: ['POLS 229'], credits: 3 },
    { apExam: 'Government & Politics: Comparative', apScore: 5, tamuCourses: ['POLS 229'], credits: 3 },
    { apExam: 'Economics: Macroeconomics', apScore: 3, tamuCourses: ['ECON 203'], credits: 3 },
    { apExam: 'Economics: Macroeconomics', apScore: 4, tamuCourses: ['ECON 203'], credits: 3 },
    { apExam: 'Economics: Macroeconomics', apScore: 5, tamuCourses: ['ECON 203'], credits: 3 },
    { apExam: 'Economics: Microeconomics', apScore: 3, tamuCourses: ['ECON 202'], credits: 3 },
    { apExam: 'Economics: Microeconomics', apScore: 4, tamuCourses: ['ECON 202'], credits: 3 },
    { apExam: 'Economics: Microeconomics', apScore: 5, tamuCourses: ['ECON 202'], credits: 3 },
    { apExam: 'Psychology', apScore: 3, tamuCourses: ['PBSI 107'], credits: 3 },
    { apExam: 'Psychology', apScore: 4, tamuCourses: ['PBSI 107'], credits: 3 },
    { apExam: 'Psychology', apScore: 5, tamuCourses: ['PBSI 107'], credits: 3 },
    { apExam: 'Human Geography', apScore: 3, tamuCourses: ['GEOG 201'], credits: 3 },
    { apExam: 'Human Geography', apScore: 4, tamuCourses: ['GEOG 201'], credits: 3 },
    { apExam: 'Human Geography', apScore: 5, tamuCourses: ['GEOG 201'], credits: 3 },

    // ── Languages ─────────────────────────────────────────────────
    { apExam: 'Spanish Language and Culture', apScore: 3, tamuCourses: ['SPAN 101', 'SPAN 102'], credits: 8 },
    { apExam: 'Spanish Language and Culture', apScore: 4, tamuCourses: ['SPAN 101', 'SPAN 102', 'SPAN 201'], credits: 11 },
    { apExam: 'Spanish Language and Culture', apScore: 5, tamuCourses: ['SPAN 101', 'SPAN 102', 'SPAN 201', 'SPAN 202'], credits: 14 },
    { apExam: 'Spanish Literature and Culture', apScore: 3, tamuCourses: ['SPAN 202'], credits: 3 },
    { apExam: 'Spanish Literature and Culture', apScore: 4, tamuCourses: ['SPAN 202'], credits: 3 },
    { apExam: 'Spanish Literature and Culture', apScore: 5, tamuCourses: ['SPAN 202', 'SPAN 320'], credits: 6 },
    { apExam: 'French Language and Culture', apScore: 3, tamuCourses: ['FREN 101', 'FREN 102'], credits: 8 },
    { apExam: 'French Language and Culture', apScore: 4, tamuCourses: ['FREN 101', 'FREN 102', 'FREN 201', 'FREN 202'], credits: 14 },
    { apExam: 'French Language and Culture', apScore: 5, tamuCourses: ['FREN 101', 'FREN 102', 'FREN 201', 'FREN 202'], credits: 14 },
    { apExam: 'German Language and Culture', apScore: 3, tamuCourses: ['GERM 101', 'GERM 102'], credits: 8 },
    { apExam: 'German Language and Culture', apScore: 4, tamuCourses: ['GERM 101', 'GERM 102', 'GERM 201', 'GERM 202'], credits: 14 },
    { apExam: 'German Language and Culture', apScore: 5, tamuCourses: ['GERM 101', 'GERM 102', 'GERM 201', 'GERM 202'], credits: 14 },
    { apExam: 'Chinese Language and Culture', apScore: 3, tamuCourses: ['CHIN 101', 'CHIN 102'], credits: 8 },
    { apExam: 'Chinese Language and Culture', apScore: 4, tamuCourses: ['CHIN 101', 'CHIN 102', 'CHIN 201', 'CHIN 202'], credits: 14 },
    { apExam: 'Chinese Language and Culture', apScore: 5, tamuCourses: ['CHIN 101', 'CHIN 102', 'CHIN 201', 'CHIN 202'], credits: 14 },
    { apExam: 'Japanese Language and Culture', apScore: 3, tamuCourses: ['JAPN 101', 'JAPN 102'], credits: 8 },
    { apExam: 'Japanese Language and Culture', apScore: 4, tamuCourses: ['JAPN 101', 'JAPN 102', 'JAPN 201', 'JAPN 202'], credits: 14 },
    { apExam: 'Japanese Language and Culture', apScore: 5, tamuCourses: ['JAPN 101', 'JAPN 102', 'JAPN 201', 'JAPN 202'], credits: 14 },
    { apExam: 'Latin', apScore: 3, tamuCourses: ['CLAS 121', 'CLAS 122'], credits: 8 },
    { apExam: 'Latin', apScore: 4, tamuCourses: ['CLAS 121', 'CLAS 122', 'CLAS 221', 'CLAS 222'], credits: 14 },
    { apExam: 'Latin', apScore: 5, tamuCourses: ['CLAS 121', 'CLAS 122', 'CLAS 221', 'CLAS 222'], credits: 14 },
    { apExam: 'Italian Language and Culture', apScore: 3, tamuCourses: ['ITAL 101', 'ITAL 102'], credits: 8 },
    { apExam: 'Italian Language and Culture', apScore: 4, tamuCourses: ['ITAL 101', 'ITAL 102', 'ITAL 201', 'ITAL 202'], credits: 14 },
    { apExam: 'Italian Language and Culture', apScore: 5, tamuCourses: ['ITAL 101', 'ITAL 102', 'ITAL 201', 'ITAL 202'], credits: 14 },

    // ── Arts ──────────────────────────────────────────────────────
    { apExam: 'Art History', apScore: 3, tamuCourses: ['ARTS 149'], credits: 3 },
    { apExam: 'Art History', apScore: 4, tamuCourses: ['ARTS 149', 'ARTS 150'], credits: 6 },
    { apExam: 'Art History', apScore: 5, tamuCourses: ['ARTS 149', 'ARTS 150'], credits: 6 },
    { apExam: 'Music Theory', apScore: 3, tamuCourses: ['MUSC 204', 'MUSC 208'], credits: 3 },
    { apExam: 'Music Theory', apScore: 4, tamuCourses: ['MUSC 204', 'MUSC 208'], credits: 3 },
    { apExam: 'Music Theory', apScore: 5, tamuCourses: ['MUSC 204', 'MUSC 208'], credits: 3 },
    { apExam: 'Studio Art: Drawing', apScore: 3, tamuCourses: ['ARTS 103'], credits: 3 },
    { apExam: 'Studio Art: Drawing', apScore: 4, tamuCourses: ['ARTS 103', 'ARTS 111'], credits: 6 },
    { apExam: 'Studio Art: Drawing', apScore: 5, tamuCourses: ['ARTS 103', 'ARTS 111'], credits: 6 },
    { apExam: 'Studio Art: 2-D Design', apScore: 3, tamuCourses: ['ARTS 103'], credits: 3 },
    { apExam: 'Studio Art: 2-D Design', apScore: 4, tamuCourses: ['ARTS 103', 'ARTS 111'], credits: 6 },
    { apExam: 'Studio Art: 2-D Design', apScore: 5, tamuCourses: ['ARTS 103', 'ARTS 111'], credits: 6 },
    { apExam: 'Studio Art: 3-D Design', apScore: 3, tamuCourses: ['ARTS 103'], credits: 3 },
    { apExam: 'Studio Art: 3-D Design', apScore: 4, tamuCourses: ['ARTS 103'], credits: 3 },
    { apExam: 'Studio Art: 3-D Design', apScore: 5, tamuCourses: ['ARTS 103'], credits: 3 },
];
// ── Lookup helpers ──────────────────────────────────────────────

/** All unique TAMU course codes that appear in the table */
export const ALL_TAMU_COURSES: string[] = [
    ...new Set(AP_EQUIVALENCIES.flatMap(e => e.tamuCourses)),
].sort();

/** Find all AP equivalencies that award credit for a given TAMU course (case-insensitive) */
export function findApForCourse(tamuCourse: string): APEquivalency[] {
    const upper = tamuCourse.toUpperCase().trim();
    return AP_EQUIVALENCIES.filter(e =>
        e.tamuCourses.some(c => c.toUpperCase() === upper)
    );
}

/** Get unique AP exam names */
export const AP_EXAM_NAMES: string[] = [
    ...new Set(AP_EQUIVALENCIES.map(e => e.apExam)),
].sort();
