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
      const raw = (await res.json()) as CampusEventResponse[];
      
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
            event_types: event.has_food ? ['Free Food'] : null,
            group_title: event.host_name || event.source_name || '',
            location_lat: event.location_lat ?? null,
            location_lng: event.location_lng ?? null,
            has_food: !!event.has_food,
            food_confidence: event.food_confidence ?? 0,
            food_type: event.food_type ?? null,
            categories: event.categories || undefined,
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
      console.error('[useEvents] Fetch error:', err);
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
