# Mobile Profile and Settings

## Description

Implement user profile viewing and editing with profile picture, name, bio, interests, language preferences, notification settings, data export requests, account deletion, and logout functionality. Settings are accessible from a dedicated tab with organized sections for preferences and account management.

## Affected Apps/Packages

- `apps/mobile/src/screens/profile/ProfileScreen.tsx` (new)
- `apps/mobile/src/screens/profile/SettingsScreen.tsx` (new)
- `apps/mobile/src/screens/profile/EditProfileScreen.tsx` (new)
- `packages/shared/src/services/userService.ts` (updated)

## Requirements

### 1. Profile Screen

File: `src/screens/profile/ProfileScreen.tsx`

Main profile display with user info and quick actions:

```typescript
interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  interests: string[];
  enrolledCoursesCount: number;
  completedCoursesCount: number;
  learningStreak: number; // days
  totalHoursLearned: number;
  joinedAt: string;
}

export function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    setIsLoading(true);
    try {
      const data = await userService.getProfile();
      setProfile(data);
    } catch (error) {
      showError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editButton}
          >
            <Ionicons name="pencil" size={18} color={colors.primary} />
          </Pressable>

          <Image
            source={{ uri: profile.avatarUrl }}
            style={styles.avatar}
          />

          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.email}>{profile.email}</Text>

          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}

          <Pressable
            onPress={() => navigation.navigate('EditProfile')}
            style={styles.editProfileButton}
          >
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <StatCard
            icon="book"
            label="Enrolled"
            value={profile.enrolledCoursesCount.toString()}
          />
          <StatCard
            icon="checkmark-circle"
            label="Completed"
            value={profile.completedCoursesCount.toString()}
          />
          <StatCard
            icon="flame"
            label="Streak"
            value={`${profile.learningStreak}d`}
          />
          <StatCard
            icon="time"
            label="Hours Learned"
            value={Math.round(profile.totalHoursLearned).toString()}
          />
        </View>

        {/* Interests */}
        {profile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {profile.interests.map((interest) => (
                <View key={interest} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Member since */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.memberRow}>
            <Text style={styles.memberLabel}>Member since</Text>
            <Text style={styles.memberValue}>
              {new Date(profile.joinedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
              })}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <MenuButton
            icon="settings"
            label="Settings"
            onPress={() => navigation.navigate('Settings')}
          />
          <MenuButton
            icon="download"
            label="Download My Data"
            onPress={() => navigation.navigate('DataExport')}
          />
          <MenuButton
            icon="log-out"
            label="Logout"
            onPress={handleLogout}
            destructive
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as any} size={24} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function MenuButton({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      style={styles.menuButton}
      onPress={onPress}
    >
      <Ionicons
        name={icon as any}
        size={20}
        color={destructive ? colors.error : colors.primary}
      />
      <Text
        style={[
          styles.menuButtonText,
          destructive && styles.menuButtonTextDestructive,
        ]}
      >
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={20} color={colors.border} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    position: 'relative',
  },
  editButton: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    padding: spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: spacing.lg,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  bio: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  editProfileButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  editProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  statCard: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interestTag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
  },
  interestTagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  memberValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  actionsContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  menuButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  menuButtonTextDestructive: {
    color: colors.error,
  },
});

export default ProfileScreen;
```

### 2. Edit Profile Screen

File: `src/screens/profile/EditProfileScreen.tsx`

Edit profile information including photo:

```typescript
export function EditProfileScreen({
  navigation,
}: EditProfileScreenProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await userService.getProfile();
      setProfile(data);
      setFullName(data.fullName);
      setBio(data.bio || '');
      setSelectedInterests(new Set(data.interests));
      setAvatarUri(data.avatarUrl || null);
    } catch (error) {
      showError('Failed to load profile');
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.cancelled) {
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      showError('Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      showError('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('bio', bio);
      formData.append('interests', JSON.stringify(Array.from(selectedInterests)));

      if (avatarUri && avatarUri !== profile?.avatarUrl) {
        formData.append('avatar', {
          uri: avatarUri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        } as any);
      }

      await userService.updateProfile(formData);
      navigation.goBack();
    } catch (error) {
      showError('Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Button
          title="Save"
          size="sm"
          onPress={handleSave}
          loading={isSaving}
        />
      </View>

      <ScrollView style={styles.content}>
        {/* Avatar */}
        <Pressable
          style={styles.avatarSection}
          onPress={handlePickImage}
        >
          <Image
            source={{ uri: avatarUri || profile?.avatarUrl }}
            style={styles.avatar}
          />
          <View style={styles.avatarOverlay}>
            <Ionicons name="camera" size={24} color={colors.white} />
          </View>
        </Pressable>

        {/* Form fields */}
        <View style={styles.form}>
          {/* Full name */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
            />
          </View>

          {/* Bio */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              placeholder="Tell us about yourself"
              placeholderTextColor={colors.textTertiary}
              value={bio}
              onChangeText={setBio}
              multiline
              style={[styles.input, styles.bioInput]}
              maxLength={160}
            />
            <Text style={styles.charCount}>{bio.length}/160</Text>
          </View>

          {/* Interests */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Interests</Text>
            <View style={styles.interestsContainer}>
              {INTEREST_OPTIONS.map((interest) => (
                <Pressable
                  key={interest}
                  style={[
                    styles.interestButton,
                    selectedInterests.has(interest) && styles.interestButtonSelected,
                  ]}
                  onPress={() => {
                    const updated = new Set(selectedInterests);
                    if (updated.has(interest)) {
                      updated.delete(interest);
                    } else {
                      updated.add(interest);
                    }
                    setSelectedInterests(updated);
                  }}
                >
                  <Text
                    style={[
                      styles.interestButtonText,
                      selectedInterests.has(interest) &&
                        styles.interestButtonTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const INTEREST_OPTIONS = [
  'Makeup',
  'Skincare',
  'Haircare',
  'Wellness',
  'Fashion',
  'Business',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelButton: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  formGroup: {
    gap: spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  interestButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  interestButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  interestButtonText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  interestButtonTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default EditProfileScreen;
```

### 3. Settings Screen

File: `src/screens/profile/SettingsScreen.tsx`

App preferences and account settings:

```typescript
export function SettingsScreen({ navigation }: SettingsScreenProps) {
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState({
    pushEnabled: true,
    emailEnabled: true,
    newCourses: true,
    comments: true,
    promotions: false,
  });

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            navigation.navigate('DeleteAccount');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <SettingRow
            label="Language"
            value={language === 'en' ? 'English' : 'Español'}
            onPress={() => {
              // Show language picker
            }}
          />
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <SettingToggle
            label="Push Notifications"
            value={notifications.pushEnabled}
            onValueChange={(value) =>
              setNotifications({ ...notifications, pushEnabled: value })
            }
          />

          <SettingToggle
            label="Email Notifications"
            value={notifications.emailEnabled}
            onValueChange={(value) =>
              setNotifications({ ...notifications, emailEnabled: value })
            }
          />

          {notifications.emailEnabled && (
            <>
              <SettingToggle
                label="New Courses"
                value={notifications.newCourses}
                onValueChange={(value) =>
                  setNotifications({ ...notifications, newCourses: value })
                }
              />

              <SettingToggle
                label="Course Comments"
                value={notifications.comments}
                onValueChange={(value) =>
                  setNotifications({ ...notifications, comments: value })
                }
              />

              <SettingToggle
                label="Promotions & Deals"
                value={notifications.promotions}
                onValueChange={(value) =>
                  setNotifications({ ...notifications, promotions: value })
                }
              />
            </>
          )}
        </View>

        {/* Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy</Text>

          <SettingRow
            label="Privacy Policy"
            onPress={() => {
              Linking.openURL('https://example.com/privacy');
            }}
          />

          <SettingRow
            label="Terms of Service"
            onPress={() => {
              Linking.openURL('https://example.com/terms');
            }}
          />
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <SettingRow
            label="Download My Data"
            onPress={() => navigation.navigate('DataExport')}
          />

          <SettingRow
            label="Delete Account"
            destructive
            onPress={handleDeleteAccount}
          />
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingRow({
  label,
  value,
  destructive = false,
  onPress,
}: {
  label: string;
  value?: string;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <Text
        style={[
          styles.settingLabel,
          destructive && styles.settingLabelDestructive,
        ]}
      >
        {label}
      </Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={20} color={colors.border} />
    </Pressable>
  );
}

function SettingToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  settingLabelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  versionText: {
    fontSize: 12,
    color: colors.textTertiary},
});

export default SettingsScreen;
```

### 4. Data Export Request Screen

File: `src/screens/profile/DataExportScreen.tsx`

Mobile data export request feature matching the web flow (milestone 13's `05-data-export-learner.md`):

- **Request Data Export:** Button to trigger a data export request via the same backend job as web
- **Request Status:** Show current request status (pending, processing, ready, expired)
- **Download Link:** When export is ready, display a download link (opens in browser or shares file)
- **Expiry Notice:** Download link expires after 7 days; show countdown
- **Processing Time:** Inform user exports may take up to 48 hours for large datasets
- **Email Notification:** User receives email when export is ready for download
- **Export Contents:** Profile info, purchase history, course progress, community comments, consent records (JSON/CSV)

```typescript
export function DataExportScreen({ navigation }: DataExportScreenProps) {
  const [exportStatus, setExportStatus] = useState<{
    status: "none" | "pending" | "processing" | "ready" | "expired";
    requestedAt?: string;
    downloadUrl?: string;
    expiresAt?: string;
  }>({ status: "none" });
  const [isRequesting, setIsRequesting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkExportStatus();
    }, [])
  );

  const checkExportStatus = async () => {
    try {
      const data = await userService.getDataExportStatus();
      setExportStatus(data);
    } catch (error) {
      // No pending export
      setExportStatus({ status: "none" });
    }
  };

  const handleRequestExport = async () => {
    setIsRequesting(true);
    try {
      await userService.requestDataExport();
      setExportStatus({ status: "pending", requestedAt: new Date().toISOString() });
      Alert.alert(
        "Export Requested",
        "Your data export has been requested. You will receive an email when it is ready for download (up to 48 hours)."
      );
    } catch (error) {
      showError("Failed to request data export");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDownload = async () => {
    if (exportStatus.downloadUrl) {
      await Linking.openURL(exportStatus.downloadUrl);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.section}>
          <Text style={styles.title}>Export My Data</Text>
          <Text style={styles.description}>
            Request a copy of your personal data including profile information,
            purchase history, course progress, and community activity. Exports
            are provided in JSON/CSV format.
          </Text>
        </View>

        {exportStatus.status === "none" && (
          <Button
            title="Request Data Export"
            onPress={handleRequestExport}
            loading={isRequesting}
          />
        )}

        {(exportStatus.status === "pending" || exportStatus.status === "processing") && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status: Processing</Text>
            <Text style={styles.statusHint}>
              Your export is being prepared. This may take up to 48 hours.
              You will receive an email when it is ready.
            </Text>
          </View>
        )}

        {exportStatus.status === "ready" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status: Ready</Text>
            <Button title="Download Export" onPress={handleDownload} />
            {exportStatus.expiresAt && (
              <Text style={styles.statusHint}>
                Download link expires on{" "}
                {new Date(exportStatus.expiresAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {exportStatus.status === "expired" && (
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status: Expired</Text>
            <Text style={styles.statusHint}>
              Your previous export link has expired. Request a new export.
            </Text>
            <Button
              title="Request New Export"
              onPress={handleRequestExport}
              loading={isRequesting}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

#### Acceptance Criteria (Data Export — Mobile)

- [ ] Data export request button triggers backend job
- [ ] Export status screen shows pending/processing/ready/expired states
- [ ] Download link opens when export is ready
- [ ] Expiry date displayed for ready exports (7-day window)
- [ ] User informed that processing may take up to 48 hours
- [ ] Same backend job as web data export (milestone 13's `05-data-export-learner.md`)
- [ ] Compliant with GDPR Art. 20 (Right to Data Portability)

### 5. User Service Updates

File: `packages/shared/src/services/userService.ts` (add methods)

```typescript
export class UserService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async getProfile(): Promise<UserProfile> {
    const { data } = await this.api.get("/users/profile");
    return data.profile;
  }

  async updateProfile(formData: FormData): Promise<UserProfile> {
    const { data } = await this.api.patch("/users/profile", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.profile;
  }

  async requestDataExport(): Promise<{ requestId: string }> {
    const { data } = await this.api.post("/users/data-export-request");
    return data;
  }

  async getDataExportStatus(): Promise<{
    status: "none" | "pending" | "processing" | "ready" | "expired";
    requestedAt?: string;
    downloadUrl?: string;
    expiresAt?: string;
  }> {
    const { data } = await this.api.get("/users/data-export-status");
    return data;
  }

  async deleteAccount(password: string): Promise<void> {
    await this.api.post("/users/account/delete", { password });
  }

  async logout(): Promise<void> {
    await this.api.post("/auth/logout");
  }
}

export const userService = new UserService();
```

## Acceptance Criteria

- [ ] Profile screen displays all user information
- [ ] Avatar changes with image picker
- [ ] Stats (enrolled, completed, streak, hours) display correctly
- [ ] Edit profile modal shows all fields
- [ ] Interests can be added/removed
- [ ] Profile updates save to backend
- [ ] Settings toggles persist across sessions
- [ ] Language preference changes app language (future)
- [ ] Notification settings functional
- [ ] Privacy links open correctly
- [ ] Data export request works
- [ ] Account deletion requires confirmation and password
- [ ] Logout clears auth token and returns to login
- [ ] No console errors
- [ ] All text readable and fields accessible

## Dependencies

- react-native (ScrollView, TextInput, Switch)
- expo-image-picker (avatar selection)
- @react-navigation/native
- axios (HTTP client)

## Technical Notes

### Profile Photo

- Compress to 70% quality
- Max dimensions 400x400px
- Aspect ratio 1:1
- Upload to CDN

### Settings Persistence

- Save preferences locally in AsyncStorage
- Sync to backend on app backgrounding
- Defaults if not set

### Account Deletion

- Requires password confirmation
- Process takes 30 days (soft delete)
- Data export available before deletion
- Irreversible after confirmation

### Data Export

- Available in JSON format
- Includes profile, courses, progress, notes
- Email link valid for 7 days
- Background job processes export
