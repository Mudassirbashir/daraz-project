-- AddRefreshingTokenUntilColumn Migration
ALTER TABLE daraz_stores
  ADD COLUMN IF NOT EXISTS refreshing_token_until TIMESTAMPTZ;
