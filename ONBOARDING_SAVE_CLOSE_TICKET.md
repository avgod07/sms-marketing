# Ticket: Fix Save & Close Button on Onboarding Page and Implement Data Persistence

## Issue Description

The onboarding page currently has "Save & Close" buttons on each step, but they don't actually save the form data. When users click "Save & Close" and later return to the onboarding page, their previously entered data is lost because it's only stored in React state (onboarding context) which gets reset on page refresh/navigation.

## Current Problems

1. **Save & Close button doesn't save data**: The `onCancel` prop in all onboarding forms just navigates away without saving
2. **No data persistence**: Form data is only stored in React state and lost on page refresh
3. **No API endpoints for saving partial onboarding data**: Only final completion is saved
4. **No data restoration**: When returning to onboarding, previously entered data is not loaded

## Technical Analysis

### Current Implementation

- **Frontend**: Uses React Context (`OnboardingProvider`) to store form data in memory
- **Forms**: All forms have `onCancel` prop that calls `handleClose()` which just navigates to "/"
- **Backend**: Has business profile and A2P config tables but no endpoints for saving partial onboarding data
- **Database**: Has `businessProfiles`, `twilioA2pConfigs`, and `users.onboardingComplete` tables

### Required Changes

#### 1. Backend API Endpoints

Create new endpoints to save and retrieve partial onboarding data:

```typescript
// Save onboarding progress
POST /api/onboarding/save-progress
{
  step: number,
  businessInfo?: BusinessInfoFormValues,
  monthlyVolume?: VolumeOption,
  useCases?: UseCaseOption[]
}

// Get onboarding progress
GET /api/onboarding/progress
// Returns: { step, businessInfo, monthlyVolume, useCases }
```

#### 2. Database Schema Updates

Add new table to store onboarding progress:

```sql
CREATE TABLE onboarding_progress (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES businesses(id) NOT NULL UNIQUE,
  step INTEGER NOT NULL DEFAULT 1,
  business_info JSONB,
  monthly_volume TEXT,
  use_cases TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3. Frontend Changes

##### A. Update Onboarding Context

- Add persistence layer using React Query
- Load saved data on component mount
- Save data automatically on form changes

##### B. Update Form Components

- Modify `onCancel` handlers to save data before navigating
- Add loading states for save operations
- Show success/error feedback

##### C. Update Onboarding Page

- Load saved progress on mount
- Restore form data and current step
- Handle save operations with proper error handling

## Implementation Plan

### Phase 1: Backend Infrastructure

1. Create database migration for `onboarding_progress` table
2. Add new API endpoints for saving/retrieving progress
3. Update business storage layer with onboarding progress methods
4. Add validation schemas for onboarding data

### Phase 2: Frontend Data Layer

1. Create React Query hooks for onboarding progress
2. Update onboarding context to use persistent storage
3. Add automatic save functionality on form changes
4. Implement data restoration on page load

### Phase 3: UI/UX Improvements

1. Update "Save & Close" buttons to actually save data
2. Add loading states and success/error feedback
3. Implement auto-save indicators
4. Add confirmation dialogs for unsaved changes

### Phase 4: Testing & Polish

1. Test data persistence across page refreshes
2. Test save functionality on all form steps
3. Test data restoration when returning to onboarding
4. Add error handling and edge cases

## Acceptance Criteria

### Functional Requirements

- [ ] "Save & Close" button saves current form data to database
- [ ] Users can return to onboarding page and see their previously entered data
- [ ] Current step is restored when returning to onboarding
- [ ] Form data is automatically saved as user types (auto-save)
- [ ] Loading states shown during save operations
- [ ] Success/error feedback for save operations

### Technical Requirements

- [ ] New database table for storing onboarding progress
- [ ] API endpoints for saving/retrieving progress
- [ ] React Query integration for data management
- [ ] Proper error handling and validation
- [ ] TypeScript types for all new interfaces

### User Experience Requirements

- [ ] No data loss when navigating away from onboarding
- [ ] Smooth transition when returning to onboarding
- [ ] Clear indication of saved vs unsaved changes
- [ ] Responsive design maintained across all changes

## Files to Modify

### Backend

- `server/routes/modules/twilio.ts` - Add new onboarding endpoints
- `server/db/storage.ts` - Add onboarding progress methods
- `shared/schema.ts` - Add onboarding progress table schema
- `migrations/` - New migration file

### Frontend

- `client/src/components/onboarding/onboarding-context.tsx` - Add persistence
- `client/src/components/onboarding/business-info-form.tsx` - Update save logic
- `client/src/components/onboarding/monthly-volume-form.tsx` - Update save logic
- `client/src/components/onboarding/use-case-form.tsx` - Update save logic
- `client/src/components/onboarding/toll-free-number-form.tsx` - Update save logic
- `client/src/pages/auth/onboarding.tsx` - Add data restoration
- `client/src/lib/queryClient.ts` - Add onboarding progress queries

## Estimated Effort

- **Backend**: 1-2 days
- **Frontend**: 2-3 days
- **Testing**: 1 day
- **Total**: 4-6 days

## Priority

**High** - This affects core user experience and data integrity

## Dependencies

- Database access for creating new table
- React Query setup (already exists)
- Existing onboarding form components

## Notes

- Consider implementing auto-save with debouncing to avoid excessive API calls
- Ensure backward compatibility with existing onboarding completion flow
- Add proper cleanup of onboarding progress data when onboarding is completed
- Consider adding analytics to track onboarding completion rates
