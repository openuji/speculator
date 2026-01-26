# Project Rules & Constraints

This document records permanent constraints and rules that Speculator Lint must follow throughout this project.

## TypeScript Coding Standards

### 1. No `any` Policy

- **Rule**: Usage of the `any` type is strictly forbidden in the codebase.
- **Rationale**: Maintain type safety and catch errors at compile time.
- **Enforcement**: Always use proper type narrowing, type guards, or specific interfaces. If a type is unknown, use `unknown` and narrow it.

## Architectural Constraints

### 1. Zero-Knowledge Runner

- The `rule-runner.ts` must remain a domain-agnostic driver. Logic specific to Speculator must live in the rules or helpers.
