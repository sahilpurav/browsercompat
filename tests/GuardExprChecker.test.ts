import GuardExprChecker, {GuardExprChain, GuardExpression} from "../src/GuardExprChecker";
import TestTSCompilerHost from "./TestTSCompilerHost";

import * as ts from "typescript";

const _declarationCode: string = `
    class A { x; y; static w; }
    class B { p:A; q:A; }
    let C;
    function D() {}
    let _A: A;
    let _B: B;
`;

const _compilerHost: TestTSCompilerHost = new TestTSCompilerHost(
    {
        alwaysStrict: true,
        target: ts.ScriptTarget.Latest,
        noLib: true,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
);

class EvaluateOutput {
    public readonly operand: string;
    public readonly symbol: string | null;
    public readonly resolveTarget: string | null;
    public readonly isNegated: boolean;

    public constructor(
        operand: string, symbol: string | null, resolveTarget: string | null, isNegated: boolean)
    {
        this.operand = operand;
        this.symbol = symbol;
        this.resolveTarget = resolveTarget;
        this.isNegated = isNegated;
    }

    public static fromGuardExpression(guard: GuardExpression): EvaluateOutput {
        const symbolName = (guard.guardedSymbol === null) ? null : guard.guardedSymbol.name;
        const target = guard.getSymbolResolveTarget();
        const targetName = (target === null) ? null : target.getText();
        return new EvaluateOutput(guard.operand.getText(), symbolName, targetName, guard.isNegated);
    }
}

class EvaluateChainOutput {
    public readonly items: readonly EvaluateOutput[];
    public readonly isSingle: boolean;
    public readonly isOr: boolean;
    public readonly isNegated: boolean;

    public constructor(items: readonly EvaluateOutput[], isSingle: boolean, isOr: boolean, isNegated: boolean) {
        this.items = items;
        this.isSingle = isSingle;
        this.isOr = isOr;
        this.isNegated = isNegated;
    }

    public static fromGuardExprOrChain(chain: GuardExpression | GuardExprChain): EvaluateChainOutput {
        if (chain instanceof GuardExpression) {
            return new EvaluateChainOutput([EvaluateOutput.fromGuardExpression(chain)], true, false, false);
        }
        else {
            return new EvaluateChainOutput(
                chain.expressions.map(EvaluateOutput.fromGuardExpression),
                false,
                chain.operator === ts.SyntaxKind.BarBarToken,
                chain.isNegated,
            );
        }
    }
}

function testEvaluate(exprString: string, mustBePosOrNeg: boolean | null = null): EvaluateOutput {
    const source: string = _declarationCode + exprString + ";\n";
    _compilerHost.setSource(source);

    const program: ts.Program = _compilerHost.createProgram();

    const guardExprChecker: GuardExprChecker = new GuardExprChecker(program.getTypeChecker());
    const statements = _compilerHost.getMainSourceFile().statements;
    const lastExpr: ts.Statement = statements[statements.length - 1];
    if (!ts.isExpressionStatement(lastExpr)) {
        throw new Error(`Invalid expression string: ${exprString}`);
    }

    const out = EvaluateOutput.fromGuardExpression(guardExprChecker.evaluate(lastExpr.expression, mustBePosOrNeg));

    if (exprString.indexOf(out.operand) === -1) {
        throw new Error(`Guard expression operand must be a descendant of the input expression.\n-- Input: ${exprString}\n-- Operand: ${out.operand}\n`);
    }

    return out;
}

function testEvaluateChain(exprString: string): EvaluateChainOutput {
    const source: string = _declarationCode + exprString + ";\n";
    _compilerHost.setSource(source);

    const program: ts.Program = _compilerHost.createProgram();

    const guardExprChecker: GuardExprChecker = new GuardExprChecker(program.getTypeChecker());
    const statements = _compilerHost.getMainSourceFile().statements;
    const lastExpr: ts.Statement = statements[statements.length - 1];
    if (!ts.isExpressionStatement(lastExpr)) {
        throw new Error(`Invalid expression string: ${exprString}`);
    }

    return EvaluateChainOutput.fromGuardExprOrChain(guardExprChecker.evaluateChain(lastExpr.expression));
}

test("GuardExprChecker.evaluate", () => {
    // Identifiers - successful cases

    expect(testEvaluate("typeof(A) !== 'undefined'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) != 'undefined'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(B) !== 'undefined'")).toEqual({operand: "B", symbol: "B", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(C) !== 'undefined'")).toEqual({operand: "C", symbol: "C", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(D) !== 'undefined'")).toEqual({operand: "D", symbol: "D", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) === 'undefined'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});
    expect(testEvaluate("typeof(((A))) !== 'undefined'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("'undefined' !== typeof(A)")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("'undefined' === typeof(A)")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});
    expect(testEvaluate("'undefined' == typeof(A)")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});
    expect(testEvaluate("((('undefined')) !== (((typeof (((C)))))))")).toEqual({operand: "C", symbol: "C", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) === 'object'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) == 'object'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) === 'function'")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("!(typeof(A) === 'undefined')")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("!!(typeof(A) === 'undefined')")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});
    expect(testEvaluate("!(typeof(A) !== 'undefined')")).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});
    expect(testEvaluate("typeof(A) !== 'undefined'", true)).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: false});
    expect(testEvaluate("typeof(A) === 'undefined'", false)).toEqual({operand: "A", symbol: "A", resolveTarget: null, isNegated: true});

    // Undeclared symbol.
    expect(testEvaluate("typeof(a) !== 'undefined'")).toMatchObject({operand: "a", symbol: null});

    // Not allowed (simple identifiers must use typeof)
    expect(testEvaluate("A !== undefined")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A === undefined")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A != undefined")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A == undefined")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A != undefined")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A == null")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("A")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("!A")).toMatchObject({operand: "A", symbol: null});
    expect(testEvaluate("!!A")).toMatchObject({operand: "A", symbol: null});

    // Not a valid negative guard.
    expect(testEvaluate("typeof(A) !== 'object'")).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(A) !== 'function'")).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(A) !== 'string'")).toMatchObject({symbol: null});

    // mustBePosOrNeg does not match.
    expect(testEvaluate("typeof(A) !== 'undefined'", false)).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(A) === 'undefined'", true)).toMatchObject({symbol: null});

    // Properties
    expect(testEvaluate("_A.x"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.y"))
        .toEqual({operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_B.p"))
        .toEqual({operand: "_B.p", symbol: "p", resolveTarget: "_B", isNegated: false});
    expect(testEvaluate("_B.q"))
        .toEqual({operand: "_B.q", symbol: "q", resolveTarget: "_B", isNegated: false});
    expect(testEvaluate("A.w"))
        .toEqual({operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: false});
    expect(testEvaluate("!_A.x"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("!!_A.x"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("(((_A)).x)"))
        .toEqual({operand: "((_A)).x", symbol: "x", resolveTarget: "((_A))", isNegated: false});
    expect(testEvaluate("((!((!((_A).y)))))"))
        .toEqual({operand: "(_A).y", symbol: "y", resolveTarget: "(_A)", isNegated: false});
    expect(testEvaluate("_A.x !== undefined"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.x != undefined"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("(_A.x) !== (undefined)"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.y === undefined"))
        .toEqual({operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("_A.y == undefined"))
        .toEqual({operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("undefined !== _A.y"))
        .toEqual({operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("undefined === _A.x"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("_A.x != undefined"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.x == undefined"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("_A.x != null"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.x == null"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("typeof(_A.x) !== 'undefined'"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("typeof(_A.x) === 'undefined'"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("typeof(_A.x) === 'object'"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("'undefined' !== typeof(_A.x)"))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("'x' in _A"))
        .toEqual({operand: "'x' in _A", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("!('x' in _A)"))
        .toEqual({operand: "'x' in _A", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("!((!((('x')) in (_A))))"))
        .toEqual({operand: "(('x')) in (_A)", symbol: "x", resolveTarget: "(_A)", isNegated: false});
    expect(testEvaluate("'w' in A"))
        .toEqual({operand: "'w' in A", symbol: "w", resolveTarget: "A", isNegated: false});

    expect(testEvaluate("A.prototype.x"))
        .toEqual({operand: "A.prototype.x", symbol: "x", resolveTarget: "A.prototype", isNegated: false});
    expect(testEvaluate("'x' in A.prototype"))
        .toEqual({operand: "'x' in A.prototype", symbol: "x", resolveTarget: "A.prototype", isNegated: false});
    expect(testEvaluate("typeof(A.prototype.x) === 'undefined'"))
        .toEqual({operand: "A.prototype.x", symbol: "x", resolveTarget: "A.prototype", isNegated: true});
    expect(testEvaluate("_B.p.x"))
        .toEqual({operand: "_B.p.x", symbol: "x", resolveTarget: "_B.p", isNegated: false});
    expect(testEvaluate("(!(((_B).q).x))"))
        .toEqual({operand: "((_B).q).x", symbol: "x", resolveTarget: "((_B).q)", isNegated: true});
    expect(testEvaluate("typeof(_B.q.y) !== 'undefined'"))
        .toEqual({operand: "_B.q.y", symbol: "y", resolveTarget: "_B.q", isNegated: false});
    expect(testEvaluate("(new A()).x"))
        .toEqual({operand: "(new A()).x", symbol: "x", resolveTarget: "(new A())", isNegated: false});
    expect(testEvaluate("null == (new B()).p.y"))
        .toEqual({operand: "(new B()).p.y", symbol: "y", resolveTarget: "(new B()).p", isNegated: true});

    // Properties - with mustBePosOrNeg argument.
    expect(testEvaluate("_A.x", true))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("!_A.x", false))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("_A.x !== undefined", true))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("_A.x === undefined", false))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("typeof(_A.x) === 'object'", true))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("typeof(_A.x) === 'undefined'", false))
        .toEqual({operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true});
    expect(testEvaluate("'x' in _A", true))
        .toEqual({operand: "'x' in _A", symbol: "x", resolveTarget: "_A", isNegated: false});
    expect(testEvaluate("!('x' in _A)", false))
        .toEqual({operand: "'x' in _A", symbol: "x", resolveTarget: "_A", isNegated: true});

    // properties - Undeclared symbols
    expect(testEvaluate("_A.z")).toMatchObject({operand: "_A.z", symbol: null});
    expect(testEvaluate("_A.x.x")).toMatchObject({operand: "_A.x.x", symbol: null});
    expect(testEvaluate("!_A.w")).toMatchObject({operand: "_A.w", symbol: null});
    expect(testEvaluate("typeof(A.x) !== 'undefined'")).toMatchObject({operand: "A.x", symbol: null});
    expect(testEvaluate("A.prototype.z")).toMatchObject({operand: "A.prototype.z", symbol: null});
    expect(testEvaluate("A.prototype.w")).toMatchObject({operand: "A.prototype.w", symbol: null});
    expect(testEvaluate("_B.r")).toMatchObject({operand: "_B.r", symbol: null});
    expect(testEvaluate("_B.q.z")).toMatchObject({operand: "_B.q.z", symbol: null});
    expect(testEvaluate("((_B.q).x).x")).toMatchObject({operand: "((_B.q).x).x", symbol: null});
    expect(testEvaluate("'w' in _A")).toMatchObject({operand: "'w' in _A", symbol: null});
    expect(testEvaluate("_A.z !== undefined")).toMatchObject({operand: "_A.z", symbol: null});
    expect(testEvaluate("_A.z != undefined")).toMatchObject({operand: "_A.z", symbol: null});

    // Properties - invalid mustBePosOrNeg argument.
    expect(testEvaluate("_A.x", false)).toMatchObject({symbol: null});
    expect(testEvaluate("!_A.x", true)).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x !== undefined", false)).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x === undefined", true)).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(_A.x) === 'object'", false)).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(_A.x) === 'undefined'", true)).toMatchObject({symbol: null});
    expect(testEvaluate("'x' in _A", false)).toMatchObject({symbol: null});
    expect(testEvaluate("!('x' in _A)", true)).toMatchObject({symbol: null});

    // Invalid equalities
    expect(testEvaluate("_A.x === null")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x !== null")).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(_A.x) !== 'object'")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x === 0")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x !== 'undefined'")).toMatchObject({symbol: null});
    expect(testEvaluate("typeof(_A.x) !== undefined")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x != _A.y")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x !== _A.y")).toMatchObject({symbol: null});

    // Chains not allowed
    expect(testEvaluate("typeof(A) !== 'undefined' && A.prototype.x")).toMatchObject({symbol: null});
    expect(testEvaluate("!_B.p || !_B.p.x || !_B.p.x.y")).toMatchObject({symbol: null});

    // Invalid expressions
    expect(testEvaluate("[]")).toMatchObject({symbol: null});
    expect(testEvaluate("123456")).toMatchObject({symbol: null});
    expect(testEvaluate("_A.x + _A.y")).toMatchObject({symbol: null});
    expect(testEvaluate("D('x' in _A)")).toMatchObject({symbol: null});

});

test("GuardExprChecker.evaluateChain", () => {

    // Single-expression chains.

    expect(testEvaluateChain("typeof(_A) !== 'undefined'")).toEqual({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "_A", symbol: "_A", resolveTarget: null, isNegated: false}],
    });
    expect(testEvaluateChain("_A.x")).toEqual({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false}],
    });
    expect(testEvaluateChain("!_A.x")).toEqual({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true}],
    });
    expect(testEvaluateChain("(!(!_A.x))")).toEqual({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false}],
    });
    expect(testEvaluateChain("'x' in _A")).toEqual({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "'x' in _A", symbol: "x", resolveTarget: "_A", isNegated: false}],
    });
    expect(testEvaluateChain("A.x")).toMatchObject({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "A.x", symbol: null}],
    });
    expect(testEvaluateChain("!A")).toMatchObject({
        isSingle: true, isOr: false, isNegated: false,
        items: [{operand: "A", symbol: null}],
    });

    expect(testEvaluateChain("typeof(A) !== 'undefined' && typeof(B) !== 'undefined'")).toEqual({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: false},
            {operand: "B", symbol: "B", resolveTarget: null, isNegated: false},
        ],
    });
    expect(testEvaluateChain("(((typeof(A) !== 'undefined')) && ((typeof(B) !== 'undefined')))")).toEqual({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: false},
            {operand: "B", symbol: "B", resolveTarget: null, isNegated: false},
        ],
    });
    expect(testEvaluateChain("typeof(A) !== 'undefined' && typeof(A.w) !== 'undefined'")).toEqual({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: false},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: false},
        ],
    });
    expect(testEvaluateChain("(typeof(_A) !== 'undefined' && (_A.x && undefined !== _A.y)) && A.w && (('q' in _B) && _B.q.x != (null) && typeof(_B) == 'string')")).toEqual({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "_A", symbol: "_A", resolveTarget: null, isNegated: false},
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: false},
            {operand: "'q' in _B", symbol: "q", resolveTarget: "_B", isNegated: false},
            {operand: "_B.q.x", symbol: "x", resolveTarget: "_B.q", isNegated: false},
            {operand: "_B", symbol: "_B", resolveTarget: null, isNegated: false},
        ],
    });

    expect(testEvaluateChain("!(_A.x && _A.y)")).toEqual({
        isSingle: false, isOr: false, isNegated: true,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
        ],
    });
    expect(testEvaluateChain("!(!(!(_A.x && (_A.y))))")).toEqual({
        isSingle: false, isOr: false, isNegated: true,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
        ],
    });

    expect(testEvaluateChain("typeof(A) === 'undefined' || typeof(B) === 'undefined'")).toEqual({
        isSingle: false, isOr: true, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: true},
            {operand: "B", symbol: "B", resolveTarget: null, isNegated: true},
        ],
    });
    expect(testEvaluateChain("(((typeof(A) === 'undefined')) || (!(typeof(B) !== 'undefined')))")).toEqual({
        isSingle: false, isOr: true, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: true},
            {operand: "B", symbol: "B", resolveTarget: null, isNegated: true},
        ],
    });
    expect(testEvaluateChain("typeof(A) === 'undefined' || typeof(A.w) === 'undefined'")).toEqual({
        isSingle: false, isOr: true, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: true},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: true},
        ],
    });
    expect(testEvaluateChain("!((!(typeof(_A) !== 'undefined') || (!_A.x || undefined === _A.y)) || !A.w || (!('q' in _B) || _B.q.x == (null) || typeof(_B) == 'undefined'))")).toEqual({
        isSingle: false, isOr: true, isNegated: true,
        items: [
            {operand: "_A", symbol: "_A", resolveTarget: null, isNegated: true},
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: true},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: true},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: true},
            {operand: "'q' in _B", symbol: "q", resolveTarget: "_B", isNegated: true},
            {operand: "_B.q.x", symbol: "x", resolveTarget: "_B.q", isNegated: true},
            {operand: "_B", symbol: "_B", resolveTarget: null, isNegated: true},
        ],
    });

    // Chains with invalid expressions.

    expect(testEvaluateChain("typeof(A) !== undefined && typeof(B) !== undefined")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {symbol: null},
            {symbol: null},
        ],
    });
    expect(testEvaluateChain("(((typeof(A) !== 'undefined')) && ((typeof(B) !== undefined)))")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "A", symbol: "A", resolveTarget: null, isNegated: false},
            {symbol: null},
        ],
    });
    expect(testEvaluateChain("A !== undefined && A.w !== undefined")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {symbol: null},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: false},
        ],
    });
    expect(testEvaluateChain("_A.x && 2099 && D() != 1 && _A.y && _A.w && _B.p")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {operand: "2099", symbol: null},
            {operand: "D() != 1", symbol: null},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
            {operand: "_A.w", symbol: null},
            {operand: "_B.p", symbol: "p", resolveTarget: "_B", isNegated: false},
        ],
    });
    expect(testEvaluateChain("!((!(typeof(_A) !== 'undefined') || (_A.x || undefined === _A.y)) || !A.w || (('y' in _A) || _B.p.x == (null) || typeof(_B) != 'string'))")).toMatchObject({
        isSingle: false, isOr: true, isNegated: true,
        items: [
            {operand: "_A", symbol: "_A", resolveTarget: null, isNegated: true},
            {symbol: null},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: true},
            {operand: "A.w", symbol: "w", resolveTarget: "A", isNegated: true},
            {symbol: null},
            {operand: "_B.p.x", symbol: "x", resolveTarget: "_B.p", isNegated: true},
            {symbol: null},
        ],
    });
    expect(testEvaluateChain("_A.x && !(_A.y && _A.z)")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {symbol: null},
        ],
    });
    expect(testEvaluateChain("!(_A.x || _A.y) || !_B.p")).toMatchObject({
        isSingle: false, isOr: true, isNegated: false,
        items: [
            {symbol: null},
            {operand: "_B.p", symbol: "p", resolveTarget: "_B", isNegated: true},
        ],
    });
    expect(testEvaluateChain("(!_A.x || !_A.y) && _B.p")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {symbol: null},
            {operand: "_B.p", symbol: "p", resolveTarget: "_B", isNegated: false},
        ],
    });
    expect(testEvaluateChain("_A.x && ((_B.q && _B.q.x) || (_B.p && _B.p.y)) && _A.y")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {symbol: null},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
        ],
    });
    expect(testEvaluateChain("_A.x && ((_B.q && _B.q.x) && (_B.p & _B.p.y)) && _A.y")).toMatchObject({
        isSingle: false, isOr: false, isNegated: false,
        items: [
            {operand: "_A.x", symbol: "x", resolveTarget: "_A", isNegated: false},
            {operand: "_B.q", symbol: "q", resolveTarget: "_B", isNegated: false},
            {operand: "_B.q.x", symbol: "x", resolveTarget: "_B.q", isNegated: false},
            {symbol: null},
            {operand: "_A.y", symbol: "y", resolveTarget: "_A", isNegated: false},
        ],
    });

});
