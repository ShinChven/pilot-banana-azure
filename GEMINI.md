# Development Rules

- **No Native Alerts**: Ban the use of native `alert()`, `confirm()`, or `prompt()` modals.
- **Inline Operations Notifications**: Use non-modal inline message alerts for operation results (success/failure) instead of modal windows.
- **Consistent UI**: Follow the feedback pattern used in `ChannelsPage.tsx` where outcome messages are displayed as inline banners within the page flow.
- **Proper API Error Codes**: All API endpoints must return appropriate HTTP status codes for errors (e.g., 400 for bad requests, 404 for not found, 500 for server errors). Do not return a 200 status code if the operation failed.
- **Destructive Action Confirmation**: All destructive actions (delete, remove, archive) MUST implement a confirmation dialog using the Radix UI `Dialog` component. Never execute these actions immediately upon clicking a button. The confirmation dialog should clearly state what is being deleted and warn that the action is irreversible.
- **X API Versioning**: NEVER use X v1 or X 1.x APIs. All X (Twitter) platform interactions must exclusively use X API v2 or later. Any legacy endpoints must be avoided.
- **X Integration Mandates**:
    1. Strictly use X API v2 (Banned: v1.1, v1.0).
    2. Strictly use `api.twitter.com` base (Banned: `upload.twitter.com`).
    3. Strictly use `XOAuth__` prefix for all X configuration and secrets.
    4. Orchestration/Background tasks MUST load the same configuration as the API.
    5. Refer to `docs/X_PLATFORM_INTEGRATION.md` for full implementation details.
- If any .cs code modified, should run build.
- Ban Git commit. only user commits
