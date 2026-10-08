import assert from "node:assert/strict";
import test from "node:test";
import { isMissingReviewsRelation } from "./queries";

test("missing reviews table is treated as a deploy gap, not a crash", () => {
  assert.equal(isMissingReviewsRelation({ code: "42P01", message: "relation does not exist" }), true);
  assert.equal(
    isMissingReviewsRelation({
      code: "PGRST205",
      message: "Could not find the table 'public.appointment_reviews' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingReviewsRelation({ code: "42501", message: "permission denied for table appointment_reviews" }),
    false,
  );
  assert.equal(isMissingReviewsRelation(null), false);
});
