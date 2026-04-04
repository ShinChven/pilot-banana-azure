using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;

namespace Pilot.Api.Functions;

public class McpServerFunction
{
    private readonly McpAuthHelper _authHelper;
    private readonly ICampaignRepository _campaignRepository;
    private readonly IPostRepository _postRepository;
    private readonly IPostHistoryRepository _postHistoryRepository;
    private readonly string _baseUrl;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

    public McpServerFunction(
        McpAuthHelper authHelper,
        ICampaignRepository campaignRepository,
        IPostRepository postRepository,
        IPostHistoryRepository postHistoryRepository,
        IConfiguration configuration)
    {
        _authHelper = authHelper;
        _campaignRepository = campaignRepository;
        _postRepository = postRepository;
        _postHistoryRepository = postHistoryRepository;
        var raw = configuration["ApiBaseUrl"] ?? "http://localhost:7071";
        _baseUrl = raw.TrimEnd('/');
    }

    /// <summary>
    /// MCP Streamable HTTP endpoint.
    /// POST: handles JSON-RPC requests (initialize, tools/list, tools/call, ping, notifications).
    /// GET: returns SSE stream for server-initiated messages (optional keep-alive).
    /// DELETE: terminates session.
    /// </summary>
    [Function("McpServer")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", "delete", Route = "api/mcp")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null)
        {
            var unauth = req.CreateResponse(HttpStatusCode.Unauthorized);
            unauth.Headers.Add("WWW-Authenticate",
                $"Bearer resource_metadata=\"{_baseUrl}/.well-known/oauth-protected-resource\"");
            await unauth.WriteAsJsonAsync(new { error = "Authorization required." }, HttpStatusCode.Unauthorized, cancellationToken);
            return unauth;
        }

        // DELETE: session termination
        if (req.Method.Equals("DELETE", StringComparison.OrdinalIgnoreCase))
        {
            return req.CreateResponse(HttpStatusCode.OK);
        }

        // GET: SSE stream (for Streamable HTTP transport)
        if (req.Method.Equals("GET", StringComparison.OrdinalIgnoreCase))
        {
            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "text/event-stream");
            response.Headers.Add("Cache-Control", "no-cache");
            response.Headers.Add("Connection", "keep-alive");

            // Send a keep-alive comment and keep the connection open
            var sseData = ": connected\n\n";
            await response.WriteStringAsync(sseData, cancellationToken);
            return response;
        }

        // POST: JSON-RPC request handling
        // Validate Accept header for Streamable HTTP
        var acceptHeader = req.Headers.TryGetValues("Accept", out var acceptValues)
            ? string.Join(",", acceptValues) : "";

        McpRequest? mcpReq;
        try
        {
            mcpReq = await JsonSerializer.DeserializeAsync<McpRequest>(req.Body, JsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new McpErrorResponse(null, -32700, "Parse error"), cancellationToken);
            return bad;
        }

        if (mcpReq == null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteAsJsonAsync(new McpErrorResponse(null, -32600, "Invalid Request"), cancellationToken);
            return bad;
        }

        // Handle notifications (no id, no response expected)
        if (mcpReq.Id == null)
        {
            // Notifications like "notifications/initialized", "notifications/cancelled"
            return req.CreateResponse(HttpStatusCode.Accepted);
        }

        // Handle ping
        if (mcpReq.Method == "ping")
        {
            var pong = req.CreateResponse(HttpStatusCode.OK);
            await pong.WriteAsJsonAsync(new McpSuccessResponse(mcpReq.Id, new { }), cancellationToken);
            return pong;
        }

        object? result = mcpReq.Method switch
        {
            "initialize" => HandleInitialize(),
            "tools/list" => HandleListTools(),
            "tools/call" => await HandleCallTool(auth.Value.UserId, mcpReq.Params, cancellationToken),
            _ => null
        };

        if (result == null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.OK);
            await notFound.WriteAsJsonAsync(new McpErrorResponse(mcpReq.Id, -32601, $"Method not found: {mcpReq.Method}"), cancellationToken);
            return notFound;
        }

        var successResponse = req.CreateResponse(HttpStatusCode.OK);
        await successResponse.WriteAsJsonAsync(new McpSuccessResponse(mcpReq.Id, result), cancellationToken);
        return successResponse;
    }

    private object HandleInitialize()
    {
        return new
        {
            protocolVersion = "2025-03-26",
            capabilities = new { tools = new { } },
            serverInfo = new { name = "PilotBanana MCP Server", version = "1.0.0" }
        };
    }

    private object HandleListTools()
    {
        return new
        {
            tools = new object[]
            {
                new
                {
                    name = "get_scheduled_stats",
                    description = "Get total number of scheduled posts and total posts.",
                    inputSchema = new { type = "object", properties = new { } }
                },
                new
                {
                    name = "get_post_counts_by_date",
                    description = "Get number of successfully posted items by date for the last 30 days.",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            timezone_offset_minutes = new { type = "integer", description = "The user's timezone offset in minutes (UTC - local), from JS getTimezoneOffset()." }
                        }
                    }
                },
                new
                {
                    name = "get_post_counts_by_campaign",
                    description = "Get number of successfully posted items for each campaign.",
                    inputSchema = new { type = "object", properties = new { } }
                },
                new
                {
                    name = "list_campaigns",
                    description = "List all campaigns for the current user.",
                    inputSchema = new { type = "object", properties = new { } }
                },
                new
                {
                    name = "search_campaigns",
                    description = "Search campaigns by name.",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            query = new { type = "string", description = "The search query for campaign name." }
                        },
                        required = new[] { "query" }
                    }
                },
                new
                {
                    name = "list_campaign_scheduled_posts",
                    description = "List scheduled posts for a specific campaign.",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            campaignId = new { type = "string", description = "The ID of the campaign." }
                        },
                        required = new[] { "campaignId" }
                    }
                },
                new
                {
                    name = "create_campaign",
                    description = "Create a new campaign with a name and description (restricted).",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            name = new { type = "string", description = "The name of the campaign." },
                            description = new { type = "string", description = "A optional brief summary of the campaign." }
                        },
                        required = new[] { "name" }
                    }
                },
                new
                {
                    name = "batch_create_posts",
                    description = "Create multiple posts for a campaign (with optional scheduled time).",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            campaignId = new { type = "string", description = "The ID of the campaign." },
                            posts = new
                            {
                                type = "array",
                                items = new
                                {
                                    type = "object",
                                    properties = new
                                    {
                                        text = new { type = "string", description = "The content of the post." },
                                        scheduledTime = new { type = "string", description = "Optional ISO 8601 scheduled time. If provided, status becomes 'Scheduled', otherwise 'Draft'." }
                                    },
                                    required = new[] { "text" }
                                }
                            }
                        },
                        required = new[] { "campaignId", "posts" }
                    }
                },
                new
                {
                    name = "list_posts_without_text",
                    description = "List posts that have no text (null or empty) in a campaign. Useful for finding posts that need text to be generated.",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            campaignId = new { type = "string", description = "The ID of the campaign." },
                            status = new { type = "string", description = "Optional filter by post status (Draft, Scheduled, Pending, etc.). If omitted, all statuses are included." },
                            page = new { type = "integer", description = "Optional page number for pagination (default: 1)." },
                            pageSize = new { type = "integer", description = "Optional number of items per page (default: 50, max: 100)." }
                        },
                        required = new[] { "campaignId" }
                    }
                },
                new
                {
                    name = "batch_update_post_text",
                    description = "Update the text content of multiple posts in a campaign. Each update specifies a post ID and the new text.",
                    inputSchema = new
                    {
                        type = "object",
                        properties = new
                        {
                            campaignId = new { type = "string", description = "The ID of the campaign." },
                            updates = new
                            {
                                type = "array",
                                items = new
                                {
                                    type = "object",
                                    properties = new
                                    {
                                        postId = new { type = "string", description = "The ID of the post to update." },
                                        text = new { type = "string", description = "The new text content for the post." }
                                    },
                                    required = new[] { "postId", "text" }
                                }
                            }
                        },
                        required = new[] { "campaignId", "updates" }
                    }
                }
            }
        };
    }

    private async Task<object?> HandleCallTool(string userId, JsonElement? parameters, CancellationToken cancellationToken)
    {
        if (parameters == null || !parameters.Value.TryGetProperty("name", out var nameProp))
            return null;

        var toolName = nameProp.GetString();
        var args = parameters.Value.TryGetProperty("arguments", out var argsProp) ? argsProp : default;

        int timezoneOffset = 0;
        if (args.ValueKind == JsonValueKind.Object && args.TryGetProperty("timezone_offset_minutes", out var tzProp) && tzProp.ValueKind == JsonValueKind.Number)
        {
            timezoneOffset = tzProp.GetInt32();
        }

        return toolName switch
        {
            "get_scheduled_stats" => await GetScheduledStats(userId, cancellationToken),
            "get_post_counts_by_date" => await GetPostCountsByDate(userId, timezoneOffset, cancellationToken),
            "get_post_counts_by_campaign" => await GetPostCountsByCampaign(userId, cancellationToken),
            "list_campaigns" => await ListCampaigns(userId, cancellationToken),
            "search_campaigns" => await SearchCampaigns(userId, args, cancellationToken),
            "list_campaign_scheduled_posts" => await ListCampaignScheduledPosts(userId, args, cancellationToken),
            "create_campaign" => await CreateCampaign(userId, args, cancellationToken),
            "batch_create_posts" => await BatchCreatePosts(userId, args, cancellationToken),
            "list_posts_without_text" => await ListPostsWithoutText(userId, args, cancellationToken),
            "batch_update_post_text" => await BatchUpdatePostText(userId, args, cancellationToken),
            _ => null
        };
    }

    private async Task<object> GetScheduledStats(string userId, CancellationToken cancellationToken)
    {
        var (_, total) = await _postRepository.GetPaginatedByUserIdAsync(userId, 1, 1, cancellationToken: cancellationToken);
        var (_, scheduledTotal) = await _postRepository.GetPaginatedByUserIdAsync(userId, 1, 1, status: PostStatus.Scheduled.ToString(), cancellationToken: cancellationToken);

        return new
        {
            content = new[] { new { type = "text", text = $"Total Posts: {total}\nScheduled Posts: {scheduledTotal}" } }
        };
    }

    private async Task<object> GetPostCountsByDate(string userId, int timezoneOffsetMinutes, CancellationToken cancellationToken)
    {
        var localOffset = TimeSpan.FromMinutes(-timezoneOffsetMinutes);
        var nowLocal = DateTimeOffset.UtcNow.ToOffset(localOffset);
        var sinceLocalMidnight = new DateTimeOffset(nowLocal.Date, localOffset).AddDays(-30);

        var counts = await _postHistoryRepository.GetPostCountsByDateAsync(userId, sinceLocalMidnight, timezoneOffsetMinutes, cancellationToken);
        var text = counts.Any()
            ? "Successfully posted items by date (last 30 days):\n" + string.Join("\n", counts.Select(c => $"- {c.Date}: {c.Count}"))
            : "No successful posts found in the last 30 days.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> GetPostCountsByCampaign(string userId, CancellationToken cancellationToken)
    {
        var (items, _) = await _postHistoryRepository.GetPaginatedByUserIdAsync(userId, 1, 1000, cancellationToken);
        var campaigns = await _campaignRepository.ListByUserIdAsync(userId, cancellationToken);
        var campaignNames = campaigns.ToDictionary(c => c.Id, c => c.Name);

        var counts = items
            .Where(i => i.Status == "Completed")
            .GroupBy(i => i.CampaignId)
            .Select(g => new
            {
                Name = campaignNames.TryGetValue(g.Key, out var name) ? name : $"Unknown ({g.Key})",
                Count = g.Count()
            })
            .OrderByDescending(x => x.Count);

        var text = counts.Any()
            ? "Successfully posted items by campaign (recent history):\n" + string.Join("\n", counts.Select(c => $"- {c.Name}: {c.Count}"))
            : "No successful posts found in recent history.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> ListCampaigns(string userId, CancellationToken cancellationToken)
    {
        var campaigns = await _campaignRepository.ListByUserIdAsync(userId, cancellationToken);
        var text = campaigns.Any()
            ? string.Join("\n", campaigns.Select(c => $"- {c.Name} (ID: {c.Id}, Status: {c.Status})"))
            : "No campaigns found.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> SearchCampaigns(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("query", out var queryProp))
            return new { content = new[] { new { type = "text", text = "Error: query parameter is required." } }, isError = true };

        var query = queryProp.GetString() ?? "";
        var campaigns = await _campaignRepository.ListByUserIdAsync(userId, cancellationToken);
        var filtered = campaigns.Where(c => c.Name.Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();

        var text = filtered.Any()
            ? string.Join("\n", filtered.Select(c => $"- {c.Name} (ID: {c.Id}, Status: {c.Status})"))
            : $"No campaigns matching '{query}' found.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> ListCampaignScheduledPosts(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("campaignId", out var idProp))
            return new { content = new[] { new { type = "text", text = "Error: campaignId parameter is required." } }, isError = true };

        var campaignId = idProp.GetString();
        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId!, cancellationToken);
        if (campaign == null)
            return new { content = new[] { new { type = "text", text = $"Error: Campaign with ID {campaignId} not found or access denied." } }, isError = true };

        var (posts, _) = await _postRepository.GetPaginatedByCampaignIdAsync(campaignId!, 1, 50, status: PostStatus.Scheduled.ToString(), cancellationToken: cancellationToken);

        var text = posts.Any()
            ? $"Scheduled posts for '{campaign.Name}':\n" + string.Join("\n", posts.Select(p => $"- [{p.ScheduledTime:yyyy-MM-dd HH:mm}] {Truncate(p.Text ?? "", 50)} (ID: {p.Id})"))
            : $"No scheduled posts found for campaign '{campaign.Name}'.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> CreateCampaign(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("name", out var nameProp))
            return new { content = new[] { new { type = "text", text = "Error: name parameter is required." } }, isError = true };

        var name = nameProp.GetString() ?? "";
        if (string.IsNullOrWhiteSpace(name))
            return new { content = new[] { new { type = "text", text = "Error: name parameter cannot be empty." } }, isError = true };

        var description = args.TryGetProperty("description", out var descProp) ? descProp.GetString() : "";

        var campaign = new Campaign
        {
            Id = Guid.NewGuid().ToString("N"),
            UserId = userId,
            Name = name.Trim(),
            Description = (description ?? string.Empty).Trim(),
            ChannelLinkIds = new List<string>(), // Restricted logic
            Status = CampaignStatus.Draft,
            CreatedAt = DateTimeOffset.UtcNow
        };

        await _campaignRepository.CreateAsync(campaign, cancellationToken);

        return new
        {
            content = new[]
            {
                new
                {
                    type = "text",
                    text = $"Campaign '{campaign.Name}' (ID: {campaign.Id}) created successfully.\nStatus: {campaign.Status}\nDescription: {campaign.Description}"
                }
            }
        };
    }

    private async Task<object> BatchCreatePosts(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("campaignId", out var idProp))
            return new { content = new[] { new { type = "text", text = "Error: campaignId parameter is required." } }, isError = true };

        if (!args.TryGetProperty("posts", out var postsProp) || postsProp.ValueKind != JsonValueKind.Array)
            return new { content = new[] { new { type = "text", text = "Error: posts parameter is required and must be an array." } }, isError = true };

        var campaignId = idProp.GetString() ?? "";
        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId, cancellationToken);
        if (campaign == null)
            return new { content = new[] { new { type = "text", text = $"Error: Campaign with ID {campaignId} not found or access denied." } }, isError = true };

        int count = 0;
        var results = new List<string>();

        foreach (var postElem in postsProp.EnumerateArray())
        {
            if (!postElem.TryGetProperty("text", out var textProp))
                continue;

            var text = textProp.GetString();
            DateTimeOffset? scheduledTime = null;
            var status = PostStatus.Draft;

            if (postElem.TryGetProperty("scheduledTime", out var timeProp) && !string.IsNullOrEmpty(timeProp.GetString()))
            {
                if (DateTimeOffset.TryParse(timeProp.GetString(), out var st))
                {
                    scheduledTime = st;
                    status = PostStatus.Scheduled;
                }
            }

            var post = new Post
            {
                Id = Guid.NewGuid().ToString("N"),
                CampaignId = campaignId,
                UserId = userId,
                Text = text?.Trim(),
                ScheduledTime = scheduledTime,
                Status = status,
                CreatedAt = DateTimeOffset.UtcNow
            };

            await _postRepository.CreateAsync(post, cancellationToken);
            count++;
            results.Add($"- Post created: {Truncate(text ?? "", 30)} (Status: {status}, Time: {scheduledTime:yyyy-MM-dd HH:mm})");
        }

        return new
        {
            content = new[]
            {
                new
                {
                    type = "text",
                    text = $"Successfully created {count} posts for campaign '{campaign.Name}'.\n\n" + string.Join("\n", results)
                }
            }
        };
    }

    private async Task<object> ListPostsWithoutText(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("campaignId", out var idProp))
            return new { content = new[] { new { type = "text", text = "Error: campaignId parameter is required." } }, isError = true };

        var campaignId = idProp.GetString() ?? "";
        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId, cancellationToken);
        if (campaign == null)
            return new { content = new[] { new { type = "text", text = $"Error: Campaign with ID {campaignId} not found or access denied." } }, isError = true };

        int page = 1;
        if (args.TryGetProperty("page", out var pageProp) && pageProp.ValueKind == JsonValueKind.Number)
            page = Math.Max(1, pageProp.GetInt32());

        int pageSize = 50;
        if (args.TryGetProperty("pageSize", out var sizeProp) && sizeProp.ValueKind == JsonValueKind.Number)
            pageSize = Math.Clamp(sizeProp.GetInt32(), 1, 100);

        PostStatus? statusFilter = null;
        if (args.TryGetProperty("status", out var statusProp) && !string.IsNullOrEmpty(statusProp.GetString()))
        {
            if (Enum.TryParse<PostStatus>(statusProp.GetString(), true, out var st))
            {
                statusFilter = st;
            }
        }

        var (posts, total) = await _postRepository.GetPostsWithoutTextAsync(campaignId, page, pageSize, statusFilter, cancellationToken);

        var paginationInfo = $"(Page {page}/{Math.Max(1, (int)Math.Ceiling(total / (double)pageSize))}, Total: {total})";
        var text = posts.Any()
            ? $"Posts without text for '{campaign.Name}' {paginationInfo}:\n" + string.Join("\n", posts.Select(p => $"- ID: {p.Id}, Status: {p.Status}, ScheduledTime: {p.ScheduledTime:yyyy-MM-dd HH:mm}"))
            : $"No posts without text found for campaign '{campaign.Name}' {paginationInfo}.";

        return new { content = new[] { new { type = "text", text } } };
    }

    private async Task<object> BatchUpdatePostText(string userId, JsonElement args, CancellationToken cancellationToken)
    {
        if (!args.TryGetProperty("campaignId", out var idProp))
            return new { content = new[] { new { type = "text", text = "Error: campaignId parameter is required." } }, isError = true };

        if (!args.TryGetProperty("updates", out var updatesProp) || updatesProp.ValueKind != JsonValueKind.Array)
            return new { content = new[] { new { type = "text", text = "Error: updates parameter is required and must be an array." } }, isError = true };

        var campaignId = idProp.GetString() ?? "";
        var campaign = await _campaignRepository.GetByIdAsync(userId, campaignId, cancellationToken);
        if (campaign == null)
            return new { content = new[] { new { type = "text", text = $"Error: Campaign with ID {campaignId} not found or access denied." } }, isError = true };

        int successCount = 0;
        var results = new List<string>();

        foreach (var updateElem in updatesProp.EnumerateArray())
        {
            if (!updateElem.TryGetProperty("postId", out var postIdProp) || !updateElem.TryGetProperty("text", out var textProp))
                continue;

            var postId = postIdProp.GetString() ?? "";
            var newText = textProp.GetString() ?? "";

            var post = await _postRepository.GetByIdAsync(campaignId, postId, cancellationToken);
            if (post == null || post.UserId != userId)
            {
                results.Add($"- Error: Post {postId} not found or access denied.");
                continue;
            }

            post.Text = newText;
            post.UpdatedAt = DateTimeOffset.UtcNow;
            await _postRepository.UpdateAsync(post, cancellationToken);
            successCount++;
            results.Add($"- Updated Post: {postId} (Length: {newText.Length})");
        }

        return new
        {
            content = new[]
            {
                new
                {
                    type = "text",
                    text = $"Successfully updated {successCount} posts for campaign '{campaign.Name}'.\n\n" + string.Join("\n", results)
                }
            }
        };
    }

    private string Truncate(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text)) return text;
        return text.Length <= maxLength ? text : text[..maxLength] + "...";
    }

    public record McpRequest(
        [property: JsonPropertyName("jsonrpc")] string JsonRpc,
        [property: JsonPropertyName("id")] object? Id,
        [property: JsonPropertyName("method")] string Method,
        [property: JsonPropertyName("params")] JsonElement? Params
    );

    public record McpSuccessResponse(
        [property: JsonPropertyName("id")] object Id,
        [property: JsonPropertyName("result")] object Result,
        [property: JsonPropertyName("jsonrpc")] string JsonRpc = "2.0"
    );

    public record McpErrorResponse(
        [property: JsonPropertyName("id")] object? Id,
        [property: JsonPropertyName("error")] McpError Error,
        [property: JsonPropertyName("jsonrpc")] string JsonRpc = "2.0"
    )
    {
        public McpErrorResponse(object? id, int code, string message) : this(id, new McpError(code, message)) { }
    }

    public record McpError(
        [property: JsonPropertyName("code")] int Code,
        [property: JsonPropertyName("message")] string Message
    );
}
