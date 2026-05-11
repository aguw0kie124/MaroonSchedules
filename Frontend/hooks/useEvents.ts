import { useState, useEffect } from 'react';
import { TAMU_EVENTS_API, CampusEventResponse, TAMUEvent, stripHtml, getSearchBlob, classifyCategory, getSocialMode } from '../components/events/EventUtils';

export function useEvents() {
  const [events, setEvents] = useState<TAMUEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(TAMU_EVENTS_API);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { events?: CampusEventResponse[] } | CampusEventResponse[];
      const raw = Array.isArray(payload) ? payload : payload.events || [];
      
      const parsed: TAMUEvent[] = raw
        .filter((event) => event && event.event_id && event.title && event.start_time)
        .map((event) => {
          const startTs = Math.floor(new Date(event.start_time).getTime() / 1000);
          const endTs = event.end_time ? Math.floor(new Date(event.end_time).getTime() / 1000) : null;
          return {
            id: event.event_id,
            title: stripHtml(event.title),
            date_ts: Number.isFinite(startTs) ? startTs : 0,
            date_iso: event.start_time,
            date2_ts: Number.isFinite(endTs as number) ? endTs : null,
            location: event.location ? stripHtml(event.location) : null,
            location_title: event.location ? stripHtml(event.location) : null,
            description: event.description || event.summary || null,
            url: event.link || event.source_url || '',
            tags: event.tags || null,
            access_tags: event.access_tags || null,
            event_types: event.has_food ? ['Free Food'] : null,
            group_title: event.organization_name || event.business_name || event.host_name || event.source_name || '',
            location_lat: event.location_lat ?? null,
            location_lng: event.location_lng ?? null,
            has_food: !!event.has_food,
            food_confidence: event.food_confidence ?? 0,
            food_type: event.food_type ?? null,
            categories: event.categories || undefined,
            imageUrl: event.image_url ?? null,
            area_label: event.area_label ?? null,
            city: event.city ?? null,
            business_name: event.business_name ?? null,
            is_off_campus: !!event.is_off_campus,
            is_promotion: !!event.is_promotion,
            discount_text: event.discount_text ?? null,
            campus_interest_score: event.campus_interest_score ?? null,
            campus_interest_label: event.campus_interest_label ?? null,
            campus_interest_reasons: event.campus_interest_reasons ?? null,
          };
        })
        .map((event) => {
          const searchBlob = getSearchBlob(event);
          return {
            ...event,
            _searchBlob: searchBlob,
            _category: classifyCategory(event),
            _socialMode: getSocialMode({ ...event, _searchBlob: searchBlob }),
          };
        })
        .sort((a, b) => a.date_ts - b.date_ts);
      
      setEvents(parsed);
    } catch (err: any) {
      console.warn('[useEvents] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return { events, loading, error, reFetch: fetchEvents };
}
