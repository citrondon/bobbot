-- Per-bot allowlist of connector toolkit slugs, matched case-insensitively against the
-- connected accounts a run may use. Empty keeps every connected toolkit visible, so existing
-- bots keep their behaviour. Unknown slugs match nothing rather than failing a run, so a bot
-- can be pointed at a toolkit before anybody connects it.
ALTER TABLE "bots" ADD COLUMN "allowedToolkits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
