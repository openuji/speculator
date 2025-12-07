/**
 * AST Runtime Validation
 * 
 * Validates AST nodes against spec-ast.schema.json using Ajv.
 * Supports two validation modes:
 * - semantic: Rejects computed fields (for indexers, parsers)
 * - full: Accepts computed fields (for final output)
 */

import { Ajv } from 'ajv';
import type { ValidateFunction, ErrorObject } from 'ajv';
import ajvFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Schema path resolution
const SCHEMA_PATH = path.resolve(__dirname, '../../schema/spec-ast.schema.json');

/**
 * Validation mode determines whether computed fields are allowed
 */
export type ValidationMode = 'semantic' | 'full';

/**
 * Validation result with typed errors
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Structured validation error
 */
export interface ValidationError {
    path: string;
    message: string;
    keyword: string;
    params: Record<string, unknown>;
}

/**
 * AST Validator class
 * 
 * Usage:
 * ```typescript
 * const validator = new ASTValidator();
 * 
 * // Validate semantic AST (rejects computed fields)
 * const result = validator.validate(ast, 'semantic');
 * 
 * // Validate full AST (allows computed fields)
 * const result = validator.validate(ast, 'full');
 * ```
 */
export class ASTValidator {
    private ajv: Ajv;
    private validateFn: ValidateFunction | null = null;
    private schemaLoaded = false;

    constructor() {
        this.ajv = new Ajv({
            allErrors: true,
            verbose: true,
            strict: true,
        });
        (ajvFormats as any)(this.ajv);
    }

    /**
     * Lazily load and compile the schema
     */
    private ensureSchemaLoaded(): void {
        if (this.schemaLoaded) return;

        const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
        const schema = JSON.parse(schemaContent);

        this.validateFn = this.ajv.compile(schema);
        this.schemaLoaded = true;
    }

    /**
     * Validate an AST node against the schema
     * 
     * @param ast - The AST node to validate
     * @param mode - Validation mode: 'semantic' or 'full'
     * @returns Validation result with errors if invalid
     */
    validate(ast: unknown, mode: ValidationMode = 'semantic'): ValidationResult {
        this.ensureSchemaLoaded();

        if (!this.validateFn) {
            throw new Error('Schema not loaded');
        }

        // For semantic mode, check if computed fields are present and reject
        if (mode === 'semantic' && typeof ast === 'object' && ast !== null) {
            const computedCheck = this.checkForComputedFields(ast);
            if (!computedCheck.valid) {
                return computedCheck;
            }
        }

        const valid = this.validateFn(ast);

        if (valid) {
            return { valid: true, errors: [] };
        }

        return {
            valid: false,
            errors: this.formatErrors(this.validateFn.errors || []),
        };
    }

    /**
     * Check for presence of computed fields in semantic mode
     */
    private checkForComputedFields(ast: object): ValidationResult {
        const doc = ast as Record<string, unknown>;

        if ('computed' in doc && doc.computed !== undefined && doc.computed !== null) {
            const computedFields = doc.computed as Record<string, unknown>;
            const presentFields = Object.keys(computedFields).filter(
                (key) => computedFields[key] !== undefined
            );

            if (presentFields.length > 0) {
                return {
                    valid: false,
                    errors: [{
                        path: '/computed',
                        message: `Computed fields not allowed in semantic mode: ${presentFields.join(', ')}`,
                        keyword: 'x-computed',
                        params: { fields: presentFields },
                    }],
                };
            }
        }

        return { valid: true, errors: [] };
    }

    /**
     * Format Ajv errors into structured ValidationErrors
     */
    private formatErrors(errors: ErrorObject[]): ValidationError[] {
        return errors.map((error) => ({
            path: error.instancePath || '/',
            message: error.message || 'Unknown validation error',
            keyword: error.keyword,
            params: error.params,
        }));
    }

    /**
     * Validate at a specific pipeline stage
     * 
     * @param ast - The AST to validate
     * @param stage - Pipeline stage name
     * @param allowComputed - Whether computed fields are allowed
     */
    validateAtStage(
        ast: unknown,
        stage: 'parse' | 'transform' | 'resolve' | 'index' | 'compute' | 'render',
        allowComputed = false
    ): ValidationResult {
        const mode: ValidationMode = allowComputed || stage === 'compute' || stage === 'render'
            ? 'full'
            : 'semantic';

        const result = this.validate(ast, mode);

        if (!result.valid) {
            console.error(`Validation failed at ${stage} stage:`, result.errors);
        }

        return result;
    }
}

/**
 * Singleton validator instance for convenience
 */
let defaultValidator: ASTValidator | null = null;

export function getValidator(): ASTValidator {
    if (!defaultValidator) {
        defaultValidator = new ASTValidator();
    }
    return defaultValidator;
}

/**
 * Quick validation helper
 */
export function validateAST(ast: unknown, mode: ValidationMode = 'semantic'): ValidationResult {
    return getValidator().validate(ast, mode);
}

/**
 * Assertion-style validation (throws on failure)
 */
export function assertValidAST(ast: unknown, mode: ValidationMode = 'semantic'): void {
    const result = validateAST(ast, mode);
    if (!result.valid) {
        const errorMessage = result.errors
            .map((e) => `${e.path}: ${e.message}`)
            .join('\n');
        throw new Error(`Invalid AST:\n${errorMessage}`);
    }
}
