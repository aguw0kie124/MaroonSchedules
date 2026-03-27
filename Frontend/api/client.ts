import { API_URL } from '../config';

const DEFAULT_TIMEOUT_MS = 10000;

async function requestJson(path: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${API_URL}${path}`, {
            ...init,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...(init.headers || {}),
            },
        });

        const rawBody = await response.text();
        const data = rawBody ? JSON.parse(rawBody) : null;

        if (!response.ok) {
            const message =
                data?.detail ||
                data?.message ||
                `${init.method || 'GET'} ${path} failed with status ${response.status}`;
            throw new Error(message);
        }

        return data;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            throw new Error(`Request timed out for ${path}`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ============================================================
// User endpoints
// ============================================================

export const syncUser = async (clerkId: string, email?: string, fullName?: string, profileImageUrl?: string) => {
    return requestJson('/users/sync', {
        method: 'POST',
        body: JSON.stringify({
            clerk_id: clerkId,
            email,
            full_name: fullName,
            profile_image_url: profileImageUrl
        }),
    });
};

export const fetchUserProfile = async (clerkId: string) => {
    return requestJson(`/users/${clerkId}`, {}, 8000);
};

export const updateUserProfile = async (clerkId: string, fields: Record<string, any>) => {
    return requestJson(`/users/${clerkId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(fields),
    });
};

// ============================================================
// Course endpoints
// ============================================================

export const fetchCourses = async (params: any = {}) => {
    return requestJson('/courses/search', {
        method: 'POST',
        body: JSON.stringify(params),
    });
};

export const fetchCourseById = async (courseId: string) => {
    return requestJson(`/courses/${courseId}`);
};

export const fetchSectionById = async (sectionId: string) => {
    return requestJson(`/sections/${sectionId}`);
};

export const fetchTerms = async () => {
    return requestJson('/terms');
};

export const generateSchedules = async (courseIds: string[]) => {
    const queryParams = courseIds.map(id => `course_ids=${id}`).join('&');
    return requestJson(`/schedules/generate?${queryParams}`);
};

// ============================================================
// Schedule endpoints
// ============================================================

export const fetchSchedules = async (userId: string) => {
    return requestJson(`/user/schedule?user_id=${userId}`);
};

export const createSchedule = async (payload: { user_id: string; name: string; term_code: string }) => {
    return requestJson('/schedules', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const addSectionToSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    return requestJson('/user/schedule/add', {
        method: 'POST',
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
};

export const removeSectionFromSchedule = async (scheduleId: string, sectionId: string, userId: string = "default_user") => {
    return requestJson('/user/schedule/remove', {
        method: 'DELETE',
        body: JSON.stringify({ schedule_id: scheduleId, section_id: sectionId, user_id: userId }),
    });
};

export const deleteSchedule = async (scheduleId: string, userId: string) => {
    return requestJson(`/schedules/${scheduleId}?user_id=${userId}`, {
        method: 'DELETE',
    });
};

// ============================================================
// Campus Hub endpoints
// ============================================================

export const fetchCampusOverview = async (clerkId: string) => {
    return requestJson(`/campus/overview?clerk_id=${encodeURIComponent(clerkId)}`);
};

export const fetchCampusEvents = async (clerkId?: string, limit = 8) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (clerkId) params.set('clerk_id', clerkId);
    return requestJson(`/campus/events?${params.toString()}`);
};

export const saveCampusEventRsvp = async (payload: { clerk_id: string; event_id: string; response: string }) => {
    return requestJson('/campus/events/rsvp', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const discoverCampusNetwork = async (clerkId: string, query?: string, major?: string, limit = 8) => {
    const params = new URLSearchParams({
        clerk_id: clerkId,
        limit: String(limit),
    });
    if (query) params.set('query', query);
    if (major) params.set('major', major);
    return requestJson(`/campus/network/discover?${params.toString()}`);
};

export const requestCampusConnection = async (payload: { requester_id: string; recipient_id: string }) => {
    return requestJson('/campus/network/request', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const fetchCampusConnectors = async (clerkId: string) => {
    return requestJson(`/campus/connectors?clerk_id=${encodeURIComponent(clerkId)}`);
};

export const captureCampusConnector = async (payload: {
    clerk_id: string;
    system_id: string;
    source_url: string;
    page_title?: string | null;
    page_html?: string | null;
    page_text?: string | null;
    cookie_names?: string[] | null;
}) => {
    return requestJson('/campus/connectors/capture', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
};

export const deleteCampusConnector = async (clerkId: string, systemId: string) => {
    return requestJson(`/campus/connectors/${encodeURIComponent(systemId)}?clerk_id=${encodeURIComponent(clerkId)}`, {
        method: 'DELETE',
    });
};
