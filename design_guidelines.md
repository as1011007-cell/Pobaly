# Probaly Design Guidelines

## 1. Brand Identity

**Purpose**: Sports analytics app providing AI-powered probability insights for upcoming and live sporting events. This is NOT a gambling app — it's a data intelligence platform for sports enthusiasts who value statistical rigor.

**Aesthetic Direction**: Editorial/analytical — clean, professional, trustworthy. Think Bloomberg Terminal meets ESPN stats, not a casino or betting app.

**Memorable Element**: Probability bars with gradient fills that subtly pulse during live events. Confidence badges use distinct geometric shapes (circle/square/triangle) not just colors.

**Color Psychology**: Blues convey trust and data reliability. Greens indicate positive outcomes. Amber signals caution. No reds or flashy casino colors.

## 2. Navigation Architecture

**Root Navigation**: Tab Bar (5 tabs)
- Home (house icon)
- Live (activity icon)
- Sports (grid icon)
- History (clock icon)
- Profile (user icon)

**Authentication**: Required — email login with OTP or password. Include forgot password flow.

## 3. Screen-by-Screen Specifications

### Onboarding Flow (Stack-Only)
**Welcome Screen**
- Hero illustration showing data visualization
- App name and tagline: "Sports Intelligence, Probability-Driven"
- "Get Started" button
- "Sign In" text button

**Auth Screens**
- Email input → OTP or password entry
- Forgot password recovery
- Success state with checkmark animation

### Home Tab
**Header**: Transparent, title "Probaly", settings icon (right)
**Layout**: Scrollable with sections:
1. Free Tip of the Day (hero card)
   - Large prediction card with gradient background
   - Match name, time, sport icon
   - Predicted outcome in bold
   - Probability percentage (large)
   - Confidence badge
   - AI explanation (2-3 lines)
   - "View Details" button
2. Premium Predictions (if subscribed) / Upgrade CTA (if free)
   - Grid of prediction cards (2 columns on larger screens, 1 on small)
   - Blurred cards with lock icon for free users
3. Top Upcoming Events section
**Safe Area**: Top inset = headerHeight + Spacing.xl, Bottom = tabBarHeight + Spacing.xl
**Empty State**: "No predictions available today" with calendar illustration

### Live Tab
**Header**: Transparent, title "Live Events", filter icon (right)
**Layout**: Scrollable list of live match cards
- Real-time probability updates
- Subtle pulse animation on probability bars
- Time elapsed indicator
- "LIVE" badge in red
**Safe Area**: Top = headerHeight + Spacing.xl, Bottom = tabBarHeight + Spacing.xl
**Empty State**: "No live events right now" with sports field illustration

### Sports Tab
**Header**: Default, title "Sports"
**Layout**: Grid of sport category cards (2 columns)
- Football, Basketball, Cricket, Tennis
- Each card has sport icon, name, count of predictions
- Tapping opens filtered prediction list
**Safe Area**: Top = Spacing.xl, Bottom = tabBarHeight + Spacing.xl

### History Tab
**Header**: Default, title "Prediction History", filter icon (right)
**Layout**: Scrollable list showing past predictions
- Date grouping
- Outcome badge (Correct/Incorrect)
- Original probability vs actual result
**Safe Area**: Top = Spacing.xl, Bottom = tabBarHeight + Spacing.xl
**Empty State**: "No prediction history yet" with chart illustration

### Profile Tab
**Header**: Transparent, title "Profile"
**Layout**: Scrollable form with sections:
1. User info (avatar, name, email)
2. Subscription status card (Premium or Free with Upgrade CTA)
3. Settings list: Notifications, Language, Theme
4. Legal: Terms, Privacy Policy
5. Log Out button
6. Delete Account (nested in Settings > Account)
**Safe Area**: Top = headerHeight + Spacing.xl, Bottom = tabBarHeight + Spacing.xl

### Prediction Detail Screen (Modal)
**Header**: Close button (left), share icon (right)
**Layout**: Scrollable content:
- Match header with teams/players
- Large probability visualization (circular progress)
- Confidence badge
- AI explanation (expandable)
- Key factors list (injuries, form, head-to-head)
- Risk index meter
- Probability history chart
**Floating Button**: "Get Premium" if locked content

### Subscription Paywall (Modal)
**Layout**: Scrollable
- "Unlock All Predictions" headline
- Feature comparison list (Free vs Premium)
- $49/year pricing (prominent)
- "Start Annual Subscription" button
- Terms & restore purchase links

## 4. Color Palette

**Primary**: #1E3A8A (Deep Blue) — trust, intelligence
**Accent**: #3B82F6 (Bright Blue) — interactive elements
**Success**: #10B981 (Emerald) — high confidence, correct predictions
**Warning**: #F59E0B (Amber) — medium confidence
**Surface**: #F9FAFB (Light Gray) — card backgrounds
**Background**: #FFFFFF (White)
**Text Primary**: #111827 (Near Black)
**Text Secondary**: #6B7280 (Gray)
**Border**: #E5E7EB (Light Gray)

**Semantic Colors**:
- High Confidence: #10B981
- Medium Confidence: #F59E0B
- Low Confidence: #6B7280
- Live Indicator: #EF4444

## 5. Typography

**Font**: System default (SF Pro for iOS, Roboto for Android) for maximum legibility at small sizes
**Type Scale**:
- Display: 32px, Bold — hero headings
- Title: 24px, Semibold — screen titles
- Heading: 18px, Semibold — section headers
- Body: 16px, Regular — main text
- Caption: 14px, Regular — metadata
- Label: 12px, Medium — badges, tags

**Percentage Display**: Tabular numbers for alignment

## 6. Assets to Generate

**App Icon** (icon.png)
- Geometric "P" mark incorporating probability bar
- Deep blue background with gradient
- WHERE USED: Device home screen

**Splash Icon** (splash-icon.png)
- Same "P" mark on white
- WHERE USED: App launch screen

**Empty States**:
- empty-home.png — Calendar with checkmark, "No predictions available"
  WHERE USED: Home tab when no predictions
- empty-live.png — Sports field/court, "No live events"
  WHERE USED: Live tab when no active matches
- empty-history.png — Bar chart icon, "No history yet"
  WHERE USED: History tab for new users
- empty-search.png — Magnifying glass, "No results found"
  WHERE USED: Search/filter results

**Onboarding**:
- welcome-hero.png — Data visualization/analytics dashboard illustration
  WHERE USED: Welcome screen
- success-checkmark.png — Animated checkmark icon
  WHERE USED: Auth success state

**Premium**:
- premium-unlock.png — Lock opening with sparkle effect
  WHERE USED: Subscription paywall

**Sport Icons**:
- football-icon.png, basketball-icon.png, cricket-icon.png, tennis-icon.png
  WHERE USED: Sport category cards, prediction cards

**Style Note**: All illustrations should be minimalist line art in primary blue, matching the data-focused aesthetic. Avoid busy, colorful clipart.