import Version from "./Version";

/**
 * Represents a particular range of versions of a client.
 */
export class ClientInfo {

    /**
     * The internal client name.
     */
    public readonly name: string;
    /**
     * The client name to be used in messages to be displayed to the user.
     */
    public readonly displayName: string;
    /**
     * The first version of the client version range.
     */
    public readonly minVersion: Version;
    /**
     * The last version of the client version range.
     */
    public readonly maxVersion: Version;
    /**
     * A description string containing the client name and version range.
     */
    public readonly description: string;

    public constructor(name: string, displayName: string, minVersion: Version, maxVersion: Version) {
        this.name = name;
        this.displayName = displayName;
        this.minVersion = minVersion;
        this.maxVersion = maxVersion;
        this.description = _createDescription(displayName, minVersion, maxVersion);
    }

}

export default ClientInfo;

///////////////////////////////////////////////////////////////////////////////

function _createDescription(displayName: string, minVersion: Version, maxVersion: Version): string {
    if (Version.compare(minVersion, Version.minVal) === 0
        && Version.compare(maxVersion, Version.maxVal) === 0)
    {
        return displayName;
    }
    else {
        return displayName + " " + Version.rangeToString(minVersion, maxVersion);
    }
}
