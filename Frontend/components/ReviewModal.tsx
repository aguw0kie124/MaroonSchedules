import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Star, X } from 'lucide-react-native';
import { useTheme, PrimaryButton } from './SharedUI';
import { useUser } from '@clerk/clerk-expo';

interface ReviewModalProps {
  visible: boolean;
  onClose: () => void;
  locationName: string;
  onReviewSubmitted: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({ visible, onClose, locationName, onReviewSubmitted }) => {
  const { COLORS } = useTheme();
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.fullName || 'Anonymous',
          location: locationName,
          rating: rating,
          comment: comment.trim(),
        }),
      });

      if (response.ok) {
        setRating(0);
        setComment('');
        onReviewSubmitted();
        onClose();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.centeredView}
      >
        <View style={[styles.modalView, { backgroundColor: COLORS.backgroundSecondary }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>Rate {locationName}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)}>
                <Star 
                  size={40} 
                  fill={star <= rating ? '#FFD700' : 'transparent'} 
                  color={star <= rating ? '#FFD700' : COLORS.textTertiary} 
                />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[styles.input, { 
              backgroundColor: COLORS.background, 
              color: COLORS.textPrimary,
              borderColor: COLORS.border 
            }]}
            placeholder="Write your review (optional)..."
            placeholderTextColor={COLORS.textTertiary}
            multiline
            numberOfLines={4}
            value={comment}
            onChangeText={setComment}
          />

          <PrimaryButton 
            title={submitting ? "Submitting..." : "Submit Review"} 
            onPress={handleSubmit}
            disabled={rating === 0 || submitting}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
});
