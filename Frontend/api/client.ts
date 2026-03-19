import { API_URL } from '../config';

export const fetchCourses = async (params: any = {}) => {
    // using POST /courses/search to align with the backend
    const response = await fetch(`${API_URL}/courses/search`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to fetch courses');
    return response.json();
};

export const fetchCourseById = async (courseId: string) => {
    const response = await fetch(`${API_URL}/courses/${courseId}`);
    if (!response.ok) throw new Error('Failed to fetch course detail');
    return response.json();
};

export const generateSchedules = async (courseIds: string[]) => {
    const queryParams = courseIds.map(id => `course_ids=${id}`).join('&');
    const response = await fetch(`${API_URL}/schedules/generate?${queryParams}`);
    if (!response.ok) throw new Error('Failed to generate schedules');
    return response.json();
};

export const fetchSchedules = async (userId: string) => {
    const response = await fetch(`${API_URL}/user/schedule?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch schedules');
    return response.json();
};

export const createSchedule = async (payload: { user_id: string, name: string, term_code: string }) => {
    const response = await fetch(`${API_URL}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create schedule');
    return response.json();
};

export const addSectionToSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    const response = await fetch(`${API_URL}/user/schedule/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId })
    });
    if (!response.ok) throw new Error('Failed to add section');
    return response.json();
};

export const removeSectionFromSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    const response = await fetch(`${API_URL}/user/schedule/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId })
    });
    if (!response.ok) throw new Error('Failed to remove section');
    return response.json();
};

export const deleteSchedule = async (scheduleId: string) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete schedule');
    return response.json();
};
