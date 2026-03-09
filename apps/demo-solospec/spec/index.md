## Status of This Document {data-boilerplate="sotd" data-no-toc}

This specification was published by the [Web Machine Learning Community Group](https://www.w3.org/community/webmachinelearning/). It is not a W3C Standard nor is it on the W3C Standards Track. Please note that under the [W3C Community Contributor License Agreement (CLA)](https://www.w3.org/community/about/agreements/cla/) there is a limited opt-out and other conditions apply. Learn more about [W3C Community and Business Groups](http://www.w3.org/community/).

## Abstract {data-boilerplate="abstract" data-no-toc id="abstract"}

The WebMCP API enables web applications to provide JavaScript-based tools to AI agents.

## Introduction {id="intro"}

WebMCP API is a new JavaScript interface that allows web developers to expose their web application functionality as “tools” - JavaScript functions with natural language descriptions and structured schemas that can be invoked by [=agent=], [=browsers-agent|browser’s agents=], and <a data-link-type="dfn" data-xref-spec="aria" href="https://w3c.github.io/aria/#assistive-technology" id="ref-for-assistive-technology">assistive technologies</a>. Web pages that use WebMCP can be thought of as Model Context Protocol [[MCP]] servers that implement tools in client-side script instead of on the backend. WebMCP enables collaborative workflows where users and agents work together within the same web interface, leveraging existing application logic while maintaining shared context and user control.

## Terminology {id="terminology"}

An <dfn>agent</dfn> is an autonomous assistant that can understand a user’s goals and take actions on the user’s behalf to achieve them. Today, these are typically implemented by large language model (LLM) based [=ai-platform|AI platforms=], interacting with users via text-based chat interfaces.

A <dfn id="browsers-agent">browser’s agent</dfn> is an [=agent=] provided by or through the browser that could be built directly into the browser or hosted by it, for example, via an extension or plug-in.

An <dfn id="ai-platform">AI platform</dfn> is a provider of agentic assistants such as OpenAI’s ChatGPT, Anthropic’s Claude, or Google’s Gemini.

## Supporting concepts {id="supporting-concepts"}

A <dfn id="model-context">model context</dfn> is a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct" id="ref-for-struct">struct</a> with the following <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct-item" id="ref-for-struct-item">items</a>:

<dl>
  <dt><dfn data-dfn-for="model context" id="model-context-tool-map">tool map</dfn></dt>
  <dd>a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#ordered-map" id="ref-for-ordered-map">map</a> whose <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-getting-the-keys" id="ref-for-map-getting-the-keys">keys</a> are <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#string" id="ref-for-string">strings</a> and whose <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-getting-the-values" id="ref-for-map-getting-the-values">values</a> are [=tool-definition|tool definition=] <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct" id="ref-for-struct①">structs</a>.</dd>
</dl>

A <dfn id="tool-definition">tool definition</dfn> is a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct" id="ref-for-struct②">struct</a> with the following <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct-item" id="ref-for-struct-item①">items</a>:

<dl>
  <dt><dfn data-dfn-for="tool definition" id="tool-definition-name">name</dfn></dt>
  <dd>a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#string" id="ref-for-string①">string</a> uniquely identifying a tool registered within a [=model-context|model context=]’s [=model-context-tool-map|tool map=]; it is the same as the <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-key" id="ref-for-map-key">key</a> identifying this object.</dd>
  <dt><dfn data-dfn-for="tool definition" id="tool-definition-description">description</dfn></dt>
  <dd>a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#string" id="ref-for-string②">string</a>.</dd>
  <dt><dfn data-dfn-for="tool definition" id="tool-definition-input-schema">input schema</dfn></dt>
  <dd>
    a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#string" id="ref-for-string③">string</a>.

    <aside class="note" data-informative="true">
      Note: For tools registered by the imperative form of this API (i.e., <code><a data-link-type="idl" href="#dom-modelcontext-registertool" id="ref-for-dom-modelcontext-registertool">registerTool()</a></code>), this is the stringified representation of <code><a data-link-type="idl" href="#dom-modelcontexttool-inputschema" id="ref-for-dom-modelcontexttool-inputschema">inputSchema</a></code>. For tools registered [declaratively](https://github.com/webmachinelearning/webmcp/pull/76), this will be a stringified JSON Schema object created by the [=synthesize-a-declarative-json-schema-object-algorithm|synthesize a declarative JSON Schema object algorithm=]. [[JSON-SCHEMA]]
    </aside>
  </dd>
  <dt><dfn data-dfn-for="tool definition" id="tool-definition-execute-steps">execute steps</dfn></dt>
  <dd>
    a set of steps to invoke the tool.

    <aside class="note" data-informative="true">
      Note: For tools registered imperatively, these steps will simply invoke the supplied <code><a data-link-type="idl" href="#callbackdef-toolexecutecallback" id="ref-for-callbackdef-toolexecutecallback">ToolExecuteCallback</a></code> callback. For tools registered [declaratively](https://github.com/webmachinelearning/webmcp/pull/76), this will be a set of "internal" steps that have not been defined yet, that describe how to fill out a <code><a data-link-type="element" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/forms.html#the-form-element" id="ref-for-the-form-element">form</a></code> and its <a data-link-type="dfn" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/forms.html#form-associated-element" id="ref-for-form-associated-element">form-associated elements</a>.
    </aside>
  </dd>
  <dt><dfn data-dfn-for="tool definition" id="tool-definition-read-only-hint">read-only hint</dfn></dt>
  <dd>a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#boolean" id="ref-for-boolean">boolean</a>, initially false.</dd>
</dl>

## API {id="api"}

### Extensions to the <code><a data-link-type="idl" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator">Navigator</a></code> Interface {id="navigator-extension"}

The <code><a data-link-type="idl" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator①">Navigator</a></code> interface is extended to provide access to the <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext">ModelContext</a></code>.

<pre class="idl">
  partial interface <a class="idl-code" data-link-type="interface" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator②">Navigator</a> {
    [<a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#SecureContext" id="ref-for-SecureContext">SecureContext</a>, <a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#SameObject" id="ref-for-SameObject">SameObject</a>] readonly attribute <a data-link-type="idl-name" href="#modelcontext" id="ref-for-modelcontext①">ModelContext</a> <a class="idl-code" data-link-type="attribute" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext">modelContext</a>;
  };
</pre>

Each <code><a data-link-type="idl" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator③">Navigator</a></code> object has an associated <dfn data-dfn-for="navigator" id="navigator-modelcontext">modelContext</dfn>, which is a <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext②">ModelContext</a></code> instance created alongside the <code><a data-link-type="idl" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/system-state.html#navigator" id="ref-for-navigator④">Navigator</a></code>.

<div data-algorithm="true" data-algorithm-name="modelContext">
  The <dfn data-dfn-for="navigator" data-dfn-type="attribute" id="dom-navigator-modelcontext"><code>modelContext</code></dfn> getter steps are to return <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#this" id="ref-for-this">this</a>’s [=navigator-modelcontext|modelContext=].
</div>

### ModelContext Interface {id="model-context-container"}

The <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext③">ModelContext</a></code> interface provides methods for web applications to register and manage tools that can be invoked by [=agent=].

<pre class="idl">
  [<a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#Exposed" id="ref-for-Exposed">Exposed</a>=Window, <a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#SecureContext" id="ref-for-SecureContext①">SecureContext</a>]
  interface ModelContext {
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-undefined" id="ref-for-idl-undefined">undefined</a> <a class="idl-code" data-link-type="method" href="#dom-modelcontext-providecontext" id="ref-for-dom-modelcontext-providecontext">provideContext</a>(optional <a data-link-type="idl-name" href="#dictdef-modelcontextoptions" id="ref-for-dictdef-modelcontextoptions">ModelContextOptions</a> options = {});
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-undefined" id="ref-for-idl-undefined①">undefined</a> <a class="idl-code" data-link-type="method" href="#dom-modelcontext-clearcontext" id="ref-for-dom-modelcontext-clearcontext">clearContext</a>();
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-undefined" id="ref-for-idl-undefined②">undefined</a> <a class="idl-code" data-link-type="method" href="#dom-modelcontext-registertool" id="ref-for-dom-modelcontext-registertool①">registerTool</a>(<a data-link-type="idl-name" href="#dictdef-modelcontexttool" id="ref-for-dictdef-modelcontexttool">ModelContextTool</a> tool);
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-undefined" id="ref-for-idl-undefined③">undefined</a> <a class="idl-code" data-link-type="method" href="#dom-modelcontext-unregistertool" id="ref-for-dom-modelcontext-unregistertool">unregisterTool</a>(<a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMString" id="ref-for-idl-DOMString">DOMString</a> name);
  };
</pre>

Each <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext④">ModelContext</a></code> object has an associated <dfn data-dfn-for="modelcontext" id="modelcontext-internal-context">internal context</dfn>, which is a [=model-context|model context=] <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct" id="ref-for-struct③">struct</a> created alongside the <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext⑤">ModelContext</a></code>.

<div class="domintro">
  <dl>
    <dt><code><var>navigator</var>.<code><a data-link-type="idl" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext①">modelContext</a></code>.<code><a data-link-type="idl" href="#dom-modelcontext-providecontext" id="ref-for-dom-modelcontext-providecontext①">provideContext(options)</a></code></code></dt>
    <dd>Registers the provided context (tools) with the browser. This method clears any pre-existing tools and other context before registering the new ones.</dd>
    <dt><code><var>navigator</var>.<code><a data-link-type="idl" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext②">modelContext</a></code>.<code><a data-link-type="idl" href="#dom-modelcontext-clearcontext" id="ref-for-dom-modelcontext-clearcontext①">clearContext()</a></code></code></dt>
    <dd>Unregisters all context (tools) with the browser.</dd>
    <dt><code><var>navigator</var>.<code><a data-link-type="idl" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext③">modelContext</a></code>.<code><a data-link-type="idl" href="#dom-modelcontext-registertool" id="ref-for-dom-modelcontext-registertool②">registerTool(tool)</a></code></code></dt>
    <dd>Registers a single tool without clearing the existing set of tools. The method throws an error, if a tool with the same name already exists, or if the <code><a data-link-type="idl" href="#dom-modelcontexttool-inputschema" id="ref-for-dom-modelcontexttool-inputschema①">inputSchema</a></code> is invalid.</dd>
    <dt><code><var>navigator</var>.<code><a data-link-type="idl" href="#dom-navigator-modelcontext" id="ref-for-dom-navigator-modelcontext④">modelContext</a></code>.<code><a data-link-type="idl" href="#dom-modelcontext-unregistertool" id="ref-for-dom-modelcontext-unregistertool①">unregisterTool(name)</a></code></code></dt>
    <dd>Removes the tool with the specified name from the registered set.</dd>
  </dl>
</div>

<div data-algorithm="true" data-algorithm-name="provideContext(options)">
  The <dfn data-dfn-for="modelcontext" data-dfn-type="method" id="dom-modelcontext-providecontext"><code>provideContext(<var>options</var>)</code></dfn> method steps are:

  <ol>
    <li>TODO: fill this out.</li>
  </ol>
</div>

<div data-algorithm="true" data-algorithm-name="clearContext()">
  The <dfn data-dfn-for="modelcontext" data-dfn-type="method" id="dom-modelcontext-clearcontext"><code>clearContext()</code></dfn> method steps are:

  <ol>
    <li>TODO: fill this out.</li>
  </ol>
</div>

<div data-algorithm="true" data-algorithm-name="registerTool(tool)">
  The <dfn data-dfn-for="modelcontext" data-dfn-type="method" id="dom-modelcontext-registertool"><code>registerTool(<var>tool</var>)</code></dfn> method steps are:

  <ol>
    <li>Let <var>tool map</var> be <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#this" id="ref-for-this①">this</a>’s [=modelcontext-internal-context|internal context=]’s [=model-context-tool-map|tool map=].</li>
    <li>Let <var>tool name</var> be <var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-name" id="ref-for-dom-modelcontexttool-name">name</a></code>.</li>
    <li>If <var>tool map</var>[<var>tool name</var>] <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-exists" id="ref-for-map-exists">exists</a>, then <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#dfn-throw" id="ref-for-dfn-throw">throw</a> an <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#invalidstateerror" id="ref-for-invalidstateerror">InvalidStateError</a></code> <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMException" id="ref-for-idl-DOMException">DOMException</a></code>.</li>
    <li>If either <var>tool name</var> or <code><a data-link-type="idl" href="#dom-modelcontexttool-description" id="ref-for-dom-modelcontexttool-description">description</a></code> is the empty string, then <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#dfn-throw" id="ref-for-dfn-throw①">throw</a> an <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#invalidstateerror" id="ref-for-invalidstateerror①">InvalidStateError</a></code> <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMException" id="ref-for-idl-DOMException①">DOMException</a></code>.</li>
    <li>Let <var>stringified input schema</var> be the empty string.</li>
    <li>
      If <var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-inputschema" id="ref-for-dom-modelcontexttool-inputschema②">inputSchema</a></code> <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-exists" id="ref-for-map-exists①">exists</a>, then set <var>stringified input schema</var> to the result of <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#serialize-a-javascript-value-to-a-json-string" id="ref-for-serialize-a-javascript-value-to-a-json-string">serializing a JavaScript value to a JSON string</a>, given <var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-inputschema" id="ref-for-dom-modelcontexttool-inputschema③">inputSchema</a></code>.

      <aside class="note" data-informative="true">
        The serialization algorithm above throws exceptions in the following cases:

        <ol>
          <li>Throws a new <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#exceptiondef-typeerror" id="ref-for-exceptiondef-typeerror">TypeError</a></code> when the backing "<code>JSON.stringify()</code>" yields undefined, e.g., "<code>inputSchema: { toJSON() {return HTMLDivElement;}}</code>", or "<code>inputSchema: { toJSON() {return undefined;}}</code>".</li>
          <li>Re-throws exceptions thrown by "<code>JSON.stringify()</code>", e.g., when "<code>inputSchema</code>" is an object with a circular reference, etc.</li>
        </ol>
      </aside>
    </li>
    <li>Let <var>read-only hint</var> be true if <var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-annotations" id="ref-for-dom-modelcontexttool-annotations">annotations</a></code> <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-exists" id="ref-for-map-exists②">exists</a> and its <code><a data-link-type="idl" href="#dom-toolannotations-readonlyhint" id="ref-for-dom-toolannotations-readonlyhint">readOnlyHint</a></code> is true. Otherwise, let it be false.</li>
    <li>
      Let <var>tool definition</var> be a new [=tool-definition|tool definition=], with the following <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#struct-item" id="ref-for-struct-item②">items</a>:

      <dl>
        <dt>[=tool-definition-name|name=]</dt>
        <dd><var>tool name</var></dd>
        <dt>[=tool-definition-description|description=]</dt>
        <dd><var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-description" id="ref-for-dom-modelcontexttool-description①">description</a></code></dd>
        <dt>[=tool-definition-input-schema|input schema=]</dt>
        <dd><var>stringified input schema</var></dd>
        <dt>[=tool-definition-execute-steps|execute steps=]</dt>
        <dd>steps that invoke <var>tool</var>’s <code><a data-link-type="idl" href="#dom-modelcontexttool-execute" id="ref-for-dom-modelcontexttool-execute">execute</a></code></dd>
        <dt>[=tool-definition-read-only-hint|read-only hint=]</dt>
        <dd><var>read-only hint</var></dd>
      </dl>
    </li>
    <li>Set <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#this" id="ref-for-this②">this</a>’s [=modelcontext-internal-context|internal context=][<var>tool name</var>] to <var>tool definition</var>.</li>
  </ol>
</div>

<div data-algorithm="true" data-algorithm-name="unregisterTool(name)">
  The <dfn data-dfn-for="modelcontext" data-dfn-type="method" id="dom-modelcontext-unregistertool"><code>unregisterTool(<var>name</var>)</code></dfn> method steps are:

  <ol>
    <li>Let <var>tool map</var> be <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#this" id="ref-for-this③">this</a>’s [=modelcontext-internal-context|internal context=]’s [=model-context-tool-map|tool map=].</li>
    <li>If <var>tool map</var>[<var>name</var>] does not <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-exists" id="ref-for-map-exists③">exist</a>, then <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#dfn-throw" id="ref-for-dfn-throw②">throw</a> an <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#invalidstateerror" id="ref-for-invalidstateerror②">InvalidStateError</a></code> <code><a data-link-type="idl" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMException" id="ref-for-idl-DOMException②">DOMException</a></code>.</li>
    <li><a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#map-remove" id="ref-for-map-remove">Remove</a> <var>tool map</var>[<var>name</var>].</li>
  </ol>
</div>

#### ModelContextOptions Dictionary {id="model-context-options"}

<pre class="idl">
  dictionary ModelContextOptions {
    <a data-link-type="dfn" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-sequence" id="ref-for-idl-sequence">sequence</a>&lt;<a data-link-type="idl-name" href="#dictdef-modelcontexttool" id="ref-for-dictdef-modelcontexttool①">ModelContextTool</a>&gt; tools = [];
  };
</pre>

<div class="domintro">
  <dl>
    <dt><code><var>options</var>["<code><a data-link-type="idl" href="#dom-modelcontextoptions-tools" id="ref-for-dom-modelcontextoptions-tools">tools</a></code>"]</code></dt>
    <dd>A list of <code><a data-link-type="idl" href="#dom-modelcontextoptions-tools" id="ref-for-dom-modelcontextoptions-tools①">tools</a></code> to register with the browser. Each tool name in the list is expected to be unique.</dd>
  </dl>
</div>

#### ModelContextTool Dictionary {id="model-context-tool"}

The <code><a data-link-type="idl" href="#dictdef-modelcontexttool" id="ref-for-dictdef-modelcontexttool②">ModelContextTool</a></code> dictionary describes a tool that can be invoked by [=agent=].

<pre class="idl">
  dictionary ModelContextTool {
    required <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMString" id="ref-for-idl-DOMString①">DOMString</a> name;
    required <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-DOMString" id="ref-for-idl-DOMString②">DOMString</a> description;
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-object" id="ref-for-idl-object">object</a> inputSchema;
    required <a data-link-type="idl-name" href="#callbackdef-toolexecutecallback" id="ref-for-callbackdef-toolexecutecallback①">ToolExecuteCallback</a> execute;
    <a data-link-type="idl-name" href="#dictdef-toolannotations" id="ref-for-dictdef-toolannotations">ToolAnnotations</a> annotations;
  };

  dictionary ToolAnnotations {
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-boolean" id="ref-for-idl-boolean">boolean</a> <a class="idl-code" data-link-type="dict-member" href="#dom-toolannotations-readonlyhint" id="ref-for-dom-toolannotations-readonlyhint①">readOnlyHint</a> = false;
  };

  callback ToolExecuteCallback = <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-promise" id="ref-for-idl-promise">Promise</a>&lt;<a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-any" id="ref-for-idl-any">any</a>&gt; (<a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-object" id="ref-for-idl-object①">object</a> input, <a data-link-type="idl-name" href="#modelcontextclient" id="ref-for-modelcontextclient">ModelContextClient</a> client);
</pre>

<div class="domintro">
  <dl>
    <dt><code><var>tool</var>["<code><a data-link-type="idl" href="#dom-modelcontexttool-name" id="ref-for-dom-modelcontexttool-name①">name</a></code>"]</code></dt>
    <dd>A unique identifier for the tool. This is used by [=agent=] to reference the tool when making tool calls.</dd>
    <dt><code><var>tool</var>["<code><a data-link-type="idl" href="#dom-modelcontexttool-description" id="ref-for-dom-modelcontexttool-description②">description</a></code>"]</code></dt>
    <dd>A natural language description of the tool’s functionality. This helps [=agent=] understand when and how to use the tool.</dd>
    <dt><code><var>tool</var>["<code><a data-link-type="idl" href="#dom-modelcontexttool-inputschema" id="ref-for-dom-modelcontexttool-inputschema④">inputSchema</a></code>"]</code></dt>
    <dd>A JSON Schema [[JSON-SCHEMA]] object describing the expected input parameters for the tool.</dd>
    <dt><code><var>tool</var>["<code><a data-link-type="idl" href="#dom-modelcontexttool-execute" id="ref-for-dom-modelcontexttool-execute①">execute</a></code>"]</code></dt>
    <dd>
      A callback function that is invoked when an [=agent=] calls the tool. The function receives the input parameters and a <code><a data-link-type="idl" href="#modelcontextclient" id="ref-for-modelcontextclient①">ModelContextClient</a></code> object.

      The function can be asynchronous and return a promise, in which case the [=agent=] will receive the result once the promise is resolved.
    </dd>
    <dt><code><var>tool</var>["<code><a data-link-type="idl" href="#dom-modelcontexttool-annotations" id="ref-for-dom-modelcontexttool-annotations①">annotations</a></code>"]</code></dt>
    <dd>Optional annotations providing additional metadata about the tool’s behavior.</dd>
  </dl>
</div>

The <code><a data-link-type="idl" href="#dictdef-toolannotations" id="ref-for-dictdef-toolannotations①">ToolAnnotations</a></code> dictionary provides optional metadata about a tool:

<div class="domintro">
  <dl>
    <dt><dfn data-dfn-for="toolannotations" data-dfn-type="dict-member" id="dom-toolannotations-readonlyhint"><code>readOnlyHint</code></dfn>,  of type <a data-link-type="idl-name" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-boolean" id="ref-for-idl-boolean①">boolean</a>, defaulting to <code>false</code></dt>
    <dd>If true, indicates that the tool does not modify any state and only reads data. This hint can help [=agent=] make decisions about when it is safe to call the tool.</dd>
  </dl>
</div>

#### ModelContextClient Interface {id="model-context-client"}

The <code><a data-link-type="idl" href="#modelcontextclient" id="ref-for-modelcontextclient②">ModelContextClient</a></code> interface represents an [=agent=] executing a tool provided by the site through the <code><a data-link-type="idl" href="#modelcontext" id="ref-for-modelcontext⑥">ModelContext</a></code> API.

<pre class="idl">
  [<a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#Exposed" id="ref-for-Exposed①">Exposed</a>=Window, <a class="idl-code" data-link-type="extended-attribute" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#SecureContext" id="ref-for-SecureContext②">SecureContext</a>]
  interface ModelContextClient {
    <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-promise" id="ref-for-idl-promise①">Promise</a>&lt;<a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-any" id="ref-for-idl-any①">any</a>&gt; <a class="idl-code" data-link-type="method" href="#dom-modelcontextclient-requestuserinteraction" id="ref-for-dom-modelcontextclient-requestuserinteraction">requestUserInteraction</a>(<a data-link-type="idl-name" href="#callbackdef-userinteractioncallback" id="ref-for-callbackdef-userinteractioncallback">UserInteractionCallback</a> callback);
  };

  callback UserInteractionCallback = <a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-promise" id="ref-for-idl-promise②">Promise</a>&lt;<a class="idl-code" data-link-type="interface" data-xref-spec="webidl" href="https://webidl.spec.whatwg.org/#idl-any" id="ref-for-idl-any②">any</a>&gt; ();
</pre>

<div class="domintro">
  <dl>
    <dt><code><var>client</var>.<code><a data-link-type="idl" href="#dom-modelcontextclient-requestuserinteraction" id="ref-for-dom-modelcontextclient-requestuserinteraction①">requestUserInteraction(callback)</a></code></code></dt>
    <dd>
      Asynchronously requests user input during the execution of a tool.

      The callback function is invoked to perform the user interaction (e.g., showing a confirmation dialog), and the promise resolves with the result of the callback.
    </dd>
  </dl>
</div>

<div data-algorithm="true" data-algorithm-name="requestUserInteraction(callback)">
  The <dfn data-dfn-for="modelcontextclient" data-dfn-type="method" id="dom-modelcontextclient-requestuserinteraction"><code>requestUserInteraction(<var>callback</var>)</code></dfn> method steps are:

  <ol>
    <li>TODO: fill this out.</li>
  </ol>
</div>

### Declarative WebMCP {id="declarative-api"}

This section is entirely a TODO. For now, refer to the [explainer draft](https://github.com/webmachinelearning/webmcp/pull/76).

<div data-algorithm="true" data-algorithm-name="synthesize a declarative JSON Schema object algorithm">
  The <dfn id="synthesize-a-declarative-json-schema-object-algorithm">synthesize a declarative JSON Schema object algorithm</dfn>, given a <code><a data-link-type="element" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/forms.html#the-form-element" id="ref-for-the-form-element①">form</a></code> element <var>form</var>, runs the following steps. They return a <a data-link-type="dfn" data-xref-spec="infra" href="https://infra.spec.whatwg.org/#ordered-map" id="ref-for-ordered-map①">map</a> representing a JSON Schema object. [[JSON-SCHEMA]]

  <ol>
    <li>TODO: Derive a conformant JSON Schema object from <var>form</var> and its <a data-link-type="dfn" data-xref-spec="html" href="https://html.spec.whatwg.org/multipage/forms.html#form-associated-element" id="ref-for-form-associated-element①">form-associated elements</a>.</li>
  </ol>
</div>

## Security and privacy considerations {id="security-privacy"}

## Accessibility considerations {id="accessibility"}

## Acknowledgements {id="acknowledgements"}

Thanks to Brandon Walderman, Leo Lee, Andrew Nolan, David Bokan, Khushal Sagar, Hannah Van Opstal, Sushanth Rajasankar for the initial explainer, proposals and discussions that established the foundation for this specification.

Also many thanks to Alex Nahas and Jason McGhee for sharing early implementation experience.

Finally, thanks to the participants of the Web Machine Learning Community Group for feedback and suggestions.

## Conformance {data-boilerplate="conformance" data-no-toc-count data-omitted id="w3c-conformance"}

### Document conventions {data-no-toc-count id="w3c-conventions"}

Conformance requirements are expressed with a combination of descriptive assertions and RFC 2119 terminology. The key words “MUST”, “MUST NOT”, “REQUIRED”, “SHALL”, “SHALL NOT”, “SHOULD”, “SHOULD NOT”, “RECOMMENDED”, “MAY”, and “OPTIONAL” in the normative parts of this document are to be interpreted as described in RFC 2119. However, for readability, these words do not appear in all uppercase letters in this specification.

All of the text of this specification is normative except sections explicitly marked as non-normative, examples, and notes. [[!RFC2119]]

Examples in this specification are introduced with the words “for example” or are set apart from the normative text with <code>class="example"</code>, like this:

<aside class="example" data-informative="true">
  This is an example of an informative example.
</aside>

Informative notes begin with the word “Note” and are set apart from the normative text with <code>class="note"</code>, like this:

<aside class="note" data-informative="true">
  Note, this is an informative note.
</aside>
