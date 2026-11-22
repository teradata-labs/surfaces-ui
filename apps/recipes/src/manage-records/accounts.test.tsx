// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Accounts } from "./Accounts.js";
import { type Account, memoryAccounts } from "./api.js";

afterEach(cleanup);

/** 120 accounts: Ana (the person using the page) and 119 others, three of them already turned off. */
function accounts(): Account[] {
  const people: Account[] = [{ id: "ana", name: "Ana Admin", email: "ana@example.com", off: false, owns: 3 }];
  for (let i = 1; i < 120; i++) {
    const n = String(i).padStart(3, "0");
    people.push({ id: `p${n}`, name: `Person ${n}`, email: `person${n}@example.com`, off: i <= 3, owns: i % 7 });
  }
  return people;
}

const table = () => screen.getByRole("table", { name: "Accounts" });
const names = () => within(table()).queryAllByRole("rowheader").map((cell) => cell.textContent);
const settle = () => act(async () => {});

describe("accounts a person manages", () => {
  it("shows one page the server sorted, and asks the server again to sort or page", async () => {
    const api = memoryAccounts(accounts(), "ana");
    const list = vi.spyOn(api, "list");
    render(<Accounts api={api} me="ana" />);
    await settle();
    expect(names()).toHaveLength(50);
    expect(names()[0]).toBe("Ana Admin");
    expect(screen.getByText("1–50 of 120")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Owns/ }));
    await settle();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "owns", desc: false, offset: 0 }));

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await settle();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 50, limit: 50 }));
    expect(screen.getByText("51–100 of 120")).toBeTruthy();
  });

  it("turns off everyone who matches, past this page, after asking, and says whom it left alone", async () => {
    const api = memoryAccounts(accounts(), "ana");
    const bulk = vi.spyOn(api, "bulk");
    render(<Accounts api={api} me="ana" />);
    await settle();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select every row on this page" }));
    fireEvent.click(screen.getByRole("button", { name: "Select all 120 that match" }));
    expect(screen.getByText("120 selected")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("group", { name: "With the selected rows" })).getByRole("button", { name: "Turn off" }));

    const dialog = screen.getByRole("dialog", { name: "Turn off 120 accounts?" });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Turn off" })));

    // The server got the search, not 120 ids, and checked its own rules for each person.
    expect(bulk).toHaveBeenCalledWith("turn-off", { match: { q: "", status: "" } });
    expect(api.accounts.filter((a) => a.off)).toHaveLength(119);
    expect(api.accounts.find((a) => a.id === "ana")!.off).toBe(false);
    expect(screen.getByText("Turned off 116 accounts")).toBeTruthy();
    expect(screen.getByText("Left 4 alone.")).toBeTruthy();
    expect(screen.getByText("Skipped: you cannot turn off your own account")).toBeTruthy();
    expect(screen.getAllByText("Skipped: already turned off")).toHaveLength(3);
  });

  it("does nothing when the person thinks better of it", async () => {
    const api = memoryAccounts(accounts(), "ana");
    render(<Accounts api={api} me="ana" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Turn off Person 010" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
    expect(api.accounts.find((a) => a.id === "p010")!.off).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("starts a new search from the first page with nothing chosen", async () => {
    const api = memoryAccounts(accounts(), "ana");
    render(<Accounts api={api} me="ana" />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await settle();
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Person 060" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find someone" }), { target: { value: "Person 06" } });
    await settle();
    expect(names()).toEqual(["Person 060", "Person 061", "Person 062", "Person 063", "Person 064", "Person 065", "Person 066", "Person 067", "Person 068", "Person 069"]);
    expect(screen.queryByRole("group", { name: "With the selected rows" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Pages" })).toBeNull();
  });
});
