using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace webParser.Migrations
{
    /// <inheritdoc />
    public partial class AddFieldName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "FieldNameId",
                table: "AnalyzedFields",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FieldNames",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldNames", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AnalyzedFields_FieldNameId",
                table: "AnalyzedFields",
                column: "FieldNameId");

            migrationBuilder.AddForeignKey(
                name: "FK_AnalyzedFields_FieldNames_FieldNameId",
                table: "AnalyzedFields",
                column: "FieldNameId",
                principalTable: "FieldNames",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AnalyzedFields_FieldNames_FieldNameId",
                table: "AnalyzedFields");

            migrationBuilder.DropTable(
                name: "FieldNames");

            migrationBuilder.DropIndex(
                name: "IX_AnalyzedFields_FieldNameId",
                table: "AnalyzedFields");

            migrationBuilder.DropColumn(
                name: "FieldNameId",
                table: "AnalyzedFields");
        }
    }
}
