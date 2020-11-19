import Issue from './Issue';

/**
 * Represents a compatibility issue along with information about the source code
 * location in which the issue was detected.
 */
class IssueWithLocation {
  /**
   * The name of the source file in which the issue was detected.
   */
  public readonly sourceFileName: string;

  /**
   * The line number in the source code at which the issue was detected.
   * (The first line is numbered as zero.)
   */
  public readonly sourceLineNum: number;

  /**
   * The character position in the line in the source file at which the issue
   * was detected. (The first character of a line is numbered as zero.)
   */
  public readonly sourceCharNum: number;

  /**
   * An Issue instance representing the issue found at the source location.
   */
  public readonly issue: Issue;

  /**
   * Creates a new Issue instance.
   *
   * @param sourceFileName The name of the source file in which the issue was detected.
   * @param sourceLineNum  The line number in the source file at which the issue was detected.
   * @param sourceCharNum  The character position in the line in the source file at which the issue
   *                       was detected.
   * @param issue          An Issue instance representing the issue found at the source location.
   */
  public constructor(
    sourceFileName: string,
    sourceLineNum: number,
    sourceCharNum: number,
    issue: Issue
  ) {
    this.sourceFileName = sourceFileName;
    this.sourceLineNum = sourceLineNum;
    this.sourceCharNum = sourceCharNum;
    this.issue = issue;
  }
}

export default IssueWithLocation;
