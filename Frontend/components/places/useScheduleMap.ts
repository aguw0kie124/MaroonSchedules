import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/clerk-expo";
import { fetchSchedules } from "../../api/client";
import { useCampusHubStore } from "../../store/campusHubStore";
import { BUILDINGS } from "../../data/campus";
import { useEventStore } from "../../store/eventStore";
import type { CampusLocation, LocationType, ScheduleMeetingEntry, ScheduleMapOption } from "./types";
import { resolveScheduleBuilding, getCanonicalLocationName } from "./campusData";

export function useScheduleMap(fullCampusIndex: CampusLocation[], selectedDate: Date = new Date()) {
  const { user } = useUser();
  const campusHubSnapshot = useCampusHubStore((state) => state.snapshot);
  const scheduledEvents = useEventStore((state) => state.scheduledEvents);

  const [savedSchedules, setSavedSchedules] = useState<any[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!user?.id) {
      setSavedSchedules([]);
      setIsLoadingSchedules(false);
      return;
    }

    setIsLoadingSchedules(true);
    fetchSchedules(user.id)
      .then((data) => {
        if (!cancelled) {
          setSavedSchedules(Array.isArray(data) ? data : []);
        }
      })
      .catch((error) => {
        console.warn("Failed to fetch saved schedules", error);
        if (!cancelled) {
          setSavedSchedules([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingSchedules(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  function parseTimeToMinutes(timeStr: string): number {
    if (!timeStr || timeStr === "Time TBA") return 0;
    const normalized = timeStr.replace(/[\u202f\u00a0\s]+/g, " ").trim();
    const matchAMPM = normalized.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (matchAMPM) {
      let [_, hrs, mins, ampm] = matchAMPM;
      let h = parseInt(hrs);
      const m = parseInt(mins);
      if (ampm.toUpperCase() === "PM" && h < 12) h += 12;
      if (ampm.toUpperCase() === "AM" && h === 12) h = 0;
      return h * 60 + m;
    }
    const matchSimple = normalized.match(/(\d+):(\d+)/);
    if (matchSimple) {
      let h = parseInt(matchSimple[1]);
      const m = parseInt(matchSimple[2]);
      if (h < 7) h += 12; 
      return h * 60 + m;
    }
    return 0;
  }

  const scheduleOptions = useMemo(() => {
    const options: ScheduleMapOption[] = [];
    const uploadedCourses = campusHubSnapshot?.academic?.courses || [];
    
    const dayMap: Record<number, string> = { 1: "M", 2: "T", 3: "W", 4: "R", 5: "F" };
    const currentDayChar = dayMap[selectedDate.getDay()];
    
    const dStart = new Date(selectedDate);
    dStart.setHours(0, 0, 0, 0);
    const selectedDateStart = dStart.getTime();
    
    const dEnd = new Date(selectedDate);
    dEnd.setHours(23, 59, 59, 999);
    const selectedDateEnd = dEnd.getTime();

    if (uploadedCourses.length > 0) {
      const uploadedLabel = campusHubSnapshot?.academic?.scheduleName?.trim() || "Uploaded Schedule";
      const uploadedEntries = uploadedCourses
        .filter((course: any) => {
          if (Array.isArray(course.days) && course.days.length > 0) {
            return course.days.includes(currentDayChar);
          }
          return true;
        })
        .map((course: any) => {
          const locationLabel = (course.location || "").trim();
          const [building, ...roomParts] = locationLabel.split(/\s+/);
          return {
            id: `uploaded:${course.id || course.code}`,
            code: course.code || "Class",
            name: course.name || "Untitled Class",
            building,
            room: roomParts.join(" ").trim(),
            days: Array.isArray(course.days) ? course.days : [],
            timeLabel: course.time || "Time TBA",
            locationLabel,
            scheduleLabel: uploadedLabel,
            type: "class",
          } as ScheduleMeetingEntry;
        });

      if (uploadedEntries.length > 0) {
        options.push({ id: "uploaded", label: uploadedLabel, source: "uploaded", entries: uploadedEntries });
      }
    }

    savedSchedules.forEach((schedule: any) => {
      const scheduleLabel = schedule.name || "Saved Schedule";
      const scheduleEntries = (schedule.sections || [])
        .filter((section: any) => {
          const meeting = (section.meetings || [])[0] || {};
          const days = Array.isArray(meeting.daysOfWeek) ? meeting.daysOfWeek : [];
          if (days.length > 0) return days.includes(currentDayChar);
          return true;
        })
        .map((section: any) => {
          const meeting = (section.meetings || [])[0] || {};
          const building = (meeting.building || "").trim();
          const room = (meeting.room || "").trim();
          const locationLabel = `${building} ${room}`.trim();
          return {
            id: `saved:${schedule.schedule_id}:${section.section_id || section.id || section.sectionNumber || section.courseNumber}`,
            code: `${section.dept || ""} ${section.courseNumber || ""}`.trim() || `Section ${section.sectionNumber || "TBA"}`,
            name: section.courseTitle || "Untitled Class",
            building,
            room,
            days: Array.isArray(meeting.daysOfWeek) ? meeting.daysOfWeek : [],
            timeLabel: meeting.beginTime && meeting.endTime ? `${meeting.beginTime}-${meeting.endTime}` : "Time TBA",
            locationLabel,
            scheduleLabel,
            type: "class",
          } as ScheduleMeetingEntry;
        });

      if (scheduleEntries.length > 0) {
        options.push({ id: `saved:${schedule.schedule_id}`, label: scheduleLabel, source: "saved", entries: scheduleEntries });
      }
    });

    if (scheduledEvents.length > 0) {
      const personalEntries = scheduledEvents
        .filter((event) => {
          const eventTime = event.date_ts * 1000;
          return eventTime >= selectedDateStart && eventTime <= selectedDateEnd;
        })
        .map((event) => {
          const building = event.location?.split(/\s+/)[0] || "";
          return {
            id: `event:${event.id}`,
            code: "Event",
            name: event.title,
            building,
            room: "",
            days: [],
            timeLabel: new Date(event.date_ts * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            locationLabel: event.location || "On Campus",
            scheduleLabel: "Today's Events",
            lat: event.location_lat,
            lng: event.location_lng,
            date_ts: event.date_ts,
            type: "event",
          } as any;
        });

      if (personalEntries.length > 0) {
        options.push({ id: "events", label: "Interactions", source: "personal", entries: personalEntries });
      }
    }

    options.forEach(opt => {
      opt.entries.sort((a: any, b: any) => {
        const tA = parseTimeToMinutes(a.timeLabel) || (a.date_ts ? (new Date(a.date_ts * 1000).getHours() * 60 + new Date(a.date_ts * 1000).getMinutes()) : 0);
        const tB = parseTimeToMinutes(b.timeLabel) || (b.date_ts ? (new Date(b.date_ts * 1000).getHours() * 60 + new Date(b.date_ts * 1000).getMinutes()) : 0);
        if (tA !== tB) return tA - tB;
        return (a.date_ts || 0) - (b.date_ts || 0);
      });
      opt.entries.forEach((entry, idx) => {
        (entry as any).sequenceIndex = idx + 1;
      });
    });

    return options;
  }, [campusHubSnapshot?.academic?.courses, campusHubSnapshot?.academic?.scheduleName, savedSchedules, scheduledEvents, selectedDate]);

  useEffect(() => {
    if (scheduleOptions.length === 0) {
      if (activeScheduleId !== null) setActiveScheduleId(null);
      return;
    }
    if (!activeScheduleId || !scheduleOptions.some((o) => o.id === activeScheduleId)) {
      setActiveScheduleId(scheduleOptions[0].id);
    }
  }, [activeScheduleId, scheduleOptions]);

  const activeScheduleOption = useMemo(
    () => scheduleOptions.find((o) => o.id === activeScheduleId) || scheduleOptions[0] || null,
    [activeScheduleId, scheduleOptions]
  );

  const nextEntry = useMemo(() => {
    if (!activeScheduleOption || !activeScheduleOption.entries.length) return null;
    const isToday = new Date().toDateString() === selectedDate.toDateString();
    let entry: any = null;
    if (!isToday) {
      entry = activeScheduleOption.entries[0];
    } else {
      const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
      entry = activeScheduleOption.entries.find((e: any) => parseTimeToMinutes(e.timeLabel) > nowMinutes) || 
              activeScheduleOption.entries[activeScheduleOption.entries.length - 1];
    }
    
    if (entry) {
      // Resolve coordinates for this entry
      const b = resolveScheduleBuilding(entry.building, entry.locationLabel);
      if (b) {
        return { ...entry, lat: b.latitude, lng: b.longitude };
      }
    }
    return entry;
  }, [activeScheduleOption, selectedDate]);

  const scheduleLocations = useMemo(() => {
    if (!activeScheduleOption) return [];
    const grouped = new Map<string, { building: any; classMeetings: ScheduleMeetingEntry[] }>();
    activeScheduleOption.entries.forEach((entry: any) => {
      let building: any = resolveScheduleBuilding(entry.building, entry.locationLabel);
      if (!building && entry.lat && entry.lng) {
        building = { name: entry.locationLabel, shortName: entry.name.slice(0, 8), latitude: entry.lat, longitude: entry.lng };
      }
      if (!building) return;
      const canonicalName = getCanonicalLocationName(building.name);
      const existing = grouped.get(canonicalName);
      if (existing) {
        existing.classMeetings.push(entry);
      } else {
        grouped.set(canonicalName, { building, classMeetings: [entry] });
      }
    });

    return Array.from(grouped.entries()).map(([locationName, group]) => {
      const existingLocation = fullCampusIndex.find((l) => l.location === locationName);
      return {
        ...(existingLocation || { location: locationName, percent_full: 0, type: "Academic" as LocationType, is_live: false, available_seats: null, coord: { lat: group.building.latitude, lng: group.building.longitude } }),
        location: locationName,
        shortName: group.building.shortName,
        percent_full: 0,
        type: "Academic" as LocationType,
        is_live: false,
        available_seats: null,
        coord: { lat: group.building.latitude, lng: group.building.longitude },
        source: "schedule" as const,
        scheduleLabel: activeScheduleOption.label,
        description: `${group.classMeetings.length} class location${group.classMeetings.length === 1 ? "" : "s"} from ${activeScheduleOption.label}.`,
        classMeetings: group.classMeetings.sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex),
        sequenceIndex: Math.min(...group.classMeetings.map((m: any) => m.sequenceIndex || 999)),
      } satisfies CampusLocation;
    });
  }, [activeScheduleOption, fullCampusIndex]);

  const scheduleSummaryLabel = useMemo(() => {
    if (isLoadingSchedules) return "Loading your Today map...";
    if (!activeScheduleOption) return "No schedule mapped yet";
    const classCount = activeScheduleOption.entries.length;
    return `${classCount} class${classCount === 1 ? "" : "es"} across ${scheduleLocations.length} building${scheduleLocations.length === 1 ? "" : "s"}`;
  }, [activeScheduleOption, isLoadingSchedules, scheduleLocations.length]);

  return { scheduleOptions, activeScheduleOption, activeScheduleId, setActiveScheduleId, scheduleLocations, scheduleSummaryLabel, isLoadingSchedules, nextEntry };
}
