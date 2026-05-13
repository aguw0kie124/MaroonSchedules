import { requestJson } from './client';

function toQuery(params: Record<string, unknown>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  });
  return search.toString();
}

export const searchCourses = (params: Record<string, unknown>) =>
  requestJson(`/courses/search?${toQuery(params)}`);

export const getCourseDetail = (dept: string, number: string) =>
  requestJson(`/courses/${encodeURIComponent(dept)}/${encodeURIComponent(number)}`);

export const getDegreePlans = (params: Record<string, unknown>) =>
  requestJson(`/courses/plans?${toQuery(params)}`);

export const getDegreePlan = (planId: string) =>
  requestJson(`/courses/plans/${encodeURIComponent(planId)}`);

export const getProgress = () => requestJson('/courses/progress');

export const setProgress = (body: Record<string, unknown>) =>
  requestJson('/courses/progress', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getCompletion = (planId: string) =>
  requestJson(`/courses/progress/completion?${toQuery({ plan_id: planId })}`);

export const getGradeDistributions = (dept: string, number: string) =>
  requestJson(`/courses/grades/${encodeURIComponent(dept)}/${encodeURIComponent(number)}`);

export const getSelectedDegreePlan = () => requestJson('/courses/plan-selection');

export const setSelectedDegreePlan = (body: { plan_id: string; catalog_year?: string | null }) =>
  requestJson('/courses/plan-selection', {
    method: 'POST',
    body: JSON.stringify(body),
  });
