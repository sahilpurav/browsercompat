import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

/**
 * Compiler host to be used for testing.
 */
class TestTSCompilerHost implements ts.CompilerHost {

    private m_sourceFile: ts.SourceFile | undefined;
    private m_libSourceFiles: Map<string, ts.SourceFile>;
    private m_sourceFileName: string;
    private m_options: ts.CompilerOptions;
    private m_libraryDir: string;

    public constructor(options: ts.CompilerOptions, libs: string[] = []) {
        this.m_sourceFileName = "__test.ts";
        this.m_libSourceFiles = new Map<string, ts.SourceFile>();
        this.m_options = options;
        this.m_libraryDir = path.dirname(ts.getDefaultLibFilePath(this.m_options));

        for (let i: number = 0; i < libs.length; i++) {
            this.addLib(libs[i]);
        }
    }

    public setSource(source: string): void {
        this.m_sourceFile = ts.createSourceFile(this.m_sourceFileName, source, ts.ScriptTarget.ESNext);
    }

    public addLib(fileName: string): void {
        if (fileName.indexOf(path.sep) === -1) {
            fileName = path.join(this.m_libraryDir, fileName);
        }

        let fd: number = -1;
        let text: string;
        try {
            fd = fs.openSync(fileName, "r");
            text = fs.readFileSync(fd, "utf8");
        }
        finally {
            if (fd !== -1) {
                fs.closeSync(fd);
            }
        }

        const sf: ts.SourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.ESNext);
        this.m_libSourceFiles.set(fileName, sf);
        this.m_libSourceFiles.set(path.basename(fileName), sf);
    }

    public getSourceFile(fileName: string, languageVersion: ts.ScriptTarget): ts.SourceFile | undefined {
        let sf: ts.SourceFile | undefined =
            (fileName === this.m_sourceFileName) ? this.m_sourceFile : this.m_libSourceFiles.get(fileName);

        if (sf !== undefined) {
            return sf;
        }

        const baseName: string = path.basename(fileName);
        if (baseName.startsWith("lib.")) {
            this.addLib(fileName);
            sf = this.m_libSourceFiles.get(fileName);
        }

        return sf;
    }

    public fileExists(filename: string): boolean {
        return this.getSourceFile(filename, ts.ScriptTarget.ESNext) !== undefined;
    }

    public readFile(filename: string): string {
        const sf: ts.SourceFile | undefined = this.getSourceFile(filename, ts.ScriptTarget.ESNext);
        return (sf !== undefined) ? sf.text : "";
    }

    public writeFile(name: string, text: string, writeByteOrderMark: boolean): void {
        throw new Error("Test compiler host cannot write files.");
    }

    public getDefaultLibFileName(): string {
        return ts.getDefaultLibFileName(this.m_options);
    }

    public useCaseSensitiveFileNames() {
        return false;
    }

    public getCanonicalFileName(filename: string) {
        return filename;
    }

    public getCurrentDirectory(): string {
        return "";
    }

    public getNewLine(): string {
        return "\n";
    }

    public createProgram(): ts.Program {
        return ts.createProgram([this.m_sourceFileName], this.m_options, this);
    }

    public getMainSourceFile(): ts.SourceFile {
        if (this.m_sourceFile === undefined) {
            throw new Error("No source set.");
        }
        return this.m_sourceFile;
    }

}

export default TestTSCompilerHost;
