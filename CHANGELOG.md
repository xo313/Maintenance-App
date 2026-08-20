# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-08-20

### Added
- **Financial System**: Introduced the new unified `cash_transactions` ledger for centralizing all cash flow operations.
- **Suppliers**: Full support for supplier lifecycle, purchasing, component tracking, and supplier debt management.
- **Expenses**: Standalone expenses tracking via `shop_expenses`, properly segregated from operations profit.
- **Dashboard**: Fully modernized financial dashboard strictly built on raw SQLite aggregations. Added distinct breakdowns for Shop Operation Profit vs Net Shop Profit vs Cash flow.
- **Security**: Upgraded Backup protocol with explicit verification checks (SQLite binary snapshots via `.backup()`) replacing the fragile JSON dump mechanic.

### Changed
- **Database**: Shifted core application architecture to standard multi-table SQLite schema in WAL mode with Foreign Key restraints, deprecating the monolithic JSON store.
- **UI**: Reworked specific dashboard components to handle independent streams of financial states (Cash vs Expected profit).
- **Testing**: Scaled up Playwright test suites to encompass 41 comprehensive end-to-end tests validating 100% of the lifecycle actions.

### Fixed
- **Financial System**: Eradicated the root cause of "Double Counting" inside the migration procedure where legacy operations generated duplicated theoretical cash entries.
- **Database**: Addressed a critical migration edge case where direct JSON string ingestion bypassed `cash_transactions` hydration, leading to 0 cash balances for legacy imports.
- **UI**: Resolved RTL anomalies and mojibake rendering glitches across specific older system locales.
