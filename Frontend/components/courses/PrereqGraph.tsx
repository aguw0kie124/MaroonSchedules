import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../SharedUI';
import { PrereqGroup } from '../../types/courses';

type Props = {
  groups: PrereqGroup[];
  onCoursePress?: (courseCode: string) => void;
};

export function PrereqGraph({ groups, onCoursePress }: Props) {
  const { COLORS } = useTheme();
  const styles = React.useMemo(() => getStyles(COLORS), [COLORS]);

  if (!groups.length) {
    return <Text style={styles.empty}>No prerequisites listed.</Text>;
  }

  return (
    <View style={styles.container}>
      {groups.map((group, groupIndex) => (
        <View key={`${group.operator}-${groupIndex}`} style={styles.group}>
          {group.courses.map((course, courseIndex) => (
            <React.Fragment key={course}>
              <Pressable onPress={() => onCoursePress?.(course)} style={styles.courseBox}>
                <Text style={styles.courseText}>{course}</Text>
              </Pressable>
              {courseIndex < group.courses.length - 1 ? (
                <Text style={styles.operator}>{group.operator}</Text>
              ) : null}
            </React.Fragment>
          ))}
          {groupIndex < groups.length - 1 ? <Text style={styles.arrow}>→</Text> : null}
        </View>
      ))}
    </View>
  );
}

const getStyles = (COLORS: any) =>
  StyleSheet.create({
    container: {
      gap: 10,
    },
    group: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 8,
    },
    courseBox: {
      backgroundColor: COLORS.surfaceElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    courseText: {
      color: COLORS.textPrimary,
      fontWeight: '700',
    },
    operator: {
      color: COLORS.textSecondary,
      fontWeight: '700',
    },
    arrow: {
      color: COLORS.primary,
      fontWeight: '700',
      marginLeft: 2,
    },
    empty: {
      color: COLORS.textSecondary,
    },
  });
