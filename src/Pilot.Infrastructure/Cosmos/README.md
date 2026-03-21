# Cosmos DB containers

Create these containers in database `pilot-banana` (or value from `Cosmos:DatabaseId`):

| Container      | Partition key path |
|----------------|---------------------|
| users          | `/id`               |
| campaigns      | `/userId`           |
| posts          | `/campaignId`       |
| channelLinks   | `/userId`           |

Config section: `Cosmos` with `Endpoint`, `Key`, `DatabaseId`, and optional container name overrides.
