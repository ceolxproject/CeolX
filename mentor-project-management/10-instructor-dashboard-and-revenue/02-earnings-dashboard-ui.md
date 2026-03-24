# Earnings Dashboard UI

## Description

Build the instructor earnings dashboard in the Mentor Next.js web app. Display summary cards for key metrics (total earned, pending balance, paid out), interactive revenue charts with daily/weekly/monthly views, course breakdown table, and subscription vs one-time revenue comparison. Include date range picker for filtering all dashboard metrics.

## Affected Apps/Packages

- Frontend: `mentor-web` (Next.js)
- Components: Design system components (custom or shadcn/ui)
- API Integration: Earnings dashboard API endpoints
- State Management: React Query / SWR for data fetching

## UI Components

### Summary Cards Section

**Location**: Dashboard header, above charts

**Cards to Display:**

1. **Total Earned**
   - Large headline metric (e.g., "$4,250.50")
   - Subtitle: "All time" or selected date range
   - Optional: percentage change vs previous period (e.g., "+12.5% vs last month")
   - Icon: Currency icon
   - Loading state: Skeleton card

2. **Pending Balance**
   - Prominent display with yellow/amber background
   - Shows amount available for next payout
   - Subtitle: "Available for payout"
   - Status indicator badge (e.g., "Ready for payout" or "Waiting for bank setup")
   - Action button: "Request Payout" (if eligible) or link to Stripe setup (if not)

3. **Paid Out**
   - Display total paid out to bank account
   - Link to payout history (expands below or navigates to separate page)
   - "View Details" CTA

4. **Next Payout (Optional)**
   - Date of next scheduled payout (if eligible)
   - Status: "Eligible", "Pending verification", "Bank setup required"
   - If not eligible: reason explanation

**Card Layout:**

- Responsive: 2 columns on tablet, 4 columns on desktop, stacked on mobile
- Equal height within row
- Consistent spacing and shadow depth
- Hover effect: subtle lift/shadow increase on desktop

---

### Revenue Chart Section

**Location**: Below summary cards

**Chart Types:**

1. **Line Chart** (Primary)
   - X-axis: Time periods (date labels)
   - Y-axis: USD earnings ($)
   - Show two lines:
     - Total revenue (all sources)
     - OR toggle between Total, Single Purchase, Subscription
   - Display values on hover
   - Responsive: max-height 400px, scrollable x-axis if needed

2. **Bar Chart** (Alternative view)
   - Same data as line chart
   - Better for comparing discrete periods
   - Stacked option: show single purchase vs subscription breakdown per period

**Time Period Toggle:**

- Buttons: "Day", "Week", "Month"
- Default: "Month"
- Clicking button updates chart data and X-axis labels
- Day view: shows last 30 days
- Week view: shows last 12 weeks
- Month view: shows last 12 months

**Chart Interactions:**

- Hover tooltip showing: date, amount, transaction type breakdown
- Click-to-drill: clicking a data point could show transactions for that period (future enhancement)
- Legend: show/hide lines for Total, Single Purchase, Subscription
- Y-axis: auto-scale with min/max padding

**Chart Library:**

- Recommendation: Recharts (React-friendly, responsive, good documentation)
- Alternative: Chart.js with react-chartjs-2
- Avoid: Google Charts (external dependency, privacy concerns)

---

### Course Breakdown Table

**Location**: Below revenue chart

**Table Structure:**

```
| Course Name | Earnings | Single Purchase | Subscription | Enrollments | % of Total |
|-------------|----------|-----------------|--------------|-------------|-----------|
| Advanced Makeup Techniques | $2,100.00 | $1,400.00 | $700.00 | 45 | 49.4% |
| Skin Care Fundamentals | $2,150.50 | $1,505.35 | $645.15 | 38 | 50.6% |
```

**Columns:**

- **Course Name**: Clickable link to course management page
- **Earnings**: Total earnings from course (single + subscription)
- **Single Purchase**: Revenue from direct course purchases only
- **Subscription**: Revenue from All Access subscription pool attribution
- **Enrollments**: Total number of students enrolled
- **% of Total**: Percentage of instructor's total earnings

**Sorting:**

- Default: by earnings (descending)
- Sortable columns: Course Name, Earnings, Enrollments
- Click column header to toggle sort direction

**Pagination:**

- Show up to 10 courses per page
- If more than 10: pagination controls at bottom
- Use offset-based pagination from API

**Empty State:**

- If no courses: "No courses created yet" message with link to course creation

**Responsive Behavior:**

- Desktop: All columns visible
- Tablet: Hide "% of Total" column, reduce padding
- Mobile:
  - Show only: Course Name, Earnings, hide others
  - Expand rows to show details
  - OR horizontal scroll (not ideal, but acceptable)

**Filtering:**

- Filter by course name (search input above table)
- Clear button to reset search

---

### Revenue Type Breakdown Section

**Location**: Alternate section (can be accordion or below course table)

**Display Option 1: Pie/Donut Chart**

- Two segments: Single Purchase (70% split) and Subscription (watch-time share)
- Show percentage for each
- Hover tooltip: actual dollar amount

**Display Option 2: Comparison Cards**

- Card 1: Single Purchase Revenue
  - Total amount
  - Percentage of total earnings
  - Number of transactions
- Card 2: Subscription Revenue
  - Total amount
  - Percentage of total earnings
  - Covered billing periods

**Display Option 3: Metric Comparison**

- Row layout showing side-by-side:
  - Single Purchase: $X, Y transactions, Z% of total
  - Subscription: $X, billing periods, Z% of total

**Recommendation**: Use Pie/Donut chart with accompanying metrics card

---

### Date Range Picker

**Location**: Top right of dashboard (persistent across all sections)

**Components:**

- Preset buttons: "Today", "Last 7 Days", "Last 30 Days", "Last 90 Days", "Year to Date", "Custom"
- Custom range input:
  - Two date input fields: "From Date" and "To Date"
  - Calendar popover for picking dates
  - "Apply" button to update dashboard

**Behavior:**

- Default selection: "Last 90 Days"
- Clicking preset instantly updates all dashboard metrics
- "Custom" expands date picker
- Disables future dates in calendar
- Validates end date >= start date

**Persistence:**

- Store selected date range in URL query params (e.g., ?dateFrom=2024-01-01&dateTo=2024-02-18)
- Allow sharing filtered dashboard via URL
- Restore date range on page reload

---

### Payout Status Banner

**Location**: Top of dashboard (above summary cards)

**Scenarios:**

1. **Eligible & Bank Setup Complete**
   - Green banner: "You're eligible for payouts. Next payout: February 28, 2024"
   - Action: Button "Request Payout Now" (navigates to payout history page)

2. **Pending Bank Setup**
   - Yellow banner: "Complete Stripe Connect setup to enable payouts"
   - Action: Button "Connect Bank Account" (navigates to Stripe onboarding)

3. **Pending Super Admin Verification**
   - Blue banner: "Your account is pending Super Admin verification. You'll be able to request payouts once approved."
   - No action button

4. **Stripe Account Issues**
   - Red banner: "There's an issue with your Stripe account. [Link: Contact Support]"
   - Action: Link to support documentation

**Dismissal**: User can dismiss banner, state persists in localStorage

---

## Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│  Earnings Dashboard                        [Date Range ▼]    │
├─────────────────────────────────────────────────────────────┤
│ [Payout Status Banner if needed]                            │
├─────────────────────────────────────────────────────────────┤
│  Summary Cards Row                                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │Total Earned │ Pending Bal │  Paid Out   │ Next Payout │  │
│  │  $4,250.50  │  $875.25    │ $3,375.25   │ Feb 28      │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Revenue Chart                                              │
│  [Day] [Week] [Month]                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  (Line/Bar Chart)                                   │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  Course Breakdown                                           │
│  [Search input]                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Course Name | Earnings | SP | Sub | Enroll | %       │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Advanced Makeup... | $2,100 | $1,400 | $700 | 45 | 49% │   │
│  │ Skin Care Fund...  | $2,150 | $1,505 | $645 | 38 | 51% │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  Revenue Type Breakdown                                     │
│  ┌──────────────┐  ┌─────────────────────────────────────┐  │
│  │              │  │ Single Purchase: $2,905.35 (68%)    │  │
│  │  [Pie Chart] │  │ Subscription: $1,345.15 (32%)       │  │
│  │              │  └─────────────────────────────────────┘  │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow & State Management

### Fetching Data

```typescript
// Pseudo-code using React Query

const useDashboardData = (dateFrom: string, dateTo: string) => {
  // Summary data
  const summaryQuery = useQuery(["earnings", dateFrom, dateTo], () =>
    fetch(`/api/instructor/earnings?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  );

  // Breakdown by course
  const breakdownQuery = useQuery(
    ["earnings-breakdown", dateFrom, dateTo],
    () =>
      fetch(
        `/api/instructor/earnings/breakdown?groupBy=course&dateFrom=${dateFrom}&dateTo=${dateTo}`,
      ),
  );

  // Revenue history (for chart)
  const historyQuery = useQuery(["earnings-history", dateFrom, dateTo], () =>
    fetch(
      `/api/instructor/earnings/history?dateFrom=${dateFrom}&dateTo=${dateTo}`,
    ),
  );

  return {
    summary: summaryQuery,
    breakdown: breakdownQuery,
    history: historyQuery,
    isLoading: summaryQuery.isLoading || breakdownQuery.isLoading,
    error: summaryQuery.error || breakdownQuery.error,
  };
};
```

### Loading States

- Skeleton loaders for summary cards (show 4 shimmer cards)
- Chart skeleton (gray rectangle with shimmer animation)
- Table skeleton (multiple rows of alternating gray bars)
- Display "Loading earnings data..." text during initial load

### Error Handling

- If API returns error: show alert banner with error message
- Provide "Retry" button to refetch
- Fallback: "Unable to load earnings data. Please try again later."
- Log errors to Sentry for monitoring

### Caching Strategy

- Cache summary data for 5 minutes
- Cache breakdown data for 5 minutes
- Cache history for 10 minutes
- Manual refetch button for real-time updates

---

## Responsive Design

### Mobile (< 640px)

- Stacked layout: cards in single column
- Charts: auto-scale height, scrollable if needed
- Table: horizontal scroll or simplified view
- Date picker: modal overlay on button click

### Tablet (640px - 1024px)

- Summary cards: 2x2 grid
- Charts: full width
- Table: 2-column view (condensed)

### Desktop (> 1024px)

- Summary cards: 4 in a row
- Charts: full width, optimal height
- Table: all columns visible
- Side-by-side layout for breakdowns

---

## Accessibility Requirements

- All text has sufficient color contrast (WCAG AA)
- Icons have aria-labels
- Charts have accessible data tables (tab to expand)
- Date picker is keyboard accessible
- Form fields have proper labels
- Loading states announced to screen readers
- Error messages linked to form fields (aria-describedby)

---

## Requirements

### UI Framework

- Next.js (React 18+)
- CSS-in-JS: Tailwind CSS (preferred) or styled-components
- Component library: shadcn/ui components (Buttons, Cards, Tabs, etc.)

### Charts Library

- Recharts for revenue visualization
- Install: `npm install recharts`

### Date Handling

- date-fns for date manipulation and formatting
- Install: `npm install date-fns`

### Data Fetching

- React Query (TanStack Query) or SWR
- Recommend: React Query for complex dashboard state

### API Integration

- Fetch from `/api/instructor/earnings*` endpoints
- Include JWT token in Authorization header

---

## Acceptance Criteria

- [ ] Summary cards display: Total Earned, Pending Balance, Paid Out, Next Payout
- [ ] Cards show correct values fetched from /instructor/earnings API
- [ ] Pending balance updates when new transactions complete
- [ ] Revenue chart displays line graph of earnings over time
- [ ] Chart supports Day, Week, Month time period toggles
- [ ] Chart updates when date range changes
- [ ] Course breakdown table shows all courses with earnings breakdown
- [ ] Table is sortable by Course Name, Earnings, Enrollments
- [ ] Table shows course name as clickable link to course edit page
- [ ] Course table filters by search input (course name)
- [ ] Revenue type breakdown (pie chart or cards) shows Single Purchase vs Subscription
- [ ] Date range picker defaults to Last 90 Days
- [ ] Date range picker preset buttons (Today, Last 7 Days, Last 30 Days, etc.) work correctly
- [ ] Custom date range picker validates input (end date >= start date)
- [ ] Date range selection updates URL query params
- [ ] All dashboard metrics update when date range changes
- [ ] Payout status banner displays correct status message
- [ ] Banner shows action button (Request Payout or Connect Bank) when applicable
- [ ] Dashboard handles loading states gracefully (skeleton loaders)
- [ ] Error states display meaningful messages with retry option
- [ ] Dashboard is responsive on mobile, tablet, and desktop
- [ ] All text meets WCAG AA contrast ratio requirements
- [ ] Charts are keyboard accessible
- [ ] Date picker is keyboard accessible and uses proper ARIA labels
- [ ] Page title and breadcrumbs display "Earnings Dashboard"
- [ ] Navigation link to Earnings Dashboard visible in mentor app header

## Dependencies

- **Milestone**: Earnings Dashboard API (01-earnings-dashboard-api)
- **Milestone**: Design System (03-design-system-and-shared-packages)
- **Component Library**: shadcn/ui Button, Card, Tabs, Input components
- **Chart Library**: Recharts
- **Date Library**: date-fns
- **State Management**: React Query or SWR
- **Design Foundation**: Tailwind CSS

## Technical Notes

### Performance Optimization

1. **Code Splitting**: Lazy-load chart component (Suspense boundary)
2. **Memoization**: Wrap components with React.memo to prevent unnecessary re-renders
3. **Query Batching**: Fetch summary + breakdown + history in parallel (not sequential)
4. **Image Optimization**: Use next/image for any icons/images

### Chart Data Transformation

```typescript
// Transform API history data to chart format
const chartData = historyQuery.data.transactions.reduce((acc, txn) => {
  const date = new Date(txn.date).toLocaleDateString();
  const existing = acc.find((item) => item.date === date);
  if (existing) {
    existing.amount += txn.instructorShare;
  } else {
    acc.push({ date, amount: txn.instructorShare });
  }
  return acc;
}, []);
```

### Handling Missing Data

- If no earnings yet: show empathetic empty state with tips to increase earnings
- If no courses: link to course creation flow
- If bank not set up: prominent CTA to Stripe Connect onboarding

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 13+)

### Monitoring & Analytics

- Track: "Dashboard Viewed", "Date Range Changed", "Chart Period Toggled"
- Track: "Request Payout Clicked", "Connect Bank Clicked"
- Monitor: API response times, error rates
- Alert on: Missing earnings data, chart rendering failures

### Future Enhancements

1. Export earnings report to CSV
2. Weekly email digest of earnings
3. Earnings forecast based on trends
4. Cohort comparison (vs average instructor)
5. Detailed transaction receipt view
6. Advanced filtering (by student, by rating, etc.)
