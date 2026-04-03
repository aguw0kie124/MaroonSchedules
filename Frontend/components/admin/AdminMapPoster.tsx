import React, { useState } from 'react';
import { View, StyleSheet, Text, TextInput, ScrollView, Alert, Platform } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { API_URL } from '../../config';

function roundToNearestFiveMinutes(value: Date) {
  const next = new Date(value);
  next.setSeconds(0, 0);
  const roundedMinutes = Math.round(next.getMinutes() / 5) * 5;
  next.setMinutes(roundedMinutes);
  return next;
}

export function AdminMapPoster() {
  const { COLORS, theme } = useTheme();
  const { user } = useUser();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [startTime, setStartTime] = useState(() => roundToNearestFiveMinutes(new Date()));
  const [loading, setLoading] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updateDatePart = (nextValue: Date) => {
    setStartTime((current) => {
      const next = new Date(current);
      next.setFullYear(nextValue.getFullYear(), nextValue.getMonth(), nextValue.getDate());
      return next;
    });
  };

  const updateTimePart = (nextValue: Date) => {
    setStartTime((current) => {
      const next = new Date(current);
      next.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
      return next;
    });
  };

  const handleDateChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (!selectedValue) return;
    updateDatePart(selectedValue);
  };

  const handleTimeChange = (_event: DateTimePickerEvent, selectedValue?: Date) => {
    if (!selectedValue) return;
    updateTimePart(selectedValue);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !address.trim()) {
      Alert.alert('Incomplete', 'Please provide a title and address.');
      return;
    }

    setLoading(true);
    try {
      if (isNaN(startTime.getTime())) {
        throw new Error('Invalid date or time format');
      }

      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      const res = await fetch(`${API_URL}/admin/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clerk_id: user?.id,
          title: title.trim(),
          description: description.trim(),
          lat: 0, // Fallback lat since map is removed
          lng: 0, // Fallback lng since map is removed
          location_name: address.trim(),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString()
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create event');
      }

      Alert.alert('Success', 'Event posted to the featured tab!');
      setTitle('');
      setDescription('');
      setAddress('');
      setStartTime(roundToNearestFiveMinutes(new Date()));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background
    },
    formContainer: {
      flex: 1,
      padding: 24,
      paddingTop: 60
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginBottom: 24
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textPrimary,
      marginTop: 16,
      marginBottom: 6
    },
    input: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      padding: 12,
      color: COLORS.textPrimary,
      fontSize: 16,
    },
    pickerWrap: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: 12,
      overflow: 'hidden',
      minHeight: Platform.OS === 'ios' ? undefined : 56,
    },
    picker: {
      alignSelf: Platform.OS === 'ios' ? 'flex-start' : 'stretch',
    },
    pickerValueMeta: {
      color: COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    pickerValue: {
      color: COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      paddingHorizontal: 14,
      paddingTop: 4,
      paddingBottom: 8,
      backgroundColor: COLORS.background,
    },
    textArea: {
      height: 100,
      textAlignVertical: 'top'
    }
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.formContainer}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.title}>Post New Event</Text>
        
        <Text style={styles.label}>Event Title</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Free Pizza at Rudder" 
          placeholderTextColor={COLORS.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Location / Address</Text>
        <TextInput 
          style={styles.input} 
          placeholder="e.g. Rudder Plaza" 
          placeholderTextColor={COLORS.textTertiary}
          value={address}
          onChangeText={setAddress}
        />

        <Text style={styles.label}>Date</Text>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerValueMeta}>Selected date</Text>
          <Text style={styles.pickerValue}>
            {startTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <DateTimePicker
            value={startTime}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
            onChange={handleDateChange}
            minimumDate={today}
            themeVariant={Platform.OS === 'ios' ? theme : undefined}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
            style={styles.picker}
          />
        </View>

        <Text style={styles.label}>Time</Text>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerValueMeta}>Selected time</Text>
          <Text style={styles.pickerValue}>
            {startTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
          <DateTimePicker
            value={startTime}
            mode="time"
            display="spinner"
            onChange={handleTimeChange}
            is24Hour={false}
            themeVariant={Platform.OS === 'ios' ? theme : undefined}
            textColor={Platform.OS === 'ios' ? COLORS.textPrimary : undefined}
            accentColor={Platform.OS === 'ios' ? COLORS.primary : undefined}
            style={styles.picker}
          />
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput 
          style={[styles.input, styles.textArea]} 
          placeholder="Stop by for free pizza!" 
          placeholderTextColor={COLORS.textTertiary}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <View style={{ marginTop: 32, marginBottom: 60 }}>
          <Button onPress={handleSubmit}>{loading ? "Posting..." : "Post Event"}</Button>
        </View>
      </ScrollView>
    </View>
  );
}
