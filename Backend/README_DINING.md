# Dining Data Setup Guide

To get the Dining features (Meal Optimizer, Retail Swipes, etc.) working on a new machine, follow these steps:

## 1. Database Migration
The "Retail Swipes" feature and certain "Menu Fallbacks" rely on pre-populated data in the `food_items` table. Because this data is static (restaurant menus don't change often), it must be manually seeded.

Run the following command in the `Backend` directory:
```bash
python migrate_seed_data.py
```
*Note: Ensure your `.env` file has the correct DB credentials.*

## 2. API Keys
The **Food Database** search uses the **USDA FoodData Central API**.
- Register for a key at [https://fdc.nal.usda.gov/api-key-signup.html](https://fdc.nal.usda.gov/api-key-signup.html)
- Add it to your `.env` file:
  ```env
  USDA_API_KEY=your_key_here
  ```
- *A fallback key is included in `usda_service.py`, but it may hit rate limits.*

## 3. Data Sourcing Details
- **Dining Halls (Sbisa, Commons, Duncan)**: Data is fetched live from `api.dineoncampus.com`.
- **Restaurants**: Data is pulled from the local `food_items` table (populated by the migration script).
- **USDA**: Used as a fallback/search source for branded and external food items.

## 4. Troubleshooting
If the data isn't showing up for others:
- Ensure they have run `pip install pulp psycopg2-binary`.
- Ensure their `DATABASE_URL` or `.env` DB credentials point to a reachable PostgreSQL instance.
- Ensure they have run the `migrate_seed_data.py` script locally.
