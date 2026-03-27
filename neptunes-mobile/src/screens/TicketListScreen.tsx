import React, { useEffect, useState, useContext, useCallback, useRef, useMemo } from 'react';
import { 
    View, Text, FlatList, StyleSheet, TouchableOpacity, 
    TextInput, AppState, AppStateStatus, ScrollView, Image 
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import apiClient from '../api/client';
import { debounce } from 'lodash';
import { Ionicons } from '@expo/vector-icons';

const SERVER_BASE_URL = 'http://192.168.1.100:8080';

interface TicketTier {
    category: string;
    price: number;
    stock: number;
}

interface EventGroup {
    event_id: number;
    name: string;
    venue: string;
    date: string;
    banner_url?: string | null;
    doors_open?: string | null;
    tiers: TicketTier[];
}

export default function TicketListScreen() {
    const navigation = useNavigation<any>();
    const { colors } = useContext(ThemeContext);
    
    const [rawTickets, setRawTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');

    const lastFetchTime = useRef<number>(0);
    const THROTTLE_MS = 30000;
    const filters = ['All', 'Today', 'This Weekend', 'Music', 'Sports', 'Arts'];

    const fetchTickets = async (query: string = '', showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const response = await apiClient.get(`/marketplace?q=${query}`);
            setRawTickets(response.data.data || []);
            lastFetchTime.current = Date.now();
        } catch (error) {
            console.error("Marketplace fetch error:", error);
        } finally {
            setLoading(false);
        }
    };

    const groupedEvents = useMemo(() => {
        const groups: Record<number, EventGroup> = {};
        rawTickets.forEach(t => {
            if (!groups[t.event_id]) {
                groups[t.event_id] = {
                    event_id: t.event_id,
                    name: t.event?.name || 'TBA',
                    venue: t.event?.venue || 'TBA',
                    date: t.event?.date || 'TBA',
                    banner_url: t.event?.banner_url || null,
                    doors_open: t.event?.doors_open || null,
                    tiers: []
                };
            }
            groups[t.event_id].tiers.push({
                category: t.category,
                price: t.price,
                stock: t.stock
            });
        });
        return Object.values(groups);
    }, [rawTickets]);

    useFocusEffect(
        useCallback(() => {
            const now = Date.now();
            if (now - lastFetchTime.current > THROTTLE_MS || rawTickets.length === 0) {
                fetchTickets(searchQuery, false);
            }
        }, []) 
    );

    const debouncedSearch = useCallback(
        debounce((nextValue: string) => fetchTickets(nextValue), 500), []
    );

    const handleSearchChange = (text: string) => {
        setSearchQuery(text);
        debouncedSearch(text);
    };

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') fetchTickets(searchQuery);
        });
        return () => subscription.remove();
    }, []); 

    useEffect(() => { fetchTickets(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTickets(searchQuery, false);
        setRefreshing(false);
    };

    const formatBadgeDate = (dateString: string) => {
        if (dateString === 'TBA') return { month: 'TBA', day: '' };
        const date = new Date(dateString);
        return {
            month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
            day: date.getDate().toString()
        };
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.headerContainer}>
                <Text style={[styles.header, { color: colors.text }]}>Discover</Text>
                
                <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search" size={20} color={colors.subText} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search events, artists, venues..."
                        placeholderTextColor={colors.subText}
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => handleSearchChange('')}>
                            <Ionicons name="close-circle" size={18} color={colors.subText} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {filters.map((filter) => (
                        <TouchableOpacity 
                            key={filter} 
                            style={[styles.filterPill, activeFilter === filter ? styles.filterPillActive : { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.filterPillText, activeFilter === filter ? styles.filterPillTextActive : { color: colors.subText }]}>{filter}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={groupedEvents}
                keyExtractor={(item) => item.event_id.toString()}
                refreshing={refreshing}
                onRefresh={onRefresh}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                renderItem={({ item }) => {
                    const minPrice = item.tiers.length > 0 ? Math.min(...item.tiers.map(t => t.price)) : 0;
                    const dateObj = formatBadgeDate(item.date);
                    const imageSource = item.banner_url ? { uri: `${SERVER_BASE_URL}${item.banner_url}` } : require('../../assets/placeholder.png');

                    return (
                        <TouchableOpacity 
                            style={[styles.eventCard, { backgroundColor: colors.card }]} 
                            onPress={() => navigation.navigate('EventDetail', { event: item })} // 🚀 Clean navigation!
                            activeOpacity={0.9}
                        >
                            <Image source={imageSource} style={styles.cardImage} />
                            
                            <View style={styles.dateBadge}>
                                <Text style={styles.dateMonth}>{dateObj.month}</Text>
                                <Text style={styles.dateDay}>{dateObj.day}</Text>
                            </View>

                            <View style={styles.cardContent}>
                                <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                                <View style={styles.infoRow}>
                                    <Ionicons name="location" size={14} color={colors.subText} />
                                    <Text style={[styles.infoText, { color: colors.subText }]} numberOfLines={1}>{item.venue}</Text>
                                </View>
                                
                                <View style={styles.cardFooter}>
                                    <Text style={[styles.stockText, { color: colors.subText }]}>
                                        <Ionicons name="ticket" size={12} /> {item.tiers.reduce((sum, t) => sum + t.stock, 0)} left
                                    </Text>
                                    <View style={styles.priceTag}>
                                        <Text style={styles.priceText}>
                                            {minPrice > 0 ? `From RM ${minPrice}` : 'Sold Out'}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    );
                }}
                ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 50 }}><Text style={{ color: colors.subText }}>No events found.</Text></View>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerContainer: { paddingHorizontal: 16, paddingTop: 50, paddingBottom: 10 },
    header: { fontSize: 32, fontWeight: '900', marginBottom: 15, letterSpacing: -0.5 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, height: 48, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
    searchInput: { flex: 1, fontSize: 16, marginLeft: 8 },
    filterScroll: { marginBottom: 10, paddingBottom: 5 },
    filterPill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginRight: 10, borderWidth: 1 },
    filterPillActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    filterPillText: { fontSize: 14, fontWeight: '600' },
    filterPillTextActive: { color: '#FFF' },
    eventCard: { borderRadius: 20, marginBottom: 24, overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    cardImage: { width: '100%', height: 180, resizeMode: 'cover' },
    dateBadge: { position: 'absolute', top: 15, left: 15, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 8, alignItems: 'center', minWidth: 50, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 },
    dateMonth: { fontSize: 11, fontWeight: 'bold', color: '#FF3B30', marginBottom: 2 },
    dateDay: { fontSize: 18, fontWeight: '900', color: '#000' },
    cardContent: { padding: 16 },
    eventTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6, lineHeight: 24 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    infoText: { fontSize: 14, marginLeft: 4, fontWeight: '500' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(128,128,128,0.1)', paddingTop: 12 },
    stockText: { fontSize: 13, fontWeight: '600' },
    priceTag: { backgroundColor: '#e8f5e9', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    priceText: { color: '#2e7d32', fontWeight: '800', fontSize: 15 },
});