
import ClientCompatCheckerFlags from "./ClientCompatCheckerFlags";
import ClientCompatIssueList from "./ClientCompatIssueList";
import ClientInfo from "./ClientInfo";
import CompatData from "./CompatData";
import Issue from "./Issue";

class ClientCompatChecker {

    private readonly m_clientIssueLists: readonly ClientCompatIssueList[];
    private readonly m_globals: ReadonlySet<string>;

    public constructor(compatData: CompatData, clientInfos: ClientInfo[], flags: ClientCompatCheckerFlags) {
        this.m_clientIssueLists = compatData.getIssues(clientInfos, flags);
        this.m_globals = compatData.getRecognizedGlobals();
    }

    /**
     * Returns a value indicating whether the name of the given global variable, function
     * or type is listed in the compatibility data.
     * @param name The name of the global entity to check.
     */
    public isGlobalRecognized(name: string): boolean {
        return this.m_globals.has(name);
    }

    /**
     * Checks a global type, variable or function for compatibility with the
     * client list of this instance.
     *
     * @returns True if any issues were found, otherwise false.
     * @param name   The name of the global entity to be checked.
     * @param issues If any issues are found, they will be appended to this array.
     */
    public checkGlobal(name: string, issues: Issue[]): boolean {
        const oldIssuesLength: number = issues.length;
        for (let i: number = 0; i < this.m_clientIssueLists.length; i++) {
            this.m_clientIssueLists[i].getIssuesForGlobal(name, issues);
        }
        return issues.length !== oldIssuesLength;
    }

    /**
     * Checks a property or event for compatibility with the client list in this
     * instance.
     *
     * @returns True if any issues were found, otherwise false.
     *
     * @param typeName   The name of the type declaring the property to be checked.
     * @param propName   The name of the property to be checked.
     * @param isEvent    Set to true if propName represents an event.
     * @param issues     If any issues are found, they will be appended to this array.
     */
    public checkPropertyOrEvent(
        typeName: string, propName: string, isEvent: boolean, issues: Issue[]): boolean
    {
        const oldIssuesLength: number = issues.length;
        for (let i: number = 0; i < this.m_clientIssueLists.length; i++) {
            this.m_clientIssueLists[i].getIssuesForPropertyOrEvent(typeName, propName, isEvent, issues);
        }
        return issues.length !== oldIssuesLength;
    }

}

export default ClientCompatChecker;
