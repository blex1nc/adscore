// assertNeverActivate + bütçe kilidi testleri (AGENT-A §5 madde 5).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MetaGuardError,
  assertSafePayloadCore,
  toMinorUnits,
} from "../guards-core";

const plan = { budgetAmount: "350.75", currency: "TRY" };

// --- assertNeverActivate davranışı ---

test("assertNeverActivate: create'te status ACTIVE reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { name: "K", status: "ACTIVE" },
      }),
    MetaGuardError,
  );
});

test("assertNeverActivate: update'te status ACTIVE reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({ kind: "update", payload: { status: "ACTIVE" } }),
    MetaGuardError,
  );
});

test("assertNeverActivate: iç içe alanda bile ACTIVE reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: {
          status: "PAUSED",
          adset_spec: { status: "ACTIVE" },
        },
      }),
    MetaGuardError,
  );
});

test("assertNeverActivate: küçük harf 'active' de reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "active" },
      }),
    MetaGuardError,
  );
});

// --- create kuralları ---

test("create: status yoksa reddedilir (PAUSED zorunlu)", () => {
  assert.throws(
    () => assertSafePayloadCore({ kind: "create", payload: { name: "K" } }),
    MetaGuardError,
  );
});

test("create: PAUSED + bütçesiz payload geçer (kampanya, CBO'suz)", () => {
  assert.doesNotThrow(() =>
    assertSafePayloadCore({
      kind: "create",
      payload: { name: "K", status: "PAUSED", objective: "OUTCOME_SALES" },
    }),
  );
});

test("create: bütçe plana eşit ve tavan altındaysa geçer", () => {
  assert.doesNotThrow(() =>
    assertSafePayloadCore({
      kind: "create",
      payload: { status: "PAUSED", daily_budget: 35075 },
      plan,
      maxDailyBudget: "500",
    }),
  );
});

test("create: bütçe plandan farklıysa reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "PAUSED", daily_budget: 35076 },
        plan,
        maxDailyBudget: "500",
      }),
    MetaGuardError,
  );
});

test("create: bütçe workspace tavanını aşarsa reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "PAUSED", daily_budget: 35075 },
        plan,
        maxDailyBudget: "300",
      }),
    MetaGuardError,
  );
});

test("create: bütçe var ama plan verilmemişse reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "PAUSED", lifetime_budget: 1000 },
      }),
    MetaGuardError,
  );
});

test("create: bütçe var ama tavan ayarlanmamışsa reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "PAUSED", daily_budget: 35075 },
        plan,
        maxDailyBudget: null,
      }),
    MetaGuardError,
  );
});

test("create: bütçe minör birimde tamsayı değilse reddedilir", () => {
  assert.throws(
    () =>
      assertSafePayloadCore({
        kind: "create",
        payload: { status: "PAUSED", daily_budget: "350.75" },
        plan,
        maxDailyBudget: "500",
      }),
    MetaGuardError,
  );
});

// --- update kuralları ---

for (const field of ["status", "daily_budget", "lifetime_budget", "bid_amount"]) {
  test(`update: ${field} alanı tümüyle yasak`, () => {
    assert.throws(
      () =>
        assertSafePayloadCore({
          kind: "update",
          payload: { [field]: field === "status" ? "PAUSED" : 100 },
        }),
      MetaGuardError,
    );
  });
}

test("update: zararsız alanlar (name vb.) geçer", () => {
  assert.doesNotThrow(() =>
    assertSafePayloadCore({ kind: "update", payload: { name: "Yeni ad" } }),
  );
});

// --- toMinorUnits ---

test("toMinorUnits: TRY 350.75 → 35075", () => {
  assert.equal(toMinorUnits("350.75", "TRY"), 35075);
});

test("toMinorUnits: tam sayı 500 → 50000 (offset 100)", () => {
  assert.equal(toMinorUnits("500", "TRY"), 50000);
});

test("toMinorUnits: tek ondalık 10.5 → 1050", () => {
  assert.equal(toMinorUnits("10.5", "USD"), 1050);
});

test("toMinorUnits: JPY (offset 1) tam birim: 1000 → 1000", () => {
  assert.equal(toMinorUnits("1000", "JPY"), 1000);
});

test("toMinorUnits: JPY kesirli tutar reddedilir", () => {
  assert.throws(() => toMinorUnits("10.5", "JPY"), MetaGuardError);
});

test("toMinorUnits: 2'den çok anlamlı ondalık reddedilir", () => {
  assert.throws(() => toMinorUnits("10.999", "TRY"), MetaGuardError);
});

test("toMinorUnits: sayısal olmayan girdi reddedilir", () => {
  assert.throws(() => toMinorUnits("10,50", "TRY"), MetaGuardError);
  assert.throws(() => toMinorUnits("-5", "TRY"), MetaGuardError);
});
