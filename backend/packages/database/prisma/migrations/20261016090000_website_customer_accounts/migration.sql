CREATE TABLE "website_customers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "crm_customer_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_customers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "website_customers_email_key" UNIQUE ("email"),
    CONSTRAINT "website_customers_email_normalized_check" CHECK ("email" = lower(btrim("email")))
);

CREATE TABLE "website_customer_sessions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "website_customer_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "website_customer_sessions_token_hash_key" UNIQUE ("token_hash"),
    CONSTRAINT "website_customer_sessions_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "website_customers"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "website_customer_sessions_customer_id_idx"
    ON "website_customer_sessions"("customer_id");
CREATE INDEX "website_customer_sessions_expires_at_idx"
    ON "website_customer_sessions"("expires_at");
