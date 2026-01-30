using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace webParser.Migrations
{
    /// <inheritdoc />
    public partial class cdads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "AnalyzedSites",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Name",
                table: "AnalyzedSites");
        }
    }
}
