# Dining Data Setup Guide

To get the Dining features (Meal Optimizer, Retail Swipes, etc.) working on a new machine, follow these steps:

## 1. Database Migration
The dining system uses the `food_items` table for non-hall restaurant data and any local fallback records.

Run the following command in the `Backend` directory:
```bash
python migrate_seed_data.py
```
*Note: Ensure your `.env` file has the correct DB credentials.*

## 2. Data Sourcing Details
- **Dining Halls (Sbisa, Commons, Duncan)**: Data is fetched live from DineOnCampus.
- **Restaurants**: Data is pulled from the local `food_items` table.

## 3. Troubleshooting
If the data isn't showing up for others:
- Ensure they have run `pip install pulp psycopg2-binary`.
- Ensure their `DATABASE_URL` or `.env` DB credentials point to a reachable PostgreSQL instance.
- Ensure they have run the `migrate_seed_data.py` script locally.
