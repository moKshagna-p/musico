ALTER TABLE "user_rating"
ALTER COLUMN "rating" TYPE real
USING "rating"::real;
