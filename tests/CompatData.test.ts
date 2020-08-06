/* tslint:disable no-big-function max-line-length no-duplicate-string mccabe-complexity cognitive-complexity object-literal-key-quotes */

import ClientCompatCheckerFlags from "../src/ClientCompatCheckerFlags";
import ClientCompatIssueList from "../src/ClientCompatIssueList";
import ClientInfo from "../src/ClientInfo";
import CompatData from "../src/CompatData";
import Issue, {IssueKind} from "../src/Issue";
import Version from "../src/Version";

function issues(issueLists: readonly ClientCompatIssueList[], name: string): readonly Issue[] {
    const arr: Issue[] = [];

    for (let i: number = 0; i < issueLists.length; i++) {
        const dotPos: number = name.indexOf(".");
        if (dotPos === -1) {
            issueLists[i].getIssuesForGlobal(name, arr);
        }
        else if (name.charCodeAt(dotPos + 1) === 0x40) {
            issueLists[i].getIssuesForPropertyOrEvent(
                name.substring(0, dotPos), name.substring(dotPos + 2), true, arr);
        }
        else {
            issueLists[i].getIssuesForPropertyOrEvent(
                name.substring(0, dotPos), name.substring(dotPos + 1), false, arr);
        }
    }
    return arr;
}

function issueKinds(issueList: readonly ClientCompatIssueList[], name: string): readonly IssueKind[] {
    return issues(issueList, name).map(x => x.kind);
}

test("CompatData.getSupportedClientNames", () => {

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
            b: {name: "Browser B"},
            c: {name: "Browser C"},
        },
        javascript: {builtins: {}},
        api: {},
    });

    expect(data.getSupportedClientNames()).toEqual(["a", "b", "c"]);

});

test("CompatData.getDisplayName", () => {

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
            b: {name: "Browser B"},
            c: {name: "Browser C"},
        },
        javascript: {builtins: {}},
        api: {},
    });

    expect(data.getDisplayName("a")).toBe("Browser A");
    expect(data.getDisplayName("b")).toBe("Browser B");
    expect(data.getDisplayName("c")).toBe("Browser C");

    expect(() => data.getDisplayName("d")).toThrow(RangeError);
    expect(() => data.getDisplayName("Browser A")).toThrow(RangeError);
    expect(() => data.getDisplayName("")).toThrow(RangeError);

});

test("CompatData.getFirstVersion", () => {

    const data = new CompatData({
        browsers: {
            a: {
                name: "Browser A",
                releases: {"1.2": {}, "1": {}, "3": {}, "1.5": {}, "2": {}},
            },
            b: {
                name: "Browser B",
                releases: {"5": {}, "4": {}, "3": {}, "2": {}},
            },
            c: {
                name: "Browser C",
                releases: {"0.4": {}, "0.6": {}, "0.3.4": {}, "0.3.2": {}, "0.4.5": {}, "0.5": {}},
            },
        },
        javascript: {builtins: {}},
        api: {},
    });

    expect(data.getFirstVersion("a")).toEqual({major: 1, minor: 0});
    expect(data.getFirstVersion("b")).toEqual({major: 2, minor: 0});
    expect(data.getFirstVersion("c")).toEqual({major: 0, minor: 3});

    expect(() => data.getFirstVersion("d")).toThrow(RangeError);
    expect(() => data.getFirstVersion("Browser A")).toThrow(RangeError);

});

test("CompatData.getRecognizedGlobals", () => {

    const data = new CompatData({
        browsers: {},
        javascript: {builtins: {
            A: {__compat: {}},
            B: {__compat: {}},
            C: {__compat: {}},
        }},
        api: {
            foo: {__compat: {}},
            bar: {__compat: {}},
            Window: {
                __compat: {},
                abcd: {__compat: {}},
                "@@def": {__compat: {}},
            },
            WindowOrWorkerGlobalScope: {
                pqrs: {__compat: {}},
            }
        },
    });

    expect([...data.getRecognizedGlobals()].sort()).toEqual(["A", "B", "C", "Window", "WindowOrWorkerGlobalScope", "abcd", "bar", "foo", "pqrs"]);

});

test("CompatData.getIssues", () => {

    const builtins = {
        Foo: {
            __compat: {
                support: {a: {version_added: true}},
            },
            A: {
                __compat: {
                    support: {a: {version_added: "3"}},
                },
            },
            B: {
                __compat: {
                    support: {a: {version_added: "3.1"}},
                },
            },
            C: {
                __compat: {
                    support: {a: {version_added: true, version_removed: "3"}},
                },
            },
            D: {
                __compat: {
                    support: {a: {version_added: true, version_removed: "3.1"}},
                },
            },
            E: {
                __compat: {
                    support: {a: {version_added: "2", version_removed: "5"}},
                },
            },
            F: {
                __compat: {
                    support: {a: {version_added: "2", version_removed: "5.1"}},
                },
            },
            G: {
                __compat: {
                    support: {a: {version_added: "2.1", version_removed: "5.1"}},
                },
            },
            H: {
                __compat: {
                    support: {a: {version_added: "3", version_removed: "5.1"}},
                },
            },
            I: {
                __compat: {
                    support: {a: {version_added: true, version_removed: "5.1"}},
                },
            },
            J: {
                __compat: {
                    support: {a: {version_added: false}},
                },
            },
            K: {
                __compat: {
                    support: {a: {version_added: null}},
                },
            },
            L_event: {
                __compat: {
                    support: {a: {version_added: "2", version_removed: false}},
                },
            },
            M_event: {
                __compat: {
                    support: {a: {version_added: "1.9", version_removed: null}},
                },
            },
            should_be_ignored_underscores: {
                __compat: {
                    support: {a: {version_added: false}},
                },
            },
        },
    };

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
        },
        javascript: {builtins: builtins},
        api: {},
    });

    const [I0, I1, I2, I3] = data.getIssues([
        new ClientInfo("a", "Browser A", Version.create(3), Version.maxVal),
        new ClientInfo("a", "Browser A", Version.create(2), Version.create(5)),
        new ClientInfo("a", "Browser A", Version.minVal, Version.create(3)),
        new ClientInfo("a", "Browser A", Version.minVal, Version.maxVal),
    ], 0);

    expect(issueKinds([I0], "Foo")).toEqual([]);
    expect(issueKinds([I1], "Foo")).toEqual([]);
    expect(issueKinds([I2], "Foo")).toEqual([]);
    expect(issueKinds([I3], "Foo")).toEqual([]);

    expect(issueKinds([I0], "Foo.A")).toEqual([]);
    expect(issueKinds([I1], "Foo.A")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.A")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.A")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.B")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.B")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.B")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.B")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.C")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.C")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.C")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.C")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.D")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.D")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.D")).toEqual([]);
    expect(issueKinds([I3], "Foo.D")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.E")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.E")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.E")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.E")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.F")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.F")).toEqual([]);
    expect(issueKinds([I2], "Foo.F")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.F")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.G")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.G")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.G")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.G")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.H")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.H")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.H")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.H")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.I")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.I")).toEqual([]);
    expect(issueKinds([I2], "Foo.I")).toEqual([]);
    expect(issueKinds([I3], "Foo.I")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.J")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I1], "Foo.J")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I2], "Foo.J")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.J")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.K")).toEqual([]);
    expect(issueKinds([I1], "Foo.K")).toEqual([]);
    expect(issueKinds([I2], "Foo.K")).toEqual([]);
    expect(issueKinds([I3], "Foo.K")).toEqual([]);

    expect(issueKinds([I0], "Foo.@L")).toEqual([]);
    expect(issueKinds([I1], "Foo.@L")).toEqual([]);
    expect(issueKinds([I2], "Foo.@L")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.@L")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0], "Foo.@M")).toEqual([]);
    expect(issueKinds([I1], "Foo.@M")).toEqual([]);
    expect(issueKinds([I2], "Foo.@M")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(issueKinds([I3], "Foo.@M")).toEqual([IssueKind.NOT_SUPPORTED]);

    // tslint:disable-next-line: no-duplicate-string
    expect(issueKinds([I0], "Foo.should_be_ignored_underscores")).toEqual([]);
    expect(issueKinds([I1], "Foo.should_be_ignored_underscores")).toEqual([]);
    expect(issueKinds([I2], "Foo.should_be_ignored_underscores")).toEqual([]);
    expect(issueKinds([I3], "Foo.should_be_ignored_underscores")).toEqual([]);

});

test("CompatData.getIssues: Array support statements", () => {

    const f = (name: string, x: any, y: any = Version.MAX_MAJOR) =>
        issueKinds(data.getIssues(
            [new ClientInfo("a", "Browser A", ...Version.rangeFromString(x + "-" + y))], 0), name);

    const builtins = {
        Foo: {
            __compat: {
                support: {
                    a: [
                        {version_added: "6", flags: []},
                        {version_added: "12", version_removed: "16", notes: "Note-1"},
                        {version_added: "5", version_removed: "6", alternative_name: "foo2"},
                        {version_added: "1", version_removed: "2", prefix: "a"},
                        {version_added: "14"},
                        {version_added: "3", version_removed: "4", partial_implementation: true},
                        {version_added: "2", version_removed: "3"},
                        {version_added: "4", version_removed: "5", alternative_name: "foo"},
                    ],
                },
            },
        },
        Bar: {
            __compat: {
                support: {
                    a: [
                        {version_added: "2", version_removed: "2.4"},
                        {version_added: "2.8", version_removed: "2.15"},
                        {version_added: "3.2", version_removed: "3.2"},
                        {version_added: "3.6", version_removed: "4.3"},
                        {version_added: "6.1", version_removed: "7.0"},
                        {version_added: "7.10", version_removed: "7.20"},
                        {version_added: "7.20", version_removed: "7.26"},
                    ],
                },
            },
        },
        Baz: {
            __compat: {
                support: {
                    a: [
                        {version_added: "22.1", version_removed: "24"},
                        {version_added: "3", version_removed: "4"},
                        {version_added: "40"},
                        {version_added: "19.12", version_removed: "19.12"},
                        {version_added: "1.5", version_removed: "6.5"},
                        {version_added: "32"},
                        {version_added: "24", version_removed: "24"},
                        {version_added: "4.1", version_removed: "9"},
                        {version_added: "7.7", version_removed: "8.8"},
                        {version_added: "1", version_removed: "2.9"},
                        {version_added: "20", version_removed: "24"},
                        {version_added: "30"},
                        {version_added: "5.2", version_removed: "5.4"},
                        {version_added: "18", version_removed: "21.6"},
                        {version_added: "5", version_removed: "7.5"},
                        {version_added: "19.12", version_removed: "20.16"},
                        {version_added: "26", version_removed: "26"},
                        {version_added: "7.5", version_removed: "10"},
                    ],
                },
            },
        },
    };

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
        },
        javascript: {builtins: builtins},
        api: {},
    });

    expect(f("Foo", 0)).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(f("Foo", 1)).toEqual(expect.arrayContaining([
        IssueKind.NEEDS_ALT_NAME, IssueKind.NEEDS_FLAG,
        IssueKind.NEEDS_PREFIX, IssueKind.IS_PARTIAL_IMPL,
        IssueKind.NOTE]));

    expect(f("Foo", 2)).toEqual(expect.arrayContaining([
        IssueKind.NEEDS_ALT_NAME, IssueKind.NEEDS_FLAG,
        IssueKind.IS_PARTIAL_IMPL, IssueKind.NOTE]));

    expect(f("Foo", 3)).toEqual(f("Foo", 2));

    expect(f("Foo", 4)).toEqual(expect.arrayContaining([
        IssueKind.NEEDS_ALT_NAME, IssueKind.NEEDS_FLAG, IssueKind.NOTE]));

    expect(f("Foo", 5)).toEqual(expect.arrayContaining([
        IssueKind.NEEDS_ALT_NAME, IssueKind.NEEDS_FLAG, IssueKind.NOTE]));

    expect(f("Foo", 6)).toEqual(expect.arrayContaining([IssueKind.NEEDS_FLAG, IssueKind.NOTE]));

    expect(f("Foo", 12)).toEqual(expect.arrayContaining([IssueKind.NOTE]));

    expect(f("Foo", 14)).toEqual(expect.arrayContaining([IssueKind.NOTE]));

    expect(f("Foo", 16)).toEqual([]);

    expect(f("Foo", 2, "2." + Version.MAX_MINOR)).toEqual([]);

    expect(f("Foo", 2, 5)).toEqual(expect.arrayContaining([IssueKind.IS_PARTIAL_IMPL, IssueKind.NEEDS_ALT_NAME]));

    expect(f("Foo", 6, 11)).toEqual(expect.arrayContaining([IssueKind.NEEDS_FLAG]));

    expect(f("Foo", 6, 12)).toEqual(expect.arrayContaining([IssueKind.NEEDS_FLAG, IssueKind.NOTE]));

    expect(f("Bar", "2", "2.3")).toEqual([]);
    expect(f("Bar", "2", "2.4")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "3.2", "3.2")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "2.8", "2.14")).toEqual([]);
    expect(f("Bar", "3.2", "3.6")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "4.2", "6.2")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "6.2", "6.6")).toEqual([]);
    expect(f("Bar", "6.5", "6.9")).toEqual([]);
    expect(f("Bar", "7.10", "7.20")).toEqual([]);
    expect(f("Bar", "7.12", "7.19")).toEqual([]);
    expect(f("Bar", "7.10", "7.25")).toEqual([]);
    expect(f("Bar", "7.20", "7.25")).toEqual([]);
    expect(f("Bar", "7.15", "7.23")).toEqual([]);
    expect(f("Bar", "7.25", "7.25")).toEqual([]);
    expect(f("Bar", "7.21", "7.26")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "7.10", "7.26")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Bar", "7.26", "7.28")).toEqual([IssueKind.NOT_SUPPORTED]);

    expect(f("Baz", "1", "9")).toEqual([]);
    expect(f("Baz", "10", "17")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Baz", "18", "23")).toEqual([]);
    expect(f("Baz", "24", "29")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Baz", "26", "26")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Baz", "26.0", "26.0")).toEqual([IssueKind.NOT_SUPPORTED]);
    expect(f("Baz", "30", Version.MAX_MAJOR)).toEqual([]);

});

test("CompatData.getIssues: Flags", () => {

    const builtins = {
        Foo: {
            __compat: {
                support: {
                    a: {version_added: false},
                    b: {version_added: true, partial_implementation: true},
                    c: {version_added: true, notes: "Note-c"},
                    d: {version_added: true},
                    e: [
                        {version_added: "1", version_removed: "2", partial_implementation: true},
                        {version_added: "2", version_removed: "3", notes: "Note-e-1"},
                        {version_added: "3", version_removed: "4", notes: "Note-e-2", partial_implementation: true},
                        {version_added: "4", version_removed: "5", notes: "Note-e-3"},
                        {version_added: "5"},
                    ],
                },
            },
        },
    };

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
            b: {name: "Browser B"},
            c: {name: "Browser C"},
            d: {name: "Browser D"},
            e: {name: "Browser E"},
        },
        javascript: {builtins: builtins},
        api: {},
    });

    const targets1: ClientInfo[] = [
        new ClientInfo("a", "Browser A", Version.minVal, Version.maxVal),
        new ClientInfo("b", "Browser B", Version.minVal, Version.maxVal),
        new ClientInfo("c", "Browser C", Version.minVal, Version.maxVal),
        new ClientInfo("d", "Browser C", Version.minVal, Version.maxVal),
    ];

    expect(issues(data.getIssues(targets1, 0), "Foo")
        .map(x => x.clientInfo.name)).toEqual(expect.arrayContaining(["a", "b", "c"]));

    expect(issues(data.getIssues(targets1, ClientCompatCheckerFlags.IGNORE_NOTES), "Foo")
        .map(x => x.clientInfo.name)).toEqual(expect.arrayContaining(["a", "b"]));

    expect(issues(data.getIssues(targets1, ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL), "Foo")
        .map(x => x.clientInfo.name)).toEqual(expect.arrayContaining(["a", "c"]));

    expect(issues(data.getIssues(targets1,
        ClientCompatCheckerFlags.IGNORE_NOTES | ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL), "Foo")
        .map(x => x.clientInfo.name)).toEqual(expect.arrayContaining(["a"]));

    const targets2: ClientInfo[] = [
        new ClientInfo("e", "Browser E", Version.create(0), Version.maxVal),
        new ClientInfo("e", "Browser E", Version.create(1), Version.maxVal),
        new ClientInfo("e", "Browser E", Version.create(2), Version.maxVal),
        new ClientInfo("e", "Browser E", Version.create(3), Version.maxVal),
        new ClientInfo("e", "Browser E", Version.create(4), Version.maxVal),
        new ClientInfo("e", "Browser E", Version.create(5), Version.maxVal),
    ];

    expect(issues(data.getIssues(targets2, 0), "Foo")
        .map(x => x.clientInfo.minVersion.major)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));

    expect(issues(data.getIssues(targets2, ClientCompatCheckerFlags.IGNORE_NOTES), "Foo")
        .map(x => x.clientInfo.minVersion.major)).toEqual(expect.arrayContaining([0, 1, 2, 3]));

    expect(issues(data.getIssues(targets2, ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL), "Foo")
        .map(x => x.clientInfo.minVersion.major)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));

    expect(issues(data.getIssues(targets2,
        ClientCompatCheckerFlags.IGNORE_NOTES | ClientCompatCheckerFlags.IGNORE_PARTIAL_IMPL), "Foo")
        .map(x => x.clientInfo.minVersion.major)).toEqual(expect.arrayContaining([0]));

});

test("CompatData.getIssues: Ranged versions", () => {
    const builtins = {
        Foo: {
            __compat: {
                support: {a: {version_added: true}},
            },
            A: {
                __compat: {support: {a: {version_added: "≤10"}}},
            },
            B: {
                __compat: {support: {a: {version_added: true, version_removed: "≤10"}}},
            },
            C: {
                __compat: {support: {a: {version_added: "≤10", version_removed: "≤20"}}},
            },
            D: {
                __compat: {support: {a: {version_added: "10", version_removed: "≤20"}}},
            },
            E: {
                __compat: {support: {a: {version_added: "≤10", version_removed: "20"}}},
            }
        }
    };

    const data = new CompatData({
        browsers: {
            a: {name: "Browser A"},
        },
        javascript: {builtins: builtins},
        api: {},
    });

    const [I0, I1, I2, I3, I4] = data.getIssues([
        new ClientInfo("a", "Browser A", Version.minVal, Version.create(9)),
        new ClientInfo("a", "Browser A", Version.minVal, Version.create(19)),
        new ClientInfo("a", "Browser A", Version.minVal, Version.create(29)),
        new ClientInfo("a", "Browser A", Version.create(10), Version.create(19)),
        new ClientInfo("a", "Browser A", Version.create(10), Version.create(29)),
    ], 0);

    expect(issueKinds([I0, I1, I2, I3, I4], "Foo.A")).toEqual([]);

    expect(issueKinds([I0], "Foo.B")).toEqual([]);
    expect(issueKinds([I1, I2, I3, I4], "Foo.B")).toEqual([IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0, I1, I3], "Foo.C")).toEqual([]);
    expect(issueKinds([I2, I4], "Foo.C")).toEqual([IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I3], "Foo.D")).toEqual([]);
    expect(issueKinds([I0, I1, I2, I4], "Foo.D")).toEqual([IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED]);

    expect(issueKinds([I0, I1, I3], "Foo.E")).toEqual([]);
    expect(issueKinds([I2, I4], "Foo.E")).toEqual([IssueKind.NOT_SUPPORTED, IssueKind.NOT_SUPPORTED]);

});
