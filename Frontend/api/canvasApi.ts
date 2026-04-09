import { useQuery } from '@tanstack/react-query';
import { requestJson } from './client';

const fetchCanvasJson = async (url: string) => requestJson(url);

export function useCanvasDashboard() {
  return useQuery({
    queryKey: ['canvas_dashboard'],
    queryFn: () => fetchCanvasJson('/canvas/me/dashboard'),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}

export function useCanvasCourses() {
  return useQuery({
    queryKey: ['canvas_courses'],
    queryFn: () => fetchCanvasJson('/canvas/me/courses'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanvasAssignments() {
  return useQuery({
    queryKey: ['canvas_assignments'],
    queryFn: () => fetchCanvasJson('/canvas/me/assignments'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanvasSchedule() {
  return useQuery({
    queryKey: ['canvas_schedule'],
    queryFn: () => fetchCanvasJson('/canvas/me/schedule'),
    staleTime: 5 * 60 * 1000,
  });
}
