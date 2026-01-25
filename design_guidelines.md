# BetRight Design Guidelines

## 1. Brand Identity

**Purpose**: Sports analytics app providing AI-powered probability insights for upcoming and live sporting events. This is NOT a gambling app — it's a data intelligence platform for sports enthusiasts who value statistical rigor.

**Aesthetic Direction**: Bold and confident — clean, professional, trustworthy. Think ESPN meets data analytics.

**Logo**: Bull head with shield motif — represents strength, confidence, and smart decisions.

**Color Psychology**: Navy blues convey trust and reliability. Bold reds create energy and confidence. Greens indicate success.

## 2. Navigation Architecture

**Root Navigation**: Tab Bar (5 tabs)
- Home (house icon)
- Live (activity icon)
- Sports (grid icon)
- History (clock icon)
- Profile (user icon)

**Authentication**: Required — email login with password. Include forgot password flow.

## 3. Screen-by-Screen Specifications

### Onboarding Flow (Stack-Only)
**Welcome Screen**
- Hero illustration showing data visualization
- App name "BetRight" and tagline: "AI-Powered Sports Intelligence"
- "Get Started" button
- "Sign In" text button

**Auth Screens**
- Email input → password entry
- Forgot password recovery
- Success state with checkmark animation

### Home Tab
**Header**: Transparent, title "BetRight", settings icon (right)
**Layout**: Scrollable with sections:
1. Free Tip of the Day (hero card)
   - Large prediction card with gradient background (Navy to Red)
   - Match name, time, sport icon
   - Predicted outcome in bold
   - Probability percentage (large)
   - Confidence badge
   - AI explanation (2-3 lines)
   - "View Details" button
2. Premium Predictions (if subscribed) / Upgrade CTA (if free)
   - Grid of prediction cards
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
- Large probability visualization
- Confidence badge
- AI explanation (expandable)
- Key factors list (injuries, form, head-to-head)
- Risk index meter
**Floating Button**: "Get Premium" if locked content

### Subscription Paywall (Modal)
**Layout**: Scrollable
- "Unlock All Predictions" headline
- Feature comparison list (Free vs Premium)
- $49/year pricing (prominent)
- "Start Annual Subscription" button
- Terms & restore purchase links

## 4. Color Palette

**Primary**: #1A237E (Navy Blue) — from logo horns, trust, intelligence
**Accent**: #E53935 (Bold Red) — from logo bull/shield, energy, confidence
**Success**: #10B981 (Emerald) — high confidence, correct predictions
**Warning**: #F59E0B (Amber) — medium confidence
**Surface**: #F5F5F5 (Light Gray) — card backgrounds
**Background**: #FFFFFF (White)
**Text Primary**: #212121 (Dark Charcoal)
**Text Secondary**: #757575 (Gray)
**Border**: #E0E0E0 (Light Gray)

**Semantic Colors**:
- High Confidence: #10B981 (Emerald)
- Medium Confidence: #F59E0B (Amber)
- Low Confidence: #757575 (Gray)
- Live Indicator: #E53935 (Brand Red)

**Gradient**: Navy Blue (#1A237E) to Bold Red (#E53935) — use for premium/featured content

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

## 6. Assets

**App Icon** (betright-logo.png)
- Bull head with shield motif
- Navy blue and bold red colors
- WHERE USED: Device home screen, splash screen

**Empty States**:
- empty-home.png — Calendar with checkmark, "No predictions available"
- empty-live.png — Sports field/court, "No live events"
- empty-history.png — Bar chart icon, "No history yet"

**Onboarding**:
- welcome-hero.png — Data visualization/analytics dashboard illustration

**Premium**:
- premium-unlock.png — Lock opening with sparkle effect

**Style Note**: All illustrations should complement the bold, confident BetRight brand aesthetic.
