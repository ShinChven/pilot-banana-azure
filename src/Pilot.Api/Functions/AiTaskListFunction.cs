using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Pilot.Api.Services;
using Pilot.Core.Domain;
using Pilot.Core.Repositories;
using Pilot.Core.DTOs;

namespace Pilot.Api.Functions;

public class AiTaskListFunction
{
    private readonly IPostAiTaskRepository _taskRepository;
    private readonly RequestAuthHelper _authHelper;
    private readonly ILogger<AiTaskListFunction> _logger;

    public AiTaskListFunction(
        IPostAiTaskRepository taskRepository,
        RequestAuthHelper authHelper,
        ILogger<AiTaskListFunction> logger)
    {
        _taskRepository = taskRepository;
        _authHelper = authHelper;
        _logger = logger;
    }

    [Function("ListAiTasks")]
    public async Task<IActionResult> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "api/users/{userId}/ai-tasks")] HttpRequest req,
        string userId,
        CancellationToken cancellationToken)
    {
        var auth = await _authHelper.GetUserFromRequestAsync(req, cancellationToken);
        if (auth == null) return new UnauthorizedResult();
        
        var isAdmin = auth.Value.Role == Pilot.Core.Domain.UserRole.Admin;
        if (auth.Value.UserId != userId && !isAdmin) return new ForbidResult();

        try
        {
            int page = 1;
            int pageSize = 10;

            if (int.TryParse(req.Query["page"], out int parsedPage) && parsedPage > 0)
                page = parsedPage;
            if (int.TryParse(req.Query["pageSize"], out int parsedPageSize) && parsedPageSize > 0)
                pageSize = parsedPageSize;

            string statusStr = req.Query["status"].ToString();
            AiTaskStatus? statusFilter = null;
            if (!string.IsNullOrEmpty(statusStr) && Enum.TryParse<AiTaskStatus>(statusStr, true, out var status))
            {
                statusFilter = status;
            }

            var (tasks, total) = await _taskRepository.GetPaginatedByUserIdAsync(userId, page, pageSize, statusFilter, cancellationToken);
            
            var result = new PaginatedList<PostAiTask>
            {
                Items = tasks.ToList(),
                Total = total,
                Page = page,
                PageSize = pageSize
            };

            return new OkObjectResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list AI tasks for user {UserId}", userId);
            return new ObjectResult(new { error = "Failed to load tasks.", message = ex.Message }) { StatusCode = 500 };
        }
    }
}
