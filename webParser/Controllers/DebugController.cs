// using System.IdentityModel.Tokens.Jwt;
// using System.Security.Claims;
// using Microsoft.AspNetCore.Authorization;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.IdentityModel.Tokens;
// using webParser.config;
//
// namespace webParser.Controllers;
//
// using System.IdentityModel.Tokens.Jwt;
// using System.Security.Claims;
// using Microsoft.AspNetCore.Authorization;
// using Microsoft.AspNetCore.Mvc;
// using Microsoft.IdentityModel.Tokens;
// using System.Text.Json;
//
// [ApiController]
// [Route("api/[controller]")]
// public class DebugController : ControllerBase
// {
//     // 1. Классы для ответов
//     public class TokenValidationResult
//     {
//         public bool Valid { get; set; }
//         public string? Message { get; set; }
//         public string? UserId { get; set; }
//         public string? UserName { get; set; }
//         public string? UserRole { get; set; }
//         public string? Issuer { get; set; }
//         public string? Audience { get; set; }
//         public DateTime? ExpiresUtc { get; set; }
//         public DateTime? ExpiresLocal { get; set; }
//         public DateTime? NowUtc { get; set; }
//         public double? TimeDifferenceMinutes { get; set; }
//         public string? TokenIssuer { get; set; }
//         public string? ExpectedIssuer { get; set; }
//         public string? Error { get; set; }
//     }
//
//     public class HeadersResult
//     {
//         public Dictionary<string, string>? AllHeaders { get; set; }
//         public bool HasAuthorizationHeader { get; set; }
//         public string? AuthorizationHeader { get; set; }
//         public string? RequestMethod { get; set; }
//         public string? RequestPath { get; set; }
//         public string? RequestQuery { get; set; }
//     }
//
//     // 2. Метод с явной сериализацией
//     [HttpGet("validate-token")]
//     public IActionResult ValidateToken([FromQuery] string token)
//     {
//         if (string.IsNullOrEmpty(token))
//         {
//             return Content(
//                 JsonSerializer.Serialize(new TokenValidationResult 
//                 { 
//                     Valid = false, 
//                     Message = "No token provided. Use ?token=your_jwt_token" 
//                 }),
//                 "application/json"
//             );
//         }
//
//         var result = ValidateTokenInternal(token);
//         return Content(JsonSerializer.Serialize(result), "application/json");
//     }
//
//     private TokenValidationResult ValidateTokenInternal(string token)
//     {
//         try
//         {
//             var handler = new JwtSecurityTokenHandler();
//             
//             if (!handler.CanReadToken(token))
//             {
//                 return new TokenValidationResult 
//                 { 
//                     Valid = false, 
//                     Message = "Cannot read token - invalid format" 
//                 };
//             }
//
//             // Читаем токен
//             var jsonToken = handler.ReadJwtToken(token);
//             
//             // Параметры валидации
//             var validationParameters = new TokenValidationParameters
//             {
//                 ValidateIssuer = true,
//                 ValidIssuer = AuthOptions.ISSUER,
//                 ValidateAudience = true,
//                 ValidAudience = AuthOptions.AUDIENCE,
//                 ValidateLifetime = true,
//                 IssuerSigningKey = AuthOptions.GetSymmetricSecurityKey(),
//                 ValidateIssuerSigningKey = true,
//                 ClockSkew = TimeSpan.FromMinutes(1)
//             };
//
//             // Валидируем
//             var principal = handler.ValidateToken(token, validationParameters, out _);
//             
//             return new TokenValidationResult
//             {
//                 Valid = true,
//                 Message = "Token is VALID",
//                 UserId = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value,
//                 UserName = principal.FindFirst(ClaimTypes.Name)?.Value,
//                 UserRole = principal.FindFirst(ClaimTypes.Role)?.Value,
//                 Issuer = jsonToken.Issuer,
//                 Audience = string.Join(", ", jsonToken.Audiences),
//                 ExpiresUtc = jsonToken.ValidTo,
//                 ExpiresLocal = jsonToken.ValidTo.ToLocalTime(),
//                 NowUtc = DateTime.UtcNow,
//                 TimeDifferenceMinutes = (jsonToken.ValidTo - DateTime.UtcNow).TotalMinutes
//             };
//         }
//         catch (SecurityTokenExpiredException)
//         {
//             var jsonToken = new JwtSecurityTokenHandler().ReadJwtToken(token);
//             return new TokenValidationResult
//             {
//                 Valid = false,
//                 Message = "Token EXPIRED",
//                 UserId = jsonToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier)?.Value,
//                 UserName = jsonToken.Claims.FirstOrDefault(c => c.Type == ClaimTypes.Name)?.Value,
//                 ExpiresUtc = jsonToken.ValidTo,
//                 NowUtc = DateTime.UtcNow,
//                 TimeDifferenceMinutes = (DateTime.UtcNow - jsonToken.ValidTo).TotalMinutes
//             };
//         }
//         catch (SecurityTokenInvalidIssuerException)
//         {
//             var jsonToken = new JwtSecurityTokenHandler().ReadJwtToken(token);
//             return new TokenValidationResult
//             {
//                 Valid = false,
//                 Message = "Invalid ISSUER",
//                 TokenIssuer = jsonToken.Issuer,
//                 ExpectedIssuer = AuthOptions.ISSUER
//             };
//         }
//         catch (SecurityTokenInvalidAudienceException)
//         {
//             var jsonToken = new JwtSecurityTokenHandler().ReadJwtToken(token);
//             return new TokenValidationResult
//             {
//                 Valid = false,
//                 Message = "Invalid AUDIENCE",
//                 Audience = string.Join(", ", jsonToken.Audiences),
//                 ExpectedIssuer = AuthOptions.AUDIENCE
//             };
//         }
//         catch (Exception ex)
//         {
//             return new TokenValidationResult
//             {
//                 Valid = false,
//                 Message = "Validation failed",
//                 Error = $"{ex.GetType().Name}: {ex.Message}"
//             };
//         }
//     }
//
//     [HttpGet("debug-headers")]
//     public IActionResult DebugHeaders()
//     {
//         var result = new HeadersResult
//         {
//             AllHeaders = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString()),
//             HasAuthorizationHeader = Request.Headers.ContainsKey("Authorization"),
//             AuthorizationHeader = Request.Headers["Authorization"].ToString(),
//             RequestMethod = Request.Method,
//             RequestPath = Request.Path,
//             RequestQuery = Request.QueryString.Value
//         };
//
//         return Content(JsonSerializer.Serialize(result), "application/json");
//     }
//
//     [HttpGet("auth-settings")]
//     public IActionResult GetAuthSettings()
//     {
//         try
//         {
//             var key = AuthOptions.GetSymmetricSecurityKey();
//             
//             var result = new 
//             {
//                 Issuer = AuthOptions.ISSUER,
//                 Audience = AuthOptions.AUDIENCE,
//                 KeyExists = key != null,
//                 KeySize = key?.KeySize,
//                 KeyAlgorithm = "HmacSha256"
//             };
//
//             return Content(JsonSerializer.Serialize(result), "application/json");
//         }
//         catch (Exception ex)
//         {
//             return Content(
//                 JsonSerializer.Serialize(new { error = ex.Message }),
//                 "application/json"
//             );
//         }
//     }
//
//     [HttpGet("check-auth")]
//     [Authorize]
//     public IActionResult CheckAuth()
//     {
//         var result = new
//         {
//             IsAuthenticated = User.Identity?.IsAuthenticated ?? false,
//             UserName = User.Identity?.Name,
//             UserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
//             UserRole = User.FindFirst(ClaimTypes.Role)?.Value,
//             Claims = User.Claims.Select(c => new { c.Type, c.Value })
//         };
//
//         return Content(JsonSerializer.Serialize(result), "application/json");
//     }
//
//     [HttpGet("generate-test-token")]
//     public IActionResult GenerateTestToken()
//     {
//         var claims = new List<Claim>
//         {
//             new Claim(ClaimTypes.NameIdentifier, "1"),
//             new Claim(ClaimTypes.Name, "testuser"),
//             new Claim(ClaimTypes.Role, "User"),
//         };
//
//         var jwt = new JwtSecurityToken(
//             issuer: AuthOptions.ISSUER,
//             audience: AuthOptions.AUDIENCE,
//             claims: claims,
//             expires: DateTime.UtcNow.AddHours(2),
//             signingCredentials: new SigningCredentials(
//                 AuthOptions.GetSymmetricSecurityKey(), 
//                 SecurityAlgorithms.HmacSha256));
//
//         var token = new JwtSecurityTokenHandler().WriteToken(jwt);
//
//         var result = new
//         {
//             access_token = token,
//             message = "Test token generated",
//             expires = DateTime.UtcNow.AddHours(2)
//         };
//
//         return Content(JsonSerializer.Serialize(result), "application/json");
//     }
// }