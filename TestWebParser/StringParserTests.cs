using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using webParser.Models.DTO;
using webParser.Service;
using Xunit;

namespace webParser.Test.Service;

public class StringParserTests
    {
        private readonly Mock<ILogger<StringParser>> _loggerMock;
        private readonly StringParser _parser;

        public StringParserTests()
        {
            _loggerMock = new Mock<ILogger<StringParser>>();
            _parser = new StringParser(_loggerMock.Object);
        }

        [Fact]
        public void ParseString_ПриNullHtml_ВозвращаетПоляСNoContent()
        {
            var fields = new List<DataField>
            {
                new DataField { Field = "Title", Data = "<h1>" },
                new DataField { Field = "Price", Data = "<span class='price'>" }
            };
            
            var result = _parser.ParseString(null, fields);
            
            result.Should().HaveCount(2);
            result.All(r => r.Data == "No content").Should().BeTrue();
            result.Select(r => r.Field).Should().BeEquivalentTo(fields.Select(f => f.Field));
        }

        [Fact]
        public void ParseString_ПриПустомHtml_ВозвращаетПоляСNoContent()
        {
            var fields = new List<DataField>
            {
                new DataField { Field = "Title", Data = "<h1>" }
            };
            
            var result = _parser.ParseString("", fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("No content");
        }

        [Fact]
        public void ParseString_СКорректнымHtml_ИзвлекаетПоля()
        {
            var html = @"
                <html>
                    <body>
                        <h1>Product Title</h1>
                        <span class='price'>$19.99</span>
                        <div id='description'>A great product</div>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "Title", Data = "<h1>" },
                new DataField { Field = "Price", Data = "<span class='price'>" },
                new DataField { Field = "Description", Data = "<div id='description'>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().HaveCount(3);
            result.Single(r => r.Field == "Title").Data.Should().Be("Product Title");
            result.Single(r => r.Field == "Price").Data.Should().Be("$19.99");
            result.Single(r => r.Field == "Description").Data.Should().Be("A great product");
        }

        [Fact]
        public void ParseString_КогдаПолеНеНайдено_ИспользуетАльтернативныйПоискИВозвращаетNotFound()
        {
            var html = @"
                <html>
                    <body>
                        <div class='old-class'>Some content</div>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "NotFound", Data = "<span class='nonexistent'>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("Not Found");
        }

        [Fact]
        public void ParseString_АльтернативныйПоискПоКлассу_Успешен()
        {
            var html = @"
                <html>
                    <body>
                        <div class='price-tag'>$29.99</div>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "Price", Data = "<span class='price-tag'>" }
            };
            
            var result = _parser.ParseString(html, fields);


            result.Should().ContainSingle()
                .Which.Data.Should().Be("$29.99");
        }

        [Fact]
        public void ParseString_АльтернативныйПоискПоИдентификатору_Успешен()
        {
            var html = @"
                <html>
                    <body>
                        <div id='product-title'>Awesome Product</div>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "Title", Data = "<h1 id='product-title'>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("Awesome Product");
        }

        [Fact]
        public void ParseString_АльтернативныйПоискПоТегу_Успешен()
        {
            var html = @"
                <html>
                    <body>
                        <p>First paragraph</p>
                        <p>Second paragraph</p>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "FirstP", Data = "<p>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("First paragraph");
        }

        [Fact]
        public void ParseString_СНекорректнымФорматомТега_ВозвращаетПолеСОшибкой()
        {
            var html = "<html><body>Some content</body></html>";
            var fields = new List<DataField>
            {
                new DataField { Field = "Invalid", Data = "not a tag" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle();
            result[0].Data.Should().StartWith("Error:");
        }

        [Fact]
        public void ParseString_ПриИсключенииВоВремяПарсингаПоля_ЛогируетОшибкуИВозвращаетПолеСОшибкой()
        {
            var html = "<html><body></body></html>";
            var fields = new List<DataField>
            {
                new DataField { Field = "NullSelector", Data = null }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle();
            result[0].Data.Should().StartWith("Error:");
            _loggerMock.Verify(
                x => x.Log(
                    LogLevel.Error,
                    It.IsAny<EventId>(),
                    It.Is<It.IsAnyType>((v, t) => true),
                    It.IsAny<Exception>(),
                    It.Is<Func<It.IsAnyType, Exception, string>>((v, t) => true)),
                Times.AtLeastOnce);
        }

        [Fact]
        public void ParseString_СHtmlEntities_ОчищаетТекст()
        {
            var html = @"
                <html>
                    <body>
                        <p>Price &amp; tax included</p>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "Description", Data = "<p>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("Price & tax included");
        }

        [Fact]
        public void ParseString_СМножественнымиПробелами_ОчищаетТекст()
        {
            var html = @"
                <html>
                    <body>
                        <div>   Lots    of   
                            spaces   
                        </div>
                    </body>
                </html>";

            var fields = new List<DataField>
            {
                new DataField { Field = "Text", Data = "<div>" }
            };
            
            var result = _parser.ParseString(html, fields);
            
            result.Should().ContainSingle()
                .Which.Data.Should().Be("Lots of spaces");
        }

        [Fact]
        public void ConvertToXPath_СПростымиТегами_ВозвращаетПравильныйXPath()
        {
            var html = "<html><body><h1>Title</h1></body></html>";
            var fields = new List<DataField> { new DataField { Field = "Title", Data = "<h1>" } };
            var result = _parser.ParseString(html, fields);
            result.Single().Data.Should().Be("Title");
        }

        [Fact]
        public void ConvertToXPath_САтрибутами_ВозвращаетПравильныйXPath()
        {
            var html = "<html><body><span class='price' data-type='final'>$10</span></body></html>";
            var fields = new List<DataField> { new DataField { Field = "Price", Data = "<span class='price' data-type='final'>" } };
            var result = _parser.ParseString(html, fields);
            result.Single().Data.Should().Be("$10");
        }
    }