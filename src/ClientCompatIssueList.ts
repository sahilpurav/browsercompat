import Issue from './Issue';

/**
 * Stores issues for globals, properties and events for a client version range.
 */
class ClientCompatIssueList {
  private m_global: Map<string, Issue | Issue[]> = new Map<
    string,
    Issue | Issue[]
  >();

  private m_properties: Map<string, Map<string, Issue | Issue[]>> = new Map<
    string,
    Map<string, Issue | Issue[]>
  >();

  private m_events: Map<string, Map<string, Issue | Issue[]>> = new Map<
    string,
    Map<string, Issue | Issue[]>
  >();

  /**
   * Associates the given list of issues with a type or global variable/function.
   * @param name   The name of the type, variable or function.
   * @param issues The issues associated with the global entity having the given name.
   */
  public setIssuesForGlobal(name: string, issues: readonly Issue[]): void {
    if (issues.length === 0) {
      return;
    }
    if (issues.length === 1) {
      this.m_global.set(name, issues[0]);
    } else {
      this.m_global.set(name, issues.slice());
    }
  }

  /**
   * Associates the given list of issues with a property, method or event on a type.
   * @param typeName The name of the type.
   * @param propName The name of the property, method or event defined on the type whose
   *                 name is "typeName"
   * @param isEvent  True for an event, false for a property/method.
   * @param issues   An array of issues to associate with the property.
   */
  public setIssuesForPropertyOrEvent(
    typeName: string,
    propName: string,
    isEvent: boolean,
    issues: readonly Issue[]
  ): void {
    if (issues.length === 0) {
      return;
    }

    const dict = isEvent ? this.m_events : this.m_properties;
    let typeDict = dict.get(typeName);
    if (typeDict === undefined) {
      typeDict = new Map<string, Issue | Issue[]>();
      dict.set(typeName, typeDict);
    }
    if (issues.length === 1) {
      typeDict.set(propName, issues[0]);
    } else {
      typeDict.set(propName, issues.slice());
    }
  }

  /**
   * Gets the issues associated with the given global type/variable/function.
   * @param name    The name of the global type/variable/function for which to retrieve
   *                the issues.
   * @param issues  An array of element type Issue to which the retrieved issues will
   *                be appended.
   */
  public getIssuesForGlobal(name: string, issues: Issue[]): void {
    const issuesFound = this.m_global.get(name);
    if (issuesFound === undefined) {
      return;
    }
    if (Array.isArray(issuesFound)) {
      issues.push.apply(issues, issuesFound as Issue[]);
    } else {
      issues.push(issuesFound as Issue);
    }
  }

  /**
   * Gets the issues associated with the given property or event.
   *
   * @param typeName The name of the type on which the property is defined.
   * @param propName The name of the property defined on the type whose name is
   *                 given by "typeName" for which to retrieve the issues.
   * @param isEvent  True for an event, false for a property/method.
   * @param issues   An array of element type Issue to which the retrieved issues will
   *                 be appended.
   */
  public getIssuesForPropertyOrEvent(
    typeName: string,
    propName: string,
    isEvent: boolean,
    issues: Issue[]
  ): void {
    const dict = isEvent ? this.m_events : this.m_properties;
    const typeDict = dict.get(typeName);
    if (typeDict === undefined) {
      return;
    }
    const issuesFound = typeDict.get(propName);
    if (issuesFound === undefined) {
      return;
    }
    if (Array.isArray(issuesFound)) {
      issues.push.apply(issues, issuesFound as Issue[]);
    } else {
      issues.push(issuesFound as Issue);
    }
  }
}

export default ClientCompatIssueList;
