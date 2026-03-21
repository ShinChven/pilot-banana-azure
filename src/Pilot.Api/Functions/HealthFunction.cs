using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;

namespace Pilot.Api.Functions;

public class HealthFunction
{
    private readonly ILogger _logger;

    public HealthFunction(ILoggerFactory loggerFactory)
    {
        _logger = loggerFactory.CreateLogger<HealthFunction>();
    }

    [Function("Health")]
    public async Task<HttpResponseData> Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData req,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation("Health check requested.");
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { status = "ok", service = "Pilot.Api" }, cancellationToken);
        return response;
    }
}
