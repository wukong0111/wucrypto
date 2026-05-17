## ADDED Requirements

### Requirement: User can save a personal CoinGecko API key
The system SHALL allow an authenticated user to store a personal CoinGecko API key associated with their account.

#### Scenario: Saving a valid key
- **WHEN** an authenticated user submits a valid CoinGecko API key via the settings form
- **THEN** the system validates the key against CoinGecko and persists it in the user's record

#### Scenario: Saving an invalid key
- **WHEN** an authenticated user submits an invalid CoinGecko API key via the settings form
- **THEN** the system rejects the key, does NOT persist it, and displays an error message on the form

#### Scenario: Updating a key
- **WHEN** an authenticated user submits a new valid CoinGecko API key and already has one stored
- **THEN** the system validates the new key and replaces the existing key with the new one

#### Scenario: Clearing a key
- **WHEN** an authenticated user submits an empty key value
- **THEN** the system removes the stored key from the user's record

### Requirement: Price fetching uses per-user API key
The system SHALL use the authenticated user's personal CoinGecko API key when fetching prices.

#### Scenario: User has a personal key
- **WHEN** the system fetches prices for a user who has a stored CoinGecko API key
- **THEN** the system sends the request using the user's personal key

#### Scenario: User has no personal key
- **WHEN** the system fetches prices for a user who has no stored CoinGecko API key
- **THEN** the system redirects the user to `/settings` with an error indicating a key is required

#### Scenario: HTMX search without key
- **WHEN** the system performs a coin search via HTMX for a user who has no stored CoinGecko API key
- **THEN** the system returns an inline error message instead of redirecting

### Requirement: Coin search uses per-user API key
The system SHALL use the authenticated user's personal CoinGecko API key when searching coins.

#### Scenario: User has a personal key
- **WHEN** the system performs a coin search for a user who has a stored CoinGecko API key
- **THEN** the system sends the request using the user's personal key

#### Scenario: User has no personal key
- **WHEN** the system performs a coin search for a user who has no stored CoinGecko API key
- **THEN** the system redirects the user to `/settings` with an error indicating a key is required
