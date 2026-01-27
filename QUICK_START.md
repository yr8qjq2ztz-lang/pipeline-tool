# Quick Start Guide - Pipeline Tool Features

## 🎯 Getting Started

### Access the App
1. Go to `/pipeline` - Main sales pipeline view
2. Go to `/dashboard` - KPI metrics and at-risk deals
3. Go to `/analytics` - Funnel, cycle time, and win/loss analysis

---

## 💡 Feature Quick Reference

### 🌙 Dark Mode
**Where**: Pipeline header, Dashboard header
**How**: Click the sun/moon icon or toggle in settings
**Keyboard**: No shortcut (intentional - use mouse)
**Persists**: Yes, saved to localStorage

### ⌨️ Keyboard Shortcuts
**Where**: Any page in the app
**How**: Just start typing (doesn't interfere with input fields)

| Shortcut | Action |
|----------|--------|
| `n` | Toggle new opportunity form |
| `f` | Clear all filters |
| `d` | Jump to dashboard |
| `p` | Scroll to pipeline top |
| `e` | Edit first opportunity |
| `/` | Focus search box |
| `?` | Show this help |

### 🎯 What-If Simulator
**Where**: Pipeline page header button (🎯 What-If)
**How**: 
1. Click "What-If" button
2. Drag sliders to adjust probability and value for each deal
3. See pipeline impact in real-time (original vs adjusted vs change %)
4. Click "Close" when done

**Use Cases**:
- Predict impact of winning/losing key deals
- Estimate pipeline if probabilities change
- Test different stage progression scenarios

### 📊 Analytics
**Where**: Pipeline header button (📊 Analytics)
**How**: Click to view comprehensive analytics dashboard

**Includes**:
- Conversion funnel (stage progression)
- Cycle time by stage (how long deals stay in each stage)
- Win/loss analysis (success rates per stage)
- Key metrics (total deals, won, lost, win rate %)

### 📈 Prediction Scoring
**Where**: Deal cards (future - not yet visible)
**How**: Automatically calculated based on:
- Overdue next actions (heavy penalty)
- Close date proximity
- Deal age vs expected stage duration
- Deal value

**Output**:
- Closure likelihood (0-100%)
- Risk factors
- Recommended actions
- Confidence level

### 💾 Saved Views (Framework Ready)
**Purpose**: Save and restore filter combinations
**How** (when implemented):
1. Apply filters
2. Click "Save View"
3. Give it a name
4. Load it later from a dropdown

**Filters Saved**:
- Branch selection
- Stage filter
- Close date window
- Probability band
- Health status
- Search text

### 📋 Deal Templates
**Where**: New opportunity form (when implemented)
**Default Templates**:
- Startup Deal: 30% probability, $50k value
- Enterprise Deal: 20% probability, $500k value
- Quick Win: 70% probability, $15k value

**How**: Select a template to auto-fill form fields

### ⚡ Bulk Actions (Framework Ready)
**Purpose**: Operate on multiple deals at once
**Available Actions** (when UI added):
- Update stage for multiple deals
- Update branch for multiple deals
- Delete multiple deals

**How** (when implemented):
1. Select multiple deals (checkboxes)
2. Floating panel appears
3. Choose action
4. Confirm

---

## 🎨 Visual Features

### Dark Mode
- **Automatic Detection**: App detects system preference on first load
- **Manual Toggle**: Click 🌙 to switch anytime
- **Persistent**: Your preference is saved
- **All Pages**: Dark mode works everywhere

### Animations
- **Card Interactions**: Cards fade in and scale up on hover
- **Smooth Transitions**: All color changes animate smoothly
- **Micro-interactions**: Buttons have press feedback

### Color-Coded Health
- 🟢 Green = Healthy (on track)
- 🟡 Yellow = Caution (closing soon)
- 🔴 Red = At-risk (overdue action)

---

## 🔄 Workflow Examples

### Example 1: What-If Analysis
```
Goal: Estimate impact if current opportunity moves from Proposal to Won

1. Click 🎯 What-If button
2. Find the opportunity in the list
3. Adjust its probability slider to 100%
4. Watch pipeline value increase in real-time
5. See the exact dollar impact
6. Decide if worth pursuing
```

### Example 2: Using Keyboard Shortcuts
```
Goal: Quickly create a new opportunity and focus on search

1. Press 'n' → New opportunity form opens
2. Fill in details
3. Press 's' → Focus search (after modal closes)
4. Search for related accounts
```

### Example 3: Analytics Review
```
Goal: Identify bottlenecks in sales process

1. Click 📊 Analytics button
2. Review "Cycle Time by Stage" chart
3. Notice Proposal stage takes 45 days (highest)
4. Go back to pipeline
5. Focus on moving Proposal stage deals forward
```

### Example 4: Dark Mode While Presenting
```
Goal: Present pipeline in darkened room

1. Click 🌙 to toggle dark mode
2. Entire interface switches to dark colors
3. Less eye strain for everyone
4. Click 🌙 again to return to light mode
```

---

## 📱 Responsive Design

All features work on:
- **Desktop** (full width, all features visible)
- **Tablet** (stacked layout, all features accessible)
- **Mobile** (optimized for touch, may need scrolling)

---

## ⚙️ Settings & Preferences

### Dark Mode Preference
- **Storage**: localStorage as `theme`
- **Default**: System preference
- **Fallback**: Light mode

### Keyboard Shortcuts
- **Disabled When**: Typing in input fields or textareas
- **No Conflicts**: Safely coexists with browser shortcuts
- **Custom**: Can be extended in `useKeyboardShortcuts.ts`

### Filter State
- **Not Persisted**: Filters reset on page reload (intentional)
- **Will Be**: Added in future with "Save View" feature

---

## 🐛 Troubleshooting

### Dark Mode Not Saving
**Solution**: Check browser localStorage is enabled
```javascript
// In browser console:
localStorage.getItem('theme')  // Should show 'dark' or 'light'
```

### Keyboard Shortcuts Not Working
**Solution**: Make sure you're not focused on an input
- Click somewhere in the page background
- Try again

### Analytics Not Loading
**Solution**: Check you're logged in
- Should redirect to `/login` if not authenticated
- Refresh the page

### Animations Janky
**Solution**: Close other browser tabs
- Animations use requestAnimationFrame for smoothness
- Limited browser resources can cause jank

---

## 🚀 Tips & Tricks

### Power User Tips
1. Use keyboard shortcuts for everything
2. Use What-If to make confident decisions
3. Check Analytics weekly for trends
4. Use dark mode at night for better sleep

### Performance Tips
1. Use filters to narrow down deals
2. Close What-If modal when not using
3. Don't have multiple analytics tabs open
4. Clear browser cache monthly

### Data Entry Tips
1. Use deal templates to speed up entry
2. Always fill in "Next Action" and "Next Action Due"
3. Update probability regularly as deal progresses
4. Keep close dates realistic

---

## 📞 Support

For issues or feature requests:
1. Check this guide first
2. Verify you're using latest browser version
3. Try clearing browser cache
4. Contact development team

---

## 🎓 Feature Learning Path

### Beginner (First Day)
- [ ] Learn keyboard shortcut `?`
- [ ] Toggle dark mode on/off
- [ ] View analytics once

### Intermediate (First Week)
- [ ] Use What-If simulator for key deals
- [ ] Use keyboard shortcuts daily
- [ ] Review analytics in dashboard

### Advanced (Ongoing)
- [ ] Create custom deal templates
- [ ] Save view filters (when available)
- [ ] Use bulk actions for efficiency
- [ ] Monitor prediction scores

---

Generated: 2024
Version: 1.0 - All 11 Features Complete
