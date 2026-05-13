export interface PrereqGroup {
  operator: 'AND' | 'OR' | string;
  courses: string[];
}

export interface CourseRecord {
  id: string;
  department: string;
  number: string;
  title: string;
  credit_hours: number;
  description?: string | null;
  prerequisites: PrereqGroup[];
  corequisites: string[];
  raw_prereq_text?: string | null;
  source_url: string;
  scraped_at: string;
  grade_summary?: {
    avg_gpa?: number | null;
    offering_count: number;
    total_enrolled: number;
  };
  grade_distributions?: GradeDistributionResponse;
}

export interface SemesterSlot {
  semester: number;
  year_label: string;
  season: string;
  courses: string[];
}

export interface DegreePlanRecord {
  id: string;
  college: string;
  department: string;
  degree: string;
  major: string;
  catalog_year: string;
  total_hours: number;
  semesters: SemesterSlot[];
  source_url: string;
  scraped_at: string;
  resolved_courses?: Record<string, CourseRecord>;
}

export interface GradeDistributionRecord {
  id: string;
  department: string;
  course_number: string;
  course_title?: string | null;
  instructor: string;
  term: string;
  section?: string | null;
  gpa?: number | null;
  grades: Record<string, number>;
  total_enrolled: number;
  source_url: string;
  scraped_at: string;
}

export interface GradeDistributionResponse {
  department: string;
  number: string;
  by_instructor: Record<string, GradeDistributionRecord[]>;
  items: GradeDistributionRecord[];
}

export interface CourseSearchResponse {
  items: CourseRecord[];
  page: number;
  page_size: number;
  total: number;
}

export interface UserCourseProgressItem {
  course_id: string;
  status: 'completed' | 'in_progress' | 'planned';
  grade?: string | null;
  term_taken?: string | null;
  updated_at: string;
  department: string;
  number: string;
  title: string;
  credit_hours: number;
}

export interface UserCourseProgressResponse {
  items: UserCourseProgressItem[];
  selected_plan?: {
    user_id: string;
    plan_id: string;
    catalog_year?: string | null;
    major?: string;
    degree?: string;
    college?: string;
  } | null;
}

export interface PlanCompletionResponse {
  plan_id: string;
  completed_hours: number;
  total_hours: number;
  remaining_hours: number;
  gpa?: number | null;
  semesters: Array<{
    semester: SemesterSlot;
    completed_hours: number;
    total_hours: number;
    courses: Array<{
      course_id?: string;
      code: string;
      title?: string;
      credit_hours?: number;
      status: string;
      grade?: string | null;
    }>;
  }>;
  selected_plan?: UserCourseProgressResponse['selected_plan'];
}
