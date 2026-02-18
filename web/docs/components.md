# Component Usage

## Layout

- DashboardShell wraps all dashboard routes
- Sidebar adapts to the current role
- Topbar shows role and sign-out action

## Lead Management

- LeadList shows leads with countdown timers
- StageProgress renders stage completion badges
- LeadDetail displays activities and audio uploads

## Scheduling

- MeetingDatePicker includes conflict detection
- UpcomingMeetings shows reminders
- AvailabilityCalendar displays current meetings

## Analytics

- PerformanceCharts renders line, bar, pie charts
- DisciplineHeatmap renders weekly activity grid
- CommissionOverview renders projection progress

## AI

- ScriptSuggestionPanel lists recommended scripts
- ScriptPerformance tracks script effectiveness
- TemplateManager manages reusable scripts

## Animated Icons

### Usage Map
- لوحة المالك: محفظة الصفقات، تقييم العقار، قوائم للبيع، اعتماد العقود، التحصيل، المدينة الخضراء
- لوحة قائد الفريق: المخططات، خطة الفريق، جدولة الاجتماعات، قادة ومندوبون، بحث العملاء
- لوحة المبيعات: الشقق، المنازل، العقارات، إدارة العقود، التمويل العقاري، الوكيل الميداني
- صفحة تسجيل الدخول: منصة الويب، تطبيق الجوال

### Visual Consistency
- المقاس المعتمد: 36×36 داخل إطار 48×48
- التفاعل: تكبير خفيف عند التمرير وتصغير لحظي عند النقر
- الحركة: احترام إعدادات تقليل الحركة عبر prefers-reduced-motion

### Performance Guidance
- الأفضلية: WebP متحرك أو Lottie عند توفر النسخة المقابلة
- التحميل: استخدام lazy و decoding=async
- المصدر: روابط خارجية مسموحة عبر CSP مع https

### Replacement Steps
- حدّث رابط الأيقونة داخل arrays الخاصة بـ IconShowcase
- تأكد من توافق المقاس مع 36×36
- راجع المعنى والسياق في صفحة الاستخدام
- اختبر في الوضعين الفاتح والداكن وعلى الهاتف
