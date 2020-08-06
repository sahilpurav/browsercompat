import {
    IOptions,
    IRuleMetadata,
    RuleFailure,
    Rules,
    Utils as TSLintUtils,
} from "tslint";

import {
    Program,
    SourceFile,
} from "typescript";

import ClientCompatChecker from "./ClientCompatChecker";
import ClientCompatCheckerFlags from "./ClientCompatCheckerFlags";
import ClientInfo from "./ClientInfo";
import CompatData from "./CompatData";
import IssueWithLocation from "./IssueWithLocation";
import Version from "./Version";
import Walker from "./Walker";
import Whitelist from "./Whitelist";

export class Rule extends Rules.TypedRule {

    public static metadata: IRuleMetadata = {
        ruleName: "supported-browsers",
        type: "functionality",
        typescriptOnly: false,
        requiresTypeInfo: true,
        description: "Checks code for possible compatibility issues with a given list of browsers.",
        descriptionDetails: TSLintUtils.dedent`
            This rule checks TypeScript code for compatibility issues with a list
            of target browsers which the code is intended to be able to run on.
            It will report an error if any type, function, property or event
            (passed as the first argument of an addEventListener call) used
            in the code is not supported on any of the target browsers.

            This rule can also be used on JavaScript code, if type information
            is available from JSDoc comments.

            This rule uses compatibility data provided by MDN. It requires the Node module
            "mdn-browser-compat-data" to be installed.

            Errors reported by the checker can be suppressed either by whitelisting
            the feature for which the error is reported (see the "whitelist"
            configuration option) or by using conditional statements to check for
            the existence of the feature before it is used. Some supported conditional
            statements are:

            * if (typeof(A) !== "undefined") { A(); }
            * if (typeof(A) === "function") { A(); }
            * if (typeof(A) !== "undefined" && A.x) { A.x(); }
            * if (typeof(A) === "object" && A.x) { A.x(); }
            * if (typeof(A) !== "undefined" && A.x && A.x.y) { A.x.y(); }
            * if (A.x) { A.x(); /* if A exists */ }
            * if (T.prototype.x) { instanceOfT.x(); }
            * (typeof(A) !== "undefined") ? A() : something_else;
            * (typeof(A) !== "undefined" && A.x) ? A.x() : something_else;
            * A.x ? A.x() : something_else; /* if A exists */
            * typeof(A) !== "undefined" && A();
            * typeof(A) !== "undefined" && A.x && A.x();
            * A.x && A.x();  /* if A exists */
        `,
        optionsDescription: TSLintUtils.dedent`
            The options for this rule must be an object which may have the
            following properties: "targets", "whitelist", "showNotes" and
            "showPartialImplementations".

            The "targets" property specifies the browsers for which to check
            the code for compatibility. This is an object where the keys are
            the names of the browsers for which the code needs to be checked.
            The currently accepted names are: "chrome", "chrome_android", "edge",
            "firefox", "firefox_android", "ie", "nodejs", "opera", "opera_android",
            "qq_android", "safari", "safari_ios", "samsunginternet_android",
            "uc_android", "uc_chinese_android" and "webview_android".

            For each browser name, the corresponding value in this object may be:
            * A string indicating the minimum browser version (e.g. "1", "1.2").
            * A string indicating a range of supported versions (e.g. "1-10", "1.0-1.8")
            * An integer indicating the minimum version. If the value is a number with a
              fraction, the fraction is discarded and only the integer part is used.
            * The string "*", indicating that all versions of the browser must be supported.

            Set the "showPartialImplementations" property to true to emit messages
            that indicate that a feature or API being used is partially implemented in
            one of the target browsers. These messages are not suppressed by the use
            of conditional statements, since they are associated with features
            that exist. They are, however, suppressed for whitelisted features.
            The default value of this property is false.

            Set the "showNotes" property to true to emit additional messages
            available in the MDN database for APIs that are otherwise fully supported.
            These messages are advisory in nature and usually do not indicate any
            problem. They messages are not suppressed by the use of conditional
            statements, but are suppressed for whitelisted features.The default
            value of this property is false.

            The "whitelist" property, if specified, is array of whitelisted items.
            Any compatibility issues related to these items will be suppressed.
            Each item in this array must be a string that represents a type,
            global variable or function, property, method or event to be whitelisted:

            * To whitelist a type or global variable or function, use its name.
            * To whitelist a property or method on a type, use "TypeName.propName".
              This applies to both instance and static properties/methods.
            * To whitelist an event on a type, use "TypeName.@eventName".
            * To whitelist all properties and methods on a type, use "TypeName.*".
            * To whitelist all events on a type, use "TypeName.@*".

            Note that whitelisting a type does not automatically whitelist its properties,
            methods and/or events. These must be explicitly whitelisted if needed.

            For example, ["Map", "Object.values", "Math.*", "Window.@storage", "Element.@*"]
            will whitelist the Map type, the Object.values method, all properties and methods
            of the Math type, the storage event of the Window type and all events of the
            Element type.
        `,

        options: {
            type: "object",
            properties: {
                targets: {
                    type: "object",
                    properties: {},
                    additionalProperties: true,
                },
                whitelist: {
                    type: "array",
                    items: { type: "string" },
                },
                showNotes: { type: "boolean" },
                showPartialImplementations: { type: "boolean" },
                noTSVersionCheck: { type: "boolean" },
            },
            required: ["targets"],
            additionalProperties: false,
        },
    };

    private m_compatChecker: ClientCompatChecker | null = null;
    private m_whitelist: Whitelist | null = null;
    private m_init: boolean = false;
    private m_lastWalker: Walker | null = null;

    public constructor(options: IOptions) {
        super(options);
    }

    public applyWithProgram(sourceFile: SourceFile, program: Program): RuleFailure[] {
        if (this.ruleArguments[0] === false) {
            return [];
        }

        // Initialisation is done here instead of in the constructor,
        // so that any exception thrown will be visible in the VS Code
        // problems panel.

        if (!this.m_init) {
            const options: any = this.ruleArguments[0];

            this.m_compatChecker = _createOrGetCachedCompatChecker(options);
            this.m_whitelist = parseWhitelist(options.whitelist);
            this.m_init = true;
        }

        const walker = new Walker(
            sourceFile, program, this.ruleName, this.m_compatChecker!, this.m_whitelist!);

        this.m_lastWalker = walker;
        return this.applyWithWalker(walker);
    }

    public get issuesFound(): readonly IssueWithLocation[] {
        return (this.m_lastWalker !== null) ? this.m_lastWalker.issuesFound : [];
    }

}

const _compatData: CompatData = new CompatData();

let _cachedTargets: any = {};
let _cachedFlags: ClientCompatCheckerFlags = 0;
let _cachedCompatChecker: ClientCompatChecker | null = null;

function _createOrGetCachedCompatChecker(options: any): ClientCompatChecker {
    const targets: any = options.targets || {};

    const showNotes: boolean =
        Boolean(("showNotes" in options) ? options.showNotes : false);
    const showPartial: boolean =
        Boolean(("showPartialImplementations" in options) ? options.showPartialImplementations : false);

    let flags: ClientCompatCheckerFlags = 0;
    if (!showNotes) {
        flags |= ClientCompatCheckerFlags.IGNORE_NOTES;
    }
    if (!showPartial) {
        flags |= ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL;
    }

    if (_canUseCachedCompatChecker(targets, flags)) {
        return _cachedCompatChecker!;
    }

    const checker = new ClientCompatChecker(_compatData, parseTargets(targets), flags);

    _cachedTargets = targets;
    _cachedFlags = flags;
    _cachedCompatChecker = checker;

    return checker;
}

function _canUseCachedCompatChecker(targets: any, flags: ClientCompatCheckerFlags): boolean {
    if (_cachedFlags !== flags) {
        return false;
    }
    const supportedClientNames = _compatData.getSupportedClientNames();
    for (let i: number = 0; i < supportedClientNames.length; i++) {
        const name: string = supportedClientNames[i];
        if (targets[name] !== _cachedTargets[name]) {
            return false;
        }
    }
    return true;
}

export function parseTargets(targetsArg: any): ClientInfo[] {
    if (targetsArg === undefined) {
        return [];
    }
    if (typeof(targetsArg) !== "object" || Array.isArray(targetsArg)) {
        throw new TypeError("'targets' must be an object.");
    }

    const clientInfos: ClientInfo[] = [];
    for (const name in targetsArg) {
        if (!targetsArg.hasOwnProperty(name)) {
            continue;
        }
        const ver: any = targetsArg[name];
        const [start, end] = _parseTargetVersion(name, ver);
        clientInfos.push(new ClientInfo(name, _compatData.getDisplayName(name), start, end));
    }
    return clientInfos;
}

function _parseTargetVersion(targetName: string, targetVersion: any): [Version, Version] {
    if (typeof(targetVersion) === "number") {
        return [Version.create(targetVersion), Version.maxVal];
    }
    if (typeof(targetVersion) !== "string") {
        throw new TypeError("Invalid version for target '" + targetName + "': must be a number or string.");
    }
    return _parseTargetVersionString(targetName, targetVersion);
}

function _parseTargetVersionString(targetName: string, targetVersion: string): [Version, Version] {
    let start: Version;
    let end: Version = Version.maxVal;

    // This is similar to Version.rangeFromString(), except that:
    // - For "*" and "<=" type ranges, the lower bound is taken as the first release for
    //   the target name (obtained from the compat data), rather than 0.0
    // - A single version number (e.g. "5" or "5.5") is interpreted as "from that version
    //   to the maximum", i.e. all versions greater than or equal to that version.

    if (targetVersion === "*") {
        start = _compatData.getFirstVersion(targetName);
    }
    else if (targetVersion.startsWith("<=")) {
        [, end] = Version.rangeFromString(targetVersion);
        start = Version.min(_compatData.getFirstVersion(targetName), end);
    }
    else if (targetVersion.startsWith(">=")) {
        start = Version.fromString(targetVersion.substring(2));
    }
    else if (targetVersion.indexOf("-") !== -1) {
        [start, end] = Version.rangeFromString(targetVersion);
    }
    else {
        start = Version.fromString(targetVersion);
    }

    return [start, end];
}

export function parseWhitelist(whitelistArg: any): Whitelist {
    const whitelist = new Whitelist();

    if (whitelistArg === undefined) {
        return whitelist;
    }
    _ensureWhitelistArgumentValid(whitelistArg);

    const strings = whitelistArg as string[];
    for (let i: number = 0; i < strings.length; i++) {
        const str = strings[i];
        const dotPos: number = str.indexOf(".");

        if (dotPos === -1) {
            // No property separator, so the name is a global.
            whitelist.addGlobal(str);
        }
        else if (dotPos !== str.length - 1 && str.charCodeAt(dotPos + 1) === 0x40) {
            // '@' prefix before property name indicates an event.
            whitelist.addEvent(str.substring(0, dotPos), str.substring(dotPos + 2));
        }
        else {
            whitelist.addProperty(str.substring(0, dotPos), str.substring(dotPos + 1));
        }
    }

    return whitelist;
}

function _ensureWhitelistArgumentValid(whitelistArg: any): void {
    if (!Array.isArray(whitelistArg)) {
        throw new TypeError("'whitelist' must be an array.");
    }
    if (!(whitelistArg as any[]).every(x => typeof (x) === "string")) {
        throw new TypeError("The whitelist array must contain only strings.");
    }
}
