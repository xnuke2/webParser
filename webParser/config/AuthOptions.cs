using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace webParser.config;

public class AuthOptions
{
    public const string ISSUER = "WebParser"; // издатель токена
    public const string AUDIENCE = "WebParser"; // потребитель токена
    const string KEY = "mysupersecret_secretsecretsecretkey!123";   // ключ для шифрации
    public const int ACCESS_TOKEN_LIFETIME_MINUTES = 15;
    public const int REFRESH_TOKEN_LIFETIME_DAYS = 7;
    
    public static SymmetricSecurityKey GetSymmetricSecurityKey()
    {
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(KEY));
    }
}