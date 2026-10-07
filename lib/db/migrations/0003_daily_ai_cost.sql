CREATE VIEW "daily_ai_cost" AS
SELECT
  date_trunc('day', "created_at") AS "day",
  count(*) FILTER (WHERE "charged") AS "ai_scans",
  count(*) FILTER (WHERE "status" = 'failed' AND "charged") AS "refunded",
  sum("cost_micros") AS "cost_micros"
FROM "scan"
GROUP BY date_trunc('day', "created_at");
