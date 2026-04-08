import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  professor: string;
  rating: number;
  time: string;
  days: string[];
  location: string;
  color: string;
  startTime: number; // in minutes from midnight
  endTime: number;
  prerequisites?: string;
  description?: string;
}

interface CourseStore {
  courses: Course[];
  savedCourses: Course[];
  addCourse: (course: Course) => void;
  removeCourse: (id: string) => void;
  saveCourse: (course: Course) => void;
  unsaveCourse: (id: string) => void;
}

const courseColors = [
  '#FFCDD2', // Red 100
  '#F8BBD0', // Pink 100
  '#E1BEE7', // Purple 100
  '#D1C4E9', // Deep Purple 100
  '#C5CAE9', // Indigo 100
  '#BBDEFB', // Blue 100
];

let colorIndex = 0;

const getNextColor = () => {
  const color = courseColors[colorIndex % courseColors.length];
  colorIndex++;
  return color;
};

const initialCourses: Course[] = [
  {
    id: '1',
    code: 'CSCE 221',
    name: 'Data Structures & Algorithms',
    credits: 3,
    professor: 'Dr. Smith',
    rating: 4.6,
    time: '10:30-11:45',
    days: ['M', 'W', 'F'],
    location: 'HRBB 124',
    color: getNextColor(),
    startTime: 630, // 10:30
    endTime: 705, // 11:45
    prerequisites: 'CSCE 121',
    description: 'Study of data structures, their implementations, and algorithms.',
  },
  {
    id: '2',
    code: 'MATH 304',
    name: 'Linear Algebra',
    credits: 3,
    professor: 'Dr. Johnson',
    rating: 4.2,
    time: '13:00-14:15',
    days: ['T', 'Th'],
    location: 'BLOC 161',
    color: getNextColor(),
    startTime: 780, // 13:00
    endTime: 855, // 14:15
    prerequisites: 'MATH 152',
    description: 'Vector spaces, linear transformations, matrices, and determinants.',
  },
];

export const useCourseStore = create<CourseStore>()(
  persist(
    (set) => ({
      courses: initialCourses,
      savedCourses: [],
      addCourse: (course) =>
        set((state) => ({
          courses: [...state.courses, { ...course, color: getNextColor() }],
        })),
      removeCourse: (id) =>
        set((state) => ({
          courses: state.courses.filter((c) => c.id !== id),
        })),
      saveCourse: (course) =>
        set((state) => ({
          savedCourses: [...state.savedCourses, course],
        })),
      unsaveCourse: (id) =>
        set((state) => ({
          savedCourses: state.savedCourses.filter((c) => c.id !== id),
        })),
    }),
    {
      name: 'course-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);