import ClientInfo from "./ClientInfo";
import Version from "./Version";

const enum IssueKind {
    /**
     * The feature is not supported on the target client.
     */
    NOT_SUPPORTED,

    /**
     * The feature is not supported on the target client with its original name,
     * but a prefixed name is available.
     */
    NEEDS_PREFIX,

    /**
     * The feature is not supported on the target client with its original name,
     * but an alternative name is available.
     */
    NEEDS_ALT_NAME,

    /**
     * The feature is not supported on the target client with its original name,
     * but a prefixed name is available.
     */
    NEEDS_FLAG,

    /**
     * The feature is supported on the target client, but only partially.
     */
    IS_PARTIAL_IMPL,

    /**
     * The feature is fully supported on the target client, but additional
     * advice may be available.
     */
    NOTE,
}

/**
 * Represents a compatibility issue for a feature on a particular client.
 */
// tslint:disable-next-line: max-classes-per-file
class Issue {

    /**
     * The name of the type, function, property or event to which this issue
     * is related. Properties and events are qualified with the declaring type name.
     */
    public readonly featureName: string;

    /**
     * The ClientInfo representing the client version range for which this
     * issue is reported.
     */
    public readonly clientInfo: ClientInfo;

    /**
     * An enum member from IssueKind indicating the category of the issue.
     */
    public readonly kind: IssueKind;

    /**
     * If the issue kind is NEEDS_PREFIX or NEEDS_ALT_NAME, the prefix or alternate
     * name to be used.
     */
    public readonly altOrPrefix: string | null;

    /**
     * Any additional notes associated with this issue.
     */
    public readonly note: string | null;

    /**
     * A URL for a web page on which more information about the issue may be available.
     */
    public readonly url: string | null;

    /**
     * The client version beginning from which this issue is applicable.
     */
    public readonly startVersion: Version;

    /**
     * The client version beginning from which this issue is no longer applicable.
     */
    public readonly endVersion: Version;

    /**
     * Creates a new Issue instance.
     *
     * @param featureName  The name of the type, function, property or event to which the issue is related.
     * @param clientInfo   A ClientInfo for the client to which the issue is related.
     * @param kind         The issue category from IssueKind.
     * @param altOrPrefix  The prefix or alternate name, if "kind" is NEEDS_PREFIX or NEEDS_ALT_NAME
     * @param note         Additional notes associated with the issue.
     * @param url          A web page URL on which more information about the issue may be available.
     * @param startVersion The client version beginning from which this issue is applicable.
     * @param endVersion   The client version beginning from which this issue is no longer applicable.
     */
    public constructor(
        featureName: string,
        clientInfo: ClientInfo,
        kind: IssueKind,
        altOrPrefix: string | null = null,
        note: string | null = null,
        url: string | null = null,
        startVersion: Version = Version.minVal,
        endVersion: Version = Version.infinite)
    {
        this.featureName = featureName;
        this.clientInfo = clientInfo;
        this.kind = kind;
        this.altOrPrefix = altOrPrefix;
        this.note = note;
        this.url = url;
        this.startVersion = startVersion;
        this.endVersion = endVersion;
    }

    /**
     * Returns a message string representing this issue.
     */
    public getMessage(): string {
        const parts: string[] = [];
        parts.push(
            "A compatibility issue was detected for ",
            this.featureName, " with ", this.clientInfo.description, ":\n");

        const hasStartVersion: boolean = Version.compare(this.startVersion, Version.minVal) !== 0;
        const hasEndVersion: boolean = Version.compare(this.endVersion, Version.infinite) !== 0;

        _appendMessageForIssueKind(this.kind, this.altOrPrefix, parts);

        _appendMessageForIssueApplicableVersions(
            hasStartVersion ? this.startVersion : null,
            hasEndVersion ? this.endVersion : null,
            parts);

        if (this.note !== null) {
            parts.push("\n-- NOTE: ", this.note);
        }
        if (this.url !== null) {
            parts.push("\n-- More info: ", this.url);
        }

        return parts.join("");
    }
}

export default Issue;
export {IssueKind};

////////////////////////////////////////////////////////////////////////////////

function _appendMessageForIssueKind(kind: IssueKind, altOrPrefix: string | null, msgParts: string[]): void {
    switch (kind) {
        case IssueKind.NOT_SUPPORTED:
            msgParts.push("This type, property, function or event is not supported.");
            break;
        case IssueKind.NEEDS_PREFIX:
            msgParts.push("Use prefix '", altOrPrefix!, "'.");
            break;
        case IssueKind.NEEDS_ALT_NAME:
            msgParts.push("Use alternate name '", altOrPrefix!, "'.");
            break;
        case IssueKind.IS_PARTIAL_IMPL:
            msgParts.push("This feature is partially implemented.");
            break;
        case IssueKind.NEEDS_FLAG:
            msgParts.push("This feature may require a configuration setting to be changed to work properly.");
            break;
        case IssueKind.NOTE:
            msgParts.push("See the note below.");
            break;
    }
}

function _appendMessageForIssueApplicableVersions(
    startVersion: Version | null, endVersion: Version | null, msgParts: string[]): void
{
    if (startVersion !== null) {
        msgParts.push(" (Applicable for versions >= ", startVersion.toString());
        if (endVersion !== null) {
            msgParts.push(" and < ", endVersion.toString());
        }
        msgParts.push(")");
    }
    else if (endVersion !== null) {
        msgParts.push(" (applicable for versions < ", endVersion.toString(), ")");
    }
}
