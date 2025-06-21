# 📘 Codex Agent Guidelines
This file outlines the standard operating procedures that the Codex agent must follow when implementing features or handling tasks within this codebase.

## ✅ Essential Steps to Follow for Every Ticket
1. **Understand Context**
   - Read the full ticket.
   - Identify the goal of the feature or bugfix.
   - Note any screenshots, user flows, or design expectations.

2. **UI Implementation**
   - Always follow the UI pattern of the app.
   - Match styling, spacing, colors, and fonts with the existing UI unless told otherwise.
   - Reuse existing components where possible; avoid duplication.

3. **Form and Input Handling**
   - Validate all required fields.
   - Show clear error messages (use `handleApiError` if available).
   - On submit:
     - Disable the button and show a loading spinner.
     - Persist state if the user navigates away mid-process when applicable.

4. **State and Navigation**
   - Store form data in appropriate local/global state (e.g., React state, context, or Redux).
   - Use routing to allow the user to move between onboarding steps.
   - Resume from the last saved state if possible.

5. **API Integration**
   - Use existing API service utilities to make requests.
   - Implement optimistic UI updates where appropriate.
   - Handle API errors and edge cases gracefully:
     - Timeouts
     - 4XX errors (invalid data, unauthorized)
     - 5XX errors (retry or display fallback)

6. **Database / Backend Sync**
   - Ensure all form data is saved correctly to the database.
   - Reflect any backend changes in UI (e.g., new phone number assigned).
   - Keep sensitive data like tokens/SIDs off the frontend.

7. **Sidebar & Layout Responsiveness**
   - If updating the sidebar, ensure it fits all screen sizes without overflowing.
   - Use consistent font size and spacing.
   - Apply media queries or utility classes if needed for mobile/tablet.

8. **Post-Implementation Checklist**
   - Double check required fields.
   - Verify button states (enabled/disabled, loading).
   - Map API errors to friendly messages.
   - Confirm the layout does not break at smaller screen sizes (test at 768px and 1024px).
   - Ensure temporary items (like onboarding tabs) disappear or hide after use.

## 💡 Pro Tips
- Comment any complex logic.
- Add TODOs for any deferred enhancements.
- Default to clarity over cleverness.

## 🧪 Testing Instructions
- Run `npm run check` from the repository root to perform type checking.
- Run `npm run test` to execute the test suite. This command starts `vitest` in watch mode and will not exit on its own, so manually stop it (e.g., with `Ctrl+C`) after confirming the tests start.
