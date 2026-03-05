:::include ./includes/abstract.md :::
:::include ./includes/status.md :::

## Introduction {#intro}

WebMCP API is a new JavaScript interface that allows web developers to expose their web application functionality as “tools” - JavaScript functions with natural language descriptions and structured schemas that can be invoked by \[=agents=], \[=browser's agents=], and \[=assistive technologies=]. Web pages that use WebMCP can be thought of as Model Context Protocol [[!MCP]] servers that implement tools in client-side script instead of on the backend. WebMCP enables collaborative workflows where users and agents work together within the same web interface, leveraging existing application logic while maintaining shared context and user control.

## Terminology {#terminology}

An <dfn>agent</dfn> is an autonomous assistant that can understand a user’s goals and take actions on the user’s behalf to achieve them. Today, these are typically implemented by large language model (LLM) based \[=AI platforms=], interacting with users via text-based chat interfaces.

A <dfn>browser’s agent</dfn> is an \[=agent=] provided by or through the browser that could be built directly into the browser or hosted by it, for example, via an extension or plug-in.

An <dfn>AI platform</dfn> is a provider of agentic assistants such as OpenAI’s ChatGPT, Anthropic’s Claude, or Google’s Gemini.

## Security and privacy considerations {#security-privacy}

## Accessibility considerations {#accessibility}

## API {#api}

### Extensions to the {{Navigator}} Interface {#navigator-extension}

The {{Navigator}} interface is extended to provide access to the {{ModelContext}}.

```webidl
partial interface Navigator {
  [SecureContext, SameObject] readonly attribute ModelContext modelContext;
};
```

### ModelContext Interface {#model-context-container}

The {{ModelContext}} interface provides methods for web applications to register and manage tools that can be invoked by \[=agents=].

```webidl
[Exposed=Window, SecureContext]
interface ModelContext {
  undefined provideContext(optional ModelContextOptions options = {});
  undefined clearContext();
  undefined registerTool(ModelContextTool tool);
  undefined unregisterTool(DOMString name);
};
```

<dl class="domintro">
<dt><code><var ignore="">navigator</var>.{{Navigator/modelContext}}.{{ModelContext/provideContext(options)}}</code></dt>
<dd>
    <p>Registers the provided context (tools) with the browser. This method clears any pre-existing tools and other context before registering the new ones.</p>
</dd>
<dt><code><var ignore="">navigator</var>.{{Navigator/modelContext}}.{{ModelContext/clearContext()}}</code></dt>
<dd>
    <p>Unregisters all context (tools) with the browser.</p>
</dd>
<dt><code><var ignore="">navigator</var>.{{Navigator/modelContext}}.{{ModelContext/registerTool(tool)}}</code></dt>
<dd>
    <p>Registers a single tool without clearing the existing set of tools. The method throws an error, if a tool with the same name already exists, or if the {{ModelContextTool/inputSchema}} is invalid.</p>
</dd>
<dt><code><var ignore="">navigator</var>.{{Navigator/modelContext}}.{{ModelContext/unregisterTool(name)}}</code></dt>
<dd>
    <p>Removes the tool with the specified name from the registered set.</p>
</dd>
</dl>

<section data-algorithm="">
The <dfn method="" for="ModelContext">provideContext(<var ignore="">options</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

<section data-algorithm="">
The <dfn method="" for="ModelContext">clearContext()</dfn> method steps are:
1. TODO: fill this out.
</section>

<section data-algorithm="">
The <dfn method="" for="ModelContext">registerTool(<var ignore="">tool</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

<section data-algorithm="">
The <dfn method="" for="ModelContext">unregisterTool(<var ignore="">name</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

#### ModelContextOptions Dictionary {#model-context-options}

```webidl
dictionary ModelContextOptions {
  sequence<ModelContextTool> tools = [];
};
```

<dl class="domintro">
<dt><code><var ignore="">options</var>["{{ModelContextOptions/tools}}"]</code></dt>
<dd>
    <p>A list of {{ModelContextOptions/tools}} to register with the browser. Each tool name in the list is expected to be unique.</p>
</dd>
</dl>

#### ModelContextTool Dictionary {#model-context-tool}

The {{ModelContextTool}} dictionary describes a tool that can be invoked by \[=agents=].

```webidl
dictionary ModelContextTool {
  required DOMString name;
  required DOMString description;
  object inputSchema;
  required ToolExecuteCallback execute;
  ToolAnnotations annotations;
};
dictionary ToolAnnotations {
  boolean readOnlyHint;
};
callback ToolExecuteCallback = Promise<any> (object input, ModelContextClient client);
```

<dl class="domintro">
<dt><code><var ignore="">tool</var>["{{ModelContextTool/name}}"]</code></dt>
<dd>
    <p>A unique identifier for the tool. This is used by [=agents=] to reference the tool when making tool calls.</p>
</dd>
<dt><code><var ignore="">tool</var>["{{ModelContextTool/description}}"]</code></dt>
<dd>
    <p>A natural language description of the tool's functionality. This helps [=agents=] understand when and how to use the tool.</p>
</dd>
<dt><code><var ignore="">tool</var>["{{ModelContextTool/inputSchema}}"]</code></dt>
<dd>
    <p>A JSON Schema [[!JSON-SCHEMA]] object describing the expected input parameters for the tool.</p>
</dd>
<dt><code><var ignore="">tool</var>["{{ModelContextTool/execute}}"]</code></dt>
<dd>
    <p>A callback function that is invoked when an [=agent=] calls the tool. The function receives the input parameters and a {{ModelContextClient}} object.</p><p>The function can be asynchronous and return a promise, in which case the [=agent=] will receive the result once the promise is resolved.</p>
</dd>
<dt><code><var ignore="">tool</var>["{{ModelContextTool/annotations}}"]</code></dt>
<dd>
    <p>Optional annotations providing additional metadata about the tool's behavior.</p>
</dd>
</dl>

The {{ToolAnnotations}} dictionary provides optional metadata about a tool:

<dl class="domintro">
<dt><code><var ignore="">annotations</var>["{{ToolAnnotations/readOnlyHint}}"]</code></dt>
<dd>
    <p>If true, indicates that the tool does not modify any state and only reads data. This hint can help [=agents=] make decisions about when it is safe to call the tool.</p>
</dd>
</dl>

#### ModelContextClient Interface {#model-context-client}

The {{ModelContextClient}} interface represents an \[=agent=] executing a tool provided by the site through the {{ModelContext}} API.

```webidl
[Exposed=Window, SecureContext]
interface ModelContextClient {
  Promise<any> requestUserInteraction(UserInteractionCallback callback);
};
callback UserInteractionCallback = Promise<any> ();
```

<dl class="domintro">
<dt><code><var ignore="">client</var>.{{ModelContextClient/requestUserInteraction(callback)}}</code></dt>
<dd>
    <p>Asynchronously requests user input during the execution of a tool.</p><p>The callback function is invoked to perform the user interaction (e.g., showing a confirmation dialog), and the promise resolves with the result of the callback.</p>
</dd>
</dl>

<section data-algorithm="">
The <dfn method="" for="ModelContextClient">requestUserInteraction(<var ignore="">callback</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

## Acknowledgements {#acknowledgements}

Thanks to
Brandon Walderman,
Leo Lee,
Andrew Nolan,
David Bokan,
Khushal Sagar,
Hannah Van Opstal,
Sushanth Rajasankar
for the initial explainer, proposals and discussions that established the foundation for this specification.

Also many thanks to Alex Nahas and Jason McGhee for sharing early implementation experience.

Finally, thanks to the participants of the Web Machine Learning Community Group for feedback and suggestions.

<spec-biblio-references />
