import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { useTheme } from '../SharedUI';
import { Button } from '../Button';
import { useUser } from '@clerk/clerk-expo';
import { requestJson } from '../../api/client';
import * as Linking from 'expo-linking';

export function PendingReviewInterceptor() {
  const { user } = useUser();
  const { COLORS } = useTheme();
  
  const [pendingEvent, setPendingEvent] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user?.id) {
      requestJson(`/admin/events/pending-reviews?clerk_id=${encodeURIComponent(user.id)}`)
        .then(data => {
          if (data && data.id) {
            setPendingEvent(data);
          }
        })
        .catch(err => console.log('Pending review fetch failed', err));
    }
  }, [user?.id]);

  if (!pendingEvent) return null;

  const handleSubmit = async (submitRating: number, submitFeedback?: string) => {
    if (!user?.id) return;
    setSubmitting(true);
    try {
      await requestJson(`/admin/events/${pendingEvent.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          clerk_id: user.id,
          rating: submitRating,
          feedback: submitFeedback || null
        })
      });
      setPendingEvent(null);
      setRating(0);
      setFeedback('');
    } catch (e) {
      console.warn("Failed to submit", e);
      Alert.alert('Review not sent', 'Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRatingPress = (selectedRating: number) => {
    setRating(selectedRating);
    // If it's a good rating and they have a google review link, we just prompt them
    if (selectedRating >= 4 && pendingEvent.google_review_url) {
      // Show Google prompt. We wait for user action.
    }
  };

  const handleLeaveGoogleReview = async () => {
    try {
      if (pendingEvent.google_review_url) {
        const supported = await Linking.canOpenURL(pendingEvent.google_review_url);
        if (!supported) {
          throw new Error('Unsupported review URL');
        }
        await Linking.openURL(pendingEvent.google_review_url);
      }
      await handleSubmit(rating);
    } catch (e) {
      console.warn('Failed to open Google review URL', e);
      Alert.alert('Could not open Google Review', 'The review link looks invalid. You can still leave private feedback below.');
    }
  };

  const handleDismiss = () => {
    setPendingEvent(null);
  };

  const styles = StyleSheet.create({
    centeredView: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: 24,
    },
    modalView: {
      backgroundColor: COLORS.surface,
      borderRadius: 24,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 8,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: COLORS.textPrimary,
      flex: 1,
      marginRight: 12,
    },
    subtitle: {
      fontSize: 16,
      color: COLORS.textSecondary,
      marginBottom: 24,
      lineHeight: 22,
    },
    starsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 24,
    },
    input: {
      backgroundColor: COLORS.background,
      color: COLORS.textPrimary,
      borderColor: COLORS.border,
      borderRadius: 12,
      borderWidth: 1,
      padding: 16,
      fontSize: 16,
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: 24,
    },
    callOutBox: {
      backgroundColor: COLORS.primary + '1A',
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
    },
    callOutTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: COLORS.textPrimary,
      marginBottom: 8,
    },
    callOutText: {
      fontSize: 14,
      color: COLORS.textSecondary,
      lineHeight: 20,
    }
  });

  return (
    <Modal visible={true} animationType="fade" transparent={true}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.centeredView}
      >
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.title}>How was {pendingEvent.location_name || pendingEvent.title}?</Text>
            <TouchableOpacity onPress={handleDismiss}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>You recently attended {pendingEvent.title}. Your feedback helps our local businesses!</Text>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleRatingPress(star)}>
                <Star 
                  size={44} 
                  fill={star <= rating ? '#FFD700' : 'transparent'} 
                  color={star <= rating ? '#FFD700' : COLORS.textTertiary} 
                />
              </TouchableOpacity>
            ))}
          </View>

          {rating > 0 && (
            <>
              {rating >= 4 && pendingEvent.google_review_url ? (
                <View style={styles.callOutBox}>
                  <Text style={styles.callOutTitle}>Help {pendingEvent.location_name || 'them'} out!</Text>
                  <Text style={styles.callOutText}>If you enjoyed the event, please consider leaving a quick review on Google to support them.</Text>
                  <View style={{ marginTop: 12 }}>
                    <Button onPress={handleLeaveGoogleReview} disabled={submitting}>
                      Leave a Public Review on Google
                    </Button>
                  </View>
                </View>
              ) : null}

              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8 }}>
                Or, leave private feedback:
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Let the organizer know what you loved or what they could do better..."
                placeholderTextColor={COLORS.textTertiary}
                multiline
                numberOfLines={3}
                value={feedback}
                onChangeText={setFeedback}
              />
              <Button 
                onPress={() => handleSubmit(rating, feedback)} 
                disabled={submitting}
                variant={rating >= 4 && pendingEvent.google_review_url ? "secondary" : "primary"}
              >
                {submitting ? "Sending..." : "Submit Private Feedback"}
              </Button>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
