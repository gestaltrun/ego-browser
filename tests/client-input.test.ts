import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/client/index.ts", import.meta.url), "utf8");

describe("watch panel input and capture status", () => {
  it("provides IME input through the shared keyboard proxy", () => {
    expect(source).toMatch(/function createKeyboardProxy\(send\)/);
    expect(source).toMatch(/compositionend/);
    expect(source).toMatch(/send\([^,]+, 'insertText'/);
    expect(source).toMatch(/keyboardProxy\.focusAt\(e,/);
  });

  it("does not gate control input on stream state or default missing status to CDP", () => {
    expect(source).not.toMatch(/status\.backend \|\| 'cdp'/);
    expect(source).not.toMatch(/targetValid[^\n]+streamState !== 'streaming'/);
  });

  it("keeps the FFmpeg option disabled until installation is ready", () => {
    expect(source).toMatch(/disabled: !ffmpegStatus\.canSelectFfmpeg/);
    expect(source).toMatch(/ffmpeg-install/);
    expect(source).toMatch(/githubMirror/);
  });
});
