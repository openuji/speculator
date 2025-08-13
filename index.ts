<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ReSpec-like Markup Renderer</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        
        .test-container {
            border: 1px solid #ddd;
            padding: 20px;
            margin: 20px 0;
            background: #f9f9f9;
        }
        
        .expected, .actual {
            border: 1px solid #ccc;
            padding: 10px;
            margin: 10px 0;
            background: white;
        }
        
        .expected h3, .actual h3 {
            margin-top: 0;
            color: #333;
        }
        
        .test-result {
            padding: 10px;
            margin: 10px 0;
            font-weight: bold;
        }
        
        .test-pass {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .test-fail {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        
        pre {
            background: #f4f4f4;
            padding: 10px;
            overflow-x: auto;
            border-left: 3px solid #007acc;
        }
        
        .idl {
            background: #f0f8ff;
            border-left: 3px solid #4CAF50;
        }
        
        h1, h2, h3 {
            color: #333;
        }
        
        h2 {
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
        }
        
        button {
            background: #007acc;
            color: white;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            margin: 5px;
        }
        
        button:hover {
            background: #005fa3;
        }
        
        .controls {
            margin: 20px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <h1>ReSpec-like Markup Renderer & Test Suite</h1>
    
    <div class="controls">
        <button onclick="runAllTests()">Run All Tests</button>
        <button onclick="showExample()">Show Example Output</button>
        <button onclick="clearResults()">Clear Results</button>
    </div>
    
    <div id="results"></div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js"></script>
    <script>
        // Configure marked with options for better HTML output
        marked.setOptions({
            gfm: true,
            breaks: true,
            sanitize: false,
            smartypants: true,
            headerIds: true,
            mangle: false
        });

        // Mock file system for testing
        const mockFileSystem = {
            '/sections/01-intro.md': `# Introduction

This specification defines the **Unified JavaScript Scrolling Engine** (UJSE), which provides smooth scrolling capabilities and extension hooks for web engines.

## Background

Modern web applications require smooth, performant scrolling behavior that works consistently across different browsers and devices.

Key features include:
- Hardware-accelerated smooth scrolling
- Customizable easing functions  
- Cross-browser compatibility
- Extension hooks for custom behaviors

### Use Cases

The UJSE API is designed for:

1. **Single Page Applications** - Smooth navigation between sections
2. **Documentation Sites** - Enhanced reading experience
3. **Interactive Dashboards** - Fluid data exploration
4. **Mobile Web Apps** - Native-like scroll behavior

> **Note**: This specification builds upon existing scroll APIs while providing enhanced control and performance.`,

            '/sections/05-smooth-scroller.md': `# Smooth Scroller

The \`SmoothScroller\` interface provides methods for implementing smooth scrolling behavior with configurable timing and easing.

## Implementation Requirements

The smooth scroller **MUST** implement the following behavior:

- Gradual position changes over time
- Configurable easing functions  
- Animation frame synchronization
- Interrupt handling for user input

## Easing Functions

Supported easing functions include:

| Function | Description | Use Case |
|----------|-------------|----------|
| \`linear\` | Constant speed | Debug/testing |
| \`ease\` | Default smooth | General use |
| \`ease-in-out\` | Slow start/end | Natural feel |
| \`cubic-bezier\` | Custom curve | Advanced control |

## Example Usage

\`\`\`javascript
const scroller = UJSE.createScroller(document.body);
scroller.scrollTo(0, 500, {
  duration: 800,
  easing: 'ease-in-out'
});
\`\`\`

The implementation **SHOULD** provide smooth 60fps animation and **MAY** optimize for different device capabilities.`,

            '/idl/ujse.webidl': `interface SmoothScroller {
  void scrollTo(double x, double y, optional ScrollOptions options);
  void scrollBy(double deltaX, double deltaY, optional ScrollOptions options);
  readonly attribute boolean isScrolling;
};

dictionary ScrollOptions {
  DOMString behavior = "smooth";
  double duration = 300;
  DOMString easing = "ease-in-out";
};

[Exposed=Window]
interface UJSE {
  static SmoothScroller createScroller(Element target);
};`
        };

        // Custom renderer for marked to handle ReSpec-specific needs
        const renderer = new marked.Renderer();
        
        // Override heading renderer to ensure proper levels for ReSpec sections
        renderer.heading = function(text, level) {
            // In ReSpec sections, treat # as h2 to maintain proper document hierarchy
            const actualLevel = level === 1 ? 2 : level;
            const escapedText = text.toLowerCase().replace(/[^\w]+/g, '-');
            return `<h${actualLevel} id="${escapedText}">${text}</h${actualLevel}>\n`;
        };

        // Override code renderer for better WebIDL formatting
        renderer.code = function(code, language) {
            const className = language ? `class="${language}"` : '';
            return `<pre ${className}><code>${code}</code></pre>\n`;
        };

        // Markdown to HTML converter using marked
        function markdownToHTML(markdown) {
            try {
                return marked.parse(markdown, { renderer: renderer });
            } catch (error) {
                console.error('Markdown parsing error:', error);
                return `<p class="error">Error parsing markdown: ${error.message}</p>`;
            }
        }

        // Main renderer class
        class ReSpecRenderer {
            constructor(baseUrl = '') {
                this.baseUrl = baseUrl;
            }

            async processElement(element) {
                const clonedElement = element.cloneNode(true);
                
                // Handle data-include
                if (clonedElement.hasAttribute('data-include')) {
                    const includePath = clonedElement.getAttribute('data-include');
                    const includeFormat = clonedElement.getAttribute('data-include-format') || 'text';
                    
                    try {
                        const content = await this.loadFile(includePath);
                        const processedContent = this.processContent(content, includeFormat);
                        clonedElement.innerHTML = processedContent;
                    } catch (error) {
                        clonedElement.innerHTML = `<p class="error">Failed to load: ${includePath}</p>`;
                    }
                    
                    // Remove data-include attributes
                    clonedElement.removeAttribute('data-include');
                    clonedElement.removeAttribute('data-include-format');
                }
                
                // Handle data-format
                if (clonedElement.hasAttribute('data-format')) {
                    const format = clonedElement.getAttribute('data-format');
                    if (format === 'markdown' && clonedElement.innerHTML.trim()) {
                        const markdownContent = clonedElement.innerHTML.trim();
                        clonedElement.innerHTML = this.processContent(markdownContent, format);
                    }
                    clonedElement.removeAttribute('data-format');
                }
                
                return clonedElement;
            }

            async loadFile(path) {
                // In a real implementation, this would fetch from the server
                // For testing, we use our mock file system
                if (mockFileSystem[path]) {
                    return mockFileSystem[path];
                }
                throw new Error(`File not found: ${path}`);
            }

            processContent(content, format) {
                switch (format) {
                    case 'markdown':
                        return markdownToHTML(content);
                    case 'text':
                    default:
                        return content;
                }
            }

            async renderDocument(container) {
                const sections = container.querySelectorAll('section[data-include], section[data-format]');
                const processedSections = [];
                
                for (const section of sections) {
                    const processed = await this.processElement(section);
                    processedSections.push(processed);
                }
                
                // Replace original sections with processed ones
                sections.forEach((section, index) => {
                    section.parentNode.replaceChild(processedSections[index], section);
                });
                
                return container;
            }
        }

        // Test cases with more comprehensive markdown examples
        const testCases = [
            {
                name: 'Inline Markdown Processing',
                input: '<section id="abstract" data-format="markdown">## Abstract\nUJSE defines **smooth scrolling** and *extension hooks* for web engines.</section>',
                expected: '<section id="abstract"><h2 id="abstract">Abstract</h2>\n<p>UJSE defines <strong>smooth scrolling</strong> and <em>extension hooks</em> for web engines.</p>\n</section>'
            },
            {
                name: 'Complex Markdown with Lists and Tables',
                input: '<section id="features" data-format="markdown">## Features\n\n- Hardware acceleration\n- Custom easing\n- Cross-browser\n\n| Browser | Support |\n|---------|--------|\n| Chrome | ✓ |\n| Firefox | ✓ |</section>',
                expected: '<section id="features"><h2 id="features">Features</h2>\n<ul>\n<li>Hardware acceleration</li>\n<li>Custom easing</li>\n<li>Cross-browser</li>\n</ul>\n<table>\n<thead>\n<tr>\n<th>Browser</th>\n<th>Support</th>\n</tr>\n</thead>\n<tbody><tr>\n<td>Chrome</td>\n<td>✓</td>\n</tr>\n<tr>\n<td>Firefox</td>\n<td>✓</td>\n</tr>\n</tbody></table>\n</section>'
            },
            {
                name: 'File Inclusion with Advanced Markdown',
                input: '<section id="introduction" data-include="/sections/01-intro.md" data-include-format="markdown"></section>',
                expected: function(actual) {
                    // Test that it includes proper headings, lists, tables, and formatting
                    return actual.includes('<h2 id="introduction">Introduction</h2>') &&
                           actual.includes('<strong>Unified JavaScript Scrolling Engine</strong>') &&
                           actual.includes('<h2 id="background">Background</h2>') &&
                           actual.includes('<ul>') &&
                           actual.includes('<li>Hardware-accelerated smooth scrolling</li>') &&
                           actual.includes('<h3 id="use-cases">Use Cases</h3>') &&
                           actual.includes('<ol>') &&
                           actual.includes('<blockquote>') &&
                           actual.includes('<p><strong>Note</strong>:');
                }
            },
            {
                name: 'Code Block Processing',
                input: '<section id="example" data-format="markdown">## Example\n\n```javascript\nconst scroller = new SmoothScroller();\nscroller.scrollTo(0, 100);\n```</section>',
                expected: '<section id="example"><h2 id="example">Example</h2>\n<pre class="javascript"><code>const scroller = new SmoothScroller();\nscroller.scrollTo(0, 100);\n</code></pre>\n</section>'
            },
            {
                name: 'Text File Inclusion (WebIDL)',
                input: '<section id="idl"><h2>WebIDL</h2><pre class="idl" data-include="/idl/ujse.webidl" data-include-format="text"></pre></section>',
                expected: function(actual) {
                    return actual.includes('interface SmoothScroller') &&
                           actual.includes('void scrollTo') &&
                           actual.includes('dictionary ScrollOptions') &&
                           actual.includes('[Exposed=Window]') &&
                           actual.includes('interface UJSE');
                }
            }
        ];

        // Enhanced test runner with better comparison logic
        async function runTest(testCase) {
            const renderer = new ReSpecRenderer('/');
            const container = document.createElement('div');
            container.innerHTML = testCase.input;
            
            try {
                await renderer.renderDocument(container);
                const actualOutput = container.innerHTML;
                
                let passed = false;
                let error = null;
                
                if (typeof testCase.expected === 'function') {
                    // For complex tests, use a validation function
                    passed = testCase.expected(actualOutput);
                    if (!passed) {
                        error = 'Content validation failed - check that all expected elements are present';
                    }
                } else {
                    // For simple tests, compare normalized strings
                    const normalizedActual = actualOutput.replace(/\s+/g, ' ').trim();
                    const normalizedExpected = testCase.expected.replace(/\s+/g, ' ').trim();
                    passed = normalizedActual === normalizedExpected;
                    if (!passed) {
                        error = 'Output does not match expected result';
                    }
                }
                
                return {
                    name: testCase.name,
                    passed,
                    expected: typeof testCase.expected === 'function' ? 'Custom validation function' : testCase.expected,
                    actual: actualOutput,
                    error
                };
            } catch (error) {
                return {
                    name: testCase.name,
                    passed: false,
                    expected: typeof testCase.expected === 'function' ? 'Custom validation function' : testCase.expected,
                    actual: '',
                    error: error.message
                };
            }
        }

        async function runAllTests() {
            const resultsContainer = document.getElementById('results');
            resultsContainer.innerHTML = '<h2>Running Tests...</h2>';
            
            const results = [];
            for (const testCase of testCases) {
                const result = await runTest(testCase);
                results.push(result);
            }
            
            displayResults(results);
        }

        function displayResults(results) {
            const resultsContainer = document.getElementById('results');
            let html = '<h2>Test Results</h2>';
            
            const passedTests = results.filter(r => r.passed).length;
            const totalTests = results.length;
            
            html += `<p><strong>${passedTests}/${totalTests} tests passed</strong></p>`;
            
            results.forEach(result => {
                html += `<div class="test-container">`;
                html += `<h3>${result.name}</h3>`;
                html += `<div class="test-result ${result.passed ? 'test-pass' : 'test-fail'}">`;
                html += result.passed ? '✓ PASS' : `✗ FAIL: ${result.error}`;
                html += `</div>`;
                
                if (!result.passed) {
                    html += `<div class="expected"><h3>Expected:</h3><pre>${escapeHtml(result.expected)}</pre></div>`;
                    html += `<div class="actual"><h3>Actual:</h3><pre>${escapeHtml(result.actual)}</pre></div>`;
                }
                
                html += `</div>`;
            });
            
            resultsContainer.innerHTML = html;
        }

        async function showExample() {
            const exampleMarkup = `<div>
  <section id="abstract" data-format="markdown">
  ## Abstract
  UJSE defines smooth scrolling and extension hooks for web engines.
  </section>
  <section id="sotd" data-format="markdown">
  ## Status of This Document
  This is an Editor's Draft of UJSE 1.0.
  </section>
  <section id="introduction"
    data-include="/sections/01-intro.md"
    data-include-format="markdown"></section>
  <section id="smooth-scroller"
    data-include="/sections/05-smooth-scroller.md"
    data-include-format="markdown"></section>
  <section id="idl">
    <h2>WebIDL</h2>
    <pre class="idl"
      data-include="/idl/ujse.webidl"
      data-include-format="text"></pre>
  </section>
  <section id="conformance" data-format="markdown">
  ## Conformance
  The key words **MUST**, **SHOULD**, and **MAY** are as in RFC 2119.
  </section>
</div>`;

            const renderer = new ReSpecRenderer('/');
            const container = document.createElement('div');
            container.innerHTML = exampleMarkup;
            
            await renderer.renderDocument(container);
            
            const resultsContainer = document.getElementById('results');
            resultsContainer.innerHTML = `
                <h2>Example Output</h2>
                <div class="test-container">
                    <h3>Original Markup:</h3>
                    <pre>${escapeHtml(exampleMarkup)}</pre>
                    <h3>Rendered HTML:</h3>
                    <pre>${escapeHtml(container.innerHTML)}</pre>
                    <h3>Live Preview:</h3>
                    <div style="border: 1px solid #ddd; padding: 20px; background: white;">
                        ${container.innerHTML}
                    </div>
                </div>
            `;
        }

        function clearResults() {
            document.getElementById('results').innerHTML = '';
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Initialize
        window.onload = function() {
            console.log('ReSpec-like renderer loaded. Click "Run All Tests" to verify functionality.');
        };
    </script>
</body>
</html>