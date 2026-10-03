import assert from "node:assert/strict";
import test from "node:test";
import { shouldSendPatientNotice } from "../src/notification_decision";

test("only a confirmed appointment can send a patient-safe visual notice", () => {
  assert.equal(shouldSendPatientNotice("confirmed"), true);
  assert.equal(shouldSendPatientNotice("pending"), false);
  assert.equal(shouldSendPatientNotice("cancelled"), false);
});
