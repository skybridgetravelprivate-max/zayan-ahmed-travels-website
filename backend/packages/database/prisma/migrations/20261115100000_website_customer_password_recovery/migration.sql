CREATE TABLE "website_customer_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_customer_password_reset_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "website_customer_password_reset_tokens_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "website_customer_password_reset_tokens_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "website_customers"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "website_customer_password_reset_tokens_customer_id_idx"
    ON "website_customer_password_reset_tokens"("customer_id");
CREATE INDEX "website_customer_password_reset_tokens_expires_at_idx"
    ON "website_customer_password_reset_tokens"("expires_at");

-- Recovery tokens are accessed only through the server database connection.
ALTER TABLE "website_customer_password_reset_tokens" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "website_customer_password_reset_tokens" FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON TABLE "website_customer_password_reset_tokens" FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON TABLE "website_customer_password_reset_tokens" FROM authenticated;
    END IF;
END $$;
