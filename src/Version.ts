const _VERSION_MAX: number = 999999999;

class Version {
  /**
   * The maximum possible major version value.
   */
  public static readonly MAX_MAJOR = _VERSION_MAX;

  /**
   * The maximum possible minor version value.
   */
  public static readonly MAX_MINOR = _VERSION_MAX;

  /**
   * The minimum possible version that can be represented by a Version
   * instance.
   */
  public static readonly minVal: Version = new Version(0, 0);

  /**
   * The maximum possible version that can be represented by a Version
   * instance.
   */
  public static readonly maxVal: Version = new Version(
    _VERSION_MAX,
    _VERSION_MAX
  );

  /**
   * A Version instance that compares greater than any other Version
   * instance (including maxVal) when using the compare() method.
   */
  public static readonly infinite: Version = new Version(_VERSION_MAX + 1, 0);

  /**
   * The major version number.
   */
  public readonly major: number;

  /**
   * The minor version number.
   */
  public readonly minor: number;

  /**
   * Creates a new Version instance.
   * This is a private constructor that does not validate its arguments.
   * To create a new Version instance use Version.create().
   *
   * @param major The major version number. Must be between 0 and _VERSION_MAX.
   * @param minor The minor version number. Must be between 0 and _VERSION_MAX.
   */
  private constructor(major: number, minor: number) {
    this.major = major;
    this.minor = minor;
  }

  /**
   * Creates a new Version instance.
   * @param major The major version number. Must be an integer between 0 and 999999999.
   * @param minor The minor version number. Must be an integer between 0 and 999999999.
   */
  public static create(major: number, minor: number = 0): Version {
    if (
      major >= 0 &&
      major <= Version.MAX_MAJOR &&
      minor >= 0 &&
      minor <= Version.MAX_MINOR
    ) {
      major |= 0;
      minor |= 0;
      return new Version(major, minor);
    }
    throw new RangeError('Invalid version.');
  }

  /**
   * Creates a Version instance by parsing a version string.
   * @param str The version string to parse.
   */
  public static fromString(str: string): Version {
    return Version._fromString(str, false);
  }

  /**
   * Parses a version range string and returns the first and last versions
   * of the range.
   * @param str The version range string to parse.
   */
  public static rangeFromString(str: string): readonly [Version, Version] {
    let min: Version = Version.minVal;
    let max: Version = Version.maxVal;
    if (str === '*') {
      return [min, max];
    }

    const dashPos: number = str.indexOf('-');
    if (dashPos !== -1) {
      min = Version._fromString(str.substring(0, dashPos), false);
      max = Version._fromString(str.substring(dashPos + 1), true);
    } else if (str.startsWith('<=')) {
      max = Version._fromString(str.substring(2), true);
    } else if (str.startsWith('>=')) {
      min = Version._fromString(str.substring(2), false);
    } else if (str.indexOf('.') === -1) {
      min = Version.create(parseInt(str, 10), 0);
      max = Version.create(min.major, Version.MAX_MINOR);
    } else {
      min = max = Version.fromString(str);
    }

    if (Version.compare(min, max) > 0) {
      throw new RangeError('Invalid version range string: ' + str);
    }
    return [min, max];
  }

  /**
   * Compares two Version instances.
   *
   * @returns A value less than, equal to or greater than zero when the first Version
   *          instance compares less than, equal to or greater than the second,
   *          respectively.
   * @param v1 The first instance.
   * @param v2 The second instance.
   */
  public static compare(v1: Version, v2: Version): number {
    if (v1.major !== v2.major) {
      return v1.major < v2.major ? -1 : 1;
    }
    if (v1.minor !== v2.minor) {
      // Major versions same, compare minor.
      return v1.minor < v2.minor ? -1 : 1;
    }
    return 0;
  }

  /**
   * Returns the minimum of the two given Version instances, when compared using
   * the Version.compare() method.
   * @param v1 The first instance.
   * @param v2 The second instance.
   */
  public static min(v1: Version, v2: Version): Version {
    return Version.compare(v1, v2) < 0 ? v1 : v2;
  }

  /**
   * Returns the maximum of the two given Version instances, when compared using
   * the Version.compare() method.
   * @param v1 The first instance.
   * @param v2 The second instance.
   */
  public static max(v1: Version, v2: Version): Version {
    return Version.compare(v1, v2) > 0 ? v1 : v2;
  }

  /**
   * Returns a string representation of a version range.
   * @param start The first version of the range.
   * @param end   The last version of the range.
   */
  public static rangeToString(start: Version, end: Version): string {
    if (Version.compare(start, end) === 0) {
      return start.toString();
    }
    if (start.minor === 0 && end.minor === Version.MAX_MINOR) {
      return _versionMajorRangeToString(start.major, end.major);
    }
    if (Version.compare(start, Version.minVal) <= 0) {
      return '<=' + end.toString();
    }
    if (Version.compare(end, Version.maxVal) >= 0) {
      return '>=' + start.toString();
    }
    return start.toString() + '-' + end.toString();
  }

  /**
   * Creates a Version instance by parsing a version string.
   *
   * @param str             The version string to parse.
   * @param defaultMinorMax By default, a minor version that is not specified is taken
   *                        to be 0. If this is set to true, it is taken to be the
   *                        maximum allowed value instead. (Use this if the version is
   *                        the end of a range.)
   */
  private static _fromString(str: string, defaultMinorMax: boolean): Version {
    let major: number;
    let minor: number = -1;
    let hasMinor: boolean = false;

    const p: number = str.indexOf('.');
    if (p === -1) {
      major = parseInt(str, 10);
    } else {
      major = parseInt(str.substring(0, p), 10);
      minor = parseInt(str.substring(p + 1), 10);
      hasMinor = true;
    }

    if (!hasMinor) {
      minor = defaultMinorMax ? Version.MAX_MINOR : 0;
    }

    return Version.create(major, minor);
  }

  /**
   * Gets a string representation of this Version instance.
   */
  public toString(): string {
    return this.major + '.' + this.minor;
  }
}

export default Version;

/////////////////////////////////////////////////////////////////////////////////

function _versionMajorRangeToString(
  startMajor: number,
  endMajor: number
): string {
  if (startMajor === endMajor) {
    return startMajor.toString();
  }
  if (startMajor === 0) {
    return endMajor === Version.MAX_MAJOR ? '*' : '<=' + endMajor;
  }
  if (endMajor === Version.MAX_MAJOR) {
    return '>=' + startMajor;
  }
  return startMajor + '-' + endMajor;
}
