import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';
import { API_URL } from '../config';

const fetchWithToken = async (url: string, getToken: () => Promise<string | null>) => {
  const token = await getToken();
  if (!token) throw new Error('Authentication required');

  const res = await fetch(`${API_URL}${url}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Canvas data: ${errorText}`);
  }

  return res.json();
};

export function useCanvasDashboard() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['canvas_dashboard'],
    queryFn: () => fetchWithToken('/canvas/me/dashboard', getToken),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}

export function useCanvasCourses() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['canvas_courses'],
    queryFn: () => fetchWithToken('/canvas/me/courses', getToken),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanvasAssignments() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['canvas_assignments'],
    queryFn: () => fetchWithToken('/canvas/me/assignments', getToken),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanvasSchedule() {
  const { getToken } = useAuth();
  return useQuery({
    queryKey: ['canvas_schedule'],
    queryFn: () => fetchWithToken('/canvas/me/schedule', getToken),
    staleTime: 5 * 60 * 1000,
  });
}
