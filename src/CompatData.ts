import ClientCompatCheckerFlags from "./ClientCompatCheckerFlags";
import ClientCompatIssueList from "./ClientCompatIssueList";
import ClientInfo from "./ClientInfo";
import Issue, {IssueKind} from "./Issue";
import Version from "./Version";

import * as _data from "mdn-browser-compat-data";
_preprocessMDNCompatData(_data);

class CompatData {

    private m_builtins: any;

    private m_api: any;

    private m_browsers: any;

    private m_supportedClientNames: string[];

    private m_clientMinVersions: Map<string, Version> | null = null;

    private m_recognizedGlobals: Set<string> | null = null;

    public constructor(sourceData: any = _data) {
        if (sourceData !== _data) {
            // If mock data is provided, clone and preprocess.
            sourceData = _deepCopyObject(sourceData);
            _preprocessMDNCompatData(sourceData);
        }
        this.m_builtins = sourceData.javascript.builtins;
        this.m_api = sourceData.api;
        this.m_browsers = sourceData.browsers;
        this.m_supportedClientNames = Object.keys(this.m_browsers);
    }

    /**
     * Gets an array containing the client names supported for use with
     * getDisplayName(), getFirstVersion() and as the name property of
     * a ClientInfo instance passed to getCompatIssues().
     */
    public getSupportedClientNames(): readonly string[] {
        return this.m_supportedClientNames;
    }

    /**
     * Gets the display name of the client with the given name.
     * @param clientName The client name for which to obtain the display name.
     */
    public getDisplayName(clientName: string): string {
        if (!(clientName in this.m_browsers)) {
            throw new RangeError("Invalid client name: " + clientName);
        }
        return this.m_browsers[clientName].name;
    }

    /**
     * Gets the first version of the client with the given name.
     * @param clientName The client name for which to obtain the first version.
     */
    public getFirstVersion(clientName: string): Version {
        if (!(clientName in this.m_browsers)) {
            throw new RangeError("Invalid client name: " + clientName);
        }
        if (this.m_clientMinVersions === null) {
            this.m_clientMinVersions = this._createClientMinVersionMap();
        }
        return this.m_clientMinVersions.get(clientName)!;
    }

    /**
     * Creates an array of ClientCompatIssueList objects containing compatibility issues
     * detected for each of the client version ranges represented by the elements of the
     * given array of ClientInfo objects.
     *
     * @returns An array of ClientCompatIssueList, whose elements contain the issues
     *          generated for the client version ranges corresponding to each element
     *          in the clientInfos argument.
     *
     * @param clientInfos An array of ClientInfo instances.
     * @param flags       A bitwise combination of enumerated values from
     *                    ClientCompatCheckerFlags which can be used to suppress
     *                    certain kinds of issues from being generated.
     */
    public getIssues(
        clientInfos: readonly ClientInfo[],
        flags: ClientCompatCheckerFlags): readonly ClientCompatIssueList[]
    {
        const clientIssuesLists = new Array<ClientCompatIssueList>(clientInfos.length);
        for (let i: number = 0; i < clientInfos.length; i++) {
            clientIssuesLists[i] = new ClientCompatIssueList();
        }

        _loadCompatDataFromSource(this.m_builtins, clientInfos, flags, clientIssuesLists);
        _loadCompatDataFromSource(this.m_api, clientInfos, flags, clientIssuesLists);

        return clientIssuesLists;
    }

    /**
     * Returns a set containing the names of all global types, variables and
     * functions listed in the compatibility data.
     */
    public getRecognizedGlobals(): ReadonlySet<string> {
        if (this.m_recognizedGlobals !== null) {
            return this.m_recognizedGlobals;
        }

        this.m_recognizedGlobals = new Set<string>();

        _addGlobalNamesToSet(this.m_builtins, this.m_recognizedGlobals);
        _addGlobalNamesToSet(this.m_api, this.m_recognizedGlobals);

        _windowInterfaces.forEach(x => _addGlobalNamesToSet(this.m_api[x], this.m_recognizedGlobals!));

        return this.m_recognizedGlobals;
    }

    private _createClientMinVersionMap() {
        const browsers = this.m_browsers;
        const dict = new Map<string, Version>();

        for (const name in browsers) {
            if (!browsers.hasOwnProperty(name)) {
                continue;
            }
            const versionStrings: string[] = Object.keys(browsers[name].releases);
            const versions: Version[] = versionStrings.map(x => Version.fromString(x));
            const minVersion: Version = versions.reduce((a, x) => (Version.compare(a, x) < 0) ? a : x);
            dict.set(name, minVersion);
        }
        return dict;
    }

}

export default CompatData;

///////////////////////////////////////////////////////////////////////////////

const _tempIssuesArray: Issue[] = [];

/**
 * The interfaces implemented by the global `window`.
 */
const _windowInterfaces: Set<string> = new Set<string>([
    "Window", "EventTarget", "AnimationFrameProvider", "GlobalEventHandlers",
    "WindowConsole", "WindowEventHandlers", "WindowLocalStorage",
    "WindowOrWorkerGlobalScope", "WindowSessionStorage",
]);

/**
 * Creates a deep copy of the given object.
 * @returns A deep copy of the given object.
 * @param obj An object for which to create a deep copy.
 */
function _deepCopyObject(obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(_deepCopyObject);
    }
    if (typeof(obj) !== "object") {
        return obj;
    }
    const clone: any = {};
    // tslint:disable-next-line: forin
    for (const name in obj) {
        clone[name] = _deepCopyObject(obj[name]);
    }
    return clone;
}

function _preprocessMDNCompatData(data: any): void {
    _preprocessMDNCompatDataItem("builtins", data.javascript.builtins);
    _preprocessMDNCompatDataItem("api", data.api);
}

function _preprocessMDNCompatDataItem(key: string | number, val: any): any {
    if (key === "support") {
        return _preprocessMDNCompatDataSupportBlock(val);
    }
    _preprocessMDNCompatDataItemKeys(key, val);
    return val;
}

function _preprocessMDNCompatDataSupportBlock(support: any): any {
    // tslint:disable-next-line: forin
    for (const name in support) {
        const supportStatement: any = support[name];
        if (Array.isArray(supportStatement)) {
            supportStatement.forEach(_preprocessMDNCompatDataSupportStatement);
            supportStatement.sort(_compareSupportStatementsForSort);
        }
        else {
            _preprocessMDNCompatDataSupportStatement(supportStatement);
        }
    }
    return support;
}

function _preprocessMDNCompatDataSupportStatement(ss: any): void {
    ss.version_added = _supportStatementVersionAddedToObject(ss.version_added);
    ss.version_removed = _supportStatementVersionRemovedToObject(ss.version_removed);
}

function _preprocessMDNCompatDataItemKeys(key: string | number, val: any): void {
    if (Array.isArray(val)) {
        for (let i: number = 0; i < val.length; i++) {
            val[i] = _preprocessMDNCompatDataItem(i, val[i]);
        }
    }
    else if (typeof(val) === "object") {
        // tslint:disable-next-line: forin
        for (const prop in val) {
            val[prop] = _preprocessMDNCompatDataItem(prop, val[prop]);
        }
    }
    return val;
}

function _supportStatementVersionAddedToObject(versionAdded: any): Version {
    if (versionAdded === true) {
        return Version.minVal;
    }
    if (versionAdded === false) {
        return Version.infinite;
    }
    if (typeof(versionAdded) !== "string") {
        return Version.minVal;
    }

    if (versionAdded.charCodeAt(0) === 0x2264) {
        // Some Edge and Android WebView versions begin with '≤', which
        // indicates than the feature was added in a version less than or
        // equal to that value. For these cases, assume that it was added
        // in the first version.
        // See: https://github.com/mdn/browser-compat-data/
        //      blob/master/schemas/compat-data-schema.md#ranged-versions
        return Version.minVal;
    }
    else {
        return Version.fromString(versionAdded);
    }
}

function _supportStatementVersionRemovedToObject(versionRemoved: any): Version {
    if (typeof(versionRemoved) !== "string") {
        return Version.infinite;
    }
    if (versionRemoved.charCodeAt(0) === 0x2264) {
        return Version.fromString(versionRemoved.substring(1));
    }
    return Version.fromString(versionRemoved);
}

function _compareSupportStatementsForSort(a: any, b: any): number {
    const r: number = Version.compare(a.version_added as Version, b.version_added as Version);
    if (r !== 0) {
        return r;
    }
    return Version.compare(b.version_removed as Version, a.version_removed as Version);
}

function _addGlobalNamesToSet(obj: any, set: Set<string>): void {
    if (obj === null || obj === undefined) {
        return;
    }
    for (const name in obj) {
        if (name.indexOf("_") === -1 && !name.startsWith("@@")) {
            set.add(name);
        }
    }
}

function _loadCompatDataFromSource(
    sourceData: any, clientInfos: readonly ClientInfo[],
    flags: ClientCompatCheckerFlags, clientIssuesLists: ClientCompatIssueList[]): void
{
    for (const globalName in sourceData) {
        if (!sourceData.hasOwnProperty(globalName)) {
            continue;
        }

        const dataForGlobal: any = sourceData[globalName];
        const members: string[] = Object.keys(dataForGlobal);

        for (let i: number = 0; i < clientInfos.length; i++) {
            const clientInfo: ClientInfo = clientInfos[i];
            const clientIssues: ClientCompatIssueList = clientIssuesLists[i];

            _loadGlobalIssuesForClient(clientInfo, globalName, dataForGlobal, flags, clientIssues);
            _loadAllMemberIssuesForClient(clientInfo, globalName, members, dataForGlobal, flags, clientIssues);
        }
    }
}

function _loadGlobalIssuesForClient(
    clientInfo: ClientInfo, name: string, sourceData: any,
    flags: ClientCompatCheckerFlags, clientIssues: ClientCompatIssueList): void
{
    _tempIssuesArray.length = 0;
    _getIssuesFromCompatStatement(
        clientInfo, name, null, sourceData.__compat, flags, _tempIssuesArray);
    clientIssues.setIssuesForGlobal(name, _tempIssuesArray);
}

function _loadAllMemberIssuesForClient(
    clientInfo: ClientInfo, typeName: string, memberNames: string[],
    sourceData: any, flags: ClientCompatCheckerFlags, clientIssues: ClientCompatIssueList): void
{
    const isWindowGlobal: boolean = _windowInterfaces.has(typeName);

    for (let i: number = 0; i < memberNames.length; i++) {
        const memberName: string = memberNames[i];

        const isEvent: boolean = memberName.endsWith("_event");
        let memberNameWithoutSuffix: string = memberName;

        if (isEvent) {
            memberNameWithoutSuffix = memberName.substring(0, memberName.length - 6);
        }
        else if (memberName.indexOf("_") !== -1
            || memberName.startsWith("@@") || memberName === typeName)
        {
            continue;
        }

        _loadMemberIssuesForClient(
            clientInfo, typeName, memberNameWithoutSuffix, isEvent, isWindowGlobal,
            sourceData[memberName], flags, clientIssues);
    }
}

function _loadMemberIssuesForClient(
    clientInfo: ClientInfo, typeName: string, memberName: string,
    isEvent: boolean, isWindowGlobal: boolean, sourceData: any,
    flags: ClientCompatCheckerFlags, clientIssues: ClientCompatIssueList)
{
    _tempIssuesArray.length = 0;
    _getIssuesFromCompatStatement(
        clientInfo, typeName, memberName, sourceData.__compat, flags, _tempIssuesArray);

    clientIssues.setIssuesForPropertyOrEvent(typeName, memberName, isEvent, _tempIssuesArray);
    if (isWindowGlobal && !isEvent) {
        clientIssues.setIssuesForGlobal(memberName, _tempIssuesArray);
    }
}

/**
 * Creates a new Issue object which indicates an unsupported feature.
 *
 * @returns The created Issue object.
 *
 * @param name        The name of the type or global variable/function.
 * @param propName    If the issue is associated with a property/method/event on
 *                    a type, pass the property name. Otherwise set this to null.
 * @param clientInfo  The ClientSupportInfo instance representing the client version
 *                    range on which the feature is not supported.
 */
function _makeNotSupportedIssue(name: string, propName: string | null, clientInfo: ClientInfo): Issue {
    return new Issue(
        (propName !== null) ? name + "." + propName : name,
        clientInfo, IssueKind.NOT_SUPPORTED);
}

function _getIssuesFromCompatStatement(
    clientInfo: ClientInfo, typeName: string, propName: string | null,
    compatStatement: any, flags: ClientCompatCheckerFlags, issues: Issue[]): void
{
    if (!compatStatement) {
        return;
    }

    const support: any = compatStatement.support[clientInfo.name];
    if (!support) {
        issues.push(_makeNotSupportedIssue(typeName, propName, clientInfo));
        return;
    }

    const url: string | null = compatStatement.mdn_url ? String(compatStatement.mdn_url) : null;

    if (Array.isArray(support)) {
        _getIssuesFromArraySupportStatement(
            clientInfo, typeName, propName, url, support as any[], flags, issues);
    }
    else {
        _getIssuesFromSingleSupportStatement(
            clientInfo, typeName, propName, url, support, flags, issues);
    }
}

function _getIssuesFromSingleSupportStatement(
    clientInfo: ClientInfo, typeName: string, propName: string | null, url: string | null,
    supportStatement: any, flags: ClientCompatCheckerFlags, issues: Issue[])
{
    const issue: Issue | null =
        _checkIfSupportedVersion(clientInfo, supportStatement)
        ? _makeIssueFromSupportStatement(typeName, propName, url, clientInfo, flags, supportStatement)
        : _makeNotSupportedIssue(typeName, propName, clientInfo);

    if (issue !== null) {
        issues.push(issue);
    }
}

function _getIssuesFromArraySupportStatement(
    clientInfo: ClientInfo, typeName: string, propName: string | null, url: string | null,
    supportStatements: any[], flags: ClientCompatCheckerFlags, issues: Issue[])
{
    if (!_checkIfSupportedVersionArray(clientInfo, supportStatements)) {
        issues.push(_makeNotSupportedIssue(typeName, propName, clientInfo));
        return;
    }

    // Don't report any issues (other than notes, if that option is enabled) if the
    // feature has full support for the supplied version range.
    const notesOnly: boolean = _checkIfSupportedVersionArray(clientInfo, supportStatements, true);

    for (let i: number = 0; i < supportStatements.length; i++) {
        const issue: Issue | null =
            _makeIssueFromSupportStatement(typeName, propName, url, clientInfo, flags, supportStatements[i]);

        if (issue === null || (notesOnly && issue.kind !== IssueKind.NOTE)) {
            continue;
        }
        issues.push(issue);
    }
}

/**
 * Checks if an issue should be ignored based on the given flags.
 *
 * @returns True if the issue should be ignored, otherwise false.
 * @param issue The issue to check.
 * @param flags A set of flags from ClientCompatCheckerFlags.
 */
function _shouldDiscardIssueBasedOnFlags(issue: Issue, flags: ClientCompatCheckerFlags): boolean {
    if ((flags & ClientCompatCheckerFlags.IGNORE_NOTES) !== 0
        && issue.kind === IssueKind.NOTE)
    {
        return true;
    }
    if ((flags & ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL) !== 0
        && issue.kind === IssueKind.IS_PARTIAL_IMPL)
    {
        return true;
    }
    return false;
}

/**
 * Removes HTMl tags and entities from the "notes" property of a support block.
 *
 * @returns The string with tags removed and entities substituted.
 * @param str The string from which to strip HTML tags and replace entities.
 */
function _stripHTMLFromNotes(str: string): string {
    return str
        .replace(/<[^>]+>/g, "")
        .replace(/&(?:lt|gt|amp);/g, m => (m === "&lt;") ? "<" : ((m === "&gt;") ? ">" : "&"));
}

function _makeIssueFromSupportStatement(
    typeName: string, propName: string | null, url: string | null,
    clientInfo: ClientInfo, flags: ClientCompatCheckerFlags, supportStatement: any): Issue | null
{
    const versionAdded: Version = supportStatement.version_added as Version;
    const versionRemoved: Version = supportStatement.version_removed as Version;

    if (Version.compare(clientInfo.maxVersion, versionAdded) < 0
        || Version.compare(clientInfo.minVersion, versionRemoved) >= 0)
    {
        return null;
    }

    const notes: string | null = supportStatement.notes
        ? _stripHTMLFromNotes(String(supportStatement.notes))
        : null;

    let issueKind: IssueKind | null;
    let altOrPrefix: string | null;
    [issueKind, altOrPrefix] = _getIssueKindAndPrefixFromSupportStatement(supportStatement);

    if (issueKind === null) {
        return null;
    }

    const featureName: string = (propName !== null) ? typeName + "." + propName : typeName;
    const issue = new Issue(
        featureName, clientInfo, issueKind, altOrPrefix, notes, url, versionAdded, versionRemoved);

    if (_shouldDiscardIssueBasedOnFlags(issue, flags)) {
        return null;
    }
    return issue;
}

function _getIssueKindAndPrefixFromSupportStatement(supportStatement: any): [IssueKind | null, string | null] {
    let issueKind: IssueKind | null = null;
    let altOrPrefix: string | null = null;

    if (supportStatement.prefix) {
        issueKind = IssueKind.NEEDS_PREFIX;
        altOrPrefix = String(supportStatement.prefix);
    }
    else if (supportStatement.alternative_name) {
        issueKind = IssueKind.NEEDS_ALT_NAME;
        altOrPrefix = String(supportStatement.alternative_name);
    }
    else if (supportStatement.flags) {
        issueKind = IssueKind.NEEDS_FLAG;
    }
    else if (supportStatement.partial_implementation === true) {
        issueKind = IssueKind.IS_PARTIAL_IMPL;
    }
    else if (supportStatement.notes) {
        issueKind = IssueKind.NOTE;
    }

    return [issueKind, altOrPrefix];
}

function _checkIfSupportedVersion(
    clientInfo: ClientInfo, support: any, withNoIssues: boolean = false): boolean
{
    if (Version.compare(clientInfo.minVersion, support.version_added as Version) < 0
        || Version.compare(clientInfo.maxVersion, support.version_removed as Version) >= 0)
    {
        return false;
    }
    if (!withNoIssues) {
        return true;
    }
    return !(support.prefix || support.alternative_name
        || support.flags || support.partial_implementation);
}

function _checkIfSupportedVersionArray(
    clientInfo: ClientInfo, supportStatements: any[], withNoIssues: boolean = false): boolean
{
    if (withNoIssues) {
        supportStatements = supportStatements.filter(x =>
            !(x.prefix || x.alternative_name || x.flags || x.partial_implementation));
    }
    if (supportStatements.length === 0) {
        return false;
    }
    if (supportStatements.length === 1) {
        return _checkIfSupportedVersion(clientInfo, supportStatements[0]);
    }
    return _checkVersionRangeIntersection(clientInfo, supportStatements);
}

function _checkVersionRangeIntersection(clientInfo: ClientInfo, sortedSupportStatements: any[]): boolean {
    const arr: any[] = sortedSupportStatements;
    const vMin: Version = clientInfo.minVersion;
    const vMax: Version = clientInfo.maxVersion;

    if (Version.compare(vMin, arr[0].version_added as Version) < 0) {
        return false;
    }

    let lastRemoved: Version = arr[0].version_removed as Version;

    for (let i: number = 1; i < arr.length; i++) {
        const nextAdded: Version = arr[i].version_added as Version;
        if (Version.compare(nextAdded, lastRemoved) > 0
            && Version.compare(vMin, nextAdded) < 0
            && Version.compare(vMax, lastRemoved) >= 0)
        {
            return false;
        }
        lastRemoved = Version.max(lastRemoved, arr[i].version_removed as Version);
    }

    return Version.compare(vMax, lastRemoved) < 0;
}
