import { API_URL } from '../config';

// ============================================================
// User endpoints
// ============================================================

export const syncUser = async (clerkId: string, email?: string, fullName?: string, profileImageUrl?: string) => {
    const response = await fetch(`${API_URL}/users/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            clerk_id: clerkId,
            email,
            full_name: fullName,
            profile_image_url: profileImageUrl
        }),
    });
    if (!response.ok) throw new Error('Failed to sync user');
    return response.json();
};

export const fetchUserProfile = async (clerkId: string) => {
    const response = await fetch(`${API_URL}/users/${clerkId}`);
    if (!response.ok) throw new Error('Failed to fetch user profile');
    return response.json();
};

export const updateUserProfile = async (clerkId: string, fields: Record<string, any>) => {
    const response = await fetch(`${API_URL}/users/${clerkId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return response.json();
};

// ============================================================
// Course endpoints
// ============================================================

export const fetchCourses = async (params: any = {}) => {
    const response = await fetch(`${API_URL}/courses/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

export const fetchSectionById = async (sectionId: string) => {
    const response = await fetch(`${API_URL}/sections/${sectionId}`);
    if (!response.ok) throw new Error('Failed to fetch section detail');
    return response.json();
};

export const fetchTerms = async () => {
    const response = await fetch(`${API_URL}/terms`);
    if (!response.ok) throw new Error('Failed to fetch terms');
    return response.json();
};

export const generateSchedules = async (courseIds: string[]) => {
    const queryParams = courseIds.map(id => `course_ids=${id}`).join('&');
    const response = await fetch(`${API_URL}/schedules/generate?${queryParams}`);
    if (!response.ok) throw new Error('Failed to generate schedules');
    return response.json();
};

// ============================================================
// Schedule endpoints
// ============================================================

export const fetchSchedules = async (userId: string) => {
    const response = await fetch(`${API_URL}/user/schedule?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch schedules');
    return response.json();
};

export const createSchedule = async (payload: { user_id: string; name: string; term_code: string }) => {
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
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to add section');
    return response.json();
};

export const removeSectionFromSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    const response = await fetch(`${API_URL}/user/schedule/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to remove section');
    return response.json();
};

export const deleteSchedule = async (scheduleId: string, userId: string) => {
    const response = await fetch(`${API_URL}/schedules/${scheduleId}?user_id=${userId}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete schedule');
    return response.json();
};
