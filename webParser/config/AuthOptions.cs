using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace webParser.config;

public class AuthOptions
{
    public const string ISSUER = "WebParser"; // издатель токена
    public const string AUDIENCE = "WebParser"; // потребитель токена
    const string KEY = "mysupersecret_secretsecretsecretkey!123";   // ключ для шифрации
    public static SymmetricSecurityKey GetSymmetricSecurityKey() => 
        new SymmetricSecurityKey(Encoding.UTF8.GetBytes(KEY));
}