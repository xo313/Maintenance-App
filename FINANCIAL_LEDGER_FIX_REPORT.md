# Financial Ledger Fix Report

## Scope

This update fixes the synchronization gap between maintenance operations and the centralized `cash_transactions` ledger.

## Fixed issues

### 1. Editing an operation

Previously, editing an operation could change `paid_amount` and append to `payments` without updating `cash_transactions`.

The new implementation reconciles the operation's target cumulative paid amount against the existing `CUSTOMER_PAYMENT` ledger total for that operation.

- Increase in paid amount -> positive ledger/payment adjustment.
- Decrease in paid amount -> negative correction entry.
- Conversion to debt -> ledger is reduced to zero.
- Partial payment -> ledger is reconciled to the exact partial amount.
- Existing legacy payment rows without a matching cash transaction are also corrected when the operation is edited.

### 2. Deleting an operation

Previously, deleting an operation removed its `payments` and `operations` rows but left the corresponding cash ledger entries.

The new implementation removes all `CUSTOMER_PAYMENT` cash transactions referenced by the operation before deleting the operation. The operation's payment rows continue to be removed by the existing foreign-key cascade.

## Financial invariant

For every operation:

`SUM(cash_transactions.amount WHERE type='CUSTOMER_PAYMENT' AND reference_id=operation_id) = operations.paid_amount`

The invariant is maintained after add, edit, debt payment, and delete operations.

## Automated regression coverage

`test_operation_cash_ledger.ts` now verifies:

1. Initial cash operation.
2. Increasing the operation price/payment.
3. Decreasing the operation price/payment.
4. Converting cash to debt.
5. Setting a partial payment.
6. Deleting the operation.
7. Removal of all related payment and cash-ledger rows.

## Release note

The source-level financial fix is committed to `feature/uat-playwright`.

A new production EXE must be rebuilt from this source before delivery. Do not reuse an older installer because the compiled Electron artifact must contain the updated `operationsRepo` logic.

After rebuilding, run the full lint, TypeScript, build, migration, financial regression, Playwright/UAT, and EXE smoke/regression suites before declaring the release production-ready.
