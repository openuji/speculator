# Sample Specification

## Abstract

This is a sample specification demonstrating the render-respec package. It showcases how spec data is transformed into ReSpec-compatible HTML using the Speculator AST pipeline.

The specification includes <dfn>definitions</dfn>, <a>references</a>, and various structural elements that are processed and indexed by Speculator.

## Introduction

This specification defines several key concepts:

- <dfn id="concept-widget">Widget</dfn>: A fundamental building block
- <dfn id="concept-component">Component</dfn>: A reusable element composed of one or more <a>widgets</a>
- <dfn id="concept-system">System</dfn>: A collection of <a>components</a> working together

### Use Cases

The primary use case for this specification is to demonstrate:

1. How Speculator builds an AST from Markdown
2. How definitions are indexed globally
3. How references are resolved to their targets
4. How diagnostics from speculator-lint are displayed

## Core Concepts

### Widgets

A <a>widget</a> is the most basic unit in our system. Every <a>widget</a> has the following properties:

- **id**: A unique identifier
- **type**: The widget type
- **state**: Current operational state

### Components

A <a>component</a> encapsulates one or more <a>widgets</a>. Components provide:

- Composability: <a>Components</a> can contain other <a>components</a>
- Reusability: <a>Components</a> can be instantiated multiple times
- Abstraction: <a>Components</a> hide implementation details

### Systems

The <a>system</a> represents the highest level of abstraction, coordinating multiple <a>components</a> to achieve complex functionality.

## Examples

### Basic Widget Example

```javascript
const widget = {
  id: 'widget-1',
  type: 'button',
  state: 'inactive'
};
```

### Component Composition

```javascript
const component = {
  widgets: [
    { id: 'w1', type: 'label' },
    { id: 'w2', type: 'input' }
  ]
};
```

## Security Considerations

When implementing a <a>system</a>, ensure that:

1. All <a>widgets</a> are properly validated
2. <a>Components</a> enforce access controls
3. The <a>system</a> maintains audit logs

## References

This specification builds upon concepts from:

- HTML [[HTML]]
- DOM [[DOM]]
