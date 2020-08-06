import * as ts from "typescript";

/**
 * A guard expression.
 *
 * A guard expression is an expression that can be used inside a conditional
 * statement or expression to determine whether a symbol associated with its
 * operand exists or not.
 *
 * The following expressions are positive guard expressions with operand X:
 * - X != undefined
 * - typeof(X) != "undefined"
 * - typeof(X) == type, where type is a string literal other than "undefined".
 *
 * The following expressions are negative guard expressions with operand X:
 * - X == undefined
 * - typeof(X) == "undefined"
 *
 * Any other expression is considered to be a positive guard expression
 * whose operand is equal to itself.
 *
 * In all cases, ===/!== can be used in place of ==/!=. Guard expressions are
 * also allowed to be prefixed with a single not operator, which converts a
 * positive guard expression into a negative one (and vice versa).
 */
class GuardExpression {
    /**
     * The operand of the guard expression.
     */
    public readonly operand: ts.Expression;
    /**
     * The symbol that is guarded by this guard expression, or null if there
     * is no guarded symbol.
     */
    public readonly guardedSymbol: ts.Symbol | null;
    /**
     * True if this is a negative guard expression.
     */
    public readonly isNegated: boolean;

    public constructor(operand: ts.Expression, guardedSymbol: ts.Symbol | null, isNegated: boolean) {
        this.operand = operand;
        this.guardedSymbol = guardedSymbol;
        this.isNegated = isNegated;
    }

    /**
     * Gets the expression node representing the object on which the guarded symbol
     * was resolved.
     *
     * - If the guard expression's operand is a property access, this is the object
     *   on which the property is accessed.
     * - If the operand is an "in" expression, this is the right operand of that
     *   expression.
     * - If the operand is a simple identifier, or there is no symbol guarded by this
     *   guard expression, this method returns null.
     */
    public getSymbolResolveTarget(): ts.Expression | null {
        if (this.guardedSymbol === null) {
            return null;
        }
        if (ts.isPropertyAccessExpression(this.operand)) {
            return this.operand.expression;
        }
        if (ts.isBinaryExpression(this.operand) && this.operand.operatorToken.kind === ts.SyntaxKind.InKeyword) {
            return this.operand.right;
        }
        return null;
    }
}

/**
 * A sequence of guard expressions chained using logical AND or OR operators.
 */
// tslint:disable-next-line: max-classes-per-file
class GuardExprChain {
    /**
     * An array containing the guard expressions in the chain.
     */
    public readonly expressions: readonly GuardExpression[];
    /**
     * The operator token (&& or ||) used for chaining the expressions.
     */
    public readonly operator: ts.SyntaxKind;
    /**
     * True if the chain is negated.
     */
    public readonly isNegated: boolean;

    public constructor(expressions: readonly GuardExpression[], operator: ts.SyntaxKind, isNegated: boolean) {
        this.expressions = expressions;
        this.operator = operator;
        this.isNegated = isNegated;
    }
}

// tslint:disable-next-line: max-classes-per-file
class GuardExprChecker {

    private readonly m_typeChecker: ts.TypeChecker;
    private m_operand: ts.Expression | null = null;
    private m_propertyObj: ts.Expression | null = null;
    private m_propertyName: string | null = null;
    private m_isTypeof: boolean = false;
    private m_isNegative: boolean = false;

    public constructor(typeChecker: ts.TypeChecker) {
        this.m_typeChecker = typeChecker;
    }

    /**
     * Evaluates an expression and returns a GuardExpression.
     *
     * @returns A GuardExpression created from the given expression. If the
     *          expression is a valid guard expression that guards a symbol, the
     *          symbol will be available through the guardedSymbol property of the
     *          returned object.
     *
     * @param expr           The expression to evaluate.
     * @param mustBePosOrNeg Pass a boolean value to assert that the evaluated guard
     *                       expression is positive (true) or negative (false). If this
     *                       check fails, the returned GuardExpression will not have any
     *                       resolved symbol. Pass null to skip this check.
     */
    public evaluate(expr: ts.Expression, mustBePosOrNeg: boolean | null = null): GuardExpression {
        let hasLeadingNot: boolean;
        [expr, hasLeadingNot] = _unwrapNegations(expr);

        this.m_operand = expr;
        this.m_propertyObj = null;
        this.m_propertyName = null;
        this.m_isNegative = false;
        this.m_isTypeof = false;

        if (expr.kind === ts.SyntaxKind.BinaryExpression) {
            this._evaluateBinaryExpression();
        }

        if (hasLeadingNot) {
            this.m_isNegative = !this.m_isNegative;
        }

        if (mustBePosOrNeg !== null && mustBePosOrNeg === this.m_isNegative) {
            return new GuardExpression(this.m_operand!, null, this.m_isNegative);
        }

        const operand: ts.Expression = this.m_operand!;
        if (this.m_propertyName === null && ts.isPropertyAccessExpression(operand)) {
            this.m_propertyObj = operand.expression;
            this.m_propertyName = operand.name.text;
        }

        const sym: ts.Symbol | null = this._tryResolveSymbol();
        return new GuardExpression(this.m_operand!, sym, this.m_isNegative);
    }

    /**
     * Evaluates a guard expression chain.
     *
     * @returns If the given expression is a binary operation chain involving the logical
     *          AND or OR operator, a GuardExprChain will be returned. Otherwise, returns
     *          a GuardExpression that is the result of calling the evaluate() method
     *          with the given expression.
     *
     * @param expr An expression to evaluate.
     */
    public evaluateChain(expr: ts.Expression): GuardExpression | GuardExprChain {
        let innerExpr: ts.Expression;
        let hasLeadingNot: boolean;
        [innerExpr, hasLeadingNot] = _unwrapNegations(expr);

        if (!ts.isBinaryExpression(innerExpr)) {
            return this.evaluate(expr);
        }

        const op: ts.BinaryOperator = innerExpr.operatorToken.kind;
        if (op !== ts.SyntaxKind.AmpersandAmpersandToken && op !== ts.SyntaxKind.BarBarToken) {
            return this.evaluate(expr);
        }

        const guardExprs: GuardExpression[] = [];
        this._evaluateChainOperands(innerExpr, op, guardExprs);
        return new GuardExprChain(guardExprs, op, hasLeadingNot);
    }

    private _evaluateChainOperands(expr: ts.Expression, op: ts.BinaryOperator, guardExprs: GuardExpression[]): void {
        expr = _unwrapParentheses(expr);

        if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === op) {
            this._evaluateChainOperands(expr.left, op, guardExprs);
            this._evaluateChainOperands(expr.right, op, guardExprs);
        }
        else {
            guardExprs.push(this.evaluate(expr, op === ts.SyntaxKind.AmpersandAmpersandToken));
        }
    }

    private _evaluateBinaryExpression() {
        const expr: ts.BinaryExpression = this.m_operand! as ts.BinaryExpression;
        const op: ts.BinaryOperator = expr.operatorToken.kind;
        const left: ts.Expression = _unwrapParentheses(expr.left);
        const right: ts.Expression = _unwrapParentheses(expr.right);

        if (op === ts.SyntaxKind.InKeyword && ts.isStringLiteral(left)) {
            // "prop" in X
            this.m_operand = expr;
            this.m_propertyObj = right;
            this.m_propertyName = left.text;
            return;
        }

        const isExprWithEquals: boolean = _isPositiveEqualityOperator(op);
        const isExprWithNotEquals: boolean = _isNegativeEqualityOperator(op);
        const isStrictEquality: boolean = _isStrictEqualityOperator(op);

        if (isExprWithEquals || isExprWithNotEquals) {
            this._evaluateEqualityExpression(left, right, isExprWithNotEquals, isStrictEquality);
        }
    }

    private _evaluateEqualityExpression(
        left: ts.Expression, right: ts.Expression, isNotEquals: boolean, isStrict: boolean): void
    {
        if (_isStringLiteralOrNullOrUndefined(left)) {
            const temp = left;
            left = right;
            right = temp;
        }

        if (_isUndefinedExpression(right) || (!isStrict && right.kind === ts.SyntaxKind.NullKeyword)) {
            // X ==/!= undefined, same for weak equality with null.
            this.m_operand = _unwrapParentheses(left);
            this.m_isNegative = !isNotEquals;
        }
        else if (ts.isTypeOfExpression(left) && ts.isStringLiteral(right)) {
            this._evaluateTypeofCheckExpression(left.expression, right.text, isNotEquals);
        }
    }

    private _evaluateTypeofCheckExpression(operand: ts.Expression, type: string, isNotEquals: boolean): void {
        if (type === "undefined") {
            // typeof(X) ==/!= "undefined"
            this.m_operand = _unwrapParentheses(operand);
            this.m_isNegative = !isNotEquals;
            this.m_isTypeof = true;
        }
        else if (!isNotEquals) {
            // typeof(X) == <something else> is considered to be a positive
            // guard. Note that the corresponding expression with != cannot
            // be a negative guard because X may be undefined if the expression
            // evaluates to false.
            this.m_operand = _unwrapParentheses(operand);
            this.m_isNegative = false;
            this.m_isTypeof = true;
        }
    }

    private _tryResolveSymbol(): ts.Symbol | null {
        const operand: ts.Expression = this.m_operand!;
        let resolvedSymbol: ts.Symbol | undefined;

        if (this.m_propertyName !== null) {
            const targetType: ts.Type =
                this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(this.m_propertyObj!));

            resolvedSymbol = this.m_typeChecker.getPropertyOfType(targetType, this.m_propertyName);
        }
        else if (this.m_isTypeof && ts.isIdentifier(operand)) {
            resolvedSymbol = this.m_typeChecker.getSymbolAtLocation(operand);
        }

        if (resolvedSymbol === undefined) {
            return null;
        }
        return resolvedSymbol;
    }

}

export default GuardExprChecker;
export {GuardExpression, GuardExprChain};

/**
 * Returns the innermost operand of an expression consisting of one or more
 * negation (!) operations. Also returns a value indicating whether the number
 * of negations is odd or even (indicating whether the operand is effectively
 * negated or not)
 *
 * @returns A tuple of two values. The first is the expression inside the
 *          series of negations (or the argument itself, if it is not an
 *          expression using the not operator) and the second is a boolean
 *          which is true if the number of negations is odd.
 * @param expr An expression node.
 */
function _unwrapNegations(expr: ts.Expression): readonly [ts.Expression, boolean] {
    let isNegative: boolean = false;
    while (true) {
        expr = _unwrapParentheses(expr);
        if (!ts.isPrefixUnaryExpression(expr) || expr.operator !== ts.SyntaxKind.ExclamationToken) {
            break;
        }
        isNegative = !isNegative;
        expr = expr.operand;
    }
    return [expr, isNegative];
}

/**
 * Returns the expression that is wrapped in one or more parentheses.
 * For example, if the given expression node represents (((x))), returns the
 * expression node representing x.
 *
 * @returns The expression inside the parentheses, or the argument itself
 *          if it does not represent a parenthesised expression.
 * @param expr The expression node to be unwrapped.
 */
function _unwrapParentheses(expr: ts.Expression): ts.Expression {
    while (expr.kind === ts.SyntaxKind.ParenthesizedExpression) {
        expr = (expr as ts.ParenthesizedExpression).expression;
    }
    return expr;
}

/**
 * Returns a value indicating whether the given binary operator is
 * a positive equality operator.
 * @param op An enumerated value from BinaryOperator.
 */
function _isPositiveEqualityOperator(op: ts.BinaryOperator): boolean {
    return op === ts.SyntaxKind.EqualsEqualsToken || op === ts.SyntaxKind.EqualsEqualsEqualsToken;
}

/**
 * Returns a value indicating whether the given binary operator is
 * a negative equality operator.
 * @param op An enumerated value from BinaryOperator.
 */
function _isNegativeEqualityOperator(op: ts.BinaryOperator): boolean {
    return op === ts.SyntaxKind.ExclamationEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken;
}

/**
 * Returns a value indicating whether the given binary operator is
 * a strict equality operator.
 * @param op An enumerated value from BinaryOperator.
 */
function _isStrictEqualityOperator(op: ts.BinaryOperator): boolean {
    return op === ts.SyntaxKind.EqualsEqualsEqualsToken || op === ts.SyntaxKind.ExclamationEqualsEqualsToken;
}

/**
 * Returns true if the given expression is the literal value "undefined".
 * @param expr An expression node.
 */
function _isUndefinedExpression(expr: ts.Expression): boolean {
   return expr.kind === ts.SyntaxKind.UndefinedKeyword
       || (ts.isIdentifier(expr) && expr.escapedText === "undefined");
}

/**
 * Returns true if the given expression is a string literal, or the literal
 * "null" or "undefined".
 * @param expr An expression node.
 */
function _isStringLiteralOrNullOrUndefined(expr: ts.Expression): boolean {
    if (expr.kind === ts.SyntaxKind.StringLiteral
        || expr.kind === ts.SyntaxKind.NullKeyword
        || expr.kind === ts.SyntaxKind.UndefinedKeyword)
    {
        return true;
    }
    if (ts.isIdentifier(expr)) {
        const name = expr.escapedText;
        return name === "undefined" || name === "null";
    }
    return false;
}
