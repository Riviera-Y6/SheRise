-- We-Rise public terminology migration.
-- Safe to run against an existing SheRise D1 database.
UPDATE campaigns
SET creator = 'Anonymous We-Rise Lady'
WHERE creator = 'Anonymous Sister';

UPDATE community_topics
SET author = 'Anonymous We-Rise Lady'
WHERE author = 'Anonymous Sister';
