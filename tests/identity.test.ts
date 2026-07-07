import { describe, it, expect, beforeEach } from "vitest";
import { getPlayer, setNickname } from "../src/lib/identity";

describe("identity", () => {
  beforeEach(() => localStorage.clear());

  it("mints a stable id across repeated calls", () => {
    const first = getPlayer();
    const second = getPlayer();
    expect(first.id).toBe(second.id);
    expect(first.id.length).toBeGreaterThan(0);
  });

  it("starts with an empty nickname", () => {
    expect(getPlayer().nickname).toBe("");
  });

  it("persists a nickname set via setNickname", () => {
    setNickname("บัวลอย");
    expect(getPlayer().nickname).toBe("บัวลอย");
  });

  it("keeps the same id after the nickname changes", () => {
    const before = getPlayer().id;
    setNickname("มะลิ");
    expect(getPlayer().id).toBe(before);
  });
});
