using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace Pilot.Api.Middleware;

/// <summary>
/// Azure platform CORS does not set Access-Control-Expose-Headers.
/// This middleware adds it so browsers can read WWW-Authenticate (needed for MCP OAuth discovery).
/// </summary>
public class CorsExposeHeadersMiddleware : IFunctionsWorkerMiddleware
{
    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        await next(context);

        var response = context.GetHttpResponseData();
        if (response != null)
        {
            response.Headers.Add("Access-Control-Expose-Headers", "WWW-Authenticate, Mcp-Session-Id");
        }
    }
}
