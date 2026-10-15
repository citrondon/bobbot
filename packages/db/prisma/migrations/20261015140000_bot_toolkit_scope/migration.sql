-- "Empty means every connected toolkit" and "empty means nothing selected yet" were the same
-- value, so a bot could never be scoped to no connector at all: a scoped-to-nothing bot fell
-- back to every toolkit. A second column carries the missing distinction. Prisma cannot express
-- a nullable list, hence the pair.
--
-- A bot that already names toolkits was scoped on purpose. One with an empty list meant
-- "everything", which is what the default false keeps it as — so no existing bot changes.

ALTER TABLE "bots" ADD COLUMN "toolkitsScoped" BOOLEAN NOT NULL DEFAULT false;

UPDATE "bots" SET "toolkitsScoped" = true WHERE "allowedToolkits" <> ARRAY[]::TEXT[];
