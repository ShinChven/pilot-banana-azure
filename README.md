# Pilot Banana

Set-and-forget automation for high-volume social media campaigns.

![](assets/screenshot.jpg)

## Repo structure

| Path | Description |
|------|-------------|
| `src/Pilot.Core` | Domain, DTOs, interfaces |
| `src/Pilot.Infrastructure` | Cosmos DB, Blob, Key Vault |
| `src/Pilot.Adapters` | X (Twitter) and future channel adapters |
| `src/Pilot.Api` | Azure Functions HTTP API (Consumption) |
| `src/Pilot.Orchestration` | Durable Functions (scheduling) |
| `src/Pilot.Console` | React + Tailwind dashboard (Azure SWA) |
| `infra/` | Optional Bicep/ARM/Terraform |

## Run locally

The project **can run locally** for full usage (dashboard, API, orchestration). You need Cosmos DB (emulator or Azure), Azurite for storage, and the two function apps on different ports.

Run the API on `7071`, the orchestration app on `7072`, and the web app on `5173`.

## X (Twitter) Configuration Guide

Pilot Banana uses **OAuth 2.0 with PKCE** for interacting with the X (formerly Twitter) API.

### 1. Set up the X Developer App
1. Go to the [X Developer Portal](https://developer.twitter.com/en/portal/dashboard) and create a new Project/App.
2. Under your new App, go to **User authentication settings** and click **Set up** (or Edit).
3. Select **Web App, Automated App or Bot** if prompted.
4. Enable **OAuth 2.0**.
5. Set `Type of App` to **Web App**.
6. Set your **Redirect URI** to:
   * Local: `http://localhost:7071/api/channels/callback/x`
   * Production: `https://<YOUR-API-APP-NAME>.azurewebsites.net/api/channels/callback/x`
7. Save your settings. Take note of your **OAuth 2.0 Client ID** and **OAuth 2.0 Client Secret**.

### 2. Configure `local.settings.json` (or Azure App Settings)

Add the following under the `Values` section in your `Pilot.Api/local.settings.json` (and inside your Azure Environment variables for production):

```json
"ApiBaseUrl": "http://localhost:7071",
"XOAuth__ClientId": "<YOUR_OAUTH_2_CLIENT_ID>",
"XOAuth__ClientSecret": "<YOUR_OAUTH_2_CLIENT_SECRET>",
"XOAuth__ApiBaseUrl": "http://localhost:7071",
"XOAuth__DashboardBaseUrl": "http://localhost:5173",
"XOAuth__StateSigningSecret": "<OPTIONAL_RANDOM_STRING_FOR_CSRF_PROTECTION>"
```

* `ApiBaseUrl`: The public base URL for your API, used by MCP OAuth 2.1 discovery endpoints (`.well-known`).
* `XOAuth__ApiBaseUrl`: The base URL for your API, used to construct the dynamic `redirect_uri` for X/Twitter OAuth.
* `XOAuth__DashboardBaseUrl`: The frontend dashboard URL where users will be redirected after finishing the OAuth flow.
* `XOAuth__StateSigningSecret`: *(Optional)* Used to sign the OAuth `state` parameter to prevent CSRF spoofing. Defaults to your system's JWT Secret if omitted.

### 3. Advanced Adapter Overrides (Optional)
If you need to mock the API or intercept traffic, you can utilize the `IHttpClientFactory` mocking patterns.

### 4. Testing the Integration
1. Start your API and Dashboard locally.

## Model Context Protocol (MCP)

Pilot Banana acts as an **MCP Server**, enabling your AI assistant (like Claude Desktop or Claude Code) to securely interact with your social media campaigns and data.

### 1. Connection Methods

#### Claude Desktop (Manual Config)
Add the following to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "pilot-banana": {
      "url": "http://localhost:7071/api/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ACCESS_TOKEN>"
      }
    }
  }
}
```
*   **URL**: Use `http://localhost:7071/api/mcp` for local development or your production API URL.
*   **Access Tokens**: Generate these in the Pilot Banana Dashboard under **Settings > MCP > Access Tokens**.

#### OAuth 2.1 (Recommended)
For clients supporting OAuth (like Claude Web or official connectors):
1.  Navigate to **Settings > MCP > OAuth Clients** in the Dashboard.
2.  Create a new client and use the provided configuration snippet.

### 2. Available Tools

Pilot Banana exposes the following tools to MCP-enabled AI assistants:

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_scheduled_stats` | Get total number of scheduled and total posts. | - |
| `get_post_counts_by_date` | Get post success counts for the last 30 days. | `timezone_offset_minutes` |
| `get_post_counts_by_campaign` | Get success counts grouped by campaign. | - |
| `list_campaigns` | List all campaigns for the current user. | - |
| `search_campaigns` | Search campaigns by name. | `query` |
| `list_campaign_scheduled_posts` | List scheduled posts for a specific campaign. | `campaignId` |
| `create_campaign` | Create a new campaign (Draft status). | `name`, `description` |
| `batch_create_posts` | Bulk create posts with optional scheduling. | `campaignId`, `posts[]` |
| `list_posts_without_text` | Find posts needing content generation. | `campaignId`, `page`, `pageSize` |
| `batch_update_post_text` | Bulk update post content. | `campaignId`, `updates[]` |

### 3. Usage Example
Once connected, you can ask your AI:
- *"How many posts are scheduled for tomorrow?"*
- *"Find all posts in my 'Summer Launch' campaign that have no text and generate some captions for them."*
- *"Create a new campaign called 'Spring Promo' for me."*
