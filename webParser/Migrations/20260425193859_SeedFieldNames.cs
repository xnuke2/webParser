using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace webParser.Migrations
{
    /// <inheritdoc />
    public partial class SeedFieldNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM \"FieldNames\";");
            migrationBuilder.InsertData(
                table: "FieldNames",
                columns: new[] { "Id", "Name" },
                values: new object[,]
                {
                    { 1, "Цена" },
                    { 2, "Год выпуска" },
                    { 3, "Марка" },
                    { 4, "Модель" },
                    { 5, "Пробег" },
                    { 6, "Мощность двигателя" },
                    { 7, "Объём двигателя" },
                    { 8, "Тип топлива" },
                    { 9, "Коробка передач" },
                    { 10, "Привод" },
                    { 11, "Цвет" },
                    { 12, "Кузов" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "FieldNames",
                keyColumn: "Id",
                keyValue: 12);
        }
    }
}
