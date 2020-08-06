/* tslint:disable no-big-function max-line-length no-duplicate-string mccabe-complexity cognitive-complexity */

import CompatData from "../src/CompatData";
import {IssueKind} from "../src/Issue";
import IssueWithLocation from "../src/IssueWithLocation";
import {parseTargets, parseWhitelist, Rule} from "../src/supportedBrowsersRule";
import Version from "../src/Version";
import Whitelist from "../src/Whitelist";

import TestTSCompilerHost from "./TestTSCompilerHost";

import * as ts from "typescript";

const _compilerHost: TestTSCompilerHost = new TestTSCompilerHost(
    {
        alwaysStrict: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
    },
    ["lib.dom.d.ts"],
);

function executeRule(source: string, ruleArgs: any): readonly IssueWithLocation[] {
    _compilerHost.setSource(source);

    const program: ts.Program = _compilerHost.createProgram();
    const sourceFile: ts.SourceFile = _compilerHost.getMainSourceFile();

    const rule: Rule = new Rule({
        disabledIntervals: [],
        ruleArguments: [ruleArgs],
        ruleName: "browserlint",
        ruleSeverity: "warning",
    });
    rule.applyWithProgram(sourceFile, program);

    const issues: IssueWithLocation[] = rule.issuesFound.slice();
    issues.sort((x, y) => {
        if (x.sourceLineNum !== y.sourceLineNum) {
            return (x.sourceLineNum < y.sourceLineNum) ? -1 : 1;
        }
        if (x.sourceCharNum !== y.sourceCharNum) {
            return (x.sourceCharNum < y.sourceCharNum) ? -1 : 1;
        }
        if (x.issue.clientInfo.name !== y.issue.clientInfo.name) {
            return (x.issue.clientInfo.name < y.issue.clientInfo.name) ? -1 : 1;
        }
        if (x.issue.featureName !== y.issue.featureName) {
            return (x.issue.featureName < y.issue.featureName) ? -1 : 1;
        }
        return Version.compare(x.issue.startVersion, y.issue.startVersion);
    });

    return issues;
}

test("parseTargets", () => {
    const cd: CompatData = new CompatData();

    expect(
        parseTargets({
            ie: 3, firefox: "5", chrome: "4.5", opera: ">=10.10", safari: "<=10", firefox_android: "10-30", edge: "*", webview_android: 12.5,
        })
        .sort((x, y) => (x.name < y.name) ? -1 : 1),
    )
    .toMatchObject([
        {name: "chrome",           minVersion: {major: 4, minor: 5},         maxVersion: Version.maxVal                         },
        {name: "edge",             minVersion: cd.getFirstVersion("edge"),   maxVersion: Version.maxVal                         },
        {name: "firefox",          minVersion: {major: 5, minor: 0},         maxVersion: Version.maxVal                         },
        {name: "firefox_android",  minVersion: {major: 10, minor: 0},        maxVersion: {major: 30, minor: Version.MAX_MINOR}  },
        {name: "ie",               minVersion: {major: 3, minor: 0},         maxVersion: Version.maxVal                         },
        {name: "opera",            minVersion: {major: 10, minor: 10},       maxVersion: Version.maxVal                         },
        {name: "safari",           minVersion: cd.getFirstVersion("safari"), maxVersion: {major: 10, minor: Version.MAX_MINOR}  },
        {name: "webview_android",  minVersion: {major: 12, minor: 0},        maxVersion: Version.maxVal                         },
    ]);

    expect(parseTargets(undefined)).toEqual([]);

    expect(() => parseTargets({fireox: 5})).toThrow();
    expect(() => parseTargets({opera: "5-4"})).toThrow();
    expect(() => parseTargets({chrome: "foo"})).toThrow();
    expect(() => parseTargets({safari: true})).toThrow();
    expect(() => parseTargets({webview_android: [1, 2]})).toThrow();
    expect(() => parseTargets("firefox: 5")).toThrow();
    expect(() => parseTargets([{firefox: 5}])).toThrow();
});

test("parseWhitelist", () => {

    let w: Whitelist;

    w = parseWhitelist(["A", "B", "C", "A.x", "A.y", "C.@x", "D.x", "D.@y"]);

    expect(w.isGlobalWhitelisted("A")).toBe(true);
    expect(w.isGlobalWhitelisted("B")).toBe(true);
    expect(w.isGlobalWhitelisted("C")).toBe(true);
    expect(w.isGlobalWhitelisted("D")).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("A", "x", false)).toBe(true);
    expect(w.isPropertyOrEventWhitelisted("A", "y", false)).toBe(true);
    expect(w.isPropertyOrEventWhitelisted("B", "x", false)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("B", "y", false)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("C", "x", false)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("C", "y", false)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("C", "x", true)).toBe(true);
    expect(w.isPropertyOrEventWhitelisted("C", "y", true)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("D", "x", false)).toBe(true);
    expect(w.isPropertyOrEventWhitelisted("D", "y", false)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("D", "x", true)).toBe(false);
    expect(w.isPropertyOrEventWhitelisted("D", "y", true)).toBe(true);

    expect(() => parseWhitelist("A")).toThrow();
    expect(() => parseWhitelist({A: ["x", "y"]})).toThrow();
    expect(() => parseWhitelist(["A", "B", 1, "D"])).toThrow();

});

test("Should not have any issues", () => {

    expect(executeRule(
        `
        Object();
        {{Number();}}
        function foo() {String();}
        Boolean();
        "Hello".length;
        "Hello".substring(0).indexOf("H");
        let d: Date = new Date();
        d.getHours();
        d.getYear();
        parseInt("1") + parseFloat("1") * 1000;
        escape();
        unescape();
        eval();
        isNaN();
        Math.PI;
        Math.cos(1);

        class Foo<T> {}
        let x: Foo<Foo<String>>;
        let y: String | (Number & Foo<Boolean>) | Date;
        `,
        {
            targets: {ie: 3, firefox: "*", chrome: "*", edge: "*", opera: "3", safari: "*", firefox_android: "*", chrome_android: "*", safari_ios: "*", samsunginternet_android: "*", webview_android: "*", nodejs: "*"},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        new Array();
        new Function();
        [].concat([1, 2, 3])[0];
        /[Hh]ello+/g.test("Hellooooooo");
        (new Date()).getFullYear();
        isFinite();
        new ReferenceError();
        new SyntaxError();
        let f = (encodeURIComponent("foo"));
        `,
        {
            targets: {ie: ">=5.5", firefox: "*", chrome: "*", edge: "*", opera: 7, safari: "1.1", firefox_android: "*", chrome_android: "*", safari_ios: "*", samsunginternet_android: "*", webview_android: "*", nodejs: "*"},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        BigInt();
        WebAssembly();
        new BigInt64Array();
        Promise.allSettled();
        Intl.PluralRules;
        `,
        {
            targets: {firefox: 68, chrome: 67, opera: 54, nodejs: "10.4", webview_android: 67},
            whitelist: ["Promise.allSettled"],
        },
    )).toEqual([]);

    expect(executeRule(
        "JSON.parse(JSON.stringify({}));",
        {
            targets: {ie: "*", edge: "*", firefox: "*", chrome: "*", safari: "*"},
            whitelist: ["JSON", "JSON.parse", "JSON.stringify"],
        },
    )).toEqual([]);

    expect(executeRule(
        `
        let e: Element;
        e.addEventListener("wheel", null);
        window.addEventListener("storage", null);
        `,
        {
            targets: {firefox: 68, chrome: 67, opera: 54, webview_android: 67},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        let e: Element;
        e.addEventListener("wheel", null);
        e.addEventListener("touchstart", e => {});
        window.addEventListener("storage", e => {});
        `,
        {
            targets: {firefox: 30, chrome: 30, ie: 9},
            whitelist: ["Element.@wheel", "Element.@touchstart", "Window.@*", "WindowOrWorkerGlobalScope.@*"],
        },
    )).toEqual([]);

    expect(executeRule(
        "window.requestAnimationFrame();",
        {
            targets: {firefox: 23, firefox_android: 23, chrome: 24, opera: 15},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        let el: Element;
        el.requestFullscreen();
        `,
        {
            targets: {firefox: 64, opera: 58, opera_android: 50, chrome: 69, webview_android: 69},
        },
    )).toEqual([]);

    expect(executeRule(
        "crypto.subtle.decrypt()",
        {
            targets: {ie: 11, edge: "*", firefox: 34, safari: "10.1", safari_ios: "10.3"},
        },
    )).toMatchObject([]);

});

test("Issues should match", () => {

    expect(executeRule(
        `
        Object.values({a: 10});
        for (let i: number = 0; i < 100; i++) { "abcd".padStart(10); }
        function f() { return Math.clz32(100); }
        if ([1, 2, 3].includes(1)) { console.log("Hello"); }
        /Hello, [0-9]+/.sticky;
        Promise["resolve"]();
        Promise.resolve();
        `,
        {
            targets: {ie: 11, firefox: 30},
            whitelist: ["String.padStart", "Array.*", "Promise.resolve"],
        },
    )).toMatchObject([
        {sourceLineNum: 1,  sourceCharNum: 15, issue: {featureName: "Object.values", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "firefox"}}},
        {sourceLineNum: 1,  sourceCharNum: 15, issue: {featureName: "Object.values", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 3,  sourceCharNum: 35, issue: {featureName: "Math.clz32",    kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "firefox"}}},
        {sourceLineNum: 3,  sourceCharNum: 35, issue: {featureName: "Math.clz32",    kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 5,  sourceCharNum: 24, issue: {featureName: "RegExp.sticky", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 6,  sourceCharNum: 8,  issue: {featureName: "Promise",       kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 7,  sourceCharNum: 8,  issue: {featureName: "Promise",       kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
    ]);

    expect(executeRule(
        `
        class Foo<T, U> {}
        let x: Foo<Int32Array, Foo<string, Promise<number>>;
        function y(
            a: string | (AudioContext & Promise<string>) | Foo<ImageData, Worker>
        ): OscillatorNode | IDBDatabase {}
        class Bar {
            public x: Geolocation;
            public y(a: number, b: Foo<Map<string, string>>): Symbol[];
        }
        interface IBar {
            x: AudioContext;
            y(a: BigInt | (RegExp & Int8Array)): HTMLCanvasElement | undefined;
            [x: string]: Geolocation;
        }
        function f<T extends Int32Array>(): Symbol {}
        let g = f();
        `,
        {
            targets: {ie: 6},
        },
    )).toMatchObject([
        {sourceLineNum: 2,  sourceCharNum: 19, issue: {featureName: "Int32Array",        clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 2,  sourceCharNum: 43, issue: {featureName: "Promise",           clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 4,  sourceCharNum: 25, issue: {featureName: "AudioContext",      clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 4,  sourceCharNum: 40, issue: {featureName: "Promise",           clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 4,  sourceCharNum: 63, issue: {featureName: "ImageData",         clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 4,  sourceCharNum: 74, issue: {featureName: "Worker",            clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 5,  sourceCharNum: 11, issue: {featureName: "OscillatorNode",    clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 5,  sourceCharNum: 28, issue: {featureName: "IDBDatabase",       clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 7,  sourceCharNum: 22, issue: {featureName: "Geolocation",       clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 8,  sourceCharNum: 39, issue: {featureName: "Map",               clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 8,  sourceCharNum: 62, issue: {featureName: "Symbol",            clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 11, sourceCharNum: 15, issue: {featureName: "AudioContext",      clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 12, sourceCharNum: 17, issue: {featureName: "BigInt",            clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 12, sourceCharNum: 36, issue: {featureName: "Int8Array",         clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 12, sourceCharNum: 49, issue: {featureName: "HTMLCanvasElement", clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 13, sourceCharNum: 25, issue: {featureName: "Geolocation",       clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 15, sourceCharNum: 29, issue: {featureName: "Int32Array",        clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 15, sourceCharNum: 44, issue: {featureName: "Symbol",            clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
        {sourceLineNum: 16, sourceCharNum: 12, issue: {featureName: "Symbol",            clientInfo: {name: "ie"}, kind: IssueKind.NOT_SUPPORTED}},
    ]);

    expect(executeRule(
        "window.requestAnimationFrame()",
        {
            targets: {firefox: "4-22", firefox_android: "14-22", chrome: 23, opera: "<=15"},
        },
    )).toMatchObject([
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "chrome"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "webkit"},
        },
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "moz", startVersion: {major: 4}},
        },
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "moz", startVersion: {major: 11}},
        },
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox_android"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "moz", startVersion: {major: 14}},
        },
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "opera"}, kind: IssueKind.NOT_SUPPORTED},
        },
    ]);

    expect(executeRule(
        "window.requestAnimationFrame();",
        {
            targets: {firefox: 23, firefox_android: 23, chrome: 24, opera: 15},
            showNotes: true,
        },
    )).toMatchObject([
        {
            sourceLineNum: 0,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox"}, kind: IssueKind.NOTE, startVersion: {major: 23}},
        },
    ]);

    expect(executeRule(
        `
        let el: Element;
        el.requestFullscreen();
        `,
        {
            targets: {ie: 11, edge: "<=13", firefox: 63, opera: 13, safari_ios: ">=6"},
        },
    )).toMatchObject([
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "edge"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "webkit", endVersion: {major: 14}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_ALT_NAME, altOrPrefix: "mozRequestFullScreen", startVersion: {major: 9}, endVersion: {major: 65}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_FLAG, startVersion: {major: 47}, endVersion: {major: 65}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "ie"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "ms", startVersion: {major: 11}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "opera"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "o", startVersion: {major: 12}, endVersion: {major: 15}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "opera"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "webkit", startVersion: {major: 15}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Element.requestFullscreen", clientInfo: {name: "safari_ios"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "webkit"},
        },
    ]);

    expect(executeRule(
        `
        let el: Element;
        el.addEventListener("touchstart", e => {});
        `,
        {
            targets: {ie: 11, safari: 10, safari_ios: "*", edge: 12, chrome: 30, firefox: 30, firefox_android: 6},
        },
    )).toMatchObject([
        {sourceLineNum: 2, sourceCharNum: 28, issue: {featureName: "Element.touchstart", clientInfo: {name: "firefox"}}},
        {sourceLineNum: 2, sourceCharNum: 28, issue: {featureName: "Element.touchstart", clientInfo: {name: "ie"}}},
        {sourceLineNum: 2, sourceCharNum: 28, issue: {featureName: "Element.touchstart", clientInfo: {name: "safari"}}},
    ]);

    expect(executeRule(
        "crypto.subtle.decrypt()",
        {
            targets: {ie: 11, edge: "*", firefox: 34, safari: "10.1", safari_ios: "10.3"},
            showPartialImplementations: true,
        },
    )).toMatchObject([
        {sourceCharNum: 7,  issue: {featureName: "Crypto.subtle",        clientInfo: {name: "ie"}, kind: IssueKind.IS_PARTIAL_IMPL}},
        {sourceCharNum: 14, issue: {featureName: "SubtleCrypto.decrypt", clientInfo: {name: "edge"}, kind: IssueKind.IS_PARTIAL_IMPL}},
        {sourceCharNum: 14, issue: {featureName: "SubtleCrypto.decrypt", clientInfo: {name: "ie"}, kind: IssueKind.IS_PARTIAL_IMPL}},
    ]);

});

test("Should not report guarded uses", () => {

    expect(executeRule(
        `
        if (typeof(JSON) !== "undefined" && JSON.parse) { JSON.parse("{}"); }
        if (typeof(Array) !== "undefined" && Array.prototype.slice) { [1, 2].slice(); }
        if (typeof(Array) !== "undefined" && ["Foo"].slice) { [1, 2].slice(); }
        if (typeof(Array) !== "undefined") { if (Array.prototype.slice) { [1, 2].slice(); } }
        if (typeof(Array) !== "undefined") { if (["Foo"].slice) { [1, 2].slice(); } }
        if (typeof(RegExp) !== "undefined" && /regex/.sticky !== undefined) { (new RegExp("")).sticky; }
        if (Object.values) { Object.values({a: 10}); } else { }
        if (!Object.values) { } else { Object.values({a: 10}); }
        typeof(JSON) !== "undefined" && JSON.parse && JSON.parse("{}");
        !Object.values || Object.values({a: 10});
        if (typeof(Array) === "undefined" || !Array.prototype.slice) { } else { [1, 2].slice(); }
        Math.cbrt ? Math.cbrt(100) : Math.sqrt(100);
        !Math.cbrt ? Math.sqrt(100) : Math.cbrt(100);
        function f(x: number): boolean { return (typeof(isNaN) !== "undefined") ? isNaN(x) : (x !== x); }
        z = (typeof(JSON) === "object" && JSON.stringify) ? JSON.stringify(1000) : "";
        z = (typeof(JSON) === "undefined" || !JSON.stringify) ? "" : JSON.stringify(1000);

        class Foo<T, U> {}
        if (typeof(HTMLCanvasElement) !== "undefined" && typeof(AudioContext) !== "undefined") {
            let c: HTMLCanvasElemnt | undefined = new HTMLCanvasElement();
            let z: Foo<HTMLCanvasElement, AudioContext>;
        }
        `,
        {
            targets: {ie: 3, firefox: 1},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        if (typeof(AudioContext) !== "undefined") { new AudioContext(); } else { new AudioContext(); }
        if (!Object.values) { Object.values({a: 10}); }
        Math.cbrt ? Math.sqrt(100) : Math.cbrt(100);
        `,
        {
            targets: {firefox: 1},
        },
    )).toMatchObject([
        {sourceLineNum: 1, issue: {featureName: "AudioContext"}},
        {sourceLineNum: 2, issue: {featureName: "Object.values"}},
        {sourceLineNum: 3, issue: {featureName: "Math.cbrt"}},
    ]);

});

test("Window for TS >= 3.6", () => {

    expect(executeRule(
        `
        let w: Window & typeof globalThis;
        w.navigator;
        w.requestAnimationFrame();
        w.addEventListener("mouseenter", e => {});
        w.addEventListener("storage", e => {});
        `,
        {
            targets: {firefox: 45, chrome: 24},
        },
    )).toEqual([]);

    expect(executeRule(
        `
        let w: Window & typeof globalThis;
        w.requestAnimationFrame();
        `,
        {
            targets: {firefox: "4-22"},
        },
    )).toMatchObject([
        {
            sourceLineNum: 2,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "moz", startVersion: {major: 4}},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Window.requestAnimationFrame", clientInfo: {name: "firefox"}, kind: IssueKind.NEEDS_PREFIX, altOrPrefix: "moz", startVersion: {major: 11}},
        },
    ]);

    expect(executeRule(
        `
        let w: Window & typeof globalThis;
        w.addEventListener("storage", null);
        `,
        {
            targets: {opera: 14, firefox: 44},
        },
    )).toMatchObject([
        {
            sourceLineNum: 2,
            issue: {featureName: "Window.storage", clientInfo: {name: "firefox"}, kind: IssueKind.NOT_SUPPORTED},
        },
        {
            sourceLineNum: 2,
            issue: {featureName: "Window.storage", clientInfo: {name: "opera"}, kind: IssueKind.NOT_SUPPORTED},
        },
    ]);

});

test("Base properties and events of inherited classes", () => {

    expect(executeRule(
        `
        class MyRegExp1 extends RegExp {}
        class MyRegExp2 extends MyRegExp1 {}
        (new MyRegExp1()).sticky;
        (new MyRegExp2()).sticky;
        `,
        {
            targets: {ie: 11, firefox: 30},
        },
    )).toMatchObject([
        {sourceLineNum: 3, sourceCharNum: 26, issue: {featureName: "RegExp.sticky", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 4, sourceCharNum: 26, issue: {featureName: "RegExp.sticky", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
    ]);

    expect(executeRule(
        `
        class MyElement extends Element {}
        let el: MyElement;
        el.addEventListener("touchstart", e => {});
        `,
        {
            targets: {ie: 11, safari: 10, safari_ios: "*", edge: 12, chrome: 30, firefox: 30, firefox_android: 6},
        },
    )).toMatchObject([
        {sourceLineNum: 3, sourceCharNum: 28, issue: {featureName: "Element.touchstart", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "firefox"}}},
        {sourceLineNum: 3, sourceCharNum: 28, issue: {featureName: "Element.touchstart", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
        {sourceLineNum: 3, sourceCharNum: 28, issue: {featureName: "Element.touchstart", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "safari"}}},
    ]);

});

test("Only library defined properties must be checked", () => {

    expect(executeRule(
        `
        namespace foo {
            class Array<T> {
                public includes(x: T): boolean { return false; }
            }
            class Navigator {
                public serviceWorker: any;
            }
            let a: Array<number>;
            a.includes(0);
            let navigator: Navigator;
            navigator.serviceWorker;
        }
        let a: Array<number>;
        a.includes(0);
        `,
        {
            targets: {ie: 8, firefox: 30},
        },
    )).toMatchObject([
        {sourceLineNum: 14, issue: {featureName: "Array.includes", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "firefox"}}},
        {sourceLineNum: 14, issue: {featureName: "Array.includes", kind: IssueKind.NOT_SUPPORTED, clientInfo: {name: "ie"}}},
    ]);

});

test("Properties of tuple and readonly types", () => {

    expect(executeRule(
        `
        let x: [number, number] = [1, 2, 3];
        x.length;
        x.includes(1);

        let y: readonly number[] = [1, 2, 3];
        y.includes(1);

        let set: ReadonlySet<string>;
        set.entries();

        let map: ReadonlyMap<string, string>;
        map.entries();
        `,
        {
            targets: {ie: 11},
        }
    )).toMatchObject([
        {sourceLineNum: 3,  issue: {featureName: "Array.includes"}},
        {sourceLineNum: 6,  issue: {featureName: "Array.includes"}},
        {sourceLineNum: 9,  issue: {featureName: "Set.entries"}},
        {sourceLineNum: 12, issue: {featureName: "Map.entries"}},
    ]);

});
