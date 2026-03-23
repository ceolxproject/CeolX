# Mobile Bookmarks and Assignments

## Description

Implement bookmarking functionality for courses and lessons with quick access from a dedicated tab in My Courses. Implement assignment/quiz display with multiple-choice questions, answer submission, and results display with explanations.

## Affected Apps/Packages

- `apps/mobile/src/screens/lesson/AssignmentsScreen.tsx` (new)
- `apps/mobile/src/components/assignments/` (new)
- `packages/shared/src/services/assignmentService.ts` (new)

## Requirements

### 1. Bookmarks Feature

File: `src/hooks/useBookmarks.ts`

```typescript
interface BookmarkedItem {
  id: string;
  type: "course" | "lesson";
  title: string;
  bookmarkedAt: string;
}

export function useBookmarks() {
  const [bookmarkedItems, setBookmarkedItems] = useState<BookmarkedItem[]>([]);

  const toggleBookmark = async (
    id: string,
    type: "course" | "lesson",
    title: string
  ) => {
    try {
      const isBookmarked = bookmarkedItems.some(
        (item) => item.id === id && item.type === type
      );

      if (isBookmarked) {
        await courseService.removeBookmark(id, type);
        setBookmarkedItems(
          bookmarkedItems.filter(
            (item) => !(item.id === id && item.type === type)
          )
        );
      } else {
        await courseService.addBookmark(id, type, title);
        setBookmarkedItems([
          ...bookmarkedItems,
          {
            id,
            type,
            title,
            bookmarkedAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      showError("Failed to update bookmark");
    }
  };

  const isBookmarked = (id: string, type: "course" | "lesson") => {
    return bookmarkedItems.some((item) => item.id === id && item.type === type);
  };

  return {
    bookmarkedItems,
    toggleBookmark,
    isBookmarked,
  };
}
```

### 2. Assignments Screen

File: `src/screens/lesson/AssignmentsScreen.tsx`

Main assignments/quiz display:

```typescript
interface Assignment {
  id: string;
  title: string;
  description?: string;
  type: 'quiz' | 'assignment';
  questions: Question[];
  dueDate?: string;
  passingScore: number;
  maxAttempts?: number;
  userProgress?: {
    completed: boolean;
    score?: number;
    attemptNumber: number;
    submittedAt?: string;
  };
}

interface Question {
  id: string;
  type: 'multiple-choice' | 'short-answer' | 'true-false';
  question: string;
  options?: string[]; // For multiple choice
  correctAnswer?: string | number;
  explanation?: string;
  order: number;
}

export function AssignmentsScreen({
  route,
  navigation,
}: AssignmentsScreenProps) {
  const { assignmentId, lessonId } = route.params;

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AssignmentResult | null>(null);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchAssignment();
  }, [assignmentId]);

  const fetchAssignment = async () => {
    setIsLoading(true);
    try {
      const data = await assignmentService.getAssignment(assignmentId);
      setAssignment(data);

      // Load previous answers if exists
      if (data.userProgress?.completed) {
        setShowResults(true);
      }
    } catch (error) {
      showError('Failed to load assignment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, answer: string | number) => {
    setAnswers({
      ...answers,
      [questionId]: answer,
    });
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < (assignment?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!assignment) return;

    const unansweredCount = assignment.questions.filter(
      (q) => !(q.id in answers)
    ).length;

    if (unansweredCount > 0) {
      Alert.alert(
        'Unanswered questions',
        `You have ${unansweredCount} unanswered question(s). Submit anyway?`,
        [
          { text: 'Review', style: 'cancel' },
          {
            text: 'Submit',
            style: 'destructive',
            onPress: submitAssignment,
          },
        ]
      );
    } else {
      submitAssignment();
    }
  };

  const submitAssignment = async () => {
    setIsSubmitting(true);
    try {
      const result = await assignmentService.submitAssignment({
        assignmentId,
        answers,
      });

      setResult(result);
      setShowResults(true);
    } catch (error) {
      showError('Failed to submit assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Assignment not found</Text>
      </View>
    );
  }

  if (showResults && result) {
    return (
      <AssignmentResults
        assignment={assignment}
        result={result}
        userAnswers={answers}
        onRetry={
          assignment.maxAttempts === undefined ||
          (assignment.userProgress?.attemptNumber || 0) < assignment.maxAttempts
            ? () => {
                setShowResults(false);
                setAnswers({});
                setCurrentQuestionIndex(0);
              }
            : undefined
        }
        onClose={() => navigation.goBack()}
      />
    );
  }

  const currentQuestion = assignment.questions[currentQuestionIndex];
  const progressPercentage =
    ((currentQuestionIndex + 1) / assignment.questions.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {assignment.title}
          </Text>
          <Text style={styles.headerSubtitle}>
            Question {currentQuestionIndex + 1}/{assignment.questions.length}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
      </View>

      {/* Question */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.question}>{currentQuestion.question}</Text>

        {/* Answer options based on type */}
        {currentQuestion.type === 'multiple-choice' && (
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, index) => (
              <QuestionOption
                key={index}
                label={option}
                value={index.toString()}
                selected={answers[currentQuestion.id] === index.toString()}
                onChange={() => handleAnswerChange(currentQuestion.id, index.toString())}
              />
            ))}
          </View>
        )}

        {currentQuestion.type === 'true-false' && (
          <View style={styles.optionsContainer}>
            <QuestionOption
              label="True"
              value="true"
              selected={answers[currentQuestion.id] === 'true'}
              onChange={() => handleAnswerChange(currentQuestion.id, 'true')}
            />
            <QuestionOption
              label="False"
              value="false"
              selected={answers[currentQuestion.id] === 'false'}
              onChange={() => handleAnswerChange(currentQuestion.id, 'false')}
            />
          </View>
        )}

        {currentQuestion.type === 'short-answer' && (
          <TextInput
            placeholder="Type your answer here..."
            placeholderTextColor={colors.textTertiary}
            value={(answers[currentQuestion.id] as string) || ''}
            onChangeText={(text) => handleAnswerChange(currentQuestion.id, text)}
            multiline
            style={styles.textInput}
          />
        )}
      </ScrollView>

      {/* Navigation and submit */}
      <View style={styles.footer}>
        <Button
          title="Previous"
          variant="outline"
          onPress={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
        />
        {currentQuestionIndex === assignment.questions.length - 1 ? (
          <Button
            title="Submit"
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        ) : (
          <Button
            title="Next"
            onPress={handleNextQuestion}
            disabled={currentQuestionIndex === assignment.questions.length - 1}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function QuestionOption({
  label,
  value,
  selected,
  onChange,
}: {
  label: string;
  value: string;
  selected: boolean;
  onChange: () => void;
}) {
  return (
    <Pressable
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
      onPress={onChange}
    >
      <View
        style={[
          styles.optionRadio,
          selected && styles.optionRadioSelected,
        ]}
      >
        {selected && <View style={styles.optionRadioDot} />}
      </View>
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
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
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: 16,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.border,
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  optionsContainer: {
    gap: spacing.md,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionRadioSelected: {
    borderColor: colors.primary,
  },
  optionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 100,
    color: colors.text,
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

export default AssignmentsScreen;
```

### 3. Assignment Results Component

File: `src/components/assignments/AssignmentResults.tsx`

Display results with explanations:

```typescript
interface AssignmentResult {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

export function AssignmentResults({
  assignment,
  result,
  userAnswers,
  onRetry,
  onClose,
}: {
  assignment: Assignment;
  result: AssignmentResult;
  userAnswers: Record<string, string | number>;
  onRetry?: () => void;
  onClose: () => void;
}) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Results header */}
        <View
          style={[
            styles.resultHeader,
            {
              backgroundColor: result.passed ? colors.success : colors.error,
            },
          ]}
        >
          <Ionicons
            name={result.passed ? 'checkmark-circle' : 'close-circle'}
            size={60}
            color={colors.white}
          />
          <Text style={styles.resultTitle}>
            {result.passed ? 'Congratulations!' : 'Not quite'}
          </Text>
          <Text style={styles.resultSubtitle}>
            {result.passed
              ? 'You passed the assignment'
              : `You need ${assignment.passingScore}% to pass`}
          </Text>
        </View>

        {/* Score display */}
        <View style={styles.scoreContainer}>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{result.percentage}%</Text>
            <Text style={styles.scoreLabel}>Your Score</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreValue}>{assignment.passingScore}%</Text>
            <Text style={styles.scoreLabel}>Passing Score</Text>
          </View>
        </View>

        {/* Question review */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>Review Your Answers</Text>
          {assignment.questions.map((question, index) => {
            const userAnswer = userAnswers[question.id];
            const isCorrect = userAnswer === question.correctAnswer;

            return (
              <View
                key={question.id}
                style={[
                  styles.questionReview,
                  isCorrect && styles.questionReviewCorrect,
                  !isCorrect && styles.questionReviewIncorrect,
                ]}
              >
                <View style={styles.questionReviewHeader}>
                  <Text style={styles.questionReviewNumber}>
                    Question {index + 1}
                  </Text>
                  <Ionicons
                    name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={isCorrect ? colors.success : colors.error}
                  />
                </View>

                <Text style={styles.questionText}>{question.question}</Text>

                <View style={styles.answerDisplay}>
                  <Text style={styles.answerLabel}>Your answer:</Text>
                  <Text style={styles.answerValue}>
                    {getAnswerLabel(question, userAnswer)}
                  </Text>
                </View>

                {!isCorrect && (
                  <View style={styles.answerDisplay}>
                    <Text style={styles.answerLabel}>Correct answer:</Text>
                    <Text style={styles.correctAnswerValue}>
                      {getAnswerLabel(question, question.correctAnswer)}
                    </Text>
                  </View>
                )}

                {question.explanation && (
                  <View style={styles.explanation}>
                    <Text style={styles.explanationLabel}>Explanation</Text>
                    <Text style={styles.explanationText}>
                      {question.explanation}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={styles.footer}>
        {onRetry && (
          <Button
            title="Retry"
            variant="outline"
            onPress={onRetry}
          />
        )}
        <Button
          title="Close"
          onPress={onClose}
          style={{ flex: 1 }}
        />
      </View>
    </SafeAreaView>
  );
}

function getAnswerLabel(
  question: Question,
  answer: string | number | undefined
): string {
  if (answer === undefined) return 'Not answered';

  if (question.type === 'multiple-choice') {
    return question.options?.[Number(answer)] || '';
  }

  if (question.type === 'true-false') {
    return answer === 'true' ? 'True' : 'False';
  }

  return String(answer);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.lg,
  },
  resultHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
  },
  resultSubtitle: {
    fontSize: 14,
    color: colors.white,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  scoreBox: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  reviewSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  questionReview: {
    borderRadius: 8,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.border,
  },
  questionReviewCorrect: {
    backgroundColor: colors.successLight,
    borderLeftColor: colors.success,
  },
  questionReviewIncorrect: {
    backgroundColor: colors.errorLight,
    borderLeftColor: colors.error,
  },
  questionReviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  questionReviewNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  answerDisplay: {
    marginBottom: spacing.md,
  },
  answerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  answerValue: {
    fontSize: 13,
    color: colors.text,
  },
  correctAnswerValue: {
    fontSize: 13,
    color: colors.success,
    fontWeight: '600',
  },
  explanation: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: spacing.md,
    borderRadius: 6,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  explanationText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
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

export default AssignmentResults;
```

### 4. Assignment Service

File: `packages/shared/src/services/assignmentService.ts`

```typescript
export class AssignmentService {
  private api = axios.create({
    baseURL: process.env.EXPO_PUBLIC_API_URL,
  });

  async getAssignment(assignmentId: string): Promise<Assignment> {
    const { data } = await this.api.get(`/assignments/${assignmentId}`);
    return data.assignment;
  }

  async submitAssignment(data: {
    assignmentId: string;
    answers: Record<string, string | number>;
  }): Promise<AssignmentResult> {
    const { data: result } = await this.api.post(
      `/assignments/${data.assignmentId}/submit`,
      {
        answers: data.answers,
      }
    );
    return result;
  }

  async getLessonAssignments(lessonId: string): Promise<Assignment[]> {
    const { data } = await this.api.get(`/lessons/${lessonId}/assignments`);
    return data.assignments;
  }
}

export const assignmentService = new AssignmentService();
```

## Acceptance Criteria

- [ ] Bookmark toggle works on courses and lessons
- [ ] Bookmarks persist across sessions
- [ ] Bookmarked tab in My Courses shows all bookmarked courses
- [ ] Assignments screen displays questions one at a time
- [ ] Progress bar shows completion percentage
- [ ] Multiple-choice answers display correctly
- [ ] True/false questions work
- [ ] Short answer text input available
- [ ] Previous/Next navigation works
- [ ] Submit disables after completion
- [ ] Results show score and passing status
- [ ] Questions review displays all answers
- [ ] Correct/incorrect indicated with colors and icons
- [ ] Explanations shown for all questions
- [ ] Retry available if attempts remaining
- [ ] Unanswered questions warning before submit
- [ ] No console errors

## Dependencies

- react-native (FlatList, TextInput)
- @react-navigation/native
- axios (HTTP client)

## Technical Notes

### Bookmarks Storage

- Cache in AsyncStorage for quick toggle
- Sync to backend on app backgrounding
- No data loss on app crash

### Answer Validation

- Trim whitespace for short answers
- Case-insensitive comparison if needed
- Support partial credit if backend allows

### Assignment Types

V1: Multiple choice, true/false
V2: Short answer with rubric
V3: Essay with instructor grading
