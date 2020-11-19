import Version from "../src/Version";

const maxMajor: number = Version.MAX_MAJOR;
const maxMinor: number = Version.MAX_MINOR;

test("Version.create", () => {
    const f = Version.create;

    expect(f(0, 0)).toEqual({major: 0, minor: 0});
    expect(f(0, 0)).toEqual(Version.minVal);
    expect(f(2, 0)).toEqual({major: 2, minor: 0});
    expect(f(0, 3)).toEqual({major: 0, minor: 3});
    expect(f(4, 5)).toEqual({major: 4, minor: 5});
    expect(f(maxMajor, 0)).toEqual({major: maxMajor, minor: 0});
    expect(f(0, maxMinor)).toEqual({major: 0, minor: maxMinor});
    expect(f(maxMajor, maxMinor)).toEqual(Version.maxVal);
    expect(f(4.3, 5.7)).toEqual({major: 4, minor: 5});

    expect(() => f(maxMajor + 1, 0)).toThrow(RangeError);
    expect(() => f(0, maxMinor + 1)).toThrow(RangeError);
    expect(() => f(maxMajor + 1, maxMinor + 1)).toThrow(RangeError);
    expect(() => f(-1, 0)).toThrow(RangeError);
    expect(() => f(0, -1)).toThrow(RangeError);
    expect(() => f(-1, -1)).toThrow(RangeError);
    expect(() => f(-0.1, 0)).toThrow(RangeError);
});

test("Version.fromString", () => {
    const f = Version.fromString;

    const maxMajorStr: string = Version.MAX_MAJOR.toString();
    const maxMinorStr: string = Version.MAX_MINOR.toString();
    const maxMajorPlusOneStr: string = (Version.MAX_MAJOR + 1).toString();
    const maxMinorPlusOneStr: string = (Version.MAX_MINOR + 1).toString();

    expect(f("0")).toEqual({major: 0, minor: 0});
    expect(f("1")).toEqual({major: 1, minor: 0});
    expect(f("125")).toEqual({major: 125, minor: 0});

    expect(f(maxMajorStr)).toEqual({major: Version.MAX_MAJOR, minor: 0});

    expect(f("0.0")).toEqual({major: 0, minor: 0});
    expect(f("2.0")).toEqual({major: 2, minor: 0});
    expect(f("2.15")).toEqual({major: 2, minor: 15});
    expect(f("0.0.0")).toEqual({major: 0, minor: 0});
    expect(f("0.0.0.0")).toEqual({major: 0, minor: 0});
    expect(f("1.41.28.182.22")).toEqual({major: 1, minor: 41});

    expect(f(maxMajorStr + ".0")).toEqual({major: Version.MAX_MAJOR, minor: 0});
    expect(f("0." + maxMinorStr)).toEqual({major: 0, minor: Version.MAX_MINOR});
    expect(f(maxMajorStr + "." + maxMinorStr)).toEqual({major: Version.MAX_MAJOR, minor: Version.MAX_MINOR});

    expect(() => f(maxMajorPlusOneStr)).toThrow(RangeError);
    expect(() => f("-1")).toThrow(RangeError);
    expect(() => f(maxMajorPlusOneStr + ".0")).toThrow(RangeError);
    expect(() => f("0." + maxMinorPlusOneStr)).toThrow(RangeError);
    expect(() => f(maxMajorStr + "." + maxMinorPlusOneStr)).toThrow(RangeError);
    expect(() => f(maxMajorPlusOneStr + "." + maxMinorStr)).toThrow(RangeError);
    expect(() => f("0.-1")).toThrow(RangeError);
    expect(() => f("-1.0")).toThrow(RangeError);
    expect(() => f("-1.-1")).toThrow(RangeError);
});

test("Version.toString", () => {
    const f = (x: number, y: number) => Version.create(x, y).toString();

    expect(f(0, 0)).toBe("0.0");
    expect(f(10, 0)).toBe("10.0");
    expect(f(5, 10)).toBe("5.10");
});

test("Version.rangeToString", () => {
    const f = (w: number, x: number, y: number, z: number) =>
        Version.rangeToString(Version.create(w, x), Version.create(y, z));

    expect(f(1, 0, 1, 0)).toBe("1.0");
    expect(f(1, 5, 1, 5)).toBe("1.5");
    expect(f(0, 0, 0, maxMinor)).toBe("0");
    expect(f(125, 0, 125, maxMinor)).toBe("125");
    expect(f(0, 0, maxMajor, maxMinor)).toBe("*");
    expect(f(0, 0, 1, maxMinor)).toBe("<=1");
    expect(f(0, 0, 1, 5)).toBe("<=1.5");
    expect(f(1, 0, maxMajor, maxMinor)).toBe(">=1");
    expect(f(1, 5, maxMajor, maxMinor)).toBe(">=1.5");

    expect(f(1, 2, 3, 4)).toBe("1.2-3.4");
    expect(f(1, 2, 1, 5)).toBe("1.2-1.5");
    expect(f(2, 0, 3, maxMinor)).toBe("2-3");
    expect(f(2, 1, 2, maxMinor)).toBe("2.1-2." + maxMinor);
    expect(f(2, 1, 3, maxMinor)).toBe("2.1-3." + maxMinor);
});

test("Version.compare, Version.min, Version.max", () => {

    const comp = (w: number, x: number, y: number, z: number) =>
        Version.compare(Version.create(w, x), Version.create(y, z));

    const min = (w: number, x: number, y: number, z: number) =>
        Version.min(Version.create(w, x), Version.create(y, z));

    const max = (w: number, x: number, y: number, z: number) =>
        Version.max(Version.create(w, x), Version.create(y, z));

    expect(comp(0, 0, 0, 0)).toBe(0);
    expect(comp(1, 0, 1, 0)).toBe(0);
    expect(comp(1, 3, 1, 3)).toBe(0);
    expect(comp(0, 0, 1, 0)).toBeLessThan(0);
    expect(comp(0, 0, 0, 1)).toBeLessThan(0);
    expect(comp(0, 1, 1, 0)).toBeLessThan(0);
    expect(comp(1, 0, 0, 0)).toBeGreaterThan(0);
    expect(comp(0, 1, 0, 0)).toBeGreaterThan(0);
    expect(comp(1, 0, 0, 1)).toBeGreaterThan(0);

    expect(min(0, 0, 0, 0)).toEqual({major: 0, minor: 0});
    expect(min(1, 0, 1, 0)).toEqual({major: 1, minor: 0});
    expect(min(1, 3, 1, 3)).toEqual({major: 1, minor: 3});
    expect(min(0, 0, 1, 0)).toEqual({major: 0, minor: 0});
    expect(min(0, 0, 0, 1)).toEqual({major: 0, minor: 0});
    expect(min(0, 1, 1, 0)).toEqual({major: 0, minor: 1});
    expect(min(1, 0, 0, 0)).toEqual({major: 0, minor: 0});
    expect(min(0, 1, 0, 0)).toEqual({major: 0, minor: 0});
    expect(min(1, 0, 0, 1)).toEqual({major: 0, minor: 1});

    expect(max(0, 0, 0, 0)).toEqual({major: 0, minor: 0});
    expect(max(1, 0, 1, 0)).toEqual({major: 1, minor: 0});
    expect(max(1, 3, 1, 3)).toEqual({major: 1, minor: 3});
    expect(max(0, 0, 1, 0)).toEqual({major: 1, minor: 0});
    expect(max(0, 0, 0, 1)).toEqual({major: 0, minor: 1});
    expect(max(0, 1, 1, 0)).toEqual({major: 1, minor: 0});
    expect(max(1, 0, 0, 0)).toEqual({major: 1, minor: 0});
    expect(max(0, 1, 0, 0)).toEqual({major: 0, minor: 1});
    expect(max(1, 0, 0, 1)).toEqual({major: 1, minor: 0});

    expect(Version.compare(Version.maxVal, Version.infinite)).toBeLessThan(0);
    expect(Version.compare(Version.infinite, Version.infinite)).toBe(0);
    expect(Version.min(Version.maxVal, Version.infinite)).toEqual(Version.maxVal);
    expect(Version.max(Version.maxVal, Version.infinite)).toEqual(Version.infinite);

});

test("Version.rangeFromString", () => {
    const f = (x: string) => {
        const [a, b] = Version.rangeFromString(x);
        return [a.major, a.minor, b.major, b.minor];
    };

    expect(f("*")).toEqual([0, 0, maxMajor, maxMinor]);

    expect(f("1.0-2.0")).toEqual([1, 0, 2, 0]);
    expect(f("1.2-3.4")).toEqual([1, 2, 3, 4]);
    expect(f("1.0-2")).toEqual([1, 0, 2, maxMinor]);
    expect(f("1-2.0")).toEqual([1, 0, 2, 0]);
    expect(f("1-2")).toEqual([1, 0, 2, maxMinor]);
    expect(f("1-1")).toEqual([1, 0, 1, maxMinor]);

    expect(f("<=2")).toEqual([0, 0, 2, maxMinor]);
    expect(f("<=2.0")).toEqual([0, 0, 2, 0]);
    expect(f("<=2.5")).toEqual([0, 0, 2, 5]);
    expect(f("<=0")).toEqual([0, 0, 0, maxMinor]);

    expect(f(">=2")).toEqual([2, 0, maxMajor, maxMinor]);
    expect(f(">=2.0")).toEqual([2, 0, maxMajor, maxMinor]);
    expect(f(">=2.5")).toEqual([2, 5, maxMajor, maxMinor]);
    expect(f(">=0")).toEqual([0, 0, maxMajor, maxMinor]);

    expect(f("0")).toEqual([0, 0, 0, maxMinor]);
    expect(f("2")).toEqual([2, 0, 2, maxMinor]);
    expect(f("0.0")).toEqual([0, 0, 0, 0]);
    expect(f("2.0")).toEqual([2, 0, 2, 0]);
    expect(f("2.5")).toEqual([2, 5, 2, 5]);

    expect(() => f("2-1")).toThrow(RangeError);
    expect(() => f("2.2-2.1")).toThrow(RangeError);
    expect(() => f("2.0-1")).toThrow(RangeError);
    expect(() => f("2-1.0")).toThrow(RangeError);
});
