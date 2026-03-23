import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, FlatList, Pressable, 
    Image, TextInput, ActivityIndicator, Alert,
    Modal, TouchableWithoutFeedback, KeyboardAvoidingView, Platform
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Camera, Image as ImageIcon, Video, Heart, MapPin, X, ChevronLeft, MoreHorizontal, MessageCircle, Calendar } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from './SharedUI';
import { API_URL } from '../config';

// Replace these with your actual Cloudinary credentials from your .env
// e.g. EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_URL = `https://api.cloudinary.com/v1_1/${process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo'}/upload`;
const CLOUDINARY_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'unsigned_preset';

interface Post {
    id: string;
    user_id: string;
    user_name: string;
    user_image: string | null;
    caption: string | null;
    media_url: string | null;
    media_type: 'image' | 'video' | null;
    location_tag: string | null;
    likes: number;
    liked_by: string[];
    created_at: string;
}

export function CampusFeedScreen() {
    const { COLORS } = useTheme();
    const styles = getStyles(COLORS);
    const { user } = useUser();
    const navigation = useNavigation<any>();
    
    const [posts, setPosts] = useState<Post[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Create Post Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [caption, setCaption] = useState('');
    const [locationTag, setLocationTag] = useState('');
    const [mediaUri, setMediaUri] = useState<string | null>(null);
    const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
    const [isPosting, setIsPosting] = useState(false);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await fetch(`${API_URL}/posts?limit=50`);
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (e) {
            console.warn("Failed to fetch posts:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchPosts();
    };

    const pickMedia = async (type: 'Images' | 'Videos') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'Images' ? ['images'] : ['videos'],
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            setMediaUri(result.assets[0].uri);
            setMediaType(type === 'Images' ? 'image' : 'video');
        }
    };

    const uploadToCloudinary = async (uri: string, type: 'image' | 'video') => {
        const data = new FormData();
        data.append('file', {
            uri,
            type: type === 'image' ? 'image/jpeg' : 'video/mp4',
            name: `upload.${type === 'image' ? 'jpg' : 'mp4'}`,
        } as any);
        data.append('upload_preset', CLOUDINARY_PRESET);

        const res = await fetch(CLOUDINARY_URL, {
            method: 'POST',
            body: data,
        });
        const clData = await res.json();
        return clData.secure_url;
    };

    const handlePost = async () => {
        if (!user) return;
        if (!caption.trim() && !mediaUri) {
            Alert.alert("Empty Post", "Add a photo, video, or caption to post.");
            return;
        }

        setIsPosting(true);
        try {
            let uploadedMediaUrl = null;
            if (mediaUri && mediaType) {
                uploadedMediaUrl = await uploadToCloudinary(mediaUri, mediaType);
            }

            const newPost = {
                user_id: user.id,
                user_name: user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Aggie',
                user_image: user.imageUrl,
                caption: caption.trim() || null,
                media_url: uploadedMediaUrl,
                media_type: uploadedMediaUrl ? mediaType : null,
                location_tag: locationTag.trim() || null,
            };

            const res = await fetch(`${API_URL}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPost),
            });

            if (res.ok) {
                setModalVisible(false);
                setCaption('');
                setMediaUri(null);
                setMediaType(null);
                setLocationTag('');
                fetchPosts(); // Reload feed
            } else {
                Alert.alert("Error", "Failed to create post.");
            }
        } catch (e) {
            console.error(e);
            Alert.alert("Error", "Something went wrong.");
        } finally {
            setIsPosting(false);
        }
    };

    const toggleLike = async (postId: string) => {
        if (!user) return;
        
        // Optimistic ui update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                const isLiked = p.liked_by.includes(user.id);
                return {
                    ...p,
                    likes: isLiked ? p.likes - 1 : p.likes + 1,
                    liked_by: isLiked ? p.liked_by.filter(id => id !== user.id) : [...p.liked_by, user.id]
                };
            }
            return p;
        }));

        try {
            await fetch(`${API_URL}/posts/${postId}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id }),
            });
        } catch (e) {
            // Revert on failure
            fetchPosts();
        }
    };

    const renderPost = ({ item }: { item: Post }) => {
        const isLiked = user ? item.liked_by.includes(user.id) : false;
        
        // Format time ago
        const date = new Date(item.created_at);
        const hoursAgo = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60));
        const timeStr = hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`;

        return (
            <View style={styles.postCard}>
                <View style={styles.postHeader}>
                    <Image 
                        source={{ uri: item.user_image || 'https://via.placeholder.com/40' }} 
                        style={styles.avatar} 
                    />
                    <View style={styles.postHeaderText}>
                        <Text style={styles.postAuthor}>{item.user_name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.postTime}>{timeStr}</Text>
                            {item.location_tag && (
                                <>
                                    <Text style={styles.postTime}>•</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                        <MapPin color={COLORS.primary} size={10} />
                                        <Text style={styles.postLocation}>{item.location_tag}</Text>
                                    </View>
                                </>
                            )}
                        </View>
                    </View>
                    <Pressable style={styles.moreBtn}>
                        <MoreHorizontal color={COLORS.textSecondary} size={20} />
                    </Pressable>
                </View>

                {item.caption && <Text style={styles.postCaption}>{item.caption}</Text>}

                {item.media_url && item.media_type === 'image' && (
                    <Image source={{ uri: item.media_url }} style={styles.postImage} />
                )}
                
                {/* For video, a real app would use expo-av Video component here */}
                {item.media_url && item.media_type === 'video' && (
                    <View style={[styles.postImage, { backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }]}>
                        <Video color="rgba(255,255,255,0.5)" size={48} />
                    </View>
                )}

                <View style={styles.postFooter}>
                    <Pressable style={styles.actionBtn} onPress={() => toggleLike(item.id)}>
                        <Heart color={isLiked ? COLORS.primary : COLORS.textSecondary} fill={isLiked ? COLORS.primary : 'transparent'} size={22} />
                        <Text style={[styles.actionText, isLiked && { color: COLORS.primary }]}>{item.likes}</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn}>
                        <MessageCircle color={COLORS.textSecondary} size={22} />
                        <Text style={styles.actionText}>Reply</Text>
                    </Pressable>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ width: 44 }} />
                <Text style={styles.headerTitle}>Campus Life</Text>
                <Pressable onPress={() => navigation.navigate('EventsCalendar')} style={styles.eventsBtn}>
                    <Calendar color={COLORS.textPrimary} size={24} />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.centerFull}>
                    <ActivityIndicator color={COLORS.primary} size="large" />
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={item => item.id}
                    renderItem={renderPost}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Camera color={COLORS.border} size={48} strokeWidth={1.5} />
                            <Text style={styles.emptyTitle}>No posts yet</Text>
                            <Text style={styles.emptySubtitle}>Be the first to share what's happening on campus!</Text>
                        </View>
                    }
                />
            )}

            <Pressable style={styles.fab} onPress={() => setModalVisible(true)}>
                <Camera color={COLORS.surface} size={24} />
            </Pressable>

            {/* Create Post Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalBg}>
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalContent}
                    >
                        <View style={styles.modalHeader}>
                            <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </Pressable>
                            <Text style={styles.modalTitle}>New Post</Text>
                            <Pressable 
                                onPress={handlePost} 
                                disabled={isPosting || (!caption.trim() && !mediaUri)}
                            >
                                {isPosting ? (
                                    <ActivityIndicator color={COLORS.primary} size="small" />
                                ) : (
                                    <Text style={[styles.modalPostText, (!caption.trim() && !mediaUri) && { opacity: 0.5 }]}>Post</Text>
                                )}
                            </Pressable>
                        </View>

                        <TextInput
                            style={styles.captionInput}
                            placeholder="What's happening on campus?"
                            placeholderTextColor={COLORS.textTertiary}
                            multiline
                            maxLength={500}
                            value={caption}
                            onChangeText={setCaption}
                            autoFocus
                        />

                        {mediaUri && (
                            <View style={styles.mediaPreviewContainer}>
                                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
                                <Pressable style={styles.removeMediaBtn} onPress={() => { setMediaUri(null); setMediaType(null); }}>
                                    <X color="#FFF" size={16} />
                                </Pressable>
                            </View>
                        )}

                        <View style={styles.actionBar}>
                            <View style={styles.mediaBtns}>
                                <Pressable style={styles.mediaBtn} onPress={() => pickMedia('Images')}>
                                    <ImageIcon color={COLORS.primary} size={22} />
                                </Pressable>
                                <Pressable style={styles.mediaBtn} onPress={() => pickMedia('Videos')}>
                                    <Video color={COLORS.primary} size={22} />
                                </Pressable>
                            </View>
                            
                            <View style={styles.locationInputWrapper}>
                                <MapPin color={COLORS.textSecondary} size={16} />
                                <TextInput
                                    style={styles.locationInput}
                                    placeholder="Add location (e.g. MSC)"
                                    placeholderTextColor={COLORS.textTertiary}
                                    value={locationTag}
                                    onChangeText={setLocationTag}
                                    maxLength={30}
                                />
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (COLORS: any) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.background, // Match background for clean look
        paddingTop: 50, // Reduced from 60
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    eventsBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end', marginRight: -8 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, letterSpacing: -0.5 },
    centerFull: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingBottom: 100 }, // removed horizontal padding to allow edge-to-edge
    
    postCard: {
        backgroundColor: COLORS.background,
        paddingVertical: 16,
        paddingHorizontal: 16, // internal padding instead of container padding
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: COLORS.border,
    },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceElevated, marginRight: 12 },
    postHeaderText: { flex: 1 },
    postAuthor: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
    postTime: { fontSize: 13, color: COLORS.textSecondary },
    postLocation: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
    moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    
    postCaption: { fontSize: 15, color: COLORS.textPrimary, lineHeight: 22, marginBottom: 12 },
    postImage: { width: '100%', height: 250, borderRadius: 16, marginBottom: 16, backgroundColor: COLORS.surfaceElevated },
    
    postFooter: { flexDirection: 'row', gap: 24, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
    
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
    
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: COLORS.primary, // White button on black background
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    // Modal
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: COLORS.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, minHeight: '80%', padding: 20 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 16 },
    modalCancelText: { fontSize: 16, color: COLORS.textSecondary },
    modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
    modalPostText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
    modalCloseBtn: { paddingVertical: 4 },
    
    captionInput: { fontSize: 17, color: COLORS.textPrimary, minHeight: 120, textAlignVertical: 'top', marginBottom: 20 },
    
    mediaPreviewContainer: { position: 'relative', marginBottom: 20 },
    mediaPreview: { width: '100%', height: 200, borderRadius: 16, backgroundColor: COLORS.surfaceElevated },
    removeMediaBtn: { position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    
    actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border },
    mediaBtns: { flexDirection: 'row', gap: 16 },
    mediaBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(80,0,0,0.15)', alignItems: 'center', justifyContent: 'center' },
    
    locationInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, paddingHorizontal: 12, height: 40, borderRadius: 20, gap: 8, flex: 1, marginLeft: 16 },
    locationInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
});
