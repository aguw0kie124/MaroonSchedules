import sys

with open('Frontend/components/Profile.tsx', 'r') as f:
    lines = f.readlines()

new_tabs = """              {/* Text-based Tab Bar */}
              <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingHorizontal: 16, gap: 20 }}>
                {PROFILE_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={{ paddingVertical: 10, position: 'relative' }}>
                      <Text style={{ fontSize: 15, fontWeight: isActive ? '800' : '600', color: isActive ? COLORS.textPrimary : COLORS.textTertiary }}>{tab.label}</Text>
                      {isActive && <View style={{ position: 'absolute', bottom: -1, width: '60%', height: 3, backgroundColor: COLORS.primary, borderRadius: 2 }}/>}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flex: 1, backgroundColor: COLORS.background }}>
              {activeTab === 'posts' && renderContentGrid(userPings)}
              {activeTab === 'schedule' && (
                 <View style={{ padding: 16 }}>
                   <ScheduleTabContent navigation={navigation} user={user} COLORS={COLORS} isDark={isDark} styles={styles} />
                 </View>
              )}
              {activeTab === 'saved' && (
                <View style={{ padding: 16 }}>
                  {savedEventIds.length > 0 && allEvents.filter((evt: any) => savedEventIds.includes(evt.id)).length > 0 ? (
                    <View>
                      {allEvents.filter((evt: any) => savedEventIds.includes(evt.id)).map((evt: any, idx: number, arr: any[]) => (
                        <View key={evt.id} style={{ paddingVertical: 12, borderBottomWidth: idx < arr.length-1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: COLORS.border }}>
                          <Text style={{ fontSize: 15, fontWeight: '600', color: COLORS.textPrimary }}>{evt.title}</Text>
                          <Text style={{ fontSize: 13, color: COLORS.textTertiary, marginTop: 4 }}>{new Date(evt.date_iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={{ padding: 48, alignItems: 'center' }}>
                      <BookmarkIcon size={44} color={COLORS.textTertiary} style={{ opacity: 0.3, marginBottom: 14 }} />
                      <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '700', textAlign: 'center' }}>No saved events</Text>
                      <Text style={{ color: COLORS.textTertiary, fontSize: 14, textAlign: 'center', marginTop: 6 }}>Browse events and save the ones you're interested in.</Text>
                    </View>
                  )}
                </View>
              )}
              {activeTab === 'nutrition' && (
                <View style={{ flex: 1, marginTop: 16 }}>
                   <DiningDashboard navigation={navigation} />
                </View>
              )}
              {activeTab === 'links' && (
                <View style={{ padding: 16, gap: 12 }}>
                  {[
                    {key: 'grades', title: 'Grades & Distributions', icon: GraduationCap, color: '#10B981', action: () => navigation.navigate('GradesScreen')},
                    {key: 'places', title: 'Places & Maps', icon: Map, color: '#F59E0B', action: () => navigation.navigate('PlacesMapScreen')},
                    {key: 'transit', title: 'Aggie Spirit Buses', icon: Compass, color: '#3B82F6', action: () => navigation.navigate('BusTimetable')}
                  ].map(item => (
                    <Pressable key={item.key} onPress={item.action} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border }}>
                      <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: item.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <item.icon size={18} color={item.color} />
                      </View>
                      <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.textPrimary }}>{item.title}</Text>
                      <ChevronRight size={20} color={COLORS.textTertiary} />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
"""

# Replace lines 1581 to 1854 (inclusive)
# lines[0] is line 1. lines[1580] is line 1581.
# We want to keep lines[:1580] and lines[1854:]
final_lines = lines[:1580] + [new_tabs] + lines[1854:]

with open('Frontend/components/Profile.tsx', 'w') as f:
    f.writelines(final_lines)
