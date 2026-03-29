import { useState, useEffect, useMemo } from "react";
import { useUser } from "@clerk/clerk-expo";
import { fetchSchedules } from "../../api/client";
import { useCampusHubStore } from "../../store/campusHubStore";
import { BUILDINGS } from "../../data/campus";
import type { CampusLocation, LocationType, ScheduleMeetingEntry, ScheduleMapOption } from "./types";
import { resolveScheduleBuilding, getCanonicalLocationName } from "./campusData";

export function useScheduleMap(fullCampusIndex: CampusLocation[]) {
  const { user } = useUser();
  const campusHubSnapshot = useCampusHubStore((state) => state.snapshot);

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

  const scheduleOptions = useMemo(() => {
    const options: ScheduleMapOption[] = [];
    const uploadedCourses = campusHubSnapshot?.academic?.courses || [];

    if (uploadedCourses.length > 0) {
      const uploadedLabel =
        campusHubSnapshot?.academic?.scheduleName?.trim() || "Uploaded Schedule";
      const uploadedEntries = uploadedCourses
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
          } satisfies ScheduleMeetingEntry;
        })
        .filter((entry) => resolveScheduleBuilding(entry.building, entry.locationLabel));

      if (uploadedEntries.length > 0) {
        options.push({
          id: "uploaded",
          label: uploadedLabel,
          source: "uploaded",
          entries: uploadedEntries,
        });
      }
    }

    savedSchedules.forEach((schedule: any) => {
      const scheduleLabel = schedule.name || "Saved Schedule";
      const scheduleEntries = (schedule.sections || [])
        .map((section: any) => {
          const meeting = (section.meetings || [])[0] || {};
          const building = (meeting.building || "").trim();
          const room = (meeting.room || "").trim();
          const locationLabel = `${building} ${room}`.trim();
          return {
            id: `saved:${schedule.schedule_id}:${section.section_id || section.id || section.sectionNumber || section.courseNumber}`,
            code:
              `${section.dept || ""} ${section.courseNumber || ""}`.trim() ||
              `Section ${section.sectionNumber || "TBA"}`,
            name: section.courseTitle || "Untitled Class",
            building,
            room,
            days: Array.isArray(meeting.daysOfWeek) ? meeting.daysOfWeek : [],
            timeLabel:
              meeting.beginTime && meeting.endTime
                ? `${meeting.beginTime}-${meeting.endTime}`
                : "Time TBA",
            locationLabel,
            scheduleLabel,
          } satisfies ScheduleMeetingEntry;
        })
        .filter((entry: ScheduleMeetingEntry) => resolveScheduleBuilding(entry.building, entry.locationLabel));

      if (scheduleEntries.length > 0) {
        options.push({
          id: `saved:${schedule.schedule_id}`,
          label: scheduleLabel,
          source: "saved",
          entries: scheduleEntries,
        });
      }
    });

    return options;
  }, [
    campusHubSnapshot?.academic?.courses,
    campusHubSnapshot?.academic?.scheduleName,
    savedSchedules,
  ]);

  useEffect(() => {
    if (scheduleOptions.length === 0) {
      if (activeScheduleId !== null) {
        setActiveScheduleId(null);
      }
      return;
    }

    if (!activeScheduleId || !scheduleOptions.some((option) => option.id === activeScheduleId)) {
      setActiveScheduleId(scheduleOptions[0].id);
    }
  }, [activeScheduleId, scheduleOptions]);

  const activeScheduleOption = useMemo(
    () =>
      scheduleOptions.find((option) => option.id === activeScheduleId) ||
      scheduleOptions[0] ||
      null,
    [activeScheduleId, scheduleOptions],
  );

  const scheduleLocations = useMemo(() => {
    if (!activeScheduleOption) {
      return [];
    }

    const grouped = new Map<
      string,
      { building: (typeof BUILDINGS)[number]; classMeetings: ScheduleMeetingEntry[] }
    >();

    activeScheduleOption.entries.forEach((entry) => {
      const building = resolveScheduleBuilding(entry.building, entry.locationLabel);
      if (!building) return;

      const canonicalName = getCanonicalLocationName(building.name);
      const existing = grouped.get(canonicalName);
      if (existing) {
        existing.classMeetings.push(entry);
        return;
      }

      grouped.set(canonicalName, {
        building,
        classMeetings: [entry],
      });
    });

    return Array.from(grouped.entries()).map(([locationName, group]) => {
      const existingLocation = fullCampusIndex.find(
        (location) => location.location === locationName,
      );
      return {
        ...(existingLocation || {
          location: locationName,
          percent_full: 0,
          type: "Academic" as LocationType,
          is_live: false,
          available_seats: null,
          coord: {
            lat: group.building.latitude,
            lng: group.building.longitude,
          },
        }),
        location: locationName,
        shortName: group.building.shortName,
        percent_full: 0,
        type: "Academic" as LocationType,
        is_live: false,
        available_seats: null,
        coord: {
          lat: group.building.latitude,
          lng: group.building.longitude,
        },
        source: "schedule" as const,
        scheduleLabel: activeScheduleOption.label,
        description: `${group.classMeetings.length} class location${group.classMeetings.length === 1 ? "" : "s"} from ${activeScheduleOption.label}.`,
        classMeetings: group.classMeetings,
      } satisfies CampusLocation;
    });
  }, [activeScheduleOption, fullCampusIndex]);

  const scheduleSummaryLabel = useMemo(() => {
    if (isLoadingSchedules) {
      return "Loading your class map...";
    }

    if (!activeScheduleOption) {
      return "No schedule mapped yet";
    }

    const classCount = activeScheduleOption.entries.length;
    const buildingCount = scheduleLocations.length;
    return `${classCount} class${classCount === 1 ? "" : "es"} across ${buildingCount} building${buildingCount === 1 ? "" : "s"}`;
  }, [activeScheduleOption, isLoadingSchedules, scheduleLocations.length]);

  return {
    scheduleOptions,
    activeScheduleOption,
    activeScheduleId,
    setActiveScheduleId,
    scheduleLocations,
    scheduleSummaryLabel,
    isLoadingSchedules,
  };
}
