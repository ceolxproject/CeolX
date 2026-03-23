# Mobile App Store Compliance

## Description

Implement App Store and Play Store compliance including privacy nutrition labels for iOS, account deletion/data management capabilities, UGC (User-Generated Content) compliance with reporting/blocking features, community guidelines acknowledgment, and Play Store data safety section. Ensure no in-app purchases in V1 (web-based Stripe checkout only).

## Affected Apps/Packages

- `apps/mobile/src/screens/compliance/` (new)
- `apps/mobile/src/components/compliance/` (new)
- `packages/shared/src/services/complianceService.ts` (new)

## Requirements

### 1. Privacy Labels Configuration

File: `app.config.ts` (iOS privacy labels)

```typescript
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,

  // iOS Privacy Labels (PrivacyInfo.xcprivacy in Xcode)
  // Must include in app.json or managed through Xcode
  ios: {
    infoPlist: {
      // Track data (must declare if enabled)
      NSAdvertisingAttributedAPIEnabled: false,
      SKAdNetworkItems: [],

      // Location
      NSLocationWhenInUseUsageDescription: "We do not use your location",

      // Contacts
      NSContactsUsageDescription: "We do not access your contacts",

      // Photos
      NSPhotoLibraryUsageDescription:
        "Upload profile photos and course materials",

      // Camera
      NSCameraUsageDescription: "Not currently used",

      // Microphone
      NSMicrophoneUsageDescription: "Not currently used",

      // Calendar
      NSCalendarsUsageDescription: "Not currently used",

      // Reminders
      NSRemindersUsageDescription: "Not currently used",

      // Health
      NSHealthShareUsageDescription: "We do not access health data",

      // Clipboard
      NSPasteboardUsageDescription: "Paste links from clipboard",

      // Network Status
      NSBonjourServiceTypes: [],
    },

    privacyManifest: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategoryFileTimestampAPIs",
          NSPrivacyAccessedAPITypeReasons: ["DDA9.1"],
        },
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: [
            "8D52CB72-1FFB-4A6D-8B41-27B4ED8D0AB7",
          ],
        },
      ],
    },
  },
});
```

### 2. Account Deletion Screen

File: `src/screens/compliance/DeleteAccountScreen.tsx`

```typescript
export function DeleteAccountScreen({
  navigation,
}: DeleteAccountScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState<string | null>(null);

  const DELETE_REASONS = [
    'I no longer want to use this service',
    'I have privacy concerns',
    'I found a better alternative',
    'I do not remember my password',
    'Other',
  ];

  const handleDeleteAccount = async () => {
    if (!password || !confirmPassword) {
      showError('Please enter your password');
      return;
    }

    if (password !== confirmPassword) {
      showError('Passwords do not match');
      return;
    }

    Alert.alert(
      'Are you sure?',
      'This will permanently delete your account and all associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            await performDelete();
          },
        },
      ]
    );
  };

  const performDelete = async () => {
    setIsDeleting(true);
    try {
      // Send deletion request with reason
      await complianceService.deleteAccount({
        password,
        reason: deleteReason,
      });

      // Clear local data
      await AsyncStorage.clear();

      // Navigate to login
      navigation.navigate('Auth', {
        screen: 'SignIn',
      });

      Alert.alert(
        'Account Deleted',
        'Your account has been scheduled for deletion. This process may take up to 30 days.'
      );
    } catch (error) {
      showError('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Ionicons
            name="warning"
            size={40}
            color={colors.error}
            style={styles.warningIcon}
          />
          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.subtitle}>
            This action cannot be undone
          </Text>
        </View>

        <View style={styles.content}>
          {/* Warning section */}
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>What happens when you delete:</Text>
            <View style={styles.warningList}>
              <WarningItem text="Your profile and personal data will be permanently removed" />
              <WarningItem text="Your course progress will be lost" />
              <WarningItem text="You will lose access to purchased courses" />
              <WarningItem text="Your certificates will be revoked" />
              <WarningItem text="Deletion takes up to 30 days to process" />
            </View>
          </View>

          {/* Why deleting? */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Why are you deleting?</Text>
            <Text style={styles.sectionSubtitle}>
              Your feedback helps us improve
            </Text>
            {DELETE_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[
                  styles.reasonButton,
                  deleteReason === reason && styles.reasonButtonSelected,
                ]}
                onPress={() => setDeleteReason(reason)}
              >
                <View
                  style={[
                    styles.radio,
                    deleteReason === reason && styles.radioSelected,
                  ]}
                >
                  {deleteReason === reason && (
                    <View style={styles.radioDot} />
                  )}
                </View>
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}
          </View>

          {/* Password confirmation */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm with Password</Text>
            <PasswordInput
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              style={styles.input}
            />
            <PasswordInput
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
            />
          </View>

          {/* Download data first */}
          <View style={styles.actionCard}>
            <Ionicons name="download" size={20} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Download Your Data</Text>
              <Text style={styles.actionSubtitle}>
                Download all your data before deletion
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('DataExport')}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.primary}
              />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Delete button */}
      <View style={styles.footer}>
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={{ flex: 1 }}
        />
        <Button
          title="Delete Account"
          onPress={handleDeleteAccount}
          loading={isDeleting}
          disabled={!password || !confirmPassword || !deleteReason}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function WarningItem({ text }: { text: string }) {
  return (
    <View style={styles.warningItem}>
      <Ionicons name="checkmark" size={18} color={colors.error} />
      <Text style={styles.warningItemText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  warningIcon: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.error,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  warningCard: {
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.md,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  warningList: {
    gap: spacing.md,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  warningItemText: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reasonButtonSelected: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  actionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default DeleteAccountScreen;
```

### 3. Data Export Request

File: `src/screens/compliance/DataExportScreen.tsx`

```typescript
export function DataExportScreen({
  navigation,
}: DataExportScreenProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'requested' | 'downloading'>('idle');
  const [downloadLink, setDownloadLink] = useState<string | null>(null);

  const handleRequestDataExport = async () => {
    setStatus('requesting');
    try {
      const response = await complianceService.requestDataExport();
      setStatus('requested');

      Alert.alert(
        'Export Requested',
        'Your data export has been requested. You will receive an email with a download link within 24 hours.'
      );
    } catch (error) {
      showError('Failed to request data export');
      setStatus('idle');
    }
  };

  const handleDownloadData = async () => {
    if (!downloadLink) return;

    setStatus('downloading');
    try {
      await Linking.openURL(downloadLink);
    } catch (error) {
      showError('Failed to open download link');
    } finally {
      setStatus('idle');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Ionicons
            name="download"
            size={40}
            color={colors.primary}
          />
          <Text style={styles.title}>Download Your Data</Text>
          <Text style={styles.subtitle}>
            Get a copy of your personal data in portable format
          </Text>
        </View>

        <View style={styles.content}>
          {/* What's included */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's Included</Text>
            <DataItem label="Profile Information" icon="person" />
            <DataItem label="Course Enrollments" icon="book" />
            <DataItem label="Learning Progress" icon="trending-up" />
            <DataItem label="Notes and Transcripts" icon="document-text" />
            <DataItem label="Community Posts" icon="chatbubbles" />
            <DataItem label="Account Activity" icon="time" />
          </View>

          {/* Processing info */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Processing Time</Text>
              <Text style={styles.infoText}>
                Your data export will be prepared within 24 hours and sent to your email
              </Text>
            </View>
          </View>

          {/* Format info */}
          <View style={styles.infoCard}>
            <Ionicons name="document" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Format</Text>
              <Text style={styles.infoText}>
                Data is provided in JSON format for easy import to other platforms
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* CTA Button */}
      <View style={styles.footer}>
        <Button
          title={status === 'requesting' ? 'Requesting...' : 'Request Data Export'}
          onPress={handleRequestDataExport}
          loading={status === 'requesting'}
          disabled={status === 'requesting' || status === 'requested'}
        />
        {status === 'requested' && (
          <Text style={styles.successText}>
            ✓ Request submitted. Check your email for the download link.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function DataItem({
  label,
  icon,
}: {
  label: string;
  icon: string;
}) {
  return (
    <View style={styles.dataItem}>
      <Ionicons name={icon as any} size={20} color={colors.primary} />
      <Text style={styles.dataItemText}>{label}</Text>
      <Ionicons name="checkmark" size={20} color={colors.success} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dataItemText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  successText: {
    fontSize: 12,
    color: colors.success,
    textAlign: 'center',
  },
});

export default DataExportScreen;
```

### 4. UGC Reporting and Blocking

File: `src/components/compliance/UgcReportingModal.tsx`

```typescript
interface ReportReason {
  id: string;
  label: string;
  category: 'harmful' | 'abusive' | 'spam' | 'other';
}

const REPORT_REASONS: ReportReason[] = [
  { id: 'hate', label: 'Hate speech or discrimination', category: 'harmful' },
  { id: 'violence', label: 'Violence or harm threats', category: 'harmful' },
  { id: 'sexual', label: 'Sexual or adult content', category: 'harmful' },
  { id: 'harassment', label: 'Harassment or bullying', category: 'abusive' },
  { id: 'spam', label: 'Spam or misleading content', category: 'spam' },
  { id: 'impersonation', label: 'Impersonation', category: 'abusive' },
  { id: 'other', label: 'Something else', category: 'other' },
];

export function UgcReportingModal({
  visible,
  contentType,
  contentId,
  onClose,
}: {
  visible: boolean;
  contentType: 'post' | 'comment' | 'profile';
  contentId: string;
  onClose: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitReport = async () => {
    if (!selectedReason) {
      showError('Please select a reason');
      return;
    }

    setIsSubmitting(true);
    try {
      await complianceService.reportUgc({
        contentType,
        contentId,
        reason: selectedReason,
        details,
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for reporting. Our team will review this content.'
      );

      onClose();
    } catch (error) {
      showError('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBlockUser = async () => {
    // Block user who created content
    Alert.alert(
      'Block User',
      'You will no longer see content from this user',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              // Extract userId from context - implementation specific
              await complianceService.blockUser('userId');
              Alert.alert('User Blocked', 'You will not see their content anymore');
              onClose();
            } catch (error) {
              showError('Failed to block user');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={onClose}>
            <Text style={styles.closeButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Report Content</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content}>
          <Text style={styles.sectionTitle}>Why are you reporting this?</Text>

          {REPORT_REASONS.map((reason) => (
            <Pressable
              key={reason.id}
              style={[
                styles.reasonButton,
                selectedReason === reason.id && styles.reasonButtonSelected,
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View
                style={[
                  styles.radio,
                  selectedReason === reason.id && styles.radioSelected,
                ]}
              >
                {selectedReason === reason.id && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <Text style={styles.reasonText}>{reason.label}</Text>
            </Pressable>
          ))}

          {selectedReason && (
            <View style={styles.detailsSection}>
              <Text style={styles.sectionTitle}>Additional Details</Text>
              <TextInput
                placeholder="Provide more information (optional)"
                placeholderTextColor={colors.textTertiary}
                value={details}
                onChangeText={setDetails}
                multiline
                style={styles.detailsInput}
                maxLength={500}
              />
              <Text style={styles.charCount}>{details.length}/500</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title="Block This User"
            variant="outline"
            onPress={handleBlockUser}
          />
          <Button
            title="Submit Report"
            onPress={handleSubmitReport}
            loading={isSubmitting}
            disabled={!selectedReason || isSubmitting}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

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
  closeButton: {
    fontSize: 14,
    color: colors.primary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reasonButtonSelected: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.sm,
    borderBottomWidth: 0,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  detailsSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 80,
    color: colors.text,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: colors.textTertiary,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default UgcReportingModal;
```

### 5. Compliance Service

File: `packages/shared/src/services/complianceService.ts`

```typescript
export class ComplianceService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async deleteAccount(data: {
    password: string;
    reason?: string;
  }): Promise<void> {
    await this.api.post("/compliance/delete-account", data);
  }

  async requestDataExport(): Promise<{ requestId: string }> {
    const { data } = await this.api.post("/compliance/data-export-request");
    return data;
  }

  async reportUgc(data: {
    contentType: "post" | "comment" | "profile";
    contentId: string;
    reason: string;
    details?: string;
  }): Promise<void> {
    await this.api.post("/compliance/report-ugc", data);
  }

  async blockUser(userId: string): Promise<void> {
    await this.api.post(`/users/${userId}/block`);
  }

  async getBlockedUsers(): Promise<string[]> {
    const { data } = await this.api.get("/users/blocked");
    return data.blockedUserIds;
  }

  async unblockUser(userId: string): Promise<void> {
    await this.api.post(`/users/${userId}/unblock`);
  }
}

export const complianceService = new ComplianceService();
```

### 6. Community Guidelines Modal

File: `src/components/compliance/CommunityGuidelinesModal.tsx`

```typescript
export function CommunityGuidelinesModal({
  visible,
  onAccept,
}: {
  visible: boolean;
  onAccept: () => void;
}) {
  const [accepted, setAccepted] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          <Text style={styles.title}>Community Guidelines</Text>

          <GuidelineSection
            title="Be Respectful"
            description="Treat all community members with respect. No harassment, hate speech, or discrimination."
          />

          <GuidelineSection
            title="Stay On Topic"
            description="Keep discussions relevant to courses and learning. No spam or promotional content."
          />

          <GuidelineSection
            title="No Harmful Content"
            description="Do not share content that promotes violence, illegal activities, or harm."
          />

          <GuidelineSection
            title="Respect Privacy"
            description="Do not share personal information about others without consent."
          />

          <GuidelineSection
            title="Report Issues"
            description="If you see inappropriate content, report it to our moderation team."
          />

          <Pressable
            style={styles.checkbox}
            onPress={() => setAccepted(!accepted)}
          >
            <Ionicons
              name={accepted ? 'checkbox' : 'checkbox-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={styles.checkboxText}>
              I agree to follow these guidelines
            </Text>
          </Pressable>
        </ScrollView>

        <Button
          title="Accept"
          onPress={onAccept}
          disabled={!accepted}
          style={styles.button}
        />
      </SafeAreaView>
    </Modal>
  );
}

function GuidelineSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginVertical: spacing.xl,
  },
  checkboxText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  button: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.lg,
  },
});
```

## Acceptance Criteria

- [ ] Privacy labels configured for both iOS and Android
- [ ] Account deletion available and working
- [ ] Data export request functionality working
- [ ] Email verification for password reset working
- [ ] UGC reporting available on posts/comments
- [ ] Block user functionality working
- [ ] Community guidelines shown on first use
- [ ] All compliance screens accessible from settings
- [ ] No IAP in app (payments via web only)
- [ ] Play Store data safety form completed
- [ ] App Store privacy labels submitted
- [ ] Account deletion takes up to 30 days (soft delete)
- [ ] Data export email sent within 24 hours
- [ ] Deletion reason collected for feedback
- [ ] No console errors

## Dependencies

- react-native (Linking)
- axios (HTTP client)
- @react-navigation/native

## Technical Notes

### iOS Privacy Labels

- PrivacyInfo.xcprivacy required for App Store
- Must declare all data collected
- Use Xcode to generate
- Privacy manifest in Info.plist

### Android Data Safety

- Google Play Console data safety form
- Declare data types and purposes
- Security certifications
- Encryption in transit/at rest

### Account Deletion

- Soft delete: 30-day grace period
- Can cancel within 30 days
- Hard delete after 30 days
- Complies with GDPR/CCPA

### Data Export

- JSON format for portability
- All user data included
- Generated server-side
- Email link valid 7 days

### UGC Reporting

- Report reasons categorized
- Moderation queue
- User notification on action
- Block list maintained

### No IAP

- V1 uses web checkout only
- Stripe handled on web
- App redirects to web for payment
- Deep link back on completion
