## Introduction {#intro}

_This section is non-normative_

## Terminology {#terminology}

An <dfn>agent</dfn> is an autonomous assistant that can understand a user’s goals and take actions on the user’s behalf to achieve them. Today, these are typically implemented by large language model (LLM) based [=AI platforms=], interacting with users via text-based chat interfaces.

The OAuth 2.0 [[!RFC6749]] and OpenID Connect Core 1.0 [[!OIDC-CORE]] web standards were
published in October 2012 and November 2014, respectively. Since publication they've seen rapid and
widespread adoption across the industry, in turn gaining extensive _"real-world"_ data and
experience. The strengths of the protocols are now clear; however, in a changing eco-system where
privacy and control of digital identities are becoming more pressing concerns, it is also clear
that additional functionality is required.

An <dfn>AI platform</dfn> is a provider of agentic assistants such as OpenAI’s ChatGPT, Anthropic’s Claude, or Google’s Gemini.

## Security and privacy considerations {#security-privacy}

## Accessibility considerations {#accessibility}

_This section is non-normative_

### Extensions to the {{Navigator}} Interface {#navigator-extension}

The {{Navigator}} interface is extended to provide access to the {{ModelContext}}.

_This section is non-normative_

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

_This section is non-normative_

<section data-algorithm="">
The <dfn method="" for="ModelContext">registerTool(<var ignore="">tool</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

<section data-algorithm="">
The <dfn method="" for="ModelContext">unregisterTool(<var ignore="">name</var>)</dfn> method steps are:
1. TODO: fill this out.
</section>

#### ModelContextOptions Dictionary {#model-context-options}

_This section is non-normative_

In line with Linked Data principles, a WebID is a HTTP URI that,
when dereferenced, resolves to a profile document that is structured data in an
[RDF 1.1 format](https://www.w3.org/TR/rdf11-concepts/). This profile document allows
people to link with others to grant access to identity resources as they see fit. WebIDs underpin
Solid and are used as a primary identifier for Users in this specification.

## Basic Flow {#basic-flow}

_This section is non-normative_

Details of the flow are available in [[!SOLID-OIDC-PRIMER]]

<figure id="fig-signature">
    <img src="sequence.mmd.svg" />
    <figcaption>Basic sequence of authenticating the user and the client.</figcaption>
</figure>

## Client Identifiers {#clientids}

OAuth and OIDC require the Client application to identify itself to the OP and RS by presenting a
[client identifier](https://tools.ietf.org/html/rfc6749#section-2.2) (Client ID). Solid applications
SHOULD use a URI that can be dereferenced as a [Client ID Document](#clientids-document).

Issue(78):

### Client ID Document {#clientids-document}

When a Client Identifier is dereferenced, the resource MUST be serialized as an `application/ld+json` document
unless content negotiation requires a different outcome.

The serialized JSON form of a Client ID Document MUST use the normative JSON-LD `@context`
provided at `https://www.w3.org/ns/solid/oidc-context.jsonld` such that the resulting
document produces a JSON serialization of an OIDC client registration, per the
definition of client registration metadata from [[!RFC7591]] section 2.

Also, the OP MUST dereference the Client ID Document and match any Client-supplied parameters
with the values in the Client ID Document.

Further, the `redirect_uri` provided by the Client MUST be included in the registration `redirect_uris`
list.

This example uses [JSON-LD ](https://www.w3.org/TR/json-ld/) for the Client ID Document:

<div class="example">
<p>https://app.example/id</p>

```jsonld
{
          "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"],
          "client_id": "https://app.example/id",
          "client_name": "Solid Application Name",
          "redirect_uris": ["https://app.example/callback"],
          "post_logout_redirect_uris": ["https://app.example/logout"],
          "client_uri": "https://app.example/",
          "logo_uri" : "https://app.example/logo.png",
          "tos_uri" : "https://app.example/tos.html",
          "scope" : "openid profile offline_access webid",
          "grant_types" : ["refresh_token","authorization_code"],
          "response_types" : ["code"],
          "default_max_age" : 3600,
          "require_auth_time" : true
        }
```

</div>

Issue(95):

#### JSON-LD context {#jsonld-context}

This specification defines a JSON-LD context for use with OIDC Client ID Documents. This context is
available at `https://www.w3.org/ns/solid/oidc-context.jsonld`. Client ID Documents that reference
this JSON-LD context MUST use the HTTPS scheme.

NOTE: the [Solid-OIDC Vocabulary](https://www.w3.org/ns/solid/oidc) that is part of this context uses the HTTP scheme.

Full content of JSON-LD context can be also seen in [[#full-jsonld-context]]

### OIDC Registration {#clientids-oidc}

For non-dereferencable identifiers, the Client MUST present a `client_id` value that has been
registered with the OP via either OIDC dynamic or static registration.
See also [[!OIDC-DYNAMIC-CLIENT-REGISTRATION]].

When requesting Dynamic Client Registration, the Client MUST specify the `scope` in the metadata
and include `webid` in its value (space-separated list).

<div class="example">

```jsonld {9}
{
          "client_name": "S-C-A Browser Demo Client App",
          "application_type": "web",
          "redirect_uris": [
            "https://dynamic-client.example/auth"
          ],
          "subject_type": "pairwise",
          "token_endpoint_auth_method": "client_secret_basic",
          "scope" : "openid profile offline_access webid"
        }
```

</div>

## WebID Profile {#webid-profile}

Dereferencing the WebID URL results in a WebID Profile.

Issue(76):

### OIDC Issuer Discovery {#oidc-issuer-discovery}

A WebID Profile lists the OpenID Providers who are trusted to issue tokens on behalf
of the agent who controls the WebID. This prevents a malicious OpenID Provider from issuing
otherwise valid ID Tokens for arbitrary WebIDs. An entity that verifies ID Tokens will use this
mechanism to determine if the issuer is authoritative for the given WebID.

<figure class="example">

```turtle
PREFIX solid: <http://www.w3.org/ns/solid/terms#>
      <#id> solid:oidcIssuer <https://oidc.example> .
```

<figcaption>WebID Profile specifying an OIDC issuer</figcaption>
</figure>

To discover a list of valid issuers, the WebID Profile MUST be checked for the existence of statements matching

```sparql
?webid <http://www.w3.org/ns/solid/terms#oidcIssuer> ?iss .
```

where `?webid` is set to WebID. The `?iss` will result in an IRI denoting valid issuer for that WebID.
The WebID Profile Document MUST include one or more statements matching the OIDC issuer pattern.

Issue(80):

Issue(92):

Issue(91):

#### OIDC Issuer Discovery via Link Headers {#oidc-issuer-discovery-link-headers}

A server hosting a WebID Profile Document MAY transmit the `http://www.w3.org/ns/solid/terms#oidcIssuer`
values via Link Headers, but they MUST be the same as in the RDF representation.
A client MUST treat the RDF in the body of the WebID Profile as canonical
but MAY use the Link Header values as an optimization.

<figure class="example">

```http
Link: <https://oidc.example>;
              rel="http://www.w3.org/ns/solid/terms#oidcIssuer";
              anchor="#id"
```

<figcaption>HTTP response Link Header (line breaks added for readibility)</figcaption>
</figure>

## Requesting the WebID Claim using a Scope Value {#webid-scope}

Solid-OIDC uses scope values, as defined in [[!RFC6749]] Section 3.3 and [[!OIDC-CORE]] Section 5.4 to specify
what information is made available as Claim Values.

Solid-OIDC defines the following `scope` value for use with claim requests:

<dl>
<dt>*webid*</dt>
<dd>
    <p>A list of {{ModelContextOptions/tools}} to register with the browser. Each tool name in the list is expected to be unique.</p>
</dd>
</dl>

#### ModelContextTool Dictionary {#model-context-tool}

The {{ModelContextTool}} dictionary describes a tool that can be invoked by \[=agents=].

The OP MUST include the `iss` query parameter alongside the authorization code when redirecting the user agent back to the Client's redirect_uri.
The value of the `iss` parameter MUST be the Issuer Identifier of the OP, as defined in [[OIDC-CORE]].

<figure class="example">

```http
HTTP/1.1 302 Found
Location: https://client.example.com/callback?
                                        code=n0esc392ae491076
                                        &state=af0ifjsldkj
                                        &iss=https%3A%2F%2Fidp.example.com
```

<figcaption>Example Authorization Response including the `iss` query parameter</figcaption>
</figure>

The {{ToolAnnotations}} dictionary provides optional metadata about a tool:

- The Client MUST check for the presence of the `iss` parameter.
- The Client MUST verify that the `iss` value matches the Issuer Identifier of the OP to which the authorization request was sent.

#### ModelContextClient Interface {#model-context-client}

The {{ModelContextClient}} interface represents an \[=agent=] executing a tool provided by the site through the {{ModelContext}} API.

Assuming one of the following options

- Client ID and Secret, and valid DPoP Proof (for dynamic and static registration)
- Dereferencable Client Identifier with a proper Client ID Document and valid DPoP Proof (for a Solid client identifier)

the OP MUST return A DPoP-bound OIDC ID Token.

### DPoP-bound OIDC ID Token {#tokens-id}

When requesting a DPoP-bound OIDC ID Token, the Client MUST send a DPoP proof JWT
that is valid according to the [[DPOP#section-5]]. The DPoP proof JWT is used to
bind the OIDC ID Token to a public key. See also: [[!DPOP]].

With the `webid` scope, the DPoP-bound OIDC ID Token payload MUST contain these claims:

- `webid` — The WebID claim MUST be the user's WebID.
- `iss` — The issuer claim MUST be a valid URL of the OP
  instantiating this token.
- `aud` — The audience claim MUST be an array of values.
  The values MUST include the authorized party claim `azp`
  and the string `solid`.
  In the decentralized world
  of Solid-OIDC, the audience of an ID Token is not only the client (`azp`),
  but also any Solid Authorization Server at any accessible address
  on the world wide web (`solid`). See also: [[RFC7519#section-4.1.3]].
- `azp` - The authorized party claim is used to identify the client
  (See also: [section 5. Client Identifiers](#clientids)).
- `iat` — The issued-at claim is the time at which the DPoP-bound
  OIDC ID Token was issued.
- `exp` — The expiration claim is the time at which the DPoP-bound
  OIDC ID Token becomes invalid.
- `cnf` — The confirmation claim is used to identify the DPoP Public
  Key bound to the OIDC ID Token. See also: [[DPOP#section-7]].

<div class="example">
<p>An example OIDC ID Token:</p>

```json
{
  "webid": "https://janedoe.com/web#id",
  "iss": "https://idp.example.com",
  "sub": "janedoe",
  "aud": ["https://client.example.com/client_id", "solid"],
  "azp": "https://client.example.com/client_id",
  "iat": 1311280970,
  "exp": 1311281970,
  "cnf": {
    "jkt": "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I"
  }
}
```

</div>

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

The Verifying party MUST perform [[#oidc-issuer-discovery]] using the value of the `webid` claim
to dereference the WebID Profile Document.

Unless the verifying party acquires OP keys through some other means, or it chooses to reject tokens issued by this OP,
the verifying party MUST follow OpenID Connect Discovery 1.0 [[!OIDC-DISCOVERY]] to find an OP's signing keys (JWK).

## Resource Access {#resource}

### Authorization Server Discovery {#authorization-server-discovery}

When a Client performs an unauthenticated request to a protected resource,
the Resource Server MUST respond with the HTTP <code>401</code> status code,
and a <code>WWW-Authenticate</code> HTTP header. See also: [[RFC9110]](11.6.1. WWW-Authenticate)

The <code>WWW-Authenticate</code> HTTP header MUST include an <code>as_uri</code>
parameter unless the authentication scheme requires a different mechanism
for discovering an associated authorization server.

Authorization Servers SHOULD implement User-Managed Access (UMA) 2.0 Grant for
OAuth 2.0 Authorization [[!UMA]].

### Obtaining an Access Token {#obtaining-access-token}

For Authorization Servers that conform to [[!UMA]], the <code>http://openid.net/specs/openid-connect-core-1\_0.html#IDToken</code> profile MUST
be supported. This profile MUST be advertised in the <code>uma_profiles_supported</code>
metadata of the Authorization Server discovery document [[UMA#rfc.section.2]].

When using the <code>http://openid.net/specs/openid-connect-core-1\_0.html#IDToken</code>
profile with an UMA-based Authorization Server, the Authorization Server MUST be capable
of exchanging a valid Solid-OIDC ID Token [[#tokens-id]] for an OAuth 2.0 Access Token.

Note: Clients can push additional claims by requesting an upgraded RPT [[UMA#rfc.section.3.3.1]]

Authorization Server MUST pefrom [[#dpop-validation]] and [[#id-token-validation]]

### DPoP Validation {#dpop-validation}

A DPoP Proof that is valid according to
[DPoP Internet-Draft, Section 4.3](https://tools.ietf.org/html/draft-ietf-oauth-dpop-04#section-4.3),
MUST be present when a DPoP-bound OIDC ID Token is used.

The DPoP-bound OIDC ID Token MUST be validated according to
[DPoP Internet-Draft, Section 6](https://tools.ietf.org/html/draft-ietf-oauth-dpop-04#section-6),
but the AS MAY perform additional verification in order to determine whether to grant access to the
requested resource.

## Solid-OIDC Conformance Discovery {#discovery}

An OpenID Provider that conforms to the Solid-OIDC specification MUST advertise it in the OpenID Connect
Discovery 1.0 [[!OIDC-DISCOVERY]] resource by including `webid` in its `scopes_supported` metadata property.

<div class="example">

```json
{
  "scopes_supported": ["openid", "offline_access", "webid"]
}
```

</div>

## Security Considerations {#security}

_This section is non-normative_

As this specification builds upon existing web standards, security considerations from OAuth, OIDC,
PKCE, and the DPoP specifications may also apply unless otherwise indicated. The following
considerations should be reviewed by implementors and system/s architects of this specification.

Some of the references within this specification point to documents with a
Living Standard or Draft status, meaning their contents can still change over
time. It is advised to monitor these documents, as such changes might have
security implications.

In addition to above considerations, implementors should consider the Security
Considerations in context of the Solid Protocol [[!SOLID-PROTOCOL]].

### TLS Requirements {#security-tls}

All TLS requirements outlined in [[BCP195]] apply to this
specification.

All tokens, Client, and User credentials MUST only be transmitted over TLS.

### Client IDs {#security-client-ids}

An AS SHOULD assign a fixed set of low trust policies to any client identified as anonymous.

Implementors SHOULD expire ephemeral Client IDs that are kept in server storage to mitigate the
potential for a bad actor to fill server storage with unexpired or otherwise useless Client IDs.

### Client Secrets {#security-client-secrets}

Client secrets SHOULD NOT be stored in browser local storage. Doing so will increase the risk of
data leaks should an attacker gain access to Client credentials.

### Client Trust {#security-client-trust}

_This section is non-normative_

Clients are ephemeral, client registration is optional, and most Clients cannot keep secrets. These,
among other factors, are what makes Client trust challenging.

## Privacy Considerations {#privacy}

### OIDC ID Token Reuse {#privacy-token-reuse}

_This section is non-normative_

With JWTs being extendable by design, there is potential for a privacy breach if OIDC ID Tokens get
reused across multiple authorization servers. It is not unimaginable that a custom claim is added to the
OIDC ID Token on instantiation. This addition may unintentionally give other authorization servers
consuming the OIDC ID Token information about the user that they may not wish to share outside of the
intended AS.

## Acknowledgments {#acknowledgments}

_This section is non-normative_

The Solid Community Group would like to thank the following individuals for reviewing and providing
feedback on the specification (in alphabetical order):

Tim Berners-Lee, Justin Bingham, Sarven Capadisli, Aaron Coburn, Matthias Evering, Jamie Fiedler,
Michiel de Jong, Ted Thibodeau Jr, Kjetil Kjernsmo, Mitzi László, Pat McBennett, Adam Migus, Jackson Morgan, Davi
Ottenheimer, Justin Richer, severin-dsr, Henry Story, Michael Thornburgh, Emmet Townsend, Ruben
Verborgh, Ricky White, Paul Worrall, Dmitri Zagidulin.

## Appendix A: Full JSON-LD context {#full-jsonld-context}

The JSON-LD context is defined as:

```jsonld
{
    "@context": {
      "@version": 1.1,
      "@protected": true,
      "oidc": "http://www.w3.org/ns/solid/oidc#",
      "xsd": "http://www.w3.org/2001/XMLSchema#",
      "client_id": {
        "@id": "@id",
        "@type": "@id"
      },
      "client_uri": {
        "@id": "oidc:client_uri",
        "@type": "@id"
      },
      "logo_uri": {
        "@id": "oidc:logo_uri",
        "@type": "@id"
      },
      "policy_uri": {
        "@id": "oidc:policy_uri",
        "@type": "@id"
      },
      "tos_uri": {
        "@id": "oidc:tos_uri",
        "@type": "@id"
      },
      "redirect_uris": {
        "@id": "oidc:redirect_uris",
        "@type": "@id",
        "@container": [
          "@id",
          "@set"
        ]
      },
      "require_auth_time": {
        "@id": "oidc:require_auth_time",
        "@type": "xsd:boolean"
      },
      "default_max_age": {
        "@id": "oidc:default_max_age",
        "@type": "xsd:integer"
      },
      "application_type": {
        "@id": "oidc:application_type"
      },
      "client_name": {
        "@id": "oidc:client_name"
      },
      "contacts": {
        "@id": "oidc:contacts"
      },
      "grant_types": {
        "@id": "oidc:grant_types"
      },
      "response_types": {
        "@id": "oidc:response_types"
      },
      "scope": {
        "@id": "oidc:scope"
      },
      "token_endpoint_auth_method": {
        "@id": "oidc:token_endpoint_auth_method"
      }
    }
  }
```

:::include ./includes/status.md:::
:::include ./includes/conformance.md:::
