import {AbstractWalker} from "tslint";
import * as ts from "typescript";

import ClientCompatChecker from "./ClientCompatChecker";
import GuardExprChecker, {GuardExprChain, GuardExpression} from "./GuardExprChecker";
import Issue, {IssueKind} from "./Issue";
import IssueWithLocation from "./IssueWithLocation";
import Whitelist from "./Whitelist";

class Walker extends AbstractWalker {

    private m_typeChecker: ts.TypeChecker;
    private m_guardExprChecker: GuardExprChecker;
    private m_compatChecker: ClientCompatChecker;
    private m_whitelist: Whitelist;

    private m_visitCallback: (node: ts.Node) => void;
    private m_visitTypeNodeCallback: (node: ts.Node) => void;

    private m_issuesFound: IssueWithLocation[] = [];

    /**
     * This contains a list of symbols that are known to be defined in the
     * current scope because they were checked in the condition
     * of a conditional statement or expression. So no issues that
     * indicate that a feature is not supported (or supported under
     * certain conditions) should be reported for these symbols.
     */
    private m_guardStack: ts.Symbol[] = [];

    public constructor(
        sourceFile: ts.SourceFile,
        program: ts.Program,
        ruleName: string,
        compatChecker: ClientCompatChecker,
        whitelist: Whitelist)
    {
        super(sourceFile, ruleName, undefined);

        this.m_typeChecker = program.getTypeChecker();
        this.m_compatChecker = compatChecker;
        this.m_whitelist = whitelist;
        this.m_guardExprChecker = new GuardExprChecker(this.m_typeChecker);

        // Ensure that "this" is captured in these callbacks.
        this.m_visitCallback = x => this._visit(x);
        this.m_visitTypeNodeCallback = x => this._visitTypeNode(x);
    }

    public get issuesFound(): readonly IssueWithLocation[] {
        return this.m_issuesFound;
    }

    public walk(sourceFile: ts.SourceFile): void {
        this.m_issuesFound.length = 0;
        this.m_guardStack.length = 0;
        return sourceFile.forEachChild(this.m_visitCallback);
    }

    // tslint:disable-next-line: no-big-function mccabe-complexity
    private _visit(node: ts.Node): void {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return this._visit((node as ts.ParenthesizedExpression).expression);

            case ts.SyntaxKind.PropertyAccessExpression:
                return this._visitPropertyAccess(node as ts.PropertyAccessExpression);

            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.NewExpression:
                return this._visitCallOrNew(node as ts.CallExpression | ts.NewExpression);

            case ts.SyntaxKind.ElementAccessExpression:
                return this._visitElementAccess(node as ts.ElementAccessExpression);

            case ts.SyntaxKind.BinaryExpression:
                return this._visitBinaryExpression(node as ts.BinaryExpression);

            case ts.SyntaxKind.IfStatement:
                return this._visitIfStatement(node as ts.IfStatement);

            case ts.SyntaxKind.ConditionalExpression:
                return this._visitConditionalExpression(node as ts.ConditionalExpression);

            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.IndexSignature:
                return this._visitFunctionDecl(node as ts.FunctionLikeDeclaration | ts.IndexSignatureDeclaration);

            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.Parameter:
                return this._visitVariableDecl(node as ts.VariableLikeDeclaration);

            case ts.SyntaxKind.TypeReference:
                return this._visitTypeNode(node as ts.TypeNode);

            default:
                return node.forEachChild(this.m_visitCallback);
        }
    }

    /**
     * If a Node instance is passed, visits it. If the argument passed is null
     * or undefined, does nothing.
     * @param node A Node instance, null, or undefined.
     */
    private _visitIfDefinedAndNotNull(node: ts.Node | null | undefined) {
        if (node !== undefined && node !== null) {
            this._visit(node);
        }
    }

    /**
     * Reports issues detected for a given node.
     * @param node The node for which the issues were detected.
     * @param issues An array of detected issues to be reported.
     */
    private _reportIssues(node: ts.Node, issues: Issue[]) {
        const fileName: string = this.sourceFile.fileName;
        const start: number = node.getStart();
        const end: number = node.getEnd();
        const lc = this.sourceFile.getLineAndCharacterOfPosition(start);

        for (let i: number = 0; i < issues.length; i++) {
            this.m_issuesFound.push(new IssueWithLocation(fileName, lc.line, lc.character, issues[i]));
            this.addFailureAt(start, end - start, issues[i].getMessage());
        }
    }

    private _visitPropertyAccess(node: ts.PropertyAccessExpression): void {
        const propName: string = node.name.text;
        const targetType: ts.Type =
            this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node.expression));
        let targetSymbol: ts.Symbol | undefined;
        if (node.expression.kind === ts.SyntaxKind.Identifier) {
            targetSymbol = this.m_typeChecker.getSymbolAtLocation(node.expression);
        }

        const prop: ts.Symbol | undefined = this.m_typeChecker.getPropertyOfType(targetType, propName);
        if (prop === undefined) {
            return;
        }

        const isStatic: boolean = (targetSymbol !== undefined && (targetSymbol.flags & ts.SymbolFlags.Type) !== 0);
        let declType: ts.Type | null = this._getDeclaringType(prop);
        let checkBaseTypes: boolean = false;

        if (declType === null || !this._isTypeRecognizedByCompatChecker(declType)) {
            // If the declaring type of the property cannot be found or is not there in the
            // compatibility data, use the type of the target object. In this case, its base
            // types must also be checked.
            declType = targetType;
            checkBaseTypes = true;
        }
        if (isStatic) {
            this._checkGlobal(node.expression, targetSymbol);
        }
        this._checkPropertyOrEvent(node, declType, prop, isStatic, false, checkBaseTypes);
        return this._visit(node.expression);
    }

    /**
     * Visitor for an element access expression.
     * @param node An element access expression node.
     */
    private _visitElementAccess(node: ts.ElementAccessExpression): void {
        if (ts.isIdentifier(node.expression)) {
            const symbol: ts.Symbol | undefined = this.m_typeChecker.getSymbolAtLocation(node.expression);
            this._checkGlobal(node.expression, symbol);
        }
        else {
            this._visit(node.expression);
        }
        this._visit(node.argumentExpression);
    }

    /**
     * Visitor for a function call or new expression.
     * @param node A call or new expression node.
     */
    private _visitCallOrNew(node: ts.CallExpression | ts.NewExpression): void {
        const func: ts.Node = node.expression;
        if (ts.isIdentifier(func)) {
            this._checkGlobal(func, this.m_typeChecker.getSymbolAtLocation(func));
        }
        else {
            this._visit(func);
            if (ts.isCallExpression(node)) {
                this._checkAddEventListenerCall(node);
            }
        }

        if (node.typeArguments !== undefined) {
            node.typeArguments.forEach(this.m_visitTypeNodeCallback);
        }
        if (node.arguments !== undefined) {
            node.arguments.forEach(this.m_visitCallback);
        }
    }

    /**
     * Checks for compatibility of events in addEventListener calls. If the
     * given node does not represent a call to addEventListener, nothing is done.
     *
     * @param node A call expression node.
     */
    private _checkAddEventListenerCall(node: ts.CallExpression): void {
        if (node.arguments.length < 2) {
            return;
        }
        const func: ts.Node = node.expression;
        if (func.kind !== ts.SyntaxKind.PropertyAccessExpression) {
            return;
        }
        const propAccess = node.expression as ts.PropertyAccessExpression;
        if (propAccess.name.text !== _ADD_EVENT_LISTENER) {
            return;
        }
        const firstArg: ts.Node = node.arguments[0];
        if (firstArg.kind !== ts.SyntaxKind.StringLiteral) {
            return;
        }

        const eventName: string = (firstArg as ts.StringLiteral).text;
        const targetType: ts.Type = this.m_typeChecker.getTypeAtLocation(propAccess.expression);
        this._checkPropertyOrEvent(firstArg, targetType, eventName, false, true, true);
    }

    /**
     * Visitor for a function declaration.
     * @param node A function or index signature declaration node.
     */
    private _visitFunctionDecl(node: ts.FunctionLikeDeclaration | ts.IndexSignatureDeclaration): void {
        if (node.type !== undefined) {
            this._visitTypeNode(node.type);
        }
        if (node.decorators !== undefined) {
            node.decorators.forEach(this.m_visitCallback);
        }
        if (node.typeParameters !== undefined) {
            node.typeParameters.forEach(this.m_visitCallback);
        }
        node.parameters.forEach(this.m_visitCallback);

        if (node.kind !== ts.SyntaxKind.IndexSignature) {
            const body = (node as ts.FunctionLikeDeclaration).body;
            if (body !== undefined) {
                return this._visit(body);
            }
        }
    }

    /**
     * Visitor for a variable, property or parameter declaration.
     * @param node A variable, property or parameter declaration node.
     */
    private _visitVariableDecl(node: ts.VariableLikeDeclaration): void {
        if (node.decorators !== undefined) {
            node.decorators.forEach(this.m_visitCallback);
        }

        if ("type" in node && node.type !== undefined) {
            // Declaration has an explicit type.
            this._visitTypeNode(node.type as ts.Node);
        }
        else if (node.name.kind !== ts.SyntaxKind.ArrayBindingPattern
            && node.name.kind !== ts.SyntaxKind.ObjectBindingPattern)
        {
            // Type may be inferred.
            // Not checking binding patterns for now.
            this._checkType(this._getNodeApparentType(node), node.name);
        }

        const initializer: ts.Expression | null = _getInitializerForDeclaration(node);
        if (initializer !== null) {
            this._visit(initializer);
        }
    }

    /**
     * Visitor for a type node.
     * @param node A type node.
     */
    private _visitTypeNode(node: ts.Node): void {
        if (!ts.isTypeNode(node)) {
            return;
        }
        if (!ts.isUnionTypeNode(node) && !ts.isIntersectionTypeNode(node)) {
            // Don't recurse in _checkType, since the type node will be recursed.
            this._checkType(this._getNodeApparentType(node), node, false);
        }
        return node.forEachChild(this.m_visitTypeNodeCallback);
    }

    /**
     * Visitor for a binary operator expression.
     * @param node An expression node representing a binary operation.
     */
    private _visitBinaryExpression(node: ts.BinaryExpression): void {
        const op: ts.BinaryOperator = node.operatorToken.kind;
        if (!_canBinaryOperatorBeUsedInGuard(op)) {
            this._visit(node.left);
            this._visit(node.right);
            return;
        }

        const oldGuardStackDepth: number = this.m_guardStack.length;
        const guardExprOrChain = this.m_guardExprChecker.evaluateChain(node);
        if (guardExprOrChain instanceof GuardExpression) {
            this._visitGuardExpressionAndPushSymbol(guardExprOrChain, node);
        }
        else if (guardExprOrChain instanceof GuardExprChain) {
            this._visitGuardExprChainAndPushSymbols(guardExprOrChain, node);
        }
        this.m_guardStack.length = oldGuardStackDepth;
    }

    /**
     * Visitor for an if statement.
     * @param node A node representing an if statement.
     */
    private _visitIfStatement(node: ts.IfStatement): void {
        return this._visitIfStatementOrExpr(node.expression, node.thenStatement, node.elseStatement);
    }

    /**
     * Visitor for a conditional (?:) expression
     * @param node A node representing a conditional expression.
     */
    private _visitConditionalExpression(node: ts.ConditionalExpression): void {
        return this._visitIfStatementOrExpr(node.condition, node.whenTrue, node.whenFalse);
    }

    /**
     * Visits an if statement or conditional expression.
     *
     * @param condition The condition expression.
     * @param thenNode  The branch taken if the condition is true.
     * @param elseNode  The branch taken if the condition is false.
     */
    private _visitIfStatementOrExpr(
        condition: ts.Expression, thenNode: ts.Node, elseNode: ts.Node | undefined): void
    {
        const guardExprOrChain = this.m_guardExprChecker.evaluateChain(condition);
        const oldGuardStackDepth: number = this.m_guardStack.length;
        let guardsApplyToElse: boolean = false;

        if (guardExprOrChain instanceof GuardExpression) {
            guardsApplyToElse = guardExprOrChain.isNegated;
            this._visitGuardExpressionAndPushSymbol(guardExprOrChain, condition);
        }
        else if (guardExprOrChain instanceof GuardExprChain) {
            const isOr: boolean = (guardExprOrChain.operator === ts.SyntaxKind.BarBarToken);
            guardsApplyToElse = (guardExprOrChain.isNegated !== isOr);
            this._visitGuardExprChainAndPushSymbols(guardExprOrChain, condition);
        }

        if (guardsApplyToElse) {
            this._visitIfDefinedAndNotNull(elseNode);
            this.m_guardStack.length = oldGuardStackDepth;
            this._visit(thenNode);
        }
        else {
            this._visit(thenNode);
            this.m_guardStack.length = oldGuardStackDepth;
            this._visitIfDefinedAndNotNull(elseNode);
        }
    }

    /**
     * Visits a guard expression created from the condition of a conditional statement or
     * a logical AND/OR expression. If the guard expression guards a symbol, that symbol
     * will be pushed onto the guarded symbols stack.
     *
     * @param guardExpr  A GuardExpression instance.
     * @param sourceExpr The expression node from which the guard expression was created, used
     *                   to prevent a recursion cycle.
     */
    private _visitGuardExpressionAndPushSymbol(guardExpr: GuardExpression, sourceExpr: ts.Expression): void {
        if (guardExpr.guardedSymbol !== null) {
            this._visitIfDefinedAndNotNull(guardExpr.getSymbolResolveTarget());
            this.m_guardStack.push(guardExpr.guardedSymbol);
        }
        else if (guardExpr.operand === sourceExpr) {
            // In this case calling _visit directly may cause infinite recursion.
            return guardExpr.operand.forEachChild(this.m_visitCallback);
        }
        else {
            return this._visit(guardExpr.operand);
        }
    }

    /**
     * Visits a guard expression chain created from a binary operation chain involving
     * the logical AND or OR operator. If any of the guard expressions in the chain
     * have guarded symbols, those symbols are pushed onto the guarded symbol stack.
     *
     * @param chain      A GuardExprChain instance.
     * @param sourceExpr The expression node from which the guard expression chain was created.
     *                   Used to prevent a recursion cycle.
     */
    private _visitGuardExprChainAndPushSymbols(chain: GuardExprChain, sourceExpr: ts.Expression): void {
        for (let i: number = 0; i < chain.expressions.length; i++) {
            this._visitGuardExpressionAndPushSymbol(chain.expressions[i], sourceExpr);
        }
    }

    /**
     * Returns the apparent type of the given node.
     * @param node The expression or declaraton node whose type is to be obtained.
     */
    private _getNodeApparentType(node: ts.Node): ts.Type {
        return this.m_typeChecker.getApparentType(this.m_typeChecker.getTypeAtLocation(node));
    }

    /**
     * Gets the type that declared the given property symbol.
     * @returns The type that declared the symbol, or null if no declaring
     *          type can be found.
     * @param symbol A symbol.
     */
    private _getDeclaringType(symbol: ts.Symbol): ts.Type | null {
        if (!symbol.declarations || symbol.declarations.length === 0) {
            return null;
        }

        for (let i: number = 0; i < symbol.declarations.length; i++) {
            const declNode: ts.Node = symbol.declarations[0].parent;
            if ((declNode.kind & (ts.SyntaxKind.ClassDeclaration | ts.SyntaxKind.InterfaceDeclaration)) === 0) {
                continue;
            }
            const nameNode = (declNode as ts.ClassDeclaration | ts.InterfaceDeclaration).name;
            if (nameNode !== undefined) {
                return this.m_typeChecker.getTypeAtLocation(nameNode);
            }
        }

        return null;
    }

    /**
     * Returns true if the given type is listed in the compatibility data being
     * used by this checker.
     * @param type The type to check.
     */
    private _isTypeRecognizedByCompatChecker(type: ts.Type): boolean {
        return type.symbol && this.m_compatChecker.isGlobalRecognized(type.symbol.name);
    }

    /**
     * Checks the compatibility of a type.
     *
     * @param type     The type for which to check compatibility.
     * @param node     The node to be used as the location in the source code
     *                 at which any issues are to be reported.
     * @param recurse  If this is true, recursively check the component types of
     *                 union and intersection types and the type arguments
     *                 of generic type instantiations.
     */
    private _checkType(type: ts.Type, node: ts.Node, recurse: boolean = true): void {
        const symbol: ts.Symbol | undefined = type.symbol;
        if (symbol) {
            this._checkGlobal(node, symbol);
        }
        if (!recurse) {
            return;
        }
        if ((type.flags & ts.TypeFlags.UnionOrIntersection) !== 0) {
            return this._checkUnionOrIntersectionType(type as ts.UnionOrIntersectionType, node, recurse);
        }
        if ((type.flags & ts.TypeFlags.Object) !== 0) {
            return this._checkGenericTypeArguments(type, node, recurse);
        }
    }

    /**
     * Checks the compatibility of the component types of a union or intersection type.
     *
     * @param type     The type for which to check compatibility.
     * @param node     The node to be used as the location in the source code
     *                 at which any issues are to be reported.
     * @param recurse  If this is true, recursively check the component types of
     *                 union and intersection types and the type arguments
     *                 of generic type instantiations, if any of the component
     *                 types of "type" is itself a union/intersection/generic
     *                 instantiation.
     */
    private _checkUnionOrIntersectionType(
        type: ts.UnionOrIntersectionType, node: ts.Node, recurse: boolean = true): void
    {
        const components: readonly ts.Type[] = type.types;
        for (let i: number = 0; i < components.length; i++) {
            this._checkType(components[i], node, recurse);
        }
    }

    /**
     * Checks the compatibility of the type arguments of a generic instantiation.
     *
     * @param type     The generic instantiation type for which to check compatibility.
     *                 If this is not a generic instantiation, nothing is done.
     * @param node     The node to be used as the location in the source code
     *                 at which any issues are to be reported.
     * @param recurse  If this is true, recursively check the component types of
     *                 union and intersection types and the type arguments
     *                 of generic type instantiations, if any of the type arguments
     *                 of "type" is itself a union/intersection/generic instantiation.
     */
    private _checkGenericTypeArguments(type: ts.Type, node: ts.Node, recurse: boolean = true): void {
        const typeArgs = _getTypeArguments(type);
        if (typeArgs === null || typeArgs.length === 0) {
            return;
        }
        for (let i: number = 0; i < typeArgs.length; i++) {
            this._checkType(typeArgs[i], node, recurse);
        }
    }

    /**
     * Checks for compatibility issues with a global symbol. Any issues found will be
     * reported.
     *
     * @param node   The AST node to be used as the location for reporting any issues.
     * @param symbol The global symbol for which to check for issues.
     */
    private _checkGlobal(node: ts.Node, symbol: ts.Symbol | undefined): void {
        const issues = _tempIssueArray;
        issues.length = 0;

        const hasIssues: boolean =
               symbol !== undefined
            && !this.m_whitelist.isGlobalWhitelisted(symbol.name)
            && this.m_compatChecker.checkGlobal(symbol.name, issues)
            && _isSymbolDefinedInLibrary(symbol)
            && !this._checkEnclosingGuards(issues, symbol);

        if (hasIssues) {
            this._reportIssues(node, issues);
        }
    }

    /**
     * Checks for compatibility issues with a property or event on a type. Any issues found
     * will be reported.
     *
     * @param node            The AST node to be used as the location for reporting any issues.
     * @param type            The type that declares the property/event.
     * @param prop            The property or event to be checked for issues, either a property
     *                        symbol or a property/event name as a string.
     * @param isStatic        True if "prop" represents a static property.
     * @param isEvent         True if "prop" should be interpreted as the name of an event rather
     *                        than a property or method.
     * @param checkBaseTypes  True if the base type(s) of "type" must also be checked recursively.
     *                        Set this to true if it is not known as to on which type the actual
     *                        declaration exists.
     */
    private _checkPropertyOrEvent(
        node: ts.Node, type: ts.Type, prop: ts.Symbol | string, isStatic: boolean,
        isEvent: boolean, checkBaseTypes: boolean): void
    {
        let propSymbol: ts.Symbol | null;
        let propName: string;
        if (typeof(prop) !== "string") {
            // Property symbol is provided.
            propSymbol = prop as ts.Symbol;
            propName = propSymbol.name;
        }
        else {
            propSymbol = null;
            propName = prop as string;
        }

        const issues: Issue[] = _tempIssueArray;
        issues.length = 0;
        this._getPropertyOrEventIssues(
            type, propName, propSymbol, isStatic, isEvent, checkBaseTypes, issues);

        if (issues.length === 0) {
            return;
        }
        if (propSymbol !== null && this._checkEnclosingGuards(issues, propSymbol)) {
            return;
        }

        const nodeForError = ts.isPropertyAccessExpression(node) ? node.name : node;
        this._reportIssues(nodeForError, issues);
    }

    private _getPropertyOrEventIssues(
        type: ts.Type, propName: string, propSymbol: ts.Symbol | null,
        isStatic: boolean, isEvent: boolean, checkBaseTypes: boolean,
        issues: Issue[]): void
    {
        const typeName: string | null = _getCompatCheckerTypeName(type, isStatic);
        if (typeName === null) {
            return;
        }
        if (this.m_whitelist.isPropertyOrEventWhitelisted(typeName, propName, isEvent)) {
            return;
        }

        const oldIssuesLength: number = issues.length;
        this.m_compatChecker.checkPropertyOrEvent(typeName, propName, isEvent, issues);

        if (!_isPropertyDefinedInLibrary(propSymbol, type)) {
            issues.length = oldIssuesLength;
        }
        if (issues.length !== 0 || !checkBaseTypes) {
            return;
        }
        return this._getPropertyOrEventIssuesFromBaseTypes(
            type, propName, propSymbol, isStatic, isEvent, issues);
    }

    private _getPropertyOrEventIssuesFromBaseTypes(
        type: ts.Type, propName: string, propSymbol: ts.Symbol | null,
        isStatic: boolean, isEvent: boolean, issues: Issue[]): void
    {
        const baseTypes: ts.Type[] | undefined = type.getBaseTypes();
        if (baseTypes === undefined) {
            return;
        }
        for (let i: number = 0; i < baseTypes.length; i++) {
            this._getPropertyOrEventIssues(
                baseTypes[i], propName, propSymbol, isStatic, isEvent, true, issues);
        }
    }

    /**
     * Checks if any issues indicating the use of a potentially unsupported feature must
     * not be reported because the existence of the feature is checked using an enclosing
     * guard statement (which may be an if statement, a conditional expression or a prior
     * operand to a logical and/or expression)
     *
     * @param issues  The issues that were detected.
     * @param symbol  The symbol representing the feature associated with the issues detected.
     */
    private _checkEnclosingGuards(issues: Issue[], symbol: ts.Symbol): boolean {
        if (!_canIssuesBeSuppressedByGuards(issues)) {
            return false;
        }

        const valueDecl: ts.Declaration = symbol.valueDeclaration;
        for (let i: number = this.m_guardStack.length - 1; i >= 0; i--) {
            const stackSymbol: ts.Symbol = this.m_guardStack[i];
            if (valueDecl === stackSymbol.valueDeclaration) {
                return true;
            }
        }
        return false;
    }

}

export default Walker;

/////////////////////////////////////////////////////////////////////////////////////

const _WINDOW_TYPE: string = "Window";

const _GLOBAL_THIS_TYPE: string = "globalThis";

const _ADD_EVENT_LISTENER: string = "addEventListener";

const _tempIssueArray: Issue[] = [];

const _libraryDefinedSymbols: WeakSet<ts.Symbol> = new WeakSet<ts.Symbol>();

const _staticTypeNames: WeakMap<ts.Type, string> = new WeakMap<ts.Type, string>();

/**
 * Returns a value indicating whether the given file path is that of
 * a library file. (A library file has a file name starting with "lib."
 * and ending with ".d.ts".)
 *
 * @returns True if the given file path is of a library file, otherwise false.
 * @param path The file path.
 */
function _isLibraryFilePath(path: string): boolean {
    const fileNameStart: number = path.lastIndexOf("/") + 1;
    return path.startsWith("lib.", fileNameStart) && path.endsWith(".d.ts");
}

/**
 * Returns true if the given symbol is declared in a library file.
 * @returns True if the given symbol is declared in a library, otherwise false.
 * @param symbol A symbol.
 */
function _isSymbolDefinedInLibrary(symbol: ts.Symbol): boolean {
    if (_libraryDefinedSymbols.has(symbol)) {
        return true;
    }

    const decls = symbol.declarations;
    if (decls === undefined) {
        return false;
    }
    for (let i: number = 0; i < decls.length; i++) {
        if (_isLibraryFilePath(decls[i].getSourceFile().fileName)) {
            _libraryDefinedSymbols.add(symbol);
            return true;
        }
    }
    return false;
}

/**
 * Returns true if the given property is declared in a library file.
 *
 * @returns True if the given property is declared in a library,
 *          otherwise false.
 * @param propSymbol     A Symbol instatnce representing the property, or null.
 * @param declaringType  The type on which the property is declared. Required if
 *                       propSymbol is null, otherwise this can be set to null.
 */
function _isPropertyDefinedInLibrary(
    propSymbol: ts.Symbol | null, declaringType: ts.Type | null = null): boolean
{
    if (propSymbol !== null) {
        return _isSymbolDefinedInLibrary(propSymbol);
    }
    if (declaringType === null) {
        return false;
    }
    if (declaringType.symbol !== undefined) {
        return _isSymbolDefinedInLibrary(declaringType.symbol);
    }
    if (_isTypeOfTS36WindowGlobal(declaringType)) {
        return true;
    }
    return false;
}

/**
 * Gets the type arguments from which the given type is instantiated.
 *
 * @returns An array of type arguments, or null if the given type is not
 *          an instantiation of a generic type.
 * @param type The type for which to obtain the type arguments.
 */
function _getTypeArguments(type: ts.Type): readonly ts.Type[] | null {
   if ((type.flags & ts.TypeFlags.Object) === 0) {
       return null;
   }
   const objectType = type as ts.ObjectType;
   if ((objectType.objectFlags & ts.ObjectFlags.Reference) === 0) {
       return null;
   }
   const typeArgs = (objectType as ts.TypeReference).typeArguments;
   return (typeArgs !== undefined && typeArgs.length !== 0) ? typeArgs : null;
}

/**
 * Gets the name of the given type.
 * @returns The name of the given type, or null if the type does not have a name.
 * @param type The type whose name is to be obtained.
 */
function _getTypeName(type: ts.Type): string | null {
    return (type.symbol !== undefined) ? type.symbol.name : null;
}

/**
 * Gets the name of the given type for use with the compatibility checker.
 *
 * @returns The name of the given type that can be used with the compatibility checker.
 * @param type     The type whose name is to be returned.
 * @param isStatic Set this to true if the type is used for a static property
 *                 or method access, otherwise set this to false. Some built in
 *                 types have a different name when used for static accesses.
 */
function _getCompatCheckerTypeName(type: ts.Type, isStatic: boolean): string | null {
    if (!type.symbol) {
        // In TS >=3.6 the window global has type Window & typeof(globalThis).
        return _isTypeOfTS36WindowGlobal(type) ? _WINDOW_TYPE : null;
    }
    const rawName: string = isStatic ? _getCompatCheckerStaticTypeName(type) : type.symbol.name;
    return _fixReadonlyTypeName(rawName);
}

function _getCompatCheckerStaticTypeName(type: ts.Type) {
    let staticName: string | undefined = _staticTypeNames.get(type);
    if (staticName !== undefined) {
        return staticName;
    }
    staticName = type.symbol.name;
    if (staticName.endsWith("Constructor")) {
        staticName = staticName.substring(0, staticName.length - 11);
    }
    _staticTypeNames.set(type, staticName);
    return staticName;
}

function _fixReadonlyTypeName(typeName: string): string {
    switch (typeName) {
        case "ReadonlyArray":
            return "Array";
        case "ReadonlySet":
            return "Set";
        case "ReadonlyMap":
            return "Map";
        default:
            return typeName;
    }
}

/**
 * Checks if the given type is the type of the "window"
 * global variable in TypeScript 3.6 and later, which is
 * defined as "Window & globalThis".
 *
 * @returns True if the given type is the type of the window global,
 *          otherwise false.
 * @param type The type to check.
 */
function _isTypeOfTS36WindowGlobal(type: ts.Type): boolean {
    if ((type.flags & ts.TypeFlags.Intersection) === 0) {
        return false;
    }

    const components: ts.Type[] = (type as ts.IntersectionType).types;
    if (components.length !== 2) {
        return false;
    }

    const name1: string | null = _getTypeName(components[0]);
    const name2: string | null = _getTypeName(components[1]);
    return (name1 === _WINDOW_TYPE && name2 === _GLOBAL_THIS_TYPE)
        || (name1 === _GLOBAL_THIS_TYPE && name2 === _WINDOW_TYPE);
}

/**
 * Returns the initializer of a variable, property or parameter declaration.
 *
 * @returns The expression node representing the declaration's initializer, or
 *          null if the declaration does not have an initializer.
 * @param node A node representing a variable, property or parameter declaration.
 */
function _getInitializerForDeclaration(node: ts.VariableLikeDeclaration): ts.Expression | null {
    if (node.kind === ts.SyntaxKind.VariableDeclaration
        || node.kind === ts.SyntaxKind.PropertyDeclaration
        || node.kind === ts.SyntaxKind.Parameter)
    {
        type NodeWithInit = ts.VariableDeclaration | ts.PropertyDeclaration | ts.ParameterDeclaration;
        return (node as NodeWithInit).initializer || null;
    }
    return null;
}

/**
 * Checks if the issues in the given list can be suppressed if
 * the existence of the feature in question is checked with an
 * enclosing conditional statement/expression.
 *
 * @returns True if the given issues can be suppressed through conditional
 *          checks, otherwise false.
 * @param issues An array of Issue objects.
 */
function _canIssuesBeSuppressedByGuards(issues: Issue[]): boolean {
    for (let i: number = 0; i < issues.length; i++) {
        const issue: Issue = issues[i];
        if (issue.kind === IssueKind.NOT_SUPPORTED
            || issue.kind === IssueKind.NEEDS_PREFIX
            || issue.kind === IssueKind.NEEDS_ALT_NAME
            || issue.kind === IssueKind.NEEDS_FLAG)
        {
            return true;
        }
    }
    return false;
}

/**
 * Returns a value indicating whether a binary expression with the given operator
 * can possibly be a guard expression.
 * @returns True if a binary expression with the given operator can be a guard expression,
 *          false if it can never be a guard expression.
 * @param op A binary operator token.
 */
function _canBinaryOperatorBeUsedInGuard(op: ts.BinaryOperator): boolean {
    return op === ts.SyntaxKind.AmpersandAmpersandToken
        || op === ts.SyntaxKind.BarBarToken
        || op === ts.SyntaxKind.EqualsEqualsToken
        || op === ts.SyntaxKind.EqualsEqualsEqualsToken
        || op === ts.SyntaxKind.ExclamationEqualsToken
        || op === ts.SyntaxKind.ExclamationEqualsEqualsToken
        || op === ts.SyntaxKind.InKeyword;
}
